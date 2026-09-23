// calendario.js — Vista mensual + semanal + día, iCal export, tooltips, overflow
(function () {
  'use strict';

  var _now = new Date();
  var _mes = _now.getMonth();
  var _anio = _now.getFullYear();
  var _espacioFiltro = 'todos';
  var _cotizaciones = [];
  var _eventos = [];
  var _unsubCotizaciones = null;
  var _dataReady = { cotizaciones: false, eventos: false };

  // View state: 'mes' | 'semana' | 'dia'
  var _viewMode = 'mes';
  var _semanaOffset = 0;  // 0 = semana que contiene _mes/_anio actual
  var _semanaBase = null; // Date del lunes de la semana actual en vista semana
  var _diaFecha = null;   // ISO date string para vista día

  // ──────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────

  function init() {
    _bindEvents();

    var calLoading = document.getElementById('calLoading');
    var calGrid = document.getElementById('calGrid');
    if (calLoading) calLoading.style.display = '';
    if (calGrid) calGrid.style.display = 'none';

    if (_unsubCotizaciones) { _unsubCotizaciones(); _unsubCotizaciones = null; }

    _unsubCotizaciones = BNK_DB.cotizaciones.onSnapshot(function (docs) {
      _cotizaciones = docs;
      _dataReady.cotizaciones = true;
      _onDataReady();
    });

    BNK_DB.eventos.list().then(function (evts) {
      _eventos = evts;
      _dataReady.eventos = true;
      _onDataReady();
    }).catch(function (err) {
      _dataReady.eventos = true;
      _eventos = [];
      BNKToast.error('Error al cargar eventos: ' + (err && err.message ? err.message : 'desconocido'));
      _onDataReady();
    });
  }

  function _onDataReady() {
    if (!_dataReady.cotizaciones || !_dataReady.eventos) return;
    var calLoading = document.getElementById('calLoading');
    if (calLoading) calLoading.style.display = 'none';
    _renderCurrent();
    _updateIndicators();
  }

  // ──────────────────────────────────────────────
  // Render dispatcher
  // ──────────────────────────────────────────────

  function _renderCurrent() {
    if (_viewMode === 'mes') _render();
    else if (_viewMode === 'semana') _renderSemana();
    else if (_viewMode === 'dia') _renderDia(_diaFecha);
  }

  function _showOnlyGrid(which) {
    // which: 'mes' | 'semana' | 'dia'
    var calGrid = document.getElementById('calGrid');
    var calWeekGrid = document.getElementById('calWeekGrid');
    var calDayView = document.getElementById('calDayView');
    var calEmpty = document.getElementById('calEmpty');
    if (calGrid) calGrid.style.display = (which === 'mes') ? '' : 'none';
    if (calWeekGrid) calWeekGrid.style.display = (which === 'semana') ? '' : 'none';
    if (calDayView) calDayView.style.display = (which === 'dia') ? '' : 'none';
    if (calEmpty) calEmpty.style.display = 'none';
  }

  // ──────────────────────────────────────────────
  // Month view
  // ──────────────────────────────────────────────

  function _render() {
    _showOnlyGrid('mes');
    _updateLabel();

    var grid = document.getElementById('calGrid');
    var calEmpty = document.getElementById('calEmpty');
    if (!grid) return;

    var primerDia = new Date(_anio, _mes, 1);
    var ultimoDia = new Date(_anio, _mes + 1, 0);
    var startDay = (primerDia.getDay() + 6) % 7;

    var hoy = new Date();
    var hoyDia = hoy.getDate();
    var hoyMes = hoy.getMonth();
    var hoyAnio = hoy.getFullYear();
    var esEsteMes = (_mes === hoyMes && _anio === hoyAnio);

    var html = '<div class="cal-header">LU</div><div class="cal-header">MA</div>'
      + '<div class="cal-header">MI</div><div class="cal-header">JU</div>'
      + '<div class="cal-header">VI</div><div class="cal-header">SA</div>'
      + '<div class="cal-header">DO</div>';

    for (var i = 0; i < startDay; i++) {
      html += '<div class="cal-cell cal-cell--empty"></div>';
    }

    var totalBloques = 0;
    var MAX_VISIBLE = 3;

    for (var d = 1; d <= ultimoDia.getDate(); d++) {
      var fecha = _anio + '-' + String(_mes + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var bloques = _getBloquesDelDia(fecha);
      totalBloques += bloques.length;

      var todayClass = (esEsteMes && d === hoyDia) ? ' cal-cell--today' : '';

      html += '<div class="cal-cell' + todayClass + '">'
        + '<span class="cal-day cal-day-link" data-fecha="' + fecha + '">' + d + '</span>';

      var visible = bloques.slice(0, MAX_VISIBLE);
      var overflow = bloques.length - MAX_VISIBLE;

      visible.forEach(function (b) {
        var tooltip = _buildTooltip(b);
        html += '<div class="cal-bloque cal-bloque--' + b.tipo + '" title="' + _esc(tooltip) + '"'
          + (b.cotizacionId ? ' data-cot-id="' + _esc(b.cotizacionId) + '"' : '')
          + (b.eventoId ? ' data-evt-id="' + _esc(b.eventoId) + '"' : '')
          + '>'
          + _esc(b.label)
          + '</div>';
      });

      if (overflow > 0) {
        html += '<div class="cal-overflow" data-fecha="' + fecha + '">+' + overflow + ' más</div>';
      }

      html += '</div>';
    }

    grid.innerHTML = html;
    grid.style.display = '';

    if (calEmpty) {
      if (totalBloques === 0 && _dataReady.cotizaciones && _dataReady.eventos) {
        calEmpty.style.display = 'block';
        var txt = calEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = _espacioFiltro !== 'todos'
          ? 'Sin eventos para ' + _espacioFiltro + ' en este mes'
          : 'Sin eventos para este mes';
      } else {
        calEmpty.style.display = 'none';
      }
    }
  }

  // ──────────────────────────────────────────────
  // Week view
  // ──────────────────────────────────────────────

  function _getLunesDeRefencia() {
    // Lunes de la semana que contiene el 1er día de _mes/_anio, offset por _semanaOffset
    if (!_semanaBase) {
      var ref = new Date(_anio, _mes, 1);
      var dow = (ref.getDay() + 6) % 7; // 0=lunes
      ref.setDate(ref.getDate() - dow);
      _semanaBase = ref;
    }
    var base = new Date(_semanaBase.getTime());
    base.setDate(base.getDate() + _semanaOffset * 7);
    return base;
  }

  function _renderSemana() {
    _showOnlyGrid('semana');

    var lunes = _getLunesDeRefencia();
    var dias = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(lunes.getTime());
      d.setDate(d.getDate() + i);
      dias.push(d);
    }

    // Update label
    var label = document.getElementById('calMesAnio');
    if (label) {
      var ini = _dateToISO(dias[0]);
      var fin = _dateToISO(dias[6]);
      label.textContent = _formatFechaCorta(dias[0]) + ' — ' + _formatFechaCorta(dias[6]);
    }

    var HORA_INI = 8;
    var HORA_FIN = 22;
    var horas = [];
    for (var h = HORA_INI; h <= HORA_FIN; h++) horas.push(h);

    var hoy = new Date();
    var hoyISO = _dateToISO(hoy);

    // Build grid HTML
    var html = '<div class="cal-week-grid">';

    // Header row: empty corner + 7 day headers
    html += '<div class="cal-week-corner"></div>';
    dias.forEach(function (d) {
      var iso = _dateToISO(d);
      var esHoy = (iso === hoyISO);
      var dayNames = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];
      var dow = (d.getDay() + 6) % 7;
      html += '<div class="cal-week-header' + (esHoy ? ' cal-week-header--today' : '') + '">'
        + dayNames[dow] + ' ' + String(d.getDate()).padStart(2, '0')
        + '</div>';
    });

    // All-day row
    html += '<div class="cal-week-allday-label">TODO DÍA</div>';
    html += '<div class="cal-week-allday" style="grid-column:2/-1">';
    dias.forEach(function (d) {
      var iso = _dateToISO(d);
      var bloques = _getBloquesDelDia(iso);
      html += '<div class="cal-week-allday-col" data-fecha="' + iso + '">';
      bloques.forEach(function (b) {
        html += '<div class="cal-bloque cal-bloque--' + b.tipo + '" title="' + _esc(_buildTooltip(b)) + '"'
          + (b.cotizacionId ? ' data-cot-id="' + _esc(b.cotizacionId) + '"' : '')
          + (b.eventoId ? ' data-evt-id="' + _esc(b.eventoId) + '"' : '')
          + '>' + _esc(b.label) + '</div>';
      });
      html += '</div>';
    });
    html += '</div>';

    // Hour rows
    horas.forEach(function (h) {
      var horaStr = String(h).padStart(2, '0') + ':00';
      html += '<div class="cal-week-hour">' + horaStr + '</div>';
      dias.forEach(function () {
        html += '<div class="cal-week-cell"></div>';
      });
    });

    html += '</div>';

    var container = document.getElementById('calWeekGrid');
    if (container) container.innerHTML = html;
  }

  // ──────────────────────────────────────────────
  // Day view
  // ──────────────────────────────────────────────

  function _renderDia(fecha) {
    if (!fecha) return;
    _diaFecha = fecha;
    _showOnlyGrid('dia');

    var parts = fecha.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    var label = document.getElementById('calDayLabel');
    if (label) {
      label.textContent = dayNames[d.getDay()] + ', ' + d.getDate() + ' de ' + meses[d.getMonth()] + ' ' + d.getFullYear();
    }

    var bloques = _getBloquesDelDia(fecha);
    var list = document.getElementById('calDayList');
    if (!list) return;

    if (bloques.length === 0) {
      list.innerHTML = '<div class="dash-empty" style="padding:40px 0"><div class="dash-empty-text">Sin eventos para este día</div></div>';
      return;
    }

    var html = '';
    bloques.forEach(function (b) {
      var cotData = null;
      if (b.cotizacionId) {
        for (var i = 0; i < _cotizaciones.length; i++) {
          if (_cotizaciones[i].id === b.cotizacionId) { cotData = _cotizaciones[i]; break; }
        }
      }
      var evtData = null;
      if (b.eventoId) {
        for (var j = 0; j < _eventos.length; j++) {
          if (_eventos[j].id === b.eventoId) { evtData = _eventos[j]; break; }
        }
      }

      var monto = cotData ? (cotData.total || cotData.monto || 0) : 0;
      var espacio = cotData ? (cotData.espacios || '') : (evtData ? (evtData.espacios || evtData.espacio || '') : '');
      var estado = cotData ? (cotData.estado || '') : (evtData ? (evtData.estado || '') : '');
      var folio = b.folio || '';

      html += '<div class="cal-day-item">'
        + '<div class="cal-day-item-tipo cal-day-item-tipo--' + b.tipo + '"></div>'
        + '<div class="cal-day-item-info">'
        + '<div class="cal-day-item-cliente">' + _esc(b.cliente || '—') + '</div>'
        + '<div class="cal-day-item-evento">' + _esc(b.evento || b.label || '') + '</div>'
        + '<div class="cal-day-item-meta">'
        + (folio ? _esc(folio) + ' · ' : '')
        + (estado ? _esc(estado) + ' · ' : '')
        + (espacio ? _esc(espacio) + ' · ' : '')
        + (monto ? _formatMXN(monto) : '')
        + '</div>'
        + '</div>'
        + (b.cotizacionId ? '<button class="panel-btn-secondary" style="font-size:10px;padding:4px 10px" data-cot-id="' + _esc(b.cotizacionId) + '">VER</button>' : '')
        + '</div>';
    });

    list.innerHTML = html;

    // Bind VER buttons
    list.querySelectorAll('[data-cot-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cotId = btn.getAttribute('data-cot-id');
        var cot = null;
        for (var i = 0; i < _cotizaciones.length; i++) {
          if (_cotizaciones[i].id === cotId) { cot = _cotizaciones[i]; break; }
        }
        var tabBtn = document.querySelector('[data-tab="cotizaciones"]');
        if (tabBtn) {
          tabBtn.click();
          var searchInput = document.getElementById('cotSearch2');
          if (searchInput && cot && cot.folio) {
            searchInput.value = cot.folio;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      });
    });
  }

  // ──────────────────────────────────────────────
  // iCal export
  // ──────────────────────────────────────────────

  function _getAllVisibleBloques() {
    var mesStr = String(_mes + 1).padStart(2, '0');
    var ultimoDia = new Date(_anio, _mes + 1, 0).getDate();
    var result = [];
    for (var d = 1; d <= ultimoDia; d++) {
      var fecha = _anio + '-' + mesStr + '-' + String(d).padStart(2, '0');
      var bloques = _getBloquesDelDia(fecha);
      bloques.forEach(function (b) {
        result.push(Object.assign({}, b, { fecha: fecha }));
      });
    }
    return result;
  }

  function _exportICS() {
    var bloques = _getAllVisibleBloques();
    if (bloques.length === 0) { BNKToast.warn('Sin eventos para exportar.'); return; }

    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BUNKER//Panel//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    bloques.forEach(function (b) {
      var dtstart = b.fecha.replace(/-/g, '');
      var uid = (b.folio || b.cotizacionId || b.eventoId || b.fecha + '-' + Math.random().toString(36).slice(2)) + '@bunker-panel';

      // Look up monto from cotizacion data
      var monto = 0;
      if (b.cotizacionId) {
        for (var i = 0; i < _cotizaciones.length; i++) {
          if (_cotizaciones[i].id === b.cotizacionId) {
            monto = _cotizaciones[i].total || _cotizaciones[i].monto || 0;
            break;
          }
        }
      }

      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + uid);
      lines.push('DTSTART;VALUE=DATE:' + dtstart);
      lines.push('DTEND;VALUE=DATE:' + dtstart);
      lines.push('SUMMARY:' + _icsEscape(b.cliente + ' - ' + (b.evento || b.label)));
      lines.push('DESCRIPTION:' + _icsEscape(
        'Folio: ' + (b.folio || '') +
        '\\nEstado: ' + (b.estado || '') +
        '\\nMonto: ' + _formatMXN(monto)
      ));
      if (b.espacio) lines.push('LOCATION:' + _icsEscape(b.espacio));
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');

    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bunker-calendario-' + _anio + '-' + String(_mes + 1).padStart(2, '0') + '.ics';
    a.click();
    URL.revokeObjectURL(url);
    BNKToast.ok('Calendario exportado.');
  }

  function _icsEscape(s) {
    return (s || '').replace(/[,;\\]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n');
  }

  // ──────────────────────────────────────────────
  // Data helpers
  // ──────────────────────────────────────────────

  function _buildTooltip(b) {
    var parts = [];
    if (b.cliente) parts.push(b.cliente);
    if (b.evento) parts.push(b.evento);
    if (b.folio) parts.push(b.folio);
    if (b.espacio) parts.push(b.espacio);
    return parts.join(' — ');
  }

  function _getBloquesDelDia(fecha) {
    var bloques = [];

    _cotizaciones.forEach(function (c) {
      var matchesFecha = false;
      if (c.desgloseVenues) {
        try {
          var desglose = JSON.parse(c.desgloseVenues);
          for (var i = 0; i < desglose.length; i++) {
            if (desglose[i].eventDays && desglose[i].eventDays.indexOf(fecha) !== -1) {
              matchesFecha = true;
              break;
            }
          }
        } catch (e) { /* ignore parse errors */ }
      }
      if (!matchesFecha) {
        var fechaEvento = c.fechaEvento || c.fecha || c.createdAt || '';
        if (typeof fechaEvento === 'object' && fechaEvento.toDate) {
          fechaEvento = fechaEvento.toDate().toISOString().substring(0, 10);
        }
        if (String(fechaEvento).substring(0, 10) === fecha) matchesFecha = true;
      }
      if (!matchesFecha) return;

      if (_espacioFiltro !== 'todos') {
        var espacios = _normalizarTexto(c.espacios || '');
        var filtroNorm = _normalizarTexto(_espacioFiltro);
        var espaciosList = espacios.split(',');
        var match = false;
        for (var j = 0; j < espaciosList.length; j++) {
          if (espaciosList[j].trim().indexOf(filtroNorm) !== -1) { match = true; break; }
        }
        if (!match) return;
      }

      var estadosCerrados = ['Cerrada', 'En Producción', 'Ejecutado'];
      var tipo = estadosCerrados.indexOf(c.estado) !== -1 ? 'confirmado' : 'cotizado';
      bloques.push({
        tipo: tipo,
        cliente: c.cliente || '',
        evento: c.evento || '',
        folio: c.folio || '',
        espacio: c.espacios || '',
        estado: c.estado || '',
        label: (c.cliente || '').substring(0, 12),
        cotizacionId: c.id
      });
    });

    _eventos.forEach(function (evt) {
      var fechaEvento = evt.fechaEvento || '';
      if (typeof fechaEvento === 'object' && fechaEvento.toDate) {
        fechaEvento = fechaEvento.toDate().toISOString().substring(0, 10);
      }
      if (String(fechaEvento).substring(0, 10) !== fecha) return;

      if (evt.cotizacionId) {
        var alreadyShown = bloques.some(function (b) { return b.cotizacionId === evt.cotizacionId; });
        if (alreadyShown) return;
      }

      if (_espacioFiltro !== 'todos') {
        var evtEspacios = _normalizarTexto(evt.espacios || evt.espacio || '');
        var filtroNorm2 = _normalizarTexto(_espacioFiltro);
        if (evtEspacios.indexOf(filtroNorm2) === -1) return;
      }

      bloques.push({
        tipo: 'evento',
        cliente: evt.cliente || '',
        evento: evt.nombre || evt.evento || '',
        folio: evt.folioCotizacion || '',
        espacio: evt.espacios || evt.espacio || '',
        estado: evt.estado || '',
        label: (evt.nombre || evt.cliente || '').substring(0, 12),
        eventoId: evt.id
      });
    });

    return bloques;
  }

  // ──────────────────────────────────────────────
  // Indicators (month-level KPIs)
  // ──────────────────────────────────────────────

  function _updateIndicators() {
    var mesStr = String(_mes + 1).padStart(2, '0');
    var prefijo = _anio + '-' + mesStr;

    var cotMes = _cotizaciones.filter(function (c) {
      var f = c.fechaEvento || c.fecha || c.createdAt || '';
      if (typeof f === 'object' && f.toDate) f = f.toDate().toISOString();
      return String(f).substring(0, 7) === prefijo;
    });

    var evtMes = _eventos.filter(function (e) {
      var f = e.fechaEvento || '';
      if (typeof f === 'object' && f.toDate) f = f.toDate().toISOString();
      return String(f).substring(0, 7) === prefijo;
    });

    var estadosCerrados = ['Cerrada', 'En Producción', 'Ejecutado'];
    var confirmados = cotMes.filter(function (c) { return estadosCerrados.indexOf(c.estado) !== -1; }).length;
    var cotizados = cotMes.length - confirmados;
    var total = cotMes.length + evtMes.length;

    evtMes.forEach(function (evt) {
      if (evt.cotizacionId) {
        var dup = cotMes.some(function (c) { return c.id === evt.cotizacionId; });
        if (dup) total--;
      }
    });

    var elTotal = document.getElementById('indCalTotal');
    var elConf = document.getElementById('indCalConfirmados');
    var elCot = document.getElementById('indCalCotizados');
    var elProx = document.getElementById('indCalProximo');

    if (elTotal) elTotal.textContent = total;
    if (elConf) elConf.textContent = confirmados;
    if (elCot) elCot.textContent = cotizados;

    if (elProx) {
      var hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      var proximo = null;
      _cotizaciones.forEach(function (c) {
        var f = c.fechaEvento || c.fecha || c.createdAt || '';
        if (typeof f === 'object' && f.toDate) f = f.toDate().toISOString().substring(0, 10);
        f = String(f).substring(0, 10);
        if (!f) return;
        var d = new Date(f + 'T00:00:00');
        if (d >= hoy) {
          if (!proximo || d < proximo.date) {
            proximo = { date: d, label: f, cliente: c.cliente || '' };
          }
        }
      });
      if (proximo) {
        var dd = String(proximo.date.getDate()).padStart(2, '0');
        var mm = String(proximo.date.getMonth() + 1).padStart(2, '0');
        elProx.textContent = dd + '/' + mm + ' · ' + (proximo.cliente.substring(0, 10) || '');
      } else {
        elProx.textContent = '—';
      }
    }
  }

  // ──────────────────────────────────────────────
  // Navigation label
  // ──────────────────────────────────────────────

  function _updateLabel() {
    var meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    var label = document.getElementById('calMesAnio');
    if (label) label.textContent = meses[_mes] + ' ' + _anio;
  }

  // ──────────────────────────────────────────────
  // Bind events
  // ──────────────────────────────────────────────

  function _bindEvents() {
    var calPrev = document.getElementById('calPrev');
    var calNext = document.getElementById('calNext');
    var calHoy = document.getElementById('calHoy');
    var calFiltros = document.getElementById('calFiltros');
    var calViewMes = document.getElementById('calViewMes');
    var calViewSemana = document.getElementById('calViewSemana');
    var calExport = document.getElementById('calExport');
    var calDayBack = document.getElementById('calDayBack');

    // View toggle
    if (calViewMes) calViewMes.addEventListener('click', function () {
      _viewMode = 'mes';
      _semanaBase = null;
      _semanaOffset = 0;
      _setViewBtnActive('mes');
      _render();
      _updateIndicators();
    });
    if (calViewSemana) calViewSemana.addEventListener('click', function () {
      _viewMode = 'semana';
      _semanaBase = null;
      _semanaOffset = 0;
      _setViewBtnActive('semana');
      _renderSemana();
    });

    // Navigation
    if (calPrev) calPrev.addEventListener('click', function () {
      if (_viewMode === 'mes') {
        _mes--;
        if (_mes < 0) { _mes = 11; _anio--; }
        _render();
        _updateIndicators();
      } else if (_viewMode === 'semana') {
        _semanaOffset--;
        _renderSemana();
      } else if (_viewMode === 'dia') {
        // Go back one day
        var parts = _diaFecha.split('-');
        var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        d.setDate(d.getDate() - 1);
        _renderDia(_dateToISO(d));
      }
    });
    if (calNext) calNext.addEventListener('click', function () {
      if (_viewMode === 'mes') {
        _mes++;
        if (_mes > 11) { _mes = 0; _anio++; }
        _render();
        _updateIndicators();
      } else if (_viewMode === 'semana') {
        _semanaOffset++;
        _renderSemana();
      } else if (_viewMode === 'dia') {
        // Go forward one day
        var parts = _diaFecha.split('-');
        var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        d.setDate(d.getDate() + 1);
        _renderDia(_dateToISO(d));
      }
    });
    if (calHoy) calHoy.addEventListener('click', function () {
      var now = new Date();
      _mes = now.getMonth();
      _anio = now.getFullYear();
      _semanaBase = null;
      _semanaOffset = 0;
      if (_viewMode === 'dia') {
        _renderDia(_dateToISO(now));
      } else if (_viewMode === 'semana') {
        _renderSemana();
      } else {
        _render();
        _updateIndicators();
      }
    });

    // Space filters
    if (calFiltros) calFiltros.addEventListener('click', function (e) {
      var btn = e.target.closest('.cal-filtro');
      if (!btn) return;
      calFiltros.querySelectorAll('.cal-filtro').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      _espacioFiltro = btn.getAttribute('data-espacio');
      _renderCurrent();
    });

    // iCal export
    if (calExport) calExport.addEventListener('click', _exportICS);

    // Day view back button
    if (calDayBack) calDayBack.addEventListener('click', function () {
      _viewMode = _prevViewMode || 'mes';
      _setViewBtnActive(_viewMode);
      if (_viewMode === 'semana') _renderSemana();
      else { _render(); _updateIndicators(); }
    });

    // Click on month grid: day number → day view, block → cotización
    var grid = document.getElementById('calGrid');
    if (grid) grid.addEventListener('click', function (e) {
      // Overflow "+N más" → day view
      var overflow = e.target.closest('.cal-overflow');
      if (overflow) {
        var fecha = overflow.getAttribute('data-fecha');
        if (fecha) { _prevViewMode = 'mes'; _viewMode = 'dia'; _renderDia(fecha); }
        return;
      }

      // Day number → day view
      var dayLink = e.target.closest('.cal-day-link');
      if (dayLink) {
        var fecha2 = dayLink.getAttribute('data-fecha');
        if (fecha2) { _prevViewMode = 'mes'; _viewMode = 'dia'; _renderDia(fecha2); }
        return;
      }

      // Event block → navigate to cotización tab
      var bloque = e.target.closest('.cal-bloque');
      if (!bloque) return;

      var cotId = bloque.getAttribute('data-cot-id');
      if (cotId) {
        var tabBtn = document.querySelector('[data-tab="cotizaciones"]');
        if (tabBtn) {
          tabBtn.click();
          var folio = '';
          for (var i = 0; i < _cotizaciones.length; i++) {
            if (_cotizaciones[i].id === cotId) { folio = _cotizaciones[i].folio || ''; break; }
          }
          var searchInput = document.getElementById('cotSearch2');
          if (searchInput && folio) {
            searchInput.value = folio;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (folio) BNKToast.ok('Filtrando: ' + folio);
        }
        return;
      }

      var evtId = bloque.getAttribute('data-evt-id');
      if (evtId) {
        var tabBtn2 = document.querySelector('[data-tab="eventos"]');
        if (tabBtn2) {
          tabBtn2.click();
          BNKToast.ok('Evento: ' + (bloque.title || evtId));
        }
      }
    });

    // Click in week view: all-day blocks → cotización
    var weekGrid = document.getElementById('calWeekGrid');
    if (weekGrid) weekGrid.addEventListener('click', function (e) {
      var bloque = e.target.closest('.cal-bloque');
      if (bloque) {
        var cotId2 = bloque.getAttribute('data-cot-id');
        if (cotId2) {
          var tabBtn3 = document.querySelector('[data-tab="cotizaciones"]');
          if (tabBtn3) {
            tabBtn3.click();
            var folio2 = '';
            for (var i = 0; i < _cotizaciones.length; i++) {
              if (_cotizaciones[i].id === cotId2) { folio2 = _cotizaciones[i].folio || ''; break; }
            }
            var si = document.getElementById('cotSearch2');
            if (si && folio2) {
              si.value = folio2;
              si.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
      var sec = document.getElementById('sec-calendario');
      if (!sec || !sec.classList.contains('active')) return;
      var active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;

      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (_viewMode === 'mes') {
          _mes--; if (_mes < 0) { _mes = 11; _anio--; }
          _render(); _updateIndicators();
        } else if (_viewMode === 'semana') {
          _semanaOffset--; _renderSemana();
        }
      } else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (_viewMode === 'mes') {
          _mes++; if (_mes > 11) { _mes = 0; _anio++; }
          _render(); _updateIndicators();
        } else if (_viewMode === 'semana') {
          _semanaOffset++; _renderSemana();
        }
      }
    });
  }

  var _prevViewMode = 'mes';

  function _setViewBtnActive(mode) {
    var btnMes = document.getElementById('calViewMes');
    var btnSemana = document.getElementById('calViewSemana');
    if (btnMes) btnMes.classList.toggle('active', mode === 'mes');
    if (btnSemana) btnSemana.classList.toggle('active', mode === 'semana');
  }

  // ──────────────────────────────────────────────
  // Formatting utilities
  // ──────────────────────────────────────────────

  function _dateToISO(d) {
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }

  function _formatFechaCorta(d) {
    var meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return String(d.getDate()).padStart(2, '0') + ' ' + meses[d.getMonth()];
  }

  function _formatMXN(n) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
  }

  function _normalizarTexto(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }

  function _esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ──────────────────────────────────────────────
  // Boot
  // ──────────────────────────────────────────────

  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKCalendario = {
    load: function () {
      _dataReady = { cotizaciones: false, eventos: false };
      _viewMode = 'mes';
      _semanaBase = null;
      _semanaOffset = 0;
      init();
    },
    gotoMonth: function (year, month) {
      _anio = year;
      _mes = month;
      _viewMode = 'mes';
      _semanaBase = null;
      _semanaOffset = 0;
      _setViewBtnActive('mes');
      _render();
      _updateIndicators();
    }
  };
})();
