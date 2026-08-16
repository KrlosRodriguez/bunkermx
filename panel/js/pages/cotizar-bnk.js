// cotizar-bnk.js — Formulario para cotizar servicios/producción BNK
(function () {
  'use strict';

  var _clientes = [];
  var _catalogo = [];
  var _conceptoCounter = 0;
  var _pdfStyle = 'neon';

  var PLANTILLAS = {
    estandar: '1. Precios más IVA.\n2. Vigencia de la cotización: 30 días.\n3. 60% de anticipo para confirmación y bloqueo de fecha.\n4. 40% restante: 5 días naturales previos al evento.\n5. Servicios y/o equipos adicionales serán cotizados por separado.\n6. Cancelaciones: una vez confirmado el servicio, el anticipo no será reembolsado.',
    estructura: '1. Precios más IVA.\n2. Vigencia de la cotización: 30 días.\n3. 60% de anticipo para confirmación y bloqueo de fecha.\n4. 40% restante: 5 días naturales previos al evento.\n5. La Estructura está sujeta a condiciones de pago específicas: 80% de anticipo y 20% al inicio de montaje.\n6. Servicios y/o equipos adicionales serán cotizados por separado.\n7. Cancelaciones: una vez confirmado el servicio, el anticipo no será reembolsado.\n8. El precio del seguro de responsabilidad civil se calculará 30 días antes del evento y deberá ser liquidado por el cliente.',
    especial: '1. Presupuesto tipo ballpark previo a brief de cliente; si los requerimientos exceden lo cotizado, se hará un ajuste.\n2. No incluye creación de arte adicional a lo especificado; en caso de requerirla, se cotizará por separado.\n3. Se requiere un mínimo de 1 mes para la realización del proyecto.\n4. Cambios en la información ya proporcionada pueden afectar los costos.\n5. 50% de anticipo para iniciar el proyecto; liquidación contraentrega.\n6. Entregables editables: costo adicional del 40% del total.\n7. Costo por cancelación: 85%.'
  };

  var CATEGORIAS = ['Servicios Básicos', 'Mobiliario', 'A&B', 'Estructura', 'Contenido/Mapping', 'Suministros', 'Otro'];

  function init() {
    Promise.all([
      BNK_DB.clientes.list(),
      BNK_DB.catalogo.list()
    ]).then(function (results) {
      _clientes = results[0];
      _catalogo = results[1].filter(function (c) { return c.categoria !== 'Venues' && c.activo !== false; });
      _bindEvents();
      _setCondiciones('estandar');
      _agregarFila();
      _restoreBnkDraft();
      // Auto-save draft on input
      BNK_DRAFT_FIELDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', _saveBnkDraft);
      });
    });
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }

  function _generarFolio() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var rand = String(Math.floor(1000 + Math.random() * 9000));
    return 'BNK-' + yy + mm + dd + '-' + rand;
  }

  // ── Autocompletado de clientes ──
  function _setupAutocomplete() {
    var input = document.getElementById('bnkEmpresa');
    var dropdown = document.getElementById('bnkAutoEmpresa');
    if (!input || !dropdown) return;

    input.addEventListener('input', function () {
      var val = input.value.trim().toLowerCase();
      if (val.length < 2) { dropdown.classList.remove('visible'); return; }

      var matches = _clientes.filter(function (c) {
        var nombre = (c.empresa || c.razonSocial || '').toLowerCase();
        return nombre.indexOf(val) !== -1;
      });

      var html = '';
      matches.slice(0, 8).forEach(function (c) {
        var nombre = c.empresa || c.razonSocial || '';
        html += '<div class="bnk-ac-item" data-empresa="' + _esc(nombre)
          + '" data-contacto="' + _esc(c.personaContacto || '')
          + '" data-telefono="' + _esc(c.telefonoContacto || '')
          + '" data-correo="' + _esc(c.correoContacto || '') + '">'
          + _esc(nombre) + '</div>';
      });
      if (matches.length === 0) {
        html = '<div class="bnk-ac-item bnk-ac-new">Nuevo: "' + _esc(input.value.trim()) + '"</div>';
      }
      dropdown.innerHTML = html;
      dropdown.classList.add('visible');
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.bnk-ac-item');
      if (!item || item.classList.contains('bnk-ac-new')) { dropdown.classList.remove('visible'); return; }
      document.getElementById('bnkEmpresa').value = item.getAttribute('data-empresa') || '';
      document.getElementById('bnkContacto').value = item.getAttribute('data-contacto') || '';
      document.getElementById('bnkTelefono').value = item.getAttribute('data-telefono') || '';
      document.getElementById('bnkCorreo').value = item.getAttribute('data-correo') || '';
      dropdown.classList.remove('visible');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#bnkEmpresa') && !e.target.closest('#bnkAutoEmpresa')) {
        dropdown.classList.remove('visible');
      }
    });
  }

  // ── Filas de conceptos ──
  function _agregarFila() {
    var body = document.getElementById('bnkConceptosBody');
    if (!body) return;
    var id = 'bc' + (_conceptoCounter++);

    var catOptions = '<option value="">—</option>';
    CATEGORIAS.forEach(function (cat) {
      catOptions += '<option value="' + cat + '">' + cat + '</option>';
    });

    var row = document.createElement('div');
    row.className = 'bnk-concepto-row';
    row.id = id;
    row.innerHTML =
      '<select class="bnk-cat" data-row="' + id + '" data-label="Categoría">' + catOptions + '</select>'
      + '<input type="text" class="bnk-con" data-row="' + id + '" data-label="Concepto" placeholder="Buscar concepto..." list="dl-' + id + '"><datalist id="dl-' + id + '"></datalist>'
      + '<input type="number" class="bnk-cant" data-row="' + id + '" data-label="Cant." value="1" min="1" step="1">'
      + '<input type="text" class="bnk-uni" data-row="' + id + '" data-label="Unidad" value="servicio" placeholder="unidad">'
      + '<input type="number" class="bnk-pre" data-row="' + id + '" data-label="Precio" value="0" min="0" step="0.01">'
      + '<span class="bnk-sub-val" data-row="' + id + '" data-label="Subtotal">$0</span>'
      + '<button class="bnk-del-btn" data-row="' + id + '">&times;</button>';
    body.appendChild(row);

    row.querySelector('.bnk-cat').addEventListener('change', function () { _actualizarDatalist(id); });
    row.querySelector('.bnk-con').addEventListener('change', function () { _autocompletarPrecio(id); });
    row.querySelector('.bnk-cant').addEventListener('input', function () { _recalcularFila(id); });
    row.querySelector('.bnk-pre').addEventListener('input', function () { _recalcularFila(id); });
    row.querySelector('.bnk-del-btn').addEventListener('click', function () {
      row.remove();
      _recalcularTotales();
      // Auto-add row if all deleted
      var remaining = document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row');
      if (remaining.length === 0) _agregarFila();
    });
  }

  function _actualizarDatalist(rowId) {
    var row = document.getElementById(rowId);
    var cat = row.querySelector('.bnk-cat').value;
    var dl = row.querySelector('datalist');
    var opts = '';
    _catalogo.filter(function (c) { return !cat || c.categoria === cat; })
      .forEach(function (c) { opts += '<option value="' + _esc(c.concepto) + '">'; });
    dl.innerHTML = opts;
  }

  function _autocompletarPrecio(rowId) {
    var row = document.getElementById(rowId);
    var nombre = row.querySelector('.bnk-con').value.trim();
    var found = _catalogo.find(function (c) { return c.concepto === nombre; });
    if (found) {
      row.querySelector('.bnk-pre').value = found.precio;
      row.querySelector('.bnk-uni').value = found.unidad || 'servicio';
      if (!row.querySelector('.bnk-cat').value) row.querySelector('.bnk-cat').value = found.categoria;
      _recalcularFila(rowId);
    }
  }

  function _recalcularFila(rowId) {
    var row = document.getElementById(rowId);
    var cant = parseFloat(row.querySelector('.bnk-cant').value) || 0;
    var precio = parseFloat(row.querySelector('.bnk-pre').value) || 0;
    row.querySelector('.bnk-sub-val').textContent = _formatMXN(cant * precio);
    _recalcularTotales();
  }

  function _recalcularTotales() {
    var rows = document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row');
    var subtotal = 0;
    rows.forEach(function (row) {
      var cant = parseFloat(row.querySelector('.bnk-cant').value) || 0;
      var precio = parseFloat(row.querySelector('.bnk-pre').value) || 0;
      subtotal += cant * precio;
    });
    var iva = Math.round(subtotal * 0.16);
    document.getElementById('bnkSubtotal').textContent = _formatMXN(subtotal);
    document.getElementById('bnkIVA').textContent = _formatMXN(iva);
    document.getElementById('bnkTotal').textContent = _formatMXN(subtotal + iva);
  }

  function _setCondiciones(key) {
    document.getElementById('bnkCondiciones').value = PLANTILLAS[key] || '';
  }

  function _recopilarConceptos() {
    var rows = document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row');
    var conceptos = [];
    rows.forEach(function (row) {
      var con = row.querySelector('.bnk-con').value.trim();
      var cant = parseFloat(row.querySelector('.bnk-cant').value) || 0;
      if (con && cant > 0) {
        conceptos.push({
          categoria: row.querySelector('.bnk-cat').value || 'Otro',
          concepto: con,
          cantidad: cant,
          unidad: row.querySelector('.bnk-uni').value.trim() || 'servicio',
          precioUnit: parseFloat(row.querySelector('.bnk-pre').value) || 0,
          subtotal: cant * (parseFloat(row.querySelector('.bnk-pre').value) || 0)
        });
      }
    });
    return conceptos;
  }

  // ── Validation ──
  function _validarFormulario() {
    var empresaEl = document.getElementById('bnkEmpresa');
    var eventoEl = document.getElementById('bnkEvento');
    var telEl = document.getElementById('bnkTelefono');
    var correoEl = document.getElementById('bnkCorreo');

    // Clear previous
    [empresaEl, eventoEl, telEl, correoEl].forEach(function (el) { BNKValidate.clear(el); });

    if (!empresaEl.value.trim()) { BNKValidate.error(empresaEl, 'Empresa requerida'); BNKToast.warn('La empresa es requerida.'); return false; }
    if (!eventoEl.value.trim()) { BNKValidate.error(eventoEl, 'Evento requerido'); BNKToast.warn('El nombre del evento es requerido.'); return false; }
    if (!telEl.value.trim() && !correoEl.value.trim()) {
      BNKValidate.error(telEl, 'Teléfono o correo requerido');
      BNKValidate.error(correoEl, 'Teléfono o correo requerido');
      BNKToast.warn('Ingresa al menos teléfono o correo.');
      return false;
    }

    var conceptos = _recopilarConceptos();
    if (conceptos.length === 0) { BNKToast.warn('Agrega al menos un concepto.'); return false; }

    var hayPreciosCero = conceptos.some(function (c) { return c.precioUnit <= 0; });
    if (hayPreciosCero) { BNKToast.warn('Todos los conceptos deben tener precio mayor a $0.'); return false; }

    return true;
  }

  // ── PDF BNK ──
  function _generarPDF(data) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, margin = 20, contentW = W - margin * 2, H = 297;

    var isNeon = _pdfStyle === 'neon';
    var BG = isNeon ? [5, 9, 5] : [255, 255, 255];
    var TEXT = isNeon ? [237, 248, 237] : [51, 51, 51];
    var ACCENT = isNeon ? [0, 255, 65] : [198, 163, 80];
    var HEADER_BG = isNeon ? [5, 9, 5] : [44, 36, 25];
    var HEADER_TEXT = [255, 255, 255];
    var SUB_TEXT = isNeon ? [200, 236, 200] : [120, 120, 120];

    var HEADER_H = 28, FOOTER_H = 20, CONTENT_TOP = 36, MAX_Y = H - FOOTER_H;
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
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Cotización — ' + (data.evento || 'Producción Integral'), 65, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text(data.folio + ' | ' + (data.empresa || '') + ' | ' + (data.contacto || ''), 65, 18);
    }

    function drawFooter() {
      var fy = H - FOOTER_H + 2;
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.setLineWidth(0.3); doc.line(margin, fy, W - margin, fy);
      doc.setFontSize(6); doc.setTextColor(SUB_TEXT[0], SUB_TEXT[1], SUB_TEXT[2]);
      var pn = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text('Pág. ' + pn + ' | BÚNKER Creatividad Empresarial', margin, fy + 5);
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        try { doc.addImage(BUNKER_LOGO_B64, 'PNG', W - margin - 25, H - FOOTER_H + 3, 25, 9); } catch (e) {}
      }
    }

    function checkPage(needed) { if (y + needed > MAX_Y) { doc.addPage(); drawHeader(); y = CONTENT_TOP; } }

    function drawSection(text) {
      checkPage(14);
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(text, margin + 4, y + 5.5);
      doc.setFont('helvetica', 'normal'); y += 10;
    }

    // Página 1
    drawHeader(); y = CONTENT_TOP;

    // Fecha de emisión
    doc.setFontSize(7); doc.setTextColor(SUB_TEXT[0], SUB_TEXT[1], SUB_TEXT[2]);
    var hoy = new Date();
    var fechaEmision = hoy.getDate() + '/' + (hoy.getMonth() + 1) + '/' + hoy.getFullYear();
    doc.text('Fecha de emisión: ' + fechaEmision, W - margin, y - 2, { align: 'right' });

    // Intro
    doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    var intro = 'En atención a su solicitud, BÚNKER presenta la siguiente propuesta de producción integral para el evento '
      + (data.evento || '') + (data.fechaEvento ? ', a realizarse el ' + data.fechaEvento : '')
      + ' en las instalaciones de ' + (data.sede || 'MUNET') + '.';
    var introLines = doc.splitTextToSize(intro, contentW);
    doc.text(introLines, margin, y); y += introLines.length * 4 + 6;

    // Agrupar por categoría
    var grupos = {};
    data.conceptos.forEach(function (c) {
      if (!grupos[c.categoria]) grupos[c.categoria] = [];
      grupos[c.categoria].push(c);
    });

    Object.keys(grupos).forEach(function (cat) {
      drawSection(cat.toUpperCase());

      grupos[cat].forEach(function (c) {
        checkPage(7);
        doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
        doc.text(c.concepto, margin + 4, y + 4);
        doc.text(String(c.cantidad) + ' ' + c.unidad, margin + 100, y + 4);
        doc.text(_formatMXN(c.precioUnit), W - margin - 35, y + 4);
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text(_formatMXN(c.subtotal), W - margin - 4, y + 4, { align: 'right' });
        doc.setDrawColor(BG[0] + 30, BG[1] + 30, BG[2] + 30);
        doc.setLineWidth(0.1); doc.line(margin, y + 6, W - margin, y + 6);
        y += 7;
      });
      y += 4;
    });

    // Totales
    checkPage(30);
    drawSection('RESUMEN GENERAL');
    doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text('Subtotal (sin IVA)', margin + 4, y + 4);
    doc.text(_formatMXN(data.subtotal), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.text('IVA (16%)', margin + 4, y + 4);
    doc.text(_formatMXN(data.iva), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text('TOTAL: ' + _formatMXN(data.total), W - margin - 4, y + 4, { align: 'right' }); y += 12;

    // Vigencia y condiciones de pago
    if (data.vigencia || data.condPago) {
      checkPage(18);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      if (data.vigencia) {
        doc.text('Vigencia: ' + data.vigencia + ' días a partir de la fecha de emisión.', margin + 4, y + 4);
        y += 6;
      }
      if (data.condPago) {
        doc.text('Condiciones de pago: ' + data.condPago, margin + 4, y + 4);
        y += 6;
      }
      y += 4;
    }

    // Condiciones
    if (data.condiciones) {
      drawSection('CONDICIONES COMERCIALES');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      data.condiciones.split('\n').forEach(function (line) {
        var wrapped = doc.splitTextToSize(line, contentW - 8);
        wrapped.forEach(function (wl) { checkPage(5); doc.text(wl, margin + 4, y + 4); y += 5; });
      });
    }

    // Notas
    if (data.notas) {
      y += 4;
      checkPage(14);
      drawSection('NOTAS');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      var notasLines = doc.splitTextToSize(data.notas, contentW - 8);
      notasLines.forEach(function (nl) { checkPage(5); doc.text(nl, margin + 4, y + 4); y += 5; });
    }

    // Footers
    var totalPages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) { doc.setPage(p); drawFooter(); }

    return doc;
  }

  // ── Enviar ──
  function _enviar() {
    if (!_validarFormulario()) return;

    // Online check
    if (!navigator.onLine) {
      BNKToast.error('Sin conexión a internet. Verifica tu red.');
      return;
    }

    var btn = document.getElementById('bnkGenerar');
    btn.disabled = true; btn.textContent = 'GENERANDO...';

    var conceptos = _recopilarConceptos();
    var folio = _generarFolio();
    var subtotal = 0;
    conceptos.forEach(function (c) { subtotal += c.subtotal; });
    var iva = Math.round(subtotal * 0.16);
    var total = subtotal + iva;

    var vigencia = document.getElementById('bnkVigencia').value || '30';
    var condPago = document.getElementById('bnkCondPago').value.trim();
    var notas = document.getElementById('bnkNotas').value.trim();

    var pdfData = {
      folio: folio,
      empresa: document.getElementById('bnkEmpresa').value.trim(),
      contacto: document.getElementById('bnkContacto').value.trim(),
      evento: document.getElementById('bnkEvento').value.trim(),
      fechaEvento: document.getElementById('bnkFechaEvento').value,
      sede: document.getElementById('bnkSede').value.trim() || 'MUNET',
      conceptos: conceptos,
      condiciones: document.getElementById('bnkCondiciones').value,
      vigencia: vigencia,
      condPago: condPago,
      notas: notas,
      subtotal: subtotal,
      iva: iva,
      total: total
    };

    var doc = _generarPDF(pdfData);

    var firestoreData = {
      fuente: 'BNK',
      folio: folio,
      folioMNT: document.getElementById('bnkFolioMNT').value.trim(),
      empresa: pdfData.empresa,
      contacto: pdfData.contacto,
      telefono: document.getElementById('bnkTelefono').value.trim(),
      correo: document.getElementById('bnkCorreo').value.trim(),
      evento: pdfData.evento,
      fechaEvento: pdfData.fechaEvento,
      sede: pdfData.sede,
      conceptos: JSON.stringify(conceptos),
      condiciones: pdfData.condiciones,
      vigencia: vigencia,
      condPago: condPago,
      notas: notas,
      subtotal: subtotal,
      iva: iva,
      total: total,
      linkPdf: '',
      estado: 'Nueva',
      creadoPor: BNK_AUTH.currentUser() ? BNK_AUTH.currentUser().uid : ''
    };

    BNK_DB.cotizaciones.create(firestoreData).then(function () {
      doc.save('Cotizacion-BNK-' + folio + '.pdf');
      BNKToast.ok('Cotización ' + folio + ' generada.');
      _limpiar();
    }).catch(function (err) {
      BNKToast.error('Error al guardar: ' + err.message);
      btn.textContent = 'REINTENTAR';
    }).finally(function () {
      btn.disabled = false;
      if (btn.textContent === 'GENERANDO...') btn.textContent = 'GENERAR COTIZACIÓN';
    });
  }

  function _limpiar() {
    var hayDatos = document.getElementById('bnkEmpresa').value.trim() ||
      document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row').length > 0;
    if (!hayDatos) { _doLimpiar(); return; }
    BNKConfirm.show('¿Limpiar todo el formulario? Se perderán los datos ingresados.', 'LIMPIAR').then(function (ok) {
      if (ok) _doLimpiar();
    });
  }

  function _doLimpiar() {
    _clearBnkDraft();
    ['bnkEmpresa','bnkContacto','bnkTelefono','bnkCorreo','bnkEvento','bnkFechaEvento','bnkFolioMNT'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('bnkSede').value = 'MUNET';
    document.getElementById('bnkConceptosBody').innerHTML = '';
    _conceptoCounter = 0;
    _agregarFila();
    _setCondiciones('estandar');
    document.getElementById('bnkPlantilla').value = 'estandar';
    document.getElementById('bnkVigencia').value = '30';
    document.getElementById('bnkCondPago').value = '60% anticipo, 40% antes del evento';
    document.getElementById('bnkNotas').value = '';
    _recalcularTotales();
    document.getElementById('bnkGenerar').textContent = 'GENERAR COTIZACIÓN';
  }

  // ── Bind ──
  function _bindEvents() {
    _setupAutocomplete();

    document.getElementById('bnkAddRow').addEventListener('click', _agregarFila);
    document.getElementById('bnkPlantilla').addEventListener('change', function () {
      _setCondiciones(this.value);
    });
    document.getElementById('bnkGenerar').addEventListener('click', _enviar);
    document.getElementById('bnkLimpiar').addEventListener('click', _limpiar);

    // PDF style toggle
    document.querySelectorAll('#bnkPdfToggle .pdf-style-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#bnkPdfToggle .pdf-style-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        _pdfStyle = this.getAttribute('data-style');
      });
    });

    // Keyboard shortcut: Ctrl+Enter to submit
    document.getElementById('sec-cotizar-bnk').addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        _enviar();
      }
    });
  }

  // ── Draft recovery (sessionStorage) ──
  var BNK_DRAFT_KEY = 'bnk_bnk_draft';
  var BNK_DRAFT_FIELDS = ['bnkEmpresa','bnkContacto','bnkTelefono','bnkCorreo','bnkEvento','bnkFechaEvento','bnkFolioMNT'];

  function _saveBnkDraft() {
    var draft = {};
    BNK_DRAFT_FIELDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.value) draft[id] = el.value;
    });
    if (Object.keys(draft).length > 0) {
      sessionStorage.setItem(BNK_DRAFT_KEY, JSON.stringify(draft));
    }
  }

  function _restoreBnkDraft() {
    var raw = sessionStorage.getItem(BNK_DRAFT_KEY);
    if (!raw) return;
    try {
      var draft = JSON.parse(raw);
      Object.keys(draft).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = draft[id];
      });
      BNKToast.ok('Borrador BNK restaurado.');
    } catch (e) { /* ignore */ }
  }

  function _clearBnkDraft() {
    sessionStorage.removeItem(BNK_DRAFT_KEY);
  }

  // ── Init ──
  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });
})();
