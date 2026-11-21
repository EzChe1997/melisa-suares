// El número de WhatsApp sale de contenido/sitio.json (lo pone construir.ps1 en <body data-whatsapp>).
// Si quedara vacío, se usa el link de WhatsApp de su Instagram y se copia el mensaje.
const TELEFONO_WHATSAPP = document.body.dataset.whatsapp || "";
const LINK_WHATSAPP = "https://wa.me/message/Y2NBHGEVJX2MA1";

// Barra superior: se vuelve sólida al bajar
const barra = document.getElementById("barra");
const actualizarBarra = () => barra.classList.toggle("solida", window.scrollY > 40);
actualizarBarra();
window.addEventListener("scroll", actualizarBarra, { passive: true });

// Menú en celular
const menuBtn = document.getElementById("menuBtn");
const menu = document.getElementById("menu");
function cerrarMenu() {
  menu.classList.remove("abierto");
  menuBtn.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}
menuBtn.addEventListener("click", () => {
  const abierto = menu.classList.toggle("abierto");
  menuBtn.setAttribute("aria-expanded", String(abierto));
  document.body.style.overflow = abierto ? "hidden" : "";
});
menu.querySelectorAll("a").forEach(a => a.addEventListener("click", cerrarMenu));

// Filtros del portfolio
const figuras = [...document.querySelectorAll("#galeria figure")];
const filtros = [...document.querySelectorAll(".filtro")];
function filtrar(cat) {
  filtros.forEach(b => {
    const activo = b.dataset.filtro === cat;
    b.classList.toggle("activo", activo);
    b.setAttribute("aria-selected", String(activo));
  });
  figuras.forEach(f => { f.hidden = cat !== "todo" && f.dataset.cat !== cat; });
  emparejarFinal();
}
filtros.forEach(b => b.addEventListener("click", () => filtrar(b.dataset.filtro)));

// Las fotos verticales ocupan dos filas. Si una queda al final sin fotos al lado,
// su segunda fila quedaría casi vacía y se vería como una tira cortada:
// en ese caso se muestra del tamaño normal, así la galería termina prolija.
const galeria = document.getElementById("galeria");
function emparejarFinal() {
  // cada fila mide lo mismo que una foto horizontal (3:2), así ninguna fila queda aplastada
  const cs = getComputedStyle(galeria);
  const columnas = cs.gridTemplateColumns.split(" ").length;
  const hueco = parseFloat(cs.columnGap) || 0;
  const ancho = (galeria.clientWidth - hueco * (columnas - 1)) / columnas;
  galeria.style.gridAutoRows = `${(ancho * 2 / 3).toFixed(2)}px`;
  figuras.forEach(f => f.classList.remove("alta-corta"));
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const visibles = figuras.filter(f => !f.hidden);
    const esAlta = f => f.classList.contains("alta") && !f.classList.contains("alta-corta");
    const fondo = Math.max(0, ...visibles.filter(f => !esAlta(f)).map(f => f.getBoundingClientRect().bottom));
    const sobran = visibles.filter(f => esAlta(f) && f.getBoundingClientRect().bottom > fondo + 2);
    if (!sobran.length) break;
    sobran.forEach(f => f.classList.add("alta-corta"));
  }
}
let esperaResize;
window.addEventListener("resize", () => { clearTimeout(esperaResize); esperaResize = setTimeout(emparejarFinal, 150); });
emparejarFinal();

// Tarjetas de servicios: llevan al portfolio ya filtrado
document.querySelectorAll("[data-ir]").forEach(a =>
  a.addEventListener("click", () => filtrar(a.dataset.ir))
);

// Visor de fotos
const visor = document.getElementById("visor");
const visorImg = document.getElementById("visorImg");
const visorCuenta = document.getElementById("visorCuenta");
let visibles = [];
let actual = 0;
let turno = 0;          // para ignorar animaciones viejas si se pasa rápido de foto
let arrastreX = 0;      // cuánto se arrastró la foto con el dedo
let saliendo = false;   // hay una foto animándose hacia afuera
let ultimaDir = 1;
const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const DESPLAZAMIENTO = 70;

function urlGrande(i) {
  return visibles[(i + visibles.length) % visibles.length].querySelector("img").dataset.full;
}
function precargar(url) {
  return new Promise(listo => {
    const p = new Image();
    p.onload = p.onerror = () => listo();
    p.src = url;
  });
}

// dir: 1 = siguiente (entra desde la derecha), -1 = anterior, 0 = sin animación de paso
function mostrar(i, dir = 0) {
  actual = (i + visibles.length) % visibles.length;
  const img = visibles[actual].querySelector("img");
  const url = img.dataset.full;
  const miTurno = turno;
  visorCuenta.textContent = `${actual + 1} / ${visibles.length}`;
  // precargar las vecinas para que el paso sea instantáneo
  precargar(urlGrande(actual + 1));
  precargar(urlGrande(actual - 1));

  if (!dir || sinMovimiento || !visorImg.animate) {
    saliendo = false;
    turno++;
    visorImg.getAnimations?.().forEach(a => a.cancel());
    visorImg.style.transform = "";
    visorImg.src = url;
    visorImg.alt = img.alt;
    arrastreX = 0;
    return;
  }

  ultimaDir = dir;
  // Si la foto ya está saliendo, no repetir la animación: al terminar entra la última foto elegida
  if (saliendo) return;
  saliendo = true;

  // arrancar la salida desde donde esté la foto (por si estaba entrando)
  const cs = getComputedStyle(visorImg);
  const desdeTr = arrastreX ? `translateX(${arrastreX}px)` : (cs.transform === "none" ? "translateX(0)" : cs.transform);
  const desdeOp = cs.opacity;
  visorImg.getAnimations().forEach(a => a.cancel());
  const salida = visorImg.animate(
    [
      { transform: desdeTr, opacity: desdeOp },
      { transform: `translateX(${-dir * DESPLAZAMIENTO + Math.min(0, arrastreX * 0.3)}px)`, opacity: 0 }
    ],
    { duration: 170, easing: "ease-in", fill: "forwards" }
  );
  visorImg.style.transform = "";
  arrastreX = 0;

  setTimeout(async () => {
    // esperar a que cargue la foto elegida (si se siguió clickeando, la última)
    let objetivo;
    do {
      objetivo = actual;
      await precargar(urlGrande(objetivo));
      if (miTurno !== turno || !saliendo) return;
      if (objetivo !== actual) continue;
      const fig = visibles[objetivo].querySelector("img");
      visorImg.src = fig.dataset.full;
      visorImg.alt = fig.alt;
      // decode() puede tardar o colgarse en algunos navegadores: no esperar más de 250 ms
      await Promise.race([visorImg.decode().catch(() => {}), new Promise(s => setTimeout(s, 250))]);
      if (miTurno !== turno || !saliendo) return;
    } while (objetivo !== actual);
    saliendo = false;
    turno++;
    salida.cancel();
    visorImg.animate(
      [
        { transform: `translateX(${ultimaDir * DESPLAZAMIENTO}px)`, opacity: 0 },
        { transform: "translateX(0)", opacity: 1 }
      ],
      { duration: 280, easing: "cubic-bezier(.2,.7,.2,1)" }
    );
  }, 170);
}
function abrirVisor(fig) {
  visibles = figuras.filter(f => !f.hidden);
  visor.hidden = false;
  document.body.style.overflow = "hidden";
  mostrar(visibles.indexOf(fig));
  if (!sinMovimiento && visorImg.animate) {
    visorImg.animate(
      [{ transform: "scale(.96)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
      { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)" }
    );
  }
  document.getElementById("visorCerrar").focus();
}
function cerrarVisor() {
  visor.hidden = true;
  document.body.style.overflow = "";
}
figuras.forEach(f => f.addEventListener("click", () => abrirVisor(f)));
document.getElementById("visorCerrar").addEventListener("click", cerrarVisor);
document.getElementById("visorAnt").addEventListener("click", e => { e.stopPropagation(); mostrar(actual - 1, -1); });
document.getElementById("visorSig").addEventListener("click", e => { e.stopPropagation(); mostrar(actual + 1, 1); });
visor.addEventListener("click", e => { if (e.target === visor) cerrarVisor(); });
document.addEventListener("keydown", e => {
  if (visor.hidden) return;
  if (e.key === "Escape") cerrarVisor();
  if (e.key === "ArrowLeft") mostrar(actual - 1, -1);
  if (e.key === "ArrowRight") mostrar(actual + 1, 1);
});
// Deslizar con el dedo en el celular: la foto sigue al dedo
let toqueX = null, toqueY = null, horizontal = null;
visor.addEventListener("touchstart", e => {
  toqueX = e.touches[0].clientX;
  toqueY = e.touches[0].clientY;
  horizontal = null;
  arrastreX = 0;
  visorImg.getAnimations?.().forEach(a => a.cancel());
}, { passive: true });
visor.addEventListener("touchmove", e => {
  if (toqueX === null) return;
  const dx = e.touches[0].clientX - toqueX;
  const dy = e.touches[0].clientY - toqueY;
  if (horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) horizontal = Math.abs(dx) > Math.abs(dy);
  if (!horizontal) return;
  arrastreX = dx;
  visorImg.style.transform = `translateX(${dx}px)`;
  visorImg.style.opacity = String(1 - Math.min(Math.abs(dx) / 600, 0.4));
}, { passive: true });
visor.addEventListener("touchend", () => {
  if (toqueX === null) return;
  toqueX = null;
  visorImg.style.opacity = "";
  if (horizontal && Math.abs(arrastreX) > 60) {
    const dir = arrastreX < 0 ? 1 : -1;
    mostrar(actual + dir, dir);
  } else if (arrastreX) {
    // arrastre corto: la foto vuelve a su lugar
    const desde = arrastreX;
    arrastreX = 0;
    visorImg.style.transform = "";
    if (visorImg.animate && !sinMovimiento) {
      visorImg.animate([{ transform: `translateX(${desde}px)` }, { transform: "translateX(0)" }],
        { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" });
    }
  }
});

// Aparición suave al hacer scroll
const aRevelar = document.querySelectorAll(".encabezado, .servicio, .sobre, .paso, .contacto-intro, .formulario");
if ("IntersectionObserver" in window) {
  const obs = new IntersectionObserver(entradas => {
    entradas.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("visible"); obs.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  aRevelar.forEach(el => { el.classList.add("revelar"); obs.observe(el); });
}

// Formulario → WhatsApp
if (TELEFONO_WHATSAPP) {
  document.querySelectorAll("a[data-wa]").forEach(a => {
    a.href = `https://wa.me/${TELEFONO_WHATSAPP}`;
  });
}

const form = document.getElementById("formulario");
const aviso = document.getElementById("aviso");

// La fecha del evento no puede ser anterior a hoy (fecha local, no UTC)
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
form.elements.fecha.min = hoyISO();

function formatearFecha(valor) {
  if (!valor) return "";
  const [a, m, d] = valor.split("-");
  return `${d}/${m}/${a}`;
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const datos = new FormData(form);
  const nombre = datos.get("nombre").trim();
  const evento = datos.get("evento");

  form.querySelectorAll(".invalido").forEach(el => el.classList.remove("invalido"));
  const faltan = [];
  if (!nombre) faltan.push(form.elements.nombre);
  if (!evento) faltan.push(form.elements.evento);
  if (faltan.length) {
    faltan.forEach(el => el.classList.add("invalido"));
    faltan[0].focus();
    aviso.textContent = "Completá tu nombre y el tipo de evento.";
    return;
  }
  const fecha = datos.get("fecha");
  if (fecha && fecha < hoyISO()) {
    form.elements.fecha.classList.add("invalido");
    form.elements.fecha.focus();
    aviso.textContent = "Esa fecha ya pasó. Elegí la fecha de tu evento.";
    return;
  }

  const servicios = datos.getAll("servicio");
  const lineas = [
    `¡Hola Melisa! Soy ${nombre} y quiero consultar por un evento.`,
    `• Evento: ${evento}`,
    datos.get("fecha") && `• Fecha: ${formatearFecha(datos.get("fecha"))}`,
    datos.get("lugar").trim() && `• Lugar: ${datos.get("lugar").trim()}`,
    servicios.length && `• Me interesa: ${servicios.join(" y ")}`,
    datos.get("mensaje").trim() && `\n${datos.get("mensaje").trim()}`
  ].filter(Boolean);
  const texto = lineas.join("\n");

  if (TELEFONO_WHATSAPP) {
    window.open(`https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    aviso.textContent = "¡Listo! Se abrió WhatsApp con tu mensaje.";
    return;
  }

  let copiado = false;
  try {
    await navigator.clipboard.writeText(texto);
    copiado = true;
  } catch (_) { /* sin permiso para copiar */ }
  window.open(LINK_WHATSAPP, "_blank", "noopener");
  aviso.textContent = copiado
    ? "Se abrió WhatsApp y tu mensaje quedó copiado: pegalo en el chat y envialo."
    : "Se abrió WhatsApp: contame ahí la fecha y el tipo de evento.";
});
