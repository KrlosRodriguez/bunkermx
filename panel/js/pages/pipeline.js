// pipeline.js — Vista kanban de pipeline
(function () {
  'use strict';

  var ESTADOS = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];
  var COLORES = {
    'Recorrido': 'var(--tx)', 'Cotizada': 'var(--ylw)', 'Negociación': '#FF9800',
    'Cerrada': 'var(--g)', 'En Producción': '#2196F3', 'Ejecutado': '#4CAF50',
    'Cancelada': 'var(--red)', 'Perdida': '#9E9E9E'
  };
  var CONFIG = { diasFria: 3, diasEstancada: 5 };

  var _data = [];
  var _unsubscribe = null;

  function init() {
    BNK_DB.config.get('alertas').then(function (cfg) {
      if (cfg) {
        CONFIG.diasFria = cfg.diasFria || 3;
        CONFIG.diasEstancada = cfg.diasEstancada || 5;
      }
    });

    _unsubscribe = BNK_DB.cotizaciones.onSnapshot(function (docs) {
      _data = docs;
      _render();
    });

    _bindEvents();
  }

  function _render() {
    var board = document.getElementById('pipelineBoard');
    if (!board) return;

    var html = '';
    ESTADOS.forEach(function (estado) {
      var cards = _data.filter(function (d) { return (d.estado || 'Cotizada') === estado; });
      var totalMonto = cards.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);

      html += '<div class="pipeline-col">'
        + '<div class="pipeline-col-header" style="border-color:' + COLORES[estado] + '">'
        + '<span class="pipeline-col-title">' + estado.toUpperCase() + '</span>'
        + '<span class="pipeline-col-count">' + cards.length + '</span>'
        + '<span class="pipeline-col-total">' + _formatMXN(totalMonto) + '</span>'
        + '</div>'
        + '<div class="pipeline-col-body">';

      cards.forEach(function (d) {
        var diasEnEstado = _diasDesde(d.updatedAt);
        var alertClass = '';
        if (estado === 'Cotizada' && diasEnEstado > CONFIG.diasFria) alertClass = 'pipeline-card--cold';
        if (estado === 'Negociación' && diasEnEstado > CONFIG.diasEstancada) alertClass = 'pipeline-card--stale';

        html += '<div class="pipeline-card ' + alertClass + '" data-id="' + _esc(d.id) + '">'
          + '<div class="pipeline-card-cliente">' + _esc(d.cliente) + '</div>'
          + '<div class="pipeline-card-evento">' + _esc(d.evento || '\u2014') + '</div>'
          + '<div class="pipeline-card-footer">'
          + '<span class="pipeline-card-monto">' + _formatMXN(d.total) + '</span>'
          + '<span class="pipeline-card-tiempo">' + _tiempoDisplay(diasEnEstado) + '</span>'
          + '</div>'
          + '</div>';
      });

      html += '</div></div>';
    });

    board.innerHTML = html;
  }

  function _diasDesde(timestamp) {
    if (!timestamp) return 0;
    var fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    var diff = Date.now() - fecha.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function _tiempoDisplay(dias) {
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'ayer';
    return 'hace ' + dias + 'd';
  }

  function _bindEvents() {
    document.getElementById('pipelineBoard').addEventListener('click', function (e) {
      var card = e.target.closest('.pipeline-card');
      if (!card) return;
      var id = card.getAttribute('data-id');
      _openDetail(id);
    });

    document.getElementById('pipeDetailClose').addEventListener('click', _closeDetail);
    document.getElementById('pipeDetailOverlay').addEventListener('click', function (e) {
      if (e.target === this) _closeDetail();
    });

    document.getElementById('pipeNoteBtn').addEventListener('click', function () {
      var nota = document.getElementById('pipeNoteInput').value.trim();
      if (!nota || !_currentDetailId) return;
      var user = BNK_AUTH.currentUser();
      BNK_DB.actividad.add(_currentDetailId, {
        tipo: 'nota',
        usuario: user ? user.nombre : 'Sistema',
        nota: nota
      }).then(function () {
        document.getElementById('pipeNoteInput').value = '';
        _loadTimeline(_currentDetailId);
      });
    });
  }

  var _currentDetailId = null;

  function _openDetail(id) {
    _currentDetailId = id;
    var d = _data.find(function (x) { return x.id === id; });
    if (!d) return;

    document.getElementById('pipeDetailTitle').textContent = d.folio || 'DETALLE';

    var info = '<div class="pipe-detail-grid">'
      + '<div><span class="bnk-label">CLIENTE</span><div>' + _esc(d.cliente) + '</div></div>'
      + '<div><span class="bnk-label">EVENTO</span><div>' + _esc(d.evento || '\u2014') + '</div></div>'
      + '<div><span class="bnk-label">TIPO</span><div>' + _esc(d.fuente || 'MNT') + '</div></div>'
      + '<div><span class="bnk-label">TOTAL</span><div>' + _formatMXN(d.total) + '</div></div>'
      + '<div><span class="bnk-label">ESTADO</span><div>'
      + '<select id="pipeDetailEstado" class="bnk-input" style="max-width:200px">' + _estadoOpts(d.estado) + '</select>'
      + '</div></div>'
      + '</div>';
    document.getElementById('pipeDetailInfo').innerHTML = info;

    document.getElementById('pipeDetailEstado').addEventListener('change', function () {
      var newEstado = this.value;
      var user = BNK_AUTH.currentUser();
      BNK_DB.cotizaciones.update(id, { estado: newEstado }).then(function () {
        BNK_DB.actividad.add(id, {
          tipo: 'cambio_estado',
          estado: newEstado,
          usuario: user ? user.nombre : 'Sistema',
          nota: ''
        });
        _loadTimeline(id);
      });
    });

    _loadTimeline(id);
    document.getElementById('pipeDetailOverlay').classList.add('visible');
  }

  function _loadTimeline(id) {
    BNK_DB.actividad.list(id).then(function (entries) {
      var html = '';
      entries.forEach(function (entry) {
        var fecha = entry.fecha ? (entry.fecha.toDate ? entry.fecha.toDate().toLocaleString('es-MX') : entry.fecha) : '';
        var icon = entry.tipo === 'cambio_estado' ? '\u25B6' : '\u270E';
        var text = entry.tipo === 'cambio_estado'
          ? 'Cambió estado a <strong>' + _esc(entry.estado) + '</strong>'
          : _esc(entry.nota);

        html += '<div class="pipe-timeline-entry">'
          + '<span class="pipe-timeline-icon">' + icon + '</span>'
          + '<div class="pipe-timeline-content">'
          + '<div class="pipe-timeline-text">' + text + '</div>'
          + '<div class="pipe-timeline-meta">' + _esc(entry.usuario) + ' — ' + fecha + '</div>'
          + '</div>'
          + '</div>';
      });
      document.getElementById('pipeTimeline').innerHTML = html || '<div style="color:var(--tx);font-size:12px">Sin actividad registrada</div>';
    });
  }

  function _closeDetail() {
    _currentDetailId = null;
    document.getElementById('pipeDetailOverlay').classList.remove('visible');
  }

  function _estadoOpts(current) {
    return ESTADOS.map(function (e) {
      return '<option value="' + e + '"' + (e === current ? ' selected' : '') + '>' + e + '</option>';
    }).join('');
  }

  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user && (user.rol === 'admin' || user.rol === 'ventas')) init();
  });

  window.BNKPipeline = { load: function () {} };
})();
