# Arma la pagina en la carpeta _site a partir de plantilla.html + contenido/*.json
# y prepara las fotos: version grande (maximo 3000 px, si la original es mas chica
# se copia tal cual, sin recomprimir) y miniatura nitida para la grilla.
#
# Lo corre GitHub Actions en cada cambio. Para probar en la PC:
#   powershell -ExecutionPolicy Bypass -File construir.ps1
# y abrir _site\index.html
param(
  [string]$Salida = "_site",
  [string]$Cache = ".cache-img",
  [string]$UrlSitio = "https://melisasuaresph.github.io/",
  [int]$MaxGrande = 3000,
  [int]$LadoCortoMini = 800
)
$ErrorActionPreference = "Stop"
$raiz = $PSScriptRoot
Set-Location $raiz
$utf8 = New-Object System.Text.UTF8Encoding($false)
$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source
$ffprobe = (Get-Command ffprobe -ErrorAction Stop).Source

function Read-Json($ruta) {
  [IO.File]::ReadAllText((Join-Path $raiz $ruta), [Text.Encoding]::UTF8) | ConvertFrom-Json
}
function Esc($s) {
  if ($null -eq $s) { return "" }
  [System.Net.WebUtility]::HtmlEncode([string]$s)
}
function Get-Slug($s) {
  $n = ([string]$s).Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($c in $n.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($c) }
  }
  $r = ($sb.ToString().ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
  if (-not $r) { $r = "x" }
  $r
}
function Get-RutaNormal($p) {
  if (-not $p) { return $null }
  $p = ([string]$p).Trim() -replace '\\', '/'
  $p = [Uri]::UnescapeDataString($p).TrimStart('/')
  # por si la ruta guardada incluye el nombre del sitio
  $p = $p -replace '^melisa-suares/', ''
  if (-not $p) { return $null }
  $p
}
function Get-ListaFotos($v) {
  $r = @()
  foreach ($x in @($v)) {
    if ($null -eq $x) { continue }
    if ($x -is [string]) { $r += $x }
    elseif ($x.foto) { $r += $x.foto }
    elseif ($x.image) { $r += $x.image }
    elseif ($x.src) { $r += $x.src }
  }
  $r | ForEach-Object { Get-RutaNormal $_ } | Where-Object { $_ }
}
function Get-Medidas($archivo) {
  $wh = (& $ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 $archivo | Select-Object -First 1).Trim()
  $partes = $wh -split ','
  @{ w = [int]$partes[0]; h = [int]$partes[1] }
}

# ---------- Fotos ----------
$fotos = @{}
foreach ($d in @("$Cache/g", "$Cache/m")) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

function Get-Foto($rel) {
  if ($fotos.ContainsKey($rel)) { return $fotos[$rel] }
  $src = Join-Path $raiz $rel
  if (-not (Test-Path -LiteralPath $src)) {
    Write-Warning "No encuentro la foto: $rel"
    $fotos[$rel] = $null
    return $null
  }
  $hash = (Get-FileHash -LiteralPath $src -Algorithm SHA1).Hash.Substring(0, 10).ToLowerInvariant()
  $base = (Get-Slug ([IO.Path]::GetFileNameWithoutExtension($rel))) + "-" + $hash
  $ext = [IO.Path]::GetExtension($rel).ToLowerInvariant()
  if ($ext -eq ".jpeg") { $ext = ".jpg" }
  # JPG y WebP que ya miden hasta $MaxGrande se publican tal cual (sin recomprimir)
  $orig = Get-Medidas $src
  $talCual = ([Math]::Max($orig.w, $orig.h) -le $MaxGrande) -and ($ext -eq ".jpg" -or $ext -eq ".webp")
  if ($talCual) { $archivoG = "$base$ext" } else { $archivoG = "$base.jpg" }
  $archivoM = "$base.jpg"
  $g = Join-Path $Cache "g/$archivoG"
  $m = Join-Path $Cache "m/$archivoM"

  if (-not (Test-Path -LiteralPath $g)) {
    if ($talCual) {
      Copy-Item -LiteralPath $src -Destination $g
    } else {
      $f = "scale=w='if(gt(iw,ih),min($MaxGrande,iw),-2)':h='if(gt(iw,ih),-2,min($MaxGrande,ih))':flags=lanczos"
      & $ffmpeg -y -loglevel error -i $src -vf $f -q:v 2 $g
    }
    Write-Host "  foto lista: $rel"
  }
  if (-not (Test-Path -LiteralPath $m)) {
    $f = "scale=w='if(gt(iw,ih),-2,min($LadoCortoMini,iw))':h='if(gt(iw,ih),min($LadoCortoMini,ih),-2)':flags=lanczos"
    & $ffmpeg -y -loglevel error -i $g -vf $f -q:v 2 $m
  }
  $med = Get-Medidas $m
  $info = @{ g = $archivoG; m = $archivoM; w = $med.w; h = $med.h; alta = ($med.h -gt $med.w) }
  $fotos[$rel] = $info
  $info
}

# ---------- Contenido ----------
$sitio = Read-Json "contenido/sitio.json"
$datos = Read-Json "contenido/secciones.json"
$secciones = @($datos.secciones | Where-Object { $_ -and $_.titulo })

$ids = @{}
$listas = @()
$servicios = New-Object System.Text.StringBuilder
$filtros = New-Object System.Text.StringBuilder
$opciones = New-Object System.Text.StringBuilder
$titulos = @()

Write-Host "Preparando fotos..."
foreach ($s in $secciones) {
  $id = Get-Slug $s.titulo
  $n = 2; $base = $id
  while ($ids.ContainsKey($id)) { $id = "$base-$n"; $n++ }
  $ids[$id] = $true

  $lista = @()
  foreach ($rel in (Get-ListaFotos $s.fotos)) {
    $info = Get-Foto $rel
    if ($info) { $lista += $info }
  }
  $portadaRel = Get-RutaNormal $s.portada
  $portada = $null
  if ($portadaRel) { $portada = Get-Foto $portadaRel }
  if (-not $portada -and $lista.Count -gt 0) { $portada = $lista[0] }
  if (-not $portada -and $lista.Count -eq 0) { continue }

  $titulos += [string]$s.titulo
  $listas += , @{ id = $id; titulo = [string]$s.titulo; fotos = $lista }

  [void]$servicios.AppendLine("      <a class=""servicio"" href=""#portfolio"" data-ir=""$id"">")
  [void]$servicios.AppendLine("        <img src=""img/m/$($portada.m)"" alt="""" loading=""lazy"">")
  [void]$servicios.AppendLine("        <div><h3>$(Esc $s.titulo)</h3><p>$(Esc $s.subtitulo)</p></div>")
  [void]$servicios.AppendLine("      </a>")
  if ($lista.Count -gt 0) {
    [void]$filtros.AppendLine("      <button class=""filtro"" data-filtro=""$id"" role=""tab"" aria-selected=""false"">$(Esc $s.titulo)</button>")
  }
  [void]$opciones.AppendLine("          <option>$(Esc $s.titulo)</option>")
}

$otros = $sitio.otros_eventos
if ($otros -and $otros.titulo) {
  [void]$servicios.AppendLine("      <a class=""servicio servicio-texto"" href=""#contacto"">")
  [void]$servicios.AppendLine("        <div><h3>$(Esc $otros.titulo)</h3><p>$(Esc $otros.texto)</p><span class=""flecha"">Consultar &rarr;</span></div>")
  [void]$servicios.AppendLine("      </a>")
  [void]$opciones.AppendLine("          <option>$(Esc $otros.titulo)</option>")
}

# Galeria "Todo": intercala una foto de cada seccion para que quede variado
$galeria = New-Object System.Text.StringBuilder
$max = 0
foreach ($l in $listas) { if ($l.fotos.Count -gt $max) { $max = $l.fotos.Count } }
for ($i = 0; $i -lt $max; $i++) {
  foreach ($l in $listas) {
    if ($i -ge $l.fotos.Count) { continue }
    $f = $l.fotos[$i]
    $clase = ""
    if ($f.alta) { $clase = " class=""alta""" }
    $alt = Esc ("$($l.titulo), foto $($i + 1)")
    [void]$galeria.AppendLine("      <figure data-cat=""$($l.id)""$clase><img src=""img/m/$($f.m)"" data-full=""img/g/$($f.g)"" alt=""$alt"" loading=""lazy"" width=""$($f.w)"" height=""$($f.h)""></figure>")
  }
}

# Portada y Sobre mi
$heroRel = Get-RutaNormal $sitio.portada.foto
$hero = $null
if ($heroRel) { $hero = Get-Foto $heroRel }
if (-not $hero) { $hero = $listas[0].fotos[0] }
$sobreRel = Get-RutaNormal $sitio.sobre_mi.foto
$sobre = $null
if ($sobreRel) { $sobre = Get-Foto $sobreRel }
if (-not $sobre) { $sobre = $hero }

$parrafos = New-Object System.Text.StringBuilder
foreach ($p in ([regex]::Split([string]$sitio.sobre_mi.texto, '\r?\n\s*\r?\n'))) {
  $t = $p.Trim()
  if (-not $t) { continue }
  $t = (Esc $t) -replace '\r?\n', '<br>'
  [void]$parrafos.AppendLine("        <p>$t</p>")
}

# Descripcion para Google y para compartir el link
$minus = @($titulos | ForEach-Object { $_.ToLowerInvariant() })
if ($minus.Count -gt 1) { $lista = ($minus[0..($minus.Count - 2)] -join ", ") + " y " + $minus[-1] }
elseif ($minus.Count -eq 1) { $lista = $minus[0] } else { $lista = "eventos" }
$desc = "Fotograf$([char]0xED)a y video de $lista en Buenos Aires. Reserv$([char]0xE1) tu fecha por WhatsApp."

$whatsapp = ([string]$sitio.contacto.whatsapp) -replace '[^0-9]', ''
$instagram = ([string]$sitio.contacto.instagram).Trim().TrimStart('@')

$reemplazos = [ordered]@{
  "{{DESCRIPCION}}"          = (Esc $desc)
  "{{OG_IMAGEN}}"            = "$($UrlSitio)img/g/$($hero.g)"
  "{{PORTADA_FOTO}}"         = "img/g/$($hero.g)"
  "{{PORTADA_ALT}}"          = (Esc $sitio.portada.descripcion_foto)
  "{{PORTADA_SOBRETITULO}}"  = (Esc $sitio.portada.sobretitulo)
  "{{PORTADA_TITULO}}"       = (Esc $sitio.portada.titulo)
  "{{PORTADA_DESTACADO}}"    = (Esc $sitio.portada.titulo_destacado)
  "{{PORTADA_SUBTITULO}}"    = (Esc $sitio.portada.subtitulo)
  "{{SERVICIOS}}"            = $servicios.ToString().TrimEnd()
  "{{FILTROS}}"              = $filtros.ToString().TrimEnd()
  "{{GALERIA}}"              = $galeria.ToString().TrimEnd()
  "{{SOBRE_FOTO}}"           = "img/g/$($sobre.g)"
  "{{SOBRE_TITULO}}"         = (Esc $sitio.sobre_mi.titulo)
  "{{SOBRE_TEXTO}}"          = $parrafos.ToString().TrimEnd()
  "{{OPCIONES_EVENTO}}"      = $opciones.ToString().TrimEnd()
  "{{WHATSAPP}}"             = $whatsapp
  "{{INSTAGRAM}}"            = (Esc $instagram)
  "{{ANIO}}"                 = (Get-Date).Year
  "{{VERSION}}"              = (Get-Date).ToString("yyyyMMddHHmm")
}
$html = [IO.File]::ReadAllText((Join-Path $raiz "plantilla.html"), [Text.Encoding]::UTF8)
foreach ($k in $reemplazos.Keys) { $html = $html.Replace($k, [string]$reemplazos[$k]) }
if ($html -match '\{\{[A-Z_]+\}\}') { throw "Quedo un marcador sin reemplazar: $($Matches[0])" }

# ---------- Salida ----------
if (Test-Path $Salida) { Get-ChildItem -LiteralPath $Salida -Force | Remove-Item -Recurse -Force }
foreach ($d in @("$Salida/img/g", "$Salida/img/m")) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
[IO.File]::WriteAllText((Join-Path $raiz "$Salida/index.html"), $html, $utf8)
Copy-Item estilos.css, app.js -Destination $Salida
Copy-Item img/firma.png -Destination "$Salida/img/"
Copy-Item admin -Destination $Salida -Recurse
foreach ($info in $fotos.Values) {
  if (-not $info) { continue }
  Copy-Item -LiteralPath (Join-Path $Cache "g/$($info.g)") -Destination "$Salida/img/g/"
  Copy-Item -LiteralPath (Join-Path $Cache "m/$($info.m)") -Destination "$Salida/img/m/"
}
[IO.File]::WriteAllText((Join-Path $raiz "$Salida/.nojekyll"), "", $utf8)

$total = 0
foreach ($l in $listas) { $total += $l.fotos.Count }
Write-Host "Listo: $($listas.Count) secciones, $total fotos en la galeria -> $Salida/index.html"
