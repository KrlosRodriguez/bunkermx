// calendario.js — Vista mensual con estados de reserva
(function () {
  'use strict';

  var _mes = new Date().getMonth();
  var _anio = new Date().getFullYear();
  var _espacioFiltro = 'todos';
  var _cotizaciones = [];
  var _eventos = [];

  function init() {
    BNK_DB.cotizaciones.onSnapshot(function (docs) {
      _cotizaciones = docs;
      _render();
    });
    BNK_DB.eventos.list().then(function (evts) {
      _eventos = evts;
      _render();
    });
    _bindEvents();
    _render();
  }

  function _render() {
    var meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    var label = document.getElementById('calMesAnio');
    if (label) label.textContent = meses[_mes] + ' ' + _anio;

    var grid = document.getElementById('calGrid');
    if (!grid) return;

    var primerDia = new Date(_anio, _mes, 1);
    var ultimoDia = new Date(_anio, _mes + 1, 0);
    var startDay = (primerDia.getDay() + 6) % 7;

    var html = '<div class="cal-header">LU</div><div class="cal-header">MA</div>'
      + '<div class="cal-header">MI</div><div class="cal-header">JU</div>'
      + '<div class="cal-header">VI</div><div class="cal-header">SA</div>'
      + '<div class="cal-header">DO</div>';

    for (var i = 0; i < startDay; i++) {
      html += '<div class="cal-cell cal-cell--empty"></div>';
    }

    for (var d = 1; d <= ultimoDia.getDate(); d++) {
      var fecha = _anio + '-' + String(_mes + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var bloques = _getBloquesDelDia(fecha);

      html += '<div class="cal-cell">'
        + '<span class="cal-day">' + d + '</span>';

      bloques.forEach(function (b) {
        html += '<div class="cal-bloque cal-bloque--' + b.tipo + '" title="' + _esc(b.cliente + ' — ' + b.evento) + '">'
          + _esc(b.label)
          + '</div>';
      });

      html += '</div>';
    }

    grid.innerHTML = html;
  }

  function _getBloquesDelDia(fecha) {
    var bloques = [];

    _cotizaciones.forEach(function (c) {
      var fechaEvento = c.fechaEvento || '';
      if (fechaEvento.substring(0, 10) !== fecha) return;
      if (_espacioFiltro !== 'todos') {
        var espacios = (c.espacios || '').toUpperCase();
        if (espacios.indexOf(_espacioFiltro.toUpperCase()) === -1) return;
      }
      var estadosCerrados = ['Cerrada', 'En Producción', 'Ejecutado'];
      var tipo = estadosCerrados.indexOf(c.estado) !== -1 ? 'confirmado' : 'cotizado';
      bloques.push({
        tipo: tipo,
        cliente: c.cliente || '',
        evento: c.evento || '',
        label: (c.cliente || '').substring(0, 12)
      });
    });

    return bloques;
  }

  function _bindEvents() {
    document.getElementById('calPrev').addEventListener('click', function () {
      _mes--;
      if (_mes < 0) { _mes = 11; _anio--; }
      _render();
    });
    document.getElementById('calNext').addEventListener('click', function () {
      _mes++;
      if (_mes > 11) { _mes = 0; _anio++; }
      _render();
    });
    document.getElementById('calFiltros').addEventListener('click', function (e) {
      var btn = e.target.closest('.cal-filtro');
      if (!btn) return;
      document.querySelectorAll('.cal-filtro').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      _espacioFiltro = btn.getAttribute('data-espacio');
      _render();
    });
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKCalendario = {};
})();
