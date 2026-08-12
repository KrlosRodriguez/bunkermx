/**
 * MUNET Cotizador — Google Apps Script
 * Backend para recibir cotizaciones, guardar en Sheet, enviar emails y subir PDFs a Drive.
 *
 * INSTRUCCIONES DE CONFIGURACIÓN:
 *
 * 1. Ve a https://script.google.com y crea un nuevo proyecto
 * 2. Copia TODO este código y pégalo en el editor
 * 3. Cambia SHEET_ID por el ID de tu Google Sheet
 *    (Crea un Sheet, el ID está en la URL: docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit)
 * 4. Cambia NOTIFY_EMAIL por el email del equipo de ventas
 * 5. Cambia DRIVE_FOLDER_ID por el ID de la carpeta en Drive para PDFs
 *    (Crea carpeta "MUNET Cotizaciones PDFs", abre la carpeta, el ID está en la URL)
 * 6. Guarda (Ctrl+S)
 * 7. Despliega: Implementar → Nueva implementación
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Quién tiene acceso: Cualquier persona
 * 8. Copia la URL y pégala en APPS_SCRIPT_URL del cotizador
 *
 * GOOGLE SHEET — Encabezados (fila 1 de la hoja "Cotizaciones"):
 *   A: Fecha | B: Folio | C: Cliente | D: Agencia | E: Evento | F: Contacto
 *   G: Teléfono | H: Correo | I: Tipo | J: Fechas | K: Desglose Venues (JSON)
 *   L: Días Total | M: Descripción | N: Horario | O: Espacios
 *   P: Renta Total | Q: Montaje Total | R: Subtotal | S: IVA | T: Total
 *   U: Link PDF | V: Estado
 */

// ── CONFIGURACIÓN ──
var SHEET_ID = '1MrynkbdpsQOq2IuzalyiRfVesUhWcs_020BDl8S_1vk';
var NOTIFY_EMAIL = 'cotizaciones@bunkermx.com,krloro92@gmail.com,cacho@bunkermx.com';
var SHEET_NAME = 'Cotizaciones';
var DRIVE_FOLDER_ID = '17Hm7m95pxBQFnAD9oO9Mfv0A-136zTYn';
var SENDER_NAME = 'MUNET Cotizaciones · BUNKER'; // nombre visible del remitente (el email será el de la cuenta desplegadora)
var SHEET_CLIENTES = 'Clientes';
var SHEET_BNK = 'CotizacionesBNK';
var SHEET_CATALOGO = 'CatalogoPrecio';
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

// ── Doble escritura a Firestore (transitorio) ──
var FIREBASE_PROJECT = 'bunker-panel';
var FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT + '/databases/(default)/documents';

function writeToFirestore(collection, docId, data) {
  try {
    var token = ScriptApp.getOAuthToken();
    var url = FIRESTORE_BASE + '/' + collection + '/' + docId;
    var fields = {};

    Object.keys(data).forEach(function (key) {
      var val = data[key];
      if (val === null || val === undefined || val === '') {
        fields[key] = { stringValue: '' };
      } else if (typeof val === 'number') {
        fields[key] = { doubleValue: val };
      } else if (typeof val === 'boolean') {
        fields[key] = { booleanValue: val };
      } else if (Array.isArray(val)) {
        fields[key] = {
          arrayValue: {
            values: val.map(function (v) { return { stringValue: String(v) }; })
          }
        };
      } else {
        fields[key] = { stringValue: String(val) };
      }
    });

    var payload = { fields: fields };

    UrlFetchApp.fetch(url, {
      method: 'PATCH',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log('Firestore write error (' + collection + '/' + docId + '): ' + e.message);
  }
}

// ── Utilidad: obtener o crear hoja con encabezados ──
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

// ── doPost: Recibir cotización ──
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // ── Branch: Cotización BNK ──
    if (data.tipoCotizacion === 'BNK') {
      return crearCotizacionBNK(data);
    }

    // ── Clientes POST ──
    if (data.tipoOperacion === 'createCliente') return createCliente(data);
    if (data.tipoOperacion === 'updateCliente') return updateCliente(data);

    // ── Proveedores POST ──
    if (data.tipoOperacion === 'createProveedor') return createProveedor(data);
    if (data.tipoOperacion === 'updateProveedor') return updateProveedor(data);

    // ── Servicios Proveedor POST ──
    if (data.tipoOperacion === 'createServicio') return createServicio(data);
    if (data.tipoOperacion === 'updateServicio') return updateServicio(data);

    var ss = SpreadsheetApp.openById(SHEET_ID);

    var fecha = new Date();
    var fechaStr = Utilities.formatDate(fecha, 'America/Mexico_City', 'dd/MM/yyyy HH:mm');
    var folio = data.folio || 'SIN-FOLIO';

    // ── Subir PDF a Google Drive ──
    var driveLink = '';
    var pdfBlob = null;
    if (data.pdfBase64) {
      var fileName = 'Cotizacion-MUNET-' + folio + '.pdf';
      var pdfBytes = Utilities.base64Decode(data.pdfBase64);
      pdfBlob = Utilities.newBlob(pdfBytes, 'application/pdf', fileName);

      var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      var file = folder.createFile(pdfBlob);
      driveLink = file.getUrl();

      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {}
    }

    // ── Guardar en Google Sheet ──
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'Fecha', 'Folio', 'Cliente', 'Agencia', 'Evento', 'Contacto',
        'Teléfono', 'Correo', 'Tipo', 'Fechas', 'Desglose Venues',
        'Días Total', 'Descripción', 'Horario', 'Espacios',
        'Renta Total', 'Montaje Total', 'Subtotal', 'IVA', 'Total',
        'Link PDF', 'Estado'
      ]);
      sheet.getRange(1, 1, 1, 22).setFontWeight('bold').setBackground('#050905').setFontColor('#00FF41');
      sheet.setFrozenRows(1);
    }

    // Parsear espacios
    var espaciosArr = [];
    try {
      espaciosArr = JSON.parse(data.espacios || '[]');
    } catch (pe) {
      espaciosArr = [];
    }
    var espaciosNombres = espaciosArr.map(function (e) { return e.name; }).join(', ');

    // Construir resumen de fechas desde eventDays de cada espacio
    var fechasResumen = buildFechasResumen(espaciosArr);

    // Desglose por venue (JSON para no perder datos individuales)
    var desgloseVenues = JSON.stringify(espaciosArr.map(function (esp) {
      return {
        name: esp.name,
        diasRegular: esp.diasRegular || 0,
        diasWeekend: esp.diasWeekend || 0,
        diasTotal: esp.diasTotal || 0,
        eventDays: esp.eventDays || [],
        precioRegular: esp.precioRegular || 0,
        precioWeekend: esp.precioWeekend || 0,
        eventoTotal: esp.eventoTotal || 0,
        montajeDias: esp.montajeDias || 0,
        montajeTotal: esp.montajeTotal || 0
      };
    }));

    // Horario
    var horario = '';
    if (data.horaInicio || data.horaFin) {
      horario = (data.horaInicio || '') + ' — ' + (data.horaFin || '');
    }

    sheet.appendRow([
      fechaStr,
      folio,
      data.cliente || '',
      data.agencia || '',
      data.evento || '',
      data.contacto || '',
      data.telefono || '',
      data.correo || '',
      data.tipoEvento === 'publico' ? 'Público' : 'Privado',
      fechasResumen,
      desgloseVenues,
      data.diasTotal || 0,
      data.descripcion || '',
      horario,
      espaciosNombres,
      data.rentaTotal || 0,
      data.montajeTotal || 0,
      data.subtotal || 0,
      data.iva || 0,
      data.total || 0,
      driveLink,
      'Nueva'
    ]);

    // ── Doble escritura a Firestore ──
    writeToFirestore('cotizaciones', folio, {
      fuente: 'MNT',
      fecha: fechaStr,
      folio: folio,
      cliente: data.cliente || '',
      agencia: data.agencia || '',
      evento: data.evento || '',
      contacto: data.contacto || '',
      telefono: data.telefono || '',
      correo: data.correo || '',
      tipo: data.tipoEvento === 'publico' ? 'Público' : 'Privado',
      fechas: fechasResumen,
      desgloseVenues: desgloseVenues,
      diasTotal: data.diasTotal || 0,
      descripcion: data.descripcion || '',
      horario: horario,
      espacios: espaciosNombres,
      rentaTotal: data.rentaTotal || 0,
      montajeTotal: data.montajeTotal || 0,
      subtotal: data.subtotal || 0,
      iva: data.iva || 0,
      total: data.total || 0,
      linkPdf: driveLink,
      estado: 'Nueva'
    });

    // ── Email al equipo BUNKER ──
    var adminSubject = 'Nueva cotización MUNET — ' + folio + ' — ' + (data.cliente || 'Sin nombre');
    var adminBody = '🟢 Nueva cotización desde el simulador MUNET\n\n'
      + '══════════════════════════════\n'
      + 'FOLIO: ' + folio + '\n'
      + '══════════════════════════════\n\n'
      + 'DATOS DEL CLIENTE\n'
      + '─────────────────\n'
      + 'Cliente: ' + (data.cliente || '—') + '\n'
      + 'Agencia: ' + (data.agencia || '—') + '\n'
      + 'Evento: ' + (data.evento || '—') + '\n'
      + 'Contacto: ' + (data.contacto || '—') + '\n'
      + 'Teléfono: ' + (data.telefono || '—') + '\n'
      + 'Correo: ' + (data.correo || '—') + '\n\n'
      + 'EVENTO\n'
      + '──────\n'
      + 'Tipo: ' + (data.tipoEvento === 'publico' ? 'Público' : 'Privado') + '\n'
      + 'Fechas: ' + (fechasResumen || '—') + '\n'
      + 'Días: ' + (data.diasTotal || 0) + '\n'
      + 'Horario: ' + (horario || '—') + '\n'
      + 'Descripción: ' + (data.descripcion || '—') + '\n\n'
      + 'ESPACIOS\n'
      + '────────\n'
      + espaciosNombres + '\n\n'
      + 'DESGLOSE\n'
      + '────────\n'
      + 'Renta:    $' + formatNum(data.rentaTotal) + '\n'
      + 'Montaje:  $' + formatNum(data.montajeTotal) + '\n'
      + 'Subtotal: $' + formatNum(data.subtotal) + '\n'
      + 'IVA:      $' + formatNum(data.iva) + '\n'
      + 'TOTAL:    $' + formatNum(data.total) + '\n\n'
      + (driveLink ? 'PDF: ' + driveLink + '\n\n' : '')
      + '— MUNET · Simulador de Costos';

    var adminMailOptions = { name: SENDER_NAME };
    if (pdfBlob) adminMailOptions.attachments = [pdfBlob];
    MailApp.sendEmail(NOTIFY_EMAIL, adminSubject, adminBody, adminMailOptions);

    // ── Email al cliente ──
    if (data.correo) {
      var clientSubject = 'Tu cotización MUNET — ' + folio;
      var clientBody = 'Hola ' + (data.contacto || data.cliente || '') + ',\n\n'
        + 'Gracias por tu interés en el MUNET — Museo Nacional de Energía y Tecnología.\n\n'
        + 'Recibimos tu solicitud de cotización con folio ' + folio + '.\n'
        + 'Adjuntamos el PDF con el desglose de tu precotización.\n\n'
        + 'Nuestro equipo te contactará en menos de 24 horas para dar seguimiento.\n\n'
        + '══════════════════════════════\n'
        + 'Espacios: ' + espaciosNombres + '\n'
        + 'Total estimado: $' + formatNum(data.total) + ' (IVA incluido)\n'
        + '══════════════════════════════\n\n'
        + 'Saludos,\n'
        + 'Equipo MUNET\n'
        + 'BUNKER Creatividad Empresarial\n'
        + 'contacto@museomunet.com · museomunet.com';

      var clientMailOptions = {
        name: SENDER_NAME
      };
      if (pdfBlob) clientMailOptions.attachments = [pdfBlob];
      MailApp.sendEmail(data.correo, clientSubject, clientBody, clientMailOptions);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      folio: folio,
      driveLink: driveLink
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Crear cotización BNK (servicios/producción) ──
function crearCotizacionBNK(data) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var fecha = new Date();
    var fechaStr = Utilities.formatDate(fecha, 'America/Mexico_City', 'dd/MM/yyyy HH:mm');
    var folio = data.folio || 'SIN-FOLIO';
    var empresa = data.empresa || '';

    // ── Subir PDF a Google Drive ──
    var driveLink = '';
    var pdfBlob = null;
    if (data.pdfBase64) {
      var fileName = 'Cotizacion-BNK-' + folio + '.pdf';
      var pdfBytes = Utilities.base64Decode(data.pdfBase64);
      pdfBlob = Utilities.newBlob(pdfBytes, 'application/pdf', fileName);

      var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      var file = folder.createFile(pdfBlob);
      driveLink = file.getUrl();

      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {}
    }

    // ── Guardar en hoja CotizacionesBNK ──
    var headers = [
      'Fecha', 'Folio BNK', 'Folio MNT', 'Cliente ID', 'Empresa', 'Contacto',
      'Teléfono', 'Correo', 'Evento', 'Fecha Evento', 'Sede', 'Conceptos',
      'Condiciones', 'Subtotal', 'IVA', 'Total', 'Link PDF', 'Estado'
    ];
    var sheet = getOrCreateSheet(ss, SHEET_BNK, headers, 18);

    sheet.appendRow([
      fechaStr,
      folio,
      data.folioMNT || '',
      data.clienteId || '',
      empresa,
      data.contacto || '',
      data.telefono || '',
      data.correo || '',
      data.evento || '',
      data.fechaEvento || '',
      data.sede || '',
      data.conceptos || '',
      data.condiciones || '',
      data.subtotal || 0,
      data.iva || 0,
      data.total || 0,
      driveLink,
      'Nueva'
    ]);

    // ── Doble escritura a Firestore ──
    writeToFirestore('cotizaciones', folio, {
      fuente: 'BNK',
      fecha: fechaStr,
      folio: folio,
      folioMNT: data.folioMNT || '',
      clienteId: data.clienteId || '',
      empresa: empresa,
      contacto: data.contacto || '',
      telefono: data.telefono || '',
      correo: data.correo || '',
      evento: data.evento || '',
      fechaEvento: data.fechaEvento || '',
      sede: data.sede || '',
      conceptos: data.conceptos || '',
      condiciones: data.condiciones || '',
      subtotal: data.subtotal || 0,
      iva: data.iva || 0,
      total: data.total || 0,
      linkPdf: driveLink,
      estado: 'Nueva'
    });

    // ── Email al equipo BUNKER ──
    var adminSubject = 'Nueva cotización BNK — ' + folio + ' — ' + empresa;
    var adminBody = '🟢 Nueva cotización BNK (Servicios / Producción)\n\n'
      + '══════════════════════════════\n'
      + 'FOLIO: ' + folio + '\n'
      + '══════════════════════════════\n\n'
      + 'DATOS DEL CLIENTE\n'
      + '─────────────────\n'
      + 'Empresa: ' + (empresa || '—') + '\n'
      + 'Contacto: ' + (data.contacto || '—') + '\n'
      + 'Teléfono: ' + (data.telefono || '—') + '\n'
      + 'Correo: ' + (data.correo || '—') + '\n\n'
      + 'EVENTO\n'
      + '──────\n'
      + 'Evento: ' + (data.evento || '—') + '\n'
      + 'Fecha evento: ' + (data.fechaEvento || '—') + '\n'
      + 'Sede: ' + (data.sede || '—') + '\n\n'
      + 'DESGLOSE\n'
      + '────────\n'
      + 'Subtotal: $' + formatNum(data.subtotal) + '\n'
      + 'IVA:      $' + formatNum(data.iva) + '\n'
      + 'TOTAL:    $' + formatNum(data.total) + '\n\n'
      + (driveLink ? 'PDF: ' + driveLink + '\n\n' : '')
      + '— BNK Cotizaciones · BUNKER';

    var adminMailOptions = { name: SENDER_NAME };
    if (pdfBlob) adminMailOptions.attachments = [pdfBlob];
    MailApp.sendEmail(NOTIFY_EMAIL, adminSubject, adminBody, adminMailOptions);

    return jsonResponse({ status: 'ok', folio: folio, driveLink: driveLink });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ── Clientes ──
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

  // ── Doble escritura a Firestore ──
  writeToFirestore('clientes', newId, data);

  return jsonResponse({ status: 'ok', id: newId });
}

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

  // ── Doble escritura a Firestore ──
  writeToFirestore('clientes', data.id, data);

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

  // ── Doble escritura a Firestore ──
  writeToFirestore('proveedores', newId, data);

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

  // ── Doble escritura a Firestore ──
  writeToFirestore('proveedores', data.id, data);

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

// ── Catálogo de precios ──
function listCatalogo() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var headers = ['ID', 'Categoría', 'Concepto', 'Unidad', 'Precio', 'Activo'];
  var sheet = getOrCreateSheet(ss, SHEET_CATALOGO, headers, 6);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', data: [] });

  var values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  var items = [];
  values.forEach(function (row) {
    if (String(row[5]).toLowerCase() !== 'no') {
      items.push({
        id: row[0],
        categoria: row[1],
        concepto: row[2],
        unidad: row[3],
        precio: row[4],
        activo: row[5]
      });
    }
  });
  return jsonResponse({ status: 'ok', data: items });
}

function saveCatalogo(params) {
  if (!params.concepto) {
    return jsonResponse({ status: 'error', message: 'El campo concepto es obligatorio' });
  }
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var headers = ['ID', 'Categoría', 'Concepto', 'Unidad', 'Precio', 'Activo'];
  var sheet = getOrCreateSheet(ss, SHEET_CATALOGO, headers, 6);

  var lastRow = sheet.getLastRow();
  var nextNum = 1;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function (r) {
      var match = String(r[0]).match(/CAT-(\d+)/);
      if (match) {
        var n = parseInt(match[1], 10);
        if (n >= nextNum) nextNum = n + 1;
      }
    });
  }
  var newId = 'CAT-' + ('0000' + nextNum).slice(-4);

  sheet.appendRow([
    newId,
    params.categoria || '',
    params.concepto || '',
    params.unidad || 'Evento',
    params.precio || 0,
    'Sí'
  ]);

  return jsonResponse({ status: 'ok', id: newId });
}

// ── Listar cotizaciones BNK ──
function listBNK() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_BNK);
  if (!sheet) return jsonResponse({ status: 'ok', data: [] });

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'ok', data: [] });

  var values = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
  var cotizaciones = values.map(function (row) {
    var fechaVal = row[0];
    if (fechaVal instanceof Date) {
      fechaVal = Utilities.formatDate(fechaVal, 'America/Mexico_City', 'dd/MM/yyyy HH:mm');
    }
    return {
      fecha: fechaVal,
      folio: row[1],
      folioMNT: row[2],
      clienteId: row[3],
      empresa: row[4],
      contacto: row[5],
      telefono: row[6],
      correo: row[7],
      evento: row[8],
      fechaEvento: row[9],
      sede: row[10],
      conceptos: row[11],
      condiciones: row[12],
      subtotal: row[13],
      iva: row[14],
      total: row[15],
      linkPdf: row[16],
      estado: row[17],
      fuente: 'BNK'
    };
  });
  return jsonResponse({ status: 'ok', data: cotizaciones, total: cotizaciones.length });
}

// ── Listar TODAS las cotizaciones (MNT + BNK) ──
function listAll() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var all = [];

  // MNT
  var sheetMNT = ss.getSheetByName(SHEET_NAME);
  if (sheetMNT && sheetMNT.getLastRow() >= 2) {
    var mntValues = sheetMNT.getRange(2, 1, sheetMNT.getLastRow() - 1, 22).getValues();
    mntValues.forEach(function (row) {
      var fechaVal = row[0];
      if (fechaVal instanceof Date) {
        fechaVal = Utilities.formatDate(fechaVal, 'America/Mexico_City', 'dd/MM/yyyy HH:mm');
      }
      var desgloseVenues = [];
      try {
        if (row[10]) desgloseVenues = JSON.parse(row[10]);
      } catch (pe) {}
      all.push({
        fecha: fechaVal,
        folio: row[1],
        cliente: row[2],
        agencia: row[3],
        evento: row[4],
        contacto: row[5],
        telefono: row[6],
        correo: row[7],
        tipo: row[8],
        fechas: row[9],
        desgloseVenues: desgloseVenues,
        diasTotal: row[11],
        descripcion: row[12],
        horario: row[13],
        espacios: row[14],
        rentaTotal: row[15],
        montajeTotal: row[16],
        subtotal: row[17],
        iva: row[18],
        total: row[19],
        linkPdf: row[20],
        estado: row[21],
        fuente: 'MNT'
      });
    });
  }

  // BNK
  var sheetBNK = ss.getSheetByName(SHEET_BNK);
  if (sheetBNK && sheetBNK.getLastRow() >= 2) {
    var bnkValues = sheetBNK.getRange(2, 1, sheetBNK.getLastRow() - 1, 18).getValues();
    bnkValues.forEach(function (row) {
      var fechaVal = row[0];
      if (fechaVal instanceof Date) {
        fechaVal = Utilities.formatDate(fechaVal, 'America/Mexico_City', 'dd/MM/yyyy HH:mm');
      }
      all.push({
        fecha: fechaVal,
        folio: row[1],
        folioMNT: row[2],
        clienteId: row[3],
        empresa: row[4],
        contacto: row[5],
        telefono: row[6],
        correo: row[7],
        evento: row[8],
        fechaEvento: row[9],
        sede: row[10],
        conceptos: row[11],
        condiciones: row[12],
        subtotal: row[13],
        iva: row[14],
        total: row[15],
        linkPdf: row[16],
        estado: row[17],
        fuente: 'BNK'
      });
    });
  }

  return jsonResponse({ status: 'ok', data: all, total: all.length });
}

// ── Actualizar estado de cotización BNK ──
function updateStatusBNK(folio, nuevoEstado) {
  if (!folio || !nuevoEstado) {
    return jsonResponse({ status: 'error', message: 'Faltan parámetros folio y estado' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_BNK);
  if (!sheet) return jsonResponse({ status: 'error', message: 'Hoja CotizacionesBNK no encontrada' });

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ status: 'error', message: 'Folio no encontrado: ' + folio });

  var folios = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // columna B = Folio BNK

  for (var i = 0; i < folios.length; i++) {
    if (folios[i][0] === folio) {
      sheet.getRange(i + 2, 18).setValue(nuevoEstado); // columna R = Estado
      return jsonResponse({ status: 'ok', folio: folio, estado: nuevoEstado });
    }
  }

  return jsonResponse({ status: 'error', message: 'Folio no encontrado: ' + folio });
}

// ── Seed: Poblar catálogo con datos iniciales ──
function seedCatalogo() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var headers = ['ID', 'Categoría', 'Concepto', 'Unidad', 'Precio', 'Activo'];
  var sheet = getOrCreateSheet(ss, SHEET_CATALOGO, headers, 6);

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    return jsonResponse({ status: 'ok', message: 'Catálogo ya tiene datos, no se sobrescribe', items: lastRow - 1 });
  }

  var items = [
    // Servicios Básicos
    ['Servicios Básicos', 'Stage Manager', 'Evento', 3500],
    ['Servicios Básicos', 'Crew Chief', 'Evento', 2500],
    ['Servicios Básicos', 'Supervisor Seguridad 8hrs', 'Evento', 1500],
    ['Servicios Básicos', 'Elemento Seguridad 8hrs', 'Evento', 1450],
    ['Servicios Básicos', 'Supervisor Seguridad 12hrs', 'Evento', 2250],
    ['Servicios Básicos', 'Elemento Seguridad 12hrs', 'Evento', 2175],
    ['Servicios Básicos', 'Supervisor Limpieza', 'Evento', 1500],
    ['Servicios Básicos', 'Elemento Limpieza', 'Evento', 1250],
    ['Servicios Básicos', 'Ambulancia 8hrs', 'Evento', 6000],
    ['Servicios Básicos', 'Ambulancia 12hrs', 'Evento', 9000],
    ['Servicios Básicos', 'Paramédico 8hrs', 'Evento', 2250],
    ['Servicios Básicos', 'Paramédico 12hrs', 'Evento', 2250],
    ['Servicios Básicos', 'Stage Hands', 'Evento', 1100],
    // Mobiliario
    ['Mobiliario', 'Silla Bacará', 'Pieza', 170],
    ['Mobiliario', 'Silla Ghost', 'Pieza', 170],
    ['Mobiliario', 'Flete', 'Evento', 24000],
    ['Mobiliario', 'Maniobras', 'Evento', 5000],
    ['Mobiliario', 'Supervisión mobiliario', 'Evento', 4000],
    // A&B
    ['A&B', 'Canapés Bienvenida', 'Pax', 230],
    ['A&B', 'Barra Libre Diamante', 'Pax', 1380],
    ['A&B', 'Cena 3 Tiempos', 'Pax', 1150],
    ['A&B', 'Coffee Break Staff', 'Pax', 145.20],
    ['A&B', 'Catering VIP', 'Evento', 2420],
    ['A&B', 'Box Lunch Cena', 'Pax', 181.50],
    // Estructura
    ['Estructura', 'Twin Pack 150kW', 'Evento', 45000],
    ['Estructura', 'Generador 150kW', 'Evento', 12000],
    ['Estructura', 'Doble tiro cableado', 'Evento', 19500],
    // Contenido/Mapping
    ['Contenido/Mapping', 'Servidor video', 'Evento', 20000],
    ['Contenido/Mapping', 'Operación mappeo', 'Día', 10000],
    ['Contenido/Mapping', 'Operador pruebas', 'Día', 12000],
    ['Contenido/Mapping', 'Contenido por minuto', 'Minuto', 45000],
    ['Contenido/Mapping', 'Videoproyector 45K', 'Evento', 54050],
    ['Contenido/Mapping', 'Creatividad dirección', 'Evento', 40250],
    // Suministros
    ['Suministros', 'Papel higiénico', 'Paquete', 461.95],
    ['Suministros', 'Toalla interdoblada', 'Paquete', 271.17],
    ['Suministros', 'Jabón líquido', 'Pieza', 251.27],
    ['Suministros', 'Tapete mingitorio', 'Pieza', 288.07]
  ];

  for (var i = 0; i < items.length; i++) {
    var catId = 'CAT-' + ('0000' + (i + 1)).slice(-4);
    sheet.appendRow([catId, items[i][0], items[i][1], items[i][2], items[i][3], 'Sí']);
  }

  return jsonResponse({ status: 'ok', message: 'Catálogo poblado con ' + items.length + ' items', items: items.length });
}

// ── doGet: Devolver cotizaciones para el dashboard ──
function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = params.action || 'list';

    // Actualizar estado de una cotización
    if (action === 'updateStatus') {
      return updateStatus(params.folio, params.estado);
    }

    // ── Endpoints BNK ──
    if (action === 'listCatalogo') return listCatalogo();
    if (action === 'saveCatalogo') return saveCatalogo(params);
    if (action === 'listBNK') return listBNK();
    if (action === 'listAll') return listAll();
    if (action === 'updateStatusBNK') return updateStatusBNK(params.folio, params.estado);
    if (action === 'seedCatalogo') return seedCatalogo();

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

    // Listar cotizaciones
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonResponse({ status: 'ok', data: [], total: 0 });
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return jsonResponse({ status: 'ok', data: [], total: 0 });
    }

    var range = sheet.getRange(2, 1, lastRow - 1, 22);
    var values = range.getValues();

    var cotizaciones = values.map(function (row) {
      // Formatear fecha: puede ser Date object o string
      var fechaVal = row[0];
      if (fechaVal instanceof Date) {
        fechaVal = Utilities.formatDate(fechaVal, 'America/Mexico_City', 'dd/MM/yyyy HH:mm');
      }

      // Parsear desglose de venues si existe
      var desgloseVenues = [];
      try {
        if (row[10]) desgloseVenues = JSON.parse(row[10]);
      } catch (pe) {}

      return {
        fecha:        fechaVal,
        folio:        row[1],
        cliente:      row[2],
        agencia:      row[3],
        evento:       row[4],
        contacto:     row[5],
        telefono:     row[6],
        correo:       row[7],
        tipo:         row[8],
        fechas:       row[9],
        desgloseVenues: desgloseVenues,
        diasTotal:    row[11],
        descripcion:  row[12],
        horario:      row[13],
        espacios:     row[14],
        rentaTotal:   row[15],
        montajeTotal: row[16],
        subtotal:     row[17],
        iva:          row[18],
        total:        row[19],
        linkPdf:      row[20],
        estado:       row[21]
      };
    });

    return jsonResponse({ status: 'ok', data: cotizaciones, total: cotizaciones.length });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ── Actualizar estado de cotización ──
function updateStatus(folio, nuevoEstado) {
  if (!folio || !nuevoEstado) {
    return jsonResponse({ status: 'error', message: 'Faltan parámetros folio y estado' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return jsonResponse({ status: 'error', message: 'Hoja no encontrada' });

  var lastRow = sheet.getLastRow();
  var folios = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // columna B = folio

  for (var i = 0; i < folios.length; i++) {
    if (folios[i][0] === folio) {
      sheet.getRange(i + 2, 22).setValue(nuevoEstado); // columna V = estado
      return jsonResponse({ status: 'ok', folio: folio, estado: nuevoEstado });
    }
  }

  return jsonResponse({ status: 'error', message: 'Folio no encontrado: ' + folio });
}

// ── Utilidades ──

/**
 * Construir resumen de fechas a partir de eventDays[] de cada espacio.
 * Ejemplo salida: "AGO 2026: 15, 17 · SEP 2026: 3"
 */
function buildFechasResumen(espaciosArr) {
  var meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  var allDays = [];
  espaciosArr.forEach(function (esp) {
    (esp.eventDays || []).forEach(function (d) {
      if (allDays.indexOf(d) < 0) allDays.push(d);
    });
  });
  if (allDays.length === 0) return '';
  allDays.sort();

  // Agrupar por "MES AÑO"
  var groups = {};
  var order = [];
  allDays.forEach(function (iso) {
    var parts = iso.split('-');
    var y = parts[0];
    var m = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    var key = meses[m] + ' ' + y;
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(day);
  });

  return order.map(function (k) {
    return k + ': ' + groups[k].join(', ');
  }).join(' · ');
}

function formatNum(n) {
  if (!n && n !== 0) return '0';
  return Number(n).toLocaleString('es-MX');
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
