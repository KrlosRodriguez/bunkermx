# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BUNKER Creatividad Empresarial corporate website + panel operativo interno.

- **Sitio público**: multi-page, Spanish-language marketing site. Vanilla HTML/CSS/JS, sin build step. Deployed via **cPanel** (actualizado por GitHub). **NUNCA tocar cPanel** — la última vez rompió los correos.
- **Panel operativo** (`/panel/`): app interna con Firebase Auth + Firestore. Deployed via **Firebase Hosting** como app independiente en `bunker-panel.web.app`. Solo sirve archivos de `/panel/`.

## How to Run

- **Sitio público**: Open `index.html` directly in a browser, or serve it with any static file server (e.g. `python -m http.server 5500` or VS Code Live Server). There is no build, lint, or test command.
- **Panel**: `firebase deploy --only hosting --project bunker-panel` (solo despliega `/panel/`). Las reglas de Firestore se publican **manualmente** en la consola de Firebase (no por CLI).

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

Dos estilos de PDF generados client-side con jsPDF 2.5.1, toggle Neon/Corporativa en ambos cotizadores:
- **MNT (neon/verde)**: fondo `#050905`, acento `#00FF41`
- **MNT (corporativa)**: fondo `#FFFFFF`, acento `#C6A350`, header `#2C2419`
- **BNK**: mismas dos paletas, agrupación por categoría, condiciones comerciales con plantillas
- **Logo embebido**: `BUNKER_LOGO_B64` en `panel/js/logo-data.js` (y `cotizador-munet/js/logo-data.js`)

### Panel Operativo (`/panel/`)

App interna Firebase con Auth + Firestore. Desplegada en `bunker-panel.web.app`.

**Core:**
- **`panel/index.html`** — login page
- **`panel/dashboard.html`** (~957 lines) — dashboard principal con 12 tabs
- **`panel/404.html`** — página de error dinámica (401/403/404/500) con estética neon
- **`panel/js/firebase-config.js`** — config Firebase (`bunker-panel`)
- **`panel/js/auth.js`** (~116 lines) — autenticación + roles. `BNK_AUTH.currentUser()` es **función**, no propiedad
- **`panel/js/guard.js`** — guard de sesión, redirige a login si no autenticado
- **`panel/js/firestore.js`** (~133 lines) — abstracción Firestore con `BNK_DB.collectionAPI(name)` factory. Colecciones: cotizaciones, clientes, proveedores, catalogo, pipeline, calendario, eventos, usuarios, partners, pagos, cotizacionPartners
- **`panel/js/logo-data.js`** — `BUNKER_LOGO_B64` base64 PNG para PDFs

**Módulos por tab (`panel/js/pages/`):**
- **`cotizaciones.js`** (~169 lines) — tabla con KPIs, filtros, paginación, estado editable
- **`cotizar-mnt.js`** (~641 lines) — wizard 4 pasos (Contacto → Evento → Espacios → Resumen), venue cards desde catálogo Firestore, calendario de fechas, tarifas regular/weekend/montaje, PDF dual, guardado en Firestore
- **`cotizar-bnk.js`** (~417 lines) — formulario de servicios/producción, filas dinámicas de conceptos, autocomplete catálogo, plantillas de condiciones comerciales, PDF dual, guardado en Firestore
- **`pipeline.js`** (~191 lines) — tablero kanban de seguimiento con timeline y notas
- **`clientes.js`** (~703 lines) — CRUD, modal con 4 tabs (General, Contacto, Facturación, Bancarios), % completitud
- **`proveedores.js`** (~1064 lines) — CRUD, modal con 5 tabs (General, Contacto, Fiscales, Bancarios, Servicios), catálogo de servicios/costos por proveedor
- **`calendario.js`** (~116 lines) — calendario mensual de eventos por espacio
- **`reportes.js`** (~190 lines) — funnel, gráficos mensuales, top clientes, rendimiento
- **`catalogo.js`** (~183 lines) — CRUD catálogo de precios con campos especiales para categoría Venues (precioWeekend, precioMontaje)
- **`eventos.js`** (~206 lines) — gestión de producción con checklists por plantilla
- **`usuarios.js`** (~175 lines) — gestión de usuarios con roles (admin, ventas, produccion, lectura)
- **`finanzas.js`** (~800 lines) — módulo FINANZAS con 3 sub-tabs: Cuentas por Pagar (pagos a proveedores/partners con parcialidades), Partners CRUD (co-productores con perfil y datos bancarios), Dispersiones (rastreo de pagos a partners vinculados a cotizaciones liquidadas)

**CSS:**
- **`panel/css/panel.css`** (~368 lines) — estilos base: tokens, header, tabs, buttons, tables, modals, forms, wizard MNT, form BNK, cards `.ctz-card`, progress bar, calendar, responsive
- **`panel/css/login.css`** — estilos del login
- **`panel/css/pipeline.css`** — estilos del kanban
- **`panel/css/reportes.css`** — estilos de reportes/gráficos
- **`panel/css/eventos.css`** — estilos de eventos/producción
- **`panel/css/calendario.css`** — estilos del calendario mensual
- **`panel/css/finanzas.css`** — estilos de finanzas: sub-tabs, partner checks, info grid, dispersión rows

**Infraestructura:**
- **`panel/img/logo-bunker.webp`** — logo (copia local para Firebase Hosting)
- **`functions/index.js`** — Cloud Function `createUser` (requiere plan Blaze)
- **`firestore.rules`** — reglas de seguridad (se publican manualmente en consola)

### Deployment

- **Sitio público**: se actualiza por GitHub → cPanel automático. **No tocar cPanel nunca.**
- **Panel**: `firebase deploy --only hosting --project bunker-panel`
- **Reglas Firestore**: publicar manualmente en Firebase Console → Firestore → Reglas → pegar `firestore.rules` → Publicar
- **Cloud Functions**: `firebase deploy --only functions --project bunker-panel` (requiere plan Blaze)
- **`firebase.json`** — hosting con `public: "panel"`, rewrite `/dashboard` → `/dashboard.html`, sin catch-all (404.html funciona nativo)
- **`.firebaserc`** — proyecto default: `bunker-panel`
- **Firebase project ID**: `bunker-panel` (cuenta: admin@vanguardiaysoluciones)

### UX Patterns del Panel

- **Módulos IIFE**: cada `js/pages/*.js` es un IIFE auto-contenido que se inicializa via `BNK_AUTH.onReady()`
- **Cards `.ctz-card`**: wrapper visual para secciones de formulario (fondo `var(--card)`, borde `var(--bd)`)
- **Toast**: `BNKToast.ok/warn/error(msg)` para notificaciones
- **Modales**: patrón `.bnk-overlay` + `.bnk-modal` con clase `.visible` para toggle
- **Autocomplete**: patrón `.bnk-autocomplete` + `.bnk-ac-item` con clase `.visible`
- **Colores de estado**: clases `.estado-{nombre}` y `.tipo-{MNT|BNK}` para badges

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
