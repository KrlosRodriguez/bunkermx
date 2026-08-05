# Clientes y Proveedores — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar módulos de Clientes y Proveedores al dashboard existente con tabs, tablas, modales CRUD, y vinculación a cotizaciones BNK.

**Architecture:** Todo integrado en `dashboard.html` con tabs (Cotizaciones | Clientes | Proveedores). JS modular en archivos separados (`clientes.js`, `proveedores.js`). Backend en Google Apps Script con hojas Clientes (40 cols), Proveedores (44 cols), ServiciosProveedor (7 cols). Sin build step — vanilla HTML/CSS/JS.

**Tech Stack:** HTML5, CSS3, vanilla JS (ES5 para compatibilidad con Apps Script), Google Apps Script, Google Sheets, jsPDF 2.5.1.

## Global Constraints

- Todo el texto visible en español
- Sin `!important` en CSS — solo cascade y specificity
- Usar design tokens de `:root` en dashboard.html (--bk, --g, --ylw, etc.)
- Sin bundler/transpiler — editar archivos fuente directamente
- Hojas se crean automáticamente con `getOrCreateSheet()` al primer uso
- IDs auto-incrementales: CLI-XXXX, PRV-XXXX, SRV-XXXX
- Ningún campo obligatorio excepto Empresa/Nombre para crear registro
- Patrón CSS existente: `.bnk-*` para modal BNK — usar `.cli-*` y `.prv-*` para nuevos modales
- APPS_SCRIPT_URL ya definida en dashboard.html línea 402

---

### Task 1: Backend — CRUD Clientes expandido en Apps Script

**Files:**
- Modify: `cotizador-munet/google-apps-script-munet.js:29-37` (variables de config)
- Modify: `cotizador-munet/google-apps-script-munet.js:325-388` (reemplazar listClientes y createCliente)
- Modify: `cotizador-munet/google-apps-script-munet.js:662-681` (agregar rutas en doGet)

**Interfaces:**
- Consumes: `getOrCreateSheet(ss, name, headers, colCount)` (ya existe línea 40)
- Consumes: `jsonResponse(obj)` (ya existe)
- Produces: `listClientes()` → `{status:'ok', data:[{id, empresa, marcas, cuentaActiva, tipoPersona, condicionesPago, observaciones, personaContacto, puestoContacto, correoContacto, telefonoContacto, razonSocial, rfc, curp, regimenFiscal, usoCfdi, formaPago, metodoPago, calle, noExt, noInt, colonia, cp, alcaldia, estado, pais, bancoMxn, sucursal, titularCuenta, cuentaCorta, clabe, tipoCuenta, bancoExtranjero, divisa, titularExtranjero, cuentaIban, swiftBic, abaRouting, bancoIntermediario, swiftIntermediario, fechaAlta, fechaEdicion}]}`
- Produces: `createCliente(data)` → `{status:'ok', id:'CLI-0001'}`
- Produces: `updateCliente(data)` → `{status:'ok'}`
- Produces: `deleteCliente(params)` → `{status:'ok'}` (soft delete)

- [ ] **Step 1: Agregar constante SHEET_CLIENTES_HEADERS**

En `google-apps-script-munet.js`, después de la línea 37 (`var SHEET_CATALOGO = 'CatalogoPrecio';`), agregar:

```javascript
var SHEET_PROVEEDORES = 'Proveedores';
var SHEET_SERVICIOS_PROVEEDOR = 'ServiciosProveedor';

var CLIENTES_HEADERS = [
  'ID','Empresa','Marcas','Cuenta Activa','Tipo Persona','Condiciones Pago','Observaciones',
  'Persona Contacto','Puesto Contacto','Correo Contacto','Teléfono Contacto',
  'Razón Social','RFC','CURP','Régimen Fiscal','Uso CFDI','Forma Pago','Método Pago',
  'Calle','No. Ext','No. Int','Colonia','CP','Alcaldía/Municipio','Estado','País',
  'Banco MXN','Sucursal','Titular Cuenta','Cuenta Corta','CLABE','Tipo Cuenta',
  'Banco Extranjero','Divisa','Titular Extranjero','Cuenta/IBAN','SWIFT/BIC','ABA/Routing',
  'Banco Intermediario','SWIFT Intermediario','Fecha Alta','Fecha Última Edición'
];

var PROVEEDORES_HEADERS = [
  'ID','Razón Social','Nombre Comercial','Tipo Proveedor','Cuenta Activa','Tipo Persona',
  'Actividad Principal','Fecha Constitución','Observaciones',
  'Nombre Contacto','Puesto Contacto','Correo Contacto','Teléfono Contacto',
  'RFC','CURP','Régimen Fiscal','Uso CFDI','Forma Pago','Método Pago',
  'Días Crédito','Opinión 32-D','Fecha Constancia Fiscal',
  'Calle','Número','Colonia','CP','Alcaldía/Municipio','Entidad','País',
  'Banco MXN','Sucursal/Plaza','Titular Cuenta','Cuenta Corta','CLABE','Tipo Cuenta',
  'Banco Extranjero','Divisa','Titular Extranjero','Cuenta/IBAN','SWIFT/BIC','ABA/Routing',
  'Dirección Banco','Banco Intermediario','SWIFT Intermediario','Gastos Bancarios',
  'Fecha Alta','Fecha Última Edición'
];

var SERVICIOS_HEADERS = ['ID','Proveedor ID','Categoría','Servicio','Unidad','Costo Unitario','Activo'];
```

- [ ] **Step 2: Reescribir `listClientes()` para 42 columnas**

Reemplazar la función `listClientes()` existente (líneas 326-351):

```javascript
function listClientes() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_CLIENTES, CLIENTES_HEADERS, CLIENTES_HEADERS.length);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', data: [] });

  var values = sheet.getRange(2, 1, lastRow - 1, CLIENTES_HEADERS.length).getValues();
  var keys = ['id','empresa','marcas','cuentaActiva','tipoPersona','condicionesPago','observaciones',
    'personaContacto','puestoContacto','correoContacto','telefonoContacto',
    'razonSocial','rfc','curp','regimenFiscal','usoCfdi','formaPago','metodoPago',
    'calle','noExt','noInt','colonia','cp','alcaldia','estado','pais',
    'bancoMxn','sucursal','titularCuenta','cuentaCorta','clabe','tipoCuenta',
    'bancoExtranjero','divisa','titularExtranjero','cuentaIban','swiftBic','abaRouting',
    'bancoIntermediario','swiftIntermediario','fechaAlta','fechaEdicion'];

  var clientes = values.map(function(row) {
    var obj = {};
    keys.forEach(function(key, i) {
      var val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, 'America/Mexico_City', 'dd/MM/yyyy');
      }
      obj[key] = val;
    });
    return obj;
  });
  return jsonResponse({ status: 'ok', data: clientes });
}
```

- [ ] **Step 3: Reescribir `createCliente()` para 42 columnas**

Reemplazar la función `createCliente()` existente (líneas 353-388):

```javascript
function createCliente(data) {
  if (!data.empresa) {
    return jsonResponse({ status: 'error', message: 'El campo empresa es obligatorio' });
  }
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_CLIENTES, CLIENTES_HEADERS, CLIENTES_HEADERS.length);

  var lastRow = sheet.getLastRow();
  var nextNum = 1;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(r) {
      var match = String(r[0]).match(/CLI-(\d+)/);
      if (match) {
        var n = parseInt(match[1], 10);
        if (n >= nextNum) nextNum = n + 1;
      }
    });
  }
  var newId = 'CLI-' + ('0000' + nextNum).slice(-4);
  var fechaAlta = Utilities.formatDate(new Date(), 'America/Mexico_City', 'dd/MM/yyyy');

  var row = [
    newId, data.empresa || '', data.marcas || '', data.cuentaActiva || 'Sí', data.tipoPersona || '',
    data.condicionesPago || '', data.observaciones || '',
    data.personaContacto || '', data.puestoContacto || '', data.correoContacto || '', data.telefonoContacto || '',
    data.razonSocial || '', data.rfc || '', data.curp || '', data.regimenFiscal || '',
    data.usoCfdi || '', data.formaPago || '', data.metodoPago || '',
    data.calle || '', data.noExt || '', data.noInt || '', data.colonia || '',
    data.cp || '', data.alcaldia || '', data.estado || '', data.pais || '',
    data.bancoMxn || '', data.sucursal || '', data.titularCuenta || '',
    data.cuentaCorta || '', data.clabe || '', data.tipoCuenta || '',
    data.bancoExtranjero || '', data.divisa || '', data.titularExtranjero || '',
    data.cuentaIban || '', data.swiftBic || '', data.abaRouting || '',
    data.bancoIntermediario || '', data.swiftIntermediario || '',
    fechaAlta, fechaAlta
  ];

  sheet.appendRow(row);
  return jsonResponse({ status: 'ok', id: newId });
}
```

- [ ] **Step 4: Agregar `updateCliente()` y `deleteCliente()`**

Agregar después de `createCliente()`:

```javascript
function updateCliente(data) {
  if (!data.id) return jsonResponse({ status: 'error', message: 'ID requerido' });
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_CLIENTES, CLIENTES_HEADERS, CLIENTES_HEADERS.length);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'error', message: 'No hay clientes' });

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowIndex = -1;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(data.id)) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) return jsonResponse({ status: 'error', message: 'Cliente no encontrado' });

  var fechaEdicion = Utilities.formatDate(new Date(), 'America/Mexico_City', 'dd/MM/yyyy');
  var keys = ['id','empresa','marcas','cuentaActiva','tipoPersona','condicionesPago','observaciones',
    'personaContacto','puestoContacto','correoContacto','telefonoContacto',
    'razonSocial','rfc','curp','regimenFiscal','usoCfdi','formaPago','metodoPago',
    'calle','noExt','noInt','colonia','cp','alcaldia','estado','pais',
    'bancoMxn','sucursal','titularCuenta','cuentaCorta','clabe','tipoCuenta',
    'bancoExtranjero','divisa','titularExtranjero','cuentaIban','swiftBic','abaRouting',
    'bancoIntermediario','swiftIntermediario','fechaAlta','fechaEdicion'];

  var currentRow = sheet.getRange(rowIndex, 1, 1, CLIENTES_HEADERS.length).getValues()[0];
  var updatedRow = keys.map(function(key, i) {
    if (key === 'id') return currentRow[0];
    if (key === 'fechaAlta') return currentRow[i];
    if (key === 'fechaEdicion') return fechaEdicion;
    return (data[key] !== undefined && data[key] !== null) ? data[key] : currentRow[i];
  });

  sheet.getRange(rowIndex, 1, 1, CLIENTES_HEADERS.length).setValues([updatedRow]);
  return jsonResponse({ status: 'ok' });
}

function deleteCliente(params) {
  if (!params.id) return jsonResponse({ status: 'error', message: 'ID requerido' });
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_CLIENTES, CLIENTES_HEADERS, CLIENTES_HEADERS.length);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'error', message: 'No hay clientes' });

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(params.id)) {
      sheet.getRange(i + 2, 4).setValue('No'); // Columna D = Cuenta Activa
      sheet.getRange(i + 2, CLIENTES_HEADERS.length).setValue(
        Utilities.formatDate(new Date(), 'America/Mexico_City', 'dd/MM/yyyy')
      );
      return jsonResponse({ status: 'ok' });
    }
  }
  return jsonResponse({ status: 'error', message: 'Cliente no encontrado' });
}
```

- [ ] **Step 5: Registrar rutas en `doGet` y `doPost`**

En `doGet()` (después de línea 681 `if (action === 'seedCatalogo') return seedCatalogo();`), agregar:

```javascript
    // ── Clientes CRUD ──
    if (action === 'listClientes') return listClientes();
    if (action === 'createCliente') return createCliente(params);
    if (action === 'deleteCliente') return deleteCliente(params);

    // ── Proveedores CRUD ──
    if (action === 'listProveedores') return listProveedores();
    if (action === 'deleteProveedor') return deleteProveedor(params);

    // ── Servicios Proveedor ──
    if (action === 'listServicios') return listServicios(params);
    if (action === 'deleteServicio') return deleteServicio(params);
```

Y **borrar** las líneas duplicadas existentes (674-675) que ya registraban `listClientes` y `createCliente`.

En `doPost()` (después de línea 57 `if (data.tipoCotizacion === 'BNK') {...}`), agregar:

```javascript
    // ── Clientes POST ──
    if (data.tipoOperacion === 'createCliente') return createCliente(data);
    if (data.tipoOperacion === 'updateCliente') return updateCliente(data);

    // ── Proveedores POST ──
    if (data.tipoOperacion === 'createProveedor') return createProveedor(data);
    if (data.tipoOperacion === 'updateProveedor') return updateProveedor(data);

    // ── Servicios Proveedor POST ──
    if (data.tipoOperacion === 'createServicio') return createServicio(data);
    if (data.tipoOperacion === 'updateServicio') return updateServicio(data);
```

- [ ] **Step 6: Commit**

```bash
git add cotizador-munet/google-apps-script-munet.js
git commit -m "feat: expandir CRUD de Clientes a 42 columnas con update/delete"
```

---

### Task 2: Backend — CRUD Proveedores y Servicios en Apps Script

**Files:**
- Modify: `cotizador-munet/google-apps-script-munet.js` (agregar funciones después del bloque de Clientes)

**Interfaces:**
- Consumes: `getOrCreateSheet()`, `jsonResponse()`, `PROVEEDORES_HEADERS`, `SERVICIOS_HEADERS` (de Task 1)
- Produces: `listProveedores()` → `{status:'ok', data:[{id, razonSocial, nombreComercial, tipoProveedor, cuentaActiva, tipoPersona, actividadPrincipal, fechaConstitucion, observaciones, nombreContacto, puestoContacto, correoContacto, telefonoContacto, rfc, curp, regimenFiscal, usoCfdi, formaPago, metodoPago, diasCredito, opinion32d, fechaConstanciaFiscal, calle, numero, colonia, cp, alcaldia, entidad, pais, bancoMxn, sucursalPlaza, titularCuenta, cuentaCorta, clabe, tipoCuenta, bancoExtranjero, divisa, titularExtranjero, cuentaIban, swiftBic, abaRouting, direccionBanco, bancoIntermediario, swiftIntermediario, gastosBancarios, fechaAlta, fechaEdicion}]}`
- Produces: `createProveedor(data)` → `{status:'ok', id:'PRV-0001'}`
- Produces: `updateProveedor(data)` → `{status:'ok'}`
- Produces: `deleteProveedor(params)` → `{status:'ok'}`
- Produces: `listServicios(params)` → `{status:'ok', data:[{id, proveedorId, categoria, servicio, unidad, costoUnitario, activo}]}`
- Produces: `createServicio(data)` → `{status:'ok', id:'SRV-0001'}`
- Produces: `updateServicio(data)` → `{status:'ok'}`
- Produces: `deleteServicio(params)` → `{status:'ok'}`

- [ ] **Step 1: Agregar `listProveedores()`**

Después de la función `deleteCliente()`, agregar:

```javascript
// ── Proveedores ──
function listProveedores() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_PROVEEDORES, PROVEEDORES_HEADERS, PROVEEDORES_HEADERS.length);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', data: [] });

  var values = sheet.getRange(2, 1, lastRow - 1, PROVEEDORES_HEADERS.length).getValues();
  var keys = ['id','razonSocial','nombreComercial','tipoProveedor','cuentaActiva','tipoPersona',
    'actividadPrincipal','fechaConstitucion','observaciones',
    'nombreContacto','puestoContacto','correoContacto','telefonoContacto',
    'rfc','curp','regimenFiscal','usoCfdi','formaPago','metodoPago',
    'diasCredito','opinion32d','fechaConstanciaFiscal',
    'calle','numero','colonia','cp','alcaldia','entidad','pais',
    'bancoMxn','sucursalPlaza','titularCuenta','cuentaCorta','clabe','tipoCuenta',
    'bancoExtranjero','divisa','titularExtranjero','cuentaIban','swiftBic','abaRouting',
    'direccionBanco','bancoIntermediario','swiftIntermediario','gastosBancarios',
    'fechaAlta','fechaEdicion'];

  var proveedores = values.map(function(row) {
    var obj = {};
    keys.forEach(function(key, i) {
      var val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, 'America/Mexico_City', 'dd/MM/yyyy');
      }
      obj[key] = val;
    });
    return obj;
  });
  return jsonResponse({ status: 'ok', data: proveedores });
}
```

- [ ] **Step 2: Agregar `createProveedor()`, `updateProveedor()`, `deleteProveedor()`**

```javascript
function createProveedor(data) {
  if (!data.razonSocial && !data.nombreComercial) {
    return jsonResponse({ status: 'error', message: 'Razón social o nombre comercial requerido' });
  }
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_PROVEEDORES, PROVEEDORES_HEADERS, PROVEEDORES_HEADERS.length);

  var lastRow = sheet.getLastRow();
  var nextNum = 1;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(r) {
      var match = String(r[0]).match(/PRV-(\d+)/);
      if (match) {
        var n = parseInt(match[1], 10);
        if (n >= nextNum) nextNum = n + 1;
      }
    });
  }
  var newId = 'PRV-' + ('0000' + nextNum).slice(-4);
  var fechaAlta = Utilities.formatDate(new Date(), 'America/Mexico_City', 'dd/MM/yyyy');

  var row = [
    newId, data.razonSocial || '', data.nombreComercial || '', data.tipoProveedor || 'Pool',
    data.cuentaActiva || 'Sí', data.tipoPersona || '', data.actividadPrincipal || '',
    data.fechaConstitucion || '', data.observaciones || '',
    data.nombreContacto || '', data.puestoContacto || '', data.correoContacto || '', data.telefonoContacto || '',
    data.rfc || '', data.curp || '', data.regimenFiscal || '', data.usoCfdi || '',
    data.formaPago || '', data.metodoPago || '', data.diasCredito || '', data.opinion32d || '',
    data.fechaConstanciaFiscal || '',
    data.calle || '', data.numero || '', data.colonia || '', data.cp || '',
    data.alcaldia || '', data.entidad || '', data.pais || '',
    data.bancoMxn || '', data.sucursalPlaza || '', data.titularCuenta || '',
    data.cuentaCorta || '', data.clabe || '', data.tipoCuenta || '',
    data.bancoExtranjero || '', data.divisa || '', data.titularExtranjero || '',
    data.cuentaIban || '', data.swiftBic || '', data.abaRouting || '',
    data.direccionBanco || '', data.bancoIntermediario || '', data.swiftIntermediario || '',
    data.gastosBancarios || '',
    fechaAlta, fechaAlta
  ];

  sheet.appendRow(row);
  return jsonResponse({ status: 'ok', id: newId });
}

function updateProveedor(data) {
  if (!data.id) return jsonResponse({ status: 'error', message: 'ID requerido' });
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_PROVEEDORES, PROVEEDORES_HEADERS, PROVEEDORES_HEADERS.length);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'error', message: 'No hay proveedores' });

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowIndex = -1;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(data.id)) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) return jsonResponse({ status: 'error', message: 'Proveedor no encontrado' });

  var fechaEdicion = Utilities.formatDate(new Date(), 'America/Mexico_City', 'dd/MM/yyyy');
  var keys = ['id','razonSocial','nombreComercial','tipoProveedor','cuentaActiva','tipoPersona',
    'actividadPrincipal','fechaConstitucion','observaciones',
    'nombreContacto','puestoContacto','correoContacto','telefonoContacto',
    'rfc','curp','regimenFiscal','usoCfdi','formaPago','metodoPago',
    'diasCredito','opinion32d','fechaConstanciaFiscal',
    'calle','numero','colonia','cp','alcaldia','entidad','pais',
    'bancoMxn','sucursalPlaza','titularCuenta','cuentaCorta','clabe','tipoCuenta',
    'bancoExtranjero','divisa','titularExtranjero','cuentaIban','swiftBic','abaRouting',
    'direccionBanco','bancoIntermediario','swiftIntermediario','gastosBancarios',
    'fechaAlta','fechaEdicion'];

  var currentRow = sheet.getRange(rowIndex, 1, 1, PROVEEDORES_HEADERS.length).getValues()[0];
  var updatedRow = keys.map(function(key, i) {
    if (key === 'id') return currentRow[0];
    if (key === 'fechaAlta') return currentRow[i];
    if (key === 'fechaEdicion') return fechaEdicion;
    return (data[key] !== undefined && data[key] !== null) ? data[key] : currentRow[i];
  });

  sheet.getRange(rowIndex, 1, 1, PROVEEDORES_HEADERS.length).setValues([updatedRow]);
  return jsonResponse({ status: 'ok' });
}

function deleteProveedor(params) {
  if (!params.id) return jsonResponse({ status: 'error', message: 'ID requerido' });
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_PROVEEDORES, PROVEEDORES_HEADERS, PROVEEDORES_HEADERS.length);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'error', message: 'No hay proveedores' });

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(params.id)) {
      sheet.getRange(i + 2, 5).setValue('No'); // Columna E = Cuenta Activa
      sheet.getRange(i + 2, PROVEEDORES_HEADERS.length).setValue(
        Utilities.formatDate(new Date(), 'America/Mexico_City', 'dd/MM/yyyy')
      );
      return jsonResponse({ status: 'ok' });
    }
  }
  return jsonResponse({ status: 'error', message: 'Proveedor no encontrado' });
}
```

- [ ] **Step 3: Agregar CRUD de Servicios de Proveedor**

```javascript
// ── Servicios de Proveedor ──
function listServicios(params) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_SERVICIOS_PROVEEDOR, SERVICIOS_HEADERS, SERVICIOS_HEADERS.length);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', data: [] });

  var values = sheet.getRange(2, 1, lastRow - 1, SERVICIOS_HEADERS.length).getValues();
  var items = [];
  values.forEach(function(row) {
    if (String(row[6]).toLowerCase() !== 'no') {
      var matchProveedor = !params.proveedorId || String(row[1]) === String(params.proveedorId);
      if (matchProveedor) {
        items.push({
          id: row[0], proveedorId: row[1], categoria: row[2],
          servicio: row[3], unidad: row[4], costoUnitario: row[5], activo: row[6]
        });
      }
    }
  });
  return jsonResponse({ status: 'ok', data: items });
}

function createServicio(data) {
  if (!data.proveedorId || !data.servicio) {
    return jsonResponse({ status: 'error', message: 'proveedorId y servicio requeridos' });
  }
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_SERVICIOS_PROVEEDOR, SERVICIOS_HEADERS, SERVICIOS_HEADERS.length);

  var lastRow = sheet.getLastRow();
  var nextNum = 1;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(r) {
      var match = String(r[0]).match(/SRV-(\d+)/);
      if (match) {
        var n = parseInt(match[1], 10);
        if (n >= nextNum) nextNum = n + 1;
      }
    });
  }
  var newId = 'SRV-' + ('0000' + nextNum).slice(-4);

  sheet.appendRow([
    newId, data.proveedorId, data.categoria || '', data.servicio,
    data.unidad || 'Servicio', data.costoUnitario || 0, 'Sí'
  ]);
  return jsonResponse({ status: 'ok', id: newId });
}

function updateServicio(data) {
  if (!data.id) return jsonResponse({ status: 'error', message: 'ID requerido' });
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_SERVICIOS_PROVEEDOR, SERVICIOS_HEADERS, SERVICIOS_HEADERS.length);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'error', message: 'No hay servicios' });

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(data.id)) {
      var rowIndex = i + 2;
      var currentRow = sheet.getRange(rowIndex, 1, 1, SERVICIOS_HEADERS.length).getValues()[0];
      sheet.getRange(rowIndex, 1, 1, SERVICIOS_HEADERS.length).setValues([[
        currentRow[0], currentRow[1],
        data.categoria !== undefined ? data.categoria : currentRow[2],
        data.servicio !== undefined ? data.servicio : currentRow[3],
        data.unidad !== undefined ? data.unidad : currentRow[4],
        data.costoUnitario !== undefined ? data.costoUnitario : currentRow[5],
        data.activo !== undefined ? data.activo : currentRow[6]
      ]]);
      return jsonResponse({ status: 'ok' });
    }
  }
  return jsonResponse({ status: 'error', message: 'Servicio no encontrado' });
}

function deleteServicio(params) {
  if (!params.id) return jsonResponse({ status: 'error', message: 'ID requerido' });
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SHEET_SERVICIOS_PROVEEDOR, SERVICIOS_HEADERS, SERVICIOS_HEADERS.length);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'error', message: 'No hay servicios' });

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(params.id)) {
      sheet.getRange(i + 2, 7).setValue('No'); // Columna G = Activo
      return jsonResponse({ status: 'ok' });
    }
  }
  return jsonResponse({ status: 'error', message: 'Servicio no encontrado' });
}
```

- [ ] **Step 4: Commit**

```bash
git add cotizador-munet/google-apps-script-munet.js
git commit -m "feat: agregar CRUD de Proveedores y Servicios en Apps Script"
```

---

### Task 3: Dashboard HTML — Tabs de navegación y estructura de secciones

**Files:**
- Modify: `cotizador-munet/dashboard.html:217-297` (agregar tabs y wrappers de sección)

**Interfaces:**
- Consumes: estructura HTML existente del dashboard (nav, indicators, filters, table)
- Produces: elementos HTML `#dashTabs`, `#secCotizaciones`, `#secClientes`, `#secProveedores` que Task 4-5 usarán
- Produces: indicadores para cada sección `#indCliTotal`, `#indCliActivos`, etc.

- [ ] **Step 1: Agregar barra de tabs después del nav**

Después de `</nav>` (línea 228), agregar:

```html
<!-- TABS -->
<div class="dash-tabs" id="dashTabs">
  <button class="dash-tab active" data-tab="cotizaciones">COTIZACIONES</button>
  <button class="dash-tab" data-tab="clientes">CLIENTES</button>
  <button class="dash-tab" data-tab="proveedores">PROVEEDORES</button>
</div>
```

- [ ] **Step 2: Envolver sección de cotizaciones existente**

Envolver los bloques de indicadores, filtros, tabla y footer existentes (líneas 231-300) en un div de sección:

```html
<!-- SECCIÓN: COTIZACIONES -->
<div class="dash-section active" id="secCotizaciones">
  <!-- INDICATORS (existente, sin cambio) -->
  <div class="dash-indicators"> ... </div>
  <!-- FILTERS (existente, sin cambio) -->
  <div class="dash-filters"> ... </div>
  <!-- TABLE (existente, sin cambio) -->
  <div class="dash-table-wrap"> ... </div>
</div>
```

- [ ] **Step 3: Agregar sección de Clientes**

Después de `</div><!-- secCotizaciones -->`, agregar:

```html
<!-- SECCIÓN: CLIENTES -->
<div class="dash-section" id="secClientes" style="display:none">
  <div class="dash-indicators">
    <div class="dash-card">
      <div class="dash-card-label">TOTAL CLIENTES</div>
      <div class="dash-card-value" id="indCliTotal">—</div>
    </div>
    <div class="dash-card">
      <div class="dash-card-label">ACTIVOS</div>
      <div class="dash-card-value" id="indCliActivos">—</div>
    </div>
    <div class="dash-card">
      <div class="dash-card-label">INACTIVOS</div>
      <div class="dash-card-value" id="indCliInactivos">—</div>
    </div>
    <div class="dash-card">
      <div class="dash-card-label">% COMPLETITUD PROMEDIO</div>
      <div class="dash-card-value" id="indCliCompletitud">—</div>
    </div>
  </div>
  <div class="dash-filters">
    <input type="text" class="dash-search" id="cliSearch" placeholder="Buscar por nombre, marca o ID...">
    <select class="dash-select" id="cliEstado">
      <option value="">TODOS</option>
      <option value="Sí">ACTIVOS</option>
      <option value="No">INACTIVOS</option>
    </select>
    <button class="dash-btn dash-btn--accent" id="btnNuevoCliente">+ NUEVO CLIENTE</button>
  </div>
  <div class="dash-table-wrap">
    <div class="dash-loading" id="cliLoading" style="display:none">CARGANDO CLIENTES...</div>
    <table class="dash-table" id="cliTable" style="display:none">
      <thead>
        <tr>
          <th>NO. CLIENTE</th>
          <th>STATUS %</th>
          <th>EMPRESA</th>
          <th>MARCAS</th>
          <th>CUENTA</th>
          <th>ACCIONES</th>
        </tr>
      </thead>
      <tbody id="cliBody"></tbody>
    </table>
    <div class="dash-empty" id="cliEmpty" style="display:none">
      <div class="dash-empty-icon">&#128100;</div>
      <div class="dash-empty-text">NO HAY CLIENTES REGISTRADOS</div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Agregar sección de Proveedores**

```html
<!-- SECCIÓN: PROVEEDORES -->
<div class="dash-section" id="secProveedores" style="display:none">
  <div class="dash-indicators">
    <div class="dash-card">
      <div class="dash-card-label">TOTAL PROVEEDORES</div>
      <div class="dash-card-value" id="indPrvTotal">—</div>
    </div>
    <div class="dash-card">
      <div class="dash-card-label">POOL</div>
      <div class="dash-card-value" id="indPrvPool">—</div>
    </div>
    <div class="dash-card">
      <div class="dash-card-label">ONE SHOT</div>
      <div class="dash-card-value" id="indPrvOneShot">—</div>
    </div>
    <div class="dash-card">
      <div class="dash-card-label">% COMPLETITUD PROMEDIO</div>
      <div class="dash-card-value" id="indPrvCompletitud">—</div>
    </div>
  </div>
  <div class="dash-filters">
    <input type="text" class="dash-search" id="prvSearch" placeholder="Buscar por nombre, razón social o ID...">
    <select class="dash-select" id="prvTipo">
      <option value="">TODOS LOS TIPOS</option>
      <option value="Pool">POOL</option>
      <option value="One Shot">ONE SHOT</option>
    </select>
    <select class="dash-select" id="prvEstado">
      <option value="">TODOS</option>
      <option value="Sí">ACTIVOS</option>
      <option value="No">INACTIVOS</option>
    </select>
    <button class="dash-btn dash-btn--accent" id="btnNuevoProveedor">+ NUEVO PROVEEDOR</button>
  </div>
  <div class="dash-table-wrap">
    <div class="dash-loading" id="prvLoading" style="display:none">CARGANDO PROVEEDORES...</div>
    <table class="dash-table" id="prvTable" style="display:none">
      <thead>
        <tr>
          <th>NO. PROVEEDOR</th>
          <th>STATUS %</th>
          <th>RAZÓN SOCIAL</th>
          <th>NOMBRE COMERCIAL</th>
          <th>TIPO</th>
          <th>CUENTA</th>
          <th>FECHA ALTA</th>
          <th>ACCIONES</th>
        </tr>
      </thead>
      <tbody id="prvBody"></tbody>
    </table>
    <div class="dash-empty" id="prvEmpty" style="display:none">
      <div class="dash-empty-icon">&#128188;</div>
      <div class="dash-empty-text">NO HAY PROVEEDORES REGISTRADOS</div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Agregar modal de Cliente (4 tabs)**

Antes de `</body>`, agregar el modal de Cliente. Ver spec sección 2.2 para campos exactos por tab. El HTML del modal sigue el patrón de `.bnk-overlay`/`.bnk-modal` pero con clases `.cli-*`:

```html
<!-- MODAL CLIENTE -->
<div class="bnk-overlay" id="cliOverlay">
  <div class="bnk-modal" style="max-width:1060px">
    <div class="bnk-modal-header">
      <div style="display:flex;align-items:center;gap:16px">
        <span class="bnk-modal-title" id="cliModalTitle">NUEVO CLIENTE</span>
        <div class="completitud-circle" id="cliCompletitud">
          <svg viewBox="0 0 36 36" class="completitud-svg">
            <path class="completitud-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            <path class="completitud-fg" id="cliCompletitudPath" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          </svg>
          <span class="completitud-text" id="cliCompletitudText">0%</span>
        </div>
      </div>
      <button class="bnk-modal-close" id="cliClose">&times;</button>
    </div>
    <div class="bnk-modal-body">
      <div class="modal-tabs">
        <button class="modal-tab active" data-target="cliTab1">DATOS GENERALES</button>
        <button class="modal-tab" data-target="cliTab2">CONTACTO</button>
        <button class="modal-tab" data-target="cliTab3">FACTURACIÓN</button>
        <button class="modal-tab" data-target="cliTab4">BANCARIOS</button>
      </div>
      <input type="hidden" id="cliId">
      <!-- Tab 1: Datos Generales -->
      <div class="modal-tab-content active" id="cliTab1">
        <div class="bnk-form-grid">
          <div class="bnk-form-group bnk-form-full">
            <label class="bnk-label">EMPRESA / NOMBRE *</label>
            <input type="text" class="bnk-input" id="cliEmpresa" placeholder="Nombre de la empresa">
          </div>
          <div class="bnk-form-group bnk-form-full">
            <label class="bnk-label">MARCAS</label>
            <input type="text" class="bnk-input" id="cliMarcas" placeholder="Separar con coma: Marca1, Marca2">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">TIPO DE PERSONA</label>
            <select class="bnk-input" id="cliTipoPersona">
              <option value="">— Seleccionar —</option>
              <option value="Persona moral">Persona moral</option>
              <option value="Persona física">Persona física con actividad empresarial</option>
              <option value="Residente en el extranjero">Residente en el extranjero</option>
            </select>
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CONDICIONES DE PAGO (DÍAS)</label>
            <input type="text" class="bnk-input" id="cliCondicionesPago" placeholder="Ej: 30">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CUENTA ACTIVA</label>
            <select class="bnk-input" id="cliCuentaActiva">
              <option value="Sí">Sí</option>
              <option value="No">No</option>
            </select>
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">FECHA DE ALTA</label>
            <input type="text" class="bnk-input" id="cliFechaAlta" readonly>
          </div>
          <div class="bnk-form-group bnk-form-full">
            <label class="bnk-label">OBSERVACIONES</label>
            <textarea class="bnk-textarea" id="cliObservaciones" rows="3"></textarea>
          </div>
        </div>
      </div>
      <!-- Tab 2: Datos de Contacto -->
      <div class="modal-tab-content" id="cliTab2" style="display:none">
        <div class="bnk-form-grid">
          <div class="bnk-form-group">
            <label class="bnk-label">PERSONA DE CONTACTO</label>
            <input type="text" class="bnk-input" id="cliPersonaContacto">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">PUESTO / DESCRIPCIÓN</label>
            <input type="text" class="bnk-input" id="cliPuestoContacto">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CORREO DE CONTACTO</label>
            <input type="email" class="bnk-input" id="cliCorreoContacto">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">TELÉFONO DE CONTACTO</label>
            <input type="text" class="bnk-input" id="cliTelefonoContacto">
          </div>
        </div>
      </div>
      <!-- Tab 3: Datos de Facturación -->
      <div class="modal-tab-content" id="cliTab3" style="display:none">
        <div class="bnk-form-grid">
          <div class="bnk-form-group bnk-form-full">
            <label class="bnk-label">RAZÓN SOCIAL</label>
            <input type="text" class="bnk-input" id="cliRazonSocial">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">RFC</label>
            <input type="text" class="bnk-input" id="cliRfc">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CURP (PERSONA FÍSICA)</label>
            <input type="text" class="bnk-input" id="cliCurp">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">RÉGIMEN FISCAL</label>
            <input type="text" class="bnk-input" id="cliRegimenFiscal" placeholder="Clave y descripción">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">USO DE CFDI</label>
            <input type="text" class="bnk-input" id="cliUsoCfdi">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">FORMA DE PAGO</label>
            <input type="text" class="bnk-input" id="cliFormaPago">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">MÉTODO DE PAGO</label>
            <select class="bnk-input" id="cliMetodoPago">
              <option value="">— Seleccionar —</option>
              <option value="PUE">PUE</option>
              <option value="PPD">PPD</option>
            </select>
          </div>
          <div class="bnk-form-group bnk-form-full">
            <label class="bnk-label" style="margin-top:12px;border-bottom:1px solid var(--bd);padding-bottom:6px">DIRECCIÓN FISCAL</label>
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CALLE</label>
            <input type="text" class="bnk-input" id="cliCalle">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">NO. EXT</label>
            <input type="text" class="bnk-input" id="cliNoExt">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">NO. INT</label>
            <input type="text" class="bnk-input" id="cliNoInt">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">COLONIA</label>
            <input type="text" class="bnk-input" id="cliColonia">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CP</label>
            <input type="text" class="bnk-input" id="cliCp">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">ALCALDÍA / MUNICIPIO</label>
            <input type="text" class="bnk-input" id="cliAlcaldia">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">ESTADO</label>
            <input type="text" class="bnk-input" id="cliEstadoGeo">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">PAÍS</label>
            <input type="text" class="bnk-input" id="cliPais" value="México">
          </div>
        </div>
      </div>
      <!-- Tab 4: Datos Bancarios -->
      <div class="modal-tab-content" id="cliTab4" style="display:none">
        <div class="bnk-section-label">MONEDA NACIONAL (MXN)</div>
        <div class="bnk-form-grid">
          <div class="bnk-form-group">
            <label class="bnk-label">BANCO</label>
            <input type="text" class="bnk-input" id="cliBancoMxn">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">SUCURSAL / PLAZA</label>
            <input type="text" class="bnk-input" id="cliSucursal">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">TITULAR DE LA CUENTA</label>
            <input type="text" class="bnk-input" id="cliTitularCuenta">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CUENTA CORTA</label>
            <input type="text" class="bnk-input" id="cliCuentaCorta">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CLABE (18 DÍGITOS)</label>
            <input type="text" class="bnk-input" id="cliClabe" maxlength="18">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">TIPO DE CUENTA</label>
            <select class="bnk-input" id="cliTipoCuenta">
              <option value="">— Seleccionar —</option>
              <option value="Cheques">Cheques</option>
              <option value="Inversión">Inversión</option>
            </select>
          </div>
        </div>
        <div class="bnk-section-label" style="margin-top:20px">MONEDA EXTRANJERA</div>
        <div class="bnk-form-grid">
          <div class="bnk-form-group">
            <label class="bnk-label">BANCO (NOMBRE Y PAÍS)</label>
            <input type="text" class="bnk-input" id="cliBancoExtranjero">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">DIVISA</label>
            <input type="text" class="bnk-input" id="cliDivisa" placeholder="USD, EUR, etc.">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">TITULAR</label>
            <input type="text" class="bnk-input" id="cliTitularExtranjero">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CUENTA / IBAN</label>
            <input type="text" class="bnk-input" id="cliCuentaIban">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">SWIFT / BIC</label>
            <input type="text" class="bnk-input" id="cliSwiftBic">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">ABA / ROUTING</label>
            <input type="text" class="bnk-input" id="cliAbaRouting">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">BANCO INTERMEDIARIO</label>
            <input type="text" class="bnk-input" id="cliBancoIntermediario">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">SWIFT INTERMEDIARIO</label>
            <input type="text" class="bnk-input" id="cliSwiftIntermediario">
          </div>
        </div>
      </div>
    </div>
    <div class="bnk-modal-footer">
      <button class="dash-btn" id="cliCancel">CANCELAR</button>
      <button class="dash-btn dash-btn--accent" id="cliGuardar">GUARDAR</button>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Agregar modal de Proveedor (5 tabs)**

Similar al de Cliente pero con 5 tabs (Datos Generales, Contacto, Fiscales/Facturación, Bancarios, Servicios). El tab 5 incluye la tabla de servicios con botón "+ Agregar Servicio". El modal usa los mismos IDs prefijados `prv*`. La estructura HTML es idéntica al modal de Cliente con estos cambios:

- ID del overlay: `prvOverlay`
- Campos adicionales en Tab 1: Actividad Principal, Fecha Constitución, Tipo Proveedor (Pool/One Shot)
- Tab 3 tiene campos extra: Días Crédito, Opinión 32-D, Fecha Constancia Fiscal
- Tab 4 bancarios tiene: Dirección del Banco, Gastos Bancarios (OUR/SHA/BEN)
- Tab 5 nuevo:

```html
<!-- Tab 5: Servicios -->
<div class="modal-tab-content" id="prvTab5" style="display:none">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <span class="bnk-section-label" style="margin:0;border:none">SERVICIOS Y COSTOS</span>
    <button class="dash-btn dash-btn--accent" id="prvAddServicio">+ AGREGAR SERVICIO</button>
  </div>
  <table class="dash-table" id="prvServiciosTable">
    <thead>
      <tr>
        <th>CATEGORÍA</th>
        <th>SERVICIO</th>
        <th>UNIDAD</th>
        <th>COSTO UNITARIO</th>
        <th>ACCIONES</th>
      </tr>
    </thead>
    <tbody id="prvServiciosBody"></tbody>
  </table>
  <div class="dash-empty" id="prvServiciosEmpty" style="display:none">
    <div class="dash-empty-text">SIN SERVICIOS REGISTRADOS</div>
  </div>
</div>
```

- [ ] **Step 7: Agregar scripts de clientes y proveedores al HTML**

Antes de la etiqueta `<script>` existente (línea 396), agregar:

```html
<script src="../js/pages/clientes.js" defer></script>
<script src="../js/pages/proveedores.js" defer></script>
```

- [ ] **Step 8: Commit**

```bash
git add cotizador-munet/dashboard.html
git commit -m "feat: agregar estructura HTML de tabs, secciones y modales para Clientes y Proveedores"
```

---

### Task 4: CSS — Estilos para tabs, modales con tabs internos, badges y completitud

**Files:**
- Modify: `cotizador-munet/dashboard.html` (sección `<style>`, después de línea 207)

**Interfaces:**
- Consumes: design tokens existentes en `:root` (--bk, --g, --ylw, --bd, etc.)
- Produces: clases CSS: `.dash-tabs`, `.dash-tab`, `.dash-section`, `.modal-tabs`, `.modal-tab`, `.modal-tab-content`, `.completitud-circle`, `.completitud-svg`, `.status-badge`, `.tipo-prv-badge`, `.cuenta-badge`

- [ ] **Step 1: Agregar estilos de tabs, sección, modal-tabs y completitud**

Antes del bloque `/* ── RESPONSIVE ── */` (línea 189), agregar:

```css
/* ── TABS NAV ── */
.dash-tabs{display:flex;gap:0;padding:0 30px;background:rgba(5,9,5,.95);border-bottom:1px solid var(--bd)}
.dash-tab{padding:12px 24px;background:none;border:none;border-bottom:2px solid transparent;
  color:var(--tx);font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:600;
  letter-spacing:2px;cursor:pointer;transition:all .3s}
.dash-tab:hover{color:var(--wh);background:rgba(0,255,65,.04)}
.dash-tab.active{color:var(--g);border-bottom-color:var(--g)}

/* ── SECCIONES ── */
.dash-section{display:none}
.dash-section.active{display:block}

/* ── MODAL TABS INTERNOS ── */
.modal-tabs{display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--bd)}
.modal-tab{padding:10px 18px;background:none;border:none;border-bottom:2px solid transparent;
  color:var(--tx);font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:600;
  letter-spacing:1px;cursor:pointer;transition:all .3s}
.modal-tab:hover{color:var(--wh)}
.modal-tab.active{color:var(--g);border-bottom-color:var(--g)}
.modal-tab-content{display:none}
.modal-tab-content.active{display:block}

/* ── COMPLETITUD CIRCLE ── */
.completitud-circle{position:relative;width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center}
.completitud-svg{width:40px;height:40px;transform:rotate(-90deg)}
.completitud-bg{fill:none;stroke:var(--bd);stroke-width:3}
.completitud-fg{fill:none;stroke:var(--g);stroke-width:3;stroke-linecap:round;transition:stroke-dasharray .6s ease}
.completitud-text{position:absolute;font-family:'Space Mono',monospace;font-size:9px;color:var(--g);letter-spacing:0}

/* ── STATUS BADGE (% completitud en tabla) ── */
.status-pct{display:inline-block;padding:2px 8px;font-family:'Space Mono',monospace;font-size:10px;
  letter-spacing:1px;border:1px solid;min-width:45px;text-align:center}
.status-pct--low{color:var(--red);border-color:rgba(255,68,85,.3);background:rgba(255,68,85,.06)}
.status-pct--mid{color:var(--ylw);border-color:rgba(240,192,64,.3);background:rgba(240,192,64,.06)}
.status-pct--high{color:var(--g);border-color:rgba(0,255,65,.3);background:rgba(0,255,65,.06)}

/* ── TIPO PROVEEDOR BADGE ── */
.tipo-prv-badge{display:inline-block;padding:2px 8px;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;border:1px solid}
.tipo-Pool{color:var(--blu);border-color:rgba(0,212,255,.3);background:rgba(0,212,255,.06)}
.tipo-One-Shot{color:var(--ylw);border-color:rgba(240,192,64,.3);background:rgba(240,192,64,.06)}

/* ── CUENTA ACTIVA BADGE ── */
.cuenta-badge{display:inline-block;width:10px;height:10px;border-radius:50%}
.cuenta-badge--on{background:var(--g);box-shadow:0 0 6px rgba(0,255,65,.4)}
.cuenta-badge--off{background:var(--red);box-shadow:0 0 6px rgba(255,68,85,.4)}

/* ── ACTION BUTTONS IN TABLE ── */
.tbl-action{background:none;border:1px solid var(--bd);color:var(--tx);padding:4px 8px;
  font-size:12px;cursor:pointer;transition:all .2s;margin-right:4px}
.tbl-action:hover{color:var(--wh);border-color:rgba(0,255,65,.3);background:rgba(0,255,65,.06)}
.tbl-action--del{color:var(--red);border-color:rgba(255,68,85,.3)}
.tbl-action--del:hover{background:rgba(255,68,85,.1);border-color:var(--red)}

/* ── SERVICIO INLINE EDIT ROW ── */
.srv-edit-row{display:grid;grid-template-columns:140px 1fr 80px 110px 36px;gap:6px;padding:8px 0;
  align-items:center;border-bottom:1px solid rgba(0,255,65,.06)}
.srv-edit-row input,.srv-edit-row select{padding:6px 8px;background:var(--card);border:1px solid var(--bd);
  color:var(--wh);font-family:'Barlow',sans-serif;font-size:12px;outline:none}
```

- [ ] **Step 2: Actualizar bloque responsive**

Dentro del bloque `@media(max-width:900px)`, agregar:

```css
  .dash-tabs{padding:0 16px;overflow-x:auto}
  .dash-tab{padding:10px 16px;font-size:11px;white-space:nowrap}
  .modal-tabs{overflow-x:auto}
  .modal-tab{padding:8px 12px;font-size:10px;white-space:nowrap}
```

Dentro del bloque `@media(max-width:600px)`, agregar:

```css
  .dash-tab{padding:8px 10px;font-size:10px;letter-spacing:1px}
```

- [ ] **Step 3: Commit**

```bash
git add cotizador-munet/dashboard.html
git commit -m "feat: agregar estilos CSS para tabs, modales internos, badges y completitud"
```

---

### Task 5: JS — Lógica de tabs y módulo de Clientes

**Files:**
- Create: `js/pages/clientes.js`
- Modify: `cotizador-munet/dashboard.html` (bloque `<script>` — agregar lógica de tabs en `DOMContentLoaded`)

**Interfaces:**
- Consumes: `APPS_SCRIPT_URL` (variable global del script inline en dashboard.html línea 402)
- Consumes: `allClientes` (variable del script inline que se actualiza)
- Consumes: `escapeHTML()`, `formatMXN()`, `parseFecha()`, `formatFechaDisplay()` (funciones del script inline)
- Produces: `window.BNKClientes` — objeto global con métodos: `load()`, `renderTable()`, `abrirModal(clienteData)`, `calcCompletitud(obj)`
- Produces: actualiza `allClientes` para que el autocompletado BNK use los datos expandidos

- [ ] **Step 1: Crear `js/pages/clientes.js` con el módulo completo**

El archivo contendrá:
- `window.BNKClientes` como namespace
- `load()` — fetch a `listClientes`, guardar en array local, renderizar tabla e indicadores
- `renderTable()` — filtrar por búsqueda y estado, generar filas HTML, insertar en `#cliBody`
- `updateIndicators()` — calcular Total/Activos/Inactivos/Completitud y actualizar los `#indCli*`
- `calcCompletitud(obj)` — contar campos no vacíos / total campos (excluir id, fechaAlta, fechaEdicion)
- `abrirModal(clienteData, modo)` — popular modal con datos (modo: 'crear'|'editar'|'ver')
- `cerrarModal()` — ocultar overlay
- `guardarCliente()` — POST a createCliente/updateCliente según si hay ID
- `eliminarCliente(id)` — confirm → fetch deleteCliente
- Event listeners para filtros, botón nuevo, tabs internos del modal

Tamaño estimado: ~350 líneas. El código completo se proporcionará al implementador en los pasos del task.

- [ ] **Step 2: Agregar lógica de tabs al script inline del dashboard**

En el bloque `document.addEventListener('DOMContentLoaded', ...)` (línea 1206), agregar al inicio:

```javascript
    // ── TABS NAVIGATION ──
    document.querySelectorAll('.dash-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = this.getAttribute('data-tab');
        document.querySelectorAll('.dash-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.dash-section').forEach(function(s) { s.classList.remove('active'); });
        this.classList.add('active');
        var secId = target === 'cotizaciones' ? 'secCotizaciones' : target === 'clientes' ? 'secClientes' : 'secProveedores';
        document.getElementById(secId).classList.add('active');

        // Cargar datos de la sección si no están cargados
        if (target === 'clientes' && window.BNKClientes) window.BNKClientes.load();
        if (target === 'proveedores' && window.BNKProveedores) window.BNKProveedores.load();

        // Actualizar botón header
        var btnBNK = document.getElementById('btnNuevaBNK');
        btnBNK.style.display = target === 'cotizaciones' ? '' : 'none';
      });
    });
```

- [ ] **Step 3: Actualizar `loadData()` para sincronizar `allClientes` expandido**

En la función `loadData()`, el bloque donde se cargan clientes (líneas 517-523), actualizar para que `allClientes` contenga todos los campos nuevos (no solo empresa/contacto/telefono/correo), para que el autocompletado BNK y el módulo Clientes compartan el mismo array.

- [ ] **Step 4: Commit**

```bash
git add js/pages/clientes.js cotizador-munet/dashboard.html
git commit -m "feat: implementar módulo JS de Clientes con CRUD, filtros e indicadores"
```

---

### Task 6: JS — Módulo de Proveedores con servicios

**Files:**
- Create: `js/pages/proveedores.js`

**Interfaces:**
- Consumes: `APPS_SCRIPT_URL` (global del dashboard)
- Consumes: `escapeHTML()`, `formatMXN()`, `formatFechaDisplay()` (del script inline)
- Produces: `window.BNKProveedores` — objeto global con: `load()`, `renderTable()`, `abrirModal(provData)`, `calcCompletitud(obj)`, `loadServicios(provId)`, `guardarServicio()`, `eliminarServicio(id)`

- [ ] **Step 1: Crear `js/pages/proveedores.js` con el módulo completo**

Estructura idéntica a `clientes.js` pero con:
- Array de campos/keys adaptado a las 47 columnas de Proveedores
- Filtros por tipo (Pool/One Shot) y estado (Activo/Inactivo)
- Indicadores: Total, Pool, One Shot, % Completitud
- Tab 5 de Servicios: al abrir modal, fetch `listServicios?proveedorId=PRV-XXXX`
- Tabla inline de servicios con edición: cada fila tiene inputs para Categoría, Servicio, Unidad, Costo
- Botón "+ Agregar Servicio" crea fila de inputs, al guardar POST `createServicio`
- Editar servicio: click en ✏️ convierte la fila en inputs editables, guardar POST `updateServicio`
- Eliminar servicio: confirm → fetch `deleteServicio`

Tamaño estimado: ~450 líneas.

- [ ] **Step 2: Commit**

```bash
git add js/pages/proveedores.js
git commit -m "feat: implementar módulo JS de Proveedores con CRUD y servicios"
```

---

### Task 7: Vinculación con cotizaciones BNK y cotizaciones vinculadas

**Files:**
- Modify: `cotizador-munet/dashboard.html` (script inline — función `setupAutocompletado()` y modal BNK)
- Modify: `js/pages/clientes.js` (agregar sección de cotizaciones vinculadas al modal)
- Modify: `js/pages/proveedores.js` (agregar sección de cotizaciones vinculadas al modal)

**Interfaces:**
- Consumes: `allData` (array de cotizaciones del script inline)
- Consumes: `allClientes` (actualizado con campos expandidos)
- Consumes: `window.BNKProveedores` (para obtener servicios del proveedor seleccionado)

- [ ] **Step 1: Mejorar autocompletado de cliente en modal BNK**

En `setupAutocompletado()` (línea 733), actualizar para que al seleccionar un cliente se auto-llene también el `clienteId` en un campo hidden. Agregar campo hidden `#bnkClienteId` al HTML del modal BNK. Actualizar el payload en `enviarCotizacionBNK()` para enviar `clienteId`.

- [ ] **Step 2: Agregar campo Proveedor al modal BNK**

En el HTML del modal BNK, después del campo "NOTA INTERNA", agregar:

```html
<div class="bnk-form-group">
  <label class="bnk-label">PROVEEDOR (OPCIONAL)</label>
  <input type="text" class="bnk-input" id="bnkProveedor" placeholder="Buscar proveedor..." autocomplete="off">
  <div class="bnk-autocomplete" id="bnkAutoProveedor"></div>
  <input type="hidden" id="bnkProveedorId">
</div>
```

Agregar autocompletado de proveedores similar al de clientes. Al seleccionar un proveedor, cargar sus servicios y ofrecerlos como opciones en los conceptos.

- [ ] **Step 3: Agregar cotizaciones vinculadas al modal de Cliente**

En `clientes.js`, al abrir el modal, buscar en `allData` las cotizaciones donde `cliente` coincida con la empresa del cliente. Mostrar una sección debajo de los tabs:

```html
<div class="bnk-section-label" style="margin-top:16px">COTIZACIONES VINCULADAS: N</div>
<div id="cliCotizaciones"><!-- folios clickeables --></div>
```

- [ ] **Step 4: Agregar cotizaciones vinculadas al modal de Proveedor**

Similar al paso anterior pero filtrando por proveedorId en CotizacionesBNK.

- [ ] **Step 5: Commit**

```bash
git add cotizador-munet/dashboard.html js/pages/clientes.js js/pages/proveedores.js
git commit -m "feat: vincular Clientes y Proveedores con cotizaciones BNK"
```

---

### Task 8: Actualizar CLAUDE.md y verificación final

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: todos los archivos modificados/creados en Tasks 1-7

- [ ] **Step 1: Actualizar CLAUDE.md**

Agregar en la sección de Architecture/JS las entradas nuevas:
- `js/pages/clientes.js` — módulo CRUD de Clientes para dashboard
- `js/pages/proveedores.js` — módulo CRUD de Proveedores con servicios para dashboard

Actualizar la sección de Backend para documentar las hojas y endpoints nuevos:
- Hojas: `Clientes` (42 cols), `Proveedores` (47 cols), `ServiciosProveedor` (7 cols)
- Endpoints nuevos: listProveedores, createProveedor, updateProveedor, deleteProveedor, listServicios, createServicio, updateServicio, deleteServicio

- [ ] **Step 2: Verificar carga del dashboard en navegador**

Abrir `cotizador-munet/dashboard.html` y verificar:
1. Los 3 tabs aparecen y switchean correctamente
2. La sección de Cotizaciones sigue funcionando sin cambios
3. La sección de Clientes muestra tabla vacía con botón "+ Nuevo Cliente"
4. El modal de Cliente abre, los tabs internos funcionan, el % completitud se calcula
5. La sección de Proveedores muestra tabla vacía con botón "+ Nuevo Proveedor"
6. El modal de Proveedor abre con 5 tabs, el tab de servicios tiene la tabla y botón

- [ ] **Step 3: Commit final**

```bash
git add CLAUDE.md
git commit -m "docs: actualizar CLAUDE.md con módulos de Clientes y Proveedores"
```
