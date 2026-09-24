# Panel Operativo V2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the BUNKER panel with 6 features: advanced reports with real margins, pipeline drag & drop, P&L financials with aging, complete events/production, activity feed, and improved calendar.

**Architecture:** Each feature is an independent module upgrade touching its own JS/CSS/HTML section. Shared dependency is Chart.js (CDN with SRI + CSP update). Activity feed requires instrumenting existing modules with `BNK_DB.logActividad()` calls. All code is vanilla JS (no build step), deployed via Firebase Hosting.

**Tech Stack:** Vanilla JS (ES5 IIFEs), CSS custom properties, Firebase Firestore, Chart.js 4.4.0 (CDN), jsPDF 2.5.1 (existing), HTML5 Drag API.

**Spec:** `docs/superpowers/specs/2026-09-22-panel-v2-mejoras-design.md`

## Global Constraints

- All user-facing text in Spanish
- No build tools — edit source files directly
- No `!important` in CSS — use cascade/specificity
- Use CSS custom properties from `:root` in `panel.css` (tokens: `--g`, `--ylw`, `--red`, `--blu`, `--tx`, `--wh`, `--card`, `--bd`, `--bk`, `--dk`)
- IIFE pattern for all modules: `(function(){ 'use strict'; ... })();`
- XSS escape with DOM-based `_esc()` pattern (createElement div, textContent, innerHTML)
- Increment `?v=N` query params on modified scripts/CSS in `dashboard.html`
- Firebase project: `bunker-panel`
- Roles: `admin`, `ventas`, `produccion`, `lectura`
- States: `Recorrido, Cotizada, Negociación, Cerrada, En Producción, Ejecutado, Cancelada, Perdida`
- Legacy `'Nueva'` maps to `'Recorrido'`
- Date fallback: `d.fecha || d.createdAt` for all date-based logic
- Closed states: `['Cerrada', 'En Producción', 'Ejecutado']`
- `BNK_AUTH.onReady(function(user){ ... })` to gate module init
- `BNKToast.ok/warn/error(msg, retryFn?)` for notifications
- `BNKConfirm.show(msg, okLabel)` returns Promise<boolean> for confirmations
- `BNKFmt.money(n)` for currency formatting (Intl.NumberFormat es-MX MXN)
- `BNK_DB.collectionAPI(name)` returns `{ list, get, create, update, delete, onSnapshot }`
- `panel/dashboard.html` scripts load at bottom, blocking (no defer except jsPDF + logo-data)

---

### Task 1: Shared Infrastructure — Chart.js CDN + CSP + Firestore Helpers

**Files:**
- Modify: `firebase.json:24` (CSP header)
- Modify: `panel/dashboard.html:22-23` (add Chart.js script)
- Modify: `panel/js/firestore.js:198-219` (add `actividadGlobal` collection + `logActividad` helper)
- Modify: `firestore.rules:136-140` (add `actividadGlobal` rules + update `plantillas` + update `eventos` + `tareas` hasOnly)

**Interfaces:**
- Consumes: `BNK_FIREBASE.db` (existing global from firebase-config.js)
- Produces:
  - `BNK_DB.actividadGlobal` — `collectionAPI('actividadGlobal')` with `{ list, create }`
  - `BNK_DB.logActividad(data)` — helper function, signature: `function({ tipo: string, entidad: string, entidadId: string, referencia: string, detalle: string })` — auto-fills `usuario`, `usuarioId`, `timestamp`
  - `Chart` global (from CDN) available to reportes.js and finanzas.js

- [ ] **Step 1: Update CSP to allow Chart.js CDN**

In `firebase.json`, find the `script-src` directive on line 24 and add `https://cdn.jsdelivr.net` after `https://cdnjs.cloudflare.com`:

```json
"value": "default-src 'none'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://www.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://firestore.googleapis.com https://firebasestorage.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://*.firebaseio.com https://us-central1-bunker-panel.cloudfunctions.net https://firebaseappcheck.googleapis.com https://content-firebaseappcheck.googleapis.com; frame-src https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self'"
```

- [ ] **Step 2: Add Chart.js script tag to dashboard.html**

After line 23 (`<script defer src="js/logo-data.js?v=2"></script>`), add:

```html
<script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" crossorigin="anonymous"></script>
```

- [ ] **Step 3: Add `actividadGlobal` collection + `logActividad` helper to firestore.js**

In `panel/js/firestore.js`, before the closing `window.BNK_DB = {` block (line 199), add the logActividad helper:

```javascript
  // ── Actividad global (feed de actividad cross-módulo) ──
  function logActividad(data) {
    var user = window.BNK_AUTH ? BNK_AUTH.currentUser() : null;
    var entry = {
      tipo: data.tipo || '',
      entidad: data.entidad || '',
      entidadId: data.entidadId || '',
      referencia: data.referencia || '',
      detalle: data.detalle || '',
      usuario: user ? user.nombre : 'Sistema',
      usuarioId: user ? user.uid : '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    return db.collection('actividadGlobal').add(entry).catch(function (err) {
      console.warn('logActividad error:', err);
    });
  }
```

Then in the `window.BNK_DB` object, add these two entries after `tareas: tareasAPI` (line 218):

```javascript
    actividadGlobal:       collectionAPI('actividadGlobal', { orderBy: { field: 'timestamp', dir: 'desc' } }),
    logActividad:          logActividad
```

- [ ] **Step 4: Add Firestore rules for `actividadGlobal` and update `eventos`/`tareas`/`plantillas`**

In `firestore.rules`, after the `auditLog` block (after line 140), add:

```
    match /actividadGlobal/{docId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.resource.data.keys().hasOnly(['tipo','entidad','entidadId','referencia','detalle','usuario','usuarioId','timestamp']);
      allow update, delete: if false;
    }
```

Update `eventos` rule (line 86) to include the new fields needed for Task 4:

```
      allow create, update: if isAuthenticated() && userData().rol in ['admin', 'ventas', 'produccion'] && request.resource.data.keys().hasOnly(['nombre','fecha','espacio','cotizacionId','folio','estado','plantilla','descripcion','createdAt','updatedAt','cliente','fechaEvento','folioCotizacion','tareasCompletadas','tareasTotal']);
```

Update `tareas` rule (line 90) to include responsable and fechaLimite:

```
        allow create, update: if isAuthenticated() && userData().rol in ['admin', 'ventas', 'produccion'] && request.resource.data.keys().hasOnly(['nombre','descripcion','completada','orden','notas','responsable','responsableNombre','fechaLimite']);
        allow delete: if isAdmin();
```

Update `plantillas` rule (lines 94-97) to include field validation:

```
    match /plantillas/{docId} {
      allow read: if isAuthenticated();
      allow create, update: if isAdmin() && request.resource.data.keys().hasOnly(['nombre','tareas','createdAt','updatedAt']);
      allow delete: if isAdmin();
    }
```

- [ ] **Step 5: Verify — open dashboard.html in browser, check console**

Open `panel/dashboard.html` in browser. Verify:
- No CSP errors in console
- `BNK_DB.actividadGlobal` exists (type in console: `BNK_DB.actividadGlobal`)
- `BNK_DB.logActividad` is a function
- `Chart` global is defined (Chart.js loaded)

- [ ] **Step 6: Deploy Firestore rules**

```bash
firebase deploy --only firestore:rules --project bunker-panel
```

- [ ] **Step 7: Commit**

```bash
git add firebase.json panel/dashboard.html panel/js/firestore.js firestore.rules
git commit -m "feat: add Chart.js CDN, actividadGlobal collection, updated Firestore rules for panel V2"
```

---

### Task 2: Reportes Avanzados — Data Layer + KPIs + Funnel

**Files:**
- Modify: `panel/dashboard.html:997-1031` (update `#sec-reportes` HTML)
- Rewrite: `panel/js/pages/reportes.js` (full rewrite)
- Modify: `panel/css/reportes.css` (add new widget styles)

**Interfaces:**
- Consumes: `BNK_DB.cotizaciones.list()`, `BNK_DB.cotizacionProveedores.list()`, `BNK_DB.pagos.list()`, `BNK_DB.cuentasCobrar.list()`, `BNKFmt.money(n)`, `BNKToast`, `BNK_AUTH.onReady()`, `Chart` (global from CDN)
- Produces: `window.BNKReportes = { load: load }` (same interface as current)

- [ ] **Step 1: Update `#sec-reportes` HTML in dashboard.html**

Replace lines 997-1031 with new HTML that includes: 4 new KPIs (REVENUE CERRADO, COSTO ESTIMADO, MARGEN BRUTO, TASA CONVERSIÓN), toolbar with período selector + CSV export button + refresh button, 6 widget cards (funnel, revenue mensual with chart canvas, categorías, top clientes, venues with chart canvas, rendimiento), loading and empty states:

```html
  <section id="sec-reportes" class="panel-section" role="tabpanel">
    <link rel="stylesheet" href="css/reportes.css?v=8">
    <!-- KPIs -->
    <div class="dash-indicators" style="grid-template-columns:repeat(4,1fr)">
      <div class="dash-card"><div class="dash-card-label">REVENUE CERRADO</div><div class="dash-card-value" id="indRepRevenue">$0</div><div class="dash-card-sub">cotizaciones cerradas</div></div>
      <div class="dash-card"><div class="dash-card-label">COSTO ESTIMADO</div><div class="dash-card-value" id="indRepCosto">$0</div><div class="dash-card-sub">proveedores BNK</div></div>
      <div class="dash-card"><div class="dash-card-label">MARGEN BRUTO</div><div class="dash-card-value" id="indRepMargen">$0</div><div class="dash-card-sub" id="indRepMargenPct">0%</div></div>
      <div class="dash-card"><div class="dash-card-label">TASA CONVERSIÓN</div><div class="dash-card-value" id="indRepTasa">0%</div><div class="dash-card-sub">cerradas / total</div></div>
    </div>

    <div class="panel-toolbar">
      <h2 class="panel-section-title">REPORTES</h2>
      <div class="reportes-periodo">
        <span style="font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:var(--tx)">PERÍODO:</span>
        <select id="repPeriodo" class="bnk-input" style="max-width:200px" disabled>
          <option value="mes">Este mes</option>
          <option value="trimestre">Últimos 3 meses</option>
          <option value="anio">Este año</option>
          <option value="todo">Todo</option>
        </select>
      </div>
      <button class="panel-btn-secondary" id="repExportCSV" disabled title="Exportar datos a CSV">EXPORTAR CSV</button>
      <button class="panel-btn-secondary" id="repRefresh" title="Actualizar datos">&#8635; ACTUALIZAR</button>
    </div>
    <div id="repLoading" class="dash-loading">CARGANDO REPORTES...</div>
    <div class="reportes-grid" id="repGrid" style="display:none">
      <div class="reporte-card" id="repFunnel"></div>
      <div class="reporte-card" id="repMensual"><div class="reporte-card-title">REVENUE &amp; MARGEN MENSUAL</div><canvas id="repChartMensual" height="200"></canvas><div id="repTablaMensual"></div></div>
      <div class="reporte-card" id="repCategorias"></div>
      <div class="reporte-card" id="repTopClientes"></div>
      <div class="reporte-card" id="repVenues"><div class="reporte-card-title">UTILIZACIÓN DE VENUES</div><canvas id="repChartVenues" height="200"></canvas><div id="repTablaVenues"></div></div>
      <div class="reporte-card" id="repRendimiento"></div>
    </div>
    <div id="repEmpty" class="dash-empty" style="display:none">
      <div class="dash-empty-icon">&#128202;</div>
      <div class="dash-empty-text">Sin datos para el período seleccionado</div>
    </div>
  </section>
```

- [ ] **Step 2: Rewrite `panel/js/pages/reportes.js` — data loading**

Replace the entire file. Start with the IIFE shell, module state, and multi-source data loading:

```javascript
// reportes.js — Módulo de reportes avanzados con margen real
(function () {
  'use strict';

  var _cotizaciones = [];
  var _cotProveedores = [];
  var _pagos = [];
  var _cuentasCobrar = [];
  var _loaded = false;
  var _chartMensual = null;
  var _chartVenues = null;

  var ESTADOS_CERRADOS = ['Cerrada', 'En Producción', 'Ejecutado'];

  function init() {
    _bindEvents();
    load();
  }

  function load() {
    var repLoading = document.getElementById('repLoading');
    var repGrid = document.getElementById('repGrid');
    var repEmpty = document.getElementById('repEmpty');
    var periodoEl = document.getElementById('repPeriodo');
    var csvBtn = document.getElementById('repExportCSV');

    if (repLoading) repLoading.style.display = '';
    if (repGrid) repGrid.style.display = 'none';
    if (repEmpty) repEmpty.style.display = 'none';
    if (periodoEl) periodoEl.disabled = true;
    if (csvBtn) csvBtn.disabled = true;

    Promise.all([
      BNK_DB.cotizaciones.list(),
      BNK_DB.cotizacionProveedores.list().catch(function () { return []; }),
      BNK_DB.pagos.list().catch(function () { return []; }),
      BNK_DB.cuentasCobrar.list().catch(function () { return []; })
    ]).then(function (results) {
      _cotizaciones = results[0];
      _cotProveedores = results[1];
      _pagos = results[2];
      _cuentasCobrar = results[3];
      _loaded = true;
      if (repLoading) repLoading.style.display = 'none';
      if (periodoEl) periodoEl.disabled = false;
      if (csvBtn) csvBtn.disabled = false;
      _render();
    }).catch(function (err) {
      _loaded = true;
      if (repLoading) repLoading.style.display = 'none';
      BNKToast.error('Error al cargar reportes: ' + (err && err.message ? err.message : 'desconocido'), function () { load(); });
      if (repEmpty) {
        repEmpty.style.display = 'block';
        var txt = repEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = 'ERROR AL CARGAR REPORTES';
      }
    });
  }

  function _bindEvents() {
    var periodoEl = document.getElementById('repPeriodo');
    if (periodoEl) periodoEl.addEventListener('change', function () { if (_loaded) _render(); });
    var refreshBtn = document.getElementById('repRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { load(); });
    var csvBtn = document.getElementById('repExportCSV');
    if (csvBtn) csvBtn.addEventListener('click', _exportCSV);
  }

  function _getFiltered() {
    var periodo = (document.getElementById('repPeriodo') || {}).value || 'todo';
    var now = new Date();
    var desde = null;
    if (periodo === 'mes') desde = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (periodo === 'trimestre') desde = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    else if (periodo === 'anio') desde = new Date(now.getFullYear(), 0, 1);
    if (!desde) return _cotizaciones;
    return _cotizaciones.filter(function (d) {
      var fecha = _parseFecha(d.fecha || d.createdAt);
      return fecha && fecha >= desde;
    });
  }

  function _parseFecha(f) {
    if (!f) return null;
    if (typeof f === 'object' && f.toDate) return f.toDate();
    var d = new Date(f);
    return isNaN(d.getTime()) ? null : d;
  }

  // Calculate provider cost for a single BNK cotización
  function _calcCosto(cot) {
    if (cot.fuente !== 'BNK' || !cot.conceptos) return 0;
    try {
      var conceptos = JSON.parse(cot.conceptos);
      return conceptos.reduce(function (sum, c) {
        if (c.modo === 'proveedor' && c.costoProveedor) {
          return sum + (parseFloat(c.costoProveedor) || 0) * (parseInt(c.cantidad) || 1);
        }
        return sum;
      }, 0);
    } catch (e) { return 0; }
  }

  function _render() {
    var filtered = _getFiltered();
    var repGrid = document.getElementById('repGrid');
    var repEmpty = document.getElementById('repEmpty');
    if (filtered.length === 0) {
      if (repGrid) repGrid.style.display = 'none';
      if (repEmpty) {
        repEmpty.style.display = 'block';
        var txt = repEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = 'Sin datos para el período seleccionado';
      }
      _updateKPIs([]);
      return;
    }
    if (repGrid) repGrid.style.display = '';
    if (repEmpty) repEmpty.style.display = 'none';
    _updateKPIs(filtered);
    _renderFunnel(filtered);
    _renderMensual(filtered);
    _renderCategorias(filtered);
    _renderTopClientes(filtered);
    _renderVenues(filtered);
    _renderRendimiento(filtered);
  }

  function _updateKPIs(data) {
    var total = data.length;
    var cerradas = data.filter(function (d) { return ESTADOS_CERRADOS.indexOf(d.estado) !== -1; });
    var revenue = cerradas.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
    var costo = cerradas.reduce(function (s, d) { return s + _calcCosto(d); }, 0);
    var margen = revenue - costo;
    var margenPct = revenue > 0 ? Math.round((margen / revenue) * 100) : 0;
    var tasa = total > 0 ? Math.round((cerradas.length / total) * 100) : 0;

    var el = document.getElementById('indRepRevenue');
    if (el) el.textContent = BNKFmt.money(revenue);
    el = document.getElementById('indRepCosto');
    if (el) el.textContent = BNKFmt.money(costo);
    el = document.getElementById('indRepMargen');
    if (el) el.textContent = BNKFmt.money(margen);
    el = document.getElementById('indRepMargenPct');
    if (el) el.textContent = margenPct + '% margen';
    el = document.getElementById('indRepTasa');
    if (el) el.textContent = tasa + '%';
  }
```

- [ ] **Step 3: Add `_renderFunnel` — same as current but with monto per state**

Continue in the same file:

```javascript
  function _renderFunnel(data) {
    var container = document.getElementById('repFunnel');
    if (!container) return;
    var estados = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];
    var totalCount = data.length;
    var counts = {};
    var montos = {};
    estados.forEach(function (e) {
      var items = data.filter(function (d) {
        var est = d.estado || 'Recorrido';
        if (est === 'Nueva') est = 'Recorrido';
        return est === e;
      });
      counts[e] = items.length;
      montos[e] = items.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
    });
    var html = '<div class="reporte-card-title">FUNNEL DE VENTAS</div>';
    estados.forEach(function (e) {
      var pct = totalCount > 0 ? Math.round((counts[e] / totalCount) * 100) : 0;
      var estadoClass = 'funnel-bar--' + e.toLowerCase().replace(/\s+/g, '-');
      html += '<div class="funnel-row">'
        + '<span class="funnel-label">' + _esc(e) + '</span>'
        + '<div class="funnel-bar-wrap">'
        + '<div class="funnel-bar ' + estadoClass + '" style="width:' + pct + '%"></div>'
        + '<span class="funnel-count">' + counts[e] + ' (' + pct + '%)</span>'
        + '</div>'
        + '<span class="funnel-monto">' + _formatMXN(montos[e]) + '</span>'
        + '</div>';
    });
    container.innerHTML = html;
  }
```

- [ ] **Step 4: Add `_renderMensual` — Revenue & Margen with Chart.js**

```javascript
  function _renderMensual(data) {
    var tablaEl = document.getElementById('repTablaMensual');
    if (!tablaEl) return;

    var mesesMap = {};
    data.forEach(function (d) {
      var fecha = d.fecha || d.createdAt || '';
      if (typeof fecha === 'object' && fecha.toDate) fecha = fecha.toDate().toISOString();
      var mes = String(fecha).substring(0, 7);
      if (!mes || mes.length < 7) return;
      if (!mesesMap[mes]) mesesMap[mes] = { registradas: 0, cerradas: 0, revenue: 0, costo: 0 };
      mesesMap[mes].registradas++;
      if (ESTADOS_CERRADOS.indexOf(d.estado) !== -1) {
        mesesMap[mes].cerradas++;
        mesesMap[mes].revenue += parseFloat(d.total) || 0;
        mesesMap[mes].costo += _calcCosto(d);
      }
    });

    var meses = Object.keys(mesesMap).sort().reverse().slice(0, 12);

    // Table
    var html = '<table class="reporte-table"><thead><tr>'
      + '<th>MES</th><th>COTIZADAS</th><th>CERRADAS</th><th>REVENUE</th><th>COSTO</th><th>MARGEN</th><th>%</th>'
      + '</tr></thead><tbody>';
    meses.forEach(function (m) {
      var r = mesesMap[m];
      var margen = r.revenue - r.costo;
      var pct = r.revenue > 0 ? Math.round((margen / r.revenue) * 100) : 0;
      var pctColor = pct > 30 ? 'var(--g)' : pct > 15 ? 'var(--ylw)' : 'var(--red)';
      html += '<tr>'
        + '<td style="color:var(--g)">' + _esc(m) + '</td>'
        + '<td>' + r.registradas + '</td>'
        + '<td style="color:var(--g)">' + r.cerradas + '</td>'
        + '<td>' + _formatMXN(r.revenue) + '</td>'
        + '<td style="color:var(--red)">' + _formatMXN(r.costo) + '</td>'
        + '<td>' + _formatMXN(margen) + '</td>'
        + '<td style="color:' + pctColor + '">' + pct + '%</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    tablaEl.innerHTML = html;

    // Chart.js bar chart
    if (typeof Chart === 'undefined') return;
    var chartMeses = meses.slice().reverse();
    var revenues = chartMeses.map(function (m) { return Math.round(mesesMap[m].revenue); });
    var costos = chartMeses.map(function (m) { return Math.round(mesesMap[m].costo); });

    var canvas = document.getElementById('repChartMensual');
    if (!canvas) return;
    if (_chartMensual) _chartMensual.destroy();

    var styles = getComputedStyle(document.documentElement);
    var colorG = styles.getPropertyValue('--g').trim() || '#00FF41';
    var colorRed = styles.getPropertyValue('--red').trim() || '#FF4455';
    var colorTx = styles.getPropertyValue('--tx').trim() || '#777';

    _chartMensual = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: chartMeses.map(function (m) { return m.substring(5); }),
        datasets: [
          { label: 'Revenue', data: revenues, backgroundColor: colorG + '66', borderColor: colorG, borderWidth: 1 },
          { label: 'Costo', data: costos, backgroundColor: colorRed + '66', borderColor: colorRed, borderWidth: 1 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: colorTx, font: { family: 'Space Mono', size: 10 } } } },
        scales: {
          x: { ticks: { color: colorTx, font: { family: 'Space Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,.03)' } },
          y: { ticks: { color: colorTx, font: { family: 'Space Mono', size: 9 }, callback: function (v) { return '$' + (v / 1000).toFixed(0) + 'k'; } }, grid: { color: 'rgba(255,255,255,.06)' } }
        }
      }
    });
  }
```

- [ ] **Step 5: Add `_renderCategorias` — Revenue por categoría**

```javascript
  function _renderCategorias(data) {
    var container = document.getElementById('repCategorias');
    if (!container) return;

    var cerradasBNK = data.filter(function (d) {
      return d.fuente === 'BNK' && ESTADOS_CERRADOS.indexOf(d.estado) !== -1 && d.conceptos;
    });

    var catMap = {};
    cerradasBNK.forEach(function (d) {
      try {
        var conceptos = JSON.parse(d.conceptos);
        conceptos.forEach(function (c) {
          var cat = c.categoria || 'Sin categoría';
          if (!catMap[cat]) catMap[cat] = { revenue: 0, costo: 0 };
          var qty = parseInt(c.cantidad) || 1;
          catMap[cat].revenue += (parseFloat(c.precioUnit) || 0) * qty;
          if (c.modo === 'proveedor' && c.costoProveedor) {
            catMap[cat].costo += (parseFloat(c.costoProveedor) || 0) * qty;
          }
        });
      } catch (e) {}
    });

    var cats = Object.keys(catMap).map(function (k) {
      var m = catMap[k];
      return { cat: k, revenue: m.revenue, costo: m.costo, margen: m.revenue - m.costo };
    }).sort(function (a, b) { return b.revenue - a.revenue; });

    var maxRevenue = cats.length > 0 ? cats[0].revenue : 1;

    var html = '<div class="reporte-card-title">REVENUE POR CATEGORÍA (BNK)</div>';
    if (cats.length === 0) {
      html += '<div style="text-align:center;color:var(--tx);padding:40px;font-size:12px">Sin cotizaciones BNK cerradas</div>';
      container.innerHTML = html;
      return;
    }

    html += '<table class="reporte-table"><thead><tr>'
      + '<th>CATEGORÍA</th><th>REVENUE</th><th>COSTO</th><th>MARGEN</th><th>%</th>'
      + '</tr></thead><tbody>';
    cats.forEach(function (c) {
      var pct = c.revenue > 0 ? Math.round((c.margen / c.revenue) * 100) : 0;
      var pctColor = pct > 30 ? 'var(--g)' : pct > 15 ? 'var(--ylw)' : 'var(--red)';
      var barW = Math.round((c.revenue / maxRevenue) * 100);
      html += '<tr>'
        + '<td style="color:var(--g)">' + _esc(c.cat) + '</td>'
        + '<td>' + _formatMXN(c.revenue) + ' <div class="cat-bar" style="width:' + barW + '%"></div></td>'
        + '<td style="color:var(--red)">' + _formatMXN(c.costo) + '</td>'
        + '<td>' + _formatMXN(c.margen) + '</td>'
        + '<td style="color:' + pctColor + '">' + pct + '%</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }
```

- [ ] **Step 6: Add `_renderTopClientes` — with margin column**

```javascript
  function _renderTopClientes(data) {
    var container = document.getElementById('repTopClientes');
    if (!container) return;

    var clientesMap = {};
    data.forEach(function (d) {
      if (ESTADOS_CERRADOS.indexOf(d.estado) === -1) return;
      var cli = (d.cliente || d.empresa || 'Sin cliente').trim().toUpperCase();
      if (!clientesMap[cli]) clientesMap[cli] = { monto: 0, costo: 0, nombre: d.cliente || d.empresa || 'Sin cliente' };
      clientesMap[cli].monto += parseFloat(d.total) || 0;
      clientesMap[cli].costo += _calcCosto(d);
    });

    var ranking = Object.keys(clientesMap).map(function (k) {
      return { nombre: clientesMap[k].nombre, monto: clientesMap[k].monto, costo: clientesMap[k].costo, margen: clientesMap[k].monto - clientesMap[k].costo };
    }).sort(function (a, b) { return b.monto - a.monto; }).slice(0, 10);

    var maxMonto = ranking.length > 0 ? ranking[0].monto : 1;

    var html = '<div class="reporte-card-title">TOP 10 CLIENTES (CERRADAS)</div>';
    if (ranking.length === 0) {
      html += '<div style="text-align:center;color:var(--tx);padding:40px;font-size:12px">Sin clientes cerrados</div>';
      container.innerHTML = html;
      return;
    }

    ranking.forEach(function (c, i) {
      var pct = Math.round((c.monto / maxMonto) * 100);
      var margenPct = c.monto > 0 ? Math.round((c.margen / c.monto) * 100) : 0;
      html += '<div class="top-bar-wrap">'
        + '<span class="top-bar-rank">' + (i + 1) + '</span>'
        + '<span class="top-bar-name">' + _esc(c.nombre) + '</span>'
        + '<div class="funnel-bar-wrap"><div class="top-bar" style="width:' + pct + '%">'
        + '<span class="top-bar-val">' + _formatMXN(c.monto) + '</span>'
        + '</div></div>'
        + '<span class="top-bar-margen" style="color:' + (margenPct > 30 ? 'var(--g)' : margenPct > 15 ? 'var(--ylw)' : 'var(--red)') + '">' + margenPct + '%</span>'
        + '</div>';
    });
    container.innerHTML = html;
  }
```

- [ ] **Step 7: Add `_renderVenues` — utilización con Chart.js donut**

```javascript
  function _renderVenues(data) {
    var tablaEl = document.getElementById('repTablaVenues');
    if (!tablaEl) return;

    var mntCerradas = data.filter(function (d) {
      return (d.fuente || 'MNT') === 'MNT' && ESTADOS_CERRADOS.indexOf(d.estado) !== -1 && d.desgloseVenues;
    });

    var espacioMap = {};
    var totalRevenue = 0;
    mntCerradas.forEach(function (d) {
      try {
        var desglose = JSON.parse(d.desgloseVenues);
        desglose.forEach(function (v) {
          var esp = v.espacio || 'Otro';
          if (!espacioMap[esp]) espacioMap[esp] = { count: 0, revenue: 0 };
          espacioMap[esp].count++;
          espacioMap[esp].revenue += parseFloat(v.subtotal || v.precio || 0);
          totalRevenue += parseFloat(v.subtotal || v.precio || 0);
        });
      } catch (e) {}
    });

    var espacios = Object.keys(espacioMap).map(function (k) {
      return { espacio: k, count: espacioMap[k].count, revenue: espacioMap[k].revenue };
    }).sort(function (a, b) { return b.revenue - a.revenue; });

    if (espacios.length === 0) {
      tablaEl.innerHTML = '<div style="text-align:center;color:var(--tx);padding:40px;font-size:12px">Sin venues en cotizaciones MNT cerradas</div>';
      return;
    }

    var html = '<table class="reporte-table"><thead><tr>'
      + '<th>ESPACIO</th><th>EVENTOS</th><th>REVENUE</th><th>%</th>'
      + '</tr></thead><tbody>';
    espacios.forEach(function (e) {
      var pct = totalRevenue > 0 ? Math.round((e.revenue / totalRevenue) * 100) : 0;
      html += '<tr>'
        + '<td style="color:var(--g)">' + _esc(e.espacio) + '</td>'
        + '<td>' + e.count + '</td>'
        + '<td>' + _formatMXN(e.revenue) + '</td>'
        + '<td>' + pct + '%</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    tablaEl.innerHTML = html;

    // Donut chart
    if (typeof Chart === 'undefined') return;
    var canvas = document.getElementById('repChartVenues');
    if (!canvas) return;
    if (_chartVenues) _chartVenues.destroy();

    var chartColors = ['#00FF41', '#F0C040', '#FF9800', '#00D4FF', '#4CAF50', '#9E9E9E'];
    _chartVenues = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: espacios.map(function (e) { return e.espacio; }),
        datasets: [{
          data: espacios.map(function (e) { return Math.round(e.revenue); }),
          backgroundColor: chartColors.slice(0, espacios.length),
          borderColor: 'rgba(5,9,5,1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--tx').trim() || '#777', font: { family: 'Space Mono', size: 9 }, padding: 8 } }
        }
      }
    });
  }
```

- [ ] **Step 8: Add `_renderRendimiento` and `_exportCSV`**

```javascript
  function _renderRendimiento(data) {
    var container = document.getElementById('repRendimiento');
    if (!container) return;

    var total = data.length;
    var cerradas = data.filter(function (d) { return ESTADOS_CERRADOS.indexOf(d.estado) !== -1; });
    var tasaConversion = total > 0 ? Math.round((cerradas.length / total) * 100) : 0;
    var montoTotal = cerradas.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
    var ticketPromedio = cerradas.length > 0 ? Math.round(montoTotal / cerradas.length) : 0;

    var now = Date.now();
    var ms28d = 28 * 24 * 60 * 60 * 1000;
    var semana4 = _cotizaciones.filter(function (d) {
      var f = _parseFecha(d.fecha || d.createdAt);
      return f && (now - f.getTime()) < ms28d;
    });
    var oldestInRange = now;
    semana4.forEach(function (d) {
      var f = _parseFecha(d.fecha || d.createdAt);
      if (f && f.getTime() < oldestInRange) oldestInRange = f.getTime();
    });
    var weeksElapsed = semana4.length > 0 ? Math.max(1, Math.ceil((now - oldestInRange) / (7 * 24 * 60 * 60 * 1000))) : 1;
    var cotSemana = semana4.length > 0 ? (semana4.length / weeksElapsed).toFixed(1) : '0';

    container.innerHTML = '<div class="reporte-card-title">RENDIMIENTO</div>'
      + '<div class="rendimiento-grid">'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + tasaConversion + '%</div><div class="rendimiento-label">TASA CONVERSIÓN</div></div>'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + _formatMXN(ticketPromedio) + '</div><div class="rendimiento-label">TICKET PROMEDIO</div></div>'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + cotSemana + '</div><div class="rendimiento-label">COT./SEMANA</div></div>'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + total + '</div><div class="rendimiento-label">TOTAL PERÍODO</div></div>'
      + '</div>';
  }

  function _exportCSV() {
    var filtered = _getFiltered();
    if (filtered.length === 0) { BNKToast.warn('Sin datos para exportar.'); return; }

    var rows = [['Folio', 'Tipo', 'Cliente', 'Evento', 'Fecha', 'Estado', 'Total', 'Costo Estimado', 'Margen'].join(',')];
    filtered.forEach(function (d) {
      var fecha = d.fecha || d.createdAt || '';
      if (typeof fecha === 'object' && fecha.toDate) fecha = fecha.toDate().toISOString().substring(0, 10);
      else fecha = String(fecha).substring(0, 10);
      var costo = _calcCosto(d);
      var total = parseFloat(d.total) || 0;
      rows.push([
        '"' + (d.folio || '') + '"',
        d.fuente || 'MNT',
        '"' + (d.cliente || d.empresa || '').replace(/"/g, '""') + '"',
        '"' + (d.evento || '').replace(/"/g, '""') + '"',
        fecha,
        d.estado || '',
        total.toFixed(2),
        costo.toFixed(2),
        (total - costo).toFixed(2)
      ].join(','));
    });

    var blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'reportes-bunker-' + new Date().toISOString().substring(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);

    // Audit log
    BNK_DB.actividadGlobal && BNK_DB.logActividad && BNK_DB.logActividad({
      tipo: 'export_csv', entidad: 'reportes', entidadId: '', referencia: 'CSV Export', detalle: filtered.length + ' registros exportados'
    });

    BNKToast.ok('CSV exportado con ' + filtered.length + ' registros.');
  }

  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user && (user.rol === 'admin' || user.rol === 'ventas')) init();
  });

  window.BNKReportes = { load: load };
})();
```

- [ ] **Step 9: Update CSS — add styles for new widgets**

Add to `panel/css/reportes.css` after the existing `.rendimiento-label` rule (before the `@media` block):

```css
/* Category bar inline */
.cat-bar{height:4px;background:var(--g);margin-top:4px;transition:width .6s ease}

/* Top clientes margin column */
.top-bar-margen{font-family:'Space Mono',monospace;font-size:10px;width:40px;text-align:right;flex-shrink:0}

/* Chart containers */
#repChartMensual,#repChartVenues{margin-bottom:16px;max-height:200px}

/* CSV button disabled state */
#repExportCSV:disabled{opacity:.4;cursor:not-allowed}
```

And update the responsive block to include the new elements:

```css
@media(max-width:900px){
  .reportes-grid{grid-template-columns:1fr;padding:0 16px 16px}
  .funnel-label{width:80px;font-size:10px}
  .funnel-monto{width:80px;font-size:10px}
  .top-bar-name{width:100px;font-size:11px}
  #repChartMensual,#repChartVenues{max-height:150px}
}
```

- [ ] **Step 10: Update script version tag**

In `dashboard.html`, update the reportes.js script tag version:

```html
<script src="js/pages/reportes.js?v=8"></script>
```

- [ ] **Step 11: Verify in browser**

Open panel, go to Reportes tab. Verify:
- 4 new KPIs appear with correct revenue/costo/margen/tasa values
- Funnel renders all 8 states
- Revenue & Margen table shows monthly breakdown with % color coding
- Chart.js bar chart renders below the table
- Revenue por Categoría shows BNK breakdown
- Top 10 shows only cerradas clients with margin %
- Venues donut chart renders for MNT data
- CSV export downloads file with correct data
- Period filter works for all widgets

- [ ] **Step 12: Commit**

```bash
git add panel/dashboard.html panel/js/pages/reportes.js panel/css/reportes.css
git commit -m "feat: advanced reports with real margins, Chart.js graphs, CSV export"
```

---

### Task 3: Pipeline Drag & Drop + Filters + Fixes

**Files:**
- Modify: `panel/dashboard.html:570-603` (add filter bar to pipeline section)
- Rewrite: `panel/js/pages/pipeline.js` (add D&D, filters, fixes)
- Modify: `panel/css/pipeline.css` (add drag styles, filter styles)

**Interfaces:**
- Consumes: `BNK_DB.cotizaciones.onSnapshot()`, `BNK_DB.cotizaciones.update()`, `BNK_DB.actividad.add()`, `BNK_DB.config.get()`, `BNKConfirm.show()`, `BNKToast`, `BNK_AUTH`, `BNK_DB.logActividad()`
- Produces: `window.BNKPipeline = { load: function(){} }` (same interface)

- [ ] **Step 1: Add filter bar HTML in dashboard.html**

After the pipeline toolbar (after line 578, after the `</div>` closing `.pipeline-legend`), add a filter row:

```html
    <div class="pipe-filters" id="pipeFilters">
      <div class="pipe-filter-group">
        <button class="pipe-tipo-btn active" data-pipe-tipo="todos">TODOS</button>
        <button class="pipe-tipo-btn" data-pipe-tipo="MNT">MNT</button>
        <button class="pipe-tipo-btn" data-pipe-tipo="BNK">BNK</button>
      </div>
      <div class="pipe-filter-group">
        <label class="pipe-filter-label">DESDE</label>
        <input type="date" id="pipeFechaDesde" class="bnk-input pipe-date-input">
        <label class="pipe-filter-label">HASTA</label>
        <input type="date" id="pipeFechaHasta" class="bnk-input pipe-date-input">
      </div>
      <div class="pipe-filter-group">
        <label class="pipe-filter-label">MIN $</label>
        <input type="number" id="pipeMontoMin" class="bnk-input pipe-monto-input" min="0" step="1000" placeholder="0">
      </div>
      <div class="pipe-pipeline-total">
        <span class="pipe-total-label">PIPELINE ACTIVO:</span>
        <span class="pipe-total-value" id="pipeTotalActivo">$0</span>
      </div>
    </div>
```

- [ ] **Step 2: Rewrite pipeline.js — add drag & drop, filters, fixes**

Replace the entire file. The key changes: HTML5 drag & drop on cards, touch support, combined filters (tipo/fecha/monto + search), fix BNK children to use `_data` instead of `filtered`, cleanup `_unsubscribe` on `beforeunload`, pipeline total KPI, log to `actividadGlobal`:

```javascript
// pipeline.js — Vista kanban con drag & drop
(function () {
  'use strict';

  var ESTADOS = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];
  var COLORES = {
    'Recorrido': 'var(--tx)', 'Cotizada': 'var(--ylw)', 'Negociación': '#FF9800',
    'Cerrada': 'var(--g)', 'En Producción': '#2196F3', 'Ejecutado': '#4CAF50',
    'Cancelada': 'var(--red)', 'Perdida': '#9E9E9E'
  };
  var ESTADOS_ACTIVOS = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado'];
  var CONFIG = { diasFria: 3, diasEstancada: 5 };

  var _data = [];
  var _filter = '';
  var _filterTipo = 'todos';
  var _filterDesde = null;
  var _filterHasta = null;
  var _filterMontoMin = 0;
  var _unsubscribe = null;
  var _firstLoad = true;
  var _currentDetailId = null;
  var _dragId = null;
  var _dragEstadoOrigen = null;

  function init() {
    BNK_DB.config.get('alertas').then(function (cfg) {
      if (cfg) {
        CONFIG.diasFria = cfg.diasFria || 3;
        CONFIG.diasEstancada = cfg.diasEstancada || 5;
      }
      var legFria = document.getElementById('pipeLegendFria');
      var legEstancada = document.getElementById('pipeLegendEstancada');
      if (legFria) legFria.textContent = 'Fría (>' + CONFIG.diasFria + 'd)';
      if (legEstancada) legEstancada.textContent = 'Estancada (>' + CONFIG.diasEstancada + 'd)';
    });

    var board = document.getElementById('pipelineBoard');
    if (board && _firstLoad) {
      var loadEl = document.createElement('div');
      loadEl.className = 'dash-loading';
      loadEl.textContent = 'CARGANDO PIPELINE...';
      loadEl.id = 'pipeLoading';
      board.parentNode.insertBefore(loadEl, board);
    }

    _unsubscribe = BNK_DB.cotizaciones.onSnapshot(function (docs) {
      _data = docs;
      if (_firstLoad) {
        _firstLoad = false;
        var ld = document.getElementById('pipeLoading');
        if (ld) ld.remove();
      }
      _render();
    }, function (err) {
      var ld = document.getElementById('pipeLoading');
      if (ld) ld.textContent = 'Error al cargar pipeline.';
      BNKToast.error('Error en pipeline: ' + (err && err.message ? err.message : 'desconocido'));
    });

    _bindEvents();
  }

  // Cleanup snapshot listener
  window.addEventListener('beforeunload', function () {
    if (_unsubscribe) _unsubscribe();
  });

  function _applyFilters() {
    var result = _data;
    // Text search
    if (_filter) {
      var q = _filter.toLowerCase();
      result = result.filter(function (d) {
        return ((d.cliente || '') + ' ' + (d.evento || '') + ' ' + (d.folio || '')).toLowerCase().indexOf(q) !== -1;
      });
    }
    // Tipo filter
    if (_filterTipo !== 'todos') {
      result = result.filter(function (d) {
        return (d.fuente || 'MNT') === _filterTipo;
      });
    }
    // Date range
    if (_filterDesde) {
      var desde = new Date(_filterDesde);
      result = result.filter(function (d) {
        var f = _parseFecha(d.fecha || d.createdAt);
        return f && f >= desde;
      });
    }
    if (_filterHasta) {
      var hasta = new Date(_filterHasta + 'T23:59:59');
      result = result.filter(function (d) {
        var f = _parseFecha(d.fecha || d.createdAt);
        return f && f <= hasta;
      });
    }
    // Monto min
    if (_filterMontoMin > 0) {
      result = result.filter(function (d) {
        return (parseFloat(d.total) || 0) >= _filterMontoMin;
      });
    }
    return result;
  }

  function _parseFecha(f) {
    if (!f) return null;
    if (typeof f === 'object' && f.toDate) return f.toDate();
    var d = new Date(f);
    return isNaN(d.getTime()) ? null : d;
  }

  function _render() {
    var board = document.getElementById('pipelineBoard');
    if (!board) return;

    if (_data.length === 0) {
      board.innerHTML = '<div class="dash-empty" style="grid-column:1/-1"><div class="dash-empty-icon">\u{1F4CB}</div><div class="dash-empty-text">Sin cotizaciones en el pipeline</div></div>';
      _updatePipelineTotal([]);
      return;
    }

    var filtered = _applyFilters();
    var pipelineTotal = 0;

    var html = '';
    ESTADOS.forEach(function (estado) {
      var cards = filtered.filter(function (d) {
        var e = d.estado || 'Recorrido';
        if (e === 'Nueva') e = 'Recorrido';
        return e === estado;
      });
      var totalMonto = cards.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
      if (ESTADOS_ACTIVOS.indexOf(estado) !== -1) pipelineTotal += totalMonto;
      var pctOfTotal = pipelineTotal > 0 && ESTADOS_ACTIVOS.indexOf(estado) !== -1
        ? Math.round((totalMonto / pipelineTotal) * 100) : 0;

      html += '<div class="pipeline-col" data-estado="' + _esc(estado) + '">'
        + '<div class="pipeline-col-header" style="border-color:' + COLORES[estado] + '">'
        + '<span class="pipeline-col-title">' + estado.toUpperCase() + '</span>'
        + '<span class="pipeline-col-count">' + cards.length + '</span>'
        + '<span class="pipeline-col-total">' + _formatMXN(totalMonto) + '</span>'
        + '</div>'
        + '<div class="pipeline-col-body">';

      if (cards.length === 0) {
        html += '<div class="pipeline-empty-col">Sin cotizaciones</div>';
      } else {
        cards.forEach(function (d) {
          var diasEnEstado = _diasDesde(d.updatedAt);
          var alertClass = '';
          if (estado === 'Cotizada' && diasEnEstado > CONFIG.diasFria) alertClass = 'pipeline-card--cold';
          if (estado === 'Negociación' && diasEnEstado > CONFIG.diasEstancada) alertClass = 'pipeline-card--stale';

          var tipoBadge = d.fuente === 'BNK' ? 'tipo-BNK' : 'tipo-MNT';

          // BNK vinculadas — use _data (not filtered) to always show children
          var bnkLine = '';
          if ((d.fuente || 'MNT') === 'MNT' && d.folio) {
            var bnkHijas = _data.filter(function (b) { return b.folioMNT === d.folio && b.fuente === 'BNK'; });
            if (bnkHijas.length > 0) {
              var sufijos = bnkHijas.map(function (b) { return (b.folio || '').split('-').pop(); });
              bnkLine = '<div class="pipeline-card-bnk">BNK: <span>' + sufijos.join(', ') + '</span></div>';
            }
          }

          html += '<div class="pipeline-card ' + alertClass + '" data-id="' + _esc(d.id) + '" draggable="true" tabindex="0" role="button">'
            + '<div class="pipeline-card-top">'
            + '<span class="pipeline-card-cliente">' + _esc(d.cliente) + '</span>'
            + '<span class="tipo-badge ' + tipoBadge + '">' + _esc(d.fuente || 'MNT') + '</span>'
            + '</div>'
            + '<div class="pipeline-card-folio">' + _esc(d.folio || '') + '</div>'
            + '<div class="pipeline-card-evento">' + _esc(d.evento || '\u2014') + '</div>'
            + bnkLine
            + '<div class="pipeline-card-footer">'
            + '<span class="pipeline-card-monto">' + _formatMXN(d.total) + '</span>'
            + '<span class="pipeline-card-tiempo">' + _tiempoDisplay(diasEnEstado) + '</span>'
            + '</div>'
            + '</div>';
        });
      }

      html += '</div></div>';
    });

    board.innerHTML = html;
    _updatePipelineTotal(filtered);
  }

  function _updatePipelineTotal(filtered) {
    var total = 0;
    filtered.forEach(function (d) {
      var e = d.estado || 'Recorrido';
      if (e === 'Nueva') e = 'Recorrido';
      if (ESTADOS_ACTIVOS.indexOf(e) !== -1) total += parseFloat(d.total) || 0;
    });
    var el = document.getElementById('pipeTotalActivo');
    if (el) el.textContent = _formatMXN(total);
  }

  function _diasDesde(timestamp) {
    if (!timestamp) return 0;
    var fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    var diff = Date.now() - fecha.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function _tiempoDisplay(dias) {
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'ayer';
    return 'hace ' + dias + 'd';
  }

  function _changeEstado(id, newEstado, prevEstado) {
    var user = BNK_AUTH.currentUser();
    BNK_DB.cotizaciones.update(id, { estado: newEstado }).then(function () {
      BNKToast.ok('Estado actualizado a ' + newEstado + '.');
      BNK_DB.actividad.add(id, { tipo: 'cambio_estado', estado: newEstado, usuario: user ? user.nombre : 'Sistema', nota: '' });
      if (BNK_DB.logActividad) {
        var d = _data.find(function (x) { return x.id === id; });
        BNK_DB.logActividad({ tipo: 'estado_cambio', entidad: 'cotizacion', entidadId: id, referencia: d ? d.folio : '', detalle: prevEstado + ' \u2192 ' + newEstado });
      }
    }).catch(function (err) {
      BNKToast.error('Error al cambiar estado: ' + err.message);
      _render(); // Revert visual
    });
  }

  function _bindEvents() {
    var board = document.getElementById('pipelineBoard');

    // Click to open detail
    board.addEventListener('click', function (e) {
      var card = e.target.closest('.pipeline-card');
      if (!card) return;
      _openDetail(card.getAttribute('data-id'));
    });

    board.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('.pipeline-card');
      if (!card) return;
      e.preventDefault();
      _openDetail(card.getAttribute('data-id'));
    });

    // ── Drag & Drop ──
    board.addEventListener('dragstart', function (e) {
      var card = e.target.closest('.pipeline-card');
      if (!card) return;
      _dragId = card.getAttribute('data-id');
      var col = card.closest('.pipeline-col');
      _dragEstadoOrigen = col ? col.getAttribute('data-estado') : null;
      card.classList.add('pipeline-card--dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', _dragId);
    });

    board.addEventListener('dragend', function (e) {
      var card = e.target.closest('.pipeline-card');
      if (card) card.classList.remove('pipeline-card--dragging');
      _dragId = null;
      _dragEstadoOrigen = null;
      // Remove all drop-target classes
      board.querySelectorAll('.pipeline-col--drop-target').forEach(function (el) {
        el.classList.remove('pipeline-col--drop-target');
      });
    });

    board.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var col = e.target.closest('.pipeline-col');
      if (col && !col.classList.contains('pipeline-col--drop-target')) {
        board.querySelectorAll('.pipeline-col--drop-target').forEach(function (el) {
          el.classList.remove('pipeline-col--drop-target');
        });
        col.classList.add('pipeline-col--drop-target');
      }
    });

    board.addEventListener('dragleave', function (e) {
      var col = e.target.closest('.pipeline-col');
      if (col && !col.contains(e.relatedTarget)) {
        col.classList.remove('pipeline-col--drop-target');
      }
    });

    board.addEventListener('drop', function (e) {
      e.preventDefault();
      var col = e.target.closest('.pipeline-col');
      if (!col || !_dragId) return;
      col.classList.remove('pipeline-col--drop-target');

      var newEstado = col.getAttribute('data-estado');
      if (!newEstado || newEstado === _dragEstadoOrigen) return;

      var id = _dragId;
      var prevEstado = _dragEstadoOrigen;
      _dragId = null;
      _dragEstadoOrigen = null;

      if (newEstado === 'Cancelada' || newEstado === 'Perdida') {
        BNKConfirm.show('\u00bfCambiar estado a "' + newEstado + '"?', 'CONFIRMAR').then(function (ok) {
          if (ok) _changeEstado(id, newEstado, prevEstado);
        });
      } else {
        _changeEstado(id, newEstado, prevEstado);
      }
    });

    // ── Touch drag support ──
    var _touchCard = null;
    var _touchClone = null;
    var _touchStartY = 0;
    var _touchStartX = 0;
    var _touchMoved = false;

    board.addEventListener('touchstart', function (e) {
      var card = e.target.closest('.pipeline-card');
      if (!card) return;
      _touchCard = card;
      _touchStartX = e.touches[0].clientX;
      _touchStartY = e.touches[0].clientY;
      _touchMoved = false;
    }, { passive: true });

    board.addEventListener('touchmove', function (e) {
      if (!_touchCard) return;
      var dx = e.touches[0].clientX - _touchStartX;
      var dy = e.touches[0].clientY - _touchStartY;
      if (!_touchMoved && Math.abs(dx) + Math.abs(dy) > 10) {
        _touchMoved = true;
        _dragId = _touchCard.getAttribute('data-id');
        var col = _touchCard.closest('.pipeline-col');
        _dragEstadoOrigen = col ? col.getAttribute('data-estado') : null;
        _touchClone = _touchCard.cloneNode(true);
        _touchClone.classList.add('pipeline-card--ghost');
        document.body.appendChild(_touchClone);
      }
      if (_touchMoved && _touchClone) {
        e.preventDefault();
        _touchClone.style.left = (e.touches[0].clientX - 60) + 'px';
        _touchClone.style.top = (e.touches[0].clientY - 20) + 'px';
        // Highlight target column
        var target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        var targetCol = target ? target.closest('.pipeline-col') : null;
        board.querySelectorAll('.pipeline-col--drop-target').forEach(function (el) { el.classList.remove('pipeline-col--drop-target'); });
        if (targetCol) targetCol.classList.add('pipeline-col--drop-target');
      }
    }, { passive: false });

    board.addEventListener('touchend', function (e) {
      if (_touchClone) {
        _touchClone.remove();
        _touchClone = null;
      }
      board.querySelectorAll('.pipeline-col--drop-target').forEach(function (el) { el.classList.remove('pipeline-col--drop-target'); });

      if (_touchMoved && _dragId) {
        var touch = e.changedTouches[0];
        var target = document.elementFromPoint(touch.clientX, touch.clientY);
        var col = target ? target.closest('.pipeline-col') : null;
        if (col) {
          var newEstado = col.getAttribute('data-estado');
          if (newEstado && newEstado !== _dragEstadoOrigen) {
            var id = _dragId;
            var prev = _dragEstadoOrigen;
            if (newEstado === 'Cancelada' || newEstado === 'Perdida') {
              BNKConfirm.show('\u00bfCambiar estado a "' + newEstado + '"?', 'CONFIRMAR').then(function (ok) {
                if (ok) _changeEstado(id, newEstado, prev);
              });
            } else {
              _changeEstado(id, newEstado, prev);
            }
          }
        }
      } else if (!_touchMoved && _touchCard) {
        _openDetail(_touchCard.getAttribute('data-id'));
      }

      _touchCard = null;
      _dragId = null;
      _dragEstadoOrigen = null;
      _touchMoved = false;
    });

    // ── Detail modal ──
    document.getElementById('pipeDetailClose').addEventListener('click', _closeDetail);
    document.getElementById('pipeDetailOverlay').addEventListener('click', function (e) { if (e.target === this) _closeDetail(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _currentDetailId) { e.preventDefault(); _closeDetail(); }
    });
    document.getElementById('pipeNoteBtn').addEventListener('click', _submitNote);
    document.getElementById('pipeNoteInput').addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); _submitNote(); }
    });

    // ── Search ──
    var searchInput = document.getElementById('pipeSearch');
    if (searchInput) searchInput.addEventListener('input', function () { _filter = this.value.trim(); _render(); });

    // ── Tipo filter ──
    var filterBtns = document.querySelectorAll('[data-pipe-tipo]');
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        _filterTipo = this.getAttribute('data-pipe-tipo');
        _render();
      });
    });

    // ── Date filters ──
    var desdeEl = document.getElementById('pipeFechaDesde');
    var hastaEl = document.getElementById('pipeFechaHasta');
    if (desdeEl) desdeEl.addEventListener('change', function () { _filterDesde = this.value || null; _render(); });
    if (hastaEl) hastaEl.addEventListener('change', function () { _filterHasta = this.value || null; _render(); });

    // ── Monto filter ──
    var montoEl = document.getElementById('pipeMontoMin');
    if (montoEl) montoEl.addEventListener('input', function () { _filterMontoMin = parseFloat(this.value) || 0; _render(); });
  }

  function _submitNote() {
    var nota = document.getElementById('pipeNoteInput').value.trim();
    if (!nota) { BNKToast.warn('Escribe una nota de seguimiento.'); return; }
    if (!_currentDetailId) return;
    var user = BNK_AUTH.currentUser();
    var btn = document.getElementById('pipeNoteBtn');
    btn.disabled = true;
    BNK_DB.actividad.add(_currentDetailId, {
      tipo: 'nota', usuario: user ? user.nombre : 'Sistema', nota: nota
    }).then(function () {
      document.getElementById('pipeNoteInput').value = '';
      BNKToast.ok('Nota agregada.');
      _loadTimeline(_currentDetailId);
    }).catch(function (err) {
      BNKToast.error('Error al guardar nota: ' + err.message);
    }).finally(function () { btn.disabled = false; });
  }

  function _openDetail(id) {
    _currentDetailId = id;
    var d = _data.find(function (x) { return x.id === id; });
    if (!d) return;
    document.getElementById('pipeDetailTitle').textContent = d.folio || 'DETALLE';
    var tipoBadge = d.fuente === 'BNK' ? 'tipo-BNK' : 'tipo-MNT';
    var info = '<div class="pipe-detail-grid">'
      + '<div><span class="bnk-label">CLIENTE</span><div>' + _esc(d.cliente) + '</div></div>'
      + '<div><span class="bnk-label">EVENTO</span><div>' + _esc(d.evento || '\u2014') + '</div></div>'
      + '<div><span class="bnk-label">TIPO</span><div><span class="tipo-badge ' + tipoBadge + '">' + _esc(d.fuente || 'MNT') + '</span></div></div>'
      + '<div><span class="bnk-label">TOTAL</span><div>' + _formatMXN(d.total) + '</div></div>'
      + '<div class="pipe-detail-estado-wrap"><span class="bnk-label">ESTADO</span><div>'
      + '<select id="pipeDetailEstado" class="bnk-input" style="max-width:200px" data-prev="' + _esc(d.estado) + '">' + _estadoOpts(d.estado) + '</select>'
      + '</div></div></div>';
    document.getElementById('pipeDetailInfo').innerHTML = info;

    document.getElementById('pipeDetailEstado').addEventListener('change', function () {
      var select = this;
      var newEstado = select.value;
      var prevEstado = select.getAttribute('data-prev') || d.estado;
      if (newEstado === 'Cancelada' || newEstado === 'Perdida') {
        BNKConfirm.show('\u00bfCambiar estado a "' + newEstado + '"?', 'CONFIRMAR').then(function (ok) {
          if (ok) { select.setAttribute('data-prev', newEstado); _changeEstado(id, newEstado, prevEstado); _loadTimeline(id); }
          else { select.value = prevEstado; }
        });
      } else {
        select.setAttribute('data-prev', newEstado);
        _changeEstado(id, newEstado, prevEstado);
        _loadTimeline(id);
      }
    });

    _loadTimeline(id);
    document.getElementById('pipeDetailOverlay').classList.add('visible');
  }

  function _loadTimeline(id) {
    BNK_DB.actividad.list(id).then(function (entries) {
      var html = '';
      entries.forEach(function (entry) {
        var fecha = entry.fecha ? (entry.fecha.toDate ? entry.fecha.toDate().toLocaleString('es-MX') : entry.fecha) : '';
        var isEstado = entry.tipo === 'cambio_estado';
        var icon = isEstado ? '\u25B6' : '\u270E';
        var iconClass = isEstado ? 'pipe-timeline-icon--estado' : 'pipe-timeline-icon--nota';
        var text = isEstado ? 'Cambi\u00f3 estado a <strong>' + _esc(entry.estado) + '</strong>' : _esc(entry.nota);
        html += '<div class="pipe-timeline-entry">'
          + '<span class="pipe-timeline-icon ' + iconClass + '">' + icon + '</span>'
          + '<div class="pipe-timeline-content">'
          + '<div class="pipe-timeline-text">' + text + '</div>'
          + '<div class="pipe-timeline-meta">' + _esc(entry.usuario) + ' \u2014 ' + fecha + '</div>'
          + '</div></div>';
      });
      document.getElementById('pipeTimeline').innerHTML = html || '<div style="color:var(--tx);font-size:12px">Sin actividad registrada</div>';
    });
  }

  function _closeDetail() {
    _currentDetailId = null;
    document.getElementById('pipeDetailOverlay').classList.remove('visible');
  }

  function _estadoOpts(current) {
    return ESTADOS.map(function (e) {
      return '<option value="' + e + '"' + (e === current ? ' selected' : '') + '>' + e + '</option>';
    }).join('');
  }

  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user && (user.rol === 'admin' || user.rol === 'ventas')) {
      init();
    } else if (user) {
      var board = document.getElementById('pipelineBoard');
      if (board) {
        board.innerHTML = '<div class="dash-empty"><div class="dash-empty-icon">\u{1F512}</div>'
          + '<div class="dash-empty-text">ACCESO RESTRINGIDO</div>'
          + '<p style="color:var(--tx);font-size:12px;margin-top:8px">Solo roles admin y ventas pueden ver el pipeline.</p></div>';
      }
    }
  });

  window.BNKPipeline = { load: function () {} };
})();
```

- [ ] **Step 3: Add CSS for drag & drop, filters, ghost card**

Add to `panel/css/pipeline.css` before the `@media` responsive block:

```css
/* Drag & drop */
.pipeline-card--dragging{opacity:.4;border:1px dashed var(--g)}
.pipeline-col--drop-target{background:rgba(0,255,65,.04);outline:2px dashed rgba(0,255,65,.3);outline-offset:-2px}
.pipeline-card--ghost{position:fixed;pointer-events:none;z-index:9999;width:200px;opacity:.85;transform:rotate(2deg);background:var(--card);border:1px solid var(--g);padding:12px}

/* BNK line */
.pipeline-card-bnk{font-family:'Space Mono',monospace;font-size:9px;color:var(--blu);margin-bottom:4px}
.pipeline-card-bnk span{color:var(--wh)}

/* Filters */
.pipe-filters{display:flex;align-items:center;gap:16px;padding:0 30px 12px;flex-wrap:wrap}
.pipe-filter-group{display:flex;align-items:center;gap:6px}
.pipe-tipo-btn{background:transparent;border:1px solid var(--bd);color:var(--tx);font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:1px;padding:4px 12px;cursor:pointer;transition:all .2s}
.pipe-tipo-btn:hover{color:var(--wh);border-color:rgba(0,255,65,.3)}
.pipe-tipo-btn.active{color:var(--g);border-color:var(--g);background:rgba(0,255,65,.06)}
.pipe-filter-label{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--tx)}
.pipe-date-input{max-width:130px;font-size:11px;padding:4px 8px}
.pipe-monto-input{max-width:100px;font-size:11px;padding:4px 8px}
.pipe-pipeline-total{margin-left:auto;display:flex;align-items:center;gap:8px}
.pipe-total-label{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:var(--tx)}
.pipe-total-value{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;color:var(--g)}
```

Update the responsive `@media(max-width:900px)` block to add:

```css
  .pipe-filters{padding:0 16px 12px}
  .pipe-pipeline-total{margin-left:0;width:100%}
```

- [ ] **Step 4: Update script version tag**

```html
<script src="js/pages/pipeline.js?v=8"></script>
```

- [ ] **Step 5: Verify in browser**

Open panel, go to Pipeline tab. Verify:
- Cards are draggable (drag a card between columns, confirm estado change)
- Touch drag works on mobile (test with DevTools device emulation)
- Drop on Cancelada/Perdida shows confirmation dialog
- Filter buttons (TODOS/MNT/BNK) filter cards
- Date range filters work
- Monto min filter works
- Pipeline total shows sum of active columns
- BNK children always show on MNT cards (even when BNK is filtered by search)
- Detail modal still works (click card to open)
- Notes still work

- [ ] **Step 6: Commit**

```bash
git add panel/dashboard.html panel/js/pages/pipeline.js panel/css/pipeline.css
git commit -m "feat: pipeline drag & drop with touch support, filters, BNK fix, snapshot cleanup"
```

---

### Task 4: Eventos / Producción Completo

This is the largest module rewrite. Full details in the spec section 2. The implementor should follow these steps:

**Files:**
- Modify: `panel/dashboard.html:1248-1289` (update `#sec-eventos` HTML + add modals)
- Rewrite: `panel/js/pages/eventos.js`
- Modify: `panel/css/eventos.css` (add styles for new features)

**Interfaces:**
- Consumes: `BNK_DB.eventos`, `BNK_DB.tareas`, `BNK_DB.plantillas`, `BNK_DB.usuarios.list()`, `BNK_DB.cotizaciones`, `BNKToast`, `BNKConfirm`, `BNK_AUTH`, `BNK_DB.logActividad()`
- Produces: `window.BNKEventos = { load, crearEvento(cotizacionId, cotizacionData) }`

- [ ] **Step 1: Add new toolbar buttons and modals to dashboard.html**

In the eventos toolbar (`#evtToolbar`, line 1258-1267), add buttons for "NUEVO EVENTO" and "GESTIONAR PLANTILLAS" (admin only):

```html
    <div class="panel-toolbar" id="evtToolbar">
      <h2 class="panel-section-title">EVENTOS / PRODUCCIÓN</h2>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="text" id="evtSearch" class="dash-search" placeholder="Buscar evento..." style="max-width:250px">
        <select class="dash-select" id="evtEstadoFiltro">
          <option value="">Todos</option>
          <option value="En Producción">En Producción</option>
          <option value="Ejecutado">Ejecutados</option>
        </select>
        <button class="panel-btn-primary" id="evtBtnNuevo" data-require-role="admin,ventas,produccion">+ NUEVO EVENTO</button>
        <button class="panel-btn-secondary fin-admin-only" id="evtBtnPlantillas">PLANTILLAS</button>
      </div>
    </div>
```

After `#evtPlantillaOverlay` (after line 1289), add the new create/edit evento modal and the plantillas CRUD modal. Full HTML for these modals includes: evento form (nombre, cliente, fecha, folio cotización autocomplete, plantilla select, estado) and plantillas manager (list + add/edit/delete):

```html
  <!-- Modal crear/editar evento -->
  <div class="bnk-overlay" id="evtFormOverlay">
    <div class="bnk-modal" style="max-width:550px">
      <div class="bnk-modal-header">
        <span class="bnk-modal-title" id="evtFormTitle">NUEVO EVENTO</span>
        <button class="bnk-modal-close" id="evtFormClose">&times;</button>
      </div>
      <div class="bnk-modal-body">
        <div class="bnk-form-group"><label class="bnk-label">NOMBRE DEL EVENTO</label><input type="text" id="evtFormNombre" class="bnk-input"></div>
        <div class="bnk-form-group"><label class="bnk-label">CLIENTE</label><input type="text" id="evtFormCliente" class="bnk-input"></div>
        <div class="bnk-form-group"><label class="bnk-label">FECHA DEL EVENTO</label><input type="date" id="evtFormFecha" class="bnk-input"></div>
        <div class="bnk-form-group"><label class="bnk-label">FOLIO COTIZACIÓN (OPCIONAL)</label><input type="text" id="evtFormFolio" class="bnk-input" placeholder="Ej: MNT-260915-1234"></div>
        <input type="hidden" id="evtFormCotId">
        <div class="bnk-form-group" id="evtFormPlantillaWrap"><label class="bnk-label">PLANTILLA DE TAREAS</label><select id="evtFormPlantilla" class="bnk-input"><option value="">Sin plantilla (evento vacío)</option></select></div>
        <div class="bnk-form-group" id="evtFormEstadoWrap" style="display:none"><label class="bnk-label">ESTADO</label><select id="evtFormEstado" class="bnk-input"><option value="En Producción">En Producción</option><option value="Ejecutado">Ejecutado</option></select></div>
        <input type="hidden" id="evtFormId">
      </div>
      <div class="bnk-modal-footer">
        <button class="panel-btn-secondary" id="evtFormCancel">CANCELAR</button>
        <button class="panel-btn-primary" id="evtFormGuardar">GUARDAR</button>
      </div>
    </div>
  </div>

  <!-- Modal CRUD plantillas -->
  <div class="bnk-overlay" id="evtPlantillaCrudOverlay">
    <div class="bnk-modal" style="max-width:600px">
      <div class="bnk-modal-header">
        <span class="bnk-modal-title">GESTIONAR PLANTILLAS</span>
        <button class="bnk-modal-close" id="evtPlantillaCrudClose">&times;</button>
      </div>
      <div class="bnk-modal-body">
        <div id="evtPlantillaCrudList"></div>
        <button class="panel-btn-primary" id="evtPlantillaCrudNueva" style="margin-top:12px">+ NUEVA PLANTILLA</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: Rewrite eventos.js**

Replace the entire file with the new module that includes:
- List view with cards + edit button on each card
- Create event directly (NUEVO EVENTO button → form modal)
- Edit event (edit button → same form modal with pre-filled data, plantilla hidden, estado shown)
- Checklist view with inline `<select>` for responsable (populated from `BNK_DB.usuarios.list()`)
- Inline `<input type="date">` for `fechaLimite` on each task
- Overdue detection: `.checklist-item--overdue` class when `fechaLimite < today && !completada`
- Tasks sorted by `orden` field
- "+ TAREA" button at bottom of checklist → inline input + confirm
- "×" delete button on tasks (admin only) with confirmation
- HTML5 drag & drop for reordering tasks (update `orden` field)
- CRUD plantillas modal: list, add, edit name, add/remove tasks, delete
- Activity logging via `BNK_DB.logActividad()`
- Same public API: `window.BNKEventos = { load, crearEvento }`

The file will be ~800 lines. The implementor should follow the same IIFE pattern as the current file, keeping all existing functionality (card rendering, checklist toggle, progress update, auto-ejecutado) and adding the new features on top.

Key implementation details:
- `_usuarios` array loaded on init for responsable dropdowns
- `_renderChecklist` sorts tareas by `orden` before rendering
- New task inline: `<div class="evt-add-task">` with input + confirm + cancel buttons
- Drag reorder: `dragstart` stores `tareaId`, `drop` calculates new `orden` values and batch-updates all affected tareas
- Plantillas CRUD: each plantilla has `{ nombre: string, tareas: [{ descripcion: string, orden: number }] }`

- [ ] **Step 3: Update CSS — add styles for new features**

Add to `panel/css/eventos.css`:

```css
/* Overdue task */
.checklist-item--overdue{border-left:3px solid var(--red);background:rgba(255,68,85,.03)}
.checklist-item--overdue .checklist-fecha{color:var(--red)}

/* Inline task editing */
.checklist-responsable select,.checklist-fecha input{background:var(--card);border:1px solid var(--bd);color:var(--wh);font-family:'Space Mono',monospace;font-size:10px;padding:2px 4px;max-width:110px}

/* Add task */
.evt-add-task{display:flex;gap:8px;padding:12px 16px;align-items:center}
.evt-add-task input{flex:1}
.evt-add-task-actions{display:flex;gap:4px}

/* Delete task button */
.checklist-delete{background:transparent;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:4px;opacity:.5;transition:opacity .2s}
.checklist-delete:hover{opacity:1}

/* Drag reorder */
.checklist-item[draggable="true"]{cursor:grab}
.checklist-item.dragging{opacity:.3}
.checklist-item.drag-over{border-top:2px solid var(--g)}

/* Edit button on cards */
.evento-card-edit{background:transparent;border:1px solid var(--bd);color:var(--tx);cursor:pointer;font-size:12px;padding:4px 8px;transition:all .2s}
.evento-card-edit:hover{color:var(--g);border-color:var(--g)}

/* Plantilla CRUD */
.plantilla-crud-item{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--bd);margin-bottom:8px}
.plantilla-crud-name{flex:1;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;color:var(--g)}
.plantilla-crud-count{font-family:'Space Mono',monospace;font-size:10px;color:var(--tx)}
.plantilla-crud-actions{display:flex;gap:4px}
.plantilla-task-list{padding:8px 16px}
.plantilla-task-item{display:flex;align-items:center;gap:8px;padding:4px 0}
.plantilla-task-input{flex:1}
```

- [ ] **Step 4: Update script version tag**

```html
<script src="js/pages/eventos.js?v=8"></script>
```

- [ ] **Step 5: Verify in browser**

Open panel, go to Eventos tab. Verify:
- NUEVO EVENTO button opens form modal
- Can create event with/without plantilla
- Can create event with/without cotización link
- Edit button on cards opens pre-filled form
- Checklist shows responsable dropdown and fecha input per task
- Overdue tasks show red border
- "+ TAREA" adds task inline
- "×" deletes task (admin only) with confirmation
- Tasks can be dragged to reorder
- PLANTILLAS button (admin) opens CRUD modal
- Can add/edit/delete plantillas and their tasks
- `crearEvento()` cross-module API still works (test from pipeline)
- Progress bar updates correctly
- Auto-ejecutado prompt still works

- [ ] **Step 6: Commit**

```bash
git add panel/dashboard.html panel/js/pages/eventos.js panel/css/eventos.css
git commit -m "feat: complete events module with CRUD, task management, plantillas, drag reorder"
```

---

### Task 5: Finanzas — P&L Sub-tab + Aging Buckets

**Files:**
- Modify: `panel/dashboard.html:1297-1304` (add P&L sub-tab button)
- Modify: `panel/dashboard.html:1433-1496` (add aging KPIs to CxC, add P&L sub-tab content before section close)
- Modify: `panel/js/pages/finanzas.js` (add P&L rendering, aging, alerts)
- Modify: `panel/css/finanzas.css` (add P&L and aging styles)

**Interfaces:**
- Consumes: `BNK_DB.pagos.list()`, `BNK_DB.cuentasCobrar.list()`, `BNK_DB.cotizaciones.list()`, `BNKFmt.money()`, `Chart` (global), `BNK_DB.cotizacionPartners`, `BNK_DB.cotizacionProveedores`
- Produces: Same `window.BNKFinanzas = { reload, openEntityPopover }` + internal P&L render

- [ ] **Step 1: Add P&L sub-tab button**

In `dashboard.html` line 1303, after the "CUENTAS POR COBRAR" tab button, add:

```html
        <button class="modal-tab" data-fin-tab="pl">P&amp;L</button>
```

- [ ] **Step 2: Add aging KPIs to CxC sub-tab**

In the CxC section (`#finSubCobrar`), after the existing 4 KPIs (after line 1457), add aging KPIs row:

```html
      <!-- Aging buckets -->
      <div class="dash-indicators fin-aging" style="grid-template-columns:repeat(4,1fr)">
        <div class="dash-card"><div class="dash-card-label">CORRIENTE (0-30d)</div><div class="dash-card-value" id="finAgingCurrent">$0</div></div>
        <div class="dash-card"><div class="dash-card-label">30-60 DÍAS</div><div class="dash-card-value" id="finAging30">$0</div></div>
        <div class="dash-card"><div class="dash-card-label">60-90 DÍAS</div><div class="dash-card-value" id="finAging60">$0</div></div>
        <div class="dash-card dash-card--warn"><div class="dash-card-label">&gt;90 DÍAS</div><div class="dash-card-value" id="finAging90">$0</div></div>
      </div>
```

Add "DÍAS" column header to the CxC table (line 1487, before ACCIONES):

```html
              <th>DÍAS</th>
```

- [ ] **Step 3: Add P&L sub-tab content**

Before the closing `</section>` of `#sec-finanzas` (before line 1788), add:

```html
    <!-- ── SUB-TAB: P&L ── -->
    <div class="fin-subtab" id="finSubPl" style="display:none">
      <!-- KPIs P&L -->
      <div class="dash-indicators" style="grid-template-columns:repeat(4,1fr)">
        <div class="dash-card"><div class="dash-card-label">INGRESOS PERÍODO</div><div class="dash-card-value" id="finPlIngresos">$0</div><div class="dash-card-sub">cobrado</div></div>
        <div class="dash-card"><div class="dash-card-label">EGRESOS PERÍODO</div><div class="dash-card-value" id="finPlEgresos">$0</div><div class="dash-card-sub">pagado</div></div>
        <div class="dash-card"><div class="dash-card-label">RESULTADO</div><div class="dash-card-value" id="finPlResultado">$0</div><div class="dash-card-sub" id="finPlResultadoSub">—</div></div>
        <div class="dash-card"><div class="dash-card-label">MARGEN OPERATIVO</div><div class="dash-card-value" id="finPlMargen">0%</div><div class="dash-card-sub">ingresos - egresos</div></div>
      </div>

      <div class="panel-toolbar">
        <h2 class="panel-section-title">ESTADO DE RESULTADOS (P&amp;L)</h2>
        <div class="reportes-periodo">
          <span style="font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:var(--tx)">PERÍODO:</span>
          <select id="finPlPeriodo" class="bnk-input" style="max-width:200px">
            <option value="mes">Este mes</option>
            <option value="trimestre">Último trimestre</option>
            <option value="semestre">Último semestre</option>
            <option value="anio">Este año</option>
            <option value="todo">Todo</option>
          </select>
        </div>
      </div>

      <div style="padding:0 30px 20px">
        <canvas id="finPlChart" height="220"></canvas>
      </div>

      <div class="dash-table-wrap" style="padding:0 30px 30px">
        <table class="dash-table" id="finPlTabla">
          <thead>
            <tr>
              <th>MES</th>
              <th>INGRESOS</th>
              <th>EGRESOS PROV.</th>
              <th>EGRESOS PARTNERS</th>
              <th>TOTAL EGRESOS</th>
              <th>RESULTADO</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody id="finPlBody"></tbody>
        </table>
      </div>
    </div>
```

- [ ] **Step 4: Update finanzas.js — add P&L rendering, aging, alerts**

In `panel/js/pages/finanzas.js`, add the following functions and wire them into the existing module. These additions go inside the IIFE, before the closing `window.BNKFinanzas` assignment.

Add private variable for the P&L chart:
```javascript
  var _chartPL = null;
```

Add P&L period filter binding in `init()` (after `_bindCobrarEvents()`):
```javascript
    _bindPLEvents();
```

Add `_bindPLEvents` function:
```javascript
  function _bindPLEvents() {
    var periodoEl = document.getElementById('finPlPeriodo');
    if (periodoEl) periodoEl.addEventListener('change', function () { _renderPL(); });
  }
```

Add `_renderPL` function:
```javascript
  function _renderPL() {
    var periodo = (document.getElementById('finPlPeriodo') || {}).value || 'todo';
    var now = new Date();
    var desde = null;
    if (periodo === 'mes') desde = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (periodo === 'trimestre') desde = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    else if (periodo === 'semestre') desde = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    else if (periodo === 'anio') desde = new Date(now.getFullYear(), 0, 1);

    // Build monthly buckets
    var mesesMap = {};
    _cuentasCobrar.forEach(function (c) {
      if (!c.fechaIngreso) return;
      var mes = String(c.fechaIngreso).substring(0, 7);
      if (!mes || mes.length < 7) return;
      if (desde && new Date(mes + '-01') < desde) return;
      if (!mesesMap[mes]) mesesMap[mes] = { ingresos: 0, egresosProv: 0, egresosPart: 0 };
      mesesMap[mes].ingresos += parseFloat(c.montoSinIva) || 0;
    });

    _pagos.forEach(function (p) {
      var fecha = p.fechaPago || p.fecha || '';
      if (typeof fecha === 'object' && fecha.toDate) fecha = fecha.toDate().toISOString();
      var mes = String(fecha).substring(0, 7);
      if (!mes || mes.length < 7) return;
      if (desde && new Date(mes + '-01') < desde) return;
      if (!mesesMap[mes]) mesesMap[mes] = { ingresos: 0, egresosProv: 0, egresosPart: 0 };
      var monto = parseFloat(p.monto) || 0;
      if (p.tipo === 'proveedor') mesesMap[mes].egresosProv += monto;
      else mesesMap[mes].egresosPart += monto;
    });

    var meses = Object.keys(mesesMap).sort().reverse().slice(0, 12);

    // KPIs
    var totalIngresos = 0, totalEgresos = 0;
    meses.forEach(function (m) {
      var r = mesesMap[m];
      totalIngresos += r.ingresos;
      totalEgresos += r.egresosProv + r.egresosPart;
    });
    var resultado = totalIngresos - totalEgresos;
    var margen = totalIngresos > 0 ? Math.round((resultado / totalIngresos) * 100) : 0;

    var el = document.getElementById('finPlIngresos');
    if (el) el.textContent = _formatMXN(totalIngresos);
    el = document.getElementById('finPlEgresos');
    if (el) el.textContent = _formatMXN(totalEgresos);
    el = document.getElementById('finPlResultado');
    if (el) { el.textContent = _formatMXN(resultado); el.style.color = resultado >= 0 ? 'var(--g)' : 'var(--red)'; }
    el = document.getElementById('finPlResultadoSub');
    if (el) el.textContent = resultado >= 0 ? 'positivo' : 'negativo';
    el = document.getElementById('finPlMargen');
    if (el) el.textContent = margen + '%';

    // Table
    var tbody = document.getElementById('finPlBody');
    if (tbody) {
      var html = '';
      meses.forEach(function (m) {
        var r = mesesMap[m];
        var totalEg = r.egresosProv + r.egresosPart;
        var res = r.ingresos - totalEg;
        var pct = r.ingresos > 0 ? Math.round((res / r.ingresos) * 100) : 0;
        html += '<tr>'
          + '<td style="color:var(--g)">' + _esc(m) + '</td>'
          + '<td>' + _formatMXN(r.ingresos) + '</td>'
          + '<td style="color:var(--red)">' + _formatMXN(r.egresosProv) + '</td>'
          + '<td style="color:var(--red)">' + _formatMXN(r.egresosPart) + '</td>'
          + '<td style="color:var(--red)">' + _formatMXN(totalEg) + '</td>'
          + '<td style="color:' + (res >= 0 ? 'var(--g)' : 'var(--red)') + '">' + _formatMXN(res) + '</td>'
          + '<td style="color:' + (pct > 0 ? 'var(--g)' : 'var(--red)') + '">' + pct + '%</td>'
          + '</tr>';
      });
      tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;color:var(--tx)">Sin datos</td></tr>';
    }

    // Chart
    if (typeof Chart === 'undefined') return;
    var canvas = document.getElementById('finPlChart');
    if (!canvas) return;
    if (_chartPL) _chartPL.destroy();

    var chartMeses = meses.slice().reverse();
    var ingresos = chartMeses.map(function (m) { return Math.round(mesesMap[m].ingresos); });
    var egresos = chartMeses.map(function (m) { return Math.round(mesesMap[m].egresosProv + mesesMap[m].egresosPart); });

    var styles = getComputedStyle(document.documentElement);
    var colorG = styles.getPropertyValue('--g').trim() || '#00FF41';
    var colorRed = styles.getPropertyValue('--red').trim() || '#FF4455';
    var colorTx = styles.getPropertyValue('--tx').trim() || '#777';

    _chartPL = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: chartMeses.map(function (m) { return m.substring(5); }),
        datasets: [
          { label: 'Ingresos', data: ingresos, backgroundColor: colorG + '66', borderColor: colorG, borderWidth: 1 },
          { label: 'Egresos', data: egresos, backgroundColor: colorRed + '66', borderColor: colorRed, borderWidth: 1 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: colorTx, font: { family: 'Space Mono', size: 10 } } } },
        scales: {
          x: { ticks: { color: colorTx, font: { family: 'Space Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,.03)' } },
          y: { ticks: { color: colorTx, font: { family: 'Space Mono', size: 9 }, callback: function (v) { return '$' + (v / 1000).toFixed(0) + 'k'; } }, grid: { color: 'rgba(255,255,255,.06)' } }
        }
      }
    });
  }
```

Add `_renderAgingBuckets` function (called from `_renderCobrarKPIs`):
```javascript
  function _renderAgingBuckets() {
    var buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
    var now = Date.now();

    _cuentasCobrar.forEach(function (c) {
      if (c.fechaIngreso) return; // Already collected
      var monto = parseFloat(c.montoSinIva) || 0;
      var refDate = c.fechaConfirmacion || c.createdAt;
      if (!refDate) { buckets.current += monto; return; }
      if (typeof refDate === 'object' && refDate.toDate) refDate = refDate.toDate();
      else refDate = new Date(refDate);
      var dias = Math.floor((now - refDate.getTime()) / (1000 * 60 * 60 * 24));

      if (dias <= 30) buckets.current += monto;
      else if (dias <= 60) buckets.d30 += monto;
      else if (dias <= 90) buckets.d60 += monto;
      else buckets.d90 += monto;
    });

    var el = document.getElementById('finAgingCurrent');
    if (el) el.textContent = _formatMXN(buckets.current);
    el = document.getElementById('finAging30');
    if (el) el.textContent = _formatMXN(buckets.d30);
    el = document.getElementById('finAging60');
    if (el) el.textContent = _formatMXN(buckets.d60);
    el = document.getElementById('finAging90');
    if (el) el.textContent = _formatMXN(buckets.d90);
  }
```

Wire `_renderAgingBuckets()` into `_renderCobrarKPIs()` (call it at the end).

Wire `_renderPL()` into `_loadData()` (call it after all other renders, inside the `.then`).

Update `_renderCobrar` to add "DÍAS" column to each row and `.fin-overdue` class for >90 days:
- Calculate `dias` for each record (same formula as aging buckets)
- Add `<td>` with days value before the ACCIONES column
- If `dias > 90 && !c.fechaIngreso`, add class `fin-overdue` to the `<tr>`
- If `dias > 30 && !c.fechaIngreso && c.prefacturaConfirmada === 'si'`, add "VENCIDO" badge

Update `_renderCuentas` to add "VENCIDO" badge when cotización is Ejecutado but cuenta not cerrada:
- For each cuenta, check if the associated cotización (via cotizacionId) has `estado === 'Ejecutado'`
- If yes and `!cerrada`, add `<span class="estado-badge fin-vencido-badge">VENCIDO</span>`

Update the finanzas sub-tab switching in the inline `<script>` in dashboard.html to handle the new "pl" tab:
- The existing logic `finSub` + `target.charAt(0).toUpperCase() + target.slice(1)` will produce `finSubPl` — matching our HTML ID `finSubPl`

- [ ] **Step 5: Add CSS for P&L and aging**

Add to `panel/css/finanzas.css`:

```css
/* P&L chart container */
#finPlChart{max-height:220px}

/* Aging indicators */
.fin-aging{margin-bottom:0}

/* Overdue row */
.fin-overdue{background:rgba(255,68,85,.04)}
.fin-overdue td{color:var(--red)}
.fin-vencido-badge{background:rgba(255,68,85,.15);color:var(--red);font-family:'Space Mono',monospace;font-size:9px;padding:2px 6px;letter-spacing:1px}
```

- [ ] **Step 6: Update script version tag**

```html
<script src="js/pages/finanzas.js?v=8"></script>
```

- [ ] **Step 7: Verify in browser**

Open panel, go to Finanzas tab. Verify:
- P&L sub-tab appears and is clickable
- P&L KPIs show correct ingresos/egresos/resultado/margen
- P&L table shows monthly breakdown
- Chart.js bar chart renders
- Period filter works
- CxC tab shows aging buckets (0-30, 30-60, 60-90, >90)
- CxC table shows "DÍAS" column
- Rows >90 days have red background
- "VENCIDO" badges appear where applicable
- CxP table shows "VENCIDO" for ejecutado cotizaciones with open cuentas

- [ ] **Step 8: Commit**

```bash
git add panel/dashboard.html panel/js/pages/finanzas.js panel/css/finanzas.css
git commit -m "feat: P&L sub-tab with Chart.js, aging buckets, overdue alerts in finanzas"
```

---

### Task 6: Feed de Actividad y Notificaciones

**Files:**
- Create: `panel/js/pages/actividad.js` (~200 lines)
- Modify: `panel/dashboard.html:33-37` (add bell icon in header)
- Modify: `panel/dashboard.html:2041-2057` (add script tag)
- Modify: `panel/css/panel.css` (add activity widget styles)
- Modify: multiple modules to add `BNK_DB.logActividad()` calls

**Interfaces:**
- Consumes: `BNK_DB.actividadGlobal.list()`, `BNK_DB.logActividad()`, `BNK_AUTH`, `BNKToast`
- Produces: `window.BNKActividad = { load, updateBadge }` — bell icon with dropdown

- [ ] **Step 1: Add bell icon + dropdown HTML in header**

In `dashboard.html`, in the `.panel-user` div (line 33-37), add the bell button before the logout button:

```html
  <div class="panel-user">
    <span id="panelUserName"></span>
    <span id="panelUserRole" class="panel-role-badge"></span>
    <div class="act-bell-wrap">
      <button id="actBellBtn" class="act-bell" title="Actividad reciente" aria-label="Ver actividad reciente">
        <span class="act-bell-icon" role="img" aria-label="campana">&#128276;</span>
        <span class="act-bell-badge" id="actBellBadge" style="display:none">0</span>
      </button>
      <div class="act-dropdown" id="actDropdown">
        <div class="act-dropdown-header">ACTIVIDAD RECIENTE</div>
        <div class="act-dropdown-list" id="actDropdownList"></div>
        <div class="act-dropdown-empty" id="actDropdownEmpty" style="display:none">Sin actividad reciente</div>
      </div>
    </div>
    <button id="panelLogout" class="panel-logout-btn" title="Cerrar sesión">SALIR</button>
  </div>
```

- [ ] **Step 2: Create `panel/js/pages/actividad.js`**

```javascript
// actividad.js — Feed de actividad global
(function () {
  'use strict';

  var _entries = [];
  var _isOpen = false;

  var TIPO_ICONS = {
    'cotizacion_creada': '\u{1F4DD}',
    'estado_cambio': '\u25B6',
    'pago_registrado': '\u{1F4B0}',
    'cliente_creado': '\u{1F465}',
    'cliente_editado': '\u270F',
    'proveedor_creado': '\u{1F3ED}',
    'proveedor_editado': '\u270F',
    'evento_creado': '\u{1F3AC}',
    'tarea_completada': '\u2705',
    'partner_creado': '\u{1F91D}',
    'partner_editado': '\u270F',
    'cobrar_registrada': '\u{1F4B5}',
    'export_csv': '\u{1F4CA}'
  };

  var TIPO_TAB = {
    'cotizacion_creada': 'cotizaciones',
    'estado_cambio': 'pipeline',
    'pago_registrado': 'finanzas',
    'cliente_creado': 'clientes',
    'cliente_editado': 'clientes',
    'proveedor_creado': 'proveedores',
    'proveedor_editado': 'proveedores',
    'evento_creado': 'eventos',
    'tarea_completada': 'eventos',
    'partner_creado': 'finanzas',
    'partner_editado': 'finanzas',
    'cobrar_registrada': 'finanzas'
  };

  function init() {
    _bindEvents();
    load();
  }

  function load() {
    if (!BNK_DB.actividadGlobal) return;
    BNK_DB.actividadGlobal.list().then(function (docs) {
      _entries = docs.slice(0, 50);
      _renderDropdown();
      _updateBadge();
    }).catch(function () {
      _entries = [];
    });
  }

  function _updateBadge() {
    var badge = document.getElementById('actBellBadge');
    if (!badge) return;

    var user = BNK_AUTH.currentUser();
    var storageKey = 'bnk_last_activity_' + (user ? user.uid : 'anon');
    var lastSeen = parseInt(localStorage.getItem(storageKey)) || 0;

    var now24h = Date.now() - 24 * 60 * 60 * 1000;
    var count = 0;
    _entries.forEach(function (e) {
      var ts = e.timestamp;
      if (!ts) return;
      var time = ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
      if (time > now24h && time > lastSeen) count++;
    });

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  function _renderDropdown() {
    var list = document.getElementById('actDropdownList');
    var empty = document.getElementById('actDropdownEmpty');
    if (!list) return;

    if (_entries.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    var html = '';
    _entries.slice(0, 20).forEach(function (e) {
      var icon = TIPO_ICONS[e.tipo] || '\u2022';
      var tab = TIPO_TAB[e.tipo] || '';
      var timeStr = _tiempoRelativo(e.timestamp);
      html += '<div class="act-entry" data-tab="' + tab + '" data-ref="' + _esc(e.referencia) + '">'
        + '<span class="act-entry-icon">' + icon + '</span>'
        + '<div class="act-entry-content">'
        + '<div class="act-entry-text">' + _esc(e.detalle || e.referencia) + '</div>'
        + '<div class="act-entry-meta">' + _esc(e.usuario) + ' \u2014 ' + timeStr + '</div>'
        + '</div>'
        + '</div>';
    });
    list.innerHTML = html;
  }

  function _tiempoRelativo(timestamp) {
    if (!timestamp) return '';
    var time = timestamp.toDate ? timestamp.toDate().getTime() : new Date(timestamp).getTime();
    var diff = Date.now() - time;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return 'hace ' + mins + ' min';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return 'hace ' + hrs + 'h';
    var days = Math.floor(hrs / 24);
    if (days === 1) return 'ayer';
    return 'hace ' + days + 'd';
  }

  function _bindEvents() {
    var btn = document.getElementById('actBellBtn');
    var dropdown = document.getElementById('actDropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      _isOpen = !_isOpen;
      dropdown.classList.toggle('visible', _isOpen);
      if (_isOpen) {
        // Mark as seen
        var user = BNK_AUTH.currentUser();
        var storageKey = 'bnk_last_activity_' + (user ? user.uid : 'anon');
        localStorage.setItem(storageKey, String(Date.now()));
        _updateBadge();
      }
    });

    document.addEventListener('click', function (e) {
      if (_isOpen && !dropdown.contains(e.target) && e.target !== btn) {
        _isOpen = false;
        dropdown.classList.remove('visible');
      }
    });

    dropdown.addEventListener('click', function (e) {
      var entry = e.target.closest('.act-entry');
      if (!entry) return;
      var tab = entry.getAttribute('data-tab');
      if (tab) {
        // Navigate to tab
        var tabBtn = document.querySelector('.dash-tab[data-tab="' + tab + '"]');
        if (tabBtn) tabBtn.click();
      }
      _isOpen = false;
      dropdown.classList.remove('visible');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _isOpen) {
        _isOpen = false;
        dropdown.classList.remove('visible');
      }
    });
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKActividad = { load: load, updateBadge: _updateBadge };
})();
```

- [ ] **Step 3: Add script tag for actividad.js**

In `dashboard.html`, after the documentos.js script (line 2044), add:

```html
<script src="js/pages/actividad.js?v=8"></script>
```

- [ ] **Step 4: Add CSS for activity widget**

Add to `panel/css/panel.css`:

```css
/* Activity bell */
.act-bell-wrap{position:relative}
.act-bell{background:transparent;border:1px solid var(--bd);color:var(--tx);cursor:pointer;padding:4px 8px;font-size:16px;transition:all .2s;position:relative}
.act-bell:hover{color:var(--g);border-color:var(--g)}
.act-bell-badge{position:absolute;top:-6px;right:-6px;background:var(--red);color:var(--wh);font-family:'Space Mono',monospace;font-size:8px;padding:2px 5px;border-radius:50%;min-width:14px;text-align:center;line-height:1.2}
.act-dropdown{display:none;position:absolute;top:100%;right:0;width:360px;max-height:420px;background:var(--dk);border:1px solid var(--bd);z-index:1000;overflow:hidden;margin-top:8px}
.act-dropdown.visible{display:block}
.act-dropdown-header{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--g);padding:12px 16px;border-bottom:1px solid var(--bd)}
.act-dropdown-list{max-height:360px;overflow-y:auto}
.act-dropdown-empty{padding:30px;text-align:center;color:var(--tx);font-size:12px}
.act-entry{display:flex;gap:10px;padding:10px 16px;cursor:pointer;transition:background .2s;border-bottom:1px solid rgba(0,255,65,.04)}
.act-entry:hover{background:rgba(0,255,65,.03)}
.act-entry-icon{font-size:14px;flex-shrink:0;margin-top:2px}
.act-entry-content{flex:1;min-width:0}
.act-entry-text{font-size:12px;color:var(--wh);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.act-entry-meta{font-family:'Space Mono',monospace;font-size:9px;color:var(--tx);margin-top:2px}
```

- [ ] **Step 5: Instrument existing modules with logActividad calls**

Add `BNK_DB.logActividad()` calls to these modules after their save operations succeed:

**`panel/js/pages/cotizar-mnt.js`** — in `_enviar()` after `BNK_DB.cotizaciones.create()` success:
```javascript
BNK_DB.logActividad({ tipo: 'cotizacion_creada', entidad: 'cotizacion', entidadId: data.id, referencia: data.folio, detalle: 'Cotización MNT creada para ' + (data.cliente || data.empresa) });
```

**`panel/js/pages/cotizar-bnk.js`** — in `_enviar()` after `BNK_DB.cotizaciones.create()` success:
```javascript
BNK_DB.logActividad({ tipo: 'cotizacion_creada', entidad: 'cotizacion', entidadId: data.id, referencia: data.folio, detalle: 'Cotización BNK creada para ' + (data.empresa || '') });
```

**`panel/js/pages/clientes.js`** — after save client success (both create and update):
```javascript
BNK_DB.logActividad({ tipo: isNew ? 'cliente_creado' : 'cliente_editado', entidad: 'cliente', entidadId: id, referencia: data.razonSocial || data.empresa || '', detalle: (isNew ? 'Cliente creado: ' : 'Cliente editado: ') + (data.razonSocial || data.empresa || '') });
```

**`panel/js/pages/proveedores.js`** — after save proveedor success:
```javascript
BNK_DB.logActividad({ tipo: isNew ? 'proveedor_creado' : 'proveedor_editado', entidad: 'proveedor', entidadId: id, referencia: data.razonSocial || data.nombreComercial || '', detalle: (isNew ? 'Proveedor creado: ' : 'Proveedor editado: ') + (data.razonSocial || data.nombreComercial || '') });
```

**`panel/js/pages/finanzas.js`** — after `_savePago()` success:
```javascript
BNK_DB.logActividad({ tipo: 'pago_registrado', entidad: 'pago', entidadId: data.id, referencia: data.cotizacionFolio || '', detalle: 'Pago de ' + _formatMXN(data.monto) + ' a ' + (data.proveedorNombre || data.partnerNombre || '') });
```

**`panel/js/pages/finanzas.js`** — after `_saveCobrar()` success:
```javascript
BNK_DB.logActividad({ tipo: 'cobrar_registrada', entidad: 'cobrar', entidadId: data.id, referencia: data.folioProyecto || '', detalle: 'Cuenta por cobrar: ' + (data.cliente || '') + ' $' + (data.montoSinIva || 0) });
```

**`panel/js/pages/finanzas.js`** — after `_savePartner()` success:
```javascript
BNK_DB.logActividad({ tipo: isNew ? 'partner_creado' : 'partner_editado', entidad: 'partner', entidadId: data.id, referencia: data.folio || data.nombre || '', detalle: (isNew ? 'Partner creado: ' : 'Partner editado: ') + (data.nombre || '') });
```

**`panel/js/pages/eventos.js`** — after create event success:
```javascript
BNK_DB.logActividad({ tipo: 'evento_creado', entidad: 'evento', entidadId: data.id, referencia: data.folioCotizacion || data.nombre, detalle: 'Evento creado: ' + data.nombre });
```

**`panel/js/pages/eventos.js`** — after task toggle to completed:
```javascript
BNK_DB.logActividad({ tipo: 'tarea_completada', entidad: 'evento', entidadId: eventoId, referencia: evt.folioCotizacion || evt.nombre, detalle: 'Tarea completada en ' + evt.nombre });
```

Note: `pipeline.js` already logs to `actividadGlobal` via `_changeEstado` in Task 3. No additional instrumentation needed there.

- [ ] **Step 6: Update all modified script version tags**

```html
<script src="js/pages/cotizar-mnt.js?v=8"></script>
<script src="js/pages/cotizar-bnk.js?v=8"></script>
<script src="js/pages/clientes.js?v=8"></script>
<script src="js/pages/proveedores.js?v=8"></script>
<script src="js/pages/finanzas.js?v=8"></script>
<script src="js/pages/eventos.js?v=8"></script>
```

- [ ] **Step 7: Verify in browser**

Open panel. Verify:
- Bell icon appears in header
- Create a cotización → bell shows badge "1"
- Click bell → dropdown opens with the activity entry
- Click entry → navigates to correct tab
- Click outside dropdown → closes
- Create client, proveedor, pago → all appear in feed
- Badge count resets after opening dropdown
- Refresh page → badge uses localStorage to track last seen

- [ ] **Step 8: Commit**

```bash
git add panel/js/pages/actividad.js panel/dashboard.html panel/css/panel.css panel/js/pages/cotizar-mnt.js panel/js/pages/cotizar-bnk.js panel/js/pages/clientes.js panel/js/pages/proveedores.js panel/js/pages/finanzas.js panel/js/pages/eventos.js
git commit -m "feat: activity feed with bell notification, logActividad instrumentation across modules"
```

---

### Task 7: Calendario Mejorado — Vista Semanal + Vista Día + iCal Export

**Files:**
- Modify: `panel/dashboard.html:964-971` (add view toggle + export button to toolbar)
- Rewrite: `panel/js/pages/calendario.js`
- Modify: `panel/css/calendario.css` (add weekly/day/tooltip styles)

**Interfaces:**
- Consumes: `BNK_DB.cotizaciones.onSnapshot()`, `BNK_DB.eventos.list()`, `BNKToast`, `BNK_AUTH`
- Produces: `window.BNKCalendario = { load, gotoMonth }`

- [ ] **Step 1: Update toolbar HTML**

Replace the toolbar section (lines 964-971) with:

```html
    <div class="panel-toolbar">
      <h2 class="panel-section-title">CALENDARIO DE EVENTOS</h2>
      <div class="cal-view-toggle">
        <button class="cal-view-btn active" id="calViewMes" title="Vista mensual">MES</button>
        <button class="cal-view-btn" id="calViewSemana" title="Vista semanal">SEMANA</button>
      </div>
      <div class="cal-nav">
        <button id="calPrev" class="panel-btn-icon" title="Anterior">&larr;</button>
        <span id="calMesAnio" class="cal-mes-label"></span>
        <button id="calNext" class="panel-btn-icon" title="Siguiente">&rarr;</button>
        <button id="calHoy" class="panel-btn-secondary" style="margin-left:8px;font-size:10px;padding:4px 12px">HOY</button>
      </div>
      <button class="panel-btn-secondary" id="calExport" title="Exportar a iCal">EXPORTAR .ICS</button>
    </div>
```

After the `#calEmpty` div (after line 991), add a day view container:

```html
    <div id="calDayView" class="cal-day-view" style="display:none">
      <div class="cal-day-header">
        <button id="calDayBack" class="panel-btn-icon">&larr;</button>
        <span id="calDayLabel" class="cal-mes-label"></span>
      </div>
      <div id="calDayList" class="cal-day-list"></div>
    </div>
```

- [ ] **Step 2: Rewrite calendario.js**

The full rewrite adds:
- `_viewMode` state: `'mes'`, `'semana'`, `'dia'`
- `_semanaOffset` for week navigation (0 = current week)
- `_diaFecha` for day view (ISO date string)
- `_renderSemana()`: 7-column grid with hour rows (8:00-22:00), all-day section at top, blocks positioned by time if available
- `_renderDia(fecha)`: list view of a single day's events with full detail
- `_exportICS()`: generates .ics file with VCALENDAR/VEVENT format
- View toggle buttons switch between mes/semana
- Click on day number in month view → opens day view
- Tooltips on hover (title attribute with full info)
- "+N más" overflow when >3 blocks in a day cell

The module keeps all existing functionality (month grid, venue filters, keyboard nav, click-to-navigate) and extends it. The implementor should keep the existing `_getBloquesDelDia`, `_updateIndicators`, etc. and add the new rendering modes.

Key implementation for iCal export:
```javascript
  function _exportICS() {
    var bloques = _getAllVisibleBloques();
    if (bloques.length === 0) { BNKToast.warn('Sin eventos para exportar.'); return; }

    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BUNKER//Panel//ES'];
    bloques.forEach(function (b) {
      var dtstart = b.fecha.replace(/-/g, '');
      lines.push('BEGIN:VEVENT');
      lines.push('DTSTART;VALUE=DATE:' + dtstart);
      lines.push('SUMMARY:' + _icsEscape(b.cliente + ' - ' + (b.evento || b.label)));
      lines.push('DESCRIPTION:' + _icsEscape('Folio: ' + (b.folio || '') + '\\nEstado: ' + (b.estado || '') + '\\nMonto: ' + _formatMXN(b.monto || 0)));
      if (b.espacio) lines.push('LOCATION:' + _icsEscape(b.espacio));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');

    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bunker-calendario-' + new Date().toISOString().substring(0, 7) + '.ics';
    a.click();
    URL.revokeObjectURL(url);
    BNKToast.ok('Calendario exportado.');
  }

  function _icsEscape(s) {
    return (s || '').replace(/[,;\\]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n');
  }
```

- [ ] **Step 3: Add CSS for weekly, day, and tooltip views**

Add to `panel/css/calendario.css`:

```css
/* View toggle */
.cal-view-toggle{display:flex;gap:0}
.cal-view-btn{background:transparent;border:1px solid var(--bd);color:var(--tx);font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:1px;padding:4px 14px;cursor:pointer;transition:all .2s}
.cal-view-btn:first-child{border-right:none}
.cal-view-btn.active{color:var(--g);border-color:var(--g);background:rgba(0,255,65,.06)}

/* Weekly view */
.cal-week-grid{display:grid;grid-template-columns:50px repeat(7,1fr);gap:0;padding:0 30px 30px}
.cal-week-hour{font-family:'Space Mono',monospace;font-size:9px;color:var(--tx);padding:2px 6px;text-align:right;border-bottom:1px solid rgba(0,255,65,.04);height:40px}
.cal-week-cell{border:1px solid var(--bd);border-top:none;border-left:none;min-height:40px;position:relative;padding:2px}
.cal-week-header{font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:1px;color:var(--g);text-align:center;padding:8px;border-bottom:1px solid var(--bd);background:var(--dk)}
.cal-week-allday{grid-column:2/-1;padding:4px;border-bottom:2px solid var(--bd);min-height:30px;display:flex;gap:4px;flex-wrap:wrap}
.cal-week-allday-label{font-family:'Space Mono',monospace;font-size:9px;color:var(--tx);padding:8px 6px;text-align:right;border-bottom:2px solid var(--bd)}

/* Day view */
.cal-day-view{padding:0 30px 30px}
.cal-day-header{display:flex;align-items:center;gap:16px;margin-bottom:16px}
.cal-day-list{display:flex;flex-direction:column;gap:8px}
.cal-day-item{background:var(--card);border:1px solid var(--bd);padding:16px;display:flex;gap:16px;align-items:center}
.cal-day-item-tipo{width:4px;height:40px;flex-shrink:0}
.cal-day-item-tipo--cotizado{background:var(--ylw)}
.cal-day-item-tipo--confirmado{background:var(--g)}
.cal-day-item-tipo--evento{background:var(--cyan,#00e5ff)}
.cal-day-item-info{flex:1}
.cal-day-item-cliente{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;color:var(--wh)}
.cal-day-item-evento{font-size:12px;color:var(--tx);margin-top:2px}
.cal-day-item-meta{font-family:'Space Mono',monospace;font-size:10px;color:var(--tx);margin-top:4px}

/* Overflow indicator */
.cal-overflow{font-family:'Space Mono',monospace;font-size:9px;color:var(--g);cursor:pointer;padding:2px 6px;text-align:center}
.cal-overflow:hover{text-decoration:underline}

/* Tooltip */
.cal-bloque[title]{position:relative}
```

Update responsive:
```css
@media(max-width:900px){
  .cal-grid,.cal-week-grid{padding:0 16px 16px}
  .cal-cell{min-height:70px}
  .cal-day{font-size:9px}
  .cal-bloque{font-size:8px}
  .cal-filtros,.cal-legend{padding-left:16px;padding-right:16px}
  .cal-view-toggle{display:none}
  .cal-day-view{padding:0 16px 16px}
}
```

- [ ] **Step 4: Update script version tag**

```html
<script src="js/pages/calendario.js?v=8"></script>
```

- [ ] **Step 5: Verify in browser**

Open panel, go to Calendario tab. Verify:
- MES/SEMANA toggle switches between views
- Month view works as before
- Click on a day number opens day view with full detail
- "Volver" button returns to month view
- Week view shows 7-column grid with hour rows
- All-day events appear in top section
- Navigation arrows move by week in week mode
- HOY goes to current week/month
- EXPORTAR .ICS downloads valid .ics file (open in calendar app to verify)
- Venue filters work in both views
- Keyboard navigation works in both views
- "+N más" shows when >3 blocks in a day cell

- [ ] **Step 6: Commit**

```bash
git add panel/dashboard.html panel/js/pages/calendario.js panel/css/calendario.css
git commit -m "feat: calendar weekly view, day view, iCal export, tooltips"
```

---

### Task 8: Final Deploy + Version Bump

**Files:**
- Modify: `panel/dashboard.html` (verify all `?v=` tags are bumped)

**Interfaces:**
- Consumes: all prior tasks completed
- Produces: deployed panel at `bunker-panel.web.app`

- [ ] **Step 1: Verify all script/CSS version tags are v=8**

Check that all modified files have bumped version tags in `dashboard.html`:
- `css/panel.css?v=8`
- `css/reportes.css?v=8`
- `css/pipeline.css?v=8`
- `css/eventos.css?v=8`
- `css/finanzas.css?v=8`
- `css/calendario.css?v=8`
- `js/firestore.js?v=3`
- `js/pages/reportes.js?v=8`
- `js/pages/pipeline.js?v=8`
- `js/pages/eventos.js?v=8`
- `js/pages/finanzas.js?v=8`
- `js/pages/calendario.js?v=8`
- `js/pages/actividad.js?v=8`
- `js/pages/cotizar-mnt.js?v=8`
- `js/pages/cotizar-bnk.js?v=8`
- `js/pages/clientes.js?v=8`
- `js/pages/proveedores.js?v=8`

- [ ] **Step 2: Full browser test**

Open `panel/dashboard.html` and test each tab:
1. Cotizaciones — existing functionality works
2. Cotizar MNT — creates cotización, logs activity
3. Cotizar BNK — creates cotización, logs activity
4. Pipeline — drag & drop works, filters work, BNK children show
5. Clientes — CRUD works, logs activity
6. Proveedores — CRUD works, logs activity
7. Calendario — month/week/day views, export iCal
8. Reportes — all 6 widgets render, Chart.js graphs, CSV export
9. Catálogo — existing functionality works
10. Eventos — CRUD, checklist, plantillas, task management
11. Finanzas — P&L tab, aging buckets, overdue alerts
12. Usuarios — existing functionality works
13. Bell icon — shows activity, badge count, navigation

- [ ] **Step 3: Deploy**

```bash
firebase deploy --only hosting,firestore:rules --project bunker-panel
```

- [ ] **Step 4: Verify production**

Open `bunker-panel.web.app/dashboard` and verify all features work in production.

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final version bumps and deploy for panel V2"
```
