// pipeline.js — Vista kanban con drag & drop
(function () {
  'use strict';

  var ESTADOS = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];
  var COLORES = {
    'Recorrido': 'var(--tx)', 'Cotizada': 'var(--ylw)', 'Negociación': '#FF9800',
    'Cerrada': 'var(--g)', 'En Producción': '#2196F3', 'Ejecutado': '#4CAF50',
    'Cancelada': 'var(--red)', 'Perdida': '#9E9E9E'
  };
  var ESTADOS_ACTIVOS = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado'];
  var CONFIG = { diasFria: 3, diasEstancada: 5 };

  var _data = [];
  var _filter = '';
  var _filterTipo = 'todos';
  var _filterDesde = null;
  var _filterHasta = null;
  var _filterMontoMin = 0;
  var _unsubscribe = null;
  var _firstLoad = true;
  var _currentDetailId = null;
  var _dragId = null;
  var _dragEstadoOrigen = null;

  function init() {
    BNK_DB.config.get('alertas').then(function (cfg) {
      if (cfg) {
        CONFIG.diasFria = cfg.diasFria || 3;
        CONFIG.diasEstancada = cfg.diasEstancada || 5;
      }
      var legFria = document.getElementById('pipeLegendFria');
      var legEstancada = document.getElementById('pipeLegendEstancada');
      if (legFria) legFria.textContent = 'Fría (>' + CONFIG.diasFria + 'd)';
      if (legEstancada) legEstancada.textContent = 'Estancada (>' + CONFIG.diasEstancada + 'd)';
    });

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

  // Cleanup snapshot listener
  window.addEventListener('beforeunload', function () {
    if (_unsubscribe) _unsubscribe();
  });

  function _applyFilters() {
    var result = _data;
    // Text search
    if (_filter) {
      var q = _filter.toLowerCase();
      result = result.filter(function (d) {
        return ((d.cliente || '') + ' ' + (d.evento || '') + ' ' + (d.folio || '')).toLowerCase().indexOf(q) !== -1;
      });
    }
    // Tipo filter
    if (_filterTipo !== 'todos') {
      result = result.filter(function (d) {
        return (d.fuente || 'MNT') === _filterTipo;
      });
    }
    // Date range
    if (_filterDesde) {
      var desde = new Date(_filterDesde);
      result = result.filter(function (d) {
        var f = _parseFecha(d.fecha || d.createdAt);
        return f && f >= desde;
      });
    }
    if (_filterHasta) {
      var hasta = new Date(_filterHasta + 'T23:59:59');
      result = result.filter(function (d) {
        var f = _parseFecha(d.fecha || d.createdAt);
        return f && f <= hasta;
      });
    }
    // Monto min
    if (_filterMontoMin > 0) {
      result = result.filter(function (d) {
        return (parseFloat(d.total) || 0) >= _filterMontoMin;
      });
    }
    return result;
  }

  function _parseFecha(f) {
    if (!f) return null;
    if (typeof f === 'object' && f.toDate) return f.toDate();
    var d = new Date(f);
    return isNaN(d.getTime()) ? null : d;
  }

  function _render() {
    var board = document.getElementById('pipelineBoard');
    if (!board) return;

    if (_data.length === 0) {
      board.innerHTML = '<div class="dash-empty" style="grid-column:1/-1"><div class="dash-empty-icon">\u{1F4CB}</div><div class="dash-empty-text">Sin cotizaciones en el pipeline</div></div>';
      _updatePipelineTotal([]);
      return;
    }

    var filtered = _applyFilters();
    var pipelineTotal = 0;

    var html = '';
    ESTADOS.forEach(function (estado) {
      var cards = filtered.filter(function (d) {
        var e = d.estado || 'Recorrido';
        if (e === 'Nueva') e = 'Recorrido';
        return e === estado;
      });
      var totalMonto = cards.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
      if (ESTADOS_ACTIVOS.indexOf(estado) !== -1) pipelineTotal += totalMonto;
      var pctOfTotal = pipelineTotal > 0 && ESTADOS_ACTIVOS.indexOf(estado) !== -1
        ? Math.round((totalMonto / pipelineTotal) * 100) : 0;

      html += '<div class="pipeline-col" data-estado="' + _esc(estado) + '">'
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

          // BNK vinculadas — use _data (not filtered) to always show children
          var bnkLine = '';
          if ((d.fuente || 'MNT') === 'MNT' && d.folio) {
            var bnkHijas = _data.filter(function (b) { return b.folioMNT === d.folio && b.fuente === 'BNK'; });
            if (bnkHijas.length > 0) {
              var sufijos = bnkHijas.map(function (b) { return (b.folio || '').split('-').pop(); });
              bnkLine = '<div class="pipeline-card-bnk">BNK: <span>' + sufijos.join(', ') + '</span></div>';
            }
          }

          html += '<div class="pipeline-card ' + alertClass + '" data-id="' + _esc(d.id) + '" draggable="true" tabindex="0" role="button">'
            + '<div class="pipeline-card-top">'
            + '<span class="pipeline-card-cliente">' + _esc(d.cliente) + '</span>'
            + '<span class="tipo-badge ' + tipoBadge + '">' + _esc(d.fuente || 'MNT') + '</span>'
            + '</div>'
            + '<div class="pipeline-card-folio">' + _esc(d.folio || '') + '</div>'
            + '<div class="pipeline-card-evento">' + _esc(d.evento || '\u2014') + '</div>'
            + bnkLine
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
    _updatePipelineTotal(filtered);
  }

  function _updatePipelineTotal(filtered) {
    var total = 0;
    filtered.forEach(function (d) {
      var e = d.estado || 'Recorrido';
      if (e === 'Nueva') e = 'Recorrido';
      if (ESTADOS_ACTIVOS.indexOf(e) !== -1) total += parseFloat(d.total) || 0;
    });
    var el = document.getElementById('pipeTotalActivo');
    if (el) el.textContent = _formatMXN(total);
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

  function _changeEstado(id, newEstado, prevEstado) {
    var user = BNK_AUTH.currentUser();
    BNK_DB.cotizaciones.update(id, { estado: newEstado }).then(function () {
      BNKToast.ok('Estado actualizado a ' + newEstado + '.');
      BNK_DB.actividad.add(id, { tipo: 'cambio_estado', estado: newEstado, usuario: user ? user.nombre : 'Sistema', nota: '' });
      if (BNK_DB.logActividad) {
        var d = _data.find(function (x) { return x.id === id; });
        BNK_DB.logActividad({ tipo: 'estado_cambio', entidad: 'cotizacion', entidadId: id, referencia: d ? d.folio : '', detalle: prevEstado + ' \u2192 ' + newEstado });
      }
    }).catch(function (err) {
      BNKToast.error('Error al cambiar estado: ' + err.message);
      _render(); // Revert visual
    });
  }

  function _bindEvents() {
    var board = document.getElementById('pipelineBoard');

    // Click to open detail
    board.addEventListener('click', function (e) {
      var card = e.target.closest('.pipeline-card');
      if (!card) return;
      _openDetail(card.getAttribute('data-id'));
    });

    board.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('.pipeline-card');
      if (!card) return;
      e.preventDefault();
      _openDetail(card.getAttribute('data-id'));
    });

    // ── Drag & Drop ──
    board.addEventListener('dragstart', function (e) {
      var card = e.target.closest('.pipeline-card');
      if (!card) return;
      _dragId = card.getAttribute('data-id');
      var col = card.closest('.pipeline-col');
      _dragEstadoOrigen = col ? col.getAttribute('data-estado') : null;
      card.classList.add('pipeline-card--dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', _dragId);
    });

    board.addEventListener('dragend', function (e) {
      var card = e.target.closest('.pipeline-card');
      if (card) card.classList.remove('pipeline-card--dragging');
      _dragId = null;
      _dragEstadoOrigen = null;
      // Remove all drop-target classes
      board.querySelectorAll('.pipeline-col--drop-target').forEach(function (el) {
        el.classList.remove('pipeline-col--drop-target');
      });
    });

    board.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var col = e.target.closest('.pipeline-col');
      if (col && !col.classList.contains('pipeline-col--drop-target')) {
        board.querySelectorAll('.pipeline-col--drop-target').forEach(function (el) {
          el.classList.remove('pipeline-col--drop-target');
        });
        col.classList.add('pipeline-col--drop-target');
      }
    });

    board.addEventListener('dragleave', function (e) {
      var col = e.target.closest('.pipeline-col');
      if (col && !col.contains(e.relatedTarget)) {
        col.classList.remove('pipeline-col--drop-target');
      }
    });

    board.addEventListener('drop', function (e) {
      e.preventDefault();
      var col = e.target.closest('.pipeline-col');
      if (!col || !_dragId) return;
      col.classList.remove('pipeline-col--drop-target');

      var newEstado = col.getAttribute('data-estado');
      if (!newEstado || newEstado === _dragEstadoOrigen) return;

      var id = _dragId;
      var prevEstado = _dragEstadoOrigen;
      _dragId = null;
      _dragEstadoOrigen = null;

      if (newEstado === 'Cancelada' || newEstado === 'Perdida') {
        BNKConfirm.show('\u00bfCambiar estado a "' + newEstado + '"?', 'CONFIRMAR').then(function (ok) {
          if (ok) _changeEstado(id, newEstado, prevEstado);
        });
      } else {
        _changeEstado(id, newEstado, prevEstado);
      }
    });

    // ── Touch drag support ──
    var _touchCard = null;
    var _touchClone = null;
    var _touchStartY = 0;
    var _touchStartX = 0;
    var _touchMoved = false;

    board.addEventListener('touchstart', function (e) {
      var card = e.target.closest('.pipeline-card');
      if (!card) return;
      _touchCard = card;
      _touchStartX = e.touches[0].clientX;
      _touchStartY = e.touches[0].clientY;
      _touchMoved = false;
    }, { passive: true });

    board.addEventListener('touchmove', function (e) {
      if (!_touchCard) return;
      var dx = e.touches[0].clientX - _touchStartX;
      var dy = e.touches[0].clientY - _touchStartY;
      if (!_touchMoved && Math.abs(dx) + Math.abs(dy) > 10) {
        _touchMoved = true;
        _dragId = _touchCard.getAttribute('data-id');
        var col = _touchCard.closest('.pipeline-col');
        _dragEstadoOrigen = col ? col.getAttribute('data-estado') : null;
        _touchClone = _touchCard.cloneNode(true);
        _touchClone.classList.add('pipeline-card--ghost');
        document.body.appendChild(_touchClone);
      }
      if (_touchMoved && _touchClone) {
        e.preventDefault();
        _touchClone.style.left = (e.touches[0].clientX - 60) + 'px';
        _touchClone.style.top = (e.touches[0].clientY - 20) + 'px';
        // Highlight target column
        var target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        var targetCol = target ? target.closest('.pipeline-col') : null;
        board.querySelectorAll('.pipeline-col--drop-target').forEach(function (el) { el.classList.remove('pipeline-col--drop-target'); });
        if (targetCol) targetCol.classList.add('pipeline-col--drop-target');
      }
    }, { passive: false });

    board.addEventListener('touchend', function (e) {
      if (_touchClone) {
        _touchClone.remove();
        _touchClone = null;
      }
      board.querySelectorAll('.pipeline-col--drop-target').forEach(function (el) { el.classList.remove('pipeline-col--drop-target'); });

      if (_touchMoved && _dragId) {
        var touch = e.changedTouches[0];
        var target = document.elementFromPoint(touch.clientX, touch.clientY);
        var col = target ? target.closest('.pipeline-col') : null;
        if (col) {
          var newEstado = col.getAttribute('data-estado');
          if (newEstado && newEstado !== _dragEstadoOrigen) {
            var id = _dragId;
            var prev = _dragEstadoOrigen;
            if (newEstado === 'Cancelada' || newEstado === 'Perdida') {
              BNKConfirm.show('\u00bfCambiar estado a "' + newEstado + '"?', 'CONFIRMAR').then(function (ok) {
                if (ok) _changeEstado(id, newEstado, prev);
              });
            } else {
              _changeEstado(id, newEstado, prev);
            }
          }
        }
      } else if (!_touchMoved && _touchCard) {
        _openDetail(_touchCard.getAttribute('data-id'));
      }

      _touchCard = null;
      _dragId = null;
      _dragEstadoOrigen = null;
      _touchMoved = false;
    });

    // ── Detail modal ──
    document.getElementById('pipeDetailClose').addEventListener('click', _closeDetail);
    document.getElementById('pipeDetailOverlay').addEventListener('click', function (e) { if (e.target === this) _closeDetail(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _currentDetailId) { e.preventDefault(); _closeDetail(); }
    });
    document.getElementById('pipeNoteBtn').addEventListener('click', _submitNote);
    document.getElementById('pipeNoteInput').addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); _submitNote(); }
    });

    // ── Search ──
    var searchInput = document.getElementById('pipeSearch');
    if (searchInput) searchInput.addEventListener('input', function () { _filter = this.value.trim(); _render(); });

    // ── Tipo filter ──
    var filterBtns = document.querySelectorAll('[data-pipe-tipo]');
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        _filterTipo = this.getAttribute('data-pipe-tipo');
        _render();
      });
    });

    // ── Date filters ──
    var desdeEl = document.getElementById('pipeFechaDesde');
    var hastaEl = document.getElementById('pipeFechaHasta');
    if (desdeEl) desdeEl.addEventListener('change', function () { _filterDesde = this.value || null; _render(); });
    if (hastaEl) hastaEl.addEventListener('change', function () { _filterHasta = this.value || null; _render(); });

    // ── Monto filter ──
    var montoEl = document.getElementById('pipeMontoMin');
    if (montoEl) montoEl.addEventListener('input', function () { _filterMontoMin = parseFloat(this.value) || 0; _render(); });
  }

  function _submitNote() {
    var nota = document.getElementById('pipeNoteInput').value.trim();
    if (!nota) { BNKToast.warn('Escribe una nota de seguimiento.'); return; }
    if (!_currentDetailId) return;
    var user = BNK_AUTH.currentUser();
    var btn = document.getElementById('pipeNoteBtn');
    btn.disabled = true;
    BNK_DB.actividad.add(_currentDetailId, {
      tipo: 'nota', usuario: user ? user.nombre : 'Sistema', nota: nota
    }).then(function () {
      document.getElementById('pipeNoteInput').value = '';
      BNKToast.ok('Nota agregada.');
      _loadTimeline(_currentDetailId);
    }).catch(function (err) {
      BNKToast.error('Error al guardar nota: ' + err.message);
    }).finally(function () { btn.disabled = false; });
  }

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
      + '</div></div></div>';
    document.getElementById('pipeDetailInfo').innerHTML = info;

    document.getElementById('pipeDetailEstado').addEventListener('change', function () {
      var select = this;
      var newEstado = select.value;
      var prevEstado = select.getAttribute('data-prev') || d.estado;
      if (newEstado === 'Cancelada' || newEstado === 'Perdida') {
        BNKConfirm.show('\u00bfCambiar estado a "' + newEstado + '"?', 'CONFIRMAR').then(function (ok) {
          if (ok) { select.setAttribute('data-prev', newEstado); _changeEstado(id, newEstado, prevEstado); _loadTimeline(id); }
          else { select.value = prevEstado; }
        });
      } else {
        select.setAttribute('data-prev', newEstado);
        _changeEstado(id, newEstado, prevEstado);
        _loadTimeline(id);
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
        var text = isEstado ? 'Cambi\u00f3 estado a <strong>' + _esc(entry.estado) + '</strong>' : _esc(entry.nota);
        html += '<div class="pipe-timeline-entry">'
          + '<span class="pipe-timeline-icon ' + iconClass + '">' + icon + '</span>'
          + '<div class="pipe-timeline-content">'
          + '<div class="pipe-timeline-text">' + text + '</div>'
          + '<div class="pipe-timeline-meta">' + _esc(entry.usuario) + ' \u2014 ' + fecha + '</div>'
          + '</div></div>';
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
        board.innerHTML = '<div class="dash-empty"><div class="dash-empty-icon">\u{1F512}</div>'
          + '<div class="dash-empty-text">ACCESO RESTRINGIDO</div>'
          + '<p style="color:var(--tx);font-size:12px;margin-top:8px">Solo roles admin y ventas pueden ver el pipeline.</p></div>';
      }
    }
  });

  window.BNKPipeline = { load: function () {} };
})();
