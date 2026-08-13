# Módulo FINANZAS + Partners — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a FINANZAS tab to the BUNKER panel with three sub-tabs (Cuentas por Pagar, Partners CRUD, Dispersiones) backed by three new Firestore collections.

**Architecture:** One new IIFE module `finanzas.js` handles all three sub-tabs. Three Firestore collections (`partners`, `pagos`, `cotizacionPartners`) registered via the existing `collectionAPI` factory. CSS in a dedicated `finanzas.css`. HTML section added to `dashboard.html` before `</main>`. Firestore rules updated for admin-only writes.

**Tech Stack:** Vanilla JS (ES5, IIFEs), Firebase Firestore (compat SDK), CSS custom properties, jsPDF not needed for this feature.

## Global Constraints

- All user-facing text in Spanish.
- No build tools — edit source files directly.
- CSS tokens from `:root` in `panel.css` — never hard-code colors.
- Follow IIFE module pattern with `BNK_AUTH.onReady()` initialization.
- `BNK_AUTH.currentUser()` is a **function** (not a property) — always call with `()`.
- Modals use `.bnk-overlay` + `.bnk-modal` + `.visible` class pattern.
- Toast notifications via `BNKToast.ok/warn/error(msg)`.
- Form sections wrapped in `.ctz-card` for visual grouping.
- Only admin can write to `partners`, `pagos`, `cotizacionPartners`. All authenticated users can read.
- Folios: `PTR-XXXX` for partners (sequential 4-digit).
- Deploy: `firebase deploy --only hosting --project bunker-panel`.

---

### Task 1: Firestore setup — collections, rules, badges CSS

**Files:**
- Modify: `panel/js/firestore.js:120-132` — add 3 new collections to `BNK_DB`
- Modify: `firestore.rules:68-79` — add rules for `partners`, `pagos`, `cotizacionPartners`
- Modify: `panel/css/panel.css:118-120` — add new estado badges

**Interfaces:**
- Consumes: existing `collectionAPI` factory function in `firestore.js`
- Produces: `BNK_DB.partners` (collectionAPI), `BNK_DB.pagos` (collectionAPI), `BNK_DB.cotizacionPartners` (collectionAPI) — each with `.list()`, `.get()`, `.create()`, `.update()`, `.delete()`, `.onSnapshot()` methods

- [ ] **Step 1: Add collections to firestore.js**

In `panel/js/firestore.js`, replace the `window.BNK_DB` block (lines 121-132) with:

```js
  window.BNK_DB = {
    cotizaciones:        collectionAPI('cotizaciones', { orderBy: { field: 'fecha', dir: 'desc' } }),
    clientes:            collectionAPI('clientes', { orderBy: { field: 'razonSocial', dir: 'asc' } }),
    proveedores:         collectionAPI('proveedores', { orderBy: { field: 'razonSocial', dir: 'asc' } }),
    catalogo:            collectionAPI('catalogo', { orderBy: { field: 'categoria', dir: 'asc' } }),
    usuarios:            collectionAPI('usuarios', { orderBy: { field: 'nombre', dir: 'asc' } }),
    eventos:             collectionAPI('eventos', { orderBy: { field: 'fechaEvento', dir: 'asc' } }),
    plantillas:          collectionAPI('plantillas'),
    config:              collectionAPI('config'),
    partners:            collectionAPI('partners', { orderBy: { field: 'nombre', dir: 'asc' } }),
    pagos:               collectionAPI('pagos', { orderBy: { field: 'createdAt', dir: 'desc' } }),
    cotizacionPartners:  collectionAPI('cotizacionPartners'),
    actividad:           actividadAPI,
    tareas:              tareasAPI
  };
```

- [ ] **Step 2: Add Firestore rules**

In `firestore.rules`, add these blocks **before** the closing `}}` (after the `config` match block at line 78):

```
    match /partners/{docId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdmin();
    }

    match /pagos/{docId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdmin();
    }

    match /cotizacionPartners/{docId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdmin();
    }
```

- [ ] **Step 3: Add CSS badges for new states**

In `panel/css/panel.css`, after the `.estado-Contactada` rule (line 120), add:

```css
.estado-Parcial{color:var(--ylw);border-color:rgba(240,192,64,.4);background:rgba(240,192,64,.08)}
.estado-PorDispersar{color:var(--ylw);border-color:rgba(240,192,64,.4);background:rgba(240,192,64,.08)}
.estado-Dispersado{color:var(--g);border-color:rgba(0,255,65,.4);background:rgba(0,255,65,.08)}
.estado-Pendiente{color:var(--tx);border-color:rgba(200,236,200,.3);background:rgba(200,236,200,.06)}
.tipo-partner{color:var(--blu);border-color:rgba(0,212,255,.3);background:rgba(0,212,255,.06)}
.tipo-proveedor{color:var(--ylw);border-color:rgba(240,192,64,.3);background:rgba(240,192,64,.06)}
```

- [ ] **Step 4: Verify manually**

Open browser console on `bunker-panel.web.app` and run:
```js
BNK_DB.partners.list().then(function(r){ console.log('partners:', r.length); });
BNK_DB.pagos.list().then(function(r){ console.log('pagos:', r.length); });
BNK_DB.cotizacionPartners.list().then(function(r){ console.log('cotizacionPartners:', r.length); });
```
Expected: each prints 0 (empty collections, no errors).

- [ ] **Step 5: Commit**

```bash
git add panel/js/firestore.js firestore.rules panel/css/panel.css
git commit -m "feat(finanzas): add Firestore collections, rules, and estado badges for partners/pagos"
```

---

### Task 2: Dashboard HTML — FINANZAS tab, section, sub-tabs, and all modals

**Files:**
- Modify: `panel/dashboard.html:49` — add FINANZAS tab button
- Modify: `panel/dashboard.html:866` — add `sec-finanzas` section before `</main>`
- Modify: `panel/dashboard.html:954` — add `<script src="js/pages/finanzas.js">` and `<link>` for CSS

**Interfaces:**
- Consumes: existing tab-switching JS in dashboard.html (lines 876-940), CSS classes from panel.css
- Produces: DOM elements with IDs used by `finanzas.js` (Task 3-5): `finSubCuentas`, `finSubPartners`, `finSubDispersiones`, `finKpi*`, `finCuentasBody`, `finPartnersBody`, `finDispersionesBody`, modal overlays, form inputs — all IDs listed below in the HTML

- [ ] **Step 1: Add FINANZAS tab to nav**

In `panel/dashboard.html`, after the EVENTOS tab (line 48), before the USUARIOS tab (line 49), add:

```html
  <button class="dash-tab" data-tab="finanzas">FINANZAS</button>
```

- [ ] **Step 2: Add finanzas CSS link and script**

In `panel/dashboard.html`, after `<script src="js/pages/cotizar-bnk.js"></script>` (line 954), add:

```html
<script src="js/pages/finanzas.js"></script>
```

- [ ] **Step 3: Add the FINANZAS section HTML**

In `panel/dashboard.html`, just before `</main>` (line 867), add the entire FINANZAS section. This is a large block — the full HTML follows:

```html
  <!-- ══════════════════════════════════════════════ -->
  <!-- FINANZAS -->
  <!-- ══════════════════════════════════════════════ -->
  <section id="sec-finanzas" class="panel-section">
    <link rel="stylesheet" href="css/finanzas.css">

    <!-- Sub-tabs -->
    <div class="panel-toolbar" style="border-bottom:1px solid var(--bd)">
      <div class="modal-tabs" id="finTabs" style="border-bottom:none;margin-bottom:0">
        <button class="modal-tab active" data-fin-tab="cuentas">CUENTAS POR PAGAR</button>
        <button class="modal-tab" data-fin-tab="partners">PARTNERS</button>
        <button class="modal-tab" data-fin-tab="dispersiones">DISPERSIONES</button>
      </div>
    </div>

    <!-- ── SUB-TAB: CUENTAS POR PAGAR ── -->
    <div class="fin-subtab" id="finSubCuentas">
      <!-- KPIs -->
      <div class="dash-indicators" style="grid-template-columns:repeat(4,1fr)">
        <div class="dash-card">
          <div class="dash-card-label">TOTAL PAGADO</div>
          <div class="dash-card-value" id="finKpiPagado">$0</div>
          <div class="dash-card-sub">acumulado del período</div>
        </div>
        <div class="dash-card dash-card--warn">
          <div class="dash-card-label">PENDIENTE PROVEEDORES</div>
          <div class="dash-card-value" id="finKpiPendProv">0</div>
          <div class="dash-card-sub">cuentas abiertas</div>
        </div>
        <div class="dash-card dash-card--warn">
          <div class="dash-card-label">PENDIENTE PARTNERS</div>
          <div class="dash-card-value" id="finKpiPendPart">0</div>
          <div class="dash-card-sub">dispersiones activas</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-label">PAGOS DEL MES</div>
          <div class="dash-card-value" id="finKpiMes">0</div>
          <div class="dash-card-sub">registrados este mes</div>
        </div>
      </div>

      <!-- Filtros -->
      <div class="dash-filters">
        <input type="text" id="finCuentasSearch" class="dash-search" placeholder="Buscar folio, destinatario...">
        <select id="finCuentasTipo" class="dash-select">
          <option value="">Todos los tipos</option>
          <option value="proveedor">Proveedor</option>
          <option value="partner">Partner</option>
        </select>
        <select id="finCuentasEstado" class="dash-select">
          <option value="">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Parcial">Parcial</option>
          <option value="Cerrada">Cerrada</option>
        </select>
        <button class="panel-btn-primary fin-admin-only" id="finBtnRegistrarPago">+ REGISTRAR PAGO</button>
      </div>

      <!-- Tabla -->
      <div class="dash-table-wrap">
        <table class="dash-table">
          <thead>
            <tr>
              <th>FOLIO COT.</th>
              <th>TIPO</th>
              <th>DESTINATARIO</th>
              <th>PAGADO</th>
              <th>ÚLTIMO PAGO</th>
              <th>ESTADO</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody id="finCuentasBody"></tbody>
        </table>
        <div id="finCuentasEmpty" class="dash-empty" style="display:none">
          <div class="dash-empty-icon">&#128176;</div>
          <div class="dash-empty-text">Sin cuentas registradas</div>
        </div>
      </div>
    </div>

    <!-- ── SUB-TAB: PARTNERS ── -->
    <div class="fin-subtab" id="finSubPartners" style="display:none">
      <div class="panel-toolbar">
        <h2 class="panel-section-title">PARTNERS / COPRODUCTORES</h2>
        <input type="text" id="finPartnerSearch" class="dash-search" placeholder="Buscar partner..." style="max-width:300px">
        <button class="panel-btn-primary fin-admin-only" id="finBtnNuevoPartner">+ NUEVO PARTNER</button>
      </div>

      <div class="dash-table-wrap">
        <table class="dash-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>NOMBRE</th>
              <th>CONTACTO</th>
              <th>CORREO</th>
              <th>TELÉFONO</th>
              <th>COTIZACIONES</th>
              <th>ESTADO</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody id="finPartnersBody"></tbody>
        </table>
        <div id="finPartnersEmpty" class="dash-empty" style="display:none">
          <div class="dash-empty-icon">&#129309;</div>
          <div class="dash-empty-text">Sin partners registrados</div>
        </div>
      </div>
    </div>

    <!-- ── SUB-TAB: DISPERSIONES ── -->
    <div class="fin-subtab" id="finSubDispersiones" style="display:none">
      <div class="panel-toolbar">
        <h2 class="panel-section-title">DISPERSIONES A PARTNERS</h2>
        <button class="panel-btn-primary fin-admin-only" id="finBtnAsignarPartner">+ ASIGNAR PARTNER</button>
      </div>

      <div class="dash-table-wrap">
        <table class="dash-table">
          <thead>
            <tr>
              <th>FOLIO</th>
              <th>CLIENTE</th>
              <th>EVENTO</th>
              <th>ESTADO COT.</th>
              <th>PARTNERS</th>
              <th>ESTADO DISPERSIÓN</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody id="finDispersionesBody"></tbody>
        </table>
        <div id="finDispersionesEmpty" class="dash-empty" style="display:none">
          <div class="dash-empty-icon">&#128300;</div>
          <div class="dash-empty-text">Sin cotizaciones con partners asignados</div>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════ -->
    <!-- MODAL: REGISTRAR PAGO -->
    <!-- ════════════════════════════════ -->
    <div class="bnk-overlay" id="finPagoOverlay">
      <div class="bnk-modal" style="max-width:600px">
        <div class="bnk-modal-header">
          <span class="bnk-modal-title">REGISTRAR PAGO</span>
          <button class="bnk-modal-close" id="finPagoClose">&times;</button>
        </div>
        <div class="bnk-modal-body">
          <div class="ctz-card">
            <div class="bnk-form-grid">
              <div class="bnk-form-group bnk-form-full">
                <label class="bnk-label">COTIZACIÓN *</label>
                <input type="text" class="bnk-input" id="finPagoCotizacion" placeholder="Buscar folio..." autocomplete="off">
                <div class="bnk-autocomplete" id="finPagoCotAuto"></div>
                <input type="hidden" id="finPagoCotId">
              </div>
              <div class="bnk-form-group">
                <label class="bnk-label">TIPO *</label>
                <select class="bnk-input" id="finPagoTipo">
                  <option value="proveedor">Proveedor</option>
                  <option value="partner">Partner</option>
                </select>
              </div>
              <div class="bnk-form-group">
                <label class="bnk-label">DESTINATARIO *</label>
                <select class="bnk-input" id="finPagoDest"></select>
              </div>
              <div class="bnk-form-group">
                <label class="bnk-label">MONTO *</label>
                <input type="number" class="bnk-input" id="finPagoMonto" placeholder="0" min="0" step="0.01">
              </div>
              <div class="bnk-form-group">
                <label class="bnk-label">FECHA DE PAGO *</label>
                <input type="date" class="bnk-input" id="finPagoFecha">
              </div>
              <div class="bnk-form-group">
                <label class="bnk-label">MÉTODO DE PAGO</label>
                <select class="bnk-input" id="finPagoMetodo">
                  <option value="Transferencia">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Efectivo">Efectivo</option>
                </select>
              </div>
              <div class="bnk-form-group">
                <label class="bnk-label">REFERENCIA / COMPROBANTE</label>
                <input type="text" class="bnk-input" id="finPagoRef" placeholder="No. de referencia">
              </div>
              <div class="bnk-form-group bnk-form-full">
                <label class="bnk-label">NOTAS</label>
                <textarea class="bnk-textarea" id="finPagoNotas" rows="2" placeholder="Notas del pago..."></textarea>
              </div>
            </div>
          </div>
        </div>
        <div class="bnk-modal-footer">
          <button class="panel-btn-secondary" id="finPagoCancel">CANCELAR</button>
          <button class="panel-btn-primary" id="finPagoGuardar">GUARDAR PAGO</button>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════ -->
    <!-- MODAL: DETALLE CUENTA -->
    <!-- ════════════════════════════════ -->
    <div class="bnk-overlay" id="finDetalleOverlay">
      <div class="bnk-modal" style="max-width:700px">
        <div class="bnk-modal-header">
          <span class="bnk-modal-title" id="finDetalleTitle">DETALLE DE CUENTA</span>
          <button class="bnk-modal-close" id="finDetalleClose">&times;</button>
        </div>
        <div class="bnk-modal-body">
          <div id="finDetalleInfo"></div>
          <div class="bnk-section-label" style="margin-top:16px">HISTORIAL DE PAGOS</div>
          <div class="dash-table-wrap" style="padding:0">
            <table class="dash-table">
              <thead>
                <tr>
                  <th>FECHA</th>
                  <th>MONTO</th>
                  <th>MÉTODO</th>
                  <th>REFERENCIA</th>
                  <th>REGISTRÓ</th>
                </tr>
              </thead>
              <tbody id="finDetallePagos"></tbody>
            </table>
          </div>
        </div>
        <div class="bnk-modal-footer">
          <button class="panel-btn-secondary fin-admin-only" id="finDetalleCerrar">MARCAR COMO CERRADA</button>
          <button class="panel-btn-primary fin-admin-only" id="finDetalleAgregar">+ AGREGAR PAGO</button>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════ -->
    <!-- MODAL: PARTNER (CRUD) -->
    <!-- ════════════════════════════════ -->
    <div class="bnk-overlay" id="finPartnerOverlay">
      <div class="bnk-modal" style="max-width:800px">
        <div class="bnk-modal-header">
          <span class="bnk-modal-title" id="finPartnerModalTitle">NUEVO PARTNER</span>
          <button class="bnk-modal-close" id="finPartnerClose">&times;</button>
        </div>
        <div class="bnk-modal-body">
          <input type="hidden" id="finPartnerId">
          <div class="modal-tabs">
            <button class="modal-tab active" data-ptr-tab="general">GENERAL</button>
            <button class="modal-tab" data-ptr-tab="contacto">CONTACTO</button>
            <button class="modal-tab" data-ptr-tab="bancarios">BANCARIOS</button>
          </div>

          <!-- Tab General -->
          <div class="modal-tab-content" id="ptrTabGeneral">
            <div class="bnk-form-grid">
              <div class="bnk-form-group"><label class="bnk-label">NOMBRE / RAZÓN SOCIAL</label><input type="text" class="bnk-input" id="ptrNombre"></div>
              <div class="bnk-form-group"><label class="bnk-label">NOMBRE COMERCIAL</label><input type="text" class="bnk-input" id="ptrNombreComercial"></div>
              <div class="bnk-form-group"><label class="bnk-label">TIPO PERSONA</label>
                <select class="bnk-input" id="ptrTipoPersona"><option value="">—</option><option value="Física">Física</option><option value="Moral">Moral</option></select>
              </div>
              <div class="bnk-form-group"><label class="bnk-label">CUENTA ACTIVA</label>
                <select class="bnk-input" id="ptrCuentaActiva"><option value="Sí">Sí</option><option value="No">No</option></select>
              </div>
              <div class="bnk-form-group bnk-form-full"><label class="bnk-label">OBSERVACIONES</label><textarea class="bnk-textarea" id="ptrObservaciones" rows="2"></textarea></div>
            </div>
          </div>

          <!-- Tab Contacto -->
          <div class="modal-tab-content" id="ptrTabContacto" style="display:none">
            <div class="bnk-form-grid">
              <div class="bnk-form-group"><label class="bnk-label">PERSONA CONTACTO</label><input type="text" class="bnk-input" id="ptrContacto"></div>
              <div class="bnk-form-group"><label class="bnk-label">PUESTO</label><input type="text" class="bnk-input" id="ptrPuesto"></div>
              <div class="bnk-form-group"><label class="bnk-label">CORREO</label><input type="email" class="bnk-input" id="ptrCorreo"></div>
              <div class="bnk-form-group"><label class="bnk-label">TELÉFONO</label><input type="tel" class="bnk-input" id="ptrTelefono"></div>
            </div>
          </div>

          <!-- Tab Bancarios -->
          <div class="modal-tab-content" id="ptrTabBancarios" style="display:none">
            <div class="bnk-section-label">CUENTA MXN</div>
            <div class="bnk-form-grid">
              <div class="bnk-form-group"><label class="bnk-label">BANCO</label><input type="text" class="bnk-input" id="ptrBanco"></div>
              <div class="bnk-form-group"><label class="bnk-label">CLABE</label><input type="text" class="bnk-input" id="ptrClabe"></div>
              <div class="bnk-form-group"><label class="bnk-label">TITULAR</label><input type="text" class="bnk-input" id="ptrTitular"></div>
              <div class="bnk-form-group"><label class="bnk-label">TIPO CUENTA</label><input type="text" class="bnk-input" id="ptrTipoCuenta"></div>
            </div>
            <div class="bnk-section-label" style="margin-top:20px">CUENTA EXTRANJERA</div>
            <div class="bnk-form-grid">
              <div class="bnk-form-group"><label class="bnk-label">BANCO</label><input type="text" class="bnk-input" id="ptrBancoExtranjero"></div>
              <div class="bnk-form-group"><label class="bnk-label">DIVISA</label><input type="text" class="bnk-input" id="ptrDivisa"></div>
              <div class="bnk-form-group"><label class="bnk-label">CUENTA/IBAN</label><input type="text" class="bnk-input" id="ptrCuentaIBAN"></div>
              <div class="bnk-form-group"><label class="bnk-label">SWIFT/BIC</label><input type="text" class="bnk-input" id="ptrSwift"></div>
            </div>
          </div>

          <!-- Cotizaciones vinculadas (solo lectura, fuera de tabs) -->
          <div class="bnk-section-label" style="margin-top:20px">COTIZACIONES VINCULADAS</div>
          <div id="ptrCotizaciones" style="font-size:13px;color:var(--tx)">Sin cotizaciones vinculadas.</div>
        </div>
        <div class="bnk-modal-footer">
          <button class="panel-btn-secondary" id="finPartnerCancel">CANCELAR</button>
          <button class="panel-btn-primary fin-admin-only" id="finPartnerGuardar">GUARDAR</button>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════ -->
    <!-- MODAL: ASIGNAR PARTNER A COTIZACIÓN -->
    <!-- ════════════════════════════════ -->
    <div class="bnk-overlay" id="finAsignarOverlay">
      <div class="bnk-modal" style="max-width:550px">
        <div class="bnk-modal-header">
          <span class="bnk-modal-title">ASIGNAR PARTNER A COTIZACIÓN</span>
          <button class="bnk-modal-close" id="finAsignarClose">&times;</button>
        </div>
        <div class="bnk-modal-body">
          <div class="ctz-card">
            <div class="bnk-form-grid">
              <div class="bnk-form-group bnk-form-full">
                <label class="bnk-label">COTIZACIÓN *</label>
                <input type="text" class="bnk-input" id="finAsignarCot" placeholder="Buscar folio..." autocomplete="off">
                <div class="bnk-autocomplete" id="finAsignarCotAuto"></div>
                <input type="hidden" id="finAsignarCotId">
              </div>
              <div class="bnk-form-group bnk-form-full">
                <label class="bnk-label">PARTNERS *</label>
                <div id="finAsignarPartnersList" class="fin-partner-checks"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="bnk-modal-footer">
          <button class="panel-btn-secondary" id="finAsignarCancel">CANCELAR</button>
          <button class="panel-btn-primary" id="finAsignarGuardar">ASIGNAR</button>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════ -->
    <!-- MODAL: DETALLE DISPERSIÓN -->
    <!-- ════════════════════════════════ -->
    <div class="bnk-overlay" id="finDispDetalleOverlay">
      <div class="bnk-modal" style="max-width:700px">
        <div class="bnk-modal-header">
          <span class="bnk-modal-title" id="finDispDetalleTitle">DETALLE DISPERSIÓN</span>
          <button class="bnk-modal-close" id="finDispDetalleClose">&times;</button>
        </div>
        <div class="bnk-modal-body" id="finDispDetalleBody"></div>
        <div class="bnk-modal-footer">
          <button class="panel-btn-primary fin-admin-only" id="finDispAsignarMas">+ ASIGNAR PARTNER</button>
        </div>
      </div>
    </div>

  </section>
```

- [ ] **Step 4: Add sub-tab switching JS to dashboard inline script**

In `panel/dashboard.html`, inside the `(function () { 'use strict';` block (around line 877), after the proveedor modal tab switching (line 905), add:

```js
  // Finanzas sub-tab switching
  document.querySelectorAll('[data-fin-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = this.getAttribute('data-fin-tab');
      document.querySelectorAll('[data-fin-tab]').forEach(function (t) { t.classList.remove('active'); });
      this.classList.add('active');
      document.querySelectorAll('.fin-subtab').forEach(function (s) { s.style.display = 'none'; });
      var el = document.getElementById('finSub' + target.charAt(0).toUpperCase() + target.slice(1));
      if (el) el.style.display = '';
    });
  });

  // Partner modal tab switching
  document.querySelectorAll('[data-ptr-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = this.getAttribute('data-ptr-tab');
      document.querySelectorAll('[data-ptr-tab]').forEach(function (t) { t.classList.remove('active'); });
      this.classList.add('active');
      ['general', 'contacto', 'bancarios'].forEach(function (t) {
        var el = document.getElementById('ptrTab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (el) el.style.display = t === target ? '' : 'none';
      });
    });
  });
```

- [ ] **Step 5: Verify HTML renders**

Deploy and navigate to FINANZAS tab. Confirm:
- 3 sub-tabs visible (CUENTAS POR PAGAR, PARTNERS, DISPERSIONES)
- Clicking each sub-tab shows/hides the correct content
- KPIs visible in Cuentas
- Empty state messages visible in each sub-tab
- All modals exist (not yet functional)

- [ ] **Step 6: Commit**

```bash
git add panel/dashboard.html
git commit -m "feat(finanzas): add FINANZAS tab HTML with sub-tabs, tables, and modals"
```

---

### Task 3: CSS — finanzas.css styles

**Files:**
- Create: `panel/css/finanzas.css`

**Interfaces:**
- Consumes: CSS tokens from `panel.css` `:root` (--bk, --dk, --card, --g, --gd, --wh, --tx, --bd, --ylw, --red, --blu)
- Produces: styles for `.fin-subtab`, `.fin-admin-only`, `.fin-partner-checks`, `.fin-parcialidad-row`, `.fin-info-grid`

- [ ] **Step 1: Create finanzas.css**

Create `panel/css/finanzas.css`:

```css
/* finanzas.css — Estilos del módulo FINANZAS */

/* Sub-tab content */
.fin-subtab { }

/* Admin-only elements — hidden by default, shown via JS for admin role */
.fin-admin-only { display: none; }
.fin-admin-visible .fin-admin-only { display: inline-block; }

/* Partner checkbox list in asignar modal */
.fin-partner-checks { max-height: 200px; overflow-y: auto; }
.fin-partner-check {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--bd);
  font-family: 'Barlow', sans-serif;
  font-size: 13px;
  color: var(--wh);
  cursor: pointer;
  transition: background 0.2s;
}
.fin-partner-check:hover { background: rgba(0,255,65,0.04); }
.fin-partner-check input[type="checkbox"] { accent-color: var(--g); }

/* Info grid in detalle modals */
.fin-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 20px;
  padding: 12px 0;
}
.fin-info-item {
  font-size: 13px;
}
.fin-info-label {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--tx);
  margin-bottom: 2px;
}
.fin-info-value {
  color: var(--wh);
}

/* Dispersión partner row in detail modal */
.fin-disp-partner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--bd);
  font-size: 13px;
}
.fin-disp-partner:last-child { border-bottom: none; }
.fin-disp-partner-name {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 1px;
}
.fin-disp-partner-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Cerrada toggle button */
.fin-btn-cerrar {
  padding: 6px 14px;
  background: none;
  border: 1px solid var(--bd);
  color: var(--tx);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 11px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s;
}
.fin-btn-cerrar:hover {
  border-color: var(--g);
  color: var(--g);
  background: rgba(0,255,65,0.06);
}
.fin-btn-cerrar.cerrada {
  border-color: rgba(0,255,65,0.4);
  color: var(--g);
  background: rgba(0,255,65,0.08);
}

/* Responsive */
@media (max-width: 900px) {
  .fin-info-grid { grid-template-columns: 1fr; }
  #sec-finanzas .dash-indicators { grid-template-columns: repeat(2,1fr); }
}
@media (max-width: 600px) {
  #sec-finanzas .dash-indicators { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Verify styles load**

Deploy, open FINANZAS tab, inspect that the CSS file loads in the network tab and no 404 occurs.

- [ ] **Step 3: Commit**

```bash
git add panel/css/finanzas.css
git commit -m "feat(finanzas): add finanzas.css styles for sub-tabs, partner checks, info grid"
```

---

### Task 4: finanzas.js — Partners CRUD sub-tab

**Files:**
- Create: `panel/js/pages/finanzas.js`

**Interfaces:**
- Consumes: `BNK_DB.partners` (.list, .create, .update, .delete), `BNK_DB.cotizacionPartners` (.list), `BNK_AUTH.currentUser()` (returns `{uid, email}` or null), `BNK_AUTH.onReady(callback)`, `BNKToast.ok/warn/error(msg)`, DOM IDs from Task 2
- Produces: IIFE module. Internal functions `_renderPartners()`, `_openPartnerModal(id)`, `_savePartner()`, `_deletePartner(id)`, `_generarFolioPTR()`. These are internal — no window exports needed. Later tasks (5, 6) will add to this same file.

- [ ] **Step 1: Create finanzas.js with IIFE shell and Partners CRUD**

Create `panel/js/pages/finanzas.js`:

```js
// finanzas.js — Módulo FINANZAS para el Panel BUNKER
// Sub-tabs: Cuentas por Pagar, Partners, Dispersiones
(function () {
  'use strict';

  var _partners = [];
  var _pagos = [];
  var _cotPartners = []; // cotizacionPartners
  var _cotizaciones = [];
  var _proveedores = [];
  var _isAdmin = false;

  function init() {
    _checkAdmin();
    _loadData();
    _bindPartnerEvents();
  }

  function _checkAdmin() {
    var user = BNK_AUTH.currentUser();
    if (!user) return;
    BNK_DB.usuarios.get(user.uid).then(function (u) {
      _isAdmin = u && u.rol === 'admin';
      if (_isAdmin) {
        document.getElementById('sec-finanzas').classList.add('fin-admin-visible');
      }
    });
  }

  function _loadData() {
    Promise.all([
      BNK_DB.partners.list(),
      BNK_DB.pagos.list(),
      BNK_DB.cotizacionPartners.list(),
      BNK_DB.cotizaciones.list(),
      BNK_DB.proveedores.list()
    ]).then(function (results) {
      _partners = results[0];
      _pagos = results[1];
      _cotPartners = results[2];
      _cotizaciones = results[3];
      _proveedores = results[4];
      _renderPartners();
      _renderCuentas();
      _renderDispersiones();
      _renderKPIs();
    });
  }

  // ── Utilidades ──
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }
  function _modal(id, show) {
    var el = document.getElementById(id);
    if (el) { if (show) el.classList.add('visible'); else el.classList.remove('visible'); }
  }

  function _generarFolioPTR() {
    var max = 0;
    _partners.forEach(function (p) {
      var m = (p.folio || '').match(/PTR-(\d+)/);
      if (m) { var n = parseInt(m[1]); if (n > max) max = n; }
    });
    return 'PTR-' + String(max + 1).padStart(4, '0');
  }

  // ══════════════════════════════════════
  // PARTNERS CRUD
  // ══════════════════════════════════════

  function _renderPartners() {
    var search = (document.getElementById('finPartnerSearch') || {}).value || '';
    search = search.trim().toLowerCase();

    var filtered = _partners.filter(function (p) {
      if (!search) return true;
      return [p.nombre, p.nombreComercial, p.contacto, p.correo, p.folio].join(' ').toLowerCase().indexOf(search) !== -1;
    });

    var body = document.getElementById('finPartnersBody');
    var empty = document.getElementById('finPartnersEmpty');
    if (!body) return;

    if (filtered.length === 0) {
      body.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    var html = '';
    filtered.forEach(function (p) {
      var cotCount = _cotPartners.filter(function (cp) { return cp.partnerId === p.id; }).length;
      var estado = p.cuentaActiva === 'No' ? 'Inactivo' : 'Activo';
      html += '<tr>'
        + '<td class="col-folio">' + _esc(p.folio) + '</td>'
        + '<td>' + _esc(p.nombre) + '</td>'
        + '<td>' + _esc(p.contacto || '') + '</td>'
        + '<td>' + _esc(p.correo || '') + '</td>'
        + '<td>' + _esc(p.telefono || '') + '</td>'
        + '<td>' + cotCount + '</td>'
        + '<td><span class="estado-badge ' + (estado === 'Activo' ? 'estado-Cerrada' : 'estado-Perdida') + '">' + estado + '</span></td>'
        + '<td>'
        + '<button class="tbl-action tbl-action--edit fin-admin-only" data-ptr-edit="' + p.id + '" title="Editar">&#9998;</button>'
        + '<button class="tbl-action tbl-action--del fin-admin-only" data-ptr-del="' + p.id + '" title="Eliminar">&times;</button>'
        + '</td>'
        + '</tr>';
    });
    body.innerHTML = html;
  }

  function _openPartnerModal(id) {
    var isNew = !id;
    document.getElementById('finPartnerModalTitle').textContent = isNew ? 'NUEVO PARTNER' : 'EDITAR PARTNER';
    document.getElementById('finPartnerId').value = id || '';

    // Reset tabs to General
    document.querySelectorAll('[data-ptr-tab]').forEach(function (t) { t.classList.remove('active'); });
    document.querySelector('[data-ptr-tab="general"]').classList.add('active');
    document.getElementById('ptrTabGeneral').style.display = '';
    document.getElementById('ptrTabContacto').style.display = 'none';
    document.getElementById('ptrTabBancarios').style.display = 'none';

    var fields = ['ptrNombre','ptrNombreComercial','ptrTipoPersona','ptrCuentaActiva',
      'ptrObservaciones','ptrContacto','ptrPuesto','ptrCorreo','ptrTelefono',
      'ptrBanco','ptrClabe','ptrTitular','ptrTipoCuenta',
      'ptrBancoExtranjero','ptrDivisa','ptrCuentaIBAN','ptrSwift'];

    if (isNew) {
      fields.forEach(function (f) { var el = document.getElementById(f); if (el) el.value = ''; });
      document.getElementById('ptrCuentaActiva').value = 'Sí';
      document.getElementById('ptrCotizaciones').innerHTML = 'Sin cotizaciones vinculadas.';
    } else {
      var p = _partners.find(function (x) { return x.id === id; });
      if (!p) return;
      document.getElementById('ptrNombre').value = p.nombre || '';
      document.getElementById('ptrNombreComercial').value = p.nombreComercial || '';
      document.getElementById('ptrTipoPersona').value = p.tipoPersona || '';
      document.getElementById('ptrCuentaActiva').value = p.cuentaActiva || 'Sí';
      document.getElementById('ptrObservaciones').value = p.observaciones || '';
      document.getElementById('ptrContacto').value = p.contacto || '';
      document.getElementById('ptrPuesto').value = p.puesto || '';
      document.getElementById('ptrCorreo').value = p.correo || '';
      document.getElementById('ptrTelefono').value = p.telefono || '';
      document.getElementById('ptrBanco').value = p.banco || '';
      document.getElementById('ptrClabe').value = p.clabe || '';
      document.getElementById('ptrTitular').value = p.titular || '';
      document.getElementById('ptrTipoCuenta').value = p.tipoCuenta || '';
      document.getElementById('ptrBancoExtranjero').value = p.bancoExtranjero || '';
      document.getElementById('ptrDivisa').value = p.divisa || '';
      document.getElementById('ptrCuentaIBAN').value = p.cuentaIBAN || '';
      document.getElementById('ptrSwift').value = p.swift || '';

      // Cotizaciones vinculadas
      var cots = _cotPartners.filter(function (cp) { return cp.partnerId === id; });
      if (cots.length === 0) {
        document.getElementById('ptrCotizaciones').innerHTML = 'Sin cotizaciones vinculadas.';
      } else {
        var ch = '';
        cots.forEach(function (cp) {
          var pagosPartner = _pagos.filter(function (pg) { return pg.destinatarioId === id && pg.cotizacionId === cp.cotizacionId; });
          var totalPagado = pagosPartner.reduce(function (s, pg) { return s + (pg.monto || 0); }, 0);
          var estado = cp.cerrada ? 'Cerrada' : (totalPagado > 0 ? 'Parcial' : 'Pendiente');
          ch += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd);font-size:13px">'
            + '<span style="color:var(--g);font-family:\'Space Mono\',monospace;font-size:12px">' + _esc(cp.cotizacionFolio) + '</span>'
            + '<span>' + _formatMXN(totalPagado) + ' pagado</span>'
            + '<span class="estado-badge estado-' + estado + '">' + estado + '</span>'
            + '</div>';
        });
        document.getElementById('ptrCotizaciones').innerHTML = ch;
      }
    }
    _modal('finPartnerOverlay', true);
  }

  function _savePartner() {
    var nombre = document.getElementById('ptrNombre').value.trim();
    if (!nombre) { BNKToast.warn('El nombre es requerido.'); return; }

    var data = {
      nombre: nombre,
      nombreComercial: document.getElementById('ptrNombreComercial').value.trim(),
      tipoPersona: document.getElementById('ptrTipoPersona').value,
      cuentaActiva: document.getElementById('ptrCuentaActiva').value,
      observaciones: document.getElementById('ptrObservaciones').value.trim(),
      contacto: document.getElementById('ptrContacto').value.trim(),
      puesto: document.getElementById('ptrPuesto').value.trim(),
      correo: document.getElementById('ptrCorreo').value.trim(),
      telefono: document.getElementById('ptrTelefono').value.trim(),
      rfc: '',
      curp: '',
      regimenFiscal: '',
      banco: document.getElementById('ptrBanco').value.trim(),
      clabe: document.getElementById('ptrClabe').value.trim(),
      titular: document.getElementById('ptrTitular').value.trim(),
      tipoCuenta: document.getElementById('ptrTipoCuenta').value.trim(),
      bancoExtranjero: document.getElementById('ptrBancoExtranjero').value.trim(),
      divisa: document.getElementById('ptrDivisa').value.trim(),
      cuentaIBAN: document.getElementById('ptrCuentaIBAN').value.trim(),
      swift: document.getElementById('ptrSwift').value.trim()
    };

    var id = document.getElementById('finPartnerId').value;
    var promise;
    if (id) {
      promise = BNK_DB.partners.update(id, data);
    } else {
      data.folio = _generarFolioPTR();
      promise = BNK_DB.partners.create(data);
    }

    promise.then(function () {
      BNKToast.ok(id ? 'Partner actualizado.' : 'Partner creado.');
      _modal('finPartnerOverlay', false);
      _loadData();
    }).catch(function (err) {
      BNKToast.error('Error: ' + err.message);
    });
  }

  function _deletePartner(id) {
    if (!confirm('¿Eliminar este partner?')) return;
    BNK_DB.partners.delete(id).then(function () {
      BNKToast.ok('Partner eliminado.');
      _loadData();
    }).catch(function (err) {
      BNKToast.error('Error: ' + err.message);
    });
  }

  function _bindPartnerEvents() {
    document.getElementById('finBtnNuevoPartner').addEventListener('click', function () { _openPartnerModal(null); });
    document.getElementById('finPartnerGuardar').addEventListener('click', _savePartner);
    document.getElementById('finPartnerCancel').addEventListener('click', function () { _modal('finPartnerOverlay', false); });
    document.getElementById('finPartnerClose').addEventListener('click', function () { _modal('finPartnerOverlay', false); });

    document.getElementById('finPartnersBody').addEventListener('click', function (e) {
      var editBtn = e.target.closest('[data-ptr-edit]');
      if (editBtn) { _openPartnerModal(editBtn.getAttribute('data-ptr-edit')); return; }
      var delBtn = e.target.closest('[data-ptr-del]');
      if (delBtn) { _deletePartner(delBtn.getAttribute('data-ptr-del')); }
    });

    var searchEl = document.getElementById('finPartnerSearch');
    if (searchEl) searchEl.addEventListener('input', _renderPartners);
  }

  // ══════════════════════════════════════
  // CUENTAS POR PAGAR (placeholder — Task 5)
  // ══════════════════════════════════════
  function _renderCuentas() { /* Task 5 */ }
  function _renderKPIs() { /* Task 5 */ }

  // ══════════════════════════════════════
  // DISPERSIONES (placeholder — Task 6)
  // ══════════════════════════════════════
  function _renderDispersiones() { /* Task 5/6 */ }

  // ── Init ──
  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });
})();
```

- [ ] **Step 2: Test Partners CRUD**

Deploy. Navigate to FINANZAS → PARTNERS.
1. Click "+ NUEVO PARTNER" — modal opens with 3 tabs
2. Fill in nombre "Test Partner", contacto "Juan", correo "test@test.com"
3. Switch to Bancarios tab — fields visible
4. Click GUARDAR — toast "Partner creado." appears
5. Partner appears in table with folio PTR-0001
6. Click edit icon — modal populates with saved data
7. Change nombre, save — toast "Partner actualizado."
8. Click delete icon — confirm → toast "Partner eliminado."

- [ ] **Step 3: Commit**

```bash
git add panel/js/pages/finanzas.js
git commit -m "feat(finanzas): add finanzas.js with Partners CRUD sub-tab"
```

---

### Task 5: finanzas.js — Cuentas por Pagar sub-tab + KPIs

**Files:**
- Modify: `panel/js/pages/finanzas.js` — replace `_renderCuentas()`, `_renderKPIs()` placeholders, add `_bindCuentasEvents()`, `_openPagoModal()`, `_savePago()`, `_openDetalleModal()`, autocomplete for cotización

**Interfaces:**
- Consumes: `BNK_DB.pagos` (.create), `BNK_DB.cotizaciones` (.list), `BNK_DB.proveedores` (.list), `_pagos`, `_cotPartners`, `_cotizaciones`, `_proveedores`, `_partners` arrays from `_loadData()`, DOM IDs from Task 2
- Produces: `_renderCuentas()` builds the Cuentas por Pagar table, `_renderKPIs()` updates the 4 KPI cards, `_openPagoModal(opts)` opens the Registrar Pago modal optionally pre-filled, `_openDetalleModal(cotizacionId, destinatarioId, tipo)` opens the detail/parcialidades modal

- [ ] **Step 1: Replace _renderKPIs placeholder**

In `finanzas.js`, replace `function _renderKPIs() { /* Task 5 */ }` with:

```js
  function _renderKPIs() {
    // Total pagado (all time for now)
    var totalPagado = _pagos.reduce(function (s, p) { return s + (p.monto || 0); }, 0);
    document.getElementById('finKpiPagado').textContent = _formatMXN(totalPagado);

    // Pendiente proveedores: unique cotizacionId+destinatarioId combos with tipo=proveedor, not cerrada
    var provCuentas = _buildCuentasAgrupadas().filter(function (c) { return c.tipo === 'proveedor' && !c.cerrada; });
    document.getElementById('finKpiPendProv').textContent = provCuentas.length;

    // Pendiente partners: cotizacionPartners not cerrada
    var pendPartners = _cotPartners.filter(function (cp) { return !cp.cerrada; }).length;
    document.getElementById('finKpiPendPart').textContent = pendPartners;

    // Pagos del mes
    var now = new Date();
    var mesActual = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var pagosMes = _pagos.filter(function (p) { return (p.fechaPago || '').substring(0, 7) === mesActual; }).length;
    document.getElementById('finKpiMes').textContent = pagosMes;
  }
```

- [ ] **Step 2: Add _buildCuentasAgrupadas helper**

In `finanzas.js`, after the `_generarFolioPTR` function, add:

```js
  // Construye array de "cuentas" agrupando pagos por cotización+destinatario
  // y merge con cotizacionPartners (partners sin pagos aún)
  function _buildCuentasAgrupadas() {
    var map = {}; // key = cotizacionId|destinatarioId

    // 1. Agrupar pagos existentes
    _pagos.forEach(function (p) {
      var key = p.cotizacionId + '|' + p.destinatarioId;
      if (!map[key]) {
        map[key] = {
          cotizacionId: p.cotizacionId,
          cotizacionFolio: p.cotizacionFolio,
          destinatarioId: p.destinatarioId,
          destinatarioNombre: p.destinatarioNombre,
          tipo: p.tipo,
          totalPagado: 0,
          ultimoPago: '',
          cerrada: false,
          pagos: []
        };
      }
      map[key].totalPagado += (p.monto || 0);
      map[key].pagos.push(p);
      if (!map[key].ultimoPago || p.fechaPago > map[key].ultimoPago) {
        map[key].ultimoPago = p.fechaPago;
      }
    });

    // 2. Agregar cotizacionPartners sin pagos aún
    _cotPartners.forEach(function (cp) {
      var key = cp.cotizacionId + '|' + cp.partnerId;
      if (!map[key]) {
        map[key] = {
          cotizacionId: cp.cotizacionId,
          cotizacionFolio: cp.cotizacionFolio,
          destinatarioId: cp.partnerId,
          destinatarioNombre: cp.partnerNombre,
          tipo: 'partner',
          totalPagado: 0,
          ultimoPago: '',
          cerrada: cp.cerrada || false,
          pagos: []
        };
      } else {
        map[key].cerrada = cp.cerrada || false;
      }
    });

    return Object.keys(map).map(function (k) { return map[k]; });
  }
```

- [ ] **Step 3: Replace _renderCuentas placeholder**

Replace `function _renderCuentas() { /* Task 5 */ }` with:

```js
  function _renderCuentas() {
    var cuentas = _buildCuentasAgrupadas();

    // Apply filters
    var search = (document.getElementById('finCuentasSearch') || {}).value || '';
    search = search.trim().toLowerCase();
    var tipoFilter = (document.getElementById('finCuentasTipo') || {}).value || '';
    var estadoFilter = (document.getElementById('finCuentasEstado') || {}).value || '';

    cuentas = cuentas.filter(function (c) {
      if (search && [c.cotizacionFolio, c.destinatarioNombre].join(' ').toLowerCase().indexOf(search) === -1) return false;
      if (tipoFilter && c.tipo !== tipoFilter) return false;
      var estado = c.cerrada ? 'Cerrada' : (c.totalPagado > 0 ? 'Parcial' : 'Pendiente');
      if (estadoFilter && estado !== estadoFilter) return false;
      return true;
    });

    var body = document.getElementById('finCuentasBody');
    var empty = document.getElementById('finCuentasEmpty');
    if (!body) return;

    if (cuentas.length === 0) {
      body.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    var html = '';
    cuentas.forEach(function (c) {
      var estado = c.cerrada ? 'Cerrada' : (c.totalPagado > 0 ? 'Parcial' : 'Pendiente');
      var tipoBadge = c.tipo === 'partner' ? 'tipo-partner' : 'tipo-proveedor';
      html += '<tr data-cot-id="' + c.cotizacionId + '" data-dest-id="' + c.destinatarioId + '" data-tipo="' + c.tipo + '">'
        + '<td class="col-folio">' + _esc(c.cotizacionFolio) + '</td>'
        + '<td><span class="tipo-badge ' + tipoBadge + '">' + _esc(c.tipo) + '</span></td>'
        + '<td>' + _esc(c.destinatarioNombre) + '</td>'
        + '<td class="col-total">' + _formatMXN(c.totalPagado) + '</td>'
        + '<td>' + _esc(c.ultimoPago || '—') + '</td>'
        + '<td><span class="estado-badge estado-' + estado + '">' + estado + '</span></td>'
        + '<td>'
        + '<button class="tbl-action tbl-action--edit fin-admin-only" data-cuenta-pago="1" title="+ Pago">$+</button>'
        + '<button class="tbl-action" data-cuenta-ver="1" title="Ver detalle">&#128269;</button>'
        + '</td>'
        + '</tr>';
    });
    body.innerHTML = html;
  }
```

- [ ] **Step 4: Add cotización autocomplete helper**

After `_buildCuentasAgrupadas`, add:

```js
  function _setupCotAutocomplete(inputId, autoId, hiddenId) {
    var input = document.getElementById(inputId);
    var dropdown = document.getElementById(autoId);
    if (!input || !dropdown) return;

    input.addEventListener('input', function () {
      var val = input.value.trim().toLowerCase();
      if (val.length < 2) { dropdown.classList.remove('visible'); return; }
      var matches = _cotizaciones.filter(function (c) {
        return (c.folio || '').toLowerCase().indexOf(val) !== -1 || (c.cliente || c.empresa || '').toLowerCase().indexOf(val) !== -1;
      });
      var html = '';
      matches.slice(0, 8).forEach(function (c) {
        html += '<div class="bnk-ac-item" data-cot-id="' + c.id + '" data-cot-folio="' + _esc(c.folio) + '">'
          + _esc(c.folio) + ' — ' + _esc(c.cliente || c.empresa || '') + '</div>';
      });
      dropdown.innerHTML = html || '<div class="bnk-ac-item bnk-ac-new">Sin resultados</div>';
      dropdown.classList.add('visible');
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.bnk-ac-item');
      if (!item || item.classList.contains('bnk-ac-new')) { dropdown.classList.remove('visible'); return; }
      input.value = item.getAttribute('data-cot-folio') || '';
      document.getElementById(hiddenId).value = item.getAttribute('data-cot-id') || '';
      dropdown.classList.remove('visible');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#' + inputId) && !e.target.closest('#' + autoId)) {
        dropdown.classList.remove('visible');
      }
    });
  }
```

- [ ] **Step 5: Add _openPagoModal and _savePago**

After the autocomplete helper, add:

```js
  function _openPagoModal(opts) {
    opts = opts || {};
    document.getElementById('finPagoCotizacion').value = opts.folio || '';
    document.getElementById('finPagoCotId').value = opts.cotizacionId || '';
    document.getElementById('finPagoTipo').value = opts.tipo || 'proveedor';
    document.getElementById('finPagoMonto').value = '';
    document.getElementById('finPagoFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('finPagoMetodo').value = 'Transferencia';
    document.getElementById('finPagoRef').value = '';
    document.getElementById('finPagoNotas').value = '';
    _populateDestinatarios(opts.tipo || 'proveedor', opts.destinatarioId || '');
    _modal('finPagoOverlay', true);
  }

  function _populateDestinatarios(tipo, selectedId) {
    var select = document.getElementById('finPagoDest');
    var list = tipo === 'partner' ? _partners : _proveedores;
    var html = '<option value="">— Seleccionar —</option>';
    list.forEach(function (item) {
      var nombre = item.nombre || item.razonSocial || item.nombreComercial || '';
      var sel = item.id === selectedId ? ' selected' : '';
      html += '<option value="' + item.id + '"' + sel + '>' + _esc(nombre) + '</option>';
    });
    select.innerHTML = html;
  }

  function _savePago() {
    var cotId = document.getElementById('finPagoCotId').value;
    var cotFolio = document.getElementById('finPagoCotizacion').value.trim();
    var tipo = document.getElementById('finPagoTipo').value;
    var destId = document.getElementById('finPagoDest').value;
    var monto = parseFloat(document.getElementById('finPagoMonto').value) || 0;
    var fecha = document.getElementById('finPagoFecha').value;

    if (!cotId) { BNKToast.warn('Selecciona una cotización.'); return; }
    if (!destId) { BNKToast.warn('Selecciona un destinatario.'); return; }
    if (monto <= 0) { BNKToast.warn('El monto debe ser mayor a 0.'); return; }
    if (!fecha) { BNKToast.warn('La fecha es requerida.'); return; }

    var destList = tipo === 'partner' ? _partners : _proveedores;
    var dest = destList.find(function (d) { return d.id === destId; });
    var destNombre = dest ? (dest.nombre || dest.razonSocial || dest.nombreComercial || '') : '';

    var user = BNK_AUTH.currentUser();
    var data = {
      tipo: tipo,
      destinatarioId: destId,
      destinatarioNombre: destNombre,
      cotizacionId: cotId,
      cotizacionFolio: cotFolio,
      monto: monto,
      fechaPago: fecha,
      metodoPago: document.getElementById('finPagoMetodo').value,
      referencia: document.getElementById('finPagoRef').value.trim(),
      notas: document.getElementById('finPagoNotas').value.trim(),
      registradoPor: user ? user.uid : ''
    };

    BNK_DB.pagos.create(data).then(function () {
      BNKToast.ok('Pago registrado.');
      _modal('finPagoOverlay', false);
      _loadData();
    }).catch(function (err) {
      BNKToast.error('Error: ' + err.message);
    });
  }
```

- [ ] **Step 6: Add _openDetalleModal**

```js
  function _openDetalleModal(cotizacionId, destinatarioId, tipo) {
    var cot = _cotizaciones.find(function (c) { return c.id === cotizacionId; });
    var destList = tipo === 'partner' ? _partners : _proveedores;
    var dest = destList.find(function (d) { return d.id === destinatarioId; });

    document.getElementById('finDetalleTitle').textContent = 'DETALLE — ' + (cot ? cot.folio : '') + ' → ' + (dest ? (dest.nombre || dest.razonSocial || '') : '');

    // Info
    var infoHtml = '<div class="fin-info-grid">'
      + '<div class="fin-info-item"><div class="fin-info-label">FOLIO</div><div class="fin-info-value">' + _esc(cot ? cot.folio : '') + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">CLIENTE</div><div class="fin-info-value">' + _esc(cot ? (cot.cliente || cot.empresa || '') : '') + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">EVENTO</div><div class="fin-info-value">' + _esc(cot ? cot.evento : '') + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">TOTAL COT.</div><div class="fin-info-value">' + _formatMXN(cot ? cot.total : 0) + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">DESTINATARIO</div><div class="fin-info-value">' + _esc(dest ? (dest.nombre || dest.razonSocial || '') : '') + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">BANCO / CLABE</div><div class="fin-info-value">' + _esc(dest ? (dest.banco || '') : '') + ' — ' + _esc(dest ? (dest.clabe || dest.CLABE || '') : '') + '</div></div>'
      + '</div>';
    document.getElementById('finDetalleInfo').innerHTML = infoHtml;

    // Pagos (parcialidades)
    var pagosFiltrados = _pagos.filter(function (p) {
      return p.cotizacionId === cotizacionId && p.destinatarioId === destinatarioId;
    });
    var pagosHtml = '';
    if (pagosFiltrados.length === 0) {
      pagosHtml = '<tr><td colspan="5" style="text-align:center;color:var(--tx)">Sin pagos registrados</td></tr>';
    } else {
      pagosFiltrados.forEach(function (p) {
        pagosHtml += '<tr>'
          + '<td>' + _esc(p.fechaPago) + '</td>'
          + '<td class="col-total">' + _formatMXN(p.monto) + '</td>'
          + '<td>' + _esc(p.metodoPago || '') + '</td>'
          + '<td>' + _esc(p.referencia || '—') + '</td>'
          + '<td>' + _esc(p.registradoPor || '') + '</td>'
          + '</tr>';
      });
    }
    document.getElementById('finDetallePagos').innerHTML = pagosHtml;

    // Check if cerrada (for cotizacionPartners)
    var cerrarBtn = document.getElementById('finDetalleCerrar');
    var cpRecord = _cotPartners.find(function (cp) { return cp.cotizacionId === cotizacionId && cp.partnerId === destinatarioId; });
    if (cpRecord) {
      cerrarBtn.textContent = cpRecord.cerrada ? 'REABRIR CUENTA' : 'MARCAR COMO CERRADA';
      cerrarBtn.onclick = function () {
        BNK_DB.cotizacionPartners.update(cpRecord.id, { cerrada: !cpRecord.cerrada }).then(function () {
          BNKToast.ok(cpRecord.cerrada ? 'Cuenta reabierta.' : 'Cuenta marcada como cerrada.');
          _modal('finDetalleOverlay', false);
          _loadData();
        });
      };
      cerrarBtn.style.display = '';
    } else {
      // For proveedores there's no cotizacionPartners record — hide cerrar btn
      cerrarBtn.style.display = 'none';
    }

    // Agregar pago button
    document.getElementById('finDetalleAgregar').onclick = function () {
      _modal('finDetalleOverlay', false);
      _openPagoModal({ cotizacionId: cotizacionId, folio: cot ? cot.folio : '', tipo: tipo, destinatarioId: destinatarioId });
    };

    _modal('finDetalleOverlay', true);
  }
```

- [ ] **Step 7: Add _bindCuentasEvents and wire it into init**

After `_openDetalleModal`, add:

```js
  function _bindCuentasEvents() {
    _setupCotAutocomplete('finPagoCotizacion', 'finPagoCotAuto', 'finPagoCotId');

    document.getElementById('finBtnRegistrarPago').addEventListener('click', function () { _openPagoModal(); });
    document.getElementById('finPagoGuardar').addEventListener('click', _savePago);
    document.getElementById('finPagoCancel').addEventListener('click', function () { _modal('finPagoOverlay', false); });
    document.getElementById('finPagoClose').addEventListener('click', function () { _modal('finPagoOverlay', false); });
    document.getElementById('finDetalleClose').addEventListener('click', function () { _modal('finDetalleOverlay', false); });

    // Tipo change → repopulate destinatarios
    document.getElementById('finPagoTipo').addEventListener('change', function () {
      _populateDestinatarios(this.value, '');
    });

    // Filters
    ['finCuentasSearch', 'finCuentasTipo', 'finCuentasEstado'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', _renderCuentas);
    });

    // Table clicks
    document.getElementById('finCuentasBody').addEventListener('click', function (e) {
      var tr = e.target.closest('tr');
      if (!tr) return;
      var cotId = tr.getAttribute('data-cot-id');
      var destId = tr.getAttribute('data-dest-id');
      var tipo = tr.getAttribute('data-tipo');

      if (e.target.closest('[data-cuenta-pago]')) {
        var cot = _cotizaciones.find(function (c) { return c.id === cotId; });
        _openPagoModal({ cotizacionId: cotId, folio: cot ? cot.folio : '', tipo: tipo, destinatarioId: destId });
        return;
      }
      if (e.target.closest('[data-cuenta-ver]')) {
        _openDetalleModal(cotId, destId, tipo);
      }
    });
  }
```

Then update the `init()` function to also call `_bindCuentasEvents()`:

```js
  function init() {
    _checkAdmin();
    _loadData();
    _bindPartnerEvents();
    _bindCuentasEvents();
  }
```

- [ ] **Step 8: Test Cuentas por Pagar**

Deploy. Navigate to FINANZAS → CUENTAS POR PAGAR.
1. KPIs show $0, 0, 0, 0
2. Click "+ REGISTRAR PAGO" — modal opens
3. Type a folio in the cotización field — autocomplete shows matches
4. Select a cotización, tipo=Proveedor, select a proveedor, enter monto $5000, fecha, método
5. Click GUARDAR — toast "Pago registrado."
6. Pago appears in the table: folio, tipo=proveedor, destinatario, $5,000, estado=Parcial
7. Click the eye icon — detalle modal shows info + parcialidad in the table
8. KPIs update: TOTAL PAGADO = $5,000, PAGOS DEL MES = 1

- [ ] **Step 9: Commit**

```bash
git add panel/js/pages/finanzas.js
git commit -m "feat(finanzas): add Cuentas por Pagar sub-tab with KPIs, pagos, detalle modal"
```

---

### Task 6: finanzas.js — Dispersiones sub-tab

**Files:**
- Modify: `panel/js/pages/finanzas.js` — replace `_renderDispersiones()` placeholder, add `_openAsignarModal()`, `_saveAsignacion()`, `_openDispDetalleModal()`, `_bindDispersionesEvents()`

**Interfaces:**
- Consumes: `BNK_DB.cotizacionPartners` (.create, .delete), `_cotPartners`, `_cotizaciones`, `_partners`, `_pagos` arrays, `_openPagoModal(opts)` from Task 5, DOM IDs from Task 2
- Produces: `_renderDispersiones()` builds the Dispersiones table, `_openAsignarModal()` opens the assign-partner modal, `_openDispDetalleModal(cotizacionId)` opens the dispersión detail

- [ ] **Step 1: Replace _renderDispersiones placeholder**

In `finanzas.js`, replace `function _renderDispersiones() { /* Task 5/6 */ }` with:

```js
  function _renderDispersiones() {
    // Build list of cotizaciones that have partners assigned
    var cotIds = {};
    _cotPartners.forEach(function (cp) {
      if (!cotIds[cp.cotizacionId]) cotIds[cp.cotizacionId] = [];
      cotIds[cp.cotizacionId].push(cp);
    });

    var rows = [];
    Object.keys(cotIds).forEach(function (cotId) {
      var cot = _cotizaciones.find(function (c) { return c.id === cotId; });
      if (!cot) return;
      var cps = cotIds[cotId];
      var partnerNames = cps.map(function (cp) { return cp.partnerNombre; }).join(', ');

      var isLiquidada = cot.estado === 'Cerrada' || cot.estado === 'Ejecutado';
      var allCerradas = cps.every(function (cp) { return cp.cerrada; });
      var estadoDisp;
      if (!isLiquidada) estadoDisp = 'Pendiente';
      else if (allCerradas) estadoDisp = 'Dispersado';
      else estadoDisp = 'PorDispersar';

      rows.push({
        cotizacionId: cotId,
        folio: cot.folio,
        cliente: cot.cliente || cot.empresa || '',
        evento: cot.evento || '',
        estadoCot: cot.estado || '',
        partners: partnerNames,
        estadoDisp: estadoDisp
      });
    });

    var body = document.getElementById('finDispersionesBody');
    var empty = document.getElementById('finDispersionesEmpty');
    if (!body) return;

    if (rows.length === 0) {
      body.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    var dispLabels = { Pendiente: 'Pendiente', PorDispersar: 'Por dispersar', Dispersado: 'Dispersado' };
    var html = '';
    rows.forEach(function (r) {
      html += '<tr data-disp-cot="' + r.cotizacionId + '">'
        + '<td class="col-folio">' + _esc(r.folio) + '</td>'
        + '<td>' + _esc(r.cliente) + '</td>'
        + '<td>' + _esc(r.evento) + '</td>'
        + '<td><span class="estado-badge estado-' + r.estadoCot.replace(/\s/g, '') + '">' + _esc(r.estadoCot) + '</span></td>'
        + '<td>' + _esc(r.partners) + '</td>'
        + '<td><span class="estado-badge estado-' + r.estadoDisp + '">' + _esc(dispLabels[r.estadoDisp]) + '</span></td>'
        + '<td><button class="tbl-action" data-disp-ver="1" title="Ver detalle">&#128269;</button></td>'
        + '</tr>';
    });
    body.innerHTML = html;
  }
```

- [ ] **Step 2: Add _openAsignarModal and _saveAsignacion**

```js
  function _openAsignarModal(prefillCotId) {
    document.getElementById('finAsignarCot').value = '';
    document.getElementById('finAsignarCotId').value = prefillCotId || '';

    if (prefillCotId) {
      var cot = _cotizaciones.find(function (c) { return c.id === prefillCotId; });
      if (cot) document.getElementById('finAsignarCot').value = cot.folio;
    }

    // Render partner checkboxes
    var container = document.getElementById('finAsignarPartnersList');
    var existingPartnerIds = _cotPartners.filter(function (cp) { return cp.cotizacionId === prefillCotId; }).map(function (cp) { return cp.partnerId; });

    var html = '';
    _partners.forEach(function (p) {
      if (p.cuentaActiva === 'No') return;
      var checked = existingPartnerIds.indexOf(p.id) >= 0 ? ' checked disabled' : '';
      html += '<label class="fin-partner-check">'
        + '<input type="checkbox" value="' + p.id + '" data-nombre="' + _esc(p.nombre) + '"' + checked + '>'
        + _esc(p.nombre) + (checked ? ' (ya asignado)' : '')
        + '</label>';
    });
    container.innerHTML = html || '<div style="color:var(--tx);font-size:13px;padding:12px">No hay partners activos. Crea uno primero.</div>';

    _modal('finAsignarOverlay', true);
  }

  function _saveAsignacion() {
    var cotId = document.getElementById('finAsignarCotId').value;
    if (!cotId) { BNKToast.warn('Selecciona una cotización.'); return; }

    var cot = _cotizaciones.find(function (c) { return c.id === cotId; });
    var cotFolio = cot ? cot.folio : '';

    var checkboxes = document.querySelectorAll('#finAsignarPartnersList input[type="checkbox"]:checked:not(:disabled)');
    if (checkboxes.length === 0) { BNKToast.warn('Selecciona al menos un partner nuevo.'); return; }

    var promises = [];
    checkboxes.forEach(function (cb) {
      promises.push(BNK_DB.cotizacionPartners.create({
        cotizacionId: cotId,
        cotizacionFolio: cotFolio,
        partnerId: cb.value,
        partnerNombre: cb.getAttribute('data-nombre') || '',
        cerrada: false
      }));
    });

    Promise.all(promises).then(function () {
      BNKToast.ok(checkboxes.length + ' partner(s) asignado(s).');
      _modal('finAsignarOverlay', false);
      _loadData();
    }).catch(function (err) {
      BNKToast.error('Error: ' + err.message);
    });
  }
```

- [ ] **Step 3: Add _openDispDetalleModal**

```js
  function _openDispDetalleModal(cotizacionId) {
    var cot = _cotizaciones.find(function (c) { return c.id === cotizacionId; });
    document.getElementById('finDispDetalleTitle').textContent = 'DISPERSIÓN — ' + (cot ? cot.folio : '');

    var cps = _cotPartners.filter(function (cp) { return cp.cotizacionId === cotizacionId; });

    var html = '<div class="fin-info-grid">'
      + '<div class="fin-info-item"><div class="fin-info-label">FOLIO</div><div class="fin-info-value">' + _esc(cot ? cot.folio : '') + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">CLIENTE</div><div class="fin-info-value">' + _esc(cot ? (cot.cliente || cot.empresa || '') : '') + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">EVENTO</div><div class="fin-info-value">' + _esc(cot ? cot.evento : '') + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">ESTADO</div><div class="fin-info-value">' + _esc(cot ? cot.estado : '') + '</div></div>'
      + '</div>';

    html += '<div class="bnk-section-label" style="margin-top:16px">PARTNERS ASIGNADOS</div>';

    if (cps.length === 0) {
      html += '<div style="color:var(--tx);font-size:13px;padding:12px">Sin partners asignados.</div>';
    } else {
      cps.forEach(function (cp) {
        var pagosPartner = _pagos.filter(function (p) { return p.destinatarioId === cp.partnerId && p.cotizacionId === cotizacionId; });
        var totalPagado = pagosPartner.reduce(function (s, p) { return s + (p.monto || 0); }, 0);
        var estado = cp.cerrada ? 'Cerrada' : (totalPagado > 0 ? 'Parcial' : 'Pendiente');

        html += '<div class="fin-disp-partner">'
          + '<div>'
          + '<div class="fin-disp-partner-name">' + _esc(cp.partnerNombre) + '</div>'
          + '<div style="font-size:12px;color:var(--tx)">' + _formatMXN(totalPagado) + ' pagado</div>'
          + '</div>'
          + '<div class="fin-disp-partner-actions">'
          + '<span class="estado-badge estado-' + estado + '">' + estado + '</span>';

        // Quitar partner solo si no tiene pagos
        if (pagosPartner.length === 0 && _isAdmin) {
          html += ' <button class="tbl-action tbl-action--del fin-admin-only" data-quitar-cp="' + cp.id + '" title="Quitar partner">&times;</button>';
        }

        html += '</div></div>';
      });
    }

    document.getElementById('finDispDetalleBody').innerHTML = html;

    // Bind quitar buttons
    document.getElementById('finDispDetalleBody').querySelectorAll('[data-quitar-cp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cpId = this.getAttribute('data-quitar-cp');
        if (!confirm('¿Quitar este partner de la cotización?')) return;
        BNK_DB.cotizacionPartners.delete(cpId).then(function () {
          BNKToast.ok('Partner removido.');
          _modal('finDispDetalleOverlay', false);
          _loadData();
        });
      });
    });

    // Asignar más
    document.getElementById('finDispAsignarMas').onclick = function () {
      _modal('finDispDetalleOverlay', false);
      _openAsignarModal(cotizacionId);
    };

    _modal('finDispDetalleOverlay', true);
  }
```

- [ ] **Step 4: Add _bindDispersionesEvents and wire into init**

```js
  function _bindDispersionesEvents() {
    _setupCotAutocomplete('finAsignarCot', 'finAsignarCotAuto', 'finAsignarCotId');

    document.getElementById('finBtnAsignarPartner').addEventListener('click', function () { _openAsignarModal(''); });
    document.getElementById('finAsignarGuardar').addEventListener('click', _saveAsignacion);
    document.getElementById('finAsignarCancel').addEventListener('click', function () { _modal('finAsignarOverlay', false); });
    document.getElementById('finAsignarClose').addEventListener('click', function () { _modal('finAsignarOverlay', false); });
    document.getElementById('finDispDetalleClose').addEventListener('click', function () { _modal('finDispDetalleOverlay', false); });

    document.getElementById('finDispersionesBody').addEventListener('click', function (e) {
      var tr = e.target.closest('tr');
      if (!tr) return;
      if (e.target.closest('[data-disp-ver]')) {
        _openDispDetalleModal(tr.getAttribute('data-disp-cot'));
      }
    });
  }
```

Update `init()` to also call `_bindDispersionesEvents()`:

```js
  function init() {
    _checkAdmin();
    _loadData();
    _bindPartnerEvents();
    _bindCuentasEvents();
    _bindDispersionesEvents();
  }
```

- [ ] **Step 5: Test Dispersiones**

Deploy. Navigate to FINANZAS → DISPERSIONES.
1. Click "+ ASIGNAR PARTNER" — modal opens
2. Search for a cotización, select it
3. Check one or more partners → click ASIGNAR
4. Cotización appears in Dispersiones table with estado "Pendiente"
5. Click detail icon — modal shows cotización info + assigned partners
6. From Cotizaciones tab, change that cotización's estado to "Ejecutado"
7. Go back to Dispersiones — estado changes to "Por dispersar" (yellow)
8. Register a pago to that partner from Cuentas por Pagar
9. Mark the cotizacionPartner as cerrada from the Detalle modal
10. Estado changes to "Dispersado" (green)

- [ ] **Step 6: Commit**

```bash
git add panel/js/pages/finanzas.js
git commit -m "feat(finanzas): add Dispersiones sub-tab with partner assignment and detail"
```

---

### Task 7: Deploy, verify, and update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` — add FINANZAS module documentation

**Interfaces:**
- Consumes: all previous tasks
- Produces: deployed, documented feature

- [ ] **Step 1: Deploy to Firebase**

```bash
firebase deploy --only hosting --project bunker-panel
```

- [ ] **Step 2: Publish Firestore rules manually**

Open Firebase Console → Firestore → Reglas → paste updated `firestore.rules` content → Publicar.

Note: Rules are published manually, not via CLI (Spark plan limitation).

- [ ] **Step 3: End-to-end verification**

1. Login to `bunker-panel.web.app`
2. FINANZAS tab visible in nav
3. Sub-tab switching works (Cuentas, Partners, Dispersiones)
4. Create a partner → appears in table
5. Register a pago to a proveedor → appears in Cuentas por Pagar
6. Assign partner to cotización → appears in Dispersiones
7. Non-admin user: verify buttons are hidden, data is read-only
8. KPIs update correctly

- [ ] **Step 4: Update CLAUDE.md**

Add to the Panel Operativo modules section:

```markdown
- **`finanzas.js`** (~800 lines) — módulo FINANZAS con 3 sub-tabs: Cuentas por Pagar (pagos a proveedores/partners con parcialidades), Partners CRUD (co-productores con perfil y datos bancarios), Dispersiones (rastreo de pagos a partners vinculados a cotizaciones liquidadas)
```

Add to the CSS section:

```markdown
- **`panel/css/finanzas.css`** — estilos de finanzas: sub-tabs, partner checks, info grid, dispersión rows
```

Add to Firestore collections if there's a relevant section, or note the 3 new collections: `partners`, `pagos`, `cotizacionPartners`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add FINANZAS module to CLAUDE.md"
```
