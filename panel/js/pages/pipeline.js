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
  var _filter = '';
  var _unsubscribe = null;
  var _firstLoad = true;

  function init() {
    BNK_DB.config.get('alertas').then(function (cfg) {
      if (cfg) {
        CONFIG.diasFria = cfg.diasFria || 3;
        CONFIG.diasEstancada = cfg.diasEstancada || 5;
      }
      // Update legend dynamically
      var legFria = document.getElementById('pipeLegendFria');
      var legEstancada = document.getElementById('pipeLegendEstancada');
      if (legFria) legFria.textContent = 'Fría (>' + CONFIG.diasFria + 'd)';
      if (legEstancada) legEstancada.textContent = 'Estancada (>' + CONFIG.diasEstancada + 'd)';
    });

    // Show loading on first load
    var board = document.getElementById('pipelineBoard');
    if (board && _firstLoad) {
      var loadEl = document.createElement('div');
      loadEl.className = 'dash-loading';
      loadEl.textContent = 'CARGANDO PIPELINE...';
      loadEl.id = 'pipeLoading';
      board.parentNode.insertBefore(loadEl, board);
    }

    _unsubscribe = BNK_DB.cotizaciones.onSnapshot(function (docs) {
      _data = docs;
      if (_firstLoad) {
        _firstLoad = false;
        var ld = document.getElementById('pipeLoading');
        if (ld) ld.remove();
      }
      _render();
    }, function (err) {
      var ld = document.getElementById('pipeLoading');
      if (ld) ld.textContent = 'Error al cargar pipeline.';
      BNKToast.error('Error en pipeline: ' + (err && err.message ? err.message : 'desconocido'));
    });

    _bindEvents();
  }

  function _render() {
    var board = document.getElementById('pipelineBoard');
    if (!board) return;

    if (_data.length === 0) {
      board.innerHTML = '<div class="dash-empty" style="grid-column:1/-1"><div class="dash-empty-icon">&#128203;</div><div class="dash-empty-text">Sin cotizaciones en el pipeline</div></div>';
      return;
    }

    var filtered = _data;
    if (_filter) {
      var q = _filter.toLowerCase();
      filtered = _data.filter(function (d) {
        return ((d.cliente || '') + ' ' + (d.evento || '') + ' ' + (d.folio || '')).toLowerCase().indexOf(q) !== -1;
      });
    }

    var html = '';
    ESTADOS.forEach(function (estado) {
      var cards = filtered.filter(function (d) { return (d.estado || 'Cotizada') === estado; });
      var totalMonto = cards.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);

      html += '<div class="pipeline-col">'
        + '<div class="pipeline-col-header" style="border-color:' + COLORES[estado] + '">'
        + '<span class="pipeline-col-title">' + estado.toUpperCase() + '</span>'
        + '<span class="pipeline-col-count">' + cards.length + '</span>'
        + '<span class="pipeline-col-total">' + _formatMXN(totalMonto) + '</span>'
        + '</div>'
        + '<div class="pipeline-col-body">';

      if (cards.length === 0) {
        html += '<div class="pipeline-empty-col">Sin cotizaciones</div>';
      } else {
        cards.forEach(function (d) {
          var diasEnEstado = _diasDesde(d.updatedAt);
          var alertClass = '';
          if (estado === 'Cotizada' && diasEnEstado > CONFIG.diasFria) alertClass = 'pipeline-card--cold';
          if (estado === 'Negociación' && diasEnEstado > CONFIG.diasEstancada) alertClass = 'pipeline-card--stale';

          var tipoBadge = d.fuente === 'BNK' ? 'tipo-BNK' : 'tipo-MNT';
          html += '<div class="pipeline-card ' + alertClass + '" data-id="' + _esc(d.id) + '">'
            + '<div class="pipeline-card-top">'
            + '<span class="pipeline-card-cliente">' + _esc(d.cliente) + '</span>'
            + '<span class="tipo-badge ' + tipoBadge + '">' + _esc(d.fuente || 'MNT') + '</span>'
            + '</div>'
            + '<div class="pipeline-card-folio">' + _esc(d.folio || '') + '</div>'
            + '<div class="pipeline-card-evento">' + _esc(d.evento || '\u2014') + '</div>'
            + '<div class="pipeline-card-footer">'
            + '<span class="pipeline-card-monto">' + _formatMXN(d.total) + '</span>'
            + '<span class="pipeline-card-tiempo">' + _tiempoDisplay(diasEnEstado) + '</span>'
            + '</div>'
            + '</div>';
        });
      }

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

    // Escape to close modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _currentDetailId) {
        e.preventDefault();
        _closeDetail();
      }
    });

    document.getElementById('pipeNoteBtn').addEventListener('click', _submitNote);

    // Enter in note input to submit
    document.getElementById('pipeNoteInput').addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        _submitNote();
      }
    });

    // Search filter
    var searchInput = document.getElementById('pipeSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        _filter = this.value.trim();
        _render();
      });
    }
  }

  function _submitNote() {
    var nota = document.getElementById('pipeNoteInput').value.trim();
    if (!nota) { BNKToast.warn('Escribe una nota de seguimiento.'); return; }
    if (!_currentDetailId) return;
    var user = BNK_AUTH.currentUser();
    var btn = document.getElementById('pipeNoteBtn');
    btn.disabled = true;
    BNK_DB.actividad.add(_currentDetailId, {
      tipo: 'nota',
      usuario: user ? user.nombre : 'Sistema',
      nota: nota
    }).then(function () {
      document.getElementById('pipeNoteInput').value = '';
      BNKToast.ok('Nota agregada.');
      _loadTimeline(_currentDetailId);
    }).catch(function (err) {
      BNKToast.error('Error al guardar nota: ' + err.message);
    }).finally(function () {
      btn.disabled = false;
    });
  }

  var _currentDetailId = null;

  function _openDetail(id) {
    _currentDetailId = id;
    var d = _data.find(function (x) { return x.id === id; });
    if (!d) return;

    document.getElementById('pipeDetailTitle').textContent = d.folio || 'DETALLE';

    var tipoBadge = d.fuente === 'BNK' ? 'tipo-BNK' : 'tipo-MNT';
    var info = '<div class="pipe-detail-grid">'
      + '<div><span class="bnk-label">CLIENTE</span><div>' + _esc(d.cliente) + '</div></div>'
      + '<div><span class="bnk-label">EVENTO</span><div>' + _esc(d.evento || '\u2014') + '</div></div>'
      + '<div><span class="bnk-label">TIPO</span><div><span class="tipo-badge ' + tipoBadge + '">' + _esc(d.fuente || 'MNT') + '</span></div></div>'
      + '<div><span class="bnk-label">TOTAL</span><div>' + _formatMXN(d.total) + '</div></div>'
      + '<div class="pipe-detail-estado-wrap"><span class="bnk-label">ESTADO</span><div>'
      + '<select id="pipeDetailEstado" class="bnk-input" style="max-width:200px" data-prev="' + _esc(d.estado) + '">' + _estadoOpts(d.estado) + '</select>'
      + '</div></div>'
      + '</div>';
    document.getElementById('pipeDetailInfo').innerHTML = info;

    document.getElementById('pipeDetailEstado').addEventListener('change', function () {
      var select = this;
      var newEstado = select.value;
      var prevEstado = select.getAttribute('data-prev') || d.estado;
      var user = BNK_AUTH.currentUser();

      function doUpdate() {
        select.setAttribute('data-prev', newEstado);
        BNK_DB.cotizaciones.update(id, { estado: newEstado }).then(function () {
          BNKToast.ok('Estado actualizado a ' + newEstado + '.');
          BNK_DB.actividad.add(id, {
            tipo: 'cambio_estado',
            estado: newEstado,
            usuario: user ? user.nombre : 'Sistema',
            nota: ''
          });
          _loadTimeline(id);
        }).catch(function (err) {
          select.value = prevEstado;
          BNKToast.error('Error al cambiar estado: ' + err.message);
        });
      }

      if (newEstado === 'Cancelada' || newEstado === 'Perdida') {
        BNKConfirm.show('¿Cambiar estado a "' + newEstado + '"?', 'CONFIRMAR').then(function (ok) {
          if (ok) { doUpdate(); } else { select.value = prevEstado; }
        });
      } else {
        doUpdate();
      }
    });

    _loadTimeline(id);
    document.getElementById('pipeDetailOverlay').classList.add('visible');
  }

  function _loadTimeline(id) {
    BNK_DB.actividad.list(id).then(function (entries) {
      var html = '';
      entries.forEach(function (entry) {
        var fecha = entry.fecha ? (entry.fecha.toDate ? entry.fecha.toDate().toLocaleString('es-MX') : entry.fecha) : '';
        var isEstado = entry.tipo === 'cambio_estado';
        var icon = isEstado ? '\u25B6' : '\u270E';
        var iconClass = isEstado ? 'pipe-timeline-icon--estado' : 'pipe-timeline-icon--nota';
        var text = isEstado
          ? 'Cambió estado a <strong>' + _esc(entry.estado) + '</strong>'
          : _esc(entry.nota);

        html += '<div class="pipe-timeline-entry">'
          + '<span class="pipe-timeline-icon ' + iconClass + '">' + icon + '</span>'
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
    if (user && (user.rol === 'admin' || user.rol === 'ventas')) {
      init();
    } else if (user) {
      var board = document.getElementById('pipelineBoard');
      if (board) {
        board.innerHTML = '<div class="dash-empty"><div class="dash-empty-icon">🔒</div>'
          + '<div class="dash-empty-text">ACCESO RESTRINGIDO</div>'
          + '<p style="color:var(--tx);font-size:12px;margin-top:8px">Solo roles admin y ventas pueden ver el pipeline.</p></div>';
      }
    }
  });

  window.BNKPipeline = { load: function () {} };
})();
