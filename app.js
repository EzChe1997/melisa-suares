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
}
filtros.forEach(b => b.addEventListener("click", () => filtrar(b.dataset.filtro)));

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

function mostrar(i) {
  actual = (i + visibles.length) % visibles.length;
  const img = visibles[actual].querySelector("img");
  visorImg.src = img.dataset.full;
  visorImg.alt = img.alt;
  visorCuenta.textContent = `${actual + 1} / ${visibles.length}`;
  // precargar la siguiente
  const sig = visibles[(actual + 1) % visibles.length].querySelector("img");
  new Image().src = sig.dataset.full;
}
function abrirVisor(fig) {
  visibles = figuras.filter(f => !f.hidden);
  visor.hidden = false;
  document.body.style.overflow = "hidden";
  mostrar(visibles.indexOf(fig));
  document.getElementById("visorCerrar").focus();
}
function cerrarVisor() {
  visor.hidden = true;
  document.body.style.overflow = "";
}
figuras.forEach(f => f.addEventListener("click", () => abrirVisor(f)));
document.getElementById("visorCerrar").addEventListener("click", cerrarVisor);
document.getElementById("visorAnt").addEventListener("click", e => { e.stopPropagation(); mostrar(actual - 1); });
document.getElementById("visorSig").addEventListener("click", e => { e.stopPropagation(); mostrar(actual + 1); });
visor.addEventListener("click", e => { if (e.target === visor) cerrarVisor(); });
document.addEventListener("keydown", e => {
  if (visor.hidden) return;
  if (e.key === "Escape") cerrarVisor();
  if (e.key === "ArrowLeft") mostrar(actual - 1);
  if (e.key === "ArrowRight") mostrar(actual + 1);
});
// Deslizar con el dedo en el celular
let toqueX = null;
visor.addEventListener("touchstart", e => { toqueX = e.touches[0].clientX; }, { passive: true });
visor.addEventListener("touchend", e => {
  if (toqueX === null) return;
  const dx = e.changedTouches[0].clientX - toqueX;
  if (Math.abs(dx) > 50) mostrar(actual + (dx < 0 ? 1 : -1));
  toqueX = null;
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
