# Requerimientos Cliente 14/09/2026 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 10 client requirements from the 14/09/2026 meeting: dual-price provider services with category blocks, BNK cotizador integration with provider services, client linking, MNT special pricing, profile completion fix, payment UX fix, and work order PDFs.

**Architecture:** Five phases ordered by technical dependency. Phase 1 changes the service data schema (dual price + blocks). Phase 2 redesigns the BNK cotizador to consume provider services with auto-linking. Phases 3–4 are independent (client linking, MNT pricing, UX fixes). Phase 5 adds work order PDF generation. All changes are client-side vanilla JS (ES5 IIFEs) + Firestore.

**Tech Stack:** Vanilla JS (ES5), Firebase Firestore (compat SDK), jsPDF 2.5.1, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-09-15-requerimientos-cliente-14sept-design.md`

## Global Constraints

- All user-facing text in **Spanish**
- ES5 syntax only: `var`, `function`, no arrow functions, no `let/const`, no template literals
- No build tools — edit source files directly
- CSS: never use `!important`, use design tokens from `:root`
- Modules are IIFEs with `'use strict'` exposing via `window.BNKXxx`
- Toast notifications via `BNKToast.ok/warn/error(msg)`
- Firestore timestamps via `firebase.firestore.FieldValue.serverTimestamp()`
- Panel deployed to `bunker-panel.web.app` via `firebase deploy --only hosting`

---

## Task 1: Firestore Infrastructure — Bloques Subcolección + Collection Group

**Files:**
- Modify: `panel/js/firestore.js` (lines 1–138)
- Modify: `firestore.rules` (lines 1–104)

**Interfaces:**
- Produces: `BNK_DB.bloques(proveedorId)` → `{ list, get, create, update, delete }` (same shape as `collectionAPI`)
- Produces: `BNK_DB.allServicios()` → `Promise<Array<{id, proveedorId, categoria, servicio, unidad, costoUnitario, precioCliente, bloqueId}>>` (collection group query)
- Produces: `BNK_DB.allBloques()` → `Promise<Array<{id, proveedorId, nombre, precioManual, usaPrecioManual, orden}>>` (collection group query)

- [x] **Step 1: Add `bloques` subcollection API to firestore.js**

In `panel/js/firestore.js`, after the `tareasAPI` definition (line 118) and before `window.BNK_DB`, add:

```js
  // ── Bloques de proveedor (subcollection de proveedores) ──
  function bloquesAPI(proveedorId) {
    var ref = db.collection('proveedores').doc(proveedorId).collection('bloques');
    return {
      list: function () {
        return ref.orderBy('orden', 'asc').get().then(function (snap) {
          return snap.docs.map(function (doc) {
            var d = doc.data(); d.id = doc.id; d.proveedorId = proveedorId; return d;
          });
        });
      },
      create: function (data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        return ref.add(data).then(function (r) { data.id = r.id; return data; });
      },
      update: function (id, data) {
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        return ref.doc(id).update(data);
      },
      delete: function (id) { return ref.doc(id).delete(); }
    };
  }
```

- [x] **Step 2: Add collection group queries for servicios and bloques**

After the `bloquesAPI` function, add:

```js
  // ── Collection group queries (cross-provider) ──
  function allServiciosQuery() {
    return db.collectionGroup('servicios').get().then(function (snap) {
      return snap.docs.map(function (doc) {
        var d = doc.data();
        d.id = doc.id;
        d.proveedorId = doc.ref.parent.parent.id;
        return d;
      });
    });
  }

  function allBloquesQuery() {
    return db.collectionGroup('bloques').get().then(function (snap) {
      return snap.docs.map(function (doc) {
        var d = doc.data();
        d.id = doc.id;
        d.proveedorId = doc.ref.parent.parent.id;
        return d;
      });
    });
  }
```

- [x] **Step 3: Expose new APIs on BNK_DB**

In the `window.BNK_DB` object (line 121), add after `cotizacionProveedores`:

```js
    bloques:               bloquesAPI,
    allServicios:          allServiciosQuery,
    allBloques:            allBloquesQuery,
```

Note: `bloques` is a function (not an object) — called as `BNK_DB.bloques(proveedorId).list()`.

- [x] **Step 4: Add Firestore rules for bloques subcollection and collection group**

In `firestore.rules`, inside the `match /proveedores/{docId}` block (after the `servicios` rule at line 55), add:

```
      match /bloques/{bloqueId} {
        allow read: if isAuthenticated();
        allow create, update, delete: if isAdminOrVentas();
      }
```

Also add collection group rules at the end (before the closing `}}`) for cross-provider queries:

```
    // Collection group queries para servicios y bloques
    match /{path=**}/servicios/{srvId} {
      allow read: if isAuthenticated();
    }

    match /{path=**}/bloques/{bloqueId} {
      allow read: if isAuthenticated();
    }
```

- [x] **Step 5: Commit**

```bash
git add panel/js/firestore.js firestore.rules
git commit -m "feat(firestore): add bloques subcollection API and collection group queries for servicios/bloques"
```

---

## Task 2: Proveedores — Doble Precio + Bloques UI en Tab Servicios

**Files:**
- Modify: `panel/js/pages/proveedores.js` (Tab 5 servicios section, ~lines 660–835)
- Modify: `panel/dashboard.html` (servicios tab markup)

**Interfaces:**
- Consumes: `BNK_DB.bloques(proveedorId)` from Task 1
- Consumes: `_serviciosRef(proveedorId)` (existing in proveedores.js)
- Produces: Services saved with new fields `precioCliente` and `bloqueId`
- Produces: Bloques saved in `proveedores/{id}/bloques/` with `nombre`, `precioManual`, `usaPrecioManual`, `orden`

- [x] **Step 1: Add `precioCliente` column to service table rendering**

In `proveedores.js`, find `loadServicios` function (renders service rows). Each service row currently has 5 columns: Categoría, Servicio, Unidad, Costo Unitario, Acciones.

In the row rendering loop (around line 690), update the `html` string to add a "Precio Cliente" column after "Costo Unitario":

```js
      + '<td>' + _escapeHTML(_formatMXN(Number(srv.costoUnitario) || 0)) + '</td>'
      + '<td>' + _escapeHTML(_formatMXN(Number(srv.precioCliente) || 0)) + '</td>'
```

In `dashboard.html`, find the servicios table header inside the proveedor modal (Tab 5). Add `<th>Precio Cliente</th>` after the "Costo Unitario" header.

- [x] **Step 2: Add `precioCliente` field to new/edit service forms**

In `_agregarFilaServicio()` (line 709), add a new input column after the cost input:

```js
      + '<td><input type="text" class="bnk-input srv-in-pcliente" placeholder="0.00"></td>'
```

In `_guardarNuevoServicio()` (line 738), read the new field:

```js
    var precioCliente = tr.querySelector('.srv-in-pcliente').value.trim();
```

Add `precioCliente: precioCliente` to the `data` object (line 754).

In `_guardarEdicionServicio()` (line 802), do the same: read `srv-in-pcliente` and add to `data`.

In `_editarFilaServicio()` (line 777), read the existing value from column index 4 (the new column) and populate the edit input.

- [x] **Step 3: Add bloques state and loading**

At the top of the IIFE (near line 12), add:

```js
  var _bloques = [];
  var _serviciosPorBloque = {};
```

Add a function to load bloques:

```js
  function _loadBloques(proveedorId) {
    return BNK_DB.bloques(proveedorId).list().then(function (bloques) {
      _bloques = bloques;
      return bloques;
    });
  }
```

Modify `loadServicios()` to also load bloques and group services by `bloqueId`:

```js
  function loadServicios(proveedorId) {
    _proveedorActivoId = proveedorId;
    var srvBody = _getEl('prvServiciosBody');
    if (!srvBody) return;

    Promise.all([
      _serviciosRef(proveedorId).orderBy('categoria', 'asc').get(),
      _loadBloques(proveedorId)
    ]).then(function (results) {
      var snap = results[0];
      var servicios = snap.docs.map(function (doc) {
        var d = doc.data(); d.id = doc.id; return d;
      });

      // Separate into block services and loose services
      var sueltos = [];
      _serviciosPorBloque = {};
      servicios.forEach(function (srv) {
        if (srv.bloqueId) {
          if (!_serviciosPorBloque[srv.bloqueId]) _serviciosPorBloque[srv.bloqueId] = [];
          _serviciosPorBloque[srv.bloqueId].push(srv);
        } else {
          sueltos.push(srv);
        }
      });

      _renderServiciosConBloques(sueltos);
    });
  }
```

- [x] **Step 4: Render bloques as collapsible sections**

Add function `_renderServiciosConBloques(sueltos)`:

```js
  function _renderServiciosConBloques(sueltos) {
    var srvBody = _getEl('prvServiciosBody');
    if (!srvBody) return;

    var html = '';

    // Render each bloque as collapsible section
    _bloques.forEach(function (bloque) {
      var bloqueSrvs = _serviciosPorBloque[bloque.id] || [];
      var subtotal = 0;
      bloqueSrvs.forEach(function (s) { subtotal += Number(s.costoUnitario) || 0; });

      html += '<tr class="srv-bloque-header" data-bloque-id="' + _escapeHTML(bloque.id) + '">'
        + '<td colspan="3">'
        +   '<span class="srv-bloque-toggle">&#9660;</span> '
        +   '<strong>' + _escapeHTML(bloque.nombre) + '</strong>'
        + '</td>'
        + '<td>' + _formatMXN(bloque.usaPrecioManual ? bloque.precioManual : subtotal) + '</td>'
        + '<td>'
        +   '<label class="srv-bloque-precio-toggle">'
        +     '<input type="checkbox" class="srv-bloque-manual-chk" data-bloque-id="' + _escapeHTML(bloque.id) + '"'
        +       (bloque.usaPrecioManual ? ' checked' : '') + '> Precio especial'
        +   '</label>'
        + '</td>'
        + '<td>'
        +   '<button class="tbl-action srv-bloque-add-btn" data-bloque-id="' + _escapeHTML(bloque.id) + '" title="Agregar servicio al bloque">+</button>'
        +   '<button class="tbl-action tbl-action--del srv-bloque-del-btn" data-bloque-id="' + _escapeHTML(bloque.id) + '" title="Eliminar bloque">&times;</button>'
        + '</td>'
        + '</tr>';

      // Price manual input row (hidden unless toggled)
      if (bloque.usaPrecioManual) {
        html += '<tr class="srv-bloque-precio-row" data-bloque-id="' + _escapeHTML(bloque.id) + '">'
          + '<td colspan="6">'
          +   'Precio manual: <input type="number" class="bnk-input srv-bloque-precio-input" data-bloque-id="' + _escapeHTML(bloque.id) + '" value="' + (bloque.precioManual || 0) + '">'
          +   ' <button class="tbl-action tbl-action--edit srv-bloque-precio-save" data-bloque-id="' + _escapeHTML(bloque.id) + '">&#10003;</button>'
          + '</td></tr>';
      }

      // Render services inside this block
      bloqueSrvs.forEach(function (srv) {
        html += _renderServicioRow(srv);
      });
    });

    // Render loose services (no bloqueId)
    if (sueltos.length > 0 && _bloques.length > 0) {
      html += '<tr class="srv-section-header"><td colspan="6"><strong>Servicios individuales</strong></td></tr>';
    }
    sueltos.forEach(function (srv) {
      html += _renderServicioRow(srv);
    });

    if (!html) {
      _mostrarServiciosEmpty(true);
    } else {
      _mostrarServiciosEmpty(false);
      srvBody.innerHTML = html;
    }
  }

  function _renderServicioRow(srv) {
    var idSafe = _escapeHTML(srv.id);
    return '<tr data-srv-id="' + idSafe + '">'
      + '<td>' + _escapeHTML(srv.categoria || '') + '</td>'
      + '<td>' + _escapeHTML(srv.servicio || '') + '</td>'
      + '<td>' + _escapeHTML(srv.unidad || '') + '</td>'
      + '<td>' + _formatMXN(Number(srv.costoUnitario) || 0) + '</td>'
      + '<td>' + _formatMXN(Number(srv.precioCliente) || 0) + '</td>'
      + '<td>'
      +   '<button class="tbl-action tbl-action--edit srv-edit-btn" data-srv-id="' + idSafe + '" title="Editar">&#9998;</button>'
      +   '<button class="tbl-action tbl-action--del srv-del-btn" data-srv-id="' + idSafe + '" title="Eliminar">&times;</button>'
      + '</td></tr>';
  }
```

- [x] **Step 5: Add "Agregar bloque" button and event handlers**

In `dashboard.html`, after the `#prvAddServicio` button, add:

```html
<button id="prvAddBloque" class="bnk-btn bnk-btn--outline" style="margin-left:8px">+ Agregar Bloque</button>
```

In `_setupServiciosAcciones()` (line 971), add handlers for the new buttons:

```js
      // Botón "+ Agregar Bloque"
      if (e.target.id === 'prvAddBloque' || e.target.closest('#prvAddBloque')) {
        _crearBloque();
        return;
      }

      // Bloque actions
      var bloqueBtn = e.target.closest('.srv-bloque-add-btn');
      if (bloqueBtn) {
        _agregarFilaServicio(bloqueBtn.getAttribute('data-bloque-id'));
        return;
      }

      var bloqueDelBtn = e.target.closest('.srv-bloque-del-btn');
      if (bloqueDelBtn) {
        _eliminarBloque(bloqueDelBtn.getAttribute('data-bloque-id'));
        return;
      }

      var bloquePrecioSave = e.target.closest('.srv-bloque-precio-save');
      if (bloquePrecioSave) {
        _guardarPrecioManualBloque(bloquePrecioSave.getAttribute('data-bloque-id'));
        return;
      }

      var bloqueManualChk = e.target.closest('.srv-bloque-manual-chk');
      if (bloqueManualChk) {
        _togglePrecioManualBloque(bloqueManualChk.getAttribute('data-bloque-id'), bloqueManualChk.checked);
        return;
      }
```

- [x] **Step 6: Implement bloque CRUD functions**

```js
  function _crearBloque() {
    var proveedorId = _getVal('prvId').trim();
    if (!proveedorId) { BNKToast.warn('Guarda el proveedor primero.'); return; }

    var nombre = prompt('Nombre del bloque:');
    if (!nombre || !nombre.trim()) return;

    var orden = _bloques.length + 1;
    BNK_DB.bloques(proveedorId).create({
      nombre: nombre.trim(),
      precioManual: 0,
      usaPrecioManual: false,
      orden: orden
    }).then(function () {
      BNKToast.ok('Bloque creado.');
      loadServicios(proveedorId);
    }).catch(function (err) {
      BNKToast.error('Error al crear bloque: ' + err.message);
    });
  }

  function _eliminarBloque(bloqueId) {
    BNKConfirm.show('¿Eliminar este bloque y desvincular sus servicios?')
      .then(function (ok) {
        if (!ok) return;
        var proveedorId = _getVal('prvId').trim() || _proveedorActivoId;
        if (!proveedorId) return;

        // Unlink services from block
        var srvs = _serviciosPorBloque[bloqueId] || [];
        var batch = BNK_FIREBASE.db.batch();
        srvs.forEach(function (srv) {
          var ref = BNK_FIREBASE.db.collection('proveedores').doc(proveedorId)
            .collection('servicios').doc(srv.id);
          batch.update(ref, { bloqueId: firebase.firestore.FieldValue.delete() });
        });
        batch.commit().then(function () {
          return BNK_DB.bloques(proveedorId).delete(bloqueId);
        }).then(function () {
          BNKToast.ok('Bloque eliminado.');
          loadServicios(proveedorId);
        }).catch(function (err) {
          BNKToast.error('Error: ' + err.message);
        });
      });
  }

  function _togglePrecioManualBloque(bloqueId, checked) {
    var proveedorId = _getVal('prvId').trim() || _proveedorActivoId;
    if (!proveedorId) return;
    BNK_DB.bloques(proveedorId).update(bloqueId, { usaPrecioManual: checked })
      .then(function () { loadServicios(proveedorId); });
  }

  function _guardarPrecioManualBloque(bloqueId) {
    var input = document.querySelector('.srv-bloque-precio-input[data-bloque-id="' + bloqueId + '"]');
    if (!input) return;
    var proveedorId = _getVal('prvId').trim() || _proveedorActivoId;
    if (!proveedorId) return;
    BNK_DB.bloques(proveedorId).update(bloqueId, { precioManual: Number(input.value) || 0 })
      .then(function () {
        BNKToast.ok('Precio actualizado.');
        loadServicios(proveedorId);
      });
  }
```

- [x] **Step 7: Update `_agregarFilaServicio` to accept optional bloqueId**

Modify `_agregarFilaServicio` signature and `_guardarNuevoServicio` to include `bloqueId`:

```js
  function _agregarFilaServicio(bloqueId) {
    // ... existing code ...
    tr.setAttribute('data-new', '1');
    if (bloqueId) tr.setAttribute('data-bloque-id', bloqueId);
    // ... rest of existing row creation, add precioCliente input ...
  }

  function _guardarNuevoServicio(tr) {
    // ... existing reads ...
    var precioCliente = tr.querySelector('.srv-in-pcliente').value.trim();
    var bloqueId = tr.getAttribute('data-bloque-id') || null;

    var data = {
      proveedorId:   proveedorId,
      categoria:     categoria,
      servicio:      servicio,
      unidad:        unidad,
      costoUnitario: costoUnitario,
      precioCliente: precioCliente,
      createdAt:     firebase.firestore.FieldValue.serverTimestamp()
    };
    if (bloqueId) data.bloqueId = bloqueId;
    // ... rest of save logic ...
  }
```

- [x] **Step 8: Add CSS for bloque rows**

In `panel/css/panel.css`, add:

```css
.srv-bloque-header { background: var(--card); border-left: 3px solid var(--accent); }
.srv-bloque-header td { padding: 8px 10px; }
.srv-bloque-toggle { cursor: pointer; font-size: 10px; }
.srv-bloque-precio-toggle { font-size: 11px; display: flex; align-items: center; gap: 4px; }
.srv-bloque-precio-row td { padding: 6px 10px; background: var(--bg2); }
.srv-bloque-precio-input { width: 120px; display: inline-block; }
.srv-section-header td { padding: 8px 10px; border-top: 1px solid var(--bd); }
```

- [x] **Step 9: Commit**

```bash
git add panel/js/pages/proveedores.js panel/dashboard.html panel/css/panel.css
git commit -m "feat(proveedores): add dual pricing (costoProveedor + precioCliente) and category blocks in services tab"
```

---

## Task 3: Cotizador BNK — Input Dual (Manual + Proveedor)

**Files:**
- Modify: `panel/js/pages/cotizar-bnk.js` (lines 1–610)
- Modify: `panel/dashboard.html` (BNK form markup)

**Interfaces:**
- Consumes: `BNK_DB.allServicios()` from Task 1
- Consumes: `BNK_DB.allBloques()` from Task 1
- Consumes: `BNK_DB.proveedores.list()` (existing)
- Produces: Enhanced `conceptos` array with fields: `modo`, `proveedorId`, `proveedorNombre`, `costoProveedor`, `bloqueId`, `bloqueNombre` (in addition to existing fields)
- Produces: `firestoreData` with enhanced `conceptos` JSON

- [x] **Step 1: Load provider data on init**

In `cotizar-bnk.js`, add state variables at the top (after line 8):

```js
  var _proveedores = [];
  var _allServicios = [];
  var _allBloques = [];
  var _serviciosCategorias = [];
```

Modify `init()` (line 18) to also load provider data:

```js
  function init() {
    Promise.all([
      BNK_DB.clientes.list(),
      BNK_DB.catalogo.list(),
      BNK_DB.proveedores.list(),
      BNK_DB.allServicios(),
      BNK_DB.allBloques()
    ]).then(function (results) {
      _clientes = results[0];
      _catalogo = results[1].filter(function (c) { return c.categoria !== 'Venues' && c.activo !== false; });
      _proveedores = results[2];
      _allServicios = results[3];
      _allBloques = results[4];

      // Extract unique service categories from providers
      var catSet = {};
      _allServicios.forEach(function (s) { if (s.categoria) catSet[s.categoria] = true; });
      _serviciosCategorias = Object.keys(catSet).sort();

      _bindEvents();
      _setCondiciones('estandar');
      _agregarFila();
      _restoreBnkDraft();
      BNK_DRAFT_FIELDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', _saveBnkDraft);
      });
    });
  }
```

- [x] **Step 2: Redesign `_agregarFila()` with mode toggle**

Replace `_agregarFila()` (line 188) with dual-mode version:

```js
  function _agregarFila() {
    var body = document.getElementById('bnkConceptosBody');
    if (!body) return;
    var id = 'bc' + (_conceptoCounter++);

    var catOptions = '<option value="">—</option>';
    CATEGORIAS.forEach(function (cat) {
      catOptions += '<option value="' + cat + '">' + cat + '</option>';
    });

    var prvCatOptions = '<option value="">— Tipo servicio —</option>';
    _serviciosCategorias.forEach(function (cat) {
      prvCatOptions += '<option value="' + _esc(cat) + '">' + _esc(cat) + '</option>';
    });

    var row = document.createElement('div');
    row.className = 'bnk-concepto-row';
    row.id = id;
    row.setAttribute('data-modo', 'manual');

    row.innerHTML =
      '<button class="bnk-modo-toggle" data-row="' + id + '" title="Cambiar modo">&#9881;</button>'
      // Manual mode fields
      + '<div class="bnk-modo-manual">'
      +   '<select class="bnk-cat" data-row="' + id + '" data-label="Categoría">' + catOptions + '</select>'
      +   '<input type="text" class="bnk-con" data-row="' + id + '" data-label="Concepto" placeholder="Buscar concepto..." list="dl-' + id + '"><datalist id="dl-' + id + '"></datalist>'
      + '</div>'
      // Provider mode fields
      + '<div class="bnk-modo-proveedor" style="display:none">'
      +   '<select class="bnk-prv-cat" data-row="' + id + '">' + prvCatOptions + '</select>'
      +   '<select class="bnk-prv-prov" data-row="' + id + '"><option value="">— Proveedor —</option></select>'
      +   '<select class="bnk-prv-srv" data-row="' + id + '"><option value="">— Servicio —</option></select>'
      + '</div>'
      // Shared fields
      + '<input type="number" class="bnk-cant" data-row="' + id + '" data-label="Cant." value="1" min="1" step="1">'
      + '<input type="text" class="bnk-uni" data-row="' + id + '" data-label="Unidad" value="servicio" placeholder="unidad">'
      + '<input type="number" class="bnk-pre" data-row="' + id + '" data-label="Precio" value="0" min="0" step="0.01">'
      + '<input type="hidden" class="bnk-costo-prov" data-row="' + id + '" value="0">'
      + '<input type="hidden" class="bnk-prov-id" data-row="' + id + '" value="">'
      + '<input type="hidden" class="bnk-prov-nombre" data-row="' + id + '" value="">'
      + '<input type="hidden" class="bnk-bloque-id" data-row="' + id + '" value="">'
      + '<input type="hidden" class="bnk-bloque-nombre" data-row="' + id + '" value="">'
      + '<span class="bnk-sub-val" data-row="' + id + '" data-label="Subtotal">$0</span>'
      + '<button class="bnk-del-btn" data-row="' + id + '">&times;</button>';
    body.appendChild(row);

    // Mode toggle
    row.querySelector('.bnk-modo-toggle').addEventListener('click', function () {
      _toggleModo(id);
    });

    // Manual mode events (existing)
    row.querySelector('.bnk-cat').addEventListener('change', function () { _actualizarDatalist(id); });
    row.querySelector('.bnk-con').addEventListener('change', function () { _autocompletarPrecio(id); });

    // Provider mode cascade events
    row.querySelector('.bnk-prv-cat').addEventListener('change', function () { _actualizarProveedores(id); });
    row.querySelector('.bnk-prv-prov').addEventListener('change', function () { _actualizarServiciosProv(id); });
    row.querySelector('.bnk-prv-srv').addEventListener('change', function () { _autocompletarPrecioProv(id); });

    // Shared events
    row.querySelector('.bnk-cant').addEventListener('input', function () { _recalcularFila(id); });
    row.querySelector('.bnk-pre').addEventListener('input', function () { _recalcularFila(id); });
    row.querySelector('.bnk-del-btn').addEventListener('click', function () {
      row.remove();
      _recalcularTotales();
      var remaining = document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row');
      if (remaining.length === 0) _agregarFila();
    });
  }
```

- [x] **Step 3: Implement mode toggle and provider cascade functions**

```js
  function _toggleModo(rowId) {
    var row = document.getElementById(rowId);
    var modo = row.getAttribute('data-modo');
    var newModo = modo === 'manual' ? 'proveedor' : 'manual';
    row.setAttribute('data-modo', newModo);

    var manualDiv = row.querySelector('.bnk-modo-manual');
    var provDiv = row.querySelector('.bnk-modo-proveedor');
    manualDiv.style.display = newModo === 'manual' ? '' : 'none';
    provDiv.style.display = newModo === 'proveedor' ? '' : 'none';

    // Reset hidden fields
    row.querySelector('.bnk-costo-prov').value = '0';
    row.querySelector('.bnk-prov-id').value = '';
    row.querySelector('.bnk-prov-nombre').value = '';
    row.querySelector('.bnk-bloque-id').value = '';
    row.querySelector('.bnk-bloque-nombre').value = '';
  }

  function _actualizarProveedores(rowId) {
    var row = document.getElementById(rowId);
    var catSel = row.querySelector('.bnk-prv-cat').value;
    var provSel = row.querySelector('.bnk-prv-prov');

    // Filter providers that have services in this category
    var provIds = {};
    _allServicios.forEach(function (s) {
      if (s.categoria === catSel) provIds[s.proveedorId] = true;
    });

    var html = '<option value="">— Proveedor —</option>';
    _proveedores.forEach(function (p) {
      if (provIds[p.id]) {
        html += '<option value="' + _esc(p.id) + '">' + _esc(p.razonSocial || p.nombreComercial || p.id) + '</option>';
      }
    });
    provSel.innerHTML = html;

    // Reset service select
    row.querySelector('.bnk-prv-srv').innerHTML = '<option value="">— Servicio —</option>';
  }

  function _actualizarServiciosProv(rowId) {
    var row = document.getElementById(rowId);
    var catSel = row.querySelector('.bnk-prv-cat').value;
    var provId = row.querySelector('.bnk-prv-prov').value;
    var srvSel = row.querySelector('.bnk-prv-srv');

    var html = '<option value="">— Servicio —</option>';

    // Add bloques for this provider+category
    _allBloques.forEach(function (b) {
      if (b.proveedorId === provId) {
        // Check if block has services in this category
        var hasCategory = _allServicios.some(function (s) {
          return s.bloqueId === b.id && s.categoria === catSel;
        });
        if (hasCategory) {
          html += '<option value="bloque:' + _esc(b.id) + '" data-tipo="bloque">'
            + '📦 ' + _esc(b.nombre) + '</option>';
        }
      }
    });

    // Add individual services
    _allServicios.forEach(function (s) {
      if (s.proveedorId === provId && s.categoria === catSel && !s.bloqueId) {
        html += '<option value="srv:' + _esc(s.id) + '" data-precio="' + (s.precioCliente || 0)
          + '" data-costo="' + (s.costoUnitario || 0)
          + '" data-unidad="' + _esc(s.unidad || 'servicio') + '">'
          + _esc(s.servicio) + '</option>';
      }
    });

    srvSel.innerHTML = html;
  }

  function _autocompletarPrecioProv(rowId) {
    var row = document.getElementById(rowId);
    var srvSel = row.querySelector('.bnk-prv-srv');
    var val = srvSel.value;
    var provId = row.querySelector('.bnk-prv-prov').value;
    var provNombre = '';
    var opt = srvSel.options[srvSel.selectedIndex];

    // Find provider name
    _proveedores.forEach(function (p) {
      if (p.id === provId) provNombre = p.razonSocial || p.nombreComercial || '';
    });
    row.querySelector('.bnk-prov-id').value = provId;
    row.querySelector('.bnk-prov-nombre').value = provNombre;

    if (val.indexOf('bloque:') === 0) {
      var bloqueId = val.replace('bloque:', '');
      _expandBloque(rowId, bloqueId, provId, provNombre);
    } else if (val.indexOf('srv:') === 0) {
      // Individual service
      var precio = parseFloat(opt.getAttribute('data-precio')) || 0;
      var costo = parseFloat(opt.getAttribute('data-costo')) || 0;
      var unidad = opt.getAttribute('data-unidad') || 'servicio';
      row.querySelector('.bnk-pre').value = precio;
      row.querySelector('.bnk-uni').value = unidad;
      row.querySelector('.bnk-costo-prov').value = costo;
      row.querySelector('.bnk-bloque-id').value = '';
      row.querySelector('.bnk-bloque-nombre').value = '';
      _recalcularFila(rowId);
    }
  }

  function _expandBloque(rowId, bloqueId, provId, provNombre) {
    var row = document.getElementById(rowId);
    var body = document.getElementById('bnkConceptosBody');

    // Find bloque
    var bloque = null;
    _allBloques.forEach(function (b) { if (b.id === bloqueId) bloque = b; });
    if (!bloque) return;

    // Find services in this block
    var srvs = _allServicios.filter(function (s) {
      return s.bloqueId === bloqueId && s.proveedorId === provId;
    });

    // Replace current row with block services
    row.remove();

    srvs.forEach(function (srv) {
      var id = 'bc' + (_conceptoCounter++);
      var newRow = document.createElement('div');
      newRow.className = 'bnk-concepto-row bnk-bloque-child';
      newRow.id = id;
      newRow.setAttribute('data-modo', 'proveedor');
      newRow.innerHTML =
        '<span class="bnk-bloque-badge">' + _esc(bloque.nombre) + '</span>'
        + '<div class="bnk-modo-manual" style="display:none"></div>'
        + '<div class="bnk-modo-proveedor" style="display:none">'
        +   '<span class="bnk-prv-label">' + _esc(srv.servicio) + '</span>'
        + '</div>'
        + '<input type="number" class="bnk-cant" value="1" min="1" step="1">'
        + '<input type="text" class="bnk-uni" value="' + _esc(srv.unidad || 'servicio') + '">'
        + '<input type="number" class="bnk-pre" value="' + (srv.precioCliente || 0) + '" min="0" step="0.01">'
        + '<input type="hidden" class="bnk-costo-prov" value="' + (srv.costoUnitario || 0) + '">'
        + '<input type="hidden" class="bnk-prov-id" value="' + _esc(provId) + '">'
        + '<input type="hidden" class="bnk-prov-nombre" value="' + _esc(provNombre) + '">'
        + '<input type="hidden" class="bnk-bloque-id" value="' + _esc(bloqueId) + '">'
        + '<input type="hidden" class="bnk-bloque-nombre" value="' + _esc(bloque.nombre) + '">'
        + '<input type="hidden" class="bnk-con" value="' + _esc(srv.servicio) + '">'
        + '<input type="hidden" class="bnk-cat" value="' + _esc(srv.categoria || '') + '">'
        + '<span class="bnk-sub-val">$0</span>'
        + '<button class="bnk-del-btn">&times;</button>';
      body.appendChild(newRow);

      newRow.querySelector('.bnk-cant').addEventListener('input', function () { _recalcularFila(id); });
      newRow.querySelector('.bnk-pre').addEventListener('input', function () { _recalcularFila(id); });
      newRow.querySelector('.bnk-del-btn').addEventListener('click', function () {
        newRow.remove(); _recalcularTotales();
      });
      _recalcularFila(id);
    });

    _recalcularTotales();
    // Add a new empty row after expansion
    _agregarFila();
  }
```

- [x] **Step 4: Update `_recopilarConceptos()` to capture provider data**

Replace `_recopilarConceptos()` (line 301):

```js
  function _recopilarConceptos() {
    var rows = document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row');
    var conceptos = [];
    rows.forEach(function (row) {
      var con = (row.querySelector('.bnk-con') || {}).value;
      if (!con) return;
      con = con.trim();
      var cant = parseFloat((row.querySelector('.bnk-cant') || {}).value) || 0;
      if (!con || cant <= 0) return;

      var modo = row.getAttribute('data-modo') || 'manual';
      var precio = parseFloat((row.querySelector('.bnk-pre') || {}).value) || 0;

      var concepto = {
        modo: modo,
        categoria: (row.querySelector('.bnk-cat') || {}).value || 'Otro',
        concepto: con,
        cantidad: cant,
        unidad: (row.querySelector('.bnk-uni') || {}).value || 'servicio',
        precioUnit: precio,
        subtotal: cant * precio
      };

      if (modo === 'proveedor') {
        concepto.costoProveedor = parseFloat((row.querySelector('.bnk-costo-prov') || {}).value) || 0;
        concepto.proveedorId = (row.querySelector('.bnk-prov-id') || {}).value || '';
        concepto.proveedorNombre = (row.querySelector('.bnk-prov-nombre') || {}).value || '';
        concepto.bloqueId = (row.querySelector('.bnk-bloque-id') || {}).value || '';
        concepto.bloqueNombre = (row.querySelector('.bnk-bloque-nombre') || {}).value || '';
      }

      conceptos.push(concepto);
    });
    return conceptos;
  }
```

- [x] **Step 5: Add CSS for dual mode rows**

In `panel/css/panel.css`, add:

```css
.bnk-modo-toggle { background:none; border:1px solid var(--bd); color:var(--tx2); width:28px; height:28px; border-radius:4px; cursor:pointer; flex-shrink:0; font-size:14px; }
.bnk-modo-toggle:hover { border-color:var(--accent); color:var(--accent); }
.bnk-modo-proveedor { display:flex; gap:6px; flex:1; }
.bnk-modo-proveedor select { flex:1; min-width:0; }
.bnk-bloque-badge { font-size:10px; background:var(--accent); color:var(--bg); padding:2px 6px; border-radius:3px; white-space:nowrap; align-self:center; }
.bnk-bloque-child { border-left:3px solid var(--accent); }
.bnk-prv-label { font-size:12px; color:var(--tx); align-self:center; }
```

- [x] **Step 6: Commit**

```bash
git add panel/js/pages/cotizar-bnk.js panel/dashboard.html panel/css/panel.css
git commit -m "feat(cotizar-bnk): add dual input mode — manual or provider catalog with cascading selects"
```

---

## Task 4: Cotizador BNK — Auto-vinculación de Proveedores al Guardar

**Files:**
- Modify: `panel/js/pages/cotizar-bnk.js` (function `_enviar`, ~line 508)

**Interfaces:**
- Consumes: `_recopilarConceptos()` output with `modo`, `proveedorId`, `costoProveedor` fields (Task 3)
- Consumes: `BNK_DB.cotizacionProveedores.create()` (existing)
- Produces: Auto-created `cotizacionProveedores` records with `autoVinculado: true`

- [x] **Step 1: Add auto-linking function**

After `_enviar()`, add:

```js
  function _autoVincularProveedores(cotizacionId, folio, conceptos) {
    // Group by proveedorId
    var provMap = {};
    conceptos.forEach(function (c) {
      if (c.modo !== 'proveedor' || !c.proveedorId) return;
      if (!provMap[c.proveedorId]) {
        provMap[c.proveedorId] = {
          proveedorId: c.proveedorId,
          proveedorNombre: c.proveedorNombre,
          montoTotal: 0,
          servicios: []
        };
      }
      provMap[c.proveedorId].montoTotal += (c.costoProveedor || 0) * (c.cantidad || 1);
      provMap[c.proveedorId].servicios.push(c.concepto + ' x' + c.cantidad);
    });

    var promises = [];
    Object.keys(provMap).forEach(function (provId) {
      var p = provMap[provId];
      promises.push(BNK_DB.cotizacionProveedores.create({
        cotizacionId: cotizacionId,
        cotizacionFolio: folio,
        proveedorId: p.proveedorId,
        proveedorNombre: p.proveedorNombre,
        montoTotal: p.montoTotal,
        servicios: p.servicios,
        autoVinculado: true
      }));
    });

    return Promise.all(promises);
  }
```

- [x] **Step 2: Call auto-linking from `_enviar()` after save**

In `_enviar()`, modify the `.then()` after `BNK_DB.cotizaciones.create(firestoreData)` (line 580):

```js
    BNK_DB.cotizaciones.create(firestoreData).then(function (saved) {
      // Auto-link providers
      var conceptos = JSON.parse(firestoreData.conceptos);
      return _autoVincularProveedores(saved.id, folio, conceptos).then(function () {
        doc.save('Cotizacion-BNK-' + folio + '.pdf');
        BNKToast.ok('Cotización ' + folio + ' generada.');
        _limpiar();
        // Reload finanzas if available
        if (window.BNKFinanzas && BNKFinanzas.reload) BNKFinanzas.reload();
      });
    }).catch(function (err) {
      // ... existing error handling ...
    });
```

- [x] **Step 3: Commit**

```bash
git add panel/js/pages/cotizar-bnk.js
git commit -m "feat(cotizar-bnk): auto-link providers to cotizacionProveedores on save with cost totals"
```

---

## Task 5: PDF BNK — Bloques Agrupados

**Files:**
- Modify: `panel/js/pdf-rebuild.js` (rebuildBNK function)
- Modify: `panel/js/pages/cotizar-bnk.js` (`_generarPDF` function, ~line 354)

**Interfaces:**
- Consumes: `conceptos` array with optional `bloqueNombre` field
- Produces: PDF with block grouping headers

- [x] **Step 1: Update `_generarPDF` in cotizar-bnk.js to handle blocks**

In the PDF section that groups by category (line 428–445), add block sub-grouping:

Replace the inner loop that renders concepts per category:

```js
    Object.keys(grupos).forEach(function (cat) {
      drawSection(cat.toUpperCase());

      // Sub-group by bloque within category
      var bloquesEnCat = {};
      var sinBloque = [];
      grupos[cat].forEach(function (c) {
        if (c.bloqueNombre) {
          if (!bloquesEnCat[c.bloqueNombre]) bloquesEnCat[c.bloqueNombre] = [];
          bloquesEnCat[c.bloqueNombre].push(c);
        } else {
          sinBloque.push(c);
        }
      });

      // Render block groups
      Object.keys(bloquesEnCat).forEach(function (bName) {
        checkPage(10);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text('▸ ' + bName, margin + 2, y + 4);
        doc.setFont('helvetica', 'normal'); y += 6;

        bloquesEnCat[bName].forEach(function (c) {
          checkPage(7);
          doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
          doc.text('  ' + c.concepto, margin + 6, y + 4);
          doc.text(String(c.cantidad) + ' ' + c.unidad, margin + 100, y + 4);
          doc.text(_formatMXN(c.precioUnit), W - margin - 35, y + 4);
          doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
          doc.text(_formatMXN(c.subtotal), W - margin - 4, y + 4, { align: 'right' });
          y += 7;
        });
      });

      // Render loose concepts
      sinBloque.forEach(function (c) {
        checkPage(7);
        doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
        doc.text(c.concepto, margin + 4, y + 4);
        doc.text(String(c.cantidad) + ' ' + c.unidad, margin + 100, y + 4);
        doc.text(_formatMXN(c.precioUnit), W - margin - 35, y + 4);
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text(_formatMXN(c.subtotal), W - margin - 4, y + 4, { align: 'right' });
        y += 7;
      });
    });
```

- [x] **Step 2: Apply same block grouping logic in pdf-rebuild.js**

In `pdf-rebuild.js`, find the `rebuildBNK` function's category rendering loop and apply the same block sub-grouping pattern from Step 1.

- [x] **Step 3: Commit**

```bash
git add panel/js/pages/cotizar-bnk.js panel/js/pdf-rebuild.js
git commit -m "feat(pdf): group block services under block headers in BNK PDF output"
```

---

## Task 6: Vincular Cliente a Cotización

**Files:**
- Modify: `panel/js/pages/cotizaciones.js` (~lines 403–540 popover, 616–810 vinc modals)
- Modify: `panel/js/pages/clientes.js` (~lines 452–477 modal cotizaciones)
- Modify: `panel/dashboard.html` (popover markup)
- Modify: `panel/css/panel.css`

**Interfaces:**
- Consumes: `BNK_DB.clientes.list()` (existing)
- Consumes: `BNK_DB.cotizaciones.update(id, { clienteId, clienteNombre })` (existing)
- Produces: Cotizaciones with new `clienteId` and `clienteNombre` fields

- [x] **Step 1: Add "Vincular cliente" button to popover**

In `cotizaciones.js`, in `_bindPopover()` (line 403), add a handler for the new button after the proveedor binding (line 450):

```js
      var popVincCliente = pop.querySelector('#popVincCliente');
      if (popVincCliente) popVincCliente.addEventListener('click', function () {
        if (!_popCot) return;
        _openVincClienteModal(_popCot);
        _closePopover();
      });
```

In `dashboard.html`, find the popover buttons section and add:

```html
<button id="popVincCliente" class="pop-action-btn" title="Vincular cliente">👤 Cliente</button>
```

- [x] **Step 2: Show auto-match suggestion in popover**

In `_openPopover()` (line 458), after the existing partner/proveedor indicators (line 519), add client match detection:

```js
      // Client auto-match
      var clienteIndicator = pop.querySelector('#popClienteInfo');
      if (clienteIndicator) {
        var cotEmpresa = (cot.cliente || cot.empresa || '').toLowerCase().trim();
        var matchedCliente = null;
        if (cotEmpresa && _clientes) {
          for (var ci = 0; ci < _clientes.length; ci++) {
            var cliEmpresa = (_clientes[ci].empresa || _clientes[ci].razonSocial || '').toLowerCase().trim();
            if (cliEmpresa === cotEmpresa || cliEmpresa.indexOf(cotEmpresa) !== -1 || cotEmpresa.indexOf(cliEmpresa) !== -1) {
              matchedCliente = _clientes[ci]; break;
            }
          }
        }

        if (cot.clienteId) {
          clienteIndicator.innerHTML = '<span class="pop-badge pop-badge--ok">✓ Cliente vinculado</span>';
        } else if (matchedCliente) {
          clienteIndicator.innerHTML = '<span class="pop-badge pop-badge--warn">Sugerido: ' + _esc(matchedCliente.empresa || matchedCliente.razonSocial) + '</span>';
        } else {
          clienteIndicator.innerHTML = '<span class="pop-badge pop-badge--none">Sin cliente</span>';
        }
      }
```

In `dashboard.html` popover, add: `<div id="popClienteInfo"></div>`

- [x] **Step 3: Implement vincular cliente modal**

Add to `cotizaciones.js`:

```js
  function _openVincClienteModal(cot) {
    var overlay = document.getElementById('vincClienteOverlay');
    if (!overlay) return;
    overlay.classList.add('visible');
    overlay.querySelector('.vinc-folio-label').textContent = cot.folio;

    var searchInput = overlay.querySelector('#vincClienteSearch');
    var acDropdown = overlay.querySelector('#vincClienteAC');
    var resultDiv = overlay.querySelector('#vincClienteResult');
    searchInput.value = '';
    acDropdown.classList.remove('visible');

    // Auto-match suggestion
    var cotEmpresa = (cot.cliente || cot.empresa || '').toLowerCase().trim();
    var sugerido = null;
    _clientes.forEach(function (c) {
      var cliEmpresa = (c.empresa || c.razonSocial || '').toLowerCase().trim();
      if (cliEmpresa === cotEmpresa || cliEmpresa.indexOf(cotEmpresa) !== -1 || cotEmpresa.indexOf(cliEmpresa) !== -1) {
        sugerido = c;
      }
    });

    if (sugerido && !cot.clienteId) {
      resultDiv.innerHTML = '<div class="vinc-suggestion">'
        + '<span>Sugerido: <strong>' + _esc(sugerido.empresa || sugerido.razonSocial) + '</strong></span>'
        + '<button class="bnk-btn bnk-btn--sm" data-cliente-id="' + _esc(sugerido.id)
        + '" data-cliente-nombre="' + _esc(sugerido.empresa || sugerido.razonSocial) + '">Vincular</button>'
        + '</div>';
    } else if (cot.clienteId) {
      resultDiv.innerHTML = '<div class="vinc-linked">✓ Vinculado: <strong>' + _esc(cot.clienteNombre || '') + '</strong>'
        + ' <button class="bnk-btn bnk-btn--sm bnk-btn--danger" data-desvincular="1">Desvincular</button></div>';
    } else {
      resultDiv.innerHTML = '<p class="vinc-empty">Busca un cliente para vincular.</p>';
    }

    // Store current cot for actions
    overlay._cotId = cot.id;
    overlay._cotFolio = cot.folio;
  }
```

- [x] **Step 4: Add vincular cliente modal markup to dashboard.html**

```html
<!-- Modal Vincular Cliente -->
<div id="vincClienteOverlay" class="bnk-overlay">
  <div class="bnk-modal" style="max-width:450px">
    <div class="bnk-modal-header">
      <h3>Vincular Cliente — <span class="vinc-folio-label"></span></h3>
      <button class="bnk-close vinc-close">&times;</button>
    </div>
    <div class="bnk-modal-body">
      <div class="bnk-form-group" style="position:relative">
        <input id="vincClienteSearch" class="bnk-input" placeholder="Buscar cliente...">
        <div id="vincClienteAC" class="bnk-autocomplete"></div>
      </div>
      <div id="vincClienteResult"></div>
    </div>
  </div>
</div>
```

- [x] **Step 5: Add event handlers for cliente search, link, and unlink**

```js
  function _setupVincClienteModal() {
    var overlay = document.getElementById('vincClienteOverlay');
    if (!overlay) return;

    // Close
    overlay.querySelector('.vinc-close').addEventListener('click', function () {
      overlay.classList.remove('visible');
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.classList.remove('visible');
    });

    // Search autocomplete
    var searchInput = overlay.querySelector('#vincClienteSearch');
    var acDropdown = overlay.querySelector('#vincClienteAC');

    searchInput.addEventListener('input', function () {
      var val = searchInput.value.trim().toLowerCase();
      if (val.length < 2) { acDropdown.classList.remove('visible'); return; }
      var matches = _clientes.filter(function (c) {
        return ((c.empresa || c.razonSocial || '').toLowerCase().indexOf(val) !== -1);
      });
      var html = '';
      matches.slice(0, 8).forEach(function (c) {
        html += '<div class="bnk-ac-item" data-cliente-id="' + _esc(c.id)
          + '" data-cliente-nombre="' + _esc(c.empresa || c.razonSocial) + '">'
          + _esc(c.empresa || c.razonSocial) + '</div>';
      });
      acDropdown.innerHTML = html || '<div class="bnk-ac-item bnk-ac-new">Sin resultados</div>';
      acDropdown.classList.add('visible');
    });

    // Select from AC
    acDropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.bnk-ac-item');
      if (!item || item.classList.contains('bnk-ac-new')) return;
      var clienteId = item.getAttribute('data-cliente-id');
      var clienteNombre = item.getAttribute('data-cliente-nombre');
      _vincularCliente(overlay._cotId, clienteId, clienteNombre);
      acDropdown.classList.remove('visible');
    });

    // Link from suggestion / unlink
    overlay.querySelector('#vincClienteResult').addEventListener('click', function (e) {
      var linkBtn = e.target.closest('[data-cliente-id]');
      if (linkBtn) {
        _vincularCliente(overlay._cotId, linkBtn.getAttribute('data-cliente-id'), linkBtn.getAttribute('data-cliente-nombre'));
        return;
      }
      var unlinkBtn = e.target.closest('[data-desvincular]');
      if (unlinkBtn) {
        _desvincularCliente(overlay._cotId);
      }
    });
  }

  function _vincularCliente(cotId, clienteId, clienteNombre) {
    BNK_DB.cotizaciones.update(cotId, {
      clienteId: clienteId,
      clienteNombre: clienteNombre
    }).then(function () {
      BNKToast.ok('Cliente vinculado.');
      document.getElementById('vincClienteOverlay').classList.remove('visible');
      _loadData(); // reload table
    }).catch(function (err) {
      BNKToast.error('Error: ' + err.message);
    });
  }

  function _desvincularCliente(cotId) {
    BNKConfirm.show('¿Desvincular cliente de esta cotización?').then(function (ok) {
      if (!ok) return;
      BNK_DB.cotizaciones.update(cotId, {
        clienteId: firebase.firestore.FieldValue.delete(),
        clienteNombre: firebase.firestore.FieldValue.delete()
      }).then(function () {
        BNKToast.ok('Cliente desvinculado.');
        document.getElementById('vincClienteOverlay').classList.remove('visible');
        _loadData();
      });
    });
  }
```

Call `_setupVincClienteModal()` from the module's initialization.

- [x] **Step 6: Update clientes.js to show formal link badges**

In `clientes.js`, in `abrirModal()` (line 452), where cotizaciones are filtered and rendered, add `clienteId` check:

```js
      // After filtering cotizaciones by name match
      vinculadas.forEach(function (cot) {
        var esFormal = cot.clienteId === cliente.id;
        // Add badge to rendered HTML
        var badgeHtml = esFormal
          ? '<span class="badge badge--linked">Vinculada</span>'
          : '<span class="badge badge--fuzzy">Por nombre</span>';
        // ... include in row rendering ...
      });
```

Also add a "Vincular" button for fuzzy-matched cotizaciones that lack `clienteId`.

- [x] **Step 7: Commit**

```bash
git add panel/js/pages/cotizaciones.js panel/js/pages/clientes.js panel/dashboard.html panel/css/panel.css
git commit -m "feat(cotizaciones): add client linking via popover with auto-match suggestion and formal clienteId FK"
```

---

## Task 7: Precio Especial Valeria y Lobby en Cotizador MNT

**Files:**
- Modify: `panel/js/pages/cotizar-mnt.js` (~lines 266 `_renderSpaces`, 516 `_calcular`)
- Modify: `panel/js/pdf-rebuild.js` (rebuildMNT function)

**Interfaces:**
- Consumes: `_venues` array with `concepto` field containing venue names
- Produces: `desgloseVenues` entries with optional `precioEspecial` and `precioOriginal` fields

- [x] **Step 1: Add price override input to Valeria/Lobby cards**

In `cotizar-mnt.js`, in `_renderSpaces()` (line 266), after the venue card renders its price info, add conditional field:

```js
      // After the price display line in the card
      var isOverridable = (v.concepto || '').indexOf('Valeria') !== -1 || (v.concepto || '').indexOf('Lobby') !== -1;
      if (isOverridable) {
        cardHtml += '<div class="mnt-precio-especial">'
          + '<label>Precio especial:</label>'
          + '<input type="number" class="bnk-input mnt-precio-override" data-venue="' + _esc(v.id) + '"'
          + ' placeholder="' + (v.precio || 0) + '" min="0" step="100">'
          + '</div>';
      }
```

- [x] **Step 2: Update `_calcular()` to use override price**

In `_calcular()` (line 516), when computing `renta` for each venue, check for override:

```js
      // Before price calculation for each venue
      var overrideInput = document.querySelector('.mnt-precio-override[data-venue="' + venue.id + '"]');
      var precioEspecial = overrideInput ? (parseFloat(overrideInput.value) || 0) : 0;
      var precioRegularEfectivo = precioEspecial > 0 ? precioEspecial : venue.precio;
      var precioWeekendEfectivo = precioEspecial > 0 ? precioEspecial : (venue.precioWeekend || venue.precio);
```

Use `precioRegularEfectivo` and `precioWeekendEfectivo` instead of `venue.precio` and `venue.precioWeekend` in the rent calculation.

In the `desglose` entry, add:

```js
      entry.precioOriginal = venue.precio;
      entry.precioEspecial = precioEspecial > 0 ? precioEspecial : null;
```

- [x] **Step 3: Add CSS for the override field**

In `panel/css/panel.css`:

```css
.mnt-precio-especial { margin-top: 6px; display: flex; align-items: center; gap: 6px; }
.mnt-precio-especial label { font-size: 11px; color: var(--tx2); white-space: nowrap; }
.mnt-precio-override { width: 100px; font-size: 12px; }
.mnt-precio-override:not(:placeholder-shown) ~ .mnt-precio-original { text-decoration: line-through; opacity: 0.5; }
```

- [x] **Step 4: Update pdf-rebuild.js to use effective price**

In `pdf-rebuild.js`, in `rebuildMNT()`, where venue prices are rendered, the desglose already has `renta` and `total` calculated with the effective price. No change needed unless the PDF reads raw `precioRegular`/`precioWeekend` — verify and update if it does.

- [x] **Step 5: Commit**

```bash
git add panel/js/pages/cotizar-mnt.js panel/js/pdf-rebuild.js panel/css/panel.css
git commit -m "feat(cotizar-mnt): add per-cotización price override for Valeria and Lobby venues"
```

---

## Task 8: Toggle "No Aplica" para Completitud de Perfil

**Files:**
- Modify: `panel/js/pages/clientes.js` (~line 69 CAMPOS_EXCLUIDOS, ~line 203 calcCompletitud)
- Modify: `panel/js/pages/proveedores.js` (~line 76 CAMPOS_EXCLUIDOS, calcCompletitud)
- Modify: `panel/dashboard.html` (toggle in modal bank section)

**Interfaces:**
- Consumes: Existing `calcCompletitud(obj)` function in both modules
- Produces: Modified completion % that respects `noAplicaExtranjero` toggle

- [x] **Step 1: Define foreign bank field constants in clientes.js**

In `clientes.js`, after `CAMPOS_EXCLUIDOS` (line 69), add:

```js
  var CAMPOS_EXTRANJERO = ['bancoExtranjero', 'divisa', 'titularExtranjero', 'cuentaIban', 'swiftBic', 'abaRouting', 'bancoIntermediario', 'swiftIntermediario'];
```

- [x] **Step 2: Modify `calcCompletitud` in clientes.js**

Replace `calcCompletitud` (line 203):

```js
  function calcCompletitud(obj) {
    var total = 0, llenos = 0;
    var excluirExtra = obj.noAplicaExtranjero === true ? CAMPOS_EXTRANJERO : [];
    Object.keys(obj).forEach(function (key) {
      if (CAMPOS_EXCLUIDOS[key]) return;
      if (key === 'noAplicaExtranjero') return;
      if (excluirExtra.indexOf(key) !== -1) return;
      total++;
      var v = obj[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') llenos++;
    });
    return total === 0 ? 0 : Math.round((llenos / total) * 100);
  }
```

- [x] **Step 3: Do the same in proveedores.js**

In `proveedores.js`, after `CAMPOS_EXCLUIDOS` (line 76), add the same `CAMPOS_EXTRANJERO` array (adapted field names if they differ — verify they match: `bancoExtranjero`, `divisa`, `titularExtranjero`, `cuentaIban`, `swiftBic`, `abaRouting`, `bancoIntermediario`, `swiftIntermediario`, `gastosBancarios`, `direccionBanco`).

Apply the same `calcCompletitud` modification.

- [x] **Step 4: Add toggle UI in modal bank section**

In `dashboard.html`, in the client modal's "Datos Bancarios Extranjero" section header, add:

```html
<label class="no-aplica-toggle">
  <input type="checkbox" id="cliNoAplicaExtranjero"> No aplica
</label>
```

Same for the proveedor modal:

```html
<label class="no-aplica-toggle">
  <input type="checkbox" id="prvNoAplicaExtranjero"> No aplica
</label>
```

- [x] **Step 5: Wire toggle to disable fields and save state**

In `clientes.js`, in `abrirModal()`, after populating fields:

```js
      // Set noAplicaExtranjero toggle
      var chkNoAplica = document.getElementById('cliNoAplicaExtranjero');
      if (chkNoAplica) {
        chkNoAplica.checked = !!obj.noAplicaExtranjero;
        _toggleExtranjeroFields('cli', chkNoAplica.checked);
        chkNoAplica.addEventListener('change', function () {
          _toggleExtranjeroFields('cli', this.checked);
        });
      }
```

Add helper:

```js
  function _toggleExtranjeroFields(prefix, disabled) {
    CAMPOS_EXTRANJERO.forEach(function (campo) {
      var el = document.getElementById(prefix + campo.charAt(0).toUpperCase() + campo.slice(1));
      if (!el) {
        // Try mapped ID
        var mappedId = CAMPO_ID[campo];
        el = document.getElementById(mappedId);
      }
      if (el) {
        el.disabled = disabled;
        el.style.opacity = disabled ? '0.4' : '1';
      }
    });
  }
```

In the save function, include `noAplicaExtranjero`:

```js
    data.noAplicaExtranjero = document.getElementById('cliNoAplicaExtranjero').checked;
```

Apply same pattern in proveedores.js with `prvNoAplicaExtranjero`.

- [x] **Step 6: Add CSS for the toggle**

```css
.no-aplica-toggle { font-size: 11px; color: var(--tx2); display: flex; align-items: center; gap: 4px; margin-left: auto; }
.no-aplica-toggle input { margin: 0; }
```

- [x] **Step 7: Commit**

```bash
git add panel/js/pages/clientes.js panel/js/pages/proveedores.js panel/dashboard.html panel/css/panel.css
git commit -m "fix(completitud): exclude foreign bank fields when 'No aplica' toggle is active"
```

---

## Task 9: Fix UX Overflow Dropdowns en Modal de Pagos

**Files:**
- Modify: `panel/js/pages/finanzas.js` (~line 359 autocomplete setup)
- Modify: `panel/css/finanzas.css`

**Interfaces:**
- Consumes: `#finPagoCotAuto` autocomplete dropdown inside `#finPagoOverlay` modal
- Produces: Properly positioned autocomplete that doesn't clip

- [x] **Step 1: Update autocomplete positioning to use fixed position**

In `finanzas.js`, find `_setupCotAutocomplete` (called at line 359). Modify the function to position the dropdown using `position: fixed` with `getBoundingClientRect()`:

```js
  function _setupCotAutocomplete(inputId, acId, hiddenId) {
    var input = document.getElementById(inputId);
    var ac = document.getElementById(acId);
    var hidden = document.getElementById(hiddenId);
    if (!input || !ac) return;

    function _positionAC() {
      var rect = input.getBoundingClientRect();
      ac.style.position = 'fixed';
      ac.style.top = rect.bottom + 'px';
      ac.style.left = rect.left + 'px';
      ac.style.width = rect.width + 'px';
      ac.style.zIndex = '9999';
    }

    input.addEventListener('input', function () {
      // ... existing filter logic ...
      _positionAC();
      ac.classList.add('visible');
    });

    // Reposition on scroll
    var modalBody = input.closest('.bnk-modal-body');
    if (modalBody) {
      modalBody.addEventListener('scroll', function () {
        if (ac.classList.contains('visible')) _positionAC();
      });
    }
  }
```

- [x] **Step 2: Update CSS to ensure fixed dropdown isn't clipped**

In `panel/css/finanzas.css`, add:

```css
#finPagoCotAuto { position: fixed; z-index: 9999; }
```

Remove any `overflow: hidden` from the modal body that might still interfere, or add `overflow: visible` to the direct parent of the autocomplete if needed.

- [x] **Step 3: Commit**

```bash
git add panel/js/pages/finanzas.js panel/css/finanzas.css
git commit -m "fix(finanzas): prevent autocomplete dropdown from clipping inside payment modal"
```

---

## Task 10: PDF Orden de Trabajo para Proveedores

**Files:**
- Create: `panel/js/pdf-workorder.js`
- Modify: `panel/js/pages/cotizaciones.js` (popover button)
- Modify: `panel/js/pages/proveedores.js` (vinculadas button)
- Modify: `panel/dashboard.html` (modal + script tag)

**Interfaces:**
- Consumes: `BNKPdfWorkOrder.download(cotData, proveedorData, notas)` — main entry point
- Consumes: cotización data (folio, evento, fechaEvento, sede, conceptos JSON)
- Consumes: proveedor data (razonSocial, correoContacto, telefonoContacto, folio PRV-XXXX)

- [x] **Step 1: Create pdf-workorder.js module**

Create `panel/js/pdf-workorder.js`:

```js
// pdf-workorder.js — Genera PDF de Orden de Trabajo para proveedores
(function () {
  'use strict';

  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }

  function download(cotData, proveedorData, notas) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, margin = 20, contentW = W - margin * 2, H = 297;

    // Corporative palette
    var BG = [255, 255, 255];
    var TEXT = [51, 51, 51];
    var ACCENT = [198, 163, 80];
    var HEADER_BG = [44, 36, 25];
    var HEADER_TEXT = [255, 255, 255];
    var SUB_TEXT = [120, 120, 120];

    var HEADER_H = 28, FOOTER_H = 20, MAX_Y = H - FOOTER_H;
    var y = 0;

    function drawBG() { doc.setFillColor(BG[0], BG[1], BG[2]); doc.rect(0, 0, W, H, 'F'); }

    function drawHeader() {
      drawBG();
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.rect(0, 0, W, HEADER_H, 'F');
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        try { doc.addImage(BUNKER_LOGO_B64, 'PNG', margin, 4, 40, 15); } catch (e) {}
      }
      doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text('ORDEN DE TRABAJO', 65, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text(cotData.folio + ' | ' + (new Date().toLocaleDateString('es-MX')), 65, 18);
    }

    function drawFooter() {
      var fy = H - FOOTER_H + 2;
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.setLineWidth(0.3); doc.line(margin, fy, W - margin, fy);
      doc.setFontSize(6); doc.setTextColor(SUB_TEXT[0], SUB_TEXT[1], SUB_TEXT[2]);
      doc.text('Ref: ' + cotData.folio + ' | BÚNKER Creatividad Empresarial', margin, fy + 5);
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        try { doc.addImage(BUNKER_LOGO_B64, 'PNG', W - margin - 25, H - FOOTER_H + 3, 25, 9); } catch (e) {}
      }
    }

    function checkPage(needed) {
      if (y + needed > MAX_Y) { drawFooter(); doc.addPage(); drawHeader(); y = 36; }
    }

    function drawSection(text) {
      checkPage(14);
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(text, margin + 4, y + 5.5);
      doc.setFont('helvetica', 'normal'); y += 10;
    }

    function drawField(label, value) {
      checkPage(7);
      doc.setFontSize(8); doc.setTextColor(SUB_TEXT[0], SUB_TEXT[1], SUB_TEXT[2]);
      doc.text(label + ':', margin + 2, y + 4);
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      doc.text(String(value || '—'), margin + 40, y + 4);
      y += 6;
    }

    // === Page 1 ===
    drawHeader();
    y = 36;

    // Proveedor section
    drawSection('PROVEEDOR');
    drawField('Nombre', proveedorData.razonSocial || proveedorData.nombreComercial || '');
    drawField('Folio', proveedorData.folioDisplay || '');
    drawField('Contacto', proveedorData.nombreContacto || '');
    drawField('Email', proveedorData.correoContacto || '');
    drawField('Teléfono', proveedorData.telefonoContacto || '');
    y += 4;

    // Event details
    drawSection('DETALLES DEL EVENTO');
    drawField('Evento', cotData.evento || '');
    drawField('Fecha', cotData.fechaEvento || '');
    drawField('Sede', cotData.sede || 'MUNET');
    drawField('Empresa', cotData.empresa || '');
    y += 4;

    // Services for this provider
    drawSection('SERVICIOS REQUERIDOS');

    var conceptos = [];
    try { conceptos = JSON.parse(cotData.conceptos || '[]'); } catch (e) { conceptos = []; }

    // Filter to this provider's services
    var provSrvs = conceptos.filter(function (c) {
      return c.proveedorId === proveedorData.id;
    });

    if (provSrvs.length === 0) {
      doc.setFontSize(8); doc.setTextColor(SUB_TEXT[0], SUB_TEXT[1], SUB_TEXT[2]);
      doc.text('(Servicios vinculados manualmente — sin detalle de conceptos)', margin + 2, y + 4);
      y += 8;
    } else {
      // Table header
      checkPage(10);
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      doc.text('Servicio', margin + 2, y + 4);
      doc.text('Cantidad', margin + 90, y + 4);
      doc.text('Unidad', margin + 115, y + 4);
      doc.setFont('helvetica', 'normal');
      y += 7;
      doc.setDrawColor(200, 200, 200); doc.line(margin, y - 1, W - margin, y - 1);

      // Group by bloque
      var bloques = {};
      var sinBloque = [];
      provSrvs.forEach(function (c) {
        if (c.bloqueNombre) {
          if (!bloques[c.bloqueNombre]) bloques[c.bloqueNombre] = [];
          bloques[c.bloqueNombre].push(c);
        } else {
          sinBloque.push(c);
        }
      });

      Object.keys(bloques).forEach(function (bName) {
        checkPage(8);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text('▸ ' + bName, margin + 2, y + 4);
        doc.setFont('helvetica', 'normal'); y += 6;

        bloques[bName].forEach(function (c) {
          checkPage(6);
          doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
          doc.text('  ' + (c.concepto || ''), margin + 4, y + 4);
          doc.text(String(c.cantidad || 1), margin + 92, y + 4);
          doc.text(c.unidad || 'servicio', margin + 115, y + 4);
          y += 6;
        });
      });

      sinBloque.forEach(function (c) {
        checkPage(6);
        doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
        doc.text(c.concepto || '', margin + 2, y + 4);
        doc.text(String(c.cantidad || 1), margin + 92, y + 4);
        doc.text(c.unidad || 'servicio', margin + 115, y + 4);
        y += 6;
      });
    }

    y += 4;

    // Notes section
    if (notas) {
      drawSection('NOTAS');
      doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      var notasLines = doc.splitTextToSize(notas, contentW - 4);
      notasLines.forEach(function (line) {
        checkPage(6);
        doc.text(line, margin + 2, y + 4);
        y += 5;
      });
    }

    // Footer
    drawFooter();

    doc.save('OT-' + cotData.folio + '-' + (proveedorData.razonSocial || 'proveedor').replace(/\s+/g, '_') + '.pdf');
  }

  window.BNKPdfWorkOrder = { download: download };
})();
```

- [x] **Step 2: Add modal for notes before PDF generation**

In `dashboard.html`, add:

```html
<!-- Modal Orden de Trabajo -->
<div id="otOverlay" class="bnk-overlay">
  <div class="bnk-modal" style="max-width:500px">
    <div class="bnk-modal-header">
      <h3>Orden de Trabajo — <span id="otFolioLabel"></span></h3>
      <button class="bnk-close" id="otClose">&times;</button>
    </div>
    <div class="bnk-modal-body">
      <div class="bnk-form-group">
        <label>Proveedor</label>
        <select id="otProveedorSel" class="bnk-input"></select>
      </div>
      <div id="otPreview" style="font-size:12px;color:var(--tx2);margin:8px 0"></div>
      <div class="bnk-form-group">
        <label>Notas para el proveedor</label>
        <textarea id="otNotas" class="bnk-input" rows="4" placeholder="Instrucciones adicionales..."></textarea>
      </div>
      <button id="otDescargar" class="bnk-btn">Descargar PDF</button>
    </div>
  </div>
</div>
```

Add script tag: `<script src="js/pdf-workorder.js?v=1"></script>`

- [x] **Step 3: Add "Orden de trabajo" button to BNK cotización popover**

In `cotizaciones.js`, in `_bindPopover()`, add handler for new button:

```js
      var popOT = pop.querySelector('#popOrdenTrabajo');
      if (popOT) popOT.addEventListener('click', function () {
        if (!_popCot) return;
        _openOTModal(_popCot);
        _closePopover();
      });
```

In `_openPopover()`, show the OT button only for BNK cotizaciones:

```js
      var otBtn = pop.querySelector('#popOrdenTrabajo');
      if (otBtn) otBtn.style.display = cot.fuente === 'BNK' ? '' : 'none';
```

In `dashboard.html` popover, add: `<button id="popOrdenTrabajo" class="pop-action-btn">📋 Orden de trabajo</button>`

- [x] **Step 4: Implement OT modal logic**

In `cotizaciones.js`, add:

```js
  var _otCot = null;

  function _openOTModal(cot) {
    _otCot = cot;
    var overlay = document.getElementById('otOverlay');
    if (!overlay) return;
    overlay.classList.add('visible');
    document.getElementById('otFolioLabel').textContent = cot.folio;
    document.getElementById('otNotas').value = '';

    // Find linked providers
    var vinculados = (_cotProveedores || []).filter(function (cp) {
      return cp.cotizacionId === cot.id || cp.cotizacionFolio === cot.folio;
    });

    var sel = document.getElementById('otProveedorSel');
    var html = '';
    vinculados.forEach(function (v) {
      html += '<option value="' + _esc(v.proveedorId) + '">' + _esc(v.proveedorNombre || v.proveedorId) + '</option>';
    });
    sel.innerHTML = html || '<option value="">Sin proveedores vinculados</option>';

    _updateOTPreview();
    sel.addEventListener('change', _updateOTPreview);
  }

  function _updateOTPreview() {
    if (!_otCot) return;
    var provId = document.getElementById('otProveedorSel').value;
    var preview = document.getElementById('otPreview');
    if (!provId) { preview.innerHTML = ''; return; }

    var conceptos = [];
    try { conceptos = JSON.parse(_otCot.conceptos || '[]'); } catch (e) {}
    var filtered = conceptos.filter(function (c) { return c.proveedorId === provId; });

    if (filtered.length === 0) {
      preview.innerHTML = '<em>Este proveedor fue vinculado manualmente (sin conceptos detallados).</em>';
    } else {
      var html = '<strong>Servicios a incluir:</strong><ul>';
      filtered.forEach(function (c) {
        html += '<li>' + _esc(c.concepto) + ' ×' + c.cantidad + '</li>';
      });
      html += '</ul>';
      preview.innerHTML = html;
    }
  }

  function _setupOTModal() {
    var overlay = document.getElementById('otOverlay');
    if (!overlay) return;
    document.getElementById('otClose').addEventListener('click', function () {
      overlay.classList.remove('visible');
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.classList.remove('visible');
    });
    document.getElementById('otDescargar').addEventListener('click', function () {
      if (!_otCot) return;
      var provId = document.getElementById('otProveedorSel').value;
      if (!provId) { BNKToast.warn('Selecciona un proveedor.'); return; }

      // Find full provider data
      var provData = null;
      (_proveedores || []).forEach(function (p) { if (p.id === provId) provData = p; });
      if (!provData) { BNKToast.warn('Proveedor no encontrado.'); return; }

      var notas = document.getElementById('otNotas').value.trim();
      BNKPdfWorkOrder.download(_otCot, provData, notas);
      overlay.classList.remove('visible');
      BNKToast.ok('Orden de trabajo generada.');
    });
  }
```

Call `_setupOTModal()` from the module's init function.

- [x] **Step 5: Add OT button in proveedores.js cotizaciones vinculadas**

In `proveedores.js`, in the entity popover or cotización listing for providers, add an "OT" button next to each linked cotización. When clicked, open the OT modal with pre-selected provider:

```js
      // In the cotización row for a provider's linked cotizaciones
      html += '<button class="tbl-action prv-ot-btn" data-cot-id="' + _esc(cotId) + '" title="Orden de trabajo">📋</button>';
```

Wire the click to open the OT modal from cotizaciones.js (expose `_openOTModal` or use a global event).

- [x] **Step 6: Commit**

```bash
git add panel/js/pdf-workorder.js panel/js/pages/cotizaciones.js panel/js/pages/proveedores.js panel/dashboard.html
git commit -m "feat(pdf): add work order PDF generation for providers with notes modal and dual access points"
```

---

## Self-Review Checklist

### Spec Coverage
- [x] 1.1 Doble precio → Task 2 (steps 1-2)
- [x] 1.2 Bloques de categoría → Tasks 1-2 (firestore + UI)
- [x] 2.1 Input dual → Task 3
- [x] 2.2 Estructura conceptos → Task 3 step 4
- [x] 2.3 Bloques en PDF → Task 5
- [x] 2.4 Auto-vinculación → Task 4
- [x] 2.5 Collection group → Task 1
- [x] 3.1 Vincular cliente → Task 6
- [x] 3.2 Precio especial → Task 7
- [x] 4.1 Toggle completitud → Task 8
- [x] 4.2 Fix overflow → Task 9
- [x] 5.1-5.3 PDF orden de trabajo → Task 10

### Placeholder Scan
- No TBDs or TODOs found
- All code blocks contain actual implementation

### Type/Name Consistency
- `BNK_DB.bloques(proveedorId)` — consistent in Tasks 1, 2
- `BNK_DB.allServicios()` / `BNK_DB.allBloques()` — consistent in Tasks 1, 3
- `_recopilarConceptos()` — output shape matches Task 4 consumer
- `BNKPdfWorkOrder.download(cotData, proveedorData, notas)` — consistent in Task 10
- `noAplicaExtranjero` field name — consistent in Task 8
- `clienteId` / `clienteNombre` — consistent in Task 6

---

## Completion Log

- **2026-09-15**: Tasks 1–10 implemented and deployed to `bunker-panel.web.app`
- **2026-09-15**: Firestore rules deployed with bloques subcollection + collection group rules
- **2026-09-16**: 7 bugs from user testing fixed and deployed:
  1. Price fallback: `precioCliente > 0 ? precioCliente : costoUnitario`
  2. OT PDF: triple fallback matching (by ID → by name → all conceptos)
  3. Completitud: excluded `observaciones`, `condicionesPago`, `marcas`
  4. CSS: flex layout for concepto rows (overflow fix)
  5. CSS: `overflow-x:hidden` on `.bnk-modal-body`
  6. New "Agregar Bloque de Proveedor" button with modal picker in BNK cotizador
- **Status**: ✅ ALL TASKS COMPLETE — pending visual verification in browser
