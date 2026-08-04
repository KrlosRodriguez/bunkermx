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

// ── doPost: Recibir cotización ──
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
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

// ── doGet: Devolver cotizaciones para el dashboard ──
function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = params.action || 'list';

    // Actualizar estado de una cotización
    if (action === 'updateStatus') {
      return updateStatus(params.folio, params.estado);
    }

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
