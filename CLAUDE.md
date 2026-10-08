# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

## Project Overview

BUNKER Creatividad Empresarial: sitio público corporativo + panel operativo interno. Tres subsistemas con despliegues independientes:

| Subsistema | Ruta | Stack | Deploy |
|---|---|---|---|
| **Sitio público** | raíz (`index.html`, `esencia.html`, …) | HTML/CSS/JS vanilla, sin build | GitHub → **cPanel** (`.cpanel.yml`) |
| **Panel operativo** | `/panel/` | Firebase Auth + Firestore + Storage | **Firebase Hosting** (`bunker-panel.web.app`) |
| **Cotizador MNT legacy** | `/cotizador-munet/` | HTML/JS + Google Apps Script + Sheets | GitHub → cPanel (junto al sitio público) |

**NUNCA tocar cPanel desde el panel de control** — la última vez rompió los correos.

**El push a `main` NO publica el sitio público.** Verificado el 2026-10-07: producción seguía sirviendo el `index.html` del 10-ago-2026 (`Last-Modified`), sin ninguno de los commits posteriores. Publicar requiere que el dueño de la cuenta ejecute el deploy del repo en cPanel (Git Version Control → *Update from Remote* → *Deploy HEAD Commit*), que corre `.cpanel.yml`. Claude no lo hace. Después de cada deploy, verificar con `curl -sI https://bunkermx.com/ | grep -i last-modified`.

## How to Run

- **Sitio público**: `python -m http.server 5500` o Live Server desde la raíz. Ojo: el sitio usa **URLs limpias** (`/esencia`, no `/esencia.html`) resueltas por `.htaccess` en Apache; `python -m http.server` no las resuelve, así que en local hay que abrir `esencia.html` directamente o usar un server con rewrite.
- **Panel**: `firebase deploy --only hosting --project bunker-panel`. No hay servidor local configurado; se prueba en producción o con `firebase emulators`.
- **Reglas**: `firebase deploy --only firestore:rules --project bunker-panel` / `--only storage`.
- **Deploy completo panel**: `firebase deploy --only hosting,firestore:rules,storage --project bunker-panel`.
- **Cloud Functions**: `firebase deploy --only functions --project bunker-panel` (plan Blaze, Node 18).
- No hay build, lint ni tests en ningún subsistema.

---

## Sitio público (raíz)

Multi-page en español, core compartido (`system.css` + `system.js`) + módulos por página.

### Páginas

`index.html` (457) landing/dashboard · `esencia.html` ADN BUNKER (ecosistema/mecanismo/resultado + Método BNK) · `servicios.html` 4 categorías de servicio · `talento.html` NOSOTROS (experiencia, equipo y Sistema BNK) · `proyectos.html` trayectoria · `archivo.html` archivo completo de proyectos con filtros (`proyectos.css` + `proyectos.js`), noindex hasta que /proyectos lo enlace · `munet.html` subsistema MUNET (enlaza al cotizador) · `hub.html` Hub Empresarial.

Todas las páginas llevan: `<title>` + `meta description`, OG/Twitter Cards completos, `link rel=canonical` con dominio `https://bunkermx.com`, JSON-LD (`Organization` en index, `BreadcrumbList` en interiores), favicon/apple-touch-icon, `theme-color`, preconnect a Google Fonts. Enlaces internos siempre con URL limpia (`/servicios`).

`robots.txt` (bloquea `/panel/`, `/cotizador-munet/dashboard`, `/capturas/`) y `sitemap.xml` (7 URLs limpias; `/archivo` queda excluido hasta la Task 8) viven en la raíz y deben actualizarse al agregar páginas.

### CSS

- **`css/system.css`** (1060) — tokens en `:root`, layout, nav, cursor, grid, tipografía, animaciones, `@media print`, responsive.
- **`css/pages/servicios.css`** (406) — **base compartida de todas las páginas interiores** (esencia, talento, proyectos, munet, hub la cargan antes de su propio CSS). No es solo de servicios.
- **`css/pages/dashboard.css`** (983) — exclusivo de `index.html`.
- **`css/pages/{esencia,talento,proyectos,munet,hub}.css`** — overrides por página.

Tokens principales (`:root` en system.css): `--bg/--bg-surface/--bg-elevated`, `--text/--text-mid/--text-dim`, `--gold` `#C6A350`, `--terra` `#9C4A44`, `--munet` `#2E8B6E`, `--glow-*`, `--border-*`.

### JavaScript

- **`js/system.js`** (561, cargado con `?v=4` en todas las páginas) — cursor (transform GPU-composited), nav + drawer móvil con focus trap, scroll spy, reveal `IntersectionObserver`, typing, counters, boot sequence, page transitions, paneles expand/collapse por hover. Cada bloque corre dentro de `safe(name, fn)` (try/catch + `console.error('[BUNKER] …')`): si uno falla, los demás siguen. La cortina `#page-transition` se quita antes que nada y, si el boot falla, `#main-content` se revela de inmediato. Al agregar un bloque nuevo, envolverlo igual.
- **`js/pages/dashboard.js`** (115) — solo index: triángulo "equilibrio imposible" + formulario de contacto con validación inline.
- **`js/pages/esencia.js`** (23), **`js/pages/proyectos.js`** (152).
- **`js/pages/panel-ui.js`** (493) + **`css/pages/panel-ui.css`** (409) — `BNKToast`, `BNKConfirm`, `BNKSort`, `BNKPagination`, `BNKExport`. **Pertenecen al cotizador legacy** (`cotizador-munet/dashboard.html`), no al sitio público ni al panel Firebase (el panel tiene su propio port en `panel/js/table-helpers.js`).

### Rediseño por etapas (minuta 2026-10)

Plan: `docs/superpowers/plans/2026-10-07-rediseno-sitio-minuta.md`. Cada etapa va en una rama `web/etapa-N-*` y se integra en la rama `web/rediseno`, que se fusiona a `main` cuando se apruebe; publicar sigue requiriendo el deploy manual en cPanel. Cada etapa se integra cuando `python scripts/check_site.py` pasa y se revisó en navegador a 1440/1025/375 px.

- `scripts/check_site.py` — verificación estática sin dependencias (enlaces internos, anclas, ids únicos, CSS versionados y comprobaciones por etapa). Correr antes de cada push.
- `scripts/swap_block.py` — reemplaza/inserta bloques HTML entre marcadores exactos; aborta si un marcador no es único.
- Los CSS de las páginas llevan `?v=N`: subirlo al modificar el archivo.

---

## Cotizador MNT legacy (`/cotizador-munet/`)

Sistema anterior al panel Firebase, aún desplegado y en uso. Backend Google Apps Script + Sheets.

- **`index.html`** (233) + **`js/cotizador-munet.js`** (1259) + **`css/cotizador-munet.css`** (660) — wizard público de renta de espacios MUNET (pasos, tarifas, PDF neon, envío a Apps Script). Enlazado desde `munet.html`.
- **`dashboard.html`** (2306) — Panel de Ventas legacy sobre Sheets (tabla MNT+BNK, clientes, proveedores, PDF dorado). Carga `../js/pages/panel-ui.js`, `../js/pages/clientes.js` (715), `../js/pages/proveedores.js` (1106). **Superseded por `/panel/`**; se conserva por compatibilidad.
- **`js/login-gate.js`** (92) — gate con credenciales hasheadas SHA-256 en `sessionStorage`.
- **`js/logo-data.js`** — `BUNKER_LOGO_B64` para embeber en PDFs.

### Backend Google Apps Script

`cotizador-munet/google-apps-script-munet.js` (1354). Sheets como DB, Drive para PDFs. Credenciales vía `PropertiesService` con fallback hardcodeado.

- **Sheet ID**: `1MrynkbdpsQOq2IuzalyiRfVesUhWcs_020BDl8S_1vk` · **Drive Folder**: `17Hm7m95pxBQFnAD9oO9Mfv0A-136zTYn`
- **Hojas**: `Cotizaciones` (MNT), `CotizacionesBNK`, `Clientes` (42 cols), `CatalogoPrecio`, `Proveedores` (47 cols), `ServiciosProveedor` (7 cols)
- **Folios**: `MNT-AAMMDD-XXXX`, `BNK-AAMMDD-XXXX`, `CLI-XXXX`, `PRV-XXXX`, `SRV-XXXX`
- **GET** (`?action=`): `list` (default), `listBNK`, `listAll`, `listClientes`, `listCatalogo`, `saveCatalogo`, `seedCatalogo`, `updateStatus`, `updateStatusBNK`, `listProveedores`, `createCliente`, `deleteCliente`, `deleteProveedor`, `listServicios`, `deleteServicio`
- **POST**: cotización MNT (wizard), cotización BNK (`tipoCotizacion: 'BNK'`), `tipoOperacion: 'create|update' + Cliente|Proveedor|Servicio`
- **Doble escritura a Firestore** (`writeToFirestore`, marcada "transitorio"): cada cotización/cliente/proveedor guardado en Sheets se replica vía REST a `bunker-panel` con `ScriptApp.getOAuthToken()`. Es lo que mantiene sincronizados el cotizador legacy y el panel.
- **Seguridad**: validación de API key, rate limiting (CacheService, 5 req/10 min), validación de campos, honeypot anti-bot, validación de origen (`source: 'cotizador-web'`)
- **Email**: `MailApp.sendEmail` con `name: SENDER_NAME` (no GmailApp, no requiere alias)
- **Deploy**: copiar el archivo al editor de Apps Script → nueva implementación → actualizar URL en el cliente si cambia
- **`scripts/migrate-sheets-to-firestore.js`** (65) — script one-shot para pegar en Apps Script; migración inicial Sheets → Firestore. Ya ejecutado.

---

## Panel operativo (`/panel/`)

App interna Firebase. SDK compat **10.12.0** (app, auth, firestore, storage, functions). Desplegada en `bunker-panel.web.app`.

### Core

- **`panel/index.html`** (37) — login · **`panel/404.html`** (107) — error dinámico 401/403/404/500 · **`panel/dashboard.html`** (2207) — app completa, 12 tabs
- **`panel/js/firebase-config.js`** (30) — config `bunker-panel`, `BNK_FIREBASE.{app,auth,db,storage}`, persistencia `SESSION`. Storage con typeof guard (no se carga en login). App Check comentado.
- **`panel/js/auth.js`** (116) — `BNK_AUTH.currentUser()` es **función**, no propiedad. También `currentRole()`, `logout()`, `onReady(cb)`, `canEdit(section)`, `canView(section)`. Verifica `usuarios/{uid}.activo`.
- **`panel/js/guard.js`** (30) — oculta `document.documentElement` con `visibility:hidden` hasta resolver auth, inyecta nombre/rol en header, oculta tabs según `data-require-role`. Si `firebase-config.js` falla, la página queda negra — de ahí la criticidad de los typeof guards.
- **`panel/js/firestore.js`** (244) — `BNK_DB`, factory `collectionAPI(name, {orderBy})` con `list/get/create/update/delete/onSnapshot`.
- **`panel/js/pdf-rebuild.js`** (417) — `BNKPdfRebuild.download(cotData, style)`: regenera PDFs MNT/BNK desde Firestore.
- **`panel/js/pdf-workorder.js`** (205) — `BNKPdfWorkOrder.download(cotData, proveedorData, notas)`: Orden de Trabajo para proveedor.
- **`panel/js/logo-data.js`** — `BUNKER_LOGO_B64`.

#### Colecciones en `BNK_DB`

`cotizaciones` (sin orderBy server-side, se ordena client-side), `clientes`, `proveedores`, `catalogo`, `usuarios`, `eventos`, `plantillas`, `config`, `partners`, `pagos`, `cotizacionPartners`, `cotizacionProveedores`, `cuentasCobrar`, `actividadGlobal` (orderBy `timestamp` desc, `limit: 100`). `collectionAPI` acepta `{ orderBy, limit }`; `limit` aplica a `list()` y `onSnapshot()`.

Subcollection APIs: `BNK_DB.actividad` (`cotizaciones/{id}/actividad`), `BNK_DB.tareas` (`eventos/{id}/tareas`), `BNK_DB.bloques(proveedorId)` (`proveedores/{id}/bloques`), `BNK_DB.documentos(entidad, entityId)`.
Collection group: `BNK_DB.allServicios()`, `BNK_DB.allBloques()`.
Helper: `BNK_DB.logActividad({ tipo, entidad, entidadId, referencia, detalle })` — autocompleta usuario/usuarioId/timestamp y falla silenciosamente.

### Tabs y módulos (`panel/js/pages/`)

12 tabs en 4 grupos separados por `.tab-separator`, con `data-require-role`:

**Ventas** — COTIZACIONES (todos) · COTIZAR MNT · COTIZAR BNK · PIPELINE (admin,ventas)
**Directorio** — CLIENTES · PROVEEDORES (admin,ventas)
**Operaciones** — CALENDARIO (admin,ventas,produccion) · REPORTES · CATÁLOGO (admin,ventas) · EVENTOS (admin,ventas,produccion)
**Admin** — FINANZAS · USUARIOS (admin)

| Módulo | Líneas | Qué hace |
|---|---|---|
| `cotizaciones.js` | 1170 | Tabla con KPIs, filtros, sort, paginación, estado editable, PDF por fila, popover de folio (BNK vinculadas, indicadores partner/proveedor/cliente, crear BNK, OT), modales de vinculación y modal de Orden de Trabajo |
| `cotizar-mnt.js` | 1028 | Wizard 4 pasos (Contacto → Evento → Espacios → Resumen), venue cards desde catálogo, calendario, tarifas regular/weekend/montaje, precio especial por venue, PDF dual, selector de marca |
| `cotizar-bnk.js` | 1065 | Formulario de servicios/producción, filas de conceptos en modo dual (manual + proveedor), cascada categoría→proveedor→servicio/bloque, autocomplete de catálogo, bloques expandibles + modal picker, auto-vinculación de proveedores, plantillas de condiciones, PDF dual |
| `pipeline.js` | 529 | Kanban con drag & drop HTML5 + touch, filtros (tipo/fechas/monto), KPI pipeline activo, `BNKConfirm` en Cancelada/Perdida, snapshot listener con cleanup en `beforeunload` |
| `clientes.js` | 1059 | CRUD, modal 5 tabs (General, Contacto, Facturación, Bancarios, Documentos), % completitud, chips de marcas, cotizaciones vinculadas (Vinculada vs Por nombre), detección de duplicados |
| `proveedores.js` | 1359 | CRUD, modal 6 tabs (+ Fiscales, Servicios), doble precio (`costoUnitario`/`precioCliente`), bloques de servicios con precio manual |
| `calendario.js` | 862 | 3 vistas (mes/semana/día), export iCal RFC 5545, tooltips enriquecidos, overflow "+N más", filtros por venue, soporta múltiples fechas MNT vía `desgloseVenues` |
| `reportes.js` | 536 | 4 KPIs (revenue cerrado, costo estimado, margen bruto, conversión), Chart.js bar (revenue vs costo + línea de margen % en eje `yPct`) + doughnut (utilización venues), top clientes, funnel, filtro de período, export CSV con BOM UTF-8 |
| `catalogo.js` | 364 | CRUD catálogo de precios con sort; campos extra (`precioWeekend`, `precioMontaje`) para categoría Venues |
| `eventos.js` | 1056 | CRUD eventos, checklists con tareas inline (responsable desde usuarios, fechaLimite), detección de vencidas, drag reorder con batch `orden`, CRUD de plantillas, API cross-módulo `BNKEventos.crearEvento()` |
| `finanzas.js` | 1439 | 5 sub-tabs: Cuentas por Pagar (parcialidades), Partners CRUD, Dispersiones, Cuentas por Cobrar (aging 0-30/30-60/60-90/90+), P&L (Chart.js + tabla mensual). Expone `BNKFinanzas.reload()` y `openEntityPopover()` |
| `usuarios.js` | 381 | CRUD de usuarios con roles (admin, ventas, produccion, lectura) y sort |
| `actividad.js` | 225 | Bell icon + dropdown con últimas 20 entradas de `actividadGlobal`, badge de no vistas (24 h, `localStorage` `bnk_last_activity_{uid}`), navegación por clic al tab relevante, tiempo relativo, mapas `TIPO_ICONS`/`TIPO_TAB` (13 tipos). Badge `#tabBadgeCotizaciones` cuenta `cotizacion_creada` de otros usuarios (`bnk_last_cotizaciones_{uid}`). Expone `load()` y `updateBadge()` |
| `documentos.js` | 451 | Módulo compartido `BNKDocumentos.render(container, {entidad, entityId})`: upload a Storage, versionado (`vigente`), drag & drop, validación PDF/JPG/PNG ≤10 MB, delete admin-only. Usado por clientes, proveedores y partners |

### Helpers de tablas (`panel/js/table-helpers.js`)

Port de los helpers del cotizador legacy, cargado antes de los módulos de página. Lo usan `clientes.js` y `proveedores.js`.

- `BNKSort.apply(data, key, dir)` — detecta tipo (fecha `dd/mm/aaaa` o ISO, número, texto con `localeCompare('es')`), aplana arrays y Timestamps, vacíos siempre al final.
- `BNKPagination.paginate(data, page)` (50 por página) + `.render(containerId, state, onChange)` con el mismo look que la paginación de cotizaciones (`.dash-pagination`).
- `BNKExport.csv(filename, headers, rows)` — BOM UTF-8, todas las celdas entrecomilladas, prefijo `'` contra formula injection (`= + - @`).
- `BNKHelpers.updateResultCount / hasActiveFilters / clearFilters / toggleClearButton` — actúan sobre `input.dash-search`, `input.dash-date`, `select.dash-select` dentro de la barra de filtros.

### Helpers globales (definidos **inline** en `panel/dashboard.html`, no en un archivo)

- `BNKToast.ok/warn/error(msg, retryFn?)` — `role="alert"` + `aria-live="assertive"`. Con `retryFn` muestra botón "Reintentar" y dura 8 s en vez de 3 s.
- `BNKConfirm.show(msg, okLabel?)` → Promise\<bool\>. **Solo dos parámetros**; el label de cancelar es fijo. Cierra con Escape y clic en overlay.
- `BNKValidate.error(input, msg)` / `.clear(input)` / `.clearAll(container)` / `.required(input, msg)` / `.email(input)` — validación inline con `.field-error` y `.bnk-field-error-msg`. Los errores se auto-limpian al escribir.
- `BNKFmt.money(n)` — `Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'})`. Varios módulos además definen un `_formatMXN()` local con `toLocaleString('es-MX')`.
- Offline indicator: listeners `online`/`offline` → toast + clase `.bnk-offline` en `body`.
- Tab switching + `activateTab(target)` + hash routing.

### CSS del panel

Tokens propios en `panel/css/panel.css` (**no** los de `system.css`): `--bk` `#050905`, `--dk`, `--card` `#09130B`, `--g` `#00FF41`, `--gd`, `--wh`, `--tx`/`--tx2`, `--bd`, `--red`, `--ylw`, `--blu`, `--cyan`, `--btn-p{x,y}-{sm,md,lg}`.

- **`panel.css`** (733) — base: header, tabs, buttons, tables, modals, forms, wizard MNT, form BNK, `.ctz-card`, progress, calendar, popovers, vinculación, bloque badges, toggle "no aplica", `.doc-*`, `.bnk-toast-retry`, `.bnk-offline`, `.act-*`, touch targets 44px, breakpoint 360px, responsive.
- **`login.css`** (97) — tokens propios `--accent`, `--accent-dim`, `--accent-glow`.
- **`pipeline.css`** (84), **`reportes.css`** (65), **`eventos.css`** (90), **`calendario.css`** (85), **`finanzas.css`** (114) — cargados inline dentro de su sección en `dashboard.html`.

### Infraestructura

- **`panel/img/logo-bunker.webp`** — copia local (Firebase Hosting solo sirve `/panel/`).
- **`functions/index.js`** (41) — Cloud Function callable `createUser` (valida que el caller sea admin; roles permitidos admin/ventas/produccion/lectura). Node 18, firebase-admin ^11, firebase-functions ^4.
- **`firestore.rules`** (159) — helpers `userData()`, `isAuthenticated()` (exige `activo == true`), `isAdmin()`, `isAdminOrVentas()`, `isAdminOrProduccion()`. `hasOnly()` en todas las colecciones con escritura. Matches para las 14 colecciones + subcollections (`actividad`, `documentos`, `servicios`, `bloques`, `tareas`) + collection-group rules para `servicios` y `bloques`. `auditLog` y `actividadGlobal` son append-only (read+create, sin update/delete).
- **`storage.rules`** (34) — tres matches (`documentos/{clientes|proveedores|partners}/{entityId}/{tipo}/{fileName}`): read auth, create/update ≤10 MB con regex anclado PDF/JPG/PNG (clientes y proveedores admin+ventas; partners solo admin), delete solo admin vía lookup cross-service a Firestore.
- **`firebase.json`** — `site: "bunker-panel"`, `public: "panel"`, rewrite `/dashboard` → `/dashboard.html`, sin catch-all. Headers en `**/*.html`: `Cache-Control: no-cache`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS 2 años con preload, `Permissions-Policy`, y CSP con `default-src 'none'`. En `**/*.{css,js}`: `max-age=3600`.
- **`.firebaserc`** — default `bunker-panel`. Cuenta: admin@vanguardiaysoluciones.

---

## Convenciones

### Generales

- **Idioma**: todo el texto visible al usuario en español.
- **Sin build tools**: no hay bundler, transpiler ni preprocesador. Editar fuentes directamente.
- **ES5 + Promise** en todo el JS del panel y cotizador (`var`, `function`, sin arrow/async). Cada `js/pages/*.js` es un IIFE auto-contenido inicializado vía `BNK_AUTH.onReady()`.
- **CSS cascade**: nunca `!important`. Usar los design tokens del subsistema correspondiente (`system.css` para el sitio público, `panel.css` para el panel), no valores hardcodeados.
- **Fonts**: Barlow Condensed (títulos), Barlow (cuerpo), Space Mono (mono). El cotizador legacy añade Rajdhani.
- **Reveal**: clase `rev` → `IntersectionObserver` agrega `vis` (sitio público).

### Patrones del panel

- **Modales**: `.bnk-overlay` + `.bnk-modal` con clase `.visible`.
- **Autocomplete**: `.bnk-autocomplete` + `.bnk-ac-item` con `.visible`.
- **Badges**: `.estado-{nombre}`, `.tipo-{MNT|BNK}`.
- **Estados de cotización**: `Recorrido → Cotizada → Negociación → Cerrada → En Producción → Ejecutado → Cancelada → Perdida`. Las nuevas se crean en `Recorrido`. El legacy `'Nueva'` se mapea a `Recorrido` en pipeline, cotizaciones, reportes y finanzas.
- **Fechas en cotizaciones**: `fecha` (ISO de creación), `fechaEvento` (primera fecha del evento), `createdAt` (server timestamp). Todos los módulos usan `d.fecha || d.createdAt` como fallback para registros legacy.
- **PDFs regenerables**: no se almacenan. Se reconstruyen on-the-fly con `BNKPdfRebuild.download(cotData, style)` — MNT lee `desgloseVenues` (JSON), BNK lee `conceptos` (JSON).
- **Popover para ver, modal para actuar**. Dos popovers: el de folio de cotización (BNK vinculadas, indicadores, acciones) y `#entityPopover` reutilizable para cliente/proveedor/partner (cotizaciones vinculadas, cada una expandible con `.expanded`).
- **Vinculación MNT↔BNK**: 1:N. BNK lleva `folioMNT` apuntando al folio padre.
- **Vinculación Cliente↔Cotización**: `clienteId` + `clienteNombre`. Badge "Vinculada" (FK formal) vs "Por nombre" (fuzzy match por empresa).
- **`cotizacionProveedores`**: simétrica a `cotizacionPartners`. `{ cotizacionId, cotizacionFolio, proveedorId, proveedorNombre }`, auto-creados al guardar BNK con conceptos de proveedor (`autoVinculado: true`).
- **Bloques de proveedor**: `proveedores/{id}/bloques/{bloqueId}` con `nombre`, `precioManual`, `usaPrecioManual`, `orden`. Los servicios llevan `bloqueId`.
- **Doble precio**: `costoUnitario` (costo real) + `precioCliente`. Si `precioCliente` es 0, se usa `costoUnitario`.
- **Documentos de expediente**: `{entidad}/{id}/documentos/{docId}` + Storage en `documentos/{entidad}/{entityId}/{tipo}/{timestamp}_{filename}`. 7 tipos predefinidos + libres. Versionado con `vigente: true/false`. Indicador separado `N/M requeridos`, no afecta el % de completitud.
- **Toggle "No aplica extranjero"**: excluye campos bancarios extranjeros del % de completitud. Persiste como `noAplicaExtranjero: true`.
- **Datos bancarios restringidos**: el tab "Bancarios" va `display:none` para rol `ventas` en clientes y proveedores.
- **URL hash routing**: el tab activo se refleja en `location.hash`; `activateTab(target)` + `history.replaceState()`. Refresh conserva el tab.
- **Chart.js** 4.4.0 por CDN jsDelivr con SRI, `defer`. Destruir instancias con `chart.destroy()` antes de re-render.
- **jsPDF** 2.5.1 por CDN cdnjs con SRI, `defer`, junto con `logo-data.js`.
- **ARIA emojis**: emojis funcionales envueltos en `<span role="img" aria-label="…">`; decorativos sin ARIA.

### PDFs

Dos paletas con toggle en ambos cotizadores:
- **Neon**: fondo `#050905`, acento `#00FF41`.
- **Corporativa**: fondo `#FFFFFF`, acento `#C6A350`, header `#2C2419`.

BNK agrupa por categoría con sub-agrupación por bloque de proveedor y añade condiciones comerciales con plantillas. La Orden de Trabajo usa siempre la paleta corporativa, filtra por proveedor, agrupa por bloque y añade sección de notas (fallback de matching: `proveedorId` → nombre → todos los conceptos).

### Cache busting

Los scripts/CSS del panel llevan `?v=N` en `dashboard.html`. **Incrementar la versión al modificar un JS o CSS**, o el CDN de Firebase Hosting sirve la copia vieja. Versiones actuales: `panel.css?v=10`, `firebase-config?v=6`, `firestore?v=4`, `table-helpers?v=1`, `proveedores?v=9`, `cotizaciones?v=7`, `reportes?v=10`, `finanzas?v=10`, `eventos?v=9`, `actividad?v=10`, resto `v=8` o `v=1`. El sitio público usa `js/system.js?v=4`, `css/system.css?v=3`, `css/pages/dashboard.css?v=2`, `js/pages/dashboard.js?v=2`, `js/pages/proyectos.js?v=2`; el cotizador legacy carga `panel-ui.js?v=2`.

---

## Seguridad

- **App Check**: configurado en consola (reCAPTCHA v3, modo **Monitor**). **Código cliente desactivado** — el SDK está comentado en `dashboard.html` y la inicialización en `firebase-config.js`. La CSP ya permite `google.com` y `firebaseappcheck.googleapis.com`. Activar solo al pasar a Enforce, y verificando CSP primero: si reCAPTCHA se bloquea, `guard.js` deja la pantalla negra.
- **XSS**: `_esc()` (DOM-based `textContent` → `innerHTML`) en reportes, pipeline, eventos, calendario, actividad, finanzas, cotizaciones, documentos, cotizar-mnt y cotizar-bnk. `clientes.js` y `proveedores.js` usan `_escapeHTML()` + `_safeUrl()` (nombres distintos, misma función).
- **Firestore/Storage rules**: ver arriba. Roles admin / ventas / produccion / lectura. Datos sensibles (partners, pagos, finanzas) solo admin.
- **Apps Script**: API key, rate limiting, validación de campos, honeypot, validación de origen.
- **Audit log**: exports CSV → colección `auditLog`. Actividad cross-módulo → `actividadGlobal` vía `BNK_DB.logActividad()`.
- **Password policy**: mínimo 8 caracteres en Firebase Auth.
- **Archivos internos bloqueados en cPanel**: `.cpanel.yml` copia todo el repo al servidor, así que `.htaccess` responde 403 a dotfiles (salvo `.well-known`), `docs/`, `scripts/`, `functions/`, `capturas/`, `*.md`, `*.json`, `*.rules`, `*.yml` y `cotizador-munet/google-apps-script-munet.js`. Si el sitio llega a necesitar un `.json` público, agregar una excepción explícita antes de esas reglas.
- **Pendiente**: LFPDPPP (aviso de privacidad + registro de tratamiento de datos — requiere abogado).

---

## Gotchas conocidos

- **Dos copias de `BNKSort`/`BNKPagination`/`BNKExport`/`BNKHelpers`**: `js/pages/panel-ui.js` (cotizador legacy) y `panel/js/table-helpers.js` (panel). Son independientes; un fix en una no llega a la otra.
- El export CSV antepone `'` a celdas que empiezan con `+`, así que teléfonos tipo `+52 …` salen como `'+52 …` en Excel. Es intencional (protección contra formula injection).
- La doble escritura Sheets → Firestore del Apps Script está marcada como "transitoria": al editar el esquema de `cotizaciones`, `clientes` o `proveedores` hay que actualizar también `writeToFirestore` y los `hasOnly()` de `firestore.rules`.

## Otros archivos

- **`.htaccess`** — rewrites de Apache: redirect 301 de `*.html` a URL limpia y rewrite interno inverso para servirlas.
- **`.cpanel.yml`** — tarea de despliegue: copia todo el repo (menos `.git` y el propio yml) a `/home3torre/bunkermx/html`.
- **`img/`** — logos e ilustraciones (`logo-bunker*`, `isotipo-bunker.webp`, `logo-munet.webp`, `filosofia/metodo/proposito/vision-bnk.png`, `triangulo-penrose.png`, `img/team/`).
- **`docs/superpowers/specs/`** y **`docs/superpowers/plans/`** — specs de diseño y planes de implementación de cada feature (jul–sep 2026). Útiles como historial de decisiones.
- **Gitignored**: `capturas/` (capturas y notas de trabajo), `.firebase/`, `.claude/`, `.playwright-mcp/`, `.tmp.driveupload/`, `branding/`, `node_modules/`, `.env*`.
