// pdf-rebuild.js — Regenerar PDFs desde datos guardados en Firestore
(function () {
  'use strict';

  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }

  // ── Paleta compartida ──
  function _paleta(style) {
    var isNeon = style === 'neon';
    return {
      BG:          isNeon ? [5, 9, 5]       : [255, 255, 255],
      TEXT:        isNeon ? [237, 248, 237]  : [51, 51, 51],
      ACCENT:      isNeon ? [0, 255, 65]    : [198, 163, 80],
      HEADER_BG:   isNeon ? [5, 9, 5]       : [44, 36, 25],
      HEADER_TEXT: [255, 255, 255],
      SUB_TEXT:    isNeon ? [200, 236, 200]  : [120, 120, 120]
    };
  }

  var W = 210, margin = 20, contentW = W - margin * 2, H = 297;
  var HEADER_H = 28, FOOTER_H = 20, CONTENT_TOP = 36, MAX_Y = H - FOOTER_H;

  // ── Helpers de página ──
  function _drawBG(doc, p) { doc.setFillColor(p.BG[0], p.BG[1], p.BG[2]); doc.rect(0, 0, W, H, 'F'); }

  function _drawSection(doc, p, text, yRef) {
    _checkPage(doc, p, 14, yRef);
    doc.setFillColor(p.HEADER_BG[0], p.HEADER_BG[1], p.HEADER_BG[2]);
    doc.rect(margin, yRef.y, contentW, 8, 'F');
    doc.setTextColor(p.HEADER_TEXT[0], p.HEADER_TEXT[1], p.HEADER_TEXT[2]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(text, margin + 4, yRef.y + 5.5);
    doc.setFont('helvetica', 'normal');
    yRef.y += 10;
  }

  function _checkPage(doc, p, needed, yRef, headerFn) {
    if (yRef.y + needed > MAX_Y) {
      doc.addPage();
      if (headerFn) headerFn();
      else { _drawBG(doc, p); _defaultHeader(doc, p, yRef._headerTitle, yRef._headerSub); }
      yRef.y = CONTENT_TOP;
    }
  }

  function _defaultHeader(doc, p, title, sub) {
    _drawBG(doc, p);
    doc.setFillColor(p.HEADER_BG[0], p.HEADER_BG[1], p.HEADER_BG[2]);
    doc.rect(0, 0, W, HEADER_H, 'F');
    if (typeof BUNKER_LOGO_B64 !== 'undefined') {
      try { doc.addImage(BUNKER_LOGO_B64, 'PNG', margin, 5, 30, 11); } catch (e) {}
    }
    doc.setTextColor(p.HEADER_TEXT[0], p.HEADER_TEXT[1], p.HEADER_TEXT[2]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(title || '', 55, 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.setTextColor(p.ACCENT[0], p.ACCENT[1], p.ACCENT[2]);
    doc.text(sub || '', 55, 18);
  }

  function _drawFooter(doc, p, label) {
    var fy = H - FOOTER_H + 2;
    doc.setDrawColor(p.ACCENT[0], p.ACCENT[1], p.ACCENT[2]);
    doc.setLineWidth(0.3); doc.line(margin, fy, W - margin, fy);
    doc.setFontSize(6); doc.setTextColor(p.SUB_TEXT[0], p.SUB_TEXT[1], p.SUB_TEXT[2]);
    var pn = doc.internal.getCurrentPageInfo().pageNumber;
    doc.text('Pág. ' + pn + ' | ' + label, margin, fy + 5);
  }

  function _allFooters(doc, p, label) {
    var total = doc.internal.getNumberOfPages();
    for (var i = 1; i <= total; i++) { doc.setPage(i); _drawFooter(doc, p, label); }
  }

  // ═════════════════════════════════════════════════
  //  REBUILD MNT
  // ═════════════════════════════════════════════════
  function rebuildMNT(data, style) {
    var p = _paleta(style || 'neon');
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });

    var folio = data.folio || '';
    var cliente = data.cliente || '';
    var contacto = data.contacto || '';
    var evento = data.evento || '';
    var horario = data.horario || '';
    var tipo = data.tipo || 'Privado';
    var fechas = data.fechas || '';

    var desglose = [];
    try { desglose = JSON.parse(data.desgloseVenues || '[]'); } catch (e) {}

    var rentaTotal = Number(data.rentaTotal) || 0;
    var montajeTotal = Number(data.montajeTotal) || 0;
    var subtotal = Number(data.subtotal) || 0;
    var iva = Number(data.iva) || 0;
    var total = Number(data.total) || 0;

    var yRef = {
      y: 0,
      _headerTitle: 'Cotización MUNET — ' + (evento || 'Evento'),
      _headerSub: folio + ' | ' + cliente + ' | ' + contacto
    };

    // Página 1
    _defaultHeader(doc, p, yRef._headerTitle, yRef._headerSub);
    yRef.y = CONTENT_TOP;

    // Info evento
    doc.setFontSize(8); doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]);
    var info = 'Tipo: ' + tipo;
    if (horario) info += ' | Horario: ' + horario;
    doc.text(info, margin, yRef.y); yRef.y += 6;

    // Fechas
    if (fechas) {
      doc.setFontSize(7); doc.setTextColor(p.SUB_TEXT[0], p.SUB_TEXT[1], p.SUB_TEXT[2]);
      var fechasLines = doc.splitTextToSize('Fechas: ' + fechas, contentW);
      fechasLines.forEach(function (line) { doc.text(line, margin, yRef.y); yRef.y += 4; });
      yRef.y += 2;
    }

    // Desglose por venue
    desglose.forEach(function (d) {
      _checkPage(doc, p, 40, yRef);
      doc.setFillColor(p.HEADER_BG[0], p.HEADER_BG[1], p.HEADER_BG[2]);
      doc.rect(margin, yRef.y, contentW, 8, 'F');
      doc.setTextColor(p.HEADER_TEXT[0], p.HEADER_TEXT[1], p.HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(d.nombre || '', margin + 4, yRef.y + 5.5); yRef.y += 10;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]);

      if (d.diasRegular > 0) {
        doc.text(d.diasRegular + ' día(s) regular (Lun-Jue) × ' + _formatMXN(d.precioRegular), margin + 4, yRef.y + 4);
        doc.setTextColor(p.ACCENT[0], p.ACCENT[1], p.ACCENT[2]);
        doc.text(_formatMXN(d.diasRegular * d.precioRegular), W - margin - 4, yRef.y + 4, { align: 'right' });
        doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]); yRef.y += 7;
      }
      if (d.diasWeekend > 0) {
        doc.text(d.diasWeekend + ' día(s) weekend (Vie-Sáb) × ' + _formatMXN(d.precioWeekend), margin + 4, yRef.y + 4);
        doc.setTextColor(p.ACCENT[0], p.ACCENT[1], p.ACCENT[2]);
        doc.text(_formatMXN(d.diasWeekend * d.precioWeekend), W - margin - 4, yRef.y + 4, { align: 'right' });
        doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]); yRef.y += 7;
      }
      if ((d.montajeDays || 0) > 0) {
        doc.text(d.montajeDays + ' día(s) montaje × ' + _formatMXN(d.precioMontaje), margin + 4, yRef.y + 4);
        doc.setTextColor(p.ACCENT[0], p.ACCENT[1], p.ACCENT[2]);
        doc.text(_formatMXN(d.montaje), W - margin - 4, yRef.y + 4, { align: 'right' });
        doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]); yRef.y += 7;
      }
      yRef.y += 4;
    });

    // Totales
    _checkPage(doc, p, 40, yRef);
    _drawSection(doc, p, 'RESUMEN GENERAL', yRef);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]);
    doc.text('Renta total', margin + 4, yRef.y + 4);
    doc.text(_formatMXN(rentaTotal), W - margin - 4, yRef.y + 4, { align: 'right' }); yRef.y += 7;
    doc.text('Montaje total', margin + 4, yRef.y + 4);
    doc.text(_formatMXN(montajeTotal), W - margin - 4, yRef.y + 4, { align: 'right' }); yRef.y += 7;
    doc.text('Subtotal (sin IVA)', margin + 4, yRef.y + 4);
    doc.text(_formatMXN(subtotal), W - margin - 4, yRef.y + 4, { align: 'right' }); yRef.y += 7;
    doc.text('IVA (16%)', margin + 4, yRef.y + 4);
    doc.text(_formatMXN(iva), W - margin - 4, yRef.y + 4, { align: 'right' }); yRef.y += 7;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setTextColor(p.ACCENT[0], p.ACCENT[1], p.ACCENT[2]);
    doc.text('TOTAL: ' + _formatMXN(total), W - margin - 4, yRef.y + 4, { align: 'right' });
    yRef.y += 14;

    // Condiciones comerciales
    var vigencia = data.vigencia || '';
    var condPago = data.condicionesPago || data.condPago || '';
    var notas = data.notas || '';

    if (vigencia || condPago || notas) {
      _checkPage(doc, p, 30, yRef);
      _drawSection(doc, p, 'CONDICIONES COMERCIALES', yRef);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]);
      if (vigencia) { doc.text('Vigencia: ' + vigencia, margin + 4, yRef.y + 4); yRef.y += 7; }
      if (condPago) { doc.text('Pago: ' + condPago, margin + 4, yRef.y + 4); yRef.y += 7; }
      if (notas) {
        var notasLines = doc.splitTextToSize('Notas: ' + notas, contentW - 8);
        notasLines.forEach(function (line) { _checkPage(doc, p, 7, yRef); doc.text(line, margin + 4, yRef.y + 4); yRef.y += 5; });
      }
    }

    _allFooters(doc, p, 'BÚNKER Creatividad Empresarial | MUNET');
    return doc;
  }

  // ═════════════════════════════════════════════════
  //  REBUILD BNK
  // ═════════════════════════════════════════════════
  function rebuildBNK(data, style) {
    var p = _paleta(style || 'neon');
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });

    var folio = data.folio || '';
    var empresa = data.empresa || data.cliente || '';
    var contacto = data.contacto || '';
    var evento = data.evento || '';
    var fechaEvento = data.fechaEvento || '';
    var sede = data.sede || 'MUNET';
    var subtotal = Number(data.subtotal) || 0;
    var iva = Number(data.iva) || 0;
    var total = Number(data.total) || 0;

    var conceptos = [];
    try { conceptos = JSON.parse(data.conceptos || '[]'); } catch (e) {}

    var yRef = {
      y: 0,
      _headerTitle: 'Cotización — ' + (evento || 'Producción Integral'),
      _headerSub: folio + ' | ' + empresa + ' | ' + contacto
    };

    // Header BNK usa logo más grande
    function drawHeaderBNK() {
      _drawBG(doc, p);
      doc.setFillColor(p.HEADER_BG[0], p.HEADER_BG[1], p.HEADER_BG[2]);
      doc.rect(0, 0, W, HEADER_H, 'F');
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        try { doc.addImage(BUNKER_LOGO_B64, 'PNG', margin, 4, 40, 15); } catch (e) {}
      }
      doc.setTextColor(p.HEADER_TEXT[0], p.HEADER_TEXT[1], p.HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(yRef._headerTitle, 65, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(p.ACCENT[0], p.ACCENT[1], p.ACCENT[2]);
      doc.text(yRef._headerSub, 65, 18);
    }

    function checkPageBNK(needed) {
      if (yRef.y + needed > MAX_Y) { doc.addPage(); drawHeaderBNK(); yRef.y = CONTENT_TOP; }
    }

    // Página 1
    drawHeaderBNK(); yRef.y = CONTENT_TOP;

    // Fecha de emisión (usar fecha guardada o actual)
    doc.setFontSize(7); doc.setTextColor(p.SUB_TEXT[0], p.SUB_TEXT[1], p.SUB_TEXT[2]);
    var fechaEmision = '';
    if (data.fecha) {
      var d = new Date(data.fecha);
      fechaEmision = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
    } else if (data.createdAt && data.createdAt.toDate) {
      var d2 = data.createdAt.toDate();
      fechaEmision = d2.getDate() + '/' + (d2.getMonth() + 1) + '/' + d2.getFullYear();
    } else {
      var hoy = new Date();
      fechaEmision = hoy.getDate() + '/' + (hoy.getMonth() + 1) + '/' + hoy.getFullYear();
    }
    doc.text('Fecha de emisión: ' + fechaEmision, W - margin, yRef.y - 2, { align: 'right' });

    // Intro
    doc.setFontSize(8); doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]);
    var intro = 'En atención a su solicitud, BÚNKER presenta la siguiente propuesta de producción integral para el evento '
      + evento + (fechaEvento ? ', a realizarse el ' + fechaEvento : '')
      + ' en las instalaciones de ' + sede + '.';
    var introLines = doc.splitTextToSize(intro, contentW);
    doc.text(introLines, margin, yRef.y); yRef.y += introLines.length * 4 + 6;

    // Agrupar conceptos por categoría
    var grupos = {};
    conceptos.forEach(function (c) {
      var cat = c.categoria || 'General';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(c);
    });

    Object.keys(grupos).forEach(function (cat) {
      _drawSection(doc, p, cat.toUpperCase(), yRef);

      grupos[cat].forEach(function (c) {
        checkPageBNK(7);
        doc.setFontSize(8); doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]);
        doc.text(c.concepto || '', margin + 4, yRef.y + 4);
        doc.text(String(c.cantidad || 1) + ' ' + (c.unidad || ''), margin + 100, yRef.y + 4);
        doc.text(_formatMXN(c.precioUnit), W - margin - 35, yRef.y + 4);
        doc.setTextColor(p.ACCENT[0], p.ACCENT[1], p.ACCENT[2]);
        doc.text(_formatMXN(c.subtotal), W - margin - 4, yRef.y + 4, { align: 'right' });
        doc.setDrawColor(p.BG[0] + 30, p.BG[1] + 30, p.BG[2] + 30);
        doc.setLineWidth(0.1); doc.line(margin, yRef.y + 6, W - margin, yRef.y + 6);
        yRef.y += 7;
      });
      yRef.y += 4;
    });

    // Totales
    checkPageBNK(30);
    _drawSection(doc, p, 'RESUMEN GENERAL', yRef);
    doc.setFontSize(8); doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]);
    doc.text('Subtotal (sin IVA)', margin + 4, yRef.y + 4);
    doc.text(_formatMXN(subtotal), W - margin - 4, yRef.y + 4, { align: 'right' }); yRef.y += 7;
    doc.text('IVA (16%)', margin + 4, yRef.y + 4);
    doc.text(_formatMXN(iva), W - margin - 4, yRef.y + 4, { align: 'right' }); yRef.y += 7;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setTextColor(p.ACCENT[0], p.ACCENT[1], p.ACCENT[2]);
    doc.text('TOTAL: ' + _formatMXN(total), W - margin - 4, yRef.y + 4, { align: 'right' }); yRef.y += 12;

    // Vigencia y condiciones de pago
    var vigencia = data.vigencia || '';
    var condPago = data.condPago || data.condicionesPago || '';
    if (vigencia || condPago) {
      checkPageBNK(18);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]);
      if (vigencia) {
        doc.text('Vigencia: ' + vigencia + ' días a partir de la fecha de emisión.', margin + 4, yRef.y + 4);
        yRef.y += 6;
      }
      if (condPago) {
        doc.text('Condiciones de pago: ' + condPago, margin + 4, yRef.y + 4);
        yRef.y += 6;
      }
      yRef.y += 4;
    }

    // Condiciones comerciales
    var condiciones = data.condiciones || '';
    if (condiciones) {
      _drawSection(doc, p, 'CONDICIONES COMERCIALES', yRef);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]);
      condiciones.split('\n').forEach(function (line) {
        var wrapped = doc.splitTextToSize(line, contentW - 8);
        wrapped.forEach(function (wl) { checkPageBNK(5); doc.text(wl, margin + 4, yRef.y + 4); yRef.y += 5; });
      });
    }

    // Notas
    var notas = data.notas || '';
    if (notas) {
      yRef.y += 4;
      checkPageBNK(14);
      _drawSection(doc, p, 'NOTAS', yRef);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]);
      var notasLines = doc.splitTextToSize(notas, contentW - 8);
      notasLines.forEach(function (nl) { checkPageBNK(5); doc.text(nl, margin + 4, yRef.y + 4); yRef.y += 5; });
    }

    // Footer con logo
    var totalPages = doc.internal.getNumberOfPages();
    for (var i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      var fy = H - FOOTER_H + 2;
      doc.setDrawColor(p.ACCENT[0], p.ACCENT[1], p.ACCENT[2]);
      doc.setLineWidth(0.3); doc.line(margin, fy, W - margin, fy);
      doc.setFontSize(6); doc.setTextColor(p.SUB_TEXT[0], p.SUB_TEXT[1], p.SUB_TEXT[2]);
      var pn = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text('Pág. ' + pn + ' | BÚNKER Creatividad Empresarial', margin, fy + 5);
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        try { doc.addImage(BUNKER_LOGO_B64, 'PNG', W - margin - 25, H - FOOTER_H + 3, 25, 9); } catch (e) {}
      }
    }

    return doc;
  }

  // ═════════════════════════════════════════════════
  //  API pública
  // ═════════════════════════════════════════════════
  window.BNKPdfRebuild = {
    download: function (cotData, style) {
      var fuente = cotData.fuente || 'MNT';
      var doc;
      if (fuente === 'BNK') {
        doc = rebuildBNK(cotData, style);
      } else {
        doc = rebuildMNT(cotData, style);
      }
      var filename = 'Cotizacion-' + fuente + '-' + (cotData.folio || 'sin-folio') + '.pdf';
      doc.save(filename);
    }
  };
})();
