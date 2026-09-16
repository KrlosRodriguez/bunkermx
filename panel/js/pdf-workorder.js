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
      doc.text('Ref: ' + cotData.folio + ' | BUNKER Creatividad Empresarial', margin, fy + 5);
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
      doc.text(String(value || '\u2014'), margin + 40, y + 4);
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
    drawField('Tel\u00e9fono', proveedorData.telefonoContacto || '');
    y += 4;

    // Event details
    drawSection('DETALLES DEL EVENTO');
    drawField('Evento', cotData.evento || '');
    drawField('Fecha', cotData.fechaEvento || '');
    drawField('Sede', cotData.sede || 'MUNET');
    drawField('Empresa', cotData.empresa || cotData.cliente || '');
    y += 4;

    // Services for this provider
    drawSection('SERVICIOS REQUERIDOS');

    var conceptos = [];
    try { conceptos = JSON.parse(cotData.conceptos || '[]'); } catch (e) { conceptos = []; }

    // Filter to this provider's services
    var provSrvs = conceptos.filter(function (c) {
      return c.proveedorId === proveedorData.id;
    });
    // Fallback: if no match by ID, try by provider name
    if (provSrvs.length === 0) {
      var provName = (proveedorData.razonSocial || proveedorData.nombreComercial || '').toLowerCase();
      provSrvs = conceptos.filter(function (c) {
        return c.proveedorNombre && c.proveedorNombre.toLowerCase() === provName;
      });
    }
    // If still no match, show all conceptos as reference
    if (provSrvs.length === 0 && conceptos.length > 0) {
      provSrvs = conceptos;
    }

    if (provSrvs.length === 0) {
      doc.setFontSize(8); doc.setTextColor(SUB_TEXT[0], SUB_TEXT[1], SUB_TEXT[2]);
      doc.text('(Sin conceptos registrados en esta cotizaci\u00f3n)', margin + 2, y + 4);
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
        doc.text('\u25b8 ' + bName, margin + 2, y + 4);
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
