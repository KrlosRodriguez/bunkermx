// cotizar-mnt.js — Wizard para cotizar espacios MUNET
(function () {
  'use strict';

  var _venues = [];      // datos de catalogo categoría Venues
  var _clientes = [];    // lista de clientes para autocompletado
  var _selected = {};    // { docId: { montajeDays: 0, eventDays: [...], calMonth: Date } }
  var _currentStep = 1;
  var _tipo = 'privado'; // 'privado' o 'publico'
  var _pdfStyle = 'neon';
  var _expandedVid = null; // venue con calendario expandido (accordion)

  function init() {
    Promise.all([
      BNK_DB.catalogo.list(),
      BNK_DB.clientes.list()
    ]).then(function (results) {
      var allCatalogo = results[0];
      _venues = allCatalogo.filter(function (c) { return c.categoria === 'Venues' && c.activo !== false; });
      _clientes = results[1];
      _renderSpaces();
      _bindEvents();
    });
  }

  // ── Utilidades ──
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }

  function _generarFolio() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var rand = String(Math.floor(1000 + Math.random() * 9000));
    return 'MNT-' + yy + mm + dd + '-' + rand;
  }

  // ── Navegación del wizard ──
  function _goToStep(step) {
    if (step < 1 || step > 4) return;

    // Validar paso actual antes de avanzar
    if (step > _currentStep) {
      if (_currentStep === 1 && !_validateStep1()) return;
      if (_currentStep === 3) {
        if (!_validateStep3()) return;
        _buildResumen();
      }
    }

    _currentStep = step;
    document.querySelectorAll('.mnt-step').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.mnt-progress-step').forEach(function (el) {
      var s = parseInt(el.getAttribute('data-step'));
      el.classList.remove('active', 'done');
      if (s === step) el.classList.add('active');
      else if (s < step) el.classList.add('done');
    });
    var target = document.querySelector('.mnt-step[data-step="' + step + '"]');
    if (target) target.classList.add('active');

    // Update step indicator
    var indicator = document.getElementById('mntStepIndicator');
    if (indicator) indicator.textContent = 'PASO ' + step + ' DE 4';

    // Scroll to top of wizard
    var wizard = document.getElementById('mntWizard');
    if (wizard) wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function _validateStep1() {
    var cliente = document.getElementById('mntCliente').value.trim();
    var contacto = document.getElementById('mntContacto').value.trim();
    var tel = document.getElementById('mntTelefono').value.trim();
    var correo = document.getElementById('mntCorreo').value.trim();
    if (!cliente) { BNKToast.warn('El cliente es requerido.'); return false; }
    if (!contacto) { BNKToast.warn('El contacto es requerido.'); return false; }
    if (!tel && !correo) { BNKToast.warn('Teléfono o correo es requerido.'); return false; }
    return true;
  }

  function _validateStep3() {
    var ids = Object.keys(_selected);
    if (ids.length === 0) { BNKToast.warn('Selecciona al menos un espacio.'); return false; }
    var hasDays = ids.some(function (vid) { return _selected[vid].eventDays.length > 0; });
    if (!hasDays) { BNKToast.warn('Selecciona al menos una fecha de evento.'); return false; }
    return true;
  }

  // ── Autocompletado de clientes ──
  function _setupAutocomplete() {
    var input = document.getElementById('mntCliente');
    var dropdown = document.getElementById('mntAutoCliente');
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
      document.getElementById('mntCliente').value = item.getAttribute('data-empresa') || '';
      document.getElementById('mntContacto').value = item.getAttribute('data-contacto') || '';
      document.getElementById('mntTelefono').value = item.getAttribute('data-telefono') || '';
      document.getElementById('mntCorreo').value = item.getAttribute('data-correo') || '';
      dropdown.classList.remove('visible');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#mntCliente') && !e.target.closest('#mntAutoCliente')) {
        dropdown.classList.remove('visible');
      }
    });
  }

  // ── Renderizar cards de espacios ──
  function _renderSpaces() {
    var grid = document.getElementById('mntSpacesGrid');
    if (!grid) return;

    var html = '';
    _venues.forEach(function (v) {
      var isPublic = _tipo === 'publico';
      var disponible = true;
      // Salas no permiten público, y espacios onlyPrivado check
      if (isPublic && (v.concepto === 'SALAS CAPACIT.' || v.concepto === 'LOBBY'
        || v.concepto === 'JARDÍN SOCIAL' || v.concepto === 'VELARIA')) {
        disponible = false;
      }
      var isSelected = !!_selected[v.id];
      html += '<div class="mnt-space-card' + (isSelected ? ' selected' : '') + (disponible ? '' : ' disabled') + '" data-vid="' + v.id + '" tabindex="0" role="button">'
        + '<div class="mnt-space-name" style="color:var(--g)">' + _esc(v.concepto) + '</div>'
        + (v.capacidad ? '<div class="mnt-space-meta">CAP: ' + _esc(String(v.capacidad)) + ' personas</div>' : '')
        + '<div class="mnt-space-meta">' + _esc(v.unidad || 'día') + '</div>'
        + '<div class="mnt-space-price">' + _formatMXN(v.precio) + ' / DÍA</div>'
        + (v.precioWeekend ? '<div class="mnt-space-meta">WKD: ' + _formatMXN(v.precioWeekend) + '</div>' : '')
        + '</div>';
    });
    grid.innerHTML = html;

    // Update space count
    _updateSpaceCount();

    // Bind clicks + keyboard
    grid.querySelectorAll('.mnt-space-card').forEach(function (card) {
      function toggle() {
        var vid = card.getAttribute('data-vid');
        if (_selected[vid]) {
          delete _selected[vid];
          card.classList.remove('selected');
          if (_expandedVid === vid) _expandedVid = null;
        } else {
          _selected[vid] = { montajeDays: 0, eventDays: [], calMonth: new Date() };
          card.classList.add('selected');
          _expandedVid = vid;
        }
        _updateSpaceCount();
        _renderCalendars();
      }
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });

    // Render calendars/placeholder on initial load
    _renderCalendars();
  }

  // ── Toggle tipo evento ──
  function _setupTipoToggle() {
    document.querySelectorAll('.mnt-tipo-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.mnt-tipo-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        _tipo = this.getAttribute('data-tipo');
        // Reset selections that become invalid
        Object.keys(_selected).forEach(function (vid) {
          var venue = _venues.find(function (v) { return v.id === vid; });
          if (!venue) return;
          if (_tipo === 'publico' && (venue.concepto === 'SALAS CAPACIT.' || venue.concepto === 'LOBBY'
            || venue.concepto === 'JARDÍN SOCIAL' || venue.concepto === 'VELARIA')) {
            delete _selected[vid];
          }
        });
        _renderSpaces();
        _renderCalendars();
      });
    });
  }

  // ── Space count indicator ──
  function _updateSpaceCount() {
    var el = document.getElementById('mntSpaceCount');
    if (!el) return;
    var n = Object.keys(_selected).length;
    el.textContent = n > 0 ? n + ' de ' + _venues.length + ' seleccionados' : '';
  }

  // ── Calendarios (accordion) ──
  function _venueSummary(vid) {
    var sel = _selected[vid];
    if (!sel) return '';
    var parts = [];
    if (sel.eventDays.length > 0) parts.push(sel.eventDays.length + ' día' + (sel.eventDays.length > 1 ? 's' : '') + ' evento');
    if (sel.montajeDays > 0) parts.push(sel.montajeDays + ' montaje');
    return parts.length > 0 ? parts.join(', ') : 'Sin fechas';
  }

  function _renderCalendars() {
    var area = document.getElementById('mntCalendarArea');
    if (!area) return;

    var selectedIds = Object.keys(_selected);
    if (selectedIds.length === 0) {
      area.innerHTML = '<div class="mnt-empty-hint">Selecciona uno o más espacios para elegir fechas</div>';
      return;
    }

    // Auto-expand first if none expanded
    if (_expandedVid === null || selectedIds.indexOf(_expandedVid) < 0) {
      _expandedVid = selectedIds[0];
    }

    var html = '';
    selectedIds.forEach(function (vid) {
      var venue = _venues.find(function (v) { return v.id === vid; });
      if (!venue) return;
      var isOpen = _expandedVid === vid;
      var sel = _selected[vid];

      // Accordion header
      html += '<div class="mnt-calendar-wrap' + (isOpen ? ' expanded' : ' collapsed') + '" data-vid="' + vid + '">'
        + '<div class="mnt-accordion-header" data-vid="' + vid + '" tabindex="0" role="button">'
        + '<span class="mnt-accordion-arrow">' + (isOpen ? '▾' : '▸') + '</span>'
        + '<span class="mnt-accordion-title">' + _esc(venue.concepto) + '</span>'
        + '<span class="mnt-accordion-summary">' + _venueSummary(vid) + '</span>'
        + '</div>';

      // Calendar body (only if expanded)
      if (isOpen) {
        var cm = sel.calMonth || new Date();
        html += '<div class="mnt-accordion-body">'
          + '<div class="mnt-cal-header">'
          + '<button class="mnt-cal-nav" data-dir="-1" data-vid="' + vid + '">&larr;</button>'
          + '<span class="mnt-cal-title">' + _getMonthLabel(cm) + '</span>'
          + '<button class="mnt-cal-nav" data-dir="1" data-vid="' + vid + '">&rarr;</button>'
          + '</div>'
          + '<div class="mnt-cal-grid">'
          + _buildCalendarDays(vid, venue, cm)
          + '</div>'
          + '<div class="mnt-cal-legend"><span style="color:var(--ylw)">■</span> TARIFA WEEKEND (VIE-SÁB)</div>';

        // Montaje stepper
        var montLabel = venue.precioMontaje > 0 ? _formatMXN(venue.precioMontaje) + ' / DÍA' : 'SIN COSTO';
        html += '<div class="mnt-montaje">'
          + '<span class="mnt-montaje-label">DÍAS DE MONTAJE (' + montLabel + ')</span>'
          + '<button class="mnt-montaje-btn" data-vid="' + vid + '" data-dir="-1">−</button>'
          + '<span class="mnt-montaje-val" id="montVal-' + vid + '">' + (sel.montajeDays || 0) + '</span>'
          + '<button class="mnt-montaje-btn" data-vid="' + vid + '" data-dir="1">+</button>'
          + '</div>';

        html += '</div>'; // close accordion-body
      }

      html += '</div>'; // close calendar-wrap
    });
    area.innerHTML = html;

    // Bind accordion toggle (click to expand/collapse)
    area.querySelectorAll('.mnt-accordion-header').forEach(function (hdr) {
      function toggleAccordion() {
        var vid = hdr.getAttribute('data-vid');
        _expandedVid = (_expandedVid === vid) ? null : vid;
        _renderCalendars();
      }
      hdr.addEventListener('click', toggleAccordion);
      hdr.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAccordion(); }
      });
    });

    // Bind calendar nav (per-venue month)
    area.querySelectorAll('.mnt-cal-nav').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var vid = this.getAttribute('data-vid');
        var dir = parseInt(this.getAttribute('data-dir'));
        var cm = _selected[vid].calMonth;
        cm.setMonth(cm.getMonth() + dir);
        _renderCalendars();
      });
    });

    area.querySelectorAll('.mnt-cal-day:not(.disabled):not(.empty)').forEach(function (cell) {
      cell.addEventListener('click', function () {
        var vid = this.getAttribute('data-vid');
        var date = this.getAttribute('data-date');
        var days = _selected[vid].eventDays;
        var idx = days.indexOf(date);
        if (idx >= 0) { days.splice(idx, 1); this.classList.remove('selected'); }
        else { days.push(date); this.classList.add('selected'); }
        // Update summary in header
        var wrap = this.closest('.mnt-calendar-wrap');
        if (wrap) {
          var sumEl = wrap.querySelector('.mnt-accordion-summary');
          if (sumEl) sumEl.textContent = _venueSummary(vid);
        }
      });
    });

    area.querySelectorAll('.mnt-montaje-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var vid = this.getAttribute('data-vid');
        var dir = parseInt(this.getAttribute('data-dir'));
        var sel = _selected[vid];
        sel.montajeDays = Math.max(0, (sel.montajeDays || 0) + dir);
        var valEl = document.getElementById('montVal-' + vid);
        if (valEl) valEl.textContent = sel.montajeDays;
        // Update summary in header
        var wrap = this.closest('.mnt-calendar-wrap');
        if (wrap) {
          var sumEl = wrap.querySelector('.mnt-accordion-summary');
          if (sumEl) sumEl.textContent = _venueSummary(vid);
        }
      });
    });
  }

  function _getMonthLabel(calMonth) {
    var meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    return meses[calMonth.getMonth()] + ' ' + calMonth.getFullYear();
  }

  function _buildCalendarDays(vid, venue, calMonth) {
    var year = calMonth.getFullYear();
    var month = calMonth.getMonth();
    var firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = new Date(); today.setHours(0,0,0,0);

    var labels = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
    var html = labels.map(function (l) { return '<div class="mnt-cal-day-label">' + l + '</div>'; }).join('');

    // Empty cells
    for (var e = 0; e < firstDay; e++) { html += '<div class="mnt-cal-day empty"></div>'; }

    var isSalas = venue.concepto === 'SALAS CAPACIT.';

    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(year, month, d);
      var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var dow = date.getDay();
      var isWeekend = dow === 5 || dow === 6; // Vie-Sáb
      var isPast = date < today;
      var isSelected = _selected[vid] && _selected[vid].eventDays.indexOf(iso) >= 0;
      var disabled = isPast || (isSalas && isWeekend);

      html += '<div class="mnt-cal-day' + (isWeekend ? ' weekend' : '') + (isSelected ? ' selected' : '') + (disabled ? ' disabled' : '')
        + '" data-vid="' + vid + '" data-date="' + iso + '">' + d + '</div>';
    }
    return html;
  }

  // ── Cálculos ──
  function _calcular() {
    var rentaTotal = 0;
    var montajeTotal = 0;
    var desglose = [];

    Object.keys(_selected).forEach(function (vid) {
      var venue = _venues.find(function (v) { return v.id === vid; });
      if (!venue) return;
      var sel = _selected[vid];

      var diasRegular = 0, diasWeekend = 0;
      sel.eventDays.forEach(function (iso) {
        var parts = iso.split('-');
        var date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        var dow = date.getDay();
        if (dow === 5 || dow === 6) diasWeekend++;
        else diasRegular++;
      });

      var renta = (diasRegular * (venue.precio || 0)) + (diasWeekend * (venue.precioWeekend || venue.precio || 0));
      var montaje = (sel.montajeDays || 0) * (venue.precioMontaje || 0);

      rentaTotal += renta;
      montajeTotal += montaje;

      desglose.push({
        nombre: venue.concepto,
        diasRegular: diasRegular,
        diasWeekend: diasWeekend,
        diasTotal: diasRegular + diasWeekend,
        montajeDays: sel.montajeDays || 0,
        eventDays: sel.eventDays.slice().sort(),
        precioRegular: venue.precio,
        precioWeekend: venue.precioWeekend || venue.precio,
        precioMontaje: venue.precioMontaje || 0,
        renta: renta,
        montaje: montaje,
        total: renta + montaje
      });
    });

    var subtotal = rentaTotal + montajeTotal;
    var iva = Math.round(subtotal * 0.16);
    var total = subtotal + iva;

    return {
      desglose: desglose,
      rentaTotal: rentaTotal,
      montajeTotal: montajeTotal,
      subtotal: subtotal,
      iva: iva,
      total: total
    };
  }

  function _buildResumen() {
    var container = document.getElementById('mntResumen');
    if (!container) return;

    var calc = _calcular();
    if (calc.desglose.length === 0) {
      container.innerHTML = '<div class="dash-empty"><div class="dash-empty-icon">&#128205;</div><div class="dash-empty-text">Selecciona al menos un espacio</div></div>';
      return;
    }

    var html = '';
    calc.desglose.forEach(function (d) {
      html += '<div class="mnt-venue-desglose">'
        + '<div class="mnt-venue-desglose-title">' + _esc(d.nombre) + '</div>'
        + '<div class="mnt-resumen-row"><span>Días regulares (Lun-Jue): ' + d.diasRegular + '</span><span>' + _formatMXN(d.diasRegular * d.precioRegular) + '</span></div>'
        + (d.diasWeekend > 0 ? '<div class="mnt-resumen-row"><span>Días weekend (Vie-Sáb): ' + d.diasWeekend + '</span><span>' + _formatMXN(d.diasWeekend * d.precioWeekend) + '</span></div>' : '')
        + (d.montajeDays > 0 ? '<div class="mnt-resumen-row"><span>Días montaje: ' + d.montajeDays + '</span><span>' + _formatMXN(d.montaje) + '</span></div>' : '')
        + '<div class="mnt-resumen-row" style="font-weight:700;color:var(--wh)"><span>Total espacio</span><span>' + _formatMXN(d.total) + '</span></div>'
        + '</div>';
    });

    html += '<div class="mnt-resumen" style="margin-top:16px">'
      + '<div class="mnt-resumen-row"><span>Renta total</span><span>' + _formatMXN(calc.rentaTotal) + '</span></div>'
      + '<div class="mnt-resumen-row"><span>Montaje total</span><span>' + _formatMXN(calc.montajeTotal) + '</span></div>'
      + '<div class="mnt-resumen-row"><span>Subtotal (sin IVA)</span><span>' + _formatMXN(calc.subtotal) + '</span></div>'
      + '<div class="mnt-resumen-row"><span>IVA (16%)</span><span>' + _formatMXN(calc.iva) + '</span></div>'
      + '<div class="mnt-resumen-total">' + _formatMXN(calc.total) + '</div>'
      + '</div>';

    container.innerHTML = html;
  }

  // ── PDF ──
  function _generarPDF() {
    var calc = _calcular();
    if (calc.desglose.length === 0) { BNKToast.warn('Selecciona al menos un espacio.'); return; }

    var folio = _generarFolio();
    var cliente = document.getElementById('mntCliente').value.trim();
    var contacto = document.getElementById('mntContacto').value.trim();
    var evento = document.getElementById('mntEvento').value.trim();
    var horaInicio = document.getElementById('mntHoraInicio').value;
    var horaFin = document.getElementById('mntHoraFin').value;
    var horario = (horaInicio && horaFin) ? horaInicio + ' — ' + horaFin : '';

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, margin = 20, contentW = W - margin * 2, H = 297;

    var isNeon = _pdfStyle === 'neon';

    // Paleta
    var BG = isNeon ? [5, 9, 5] : [255, 255, 255];
    var TEXT = isNeon ? [237, 248, 237] : [51, 51, 51];
    var ACCENT = isNeon ? [0, 255, 65] : [198, 163, 80];
    var HEADER_BG = isNeon ? [5, 9, 5] : [44, 36, 25];
    var HEADER_TEXT = [255, 255, 255];
    var SUB_TEXT = isNeon ? [200, 236, 200] : [120, 120, 120];

    var HEADER_H = 28, FOOTER_H = 20, CONTENT_TOP = 36, MAX_Y = H - FOOTER_H;
    var y = 0;

    function drawBG() {
      doc.setFillColor(BG[0], BG[1], BG[2]);
      doc.rect(0, 0, W, H, 'F');
    }

    function drawHeader() {
      drawBG();
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.rect(0, 0, W, HEADER_H, 'F');
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        try { doc.addImage(BUNKER_LOGO_B64, 'PNG', margin, 5, 30, 11); } catch (e) {}
      }
      doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Cotización MUNET — ' + (evento || 'Evento'), 55, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text(folio + ' | ' + cliente + ' | ' + contacto, 55, 18);
    }

    function drawFooter() {
      var fy = H - FOOTER_H + 2;
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.setLineWidth(0.3); doc.line(margin, fy, W - margin, fy);
      doc.setFontSize(6); doc.setTextColor(SUB_TEXT[0], SUB_TEXT[1], SUB_TEXT[2]);
      var pn = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text('Pág. ' + pn + ' | BÚNKER Creatividad Empresarial | MUNET', margin, fy + 5);
    }

    function checkPage(needed) {
      if (y + needed > MAX_Y) { doc.addPage(); drawHeader(); y = CONTENT_TOP; }
    }

    // Página 1
    drawHeader(); y = CONTENT_TOP;

    // Datos del evento
    doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    var info = 'Tipo: ' + (_tipo === 'publico' ? 'Público' : 'Privado');
    if (horario) info += ' | Horario: ' + horario;
    doc.text(info, margin, y); y += 6;

    // Desglose por venue
    calc.desglose.forEach(function (d) {
      checkPage(40);
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(d.nombre, margin + 4, y + 5.5); y += 10;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);

      if (d.diasRegular > 0) {
        doc.text(d.diasRegular + ' día(s) regular (Lun-Jue) × ' + _formatMXN(d.precioRegular), margin + 4, y + 4);
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text(_formatMXN(d.diasRegular * d.precioRegular), W - margin - 4, y + 4, { align: 'right' });
        doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]); y += 7;
      }
      if (d.diasWeekend > 0) {
        doc.text(d.diasWeekend + ' día(s) weekend (Vie-Sáb) × ' + _formatMXN(d.precioWeekend), margin + 4, y + 4);
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text(_formatMXN(d.diasWeekend * d.precioWeekend), W - margin - 4, y + 4, { align: 'right' });
        doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]); y += 7;
      }
      if (d.montajeDays > 0) {
        doc.text(d.montajeDays + ' día(s) montaje × ' + _formatMXN(d.precioMontaje), margin + 4, y + 4);
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text(_formatMXN(d.montaje), W - margin - 4, y + 4, { align: 'right' });
        doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]); y += 7;
      }
      y += 4;
    });

    // Totales
    checkPage(40);
    doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('RESUMEN GENERAL', margin + 4, y + 5.5); y += 12;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text('Renta total', margin + 4, y + 4);
    doc.text(_formatMXN(calc.rentaTotal), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.text('Montaje total', margin + 4, y + 4);
    doc.text(_formatMXN(calc.montajeTotal), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.text('Subtotal (sin IVA)', margin + 4, y + 4);
    doc.text(_formatMXN(calc.subtotal), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.text('IVA (16%)', margin + 4, y + 4);
    doc.text(_formatMXN(calc.iva), W - margin - 4, y + 4, { align: 'right' }); y += 7;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text('TOTAL: ' + _formatMXN(calc.total), W - margin - 4, y + 4, { align: 'right' });

    // Footers
    var totalPages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) { doc.setPage(p); drawFooter(); }

    return { doc: doc, folio: folio, calc: calc };
  }

  // ── Guardar en Firestore ──
  function _enviar() {
    var result = _generarPDF();
    if (!result) return;

    var btn = document.getElementById('mntGenerar');
    btn.disabled = true; btn.textContent = 'GENERANDO...';

    var calc = result.calc;
    var folio = result.folio;

    var espaciosNombres = calc.desglose.map(function (d) { return d.nombre; }).join(', ');
    var fechasResumen = _buildFechasResumen(calc.desglose);

    var data = {
      fuente: 'MNT',
      folio: folio,
      cliente: document.getElementById('mntCliente').value.trim(),
      agencia: document.getElementById('mntAgencia').value.trim(),
      evento: document.getElementById('mntEvento').value.trim(),
      contacto: document.getElementById('mntContacto').value.trim(),
      telefono: document.getElementById('mntTelefono').value.trim(),
      correo: document.getElementById('mntCorreo').value.trim(),
      tipo: _tipo === 'publico' ? 'Público' : 'Privado',
      fechas: fechasResumen,
      desgloseVenues: JSON.stringify(calc.desglose),
      diasTotal: calc.desglose.reduce(function (sum, d) { return sum + d.diasTotal; }, 0),
      descripcion: document.getElementById('mntDescripcion').value.trim(),
      horario: (function () { var hi = document.getElementById('mntHoraInicio').value, hf = document.getElementById('mntHoraFin').value; return hi && hf ? hi + ' — ' + hf : ''; })(),
      espacios: espaciosNombres,
      rentaTotal: calc.rentaTotal,
      montajeTotal: calc.montajeTotal,
      subtotal: calc.subtotal,
      iva: calc.iva,
      total: calc.total,
      linkPdf: '',
      estado: 'Nueva',
      creadoPor: BNK_AUTH.currentUser() ? BNK_AUTH.currentUser().uid : ''
    };

    BNK_DB.cotizaciones.create(data).then(function () {
      result.doc.save('Cotizacion-MNT-' + folio + '.pdf');
      BNKToast.ok('Cotización ' + folio + ' generada.');
      _resetWizard();
    }).catch(function (err) {
      BNKToast.error('Error: ' + err.message);
    }).finally(function () {
      btn.disabled = false; btn.textContent = 'GENERAR COTIZACIÓN';
    });
  }

  function _buildFechasResumen(desglose) {
    var meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    var allDays = [];
    desglose.forEach(function (d) {
      d.eventDays.forEach(function (day) { if (allDays.indexOf(day) < 0) allDays.push(day); });
    });
    allDays.sort();
    var groups = {}; var order = [];
    allDays.forEach(function (iso) {
      var parts = iso.split('-');
      var key = meses[parseInt(parts[1]) - 1] + ' ' + parts[0];
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(parseInt(parts[2]));
    });
    return order.map(function (k) { return k + ': ' + groups[k].join(', '); }).join(' · ');
  }

  function _resetWizard() {
    _selected = {};
    _currentStep = 1;
    _tipo = 'privado';
    _expandedVid = null;
    ['mntCliente','mntAgencia','mntEvento','mntContacto','mntTelefono','mntCorreo','mntAsistentes','mntDescripcion','mntHoraInicio','mntHoraFin'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.querySelectorAll('.mnt-tipo-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelector('.mnt-tipo-btn[data-tipo="privado"]').classList.add('active');
    _renderSpaces();
    _renderCalendars();
    _goToStep(1);
  }

  // ── Bind all events ──
  function _bindEvents() {
    _setupAutocomplete();
    _setupTipoToggle();

    // Nav buttons
    document.getElementById('mntNext1').addEventListener('click', function () { _goToStep(2); });
    document.getElementById('mntPrev2').addEventListener('click', function () { _goToStep(1); });
    document.getElementById('mntNext2').addEventListener('click', function () { _goToStep(3); });
    document.getElementById('mntPrev3').addEventListener('click', function () { _goToStep(2); });
    document.getElementById('mntNext3').addEventListener('click', function () { _goToStep(4); });
    document.getElementById('mntPrev4').addEventListener('click', function () { _goToStep(3); });

    // PDF style toggle
    document.querySelectorAll('#mntPdfToggle .pdf-style-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#mntPdfToggle .pdf-style-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        _pdfStyle = this.getAttribute('data-style');
      });
    });

    // Generar
    document.getElementById('mntGenerar').addEventListener('click', _enviar);

    // Progress steps clickeables
    document.querySelectorAll('.mnt-progress-step').forEach(function (step) {
      step.addEventListener('click', function () {
        var target = parseInt(this.getAttribute('data-step'));
        if (target <= _currentStep || target === _currentStep + 1) {
          if (target > _currentStep) {
            if (_currentStep === 1 && !_validateStep1()) return;
            if (_currentStep === 3 && !_validateStep3()) return;
          }
          if (target === 4) _buildResumen();
          _goToStep(target);
        }
      });
    });
  }

  // ── Init ──
  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });
})();
