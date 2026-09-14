# Compartir la app de Rifa

La app es un solo archivo y la puedes publicar gratis en Vercel para compartirla por enlace
(igual que hiciste con la de remesa). Los datos se guardan en cada celular que la abra
(localStorage), así que cada vendedor puede llevar su propia cuenta.

## Paso 1 — Crear el repo en GitHub

1. Entra a https://github.com → **New repository**.
2. Nombre (ej. `rifa-app`), **Public**, NO marques "Add a README" (para que la carpeta
   quede vacía y solo subas estos archivos).
3. Clic en **Create repository**.
4. Página "Quick setup" → clic en **uploading an existing file**.

## Paso 2 — Subir los archivos

1. En la página de subida arrastra TODOS estos archivos/carpetas de
   `C:\Users\USUARIO\crea1\rifa-subir-github`:
   - `index.html`
   - `manifest.json`
   - `package.json`
   - `README.md`
   - `COMO-COMPARTIR.md`
   - la carpeta `iconos/` (arrástrala completa, con sus 2 .png adentro)
2. **Commit changes** → "Commit directly to the main branch" → Commit.

## Paso 3 — Publicar en Vercel

1. Entra a https://vercel.com/new e inicia sesión con tu GitHub.
2. **Import** el repositorio `rifa-app`.
3. Se detecta como proyecto **estático** (no necesita configuración ni comando de build).
   Pulsa **Deploy**.
4. Al terminar te da una URL tipo `https://tu-rifa.vercel.app`. Ábrela en el móvil
   y agrégala a pantalla de inicio (PWA) con el menú ⋮ → "Agregar a pantalla de inicio".

## Actualizar luego

Cuando cambies `index.html` en `rifa-app/`, reemplaza el archivo en GitHub
(Edit → sube el archivo nuevo → Commiit) y Vercel se actualiza solo.

## Alternativa sin GitHub ni Vercel

Manda directamente el archivo `index.html` por WhatsApp: se abre en el navegador del
celular que lo reciba y funciona igual (aunque guarda los datos en SU celular, no en el tuyo).