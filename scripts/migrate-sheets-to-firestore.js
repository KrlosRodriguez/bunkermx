/**
 * migrate-sheets-to-firestore.js
 * Ejecutar UNA VEZ desde el editor de Apps Script.
 * Copiar este contenido como una función temporal junto con writeToFirestore().
 *
 * Prerequisitos:
 * - writeToFirestore() ya debe estar en el proyecto de Apps Script
 * - Firebase y Firestore habilitados en bunkermx-51834
 */

function migrateAllToFirestore() {
  var ss = SpreadsheetApp.openById('1MrynkbdpsQOq2IuzalyiRfVesUhWcs_020BDl8S_1vk');

  // Migrar Cotizaciones MNT
  _migrateSheet(ss, 'Cotizaciones', 'cotizaciones', function (row, headers) {
    return { fuente: 'MNT', folio: row[0] || '' };
  });

  // Migrar CotizacionesBNK
  _migrateSheet(ss, 'CotizacionesBNK', 'cotizaciones', function (row, headers) {
    return { fuente: 'BNK', folio: row[0] || '' };
  });

  // Migrar Clientes
  _migrateSheet(ss, 'Clientes', 'clientes', function (row, headers) {
    return { id: row[0] || '' };
  });

  // Migrar Proveedores
  _migrateSheet(ss, 'Proveedores', 'proveedores', function (row, headers) {
    return { id: row[0] || '' };
  });

  // Migrar CatalogoPrecio
  _migrateSheet(ss, 'CatalogoPrecio', 'catalogo', function (row, headers) {
    return {};
  });

  Logger.log('Migración completa');
}

function _migrateSheet(ss, sheetName, collection, extraFn) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) { Logger.log('Sheet no encontrada: ' + sheetName); return; }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var doc = {};
    for (var j = 0; j < headers.length; j++) {
      var key = String(headers[j]).trim();
      if (key) doc[key] = row[j] !== undefined ? row[j] : '';
    }
    var extra = extraFn(row, headers);
    Object.keys(extra).forEach(function (k) { doc[k] = extra[k]; });

    var docId = doc.folio || doc.id || Utilities.getUuid();
    writeToFirestore(collection, docId, doc);
    Utilities.sleep(50); // Rate limiting
  }
  Logger.log('Migrada: ' + sheetName + ' → ' + collection + ' (' + (data.length - 1) + ' docs)');
}
