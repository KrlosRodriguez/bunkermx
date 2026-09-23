# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BUNKER Creatividad Empresarial corporate website + panel operativo interno.

- **Sitio público**: multi-page, Spanish-language marketing site. Vanilla HTML/CSS/JS, sin build step. Deployed via **cPanel** (actualizado por GitHub). **NUNCA tocar cPanel** — la última vez rompió los correos.
- **Panel operativo** (`/panel/`): app interna con Firebase Auth + Firestore + Storage. Deployed via **Firebase Hosting** como app independiente en `bunker-panel.web.app`. Solo sirve archivos de `/panel/`.

## How to Run

- **Sitio público**: Open `index.html` directly in a browser, or serve it with any static file server (e.g. `python -m http.server 5500` or VS Code Live Server). There is no build, lint, or test command.
- **Panel**: `firebase deploy --only hosting --project bunker-panel` (solo despliega `/panel/`). Las reglas de Firestore se publican con `firebase deploy --only firestore:rules --project bunker-panel`. Deploy completo: `firebase deploy --only hosting,firestore:rules,storage --project bunker-panel`.

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
- **`cotizador-munet/google-apps-script-munet.js`** — código Apps Script: backend del cotizador MNT + CRUD completo para Clientes, Proveedores, ServiciosProveedor, CatalogoPrecio, CotizacionesBNK, listAll, seedCatalogo. Incluye rate limiting (CacheService, 5 req/10 min), validación de campos, honeypot anti-bot, y validación de origen (`source: 'cotizador-web'`).

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
- **BNK**: mismas dos paletas, agrupación por categoría con sub-agrupación por bloque de proveedor, condiciones comerciales con plantillas
- **Orden de Trabajo (OT)**: paleta corporativa, filtrado por proveedor, agrupación por bloque, sección de notas
- **Logo embebido**: `BUNKER_LOGO_B64` en `panel/js/logo-data.js` (y `cotizador-munet/js/logo-data.js`)
- **Regeneración**: `panel/js/pdf-rebuild.js` reconstruye PDFs idénticos desde datos de Firestore (sin necesidad de storage externo)

### Panel Operativo (`/panel/`)

App interna Firebase con Auth + Firestore. Desplegada en `bunker-panel.web.app`.

**Core:**
- **`panel/index.html`** — login page
- **`panel/dashboard.html`** (~2230 lines) — dashboard principal con 12 tabs agrupados visualmente (Ventas | Directorio | Operaciones | Admin). Incluye Chart.js 4.4.0 CDN con SRI integrity hash
- **`panel/404.html`** — página de error dinámica (401/403/404/500) con estética neon
- **`panel/js/firebase-config.js`** — config Firebase (`bunker-panel`), inicialización de servicios con typeof guards para SDKs opcionales (Storage no se carga en login)
- **`panel/js/auth.js`** (~116 lines) — autenticación + roles. `BNK_AUTH.currentUser()` es **función**, no propiedad
- **`panel/js/guard.js`** — guard de sesión, redirige a login si no autenticado
- **`panel/js/firestore.js`** (~245 lines) — abstracción Firestore con `BNK_DB.collectionAPI(name)` factory. Colecciones: cotizaciones (sin orderBy server-side, se ordena client-side), clientes, proveedores, catalogo, eventos, usuarios, partners, pagos, cotizacionPartners, cotizacionProveedores, cuentasCobrar, actividadGlobal (ordered by timestamp desc). Incluye `BNK_DB.bloques(proveedorId)` (subcollection API), `BNK_DB.documentos(entidad, entityId)` (subcollection API para documentos de expediente), `BNK_DB.allServicios()` y `BNK_DB.allBloques()` (collection group queries cross-proveedor), `BNK_DB.logActividad({ tipo, entidad, entidadId, referencia, detalle })` (helper que auto-fills usuario, usuarioId, timestamp)
- **`panel/js/pdf-rebuild.js`** (~290 lines) — regenera PDFs MNT y BNK desde datos guardados en Firestore. `BNKPdfRebuild.download(cotData, style)` detecta fuente y genera el PDF correspondiente
- **`panel/js/pdf-workorder.js`** (~193 lines) — genera PDF de Orden de Trabajo para proveedores. `BNKPdfWorkOrder.download(cotData, proveedorData, notas)`. Paleta corporativa, secciones: proveedor, evento, servicios requeridos (agrupados por bloque), notas. Fallback matching por proveedorId → nombre → todos los conceptos
- **`panel/js/logo-data.js`** — `BUNKER_LOGO_B64` base64 PNG para PDFs

**Módulos por tab (`panel/js/pages/`):**
- **`cotizaciones.js`** (~1157 lines) — tabla con KPIs, filtros, paginación, estado editable, botón PDF por fila (regenera via pdf-rebuild.js), popover de folio (BNK vinculadas, indicadores partner/proveedor/cliente, crear BNK, orden de trabajo), modales de vinculación partner/proveedor/cliente, modal OT (orden de trabajo PDF por proveedor)
- **`cotizar-mnt.js`** (~660 lines) — wizard 4 pasos (Contacto → Evento → Espacios → Resumen), venue cards desde catálogo Firestore, calendario de fechas, tarifas regular/weekend/montaje, PDF dual, guardado en Firestore con campos `fecha`, `fechaEvento`, selector de marca por cliente
- **`cotizar-bnk.js`** (~1064 lines) — formulario de servicios/producción, filas dinámicas de conceptos con modo dual (manual + proveedor), cascada categoría→proveedor→servicio/bloque, autocomplete catálogo, bloques de proveedor expandibles, botón "Agregar Bloque" con modal picker, auto-vinculación de proveedores al guardar, plantillas de condiciones comerciales, PDF dual con agrupación por bloque, guardado en Firestore con campos `fecha`, `fechaEvento`, selector de marca por cliente
- **`pipeline.js`** (~530 lines) — tablero kanban con HTML5 drag & drop + touch support para mover cards entre columnas de estado, filtros (tipo MNT/BNK, rango de fechas, monto mínimo), KPI "PIPELINE ACTIVO" con suma de estados activos, confirmación BNKConfirm para Cancelada/Perdida, fix: BNK children usa `_data` (no `filtered`), snapshot listener con cleanup en `beforeunload`, indicador de folios BNK vinculados en cards MNT, logActividad en cambios de estado
- **`documentos.js`** (~437 lines) — módulo compartido `BNKDocumentos` para subida/gestión de documentos de expediente (RFC, INE, comprobante domicilio, etc.). Upload a Firebase Storage, versionado (vigente + historial), drag & drop, validación PDF/JPG/PNG ≤10 MB, admin-only delete, documentos libres. Usado por clientes, proveedores y partners
- **`clientes.js`** (~1024 lines) — CRUD, modal con 5 tabs (General, Contacto, Facturación, Bancarios, Documentos), % completitud con toggle "No aplica extranjero", chips UI para marcas, cotizaciones vinculadas con badges Vinculada/Por nombre, popover de folio con cotizaciones vinculadas por empresa
- **`proveedores.js`** (~1337 lines) — CRUD, modal con 6 tabs (General, Contacto, Fiscales, Bancarios, Servicios, Documentos), doble precio (costoUnitario + precioCliente), bloques de servicios con precio manual, toggle "No aplica extranjero" para completitud, popover de folio con cotizaciones vinculadas
- **`calendario.js`** (~590 lines) — calendario con 3 vistas (mes/semana/día), toggle MES/SEMANA, click en día abre vista detallada, exportación iCal RFC 5545 (.ics), tooltips enriquecidos (folio, cliente, espacio, total), overflow "+N más" cuando >3 eventos/día, filtros por venue, navegación con flechas y HOY, soporta múltiples fechas MNT via desgloseVenues
- **`reportes.js`** (~393 lines) — reportes avanzados con márgenes reales: 4 KPIs (revenue cerrado, costo estimado, margen bruto, tasa conversión), Chart.js bar chart (revenue vs costo mensual) + doughnut (utilización venues), top clientes con barras de margen, funnel de conversión, filtro por período (mes/trimestre/año/todo), exportación CSV con BOM UTF-8 + audit log via `BNK_DB.logActividad`. Cálculo de costo: `JSON.parse(cot.conceptos)` → suma `costoProveedor * cantidad`
- **`catalogo.js`** (~183 lines) — CRUD catálogo de precios con campos especiales para categoría Venues (precioWeekend, precioMontaje)
- **`eventos.js`** (~712 lines) — gestión completa de producción: CRUD eventos (crear/editar modal con cliente, fechaEvento, folioCotizacion), checklists con tareas inline editables (responsable dropdown desde usuarios, fechaLimite date input), detección de tareas vencidas (`.checklist-item--overdue`), "+ TAREA" inline add, admin × delete con BNKConfirm, HTML5 drag reorder con batch `orden` update, plantillas CRUD (listar, agregar, editar, eliminar con BNKConfirm), `BNKEventos.crearEvento()` API cross-módulo, logActividad (`evento_creado`, `evento_editado`, `tarea_completada`)
- **`usuarios.js`** (~175 lines) — gestión de usuarios con roles (admin, ventas, produccion, lectura)
- **`actividad.js`** (~177 lines) — feed de actividad global: bell icon widget en header con badge de actividades no vistas (últimas 24h via `localStorage` key `bnk_last_activity_{uid}`), dropdown con últimas 20 entradas de `BNK_DB.actividadGlobal`, navegación por clic (entry → `activateTab()` al tab relevante), tiempo relativo ("ahora", "hace N min", "hace Nh", "ayer", "hace Nd"), mapas TIPO_ICONS y TIPO_TAB para 13 tipos de actividad. Expone `BNKActividad.load()` y `updateBadge()`
- **`finanzas.js`** (~1290 lines) — módulo FINANZAS con 5 sub-tabs: Cuentas por Pagar (pagos a proveedores/partners con parcialidades), Partners CRUD (co-productores con perfil y datos bancarios, popover de folio con cotizaciones vinculadas y preview expandible), Dispersiones (rastreo de pagos a partners vinculados a cotizaciones liquidadas), Cuentas por Cobrar (accounts receivable con aging buckets 0-30/30-60/60-90/90+ días, columna DÍAS, badge VENCIDO, `.fin-overdue` row styling), P&L (estado de resultados: ingresos desde cuentasCobrar con fechaIngreso, egresos desde pagos con split proveedor/partner, Chart.js stacked bar mensual, tabla mensual, filtro período). Expone `BNKFinanzas.reload()` y `BNKFinanzas.openEntityPopover()` para uso cross-módulo. logActividad en pagos, partners y cuentas por cobrar

**CSS:**
- **`panel/css/panel.css`** (~732 lines) — estilos base: tokens, header, tabs (con `.tab-separator` entre grupos), buttons, tables, modals, forms, wizard MNT, form BNK (flex layout dual-mode), cards `.ctz-card`, progress bar, calendar, popover de folio, entity popover, vinculación lists, bloque badges, toggle "no aplica", documentos de expediente (`.doc-*`), toast retry (`.bnk-toast-retry`), offline indicator (`.bnk-offline`), activity feed (`.act-bell-wrap`, `.act-dropdown`, `.act-entry-*`), touch targets 44px, breakpoint 360px, popover clipping fix, responsive
- **`panel/css/login.css`** — estilos del login (tokens: `--accent`, `--accent-dim`, `--accent-glow`)
- **`panel/css/pipeline.css`** — estilos del kanban: drag styles (`.pipeline-card--dragging`, `.pipeline-col--drop-target`, `.pipeline-card--ghost`), filter bar (`.pipeline-filters`), touch drag ghost
- **`panel/css/reportes.css`** — estilos de reportes: `.cat-bar`, `.top-bar-margen`, chart containers con height fijo, CSV disabled state, KPI widgets grid
- **`panel/css/eventos.css`** — estilos de eventos/producción: overdue task highlight (`.checklist-item--overdue`), inline editing inputs, drag reorder visual feedback, plantilla CRUD styles
- **`panel/css/calendario.css`** — estilos del calendario: month grid, week grid (`.cal-week-grid`), day view (`.cal-day-view`), tooltip (`.cal-tooltip`), overflow badge (`.cal-overflow`), view toggle buttons
- **`panel/css/finanzas.css`** — estilos de finanzas: sub-tabs, partner checks, info grid, dispersión rows, P&L chart height, aging bucket KPIs (`.aging-kpis`), overdue rows (`.fin-overdue`), VENCIDO badge

**Infraestructura:**
- **`panel/img/logo-bunker.webp`** — logo (copia local para Firebase Hosting)
- **`functions/index.js`** — Cloud Function `createUser` (requiere plan Blaze)
- **`firestore.rules`** — reglas de seguridad Firestore (incluye subcollections `documentos` en clientes/proveedores/partners, `hasOnly()` field validation en todas las colecciones con escritura, `actividadGlobal` append-only collection con read:auth + create:auth + no update/delete, campos expandidos en `eventos` y `tareas`)
- **`storage.rules`** — reglas de seguridad Firebase Storage (auth requerido, 10 MB max, PDF/JPG/PNG, admin-only delete)

### Deployment

- **Sitio público**: se actualiza por GitHub → cPanel automático. **No tocar cPanel nunca.**
- **Panel**: `firebase deploy --only hosting --project bunker-panel`
- **Reglas Firestore**: `firebase deploy --only firestore:rules --project bunker-panel`
- **Reglas Storage**: `firebase deploy --only storage --project bunker-panel`
- **Cloud Functions**: `firebase deploy --only functions --project bunker-panel` (requiere plan Blaze)
- **`firebase.json`** — hosting con `site: "bunker-panel"`, `public: "panel"`, rewrite `/dashboard` → `/dashboard.html`, sin catch-all (404.html funciona nativo)
- **`.firebaserc`** — proyecto default: `bunker-panel`
- **Firebase project ID**: `bunker-panel` (cuenta: admin@vanguardiaysoluciones)

### UX Patterns del Panel

- **Módulos IIFE**: cada `js/pages/*.js` es un IIFE auto-contenido que se inicializa via `BNK_AUTH.onReady()`
- **Cards `.ctz-card`**: wrapper visual para secciones de formulario (fondo `var(--card)`, borde `var(--bd)`)
- **Toast**: `BNKToast.ok/warn/error(msg, retryFn?)` para notificaciones. `role="alert"` + `aria-live="assertive"`. Error acepta segundo parámetro `retryFn` que muestra botón "Reintentar" (8s timeout vs 3s normal)
- **Modales**: patrón `.bnk-overlay` + `.bnk-modal` con clase `.visible` para toggle
- **Autocomplete**: patrón `.bnk-autocomplete` + `.bnk-ac-item` con clase `.visible`
- **Colores de estado**: clases `.estado-{nombre}` y `.tipo-{MNT|BNK}` para badges
- **Estados de cotización**: `Recorrido → Cotizada → Negociación → Cerrada → En Producción → Ejecutado → Cancelada → Perdida`. Las cotizaciones nuevas se crean con estado `'Recorrido'`. El estado legacy `'Nueva'` se mapea a `'Recorrido'` en todos los módulos (pipeline, cotizaciones, reportes, finanzas)
- **Campos de fecha en cotizaciones**: `fecha` (ISO timestamp de creación), `fechaEvento` (primera fecha del evento), `createdAt` (server timestamp de Firestore). Todos los módulos usan `d.fecha || d.createdAt` como fallback para compatibilidad con registros legacy
- **PDFs regenerables**: los PDFs no se almacenan en storage. Se regeneran on-the-fly desde datos en Firestore via `BNKPdfRebuild.download(cotData)`. MNT usa `desgloseVenues` (JSON), BNK usa `conceptos` (JSON)
- **Popover de folio (cotizaciones)**: clic en folio de cotización abre popover compacto con info rápida, BNK vinculadas (1:N via `folioMNT`), indicadores de partners/proveedores, y acciones (crear BNK, PDF, vincular). Patrón: popover para ver, modal para actuar
- **Popover de folio (entidades)**: clic en folio de cliente, proveedor o partner abre popover `#entityPopover` reutilizable con lista de cotizaciones vinculadas. Cada cotización es expandible (clic toggle clase `.expanded`) para ver evento, total, estado, pagado. Clientes se vinculan por nombre de empresa (fuzzy match). Partners y proveedores por `cotizacionPartners`/`cotizacionProveedores` + `pagos`
- **Vinculación MNT↔BNK**: relación 1:N. BNK tiene campo `folioMNT` que apunta al folio MNT padre. Desde popover MNT se puede crear BNK con datos pre-llenados
- **cotizacionProveedores**: colección Firestore simétrica a `cotizacionPartners`. Schema: `{ cotizacionId, cotizacionFolio, proveedorId, proveedorNombre }`. Auto-creados al guardar cotización BNK con conceptos de proveedor (`autoVinculado: true`)
- **Vinculación Cliente↔Cotización**: campo `clienteId` + `clienteNombre` en cotización. Modal con auto-match por nombre de empresa (fuzzy). Popover muestra badge "Vinculada" (formal FK) vs "Por nombre" (fuzzy match)
- **Bloques de proveedor**: subcollection `proveedores/{id}/bloques/{bloqueId}` con `nombre`, `precioManual`, `usaPrecioManual`, `orden`. Servicios con campo `bloqueId` para agrupar. En cotizador BNK: expandibles via dropdown (📦 prefix) o botón "Agregar Bloque" con modal picker
- **Doble precio servicios**: cada servicio de proveedor tiene `costoUnitario` (costo real) y `precioCliente` (precio al cliente). Fallback: si `precioCliente` es 0, usa `costoUnitario`
- **PDF Orden de Trabajo**: `BNKPdfWorkOrder.download(cotData, proveedorData, notas)` — PDF corporativo para enviar al proveedor con servicios filtrados por proveedor, accesible desde popover de cotización BNK
- **Toggle "No aplica extranjero"**: checkbox en modales de cliente/proveedor que excluye campos bancarios extranjeros del cálculo de completitud. Persiste como `noAplicaExtranjero: true` en el documento
- **Precio especial MNT**: venues Valeria y Lobby permiten override de precio por cotización en el wizard MNT. Se guarda como `precioEspecial` en `desgloseVenues`
- **Documentos de expediente**: subcollection `{entidad}/{id}/documentos/{docId}` con archivos en Firebase Storage (`documentos/{entidad}/{entityId}/{tipo}/{timestamp}_{filename}`). 7 tipos predefinidos (RFC, domicilio, INE, 32-D, carátula, acta, poder) + documentos libres. Versionado: `vigente: true/false`. Indicador separado `N/M requeridos` (no afecta % completitud). Módulo compartido `BNKDocumentos.render(container, {entidad, entityId})` usado por clientes, proveedores y partners
- **URL hash routing**: tab activo se refleja en `location.hash` (`#cotizaciones`, `#clientes`). Refresh conserva el tab. `activateTab(target)` + `history.replaceState()`
- **Tab grouping**: tabs separados en 4 grupos con `.tab-separator` (Ventas | Directorio | Operaciones | Admin)
- **Datos bancarios restringidos**: tab "Bancarios" oculto (`display:none`) para rol `ventas` en modales de clientes y proveedores. Solo visible para `admin`
- **Offline indicator**: `window.addEventListener('offline/online')` con toast + clase `.bnk-offline` en `body` (banner rojo en header)
- **Currency helper**: `BNKFmt.money(n)` — `Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'})`. Cada módulo también tiene `_formatMXN()` local con `toLocaleString('es-MX')`
- **ARIA emojis**: emojis funcionales (botones, chips) envueltos en `<span role="img" aria-label="...">`. Emojis decorativos (empty states) sin ARIA
- **Wizard breadcrumbs**: progress steps en MNT son clickeables para navegar hacia atrás (click en step ≤ current → `_goToStep(n)`)
- **Scripts defer**: jsPDF y logo-data.js cargan con `defer` para reducir Time-to-Interactive
- **Chart.js**: CDN 4.4.0 con SRI integrity hash, cargado con `defer`. Usado en reportes (bar + doughnut) y finanzas P&L (stacked bar). Instancias destruidas antes de re-render (`chart.destroy()`)
- **HTML5 Drag & Drop**: pipeline cards (dragstart/dragover/drop/dragend) + touch support (touchstart/touchmove/touchend con ghost clone, 10px threshold). Eventos usa drag reorder para tareas con batch `orden` update
- **Activity feed (bell icon)**: `#actBellBtn` en header con badge `#actBellBadge`, dropdown `#actDropdown`. 13 tipos de actividad instrumentados cross-módulo. Badge cuenta actividades no vistas en últimas 24h via `localStorage`
- **iCal export**: calendario genera archivo `.ics` RFC 5545 (VCALENDAR/VEVENT con UID, DTSTART, SUMMARY) para importar en Google Calendar, Outlook, etc.
- **Aging buckets**: finanzas CxC muestra 4 buckets (0-30/30-60/60-90/90+ días) con KPIs y highlight de filas vencidas
- **Confirm dialog**: `BNKConfirm.show(msg, okLabel, cancelLabel)` — modal de confirmación reutilizable usado en pipeline (Cancelada/Perdida), eventos (delete tarea/plantilla)

### Seguridad (post-auditoría 2026-09-22)

- **App Check**: Firebase App Check configurado en consola (reCAPTCHA v3, modo Monitor). **Código cliente desactivado** — activar solo al cambiar a Enforce mode. CSP ya tiene dominios necesarios (`google.com`, `firebaseappcheck.googleapis.com`). SDK comentado en `dashboard.html`
- **CSP**: `Content-Security-Policy` en `firebase.json` con dominios específicos: Firebase, Google reCAPTCHA, App Check, `cdn.jsdelivr.net` (Chart.js CDN). `frame-src` permite `google.com` (para reCAPTCHA cuando se active)
- **XSS prevention**: `_esc()` (DOM-based textContent→innerHTML) en todos los módulos que generan HTML dinámico (reportes, pipeline, eventos, calendario, actividad, finanzas, cotizaciones, clientes, proveedores, documentos). `_safeUrl()` para href en clientes.js y proveedores.js
- **Firestore rules**: `hasOnly()` en todas las colecciones con escritura para prevenir field injection. Roles: admin, ventas, produccion, lectura. Datos sensibles (partners, pagos, finanzas) solo admin
- **Storage rules**: auth requerido, 10 MB max, PDF/JPG/PNG only (regex anclado), admin-only delete con cross-service Firestore lookup
- **Apps Script**: API key validation, rate limiting (5 req/10 min via CacheService), field validation, honeypot anti-bot, source header validation
- **Audit log**: CSV exports logueados a colección `auditLog` en Firestore. Actividad global logueada a `actividadGlobal` via `BNK_DB.logActividad()` desde todos los módulos (cotizaciones, clientes, proveedores, eventos, finanzas)
- **Password policy**: mínimo 8 caracteres en Firebase Auth
- **Cache busting**: scripts con `?v=N` query params en HTML para invalidar CDN cache en deploys. Incrementar versión al modificar JS/CSS
- **Guard pattern**: `guard.js` oculta `document.documentElement` con `visibility:hidden` hasta que auth resuelve. Si `firebase-config.js` falla, la página queda negra — por eso los typeof guards son críticos
- **Pendiente**: LFPDPPP (aviso de privacidad + registro de tratamiento de datos — requiere abogado)

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
