# Melisa Suares ph · Fotografía y Video

Página: https://melisasuaresph.github.io/

## Cómo se edita
Todo el contenido se maneja desde el panel **https://melisasuaresph.github.io/admin/** (Sveltia CMS), entrando con un token de GitHub ("Iniciar sesión con un token de acceso"). Las fotos se pueden subir del tamaño que sean: el panel las achica a 3000 px antes de subirlas.

- **Secciones y fotos**: crear, renombrar, ordenar o borrar secciones; subir fotos (varias a la vez), ordenarlas y elegir la foto de portada de cada una.
- **Portada, Sobre mí y contacto**: textos y fotos de la portada y de "Sobre mí", WhatsApp e Instagram.

Al guardar, GitHub arma y publica la página sola en 1 o 2 minutos (pestaña *Actions* del repositorio).

## Cómo está armado
- `contenido/secciones.json` y `contenido/sitio.json`: el contenido (lo que edita el panel).
- `img/fotos/`: las fotos tal como se subieron.
- `plantilla.html`, `estilos.css`, `app.js`: diseño y funcionamiento.
- `construir.ps1`: arma la página en `_site/`. Copia cada foto sin recomprimir si mide hasta 3000 px (si es más grande la achica a 3000 px) y genera miniaturas nítidas para la grilla. Detecta solo si la foto es vertical u horizontal.
- `.github/workflows/publicar.yml`: corre `construir.ps1` y publica en GitHub Pages en cada cambio.
- `admin/`: el panel de edición (Sveltia CMS) y sus formularios (`admin/config.yml`).

## Probar en la PC
```
powershell -ExecutionPolicy Bypass -File construir.ps1
```
y abrir `_site/index.html`. Necesita ffmpeg instalado.
