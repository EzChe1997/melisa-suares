# Melisa Suares · Fotografía y Video

Página web estática (HTML + CSS + JS, sin dependencias).

- `index.html`: contenido (servicios, portfolio, sobre mí, contacto)
- `estilos.css`: diseño
- `app.js`: menú, filtros, visor de fotos y formulario a WhatsApp (el número está arriba de todo)
- `img/full`: fotos grandes (visor) · `img/thumb`: miniaturas (700 px)

## Agregar una foto al portfolio
1. Copiar la foto grande a `img/full/nombre.jpg` y una versión de 700 px a `img/thumb/nombre.jpg`.
2. Agregar una línea `<figure ...>` dentro de `<div class="galeria">` en `index.html`.
   `data-cat` puede ser: casamiento, 15, aniversario, cumple, egresados, baile.
   Si la foto es vertical, agregar `class="alta"`.

Se publica sola con GitHub Pages al hacer push a `main`.
