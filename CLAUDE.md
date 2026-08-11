# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BUNKER Creatividad Empresarial corporate website + panel operativo interno.

- **Sitio público**: multi-page, Spanish-language marketing site. Vanilla HTML/CSS/JS, sin build step. Deployed via **cPanel** (actualizado por GitHub). **NUNCA tocar cPanel** — la última vez rompió los correos.
- **Panel operativo** (`/panel/`): app interna con Firebase Auth + Firestore. Deployed via **Firebase Hosting** como app independiente en `bunker-panel-3a352.web.app`. Solo sirve archivos de `/panel/`.

## How to Run

- **Sitio público**: Open `index.html` directly in a browser, or serve it with any static file server (e.g. `python -m http.server 5500` or VS Code Live Server). There is no build, lint, or test command.
- **Panel**: `firebase deploy --only hosting --project bunker-panel-3a352` (solo despliega `/panel/`). Las reglas de Firestore se publican **manualmente** en la consola de Firebase (no por CLI).

## Architecture

Multi-page site with shared core (system.css + system.js) and per-page CSS/JS modules.

### Pages (HTML)

- **`index.html`** (~408 lines) — landing/dashboard: Hero, Ticker, Números, Contacto, Footer.
- **`esencia.html`** — Manifiesto, filosofía y propósito.
- **`servicios.html`** — Producción, giras, venues, audiovisual, streaming.
- **`talento.html`** — Directorio del equipo BUNKER.
- **`proyectos.html`** — Archivo de trayectoria y proyectos.
- **`munet.html`** — Subsistema MUNET (espacios, Pasatono).
- **`hub.html`** — Hub Empresarial BUNKER.
- **`cotizador-munet/index.html`** — Cotizador wizard para renta de espacios MUNET (folios MNT).
- **`cotizador-munet/dashboard.html`** (~1950 lines) — Panel de Ventas: dashboard combinado MNT+BNK con tabla, indicadores, filtros por tipo/estado/fecha, modal para crear cotizaciones de servicios BNK, generación de PDF estilo dorado, autocompletado de clientes. Incluye tabs de navegación (Cotizaciones | Clientes | Proveedores) con secciones, modales de detalle/edición, y vinculación con cotizaciones BNK.

### CSS

- **`css/system.css`** (~937 lines) — estilos compartidos: layout, nav, cursor, grid, tipografía, animaciones, responsive. Design tokens en `:root`.
- **`css/styles.css`** (~776 lines) — estilos legacy del index original (se conserva).
- **`css/pages/*.css`** — estilos específicos por página: dashboard, esencia, hub, munet, proyectos, servicios, talento.
- **`cotizador-munet/css/cotizador-munet.css`** (~659 lines) — estilos del cotizador.

### JavaScript

- **`js/system.js`** (~537 lines) — JS core compartido: cursor, nav, typing, counters, glitch, reveal, page transitions.
- **`js/main.js`** (~88 lines) — JS legacy del index original (se conserva).
- **`js/login-gate.js`** (~82 lines) — gate de autenticación.
- **`js/pages/*.js`** — lógica por página: dashboard.js, esencia.js, proyectos.js, clientes.js, proveedores.js.
- **`js/pages/clientes.js`** (~507 lines) — módulo Clientes (IIFE `window.BNKClientes`): CRUD, tabla con filtros, modal con 4 tabs (General, Contacto, Facturación, Bancarios), % completitud, cotizaciones vinculadas.
- **`js/pages/proveedores.js`** (~859 lines) — módulo Proveedores (IIFE `window.BNKProveedores`): CRUD, tabla con filtros, modal con 5 tabs (General, Contacto, Fiscales, Bancarios, Servicios), catálogo de servicios/costos por proveedor.
- **`cotizador-munet/js/cotizador-munet.js`** (~1244 lines) — lógica del wizard cotizador (pasos, tarifas, PDF neon, envío a Google Sheets).
- **`cotizador-munet/js/logo-data.js`** — logos en base64 (BUNKER_LOGO_B64) para embeber en PDFs.
- **`cotizador-munet/google-apps-script-munet.js`** — código Apps Script: backend del cotizador MNT + CRUD completo para Clientes, Proveedores, ServiciosProveedor, CatalogoPrecio, CotizacionesBNK, listAll, seedCatalogo.

### Backend (Google Apps Script)

El backend vive en Google Apps Script y usa Google Sheets como base de datos y Google Drive para almacenar PDFs.

- **Sheet ID**: `1MrynkbdpsQOq2IuzalyiRfVesUhWcs_020BDl8S_1vk`
- **Drive Folder ID**: `17Hm7m95pxBQFnAD9oO9Mfv0A-136zTYn`
- **Hojas en el Sheet**: `Cotizaciones` (MNT), `CotizacionesBNK` (BNK), `Clientes` (42 cols), `CatalogoPrecio`, `Proveedores` (47 cols), `ServiciosProveedor` (7 cols)
- **Folios**: `MNT-AAMMDD-XXXX` para venues, `BNK-AAMMDD-XXXX` para servicios/producción, `CLI-XXXX` para clientes, `PRV-XXXX` para proveedores, `SRV-XXXX` para servicios
- **Endpoints GET**: `list`, `listAll`, `listClientes`, `listCatalogo`, `updateStatus`, `updateStatusBNK`, `seedCatalogo`, `listProveedores`, `deleteCliente`, `deleteProveedor`, `listServicios`, `deleteServicio`
- **Endpoints POST**: cotización MNT (wizard), cotización BNK (`tipoCotizacion: 'BNK'`), CRUD Clientes (`tipoOperacion: 'createCliente'/'updateCliente'`), CRUD Proveedores (`tipoOperacion: 'createProveedor'/'updateProveedor'`), CRUD Servicios (`tipoOperacion: 'createServicio'/'updateServicio'`)
- **Email**: usa `MailApp.sendEmail` con `name: SENDER_NAME` (no GmailApp, no requiere alias)
- **Deploy**: copiar `google-apps-script-munet.js` al editor de Apps Script → nueva implementación → actualizar URL si cambia

### PDFs

Dos estilos de PDF generados client-side con jsPDF 2.5.1:
- **MNT (neon/verde)**: generado en `cotizador-munet.js`, colores del tema neon del dashboard
- **BNK (dorado/terra)**: generado en `dashboard.html`, colores BUNKER corporativos (dorado `#C6A350`, fondo `#2C2419`)

### Panel Operativo (`/panel/`)

App interna Firebase con Auth + Firestore. Archivos:
- **`panel/index.html`** — login page
- **`panel/dashboard.html`** — dashboard principal con tabs
- **`panel/js/firebase-config.js`** — config Firebase (`bunker-panel-3a352`)
- **`panel/js/auth.js`** — autenticación + roles
- **`panel/js/guard.js`** — guard de sesión
- **`panel/js/firestore.js`** — abstracción Firestore
- **`panel/js/pages/*.js`** — módulos por tab: cotizaciones, pipeline, clientes, proveedores, calendario, reportes, catalogo, eventos, usuarios
- **`panel/css/*.css`** — estilos: login, panel, pipeline, reportes, eventos, calendario
- **`panel/img/logo-bunker.webp`** — logo (copia local para Firebase Hosting)
- **`functions/index.js`** — Cloud Function `createUser` (requiere plan Blaze)
- **`firestore.rules`** — reglas de seguridad (se publican manualmente en consola)

### Deployment

- **Sitio público**: se actualiza por GitHub → cPanel automático. **No tocar cPanel nunca.**
- **Panel**: `firebase deploy --only hosting --project bunker-panel-3a352`
- **Reglas Firestore**: publicar manualmente en Firebase Console → Firestore → Reglas → pegar `firestore.rules` → Publicar
- **Cloud Functions**: `firebase deploy --only functions --project bunker-panel-3a352` (requiere plan Blaze)
- **`firebase.json`** — hosting con `public: "panel"`, solo sirve archivos del panel
- **`.firebaserc`** — proyecto default: `bunker-panel-3a352`
- **Firebase project ID**: `bunker-panel-3a352` (cuenta: admin@vanguardiaysoluciones)

## Key Conventions

- **Language**: all user-facing text is in Spanish. Keep it that way.
- **No build tools**: no bundler, transpiler, or preprocessor. Edit the source files directly.
- **CSS cascade**: styles rely on specificity and cascade order — never use `!important`.
- **Design tokens**: all colors, spacing, and typography sizes are defined as CSS custom properties in `:root` (inside `system.css`). Use these tokens rather than hard-coded values.
- **Modular structure**: shared code goes in `system.css`/`system.js`; page-specific code goes in `css/pages/` and `js/pages/`.
- **Reveal animations**: elements with class `rev` get animated in by `IntersectionObserver` (adds class `vis`). Apply `rev` to new content blocks for consistent entrance animations.
- **Fonts**: Barlow Condensed (headings), Barlow (body), Space Mono (monospace accents) — loaded from Google Fonts.

## Other Files

- `bunker_v2.html` — previous single-page version of the site. Kept as reference.
- `document_pdf*.pdf` — reference PDF documents (company materials).
- `img/` — all image assets (logos, section illustrations).
- `docs/superpowers/specs/` — design specs de features.
- `docs/superpowers/plans/` — planes de implementación detallados.
- `capturas/` — carpeta local para capturas y notas de trabajo (en .gitignore, no se despliega).
