// cotizaciones.js — Módulo de cotizaciones sobre Firestore
(function () {
  'use strict';

  var _data = [];
  var _sortKey = 'fecha';
  var _sortDir = 'desc';
  var _page = 1;
  var _perPage = 20;
  var _unsubscribe = null;

  function init() {
    _bindFilters();
    _bindTableEvents();
    _unsubscribe = BNK_DB.cotizaciones.onSnapshot(function (docs) {
      _data = docs;
      _render();
    });
  }

  function _getFiltered() {
    var search = (document.getElementById('cotSearch2') || {}).value || '';
    search = search.trim().toLowerCase();
    var estado = (document.getElementById('cotEstado2') || {}).value || '';
    var tipo = (document.getElementById('cotTipo2') || {}).value || '';
    var desde = (document.getElementById('cotDesde2') || {}).value || '';
    var hasta = (document.getElementById('cotHasta2') || {}).value || '';

    return _data.filter(function (d) {
      if (search) {
        var hay = [d.folio, d.cliente, d.evento, d.espacios, d.folioMNT].join(' ').toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      if (estado && d.estado !== estado) return false;
      if (tipo && (d.fuente || 'MNT') !== tipo) return false;
      if (desde || hasta) {
        var fecha = d.fecha || '';
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
      }
      return true;
    });
  }

  function _render() {
    var filtered = _getFiltered();
    filtered.sort(function (a, b) {
      var va = a[_sortKey] || '', vb = b[_sortKey] || '';
      if (typeof va === 'number') return _sortDir === 'asc' ? va - vb : vb - va;
      return _sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

    _updateKPIs(filtered);
    _renderTable(filtered);
  }

  function _updateKPIs(filtered) {
    var activas = _data.filter(function (d) {
      return ['Cancelada', 'Perdida', 'Ejecutado'].indexOf(d.estado) === -1;
    });
    var cotizado = _data.reduce(function (s, d) {
      return ['Cancelada', 'Perdida'].indexOf(d.estado) === -1 ? s + (parseFloat(d.total) || 0) : s;
    }, 0);
    var cerradas = _data.filter(function (d) { return d.estado === 'Cerrada' || d.estado === 'En Producción' || d.estado === 'Ejecutado'; });
    var cerradoMonto = cerradas.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
    var tasaCierre = _data.length > 0 ? Math.round((cerradas.length / _data.length) * 100) : 0;

    var el = function (id) { return document.getElementById(id); };
    if (el('kpiPipeline')) el('kpiPipeline').textContent = activas.length;
    if (el('kpiCotizado')) el('kpiCotizado').textContent = _formatMXN(cotizado);
    if (el('kpiCerrado')) el('kpiCerrado').textContent = _formatMXN(cerradoMonto);
    if (el('kpiTasa')) el('kpiTasa').textContent = tasaCierre + '%';
  }

  function _renderTable(filtered) {
    var tbody = document.getElementById('cotBody2');
    if (!tbody) return;

    var total = filtered.length;
    var start = (_page - 1) * _perPage;
    var page = filtered.slice(start, start + _perPage);

    var html = '';
    page.forEach(function (d) {
      var estadoClass = 'estado-' + (d.estado || 'Cotizada').replace(/\s/g, '');
      var tipoClass = 'tipo-' + (d.fuente || 'MNT');
      html += '<tr data-id="' + _esc(d.id) + '">'
        + '<td class="col-folio">' + _esc(d.folio) + '</td>'
        + '<td>' + _esc(d.fecha || '') + '</td>'
        + '<td>' + _esc(d.cliente) + '</td>'
        + '<td>' + _esc(d.evento || '\u2014') + '</td>'
        + '<td><span class="tipo-badge ' + tipoClass + '">' + _esc(d.fuente || 'MNT') + '</span></td>'
        + '<td>' + _esc(d.espacios || 'Servicios') + '</td>'
        + '<td class="col-total">' + _formatMXN(d.total) + '</td>'
        + '<td>'
        + '<select class="estado-select ' + estadoClass + '" data-id="' + _esc(d.id) + '">'
        + _estadoOptions(d.estado)
        + '</select>'
        + '</td>'
        + '<td>' + (d.linkPdf ? '<a href="' + _esc(d.linkPdf) + '" target="_blank" class="pdf-link">PDF</a>' : '\u2014') + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;

    // Pagination info
    var paginationEl = document.getElementById('cotPagination2');
    if (paginationEl) {
      var totalPages = Math.ceil(total / _perPage) || 1;
      paginationEl.textContent = 'Página ' + _page + ' de ' + totalPages + ' (' + total + ' registros)';
    }
  }

  function _estadoOptions(current) {
    var estados = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];
    return estados.map(function (e) {
      return '<option value="' + e + '"' + (e === current ? ' selected' : '') + '>' + e + '</option>';
    }).join('');
  }

  function _bindFilters() {
    ['cotSearch2', 'cotEstado2', 'cotTipo2', 'cotDesde2', 'cotHasta2'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener(el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change', function () {
        _page = 1;
        _render();
      });
    });
  }

  function _bindTableEvents() {
    var tbody = document.getElementById('cotBody2');
    if (!tbody) return;

    tbody.addEventListener('change', function (e) {
      var select = e.target.closest('.estado-select');
      if (!select) return;
      var id = select.getAttribute('data-id');
      var newEstado = select.value;
      var user = BNK_AUTH.currentUser();

      BNK_DB.cotizaciones.update(id, { estado: newEstado }).then(function () {
        BNK_DB.actividad.add(id, {
          tipo: 'cambio_estado',
          estado: newEstado,
          usuario: user ? user.nombre : 'Sistema',
          nota: ''
        });
      });
    });
  }

  function _formatMXN(n) {
    if (!n && n !== 0) return '$0';
    return '$' + Number(n).toLocaleString('es-MX');
  }

  function _esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKCotizaciones = { load: function () {} };
})();
