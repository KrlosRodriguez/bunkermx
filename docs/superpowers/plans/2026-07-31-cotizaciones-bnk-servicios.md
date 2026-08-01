# Cotizaciones de Servicios BNK — Plan de Implementacion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al dashboard de MUNET la capacidad de crear cotizaciones de servicios/produccion integral (folio BNK), con catalogo de precios precargados, catalogo de clientes con autocompletado, y generacion de PDF estilo BUNKER dorado.

**Architecture:** Todo vive en `cotizador-munet/dashboard.html` (HTML + CSS + JS inline, mismo patron del archivo actual). El backend es Google Apps Script con hojas nuevas en el Sheet existente. Los PDFs se generan client-side con jsPDF (misma libreria del cotizador). No hay build step ni bundler.

**Tech Stack:** HTML/CSS/JS vanilla, jsPDF 2.5.1 (CDN), Google Apps Script, Google Sheets, Google Drive.

## Global Constraints

- Idioma de UI: espanol
- Sin build tools, sin npm, sin bundler — editar archivos fuente directamente
- CSS: sin `!important`, usar custom properties de `:root` ya definidas
- Estilos del dashboard: tema neon verde/negro (variables `--g`, `--bk`, `--card`, etc.)
- PDF: estilo BUNKER dorado/terra (colores hardcoded en la funcion generadora, NO los vars del dashboard)
- Google Apps Script URL ya configurada: `https://script.google.com/macros/s/AKfycbxTDbIjGqYyyGZUiGpYc-km-flxgXkluGSaQ-dE1hFymuTgTgOvKA-wvHzjcge65PUH/exec`
- Sheet ID: `1MrynkbdpsQOq2IuzalyiRfVesUhWcs_020BDl8S_1vk`
- Drive Folder ID: `17Hm7m95pxBQFnAD9oO9Mfv0A-136zTYn`
- Logos para PDF: `cotizador-munet/js/logo-data.js` tiene `BUNKER_LOGO_B64`, necesitamos agregar `MUNET_LOGO_B64` (ya se usa en el cotizador actual, revisar si existe en logo-data.js)
- Folios BNK: formato `BNK-AAMMDD-XXXX` (4 digitos aleatorios)
- jsPDF se carga desde CDN: `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `cotizador-munet/dashboard.html` | UI completa: modal BNK, formulario de conceptos, autocompletado, CSS del modal, JS de interacciones, generacion PDF. Todo inline (mismo patron actual) |
| `cotizador-munet/google-apps-script-munet.js` | Backend: nuevos endpoints para Clientes, CotizacionesBNK, CatalogoPrecio. Archivo de referencia local — debe copiarse al editor de Apps Script |
| `cotizador-munet/js/logo-data.js` | Logos en base64 para embeber en PDFs |

---

### Task 1: Google Apps Script — Endpoints para Clientes y Catalogo

Agregar los endpoints del backend que el dashboard necesitara consumir. Esto va primero porque el frontend depende de estos datos.

**Files:**
- Modify: `cotizador-munet/google-apps-script-munet.js`

**Interfaces:**
- Consumes: Nada (es el backend, no depende de tareas anteriores)
- Produces: Endpoints GET que el frontend usara:
  - `?action=listClientes` → `{status:'ok', data:[{id,empresa,contacto,telefono,correo,nota,fechaAlta}]}`
  - `?action=createCliente&empresa=X&contacto=X&telefono=X&correo=X&nota=X` → `{status:'ok', id:'CLI-0001'}`
  - `?action=listCatalogo` → `{status:'ok', data:[{id,categoria,concepto,unidad,precio,activo}]}`
  - `?action=saveCatalogo&categoria=X&concepto=X&unidad=X&precio=X` → `{status:'ok', id:'CAT-0001'}`

- [ ] **Step 1: Agregar funcion para crear hoja Clientes con headers**

En `google-apps-script-munet.js`, despues de la linea `var DRIVE_FOLDER_ID = '17Hm7m95pxBQFnAD9oO9Mfv0A-136zTYn';`, agregar constantes para las nuevas hojas:

```javascript
var SHEET_CLIENTES = 'Clientes';
var SHEET_BNK = 'CotizacionesBNK';
var SHEET_CATALOGO = 'CatalogoPrecio';
```

Agregar funcion helper para obtener o crear una hoja:

```javascript
function getOrCreateSheet(ss, name, headers, colCount) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, colCount).setFontWeight('bold').setBackground('#050905').setFontColor('#00FF41');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
```

- [ ] **Step 2: Agregar endpoint listClientes**

Agregar funcion `listClientes()`:

```javascript
function listClientes() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_CLIENTES,
    ['ID', 'Empresa', 'Contacto', 'Teléfono', 'Correo', 'Nota', 'Fecha Alta'], 7);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', data: [] });

  var values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var clientes = values.map(function (row) {
    return {
      id: row[0], empresa: row[1], contacto: row[2],
      telefono: row[3], correo: row[4], nota: row[5], fechaAlta: row[6]
    };
  });
  return jsonResponse({ status: 'ok', data: clientes });
}
```

- [ ] **Step 3: Agregar endpoint createCliente**

Agregar funcion `createCliente(params)`:

```javascript
function createCliente(params) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_CLIENTES,
    ['ID', 'Empresa', 'Contacto', 'Teléfono', 'Correo', 'Nota', 'Fecha Alta'], 7);

  var lastRow = sheet.getLastRow();
  var newId = 'CLI-' + String(lastRow).padStart(4, '0');
  var fecha = Utilities.formatDate(new Date(), 'America/Mexico_City', 'dd/MM/yyyy');

  sheet.appendRow([
    newId,
    params.empresa || '',
    params.contacto || '',
    params.telefono || '',
    params.correo || '',
    params.nota || '',
    fecha
  ]);

  return jsonResponse({ status: 'ok', id: newId });
}
```

- [ ] **Step 4: Agregar endpoint listCatalogo**

Agregar funcion `listCatalogo()`:

```javascript
function listCatalogo() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_CATALOGO,
    ['ID', 'Categoría', 'Concepto', 'Unidad', 'Precio Sugerido', 'Activo'], 6);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', data: [] });

  var values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  var catalogo = values.filter(function (row) {
    return row[5] !== false && row[5] !== 'FALSE';
  }).map(function (row) {
    return {
      id: row[0], categoria: row[1], concepto: row[2],
      unidad: row[3], precio: row[4], activo: row[5]
    };
  });
  return jsonResponse({ status: 'ok', data: catalogo });
}
```

- [ ] **Step 5: Agregar endpoint saveCatalogo**

Agregar funcion `saveCatalogo(params)`:

```javascript
function saveCatalogo(params) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_CATALOGO,
    ['ID', 'Categoría', 'Concepto', 'Unidad', 'Precio Sugerido', 'Activo'], 6);

  var lastRow = sheet.getLastRow();
  var newId = 'CAT-' + String(lastRow).padStart(4, '0');

  sheet.appendRow([
    newId,
    params.categoria || 'Otro',
    params.concepto || '',
    params.unidad || 'servicio',
    Number(params.precio) || 0,
    true
  ]);

  return jsonResponse({ status: 'ok', id: newId });
}
```

- [ ] **Step 6: Conectar nuevos endpoints al router doGet**

Modificar la funcion `doGet(e)` existente (linea 197). Despues de la linea `if (action === 'updateStatus') {` (linea 203), agregar los nuevos cases:

```javascript
    if (action === 'updateStatus') {
      return updateStatus(params.folio, params.estado);
    }

    if (action === 'listClientes') {
      return listClientes();
    }

    if (action === 'createCliente') {
      return createCliente(params);
    }

    if (action === 'listCatalogo') {
      return listCatalogo();
    }

    if (action === 'saveCatalogo') {
      return saveCatalogo(params);
    }
```

- [ ] **Step 7: Commit**

```bash
git add cotizador-munet/google-apps-script-munet.js
git commit -m "feat(dashboard): agregar endpoints Apps Script para Clientes y CatalogoPrecio"
```

---

### Task 2: Google Apps Script — Endpoint para CotizacionesBNK

Agregar endpoints para crear y listar cotizaciones BNK, y actualizar el listado del dashboard para incluir ambos tipos.

**Files:**
- Modify: `cotizador-munet/google-apps-script-munet.js`

**Interfaces:**
- Consumes: `getOrCreateSheet()`, `jsonResponse()` de Task 1
- Produces:
  - `?action=createBNK` (POST) → `{status:'ok', folio:'BNK-260731-0001', driveLink:'...'}`
  - `?action=listBNK` → `{status:'ok', data:[...]}`
  - `?action=listAll` → `{status:'ok', data:[...]}` (MNT + BNK mezclados)
  - `?action=updateStatusBNK&folio=X&estado=X` → `{status:'ok'}`

- [ ] **Step 1: Agregar endpoint createBNK como parte de doPost**

Dentro de la funcion `doPost(e)`, al inicio del try block (despues de `var data = JSON.parse(e.postData.contents);`), agregar un branch para cotizaciones BNK:

```javascript
    // ── Branch: Cotización BNK ──
    if (data.tipoCotizacion === 'BNK') {
      return crearCotizacionBNK(data);
    }
```

Luego agregar la funcion `crearCotizacionBNK`:

```javascript
function crearCotizacionBNK(data) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var fecha = new Date();
    var fechaStr = Utilities.formatDate(fecha, 'America/Mexico_City', 'dd/MM/yyyy HH:mm');
    var folio = data.folio || 'BNK-SIN-FOLIO';

    // Subir PDF a Drive
    var driveLink = '';
    var pdfBlob = null;
    if (data.pdfBase64) {
      var fileName = 'Cotizacion-BNK-' + folio + '.pdf';
      var pdfBytes = Utilities.base64Decode(data.pdfBase64);
      pdfBlob = Utilities.newBlob(pdfBytes, 'application/pdf', fileName);
      var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      var file = folder.createFile(pdfBlob);
      driveLink = file.getUrl();
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    }

    // Guardar en hoja CotizacionesBNK
    var sheet = getOrCreateSheet(ss, SHEET_BNK,
      ['Fecha', 'Folio BNK', 'Folio MNT', 'Cliente ID', 'Empresa', 'Contacto',
       'Teléfono', 'Correo', 'Evento', 'Fecha Evento', 'Sede',
       'Conceptos', 'Condiciones', 'Subtotal', 'IVA', 'Total',
       'Link PDF', 'Estado'], 18);

    sheet.appendRow([
      fechaStr,
      folio,
      data.folioMNT || '',
      data.clienteId || '',
      data.empresa || '',
      data.contacto || '',
      data.telefono || '',
      data.correo || '',
      data.evento || '',
      data.fechaEvento || '',
      data.sede || 'MUNET',
      data.conceptos || '[]',
      data.condiciones || '',
      data.subtotal || 0,
      data.iva || 0,
      data.total || 0,
      driveLink,
      'Nueva'
    ]);

    // Email al equipo
    var adminSubject = 'Nueva cotización BNK — ' + folio + ' — ' + (data.empresa || 'Sin nombre');
    var adminBody = '🟢 Nueva cotización de servicios BUNKER\n\n'
      + '══════════════════════════════\n'
      + 'FOLIO: ' + folio + '\n'
      + (data.folioMNT ? 'VINCULADA A: ' + data.folioMNT + '\n' : '')
      + '══════════════════════════════\n\n'
      + 'Empresa: ' + (data.empresa || '—') + '\n'
      + 'Contacto: ' + (data.contacto || '—') + '\n'
      + 'Evento: ' + (data.evento || '—') + '\n'
      + 'Fecha: ' + (data.fechaEvento || '—') + '\n'
      + 'Total: $' + formatNum(data.total) + '\n\n'
      + (driveLink ? 'PDF: ' + driveLink + '\n\n' : '')
      + '— BÚNKER · Cotizaciones de Servicios';

    var mailOptions = { to: NOTIFY_EMAIL, subject: adminSubject, body: adminBody };
    if (pdfBlob) mailOptions.attachments = [pdfBlob];
    MailApp.sendEmail(mailOptions);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok', folio: folio, driveLink: driveLink
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error', message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

- [ ] **Step 2: Agregar endpoint listBNK y listAll**

```javascript
function listBNK() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_BNK,
    ['Fecha', 'Folio BNK', 'Folio MNT', 'Cliente ID', 'Empresa', 'Contacto',
     'Teléfono', 'Correo', 'Evento', 'Fecha Evento', 'Sede',
     'Conceptos', 'Condiciones', 'Subtotal', 'IVA', 'Total',
     'Link PDF', 'Estado'], 18);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', data: [] });

  var values = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
  var cotizaciones = values.map(function (row) {
    return {
      fuente: 'BNK',
      fecha: row[0], folio: row[1], folioMNT: row[2],
      clienteId: row[3], cliente: row[4], contacto: row[5],
      telefono: row[6], correo: row[7], evento: row[8],
      fechaEvento: row[9], sede: row[10],
      conceptos: row[11], condiciones: row[12],
      subtotal: row[13], iva: row[14], total: row[15],
      linkPdf: row[16], estado: row[17],
      tipo: 'Servicios', espacios: ''
    };
  });
  return jsonResponse({ status: 'ok', data: cotizaciones });
}

function listAll() {
  // Obtener MNT
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var mntData = [];
  var mntSheet = ss.getSheetByName(SHEET_NAME);
  if (mntSheet && mntSheet.getLastRow() > 1) {
    var mntValues = mntSheet.getRange(2, 1, mntSheet.getLastRow() - 1, 22).getValues();
    mntData = mntValues.map(function (row) {
      return {
        fuente: 'MNT',
        fecha: row[0], folio: row[1], cliente: row[2],
        agencia: row[3], evento: row[4], contacto: row[5],
        telefono: row[6], correo: row[7], tipo: row[8],
        fechaInicio: row[9], fechaFin: row[10], diasTotal: row[11],
        descripcion: row[12], horario: row[13], espacios: row[14],
        rentaTotal: row[15], montajeTotal: row[16],
        subtotal: row[17], iva: row[18], total: row[19],
        linkPdf: row[20], estado: row[21]
      };
    });
  }

  // Obtener BNK
  var bnkData = [];
  var bnkSheet = ss.getSheetByName(SHEET_BNK);
  if (bnkSheet && bnkSheet.getLastRow() > 1) {
    var bnkValues = bnkSheet.getRange(2, 1, bnkSheet.getLastRow() - 1, 18).getValues();
    bnkData = bnkValues.map(function (row) {
      return {
        fuente: 'BNK',
        fecha: row[0], folio: row[1], folioMNT: row[2],
        clienteId: row[3], cliente: row[4], contacto: row[5],
        telefono: row[6], correo: row[7], evento: row[8],
        fechaInicio: row[9], sede: row[10],
        tipo: 'Servicios', espacios: '',
        subtotal: row[13], iva: row[14], total: row[15],
        linkPdf: row[16], estado: row[17]
      };
    });
  }

  var allData = mntData.concat(bnkData);
  return jsonResponse({ status: 'ok', data: allData, total: allData.length });
}
```

- [ ] **Step 3: Agregar endpoint updateStatusBNK**

```javascript
function updateStatusBNK(folio, nuevoEstado) {
  if (!folio || !nuevoEstado) {
    return jsonResponse({ status: 'error', message: 'Faltan parámetros folio y estado' });
  }
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_BNK);
  if (!sheet) return jsonResponse({ status: 'error', message: 'Hoja no encontrada' });

  var lastRow = sheet.getLastRow();
  var folios = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var i = 0; i < folios.length; i++) {
    if (folios[i][0] === folio) {
      sheet.getRange(i + 2, 18).setValue(nuevoEstado);
      return jsonResponse({ status: 'ok', folio: folio, estado: nuevoEstado });
    }
  }
  return jsonResponse({ status: 'error', message: 'Folio no encontrado: ' + folio });
}
```

- [ ] **Step 4: Conectar nuevos endpoints al router doGet**

Agregar en el doGet, despues de los endpoints de Task 1:

```javascript
    if (action === 'listBNK') {
      return listBNK();
    }

    if (action === 'listAll') {
      return listAll();
    }

    if (action === 'updateStatusBNK') {
      return updateStatusBNK(params.folio, params.estado);
    }
```

- [ ] **Step 5: Commit**

```bash
git add cotizador-munet/google-apps-script-munet.js
git commit -m "feat(dashboard): agregar endpoints Apps Script para CotizacionesBNK (crear, listar, updateStatus, listAll)"
```

---

### Task 3: Dashboard — Cargar datos combinados MNT+BNK, filtro por tipo, boton Nueva BNK

Modificar el dashboard para cargar ambos tipos de cotizaciones, agregar filtro por tipo, y el boton "NUEVA COTIZACION BNK".

**Files:**
- Modify: `cotizador-munet/dashboard.html`

**Interfaces:**
- Consumes: `?action=listAll` de Task 2 (devuelve MNT + BNK con campo `fuente`)
- Produces: Variables globales `allData`, `allClientes`, `allCatalogo` disponibles para Task 4. Funciones `loadData()`, `renderTable()`, `updateIndicators()` actualizadas.

- [ ] **Step 1: Agregar script de jsPDF al head**

En `dashboard.html`, despues de la linea `<script src="js/login-gate.js"></script>` (linea 9), agregar:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" defer></script>
<script src="js/logo-data.js" defer></script>
```

- [ ] **Step 2: Agregar boton NUEVA COTIZACION BNK al nav**

En la seccion `dash-nav-right` (linea 138-142), agregar el boton antes de "ACTUALIZAR":

```html
  <div class="dash-nav-right">
    <span id="dashLastUpdate" style="font-family:'Space Mono',monospace;font-size:10px;color:var(--tx);letter-spacing:1px"></span>
    <button class="dash-btn dash-btn--accent" id="dashRefresh">ACTUALIZAR</button>
    <button class="dash-btn dash-btn--bnk" id="btnNuevaBNK">+ COTIZACION BNK</button>
    <a href="index.html" class="dash-btn">COTIZADOR</a>
  </div>
```

- [ ] **Step 3: Agregar CSS para boton BNK y tipo badge**

Agregar en la seccion `<style>`, antes de `/* ── RESPONSIVE ── */`:

```css
/* ── BNK Button ── */
.dash-btn--bnk{border-color:var(--ylw);color:var(--ylw);background:rgba(240,192,64,.06)}
.dash-btn--bnk:hover{background:rgba(240,192,64,.15);border-color:var(--ylw)}

/* ── Tipo badges ── */
.tipo-badge{display:inline-block;padding:2px 8px;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;border:1px solid}
.tipo-MNT{color:var(--g);border-color:rgba(0,255,65,.3);background:rgba(0,255,65,.06)}
.tipo-BNK{color:var(--ylw);border-color:rgba(240,192,64,.3);background:rgba(240,192,64,.06)}

/* ── Add BNK button in table ── */
.btn-add-bnk{background:none;border:1px solid rgba(240,192,64,.3);color:var(--ylw);
  font-family:'Space Mono',monospace;font-size:10px;padding:3px 8px;cursor:pointer;transition:all .2s}
.btn-add-bnk:hover{background:rgba(240,192,64,.12);border-color:var(--ylw)}

/* ── BNK count badge ── */
.bnk-count{display:inline-block;padding:1px 6px;font-family:'Space Mono',monospace;font-size:9px;
  color:var(--ylw);border:1px solid rgba(240,192,64,.3);background:rgba(240,192,64,.06);margin-left:6px}
```

- [ ] **Step 4: Agregar dropdown filtro TIPO en la barra de filtros**

En la seccion `dash-filters` (linea 170-181), agregar despues del select de estado:

```html
  <select class="dash-select" id="dashTipo">
    <option value="">TODOS LOS TIPOS</option>
    <option value="MNT">MNT (VENUES)</option>
    <option value="BNK">BNK (SERVICIOS)</option>
  </select>
```

- [ ] **Step 5: Agregar columnas TIPO y + a la tabla**

Modificar el thead de la tabla (linea 187-199). Agregar columna "+" al inicio y mantener la estructura:

```html
    <thead>
      <tr>
        <th></th>
        <th>FOLIO</th>
        <th>FECHA</th>
        <th>CLIENTE</th>
        <th>EVENTO</th>
        <th>TIPO</th>
        <th>DETALLE</th>
        <th>TOTAL</th>
        <th>ESTADO</th>
        <th>PDF</th>
      </tr>
    </thead>
```

- [ ] **Step 6: Actualizar loadData para usar listAll**

Cambiar la linea `fetch(APPS_SCRIPT_URL + '?action=list')` (linea 253) por:

```javascript
    fetch(APPS_SCRIPT_URL + '?action=listAll')
```

Ademas, despues de `allData = result.data || [];`, agregar cargas paralelas de clientes y catalogo:

```javascript
          allData = result.data || [];
          // Cargar clientes y catalogo en paralelo
          Promise.all([
            fetch(APPS_SCRIPT_URL + '?action=listClientes').then(function(r){return r.json();}),
            fetch(APPS_SCRIPT_URL + '?action=listCatalogo').then(function(r){return r.json();})
          ]).then(function(results) {
            allClientes = (results[0].status === 'ok') ? results[0].data : [];
            allCatalogo = (results[1].status === 'ok') ? results[1].data : [];
          }).catch(function(){});
```

Y agregar las variables al inicio del IIFE (despues de `var allData = [];`):

```javascript
  var allClientes = [];
  var allCatalogo = [];
```

- [ ] **Step 7: Actualizar getFilteredData para incluir filtro tipo**

En la funcion `getFilteredData()`, agregar despues del filtro de estado:

```javascript
      // Filtro tipo (MNT/BNK)
      var tipo = document.getElementById('dashTipo').value;
      if (tipo && d.fuente !== tipo) return false;
```

- [ ] **Step 8: Actualizar renderTable para mostrar ambos tipos con columna +**

Reescribir el bloque que genera cada `<tr>` en `renderTable()`. Reemplazar el `filtered.forEach(function (d) { ... })` completo:

```javascript
    filtered.forEach(function (d) {
      var estadoClass = 'estado-' + (d.estado || 'Nueva').replace(/\s/g, '');
      var tipoClass = 'tipo-' + (d.fuente || 'MNT');
      var isMNT = (d.fuente || 'MNT') === 'MNT';

      // Contar BNK vinculadas a este folio MNT
      var bnkCount = 0;
      if (isMNT) {
        bnkCount = allData.filter(function(x){ return x.fuente === 'BNK' && x.folioMNT === d.folio; }).length;
      }

      var detalleText = isMNT ? (d.espacios || '—') : 'Servicios';
      if (isMNT && bnkCount > 0) {
        detalleText += ' <span class="bnk-count">' + bnkCount + ' BNK</span>';
      }

      html += '<tr>'
        + '<td>' + (isMNT ? '<button class="btn-add-bnk" data-folio="' + escapeHTML(d.folio) + '" data-cliente="' + escapeHTML(d.cliente) + '" data-contacto="' + escapeHTML(d.contacto || '') + '" data-telefono="' + escapeHTML(d.telefono || '') + '" data-correo="' + escapeHTML(d.correo || '') + '" data-evento="' + escapeHTML(d.evento || '') + '">+</button>' : '') + '</td>'
        + '<td class="col-folio"' + (d.linkPdf ? ' onclick="window.open(\'' + escapeHTML(d.linkPdf) + '\',\'_blank\')"' : '') + '>' + escapeHTML(d.folio) + '</td>'
        + '<td>' + escapeHTML(d.fecha) + '</td>'
        + '<td>' + escapeHTML(d.cliente) + '</td>'
        + '<td>' + escapeHTML(d.evento || '—') + '</td>'
        + '<td><span class="tipo-badge ' + tipoClass + '">' + escapeHTML(d.fuente || 'MNT') + '</span></td>'
        + '<td class="col-espacios" title="' + escapeHTML(d.espacios || '') + '">' + detalleText + '</td>'
        + '<td class="col-total">' + formatMXN(d.total) + '</td>'
        + '<td>'
        +   '<div class="estado-dropdown">'
        +     '<span class="estado-badge ' + estadoClass + '" data-folio="' + escapeHTML(d.folio) + '" data-fuente="' + escapeHTML(d.fuente || 'MNT') + '">' + escapeHTML(d.estado || 'Nueva') + '</span>'
        +     '<div class="estado-options">'
        +       '<div class="estado-option" data-val="Nueva">NUEVA</div>'
        +       '<div class="estado-option" data-val="Contactada">CONTACTADA</div>'
        +       '<div class="estado-option" data-val="Cerrada">CERRADA</div>'
        +       '<div class="estado-option" data-val="Cancelada">CANCELADA</div>'
        +     '</div>'
        +   '</div>'
        + '</td>'
        + '<td>' + (d.linkPdf ? '<a href="' + escapeHTML(d.linkPdf) + '" target="_blank" class="pdf-link">VER PDF</a>' : '—') + '</td>'
        + '</tr>';
    });
```

- [ ] **Step 9: Actualizar updateEstado para soportar BNK**

Modificar la funcion `updateEstado` para usar el endpoint correcto segun fuente:

```javascript
  function updateEstado(folio, nuevoEstado, fuente) {
    if (!APPS_SCRIPT_URL) return;
    var action = (fuente === 'BNK') ? 'updateStatusBNK' : 'updateStatus';
    fetch(APPS_SCRIPT_URL + '?action=' + action + '&folio=' + encodeURIComponent(folio) + '&estado=' + encodeURIComponent(nuevoEstado))
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (result.status === 'ok') {
          allData.forEach(function (d) {
            if (d.folio === folio) d.estado = nuevoEstado;
          });
          renderTable();
          updateIndicators(allData);
        }
      })
      .catch(function () {});
  }
```

Y en el event listener que detecta click en estado-option, pasar la fuente:

```javascript
      var option = e.target.closest('.estado-option');
      if (option) {
        var dropdown = option.closest('.estado-dropdown');
        var badge = dropdown.querySelector('.estado-badge');
        var folio = badge.getAttribute('data-folio');
        var fuente = badge.getAttribute('data-fuente') || 'MNT';
        var nuevoEstado = option.getAttribute('data-val');
        updateEstado(folio, nuevoEstado, fuente);
      }
```

- [ ] **Step 10: Actualizar updateIndicators para incluir desglose MNT/BNK**

En `updateIndicators`, modificar el subtitulo del total:

```javascript
    var totalMNT = data.filter(function(d){ return (d.fuente || 'MNT') === 'MNT'; }).length;
    var totalBNK = data.filter(function(d){ return d.fuente === 'BNK'; }).length;
    document.getElementById('indTotalSub').textContent = totalMNT + ' MNT + ' + totalBNK + ' BNK';
```

- [ ] **Step 11: Agregar event listener para filtro tipo y boton +**

En el bloque `DOMContentLoaded`, agregar:

```javascript
    document.getElementById('dashTipo').addEventListener('change', renderTable);

    // Boton + para agregar BNK desde fila MNT
    document.addEventListener('click', function(e) {
      var btnAdd = e.target.closest('.btn-add-bnk');
      if (btnAdd) {
        abrirModalBNK({
          folioMNT: btnAdd.getAttribute('data-folio'),
          empresa: btnAdd.getAttribute('data-cliente'),
          contacto: btnAdd.getAttribute('data-contacto'),
          telefono: btnAdd.getAttribute('data-telefono'),
          correo: btnAdd.getAttribute('data-correo'),
          evento: btnAdd.getAttribute('data-evento')
        });
      }
    });

    // Boton global nueva BNK
    document.getElementById('btnNuevaBNK').addEventListener('click', function() {
      abrirModalBNK({});
    });
```

- [ ] **Step 12: Commit**

```bash
git add cotizador-munet/dashboard.html
git commit -m "feat(dashboard): cargar datos combinados MNT+BNK, filtro tipo, boton nueva BNK, columna +"
```

---

### Task 4: Dashboard — Modal de cotizacion BNK con formulario de conceptos

Crear el modal completo: datos del cliente con autocompletado, formulario dinamico de conceptos con catalogo precargado, selector de condiciones, y logica de calculo.

**Files:**
- Modify: `cotizador-munet/dashboard.html`

**Interfaces:**
- Consumes: `allClientes`, `allCatalogo`, `APPS_SCRIPT_URL`, `abrirModalBNK()` (llamada desde Task 3)
- Produces: Funcion `enviarCotizacionBNK()` que recopila datos, genera PDF (Task 5), y envia al backend

- [ ] **Step 1: Agregar HTML del modal**

Despues del cierre del `</footer>` (linea 209), antes del `<script>`, agregar:

```html
<!-- MODAL BNK -->
<div class="bnk-overlay" id="bnkOverlay">
  <div class="bnk-modal" id="bnkModal">
    <div class="bnk-modal-header">
      <span class="bnk-modal-title">NUEVA COTIZACION BNK</span>
      <button class="bnk-modal-close" id="bnkClose">&times;</button>
    </div>
    <div class="bnk-modal-body">

      <!-- Seccion: Datos del cliente -->
      <div class="bnk-section-label">DATOS DEL CLIENTE</div>
      <div class="bnk-form-grid">
        <div class="bnk-form-group">
          <label class="bnk-label">EMPRESA</label>
          <input type="text" class="bnk-input" id="bnkEmpresa" placeholder="Buscar o crear cliente..." autocomplete="off">
          <div class="bnk-autocomplete" id="bnkAutoEmpresa"></div>
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">CONTACTO</label>
          <input type="text" class="bnk-input" id="bnkContacto" placeholder="Nombre del contacto">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">TELEFONO</label>
          <input type="text" class="bnk-input" id="bnkTelefono" placeholder="Telefono">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">CORREO</label>
          <input type="email" class="bnk-input" id="bnkCorreo" placeholder="correo@empresa.com">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">EVENTO</label>
          <input type="text" class="bnk-input" id="bnkEvento" placeholder="Nombre del evento">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">FECHA EVENTO</label>
          <input type="date" class="bnk-input" id="bnkFechaEvento">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">SEDE</label>
          <input type="text" class="bnk-input" id="bnkSede" value="MUNET" placeholder="MUNET u otra">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">VINCULAR A FOLIO MNT</label>
          <input type="text" class="bnk-input" id="bnkFolioMNT" placeholder="Opcional — ej: MNT-260729-4129" readonly>
        </div>
        <div class="bnk-form-group bnk-form-full">
          <label class="bnk-label">NOTA INTERNA</label>
          <input type="text" class="bnk-input" id="bnkNota" placeholder="Nota opcional para el perfil del cliente">
        </div>
      </div>

      <!-- Seccion: Conceptos -->
      <div class="bnk-section-label" style="margin-top:20px">CONCEPTOS</div>
      <div class="bnk-conceptos-header">
        <span class="bnk-ch-cat">CATEGORIA</span>
        <span class="bnk-ch-con">CONCEPTO</span>
        <span class="bnk-ch-num">CANT.</span>
        <span class="bnk-ch-uni">UNIDAD</span>
        <span class="bnk-ch-pre">PRECIO UNIT.</span>
        <span class="bnk-ch-sub">SUBTOTAL</span>
        <span class="bnk-ch-del"></span>
      </div>
      <div id="bnkConceptosBody"></div>
      <button class="bnk-add-row" id="bnkAddRow">+ AGREGAR CONCEPTO</button>

      <!-- Totales -->
      <div class="bnk-totales">
        <div class="bnk-total-row"><span>SUBTOTAL (SIN IVA)</span><span id="bnkSubtotal">$0</span></div>
        <div class="bnk-total-row"><span>IVA (16%)</span><span id="bnkIVA">$0</span></div>
        <div class="bnk-total-row bnk-total-gran"><span>TOTAL</span><span id="bnkTotal">$0</span></div>
      </div>

      <!-- Condiciones -->
      <div class="bnk-section-label" style="margin-top:20px">CONDICIONES COMERCIALES</div>
      <div class="bnk-form-grid">
        <div class="bnk-form-group">
          <label class="bnk-label">PLANTILLA</label>
          <select class="bnk-input" id="bnkPlantilla">
            <option value="estandar">ESTANDAR</option>
            <option value="estructura">ESTRUCTURA PESADA</option>
            <option value="especial">EVENTO ESPECIAL</option>
          </select>
        </div>
      </div>
      <textarea class="bnk-textarea" id="bnkCondiciones" rows="8"></textarea>

    </div>
    <div class="bnk-modal-footer">
      <button class="dash-btn" id="bnkCancel">CANCELAR</button>
      <button class="dash-btn dash-btn--bnk" id="bnkGenerar">GENERAR COTIZACION</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Agregar CSS del modal**

Agregar en la seccion `<style>`, antes de `/* ── RESPONSIVE ── */`:

```css
/* ── MODAL BNK ── */
.bnk-overlay{display:none;position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.85);overflow-y:auto;padding:30px}
.bnk-overlay.visible{display:flex;justify-content:center;align-items:flex-start}
.bnk-modal{background:var(--dk);border:1px solid var(--bd);width:100%;max-width:960px;position:relative}
.bnk-modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid var(--bd);background:var(--card)}
.bnk-modal-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;letter-spacing:3px;color:var(--ylw)}
.bnk-modal-close{background:none;border:none;color:var(--tx);font-size:24px;cursor:pointer;padding:0 4px}
.bnk-modal-close:hover{color:var(--wh)}
.bnk-modal-body{padding:24px;max-height:calc(100vh - 160px);overflow-y:auto}
.bnk-modal-footer{display:flex;justify-content:flex-end;gap:12px;padding:16px 24px;border-top:1px solid var(--bd)}

.bnk-section-label{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--ylw);margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid rgba(240,192,64,.2)}

.bnk-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px}
.bnk-form-full{grid-column:1/-1}
.bnk-form-group{display:flex;flex-direction:column;gap:4px;position:relative}
.bnk-label{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--tx)}
.bnk-input{padding:8px 12px;background:var(--card);border:1px solid var(--bd);color:var(--wh);font-family:'Barlow',sans-serif;font-size:13px;outline:none;transition:border-color .3s}
.bnk-input:focus{border-color:rgba(240,192,64,.4)}
.bnk-textarea{width:100%;padding:10px 12px;background:var(--card);border:1px solid var(--bd);color:var(--wh);font-family:'Barlow',sans-serif;font-size:12px;line-height:1.6;outline:none;resize:vertical}
.bnk-textarea:focus{border-color:rgba(240,192,64,.4)}

/* Autocomplete */
.bnk-autocomplete{display:none;position:absolute;top:100%;left:0;right:0;z-index:210;background:var(--dk);border:1px solid var(--bd);max-height:160px;overflow-y:auto}
.bnk-autocomplete.visible{display:block}
.bnk-ac-item{padding:8px 12px;font-size:13px;cursor:pointer;transition:background .2s}
.bnk-ac-item:hover{background:rgba(240,192,64,.08)}
.bnk-ac-new{color:var(--ylw);font-style:italic}

/* Conceptos table */
.bnk-conceptos-header{display:grid;grid-template-columns:140px 1fr 60px 80px 110px 110px 36px;gap:6px;padding:6px 0;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--tx);border-bottom:1px solid var(--bd)}
.bnk-concepto-row{display:grid;grid-template-columns:140px 1fr 60px 80px 110px 110px 36px;gap:6px;padding:6px 0;align-items:center;border-bottom:1px solid rgba(0,255,65,.06)}
.bnk-concepto-row select,.bnk-concepto-row input{padding:6px 8px;background:var(--card);border:1px solid var(--bd);color:var(--wh);font-family:'Barlow',sans-serif;font-size:12px;outline:none}
.bnk-concepto-row select{cursor:pointer}
.bnk-concepto-row .bnk-sub-val{font-family:'Barlow Condensed',sans-serif;font-weight:700;color:var(--ylw);font-size:14px;text-align:right;padding-right:8px}
.bnk-concepto-row .bnk-del-btn{background:none;border:1px solid rgba(255,68,85,.3);color:var(--red);font-size:14px;cursor:pointer;padding:4px 8px;transition:all .2s}
.bnk-concepto-row .bnk-del-btn:hover{background:rgba(255,68,85,.12)}

.bnk-add-row{display:block;width:100%;padding:10px;background:none;border:1px dashed rgba(240,192,64,.3);color:var(--ylw);font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1px;cursor:pointer;margin-top:8px;transition:all .2s}
.bnk-add-row:hover{background:rgba(240,192,64,.06);border-color:var(--ylw)}

/* Checkbox guardar catalogo */
.bnk-save-check{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--tx);margin-top:2px}
.bnk-save-check input{accent-color:var(--ylw)}

/* Totales */
.bnk-totales{margin-top:16px;border-top:1px solid var(--bd);padding-top:12px}
.bnk-total-row{display:flex;justify-content:space-between;padding:4px 0;font-family:'Barlow Condensed',sans-serif;font-size:14px;color:var(--tx)}
.bnk-total-gran{font-size:20px;font-weight:700;color:var(--ylw);border-top:1px solid var(--ylw);padding-top:8px;margin-top:4px}
```

- [ ] **Step 3: Agregar logica JS del modal — abrir/cerrar y autocompletado de clientes**

Agregar dentro del IIFE, despues de la funcion `updateEstado`:

```javascript
  // ── PLANTILLAS DE CONDICIONES ──
  var PLANTILLAS = {
    estandar: '1. Precios más IVA.\n2. Vigencia de la cotización: 30 días.\n3. 60% de anticipo para confirmación y bloqueo de fecha.\n4. 40% restante: 5 días naturales previos al evento.\n5. Servicios y/o equipos adicionales serán cotizados por separado.\n6. Cancelaciones: una vez confirmado el servicio, el anticipo no será reembolsado.',
    estructura: '1. Precios más IVA.\n2. Vigencia de la cotización: 30 días.\n3. 60% de anticipo para confirmación y bloqueo de fecha.\n4. 40% restante: 5 días naturales previos al evento.\n5. La Estructura está sujeta a condiciones de pago específicas: 80% de anticipo y 20% al inicio de montaje.\n6. Servicios y/o equipos adicionales serán cotizados por separado.\n7. Cancelaciones: una vez confirmado el servicio, el anticipo no será reembolsado.\n8. El precio del seguro de responsabilidad civil se calculará 30 días antes del evento y deberá ser liquidado por el cliente.',
    especial: '1. Presupuesto tipo ballpark previo a brief de cliente; si los requerimientos exceden lo cotizado, se hará un ajuste.\n2. No incluye creación de arte adicional a lo especificado; en caso de requerirla, se cotizará por separado.\n3. Se requiere un mínimo de 1 mes para la realización del proyecto.\n4. Cambios en la información ya proporcionada pueden afectar los costos.\n5. 50% de anticipo para iniciar el proyecto; liquidación contraentrega.\n6. Entregables editables: costo adicional del 40% del total.\n7. Costo por cancelación: 85%.'
  };

  var CATEGORIAS = [
    'Servicios Básicos', 'Mobiliario', 'A&B', 'Estructura',
    'Contenido/Mapping', 'Suministros', 'Otro'
  ];

  var conceptoCounter = 0;

  function abrirModalBNK(prefill) {
    var overlay = document.getElementById('bnkOverlay');
    overlay.classList.add('visible');

    // Prellenar datos
    document.getElementById('bnkEmpresa').value = prefill.empresa || '';
    document.getElementById('bnkContacto').value = prefill.contacto || '';
    document.getElementById('bnkTelefono').value = prefill.telefono || '';
    document.getElementById('bnkCorreo').value = prefill.correo || '';
    document.getElementById('bnkEvento').value = prefill.evento || '';
    document.getElementById('bnkFolioMNT').value = prefill.folioMNT || '';
    document.getElementById('bnkFechaEvento').value = '';
    document.getElementById('bnkSede').value = 'MUNET';
    document.getElementById('bnkNota').value = '';

    // Condiciones default
    document.getElementById('bnkPlantilla').value = 'estandar';
    document.getElementById('bnkCondiciones').value = PLANTILLAS.estandar;

    // Limpiar conceptos y agregar una fila vacia
    document.getElementById('bnkConceptosBody').innerHTML = '';
    conceptoCounter = 0;
    agregarFilaConcepto();

    recalcularTotales();
  }

  function cerrarModalBNK() {
    document.getElementById('bnkOverlay').classList.remove('visible');
  }

  // Autocompletado de clientes
  function setupAutocompletado() {
    var input = document.getElementById('bnkEmpresa');
    var dropdown = document.getElementById('bnkAutoEmpresa');

    input.addEventListener('input', function () {
      var val = input.value.trim().toLowerCase();
      if (val.length < 2) { dropdown.classList.remove('visible'); return; }

      var matches = allClientes.filter(function (c) {
        return c.empresa.toLowerCase().indexOf(val) !== -1;
      });

      var html = '';
      matches.forEach(function (c) {
        html += '<div class="bnk-ac-item" data-id="' + c.id + '" data-empresa="' + escapeHTML(c.empresa) + '" data-contacto="' + escapeHTML(c.contacto) + '" data-telefono="' + escapeHTML(c.telefono) + '" data-correo="' + escapeHTML(c.correo) + '">' + escapeHTML(c.empresa) + '</div>';
      });

      if (matches.length === 0) {
        html = '<div class="bnk-ac-item bnk-ac-new">Crear nuevo: "' + escapeHTML(input.value.trim()) + '"</div>';
      }

      dropdown.innerHTML = html;
      dropdown.classList.add('visible');
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.bnk-ac-item');
      if (!item) return;

      if (item.classList.contains('bnk-ac-new')) {
        dropdown.classList.remove('visible');
        return;
      }

      document.getElementById('bnkEmpresa').value = item.getAttribute('data-empresa');
      document.getElementById('bnkContacto').value = item.getAttribute('data-contacto') || '';
      document.getElementById('bnkTelefono').value = item.getAttribute('data-telefono') || '';
      document.getElementById('bnkCorreo').value = item.getAttribute('data-correo') || '';
      dropdown.classList.remove('visible');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.bnk-form-group')) dropdown.classList.remove('visible');
    });
  }
```

- [ ] **Step 4: Agregar logica JS — filas de conceptos dinamicas**

Continuar en el IIFE:

```javascript
  function agregarFilaConcepto() {
    var body = document.getElementById('bnkConceptosBody');
    var id = 'c' + (conceptoCounter++);

    var catOptions = '<option value="">—</option>';
    CATEGORIAS.forEach(function (cat) {
      catOptions += '<option value="' + cat + '">' + cat + '</option>';
    });

    var row = document.createElement('div');
    row.className = 'bnk-concepto-row';
    row.id = id;
    row.innerHTML =
      '<select class="bnk-cat" data-row="' + id + '">' + catOptions + '</select>'
      + '<input type="text" class="bnk-con" data-row="' + id + '" placeholder="Buscar concepto o escribir nuevo..." list="dl-' + id + '"><datalist id="dl-' + id + '"></datalist>'
      + '<input type="number" class="bnk-cant" data-row="' + id + '" value="1" min="1" step="1">'
      + '<input type="text" class="bnk-uni" data-row="' + id + '" value="servicio" placeholder="unidad">'
      + '<input type="number" class="bnk-pre" data-row="' + id + '" value="0" min="0" step="0.01">'
      + '<span class="bnk-sub-val" data-row="' + id + '">$0</span>'
      + '<button class="bnk-del-btn" data-row="' + id + '">&times;</button>';

    body.appendChild(row);

    // Eventos
    row.querySelector('.bnk-cat').addEventListener('change', function () {
      actualizarDatalist(id);
    });

    row.querySelector('.bnk-con').addEventListener('change', function () {
      autocompletarPrecio(id);
    });

    row.querySelector('.bnk-cant').addEventListener('input', function () { recalcularFila(id); });
    row.querySelector('.bnk-pre').addEventListener('input', function () { recalcularFila(id); });

    row.querySelector('.bnk-del-btn').addEventListener('click', function () {
      row.remove();
      recalcularTotales();
    });
  }

  function actualizarDatalist(rowId) {
    var row = document.getElementById(rowId);
    var cat = row.querySelector('.bnk-cat').value;
    var dl = row.querySelector('datalist');

    var opts = '';
    allCatalogo.filter(function (c) {
      return !cat || c.categoria === cat;
    }).forEach(function (c) {
      opts += '<option value="' + escapeHTML(c.concepto) + '">';
    });
    dl.innerHTML = opts;
  }

  function autocompletarPrecio(rowId) {
    var row = document.getElementById(rowId);
    var nombreConcepto = row.querySelector('.bnk-con').value.trim();

    var found = allCatalogo.find(function (c) {
      return c.concepto === nombreConcepto;
    });

    if (found) {
      row.querySelector('.bnk-pre').value = found.precio;
      row.querySelector('.bnk-uni').value = found.unidad || 'servicio';
      if (!row.querySelector('.bnk-cat').value) {
        row.querySelector('.bnk-cat').value = found.categoria;
      }
      recalcularFila(rowId);
    }
  }

  function recalcularFila(rowId) {
    var row = document.getElementById(rowId);
    var cant = parseFloat(row.querySelector('.bnk-cant').value) || 0;
    var precio = parseFloat(row.querySelector('.bnk-pre').value) || 0;
    var sub = cant * precio;
    row.querySelector('.bnk-sub-val').textContent = formatMXN(sub);
    recalcularTotales();
  }

  function recalcularTotales() {
    var rows = document.querySelectorAll('.bnk-concepto-row');
    var subtotal = 0;
    rows.forEach(function (row) {
      var cant = parseFloat(row.querySelector('.bnk-cant').value) || 0;
      var precio = parseFloat(row.querySelector('.bnk-pre').value) || 0;
      subtotal += cant * precio;
    });
    var iva = Math.round(subtotal * 0.16);
    var total = subtotal + iva;

    document.getElementById('bnkSubtotal').textContent = formatMXN(subtotal);
    document.getElementById('bnkIVA').textContent = formatMXN(iva);
    document.getElementById('bnkTotal').textContent = formatMXN(total);
  }
```

- [ ] **Step 5: Agregar event listeners del modal en DOMContentLoaded**

Agregar en el bloque DOMContentLoaded:

```javascript
    // Modal BNK
    document.getElementById('bnkClose').addEventListener('click', cerrarModalBNK);
    document.getElementById('bnkCancel').addEventListener('click', cerrarModalBNK);
    document.getElementById('bnkOverlay').addEventListener('click', function(e) {
      if (e.target === this) cerrarModalBNK();
    });
    document.getElementById('bnkAddRow').addEventListener('click', agregarFilaConcepto);
    document.getElementById('bnkPlantilla').addEventListener('change', function() {
      document.getElementById('bnkCondiciones').value = PLANTILLAS[this.value] || '';
    });
    document.getElementById('bnkGenerar').addEventListener('click', enviarCotizacionBNK);

    setupAutocompletado();
```

- [ ] **Step 6: Commit**

```bash
git add cotizador-munet/dashboard.html
git commit -m "feat(dashboard): modal de cotizacion BNK con formulario de conceptos, autocompletado, condiciones"
```

---

### Task 5: Generacion de PDF estilo BUNKER dorado y envio al backend

Implementar la funcion que genera el PDF con jsPDF en estilo dorado/terra, lo codifica en base64, y lo envia al Apps Script.

**Files:**
- Modify: `cotizador-munet/dashboard.html`

**Interfaces:**
- Consumes: Formulario del modal (Task 4), `APPS_SCRIPT_URL`, `BUNKER_LOGO_B64` de logo-data.js
- Produces: Funcion `enviarCotizacionBNK()` completa que genera PDF, lo envia, y actualiza el dashboard

- [ ] **Step 1: Agregar funcion generarFolioBNK**

En el IIFE, agregar:

```javascript
  function generarFolioBNK() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var rand = String(Math.floor(1000 + Math.random() * 9000));
    return 'BNK-' + yy + mm + dd + '-' + rand;
  }
```

- [ ] **Step 2: Agregar funcion recopilarDatosConceptos**

```javascript
  function recopilarConceptos() {
    var rows = document.querySelectorAll('.bnk-concepto-row');
    var conceptos = [];
    rows.forEach(function (row) {
      var cat = row.querySelector('.bnk-cat').value;
      var con = row.querySelector('.bnk-con').value.trim();
      var cant = parseFloat(row.querySelector('.bnk-cant').value) || 0;
      var uni = row.querySelector('.bnk-uni').value.trim();
      var pre = parseFloat(row.querySelector('.bnk-pre').value) || 0;
      if (con && cant > 0) {
        conceptos.push({
          categoria: cat || 'Otro',
          concepto: con,
          cantidad: cant,
          unidad: uni || 'servicio',
          precioUnit: pre,
          subtotal: cant * pre
        });
      }
    });
    return conceptos;
  }
```

- [ ] **Step 3: Agregar funcion generarPdfBNK**

```javascript
  function generarPdfBNK(data) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, H = 297, margin = 20, contentW = W - margin * 2, y = 0;

    // Colores BUNKER dorado
    var COL_BG = [44, 36, 25];        // fondo header
    var COL_GOLD = [198, 163, 80];     // dorado principal
    var COL_GOLD_DK = [140, 115, 56];  // dorado oscuro
    var COL_TEXT = [51, 51, 51];       // texto principal
    var COL_WHITE = [255, 255, 255];
    var COL_BEIGE = [232, 220, 200];   // bordes tabla

    var HEADER_H = 28;
    var FOOTER_H = 20;
    var CONTENT_TOP = 36;
    var MAX_Y = H - FOOTER_H;

    function drawHeader() {
      // Fondo blanco pagina
      doc.setFillColor(255, 255, 255); doc.rect(0, 0, W, H, 'F');
      // Header bar
      doc.setFillColor(COL_BG[0], COL_BG[1], COL_BG[2]); doc.rect(0, 0, W, HEADER_H, 'F');

      // Logo BUNKER (izquierda)
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        doc.addImage(BUNKER_LOGO_B64, 'PNG', margin, 5, 30, 11);
      }

      // Titulo
      doc.setTextColor(COL_WHITE[0], COL_WHITE[1], COL_WHITE[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Cotización: ' + (data.evento || 'Evento') + ' — Producción Integral', 55, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(COL_GOLD[0], COL_GOLD[1], COL_GOLD[2]);
      var subHeader = 'Atención: ' + (data.contacto || '') + ' (' + (data.empresa || '') + ')';
      if (data.fechaEvento) subHeader += ' | Fecha Evento: ' + data.fechaEvento;
      subHeader += ' | Sede: ' + (data.sede || 'MUNET');
      doc.text(subHeader, 55, 18);
    }

    function drawFooter() {
      var fy = H - FOOTER_H + 2;
      doc.setDrawColor(COL_GOLD[0], COL_GOLD[1], COL_GOLD[2]);
      doc.setLineWidth(0.3); doc.line(margin, fy, W - margin, fy);
      fy += 5;
      doc.setFontSize(6); doc.setTextColor(COL_GOLD_DK[0], COL_GOLD_DK[1], COL_GOLD_DK[2]);
      var pageNum = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text('Pág. ' + pageNum + ' | BÚNKER Creatividad Empresarial | MUNET — Museo Nacional de Energía y Tecnología', margin, fy);

      // Logo BUNKER en footer
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        doc.addImage(BUNKER_LOGO_B64, 'PNG', W - margin - 25, H - FOOTER_H + 3, 25, 9);
      }
    }

    function checkPage(needed) {
      if (y + needed > MAX_Y) { doc.addPage(); drawHeader(); y = CONTENT_TOP; }
    }

    function drawSectionHeader(text) {
      checkPage(14);
      doc.setFillColor(COL_BG[0], COL_BG[1], COL_BG[2]);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setTextColor(COL_WHITE[0], COL_WHITE[1], COL_WHITE[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(text, margin + 4, y + 5.5);
      doc.setFont('helvetica', 'normal');
      y += 10;
    }

    function drawTableHeader(cols) {
      doc.setFillColor(245, 240, 230);
      doc.rect(margin, y, contentW, 7, 'F');
      doc.setTextColor(COL_TEXT[0], COL_TEXT[1], COL_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      cols.forEach(function(col) {
        doc.text(col.label, col.x, y + 5, col.align ? { align: col.align } : {});
      });
      doc.setFont('helvetica', 'normal');
      y += 8;
    }

    // ── Pagina 1 ──
    drawHeader();
    y = CONTENT_TOP;

    // Intro
    doc.setFontSize(8); doc.setTextColor(COL_TEXT[0], COL_TEXT[1], COL_TEXT[2]);
    var introText = 'En atención a su solicitud, BÚNKER presenta la siguiente propuesta de producción integral para el evento ' + (data.evento || '') + (data.fechaEvento ? ', a realizarse el ' + data.fechaEvento : '') + ' en las instalaciones de ' + (data.sede || 'MUNET') + '.';
    var introLines = doc.splitTextToSize(introText, contentW);
    doc.text(introLines, margin, y); y += introLines.length * 4 + 6;

    // Agrupar conceptos por categoria
    var grupos = {};
    data.conceptos.forEach(function (c) {
      if (!grupos[c.categoria]) grupos[c.categoria] = [];
      grupos[c.categoria].push(c);
    });

    var colDef = [
      { label: 'DESCRIPCIÓN', x: margin + 4 },
      { label: 'CANT.', x: margin + 95 },
      { label: 'UNIDAD', x: margin + 112 },
      { label: 'PRECIO UNIT.', x: W - margin - 35 },
      { label: 'SUBTOTAL', x: W - margin - 4, align: 'right' }
    ];

    // Tabla por cada categoria
    Object.keys(grupos).forEach(function (cat) {
      drawSectionHeader(cat.toUpperCase());
      drawTableHeader(colDef);

      var catSubtotal = 0;
      grupos[cat].forEach(function (c) {
        checkPage(7);
        doc.setFontSize(8); doc.setTextColor(COL_TEXT[0], COL_TEXT[1], COL_TEXT[2]);
        doc.text(c.concepto, margin + 4, y + 4);
        doc.text(String(c.cantidad), margin + 95, y + 4);
        doc.text(c.unidad, margin + 112, y + 4);
        doc.text(formatMXN(c.precioUnit), W - margin - 35, y + 4);
        doc.setTextColor(COL_GOLD[0], COL_GOLD[1], COL_GOLD[2]);
        doc.text(formatMXN(c.subtotal), W - margin - 4, y + 4, { align: 'right' });

        doc.setDrawColor(COL_BEIGE[0], COL_BEIGE[1], COL_BEIGE[2]);
        doc.setLineWidth(0.1); doc.line(margin, y + 6, W - margin, y + 6);
        y += 7;
        catSubtotal += c.subtotal;
      });

      // Subtotal de categoria
      checkPage(8);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.setTextColor(COL_TEXT[0], COL_TEXT[1], COL_TEXT[2]);
      doc.text('Total ' + cat + ' (sin IVA)', margin + 4, y + 4);
      doc.setTextColor(COL_GOLD[0], COL_GOLD[1], COL_GOLD[2]);
      doc.text(formatMXN(catSubtotal), W - margin - 4, y + 4, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 10;
    });

    // ── RESUMEN GENERAL ──
    checkPage(50);
    drawSectionHeader('RESUMEN GENERAL');

    var resColDef = [
      { label: 'CONCEPTO', x: margin + 4 },
      { label: 'SIN IVA', x: W - margin - 40 },
      { label: 'CON IVA (16%)', x: W - margin - 4, align: 'right' }
    ];
    drawTableHeader(resColDef);

    Object.keys(grupos).forEach(function (cat) {
      checkPage(7);
      var catSub = 0;
      grupos[cat].forEach(function (c) { catSub += c.subtotal; });
      doc.setFontSize(8); doc.setTextColor(COL_TEXT[0], COL_TEXT[1], COL_TEXT[2]);
      doc.text(cat, margin + 4, y + 4);
      doc.text(formatMXN(catSub), W - margin - 40, y + 4);
      doc.setTextColor(COL_GOLD[0], COL_GOLD[1], COL_GOLD[2]);
      doc.text(formatMXN(Math.round(catSub * 1.16)), W - margin - 4, y + 4, { align: 'right' });
      doc.setDrawColor(COL_BEIGE[0], COL_BEIGE[1], COL_BEIGE[2]);
      doc.setLineWidth(0.1); doc.line(margin, y + 6, W - margin, y + 6);
      y += 7;
    });

    // Gran total
    checkPage(10);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.setTextColor(COL_TEXT[0], COL_TEXT[1], COL_TEXT[2]);
    doc.text('Gran Total', margin + 4, y + 4);
    doc.text(formatMXN(data.subtotal), W - margin - 40, y + 4);
    doc.setTextColor(COL_GOLD[0], COL_GOLD[1], COL_GOLD[2]);
    doc.setFontSize(11);
    doc.text(formatMXN(data.total), W - margin - 4, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 12;

    // ── CONDICIONES COMERCIALES ──
    if (data.condiciones) {
      checkPage(30);
      drawSectionHeader('CONDICIONES COMERCIALES');

      var condLines = data.condiciones.split('\n');
      condLines.forEach(function (line, i) {
        checkPage(6);
        doc.setFontSize(8); doc.setTextColor(COL_TEXT[0], COL_TEXT[1], COL_TEXT[2]);
        var wrapped = doc.splitTextToSize(line, contentW - 8);
        wrapped.forEach(function(wl) {
          checkPage(5);
          doc.text(wl, margin + 4, y + 4);
          y += 5;
        });
      });
    }

    // Footers en todas las paginas
    var totalPages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter();
    }

    return doc;
  }
```

- [ ] **Step 4: Agregar funcion enviarCotizacionBNK**

```javascript
  function enviarCotizacionBNK() {
    var empresa = document.getElementById('bnkEmpresa').value.trim();
    var contacto = document.getElementById('bnkContacto').value.trim();
    if (!empresa) { alert('Ingresa el nombre de la empresa.'); return; }

    var conceptos = recopilarConceptos();
    if (conceptos.length === 0) { alert('Agrega al menos un concepto.'); return; }

    var btn = document.getElementById('bnkGenerar');
    btn.textContent = 'GENERANDO...';
    btn.disabled = true;

    var folio = generarFolioBNK();
    var subtotal = 0;
    conceptos.forEach(function (c) { subtotal += c.subtotal; });
    var iva = Math.round(subtotal * 0.16);
    var total = subtotal + iva;

    var data = {
      tipoCotizacion: 'BNK',
      folio: folio,
      folioMNT: document.getElementById('bnkFolioMNT').value.trim(),
      empresa: empresa,
      contacto: contacto,
      telefono: document.getElementById('bnkTelefono').value.trim(),
      correo: document.getElementById('bnkCorreo').value.trim(),
      evento: document.getElementById('bnkEvento').value.trim(),
      fechaEvento: document.getElementById('bnkFechaEvento').value,
      sede: document.getElementById('bnkSede').value.trim() || 'MUNET',
      conceptos: conceptos,
      condiciones: document.getElementById('bnkCondiciones').value,
      subtotal: subtotal,
      iva: iva,
      total: total
    };

    // Generar PDF
    var doc = generarPdfBNK(data);
    var pdfBase64 = doc.output('datauristring').split(',')[1];

    // Guardar/crear cliente si no existe
    var clienteExiste = allClientes.some(function(c) {
      return c.empresa.toLowerCase() === empresa.toLowerCase();
    });
    if (!clienteExiste) {
      var nota = document.getElementById('bnkNota').value.trim();
      fetch(APPS_SCRIPT_URL + '?action=createCliente'
        + '&empresa=' + encodeURIComponent(empresa)
        + '&contacto=' + encodeURIComponent(contacto)
        + '&telefono=' + encodeURIComponent(data.telefono)
        + '&correo=' + encodeURIComponent(data.correo)
        + '&nota=' + encodeURIComponent(nota)
      ).catch(function(){});
    }

    // Enviar al backend
    var payload = {
      tipoCotizacion: 'BNK',
      folio: folio,
      folioMNT: data.folioMNT,
      clienteId: '',
      empresa: empresa,
      contacto: contacto,
      telefono: data.telefono,
      correo: data.correo,
      evento: data.evento,
      fechaEvento: data.fechaEvento,
      sede: data.sede,
      conceptos: JSON.stringify(conceptos),
      condiciones: data.condiciones,
      subtotal: subtotal,
      iva: iva,
      total: total,
      pdfBase64: pdfBase64
    };

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    })
    .then(function (res) { return res.json(); })
    .then(function (result) {
      btn.textContent = 'GENERAR COTIZACION';
      btn.disabled = false;

      if (result.status === 'ok') {
        // Descargar PDF local
        doc.save('Cotizacion-BNK-' + folio + '.pdf');
        cerrarModalBNK();
        loadData(); // Recargar tabla
        alert('Cotización ' + folio + ' generada exitosamente.');
      } else {
        alert('Error: ' + (result.message || 'No se pudo guardar.'));
      }
    })
    .catch(function (err) {
      btn.textContent = 'GENERAR COTIZACION';
      btn.disabled = false;
      alert('Error de conexión: ' + err.message);
    });
  }
```

- [ ] **Step 5: Commit**

```bash
git add cotizador-munet/dashboard.html
git commit -m "feat(dashboard): generacion PDF estilo BUNKER dorado y envio cotizacion BNK al backend"
```

---

### Task 6: Catalogo de precios precargados — datos iniciales

Agregar funcion en Apps Script para poblar el catalogo con los datos reales de los PDFs de Blend y Republica Dominicana, y un boton para ejecutarla.

**Files:**
- Modify: `cotizador-munet/google-apps-script-munet.js`

**Interfaces:**
- Consumes: `getOrCreateSheet()` de Task 1
- Produces: Hoja CatalogoPrecio poblada con ~30 conceptos precargados

- [ ] **Step 1: Agregar funcion seedCatalogo**

Esta funcion se ejecuta manualmente desde el editor de Apps Script una sola vez:

```javascript
function seedCatalogo() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_CATALOGO,
    ['ID', 'Categoría', 'Concepto', 'Unidad', 'Precio Sugerido', 'Activo'], 6);

  // Solo poblar si esta vacia
  if (sheet.getLastRow() > 1) {
    Logger.log('Catálogo ya tiene datos, no se sobreescribe.');
    return;
  }

  var datos = [
    // Servicios Básicos
    ['CAT-0001', 'Servicios Básicos', 'Stage Manager (turno 8 hrs)', 'turno', 3500, true],
    ['CAT-0002', 'Servicios Básicos', 'Crew Chief (turno 8 hrs)', 'turno', 2500, true],
    ['CAT-0003', 'Servicios Básicos', 'Supervisor de Seguridad (turno 8 hrs)', 'turno', 1500, true],
    ['CAT-0004', 'Servicios Básicos', 'Elemento de Seguridad (turno 8 hrs)', 'turno', 1450, true],
    ['CAT-0005', 'Servicios Básicos', 'Supervisor de Seguridad (turno 12 hrs)', 'turno', 2250, true],
    ['CAT-0006', 'Servicios Básicos', 'Elemento de Seguridad (turno 12 hrs)', 'turno', 2175, true],
    ['CAT-0007', 'Servicios Básicos', 'Supervisor de Limpieza (turno 8 hrs)', 'turno', 1500, true],
    ['CAT-0008', 'Servicios Básicos', 'Elemento de Limpieza (turno 8 hrs)', 'turno', 1250, true],
    ['CAT-0009', 'Servicios Básicos', 'Ambulancia (turno 8 hrs)', 'turno', 6000, true],
    ['CAT-0010', 'Servicios Básicos', 'Ambulancia (turno 12 hrs)', 'turno', 9000, true],
    ['CAT-0011', 'Servicios Básicos', 'Paramédico (turno 8 hrs)', 'turno', 2250, true],
    ['CAT-0012', 'Servicios Básicos', 'Paramédico (turno 12 hrs)', 'turno', 2250, true],
    ['CAT-0013', 'Servicios Básicos', 'Stage Hands', 'turno', 1100, true],
    // Mobiliario
    ['CAT-0014', 'Mobiliario', 'Silla Bacará', 'pieza', 170, true],
    ['CAT-0015', 'Mobiliario', 'Silla Ghost', 'pieza', 170, true],
    ['CAT-0016', 'Mobiliario', 'Flete', 'servicio', 24000, true],
    ['CAT-0017', 'Mobiliario', 'Maniobras', 'servicio', 5000, true],
    ['CAT-0018', 'Mobiliario', 'Supervisión de mobiliario', 'servicio', 4000, true],
    // A&B
    ['CAT-0019', 'A&B', 'Servicio de Canapés de Bienvenida', 'pax', 230, true],
    ['CAT-0020', 'A&B', 'Servicio de Barra Libre Diamante', 'pax', 1380, true],
    ['CAT-0021', 'A&B', 'Servicio de Cena 3 Tiempos', 'pax', 1150, true],
    ['CAT-0022', 'A&B', 'Coffee Break Staff', 'pax', 145.20, true],
    ['CAT-0023', 'A&B', 'Catering VIP', 'servicio', 2420, true],
    ['CAT-0024', 'A&B', 'Box Lunch Cena', 'pieza', 181.50, true],
    // Estructura
    ['CAT-0025', 'Estructura', 'Twin Pack 150 kW turbo (10 hrs/turno)', 'turno', 45000, true],
    ['CAT-0026', 'Estructura', 'Generador 150 kW (10 hrs/turno)', 'turno', 12000, true],
    ['CAT-0027', 'Estructura', 'Doble tiro de cableado', 'servicio', 19500, true],
    // Contenido/Mapping
    ['CAT-0028', 'Contenido/Mapping', 'Servidor de video', 'servicio', 20000, true],
    ['CAT-0029', 'Contenido/Mapping', 'Operación y mappeo (por día)', 'día', 10000, true],
    ['CAT-0030', 'Contenido/Mapping', 'Operador (día de pruebas)', 'día', 12000, true],
    ['CAT-0031', 'Contenido/Mapping', 'Generación de contenido (por minuto)', 'minuto', 45000, true],
    ['CAT-0032', 'Contenido/Mapping', 'Videoproyector láser 45K lúmenes c/óptica', 'pieza', 54050, true],
    ['CAT-0033', 'Contenido/Mapping', 'Creatividad y dirección de proyecto', 'servicio', 40250, true],
    // Suministros
    ['CAT-0034', 'Suministros', 'Papel higiénico junior 200m', 'caja', 461.95, true],
    ['CAT-0035', 'Suministros', 'Toalla interdoblada 20/100', 'caja', 271.17, true],
    ['CAT-0036', 'Suministros', 'Jabón líquido de manos 5L', 'pieza', 251.27, true],
    ['CAT-0037', 'Suministros', 'Tapete de mingitorio C/10', 'paquete', 288.07, true]
  ];

  datos.forEach(function(row) {
    sheet.appendRow(row);
  });

  Logger.log('Catálogo poblado con ' + datos.length + ' conceptos.');
}
```

- [ ] **Step 2: Agregar endpoint para poblar catalogo via GET (backup)**

Agregar en doGet:

```javascript
    if (action === 'seedCatalogo') {
      seedCatalogo();
      return jsonResponse({ status: 'ok', message: 'Catálogo poblado' });
    }
```

- [ ] **Step 3: Commit**

```bash
git add cotizador-munet/google-apps-script-munet.js
git commit -m "feat(dashboard): seed de catalogo de precios con datos reales de PDFs Blend y Rep. Dominicana"
```

---

### Task 7: Responsive y ajustes finales del modal

Agregar media queries para el modal en movil y ajustar detalles de UX.

**Files:**
- Modify: `cotizador-munet/dashboard.html`

**Interfaces:**
- Consumes: CSS y HTML del modal (Task 4)
- Produces: Modal funcional en todas las resoluciones

- [ ] **Step 1: Agregar responsive CSS para el modal**

Dentro de `@media(max-width:900px)`, agregar:

```css
  .bnk-modal{max-width:100%;margin:0}
  .bnk-overlay{padding:10px}
  .bnk-form-grid{grid-template-columns:1fr}
  .bnk-conceptos-header{display:none}
  .bnk-concepto-row{grid-template-columns:1fr 1fr;gap:8px;padding:12px 0;border-bottom:1px solid var(--bd)}
  .bnk-concepto-row select,.bnk-concepto-row input{width:100%}
```

Dentro de `@media(max-width:600px)`, agregar:

```css
  .bnk-concepto-row{grid-template-columns:1fr}
  .dash-nav-right{gap:6px}
  .dash-btn--bnk{padding:6px 10px;font-size:11px;letter-spacing:1px}
```

- [ ] **Step 2: Agregar funcionalidad de guardar concepto libre al catalogo**

En la funcion `enviarCotizacionBNK`, antes del envio al backend, agregar logica para guardar conceptos libres marcados:

```javascript
    // Guardar conceptos libres al catalogo si fueron marcados
    // (Esto se hara en fase 2 con checkbox por fila — por ahora todos los conceptos
    //  que no esten en el catalogo se pueden guardar manualmente)
```

Nota: Para el MVP, el operador puede guardar conceptos al catalogo manualmente desde el Sheet. La funcion de checkbox "Guardar en catálogo" por cada fila de concepto libre queda como mejora posterior — el MVP ya permite agregar conceptos libres sin restriccion.

- [ ] **Step 3: Commit final**

```bash
git add cotizador-munet/dashboard.html
git commit -m "feat(dashboard): responsive del modal BNK y ajustes finales de UX"
```

---

## Resumen de Tareas

| # | Tarea | Archivo principal |
|---|---|---|
| 1 | Apps Script: endpoints Clientes + Catalogo | google-apps-script-munet.js |
| 2 | Apps Script: endpoints CotizacionesBNK | google-apps-script-munet.js |
| 3 | Dashboard: datos combinados, filtro tipo, boton nueva BNK | dashboard.html |
| 4 | Dashboard: modal completo con formulario de conceptos | dashboard.html |
| 5 | Dashboard: generacion PDF dorado y envio al backend | dashboard.html |
| 6 | Apps Script: seed del catalogo de precios | google-apps-script-munet.js |
| 7 | Dashboard: responsive y ajustes finales | dashboard.html |

## Nota de Despliegue

Despues de implementar Tasks 1, 2 y 6, el archivo `google-apps-script-munet.js` debe copiarse al editor de Google Apps Script y re-desplegarse:
1. Ir al proyecto de Apps Script
2. Reemplazar el codigo con el contenido actualizado
3. Ejecutar `seedCatalogo()` una vez desde el editor
4. Implementar → Nueva implementacion → Aplicacion web
5. Copiar la nueva URL (o si usas la misma implementacion, actualizar version)
