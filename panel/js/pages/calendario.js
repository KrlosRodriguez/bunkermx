// calendario.js — Vista mensual con estados de reserva
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

  function init() {
    _bindEvents();

    var calLoading = document.getElementById('calLoading');
    var calGrid = document.getElementById('calGrid');
    if (calLoading) calLoading.style.display = '';
    if (calGrid) calGrid.style.display = 'none';

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
    _render();
    _updateIndicators();
  }

  function _render() {
    var meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    var label = document.getElementById('calMesAnio');
    if (label) label.textContent = meses[_mes] + ' ' + _anio;

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

    for (var d = 1; d <= ultimoDia.getDate(); d++) {
      var fecha = _anio + '-' + String(_mes + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var bloques = _getBloquesDelDia(fecha);
      totalBloques += bloques.length;

      var todayClass = (esEsteMes && d === hoyDia) ? ' cal-cell--today' : '';

      html += '<div class="cal-cell' + todayClass + '">'
        + '<span class="cal-day">' + d + '</span>';

      bloques.forEach(function (b) {
        var tooltipParts = [b.cliente];
        if (b.evento) tooltipParts.push(b.evento);
        if (b.folio) tooltipParts.push(b.folio);
        var tooltip = tooltipParts.join(' — ');

        html += '<div class="cal-bloque cal-bloque--' + b.tipo + '" title="' + _esc(tooltip) + '"'
          + (b.cotizacionId ? ' data-cot-id="' + b.cotizacionId + '"' : '')
          + (b.eventoId ? ' data-evt-id="' + b.eventoId + '"' : '')
          + '>'
          + _esc(b.label)
          + '</div>';
      });

      html += '</div>';
    }

    grid.innerHTML = html;
    grid.style.display = '';

    // Show empty state if no events in the visible month
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

  function _getBloquesDelDia(fecha) {
    var bloques = [];

    // Cotizaciones
    _cotizaciones.forEach(function (c) {
      // MNT cotizaciones: check all event days from desgloseVenues
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
      // Fallback: single fechaEvento (BNK cotizaciones)
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
        // Split on commas and check individual venues
        var espaciosList = espacios.split(',');
        var match = false;
        for (var i = 0; i < espaciosList.length; i++) {
          if (espaciosList[i].trim().indexOf(filtroNorm) !== -1) { match = true; break; }
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
        label: (c.cliente || '').substring(0, 12),
        cotizacionId: c.id
      });
    });

    // Eventos de producción
    _eventos.forEach(function (evt) {
      var fechaEvento = evt.fechaEvento || '';
      if (typeof fechaEvento === 'object' && fechaEvento.toDate) {
        fechaEvento = fechaEvento.toDate().toISOString().substring(0, 10);
      }
      if (String(fechaEvento).substring(0, 10) !== fecha) return;

      // Avoid duplicates — skip if there's already a cotización block for the same cotización
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
        label: (evt.nombre || evt.cliente || '').substring(0, 12),
        eventoId: evt.id
      });
    });

    return bloques;
  }

  function _normalizarTexto(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }

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

    // Deduplicate: remove events already counted via cotizaciones
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

    // Find next upcoming event from today
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

  function _bindEvents() {
    var calPrev = document.getElementById('calPrev');
    var calNext = document.getElementById('calNext');
    var calHoy = document.getElementById('calHoy');
    var calFiltros = document.getElementById('calFiltros');

    if (calPrev) calPrev.addEventListener('click', function () {
      _mes--;
      if (_mes < 0) { _mes = 11; _anio--; }
      _render();
      _updateIndicators();
    });
    if (calNext) calNext.addEventListener('click', function () {
      _mes++;
      if (_mes > 11) { _mes = 0; _anio++; }
      _render();
      _updateIndicators();
    });
    if (calHoy) calHoy.addEventListener('click', function () {
      var now = new Date();
      _mes = now.getMonth();
      _anio = now.getFullYear();
      _render();
      _updateIndicators();
    });

    if (calFiltros) calFiltros.addEventListener('click', function (e) {
      var btn = e.target.closest('.cal-filtro');
      if (!btn) return;
      calFiltros.querySelectorAll('.cal-filtro').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      _espacioFiltro = btn.getAttribute('data-espacio');
      _render();
    });

    // Click on event block — navigate to cotización or evento
    var grid = document.getElementById('calGrid');
    if (grid) grid.addEventListener('click', function (e) {
      var bloque = e.target.closest('.cal-bloque');
      if (!bloque) return;

      var cotId = bloque.getAttribute('data-cot-id');
      if (cotId) {
        // Navigate to COTIZACIONES tab and apply search filter
        var tabBtn = document.querySelector('[data-tab="cotizaciones"]');
        if (tabBtn) {
          tabBtn.click();
          // Apply folio to search input to filter the table
          var folio = (bloque.title || '').split(' — ').pop() || '';
          var searchInput = document.getElementById('ctzSearch');
          if (searchInput && folio) {
            searchInput.value = folio;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          BNKToast.ok('Filtrando: ' + folio);
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

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
      var sec = document.getElementById('sec-calendario');
      if (!sec || sec.style.display === 'none') return;

      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.altKey) {
        var active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
        e.preventDefault();
        _mes--;
        if (_mes < 0) { _mes = 11; _anio--; }
        _render();
        _updateIndicators();
      } else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.altKey) {
        var active2 = document.activeElement;
        if (active2 && (active2.tagName === 'INPUT' || active2.tagName === 'TEXTAREA' || active2.tagName === 'SELECT')) return;
        e.preventDefault();
        _mes++;
        if (_mes > 11) { _mes = 0; _anio++; }
        _render();
        _updateIndicators();
      }
    });
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKCalendario = {
    load: function () {
      _dataReady = { cotizaciones: false, eventos: false };
      init();
    },
    gotoMonth: function (year, month) {
      _anio = year;
      _mes = month;
      _render();
      _updateIndicators();
    }
  };
})();
