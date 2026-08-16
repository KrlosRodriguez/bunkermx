// eventos.js — Ficha de evento y checklist de producción
(function () {
  'use strict';

  var _eventos = [];
  var _plantillas = [];
  var _currentEvento = null;
  var _loaded = false;
  var _viewMode = 'list'; // 'list' or 'checklist'

  function init() {
    _bindEvents();
    load();
  }

  function load() {
    var evtLoading = document.getElementById('evtLoading');
    var container = document.getElementById('eventosListContainer');
    if (evtLoading) evtLoading.style.display = '';
    if (container) container.innerHTML = '';

    BNK_DB.eventos.list().then(function (docs) {
      _eventos = docs;
      _loaded = true;
      if (evtLoading) evtLoading.style.display = 'none';
      _viewMode = 'list';
      _renderList();
      _updateIndicators();
    }).catch(function (err) {
      _eventos = [];
      _loaded = true;
      if (evtLoading) evtLoading.style.display = 'none';
      BNKToast.error('Error al cargar eventos: ' + (err && err.message ? err.message : 'desconocido'));
      if (container) {
        container.innerHTML = '<div class="dash-empty">'
          + '<div class="dash-empty-icon">\u26A0</div>'
          + '<div class="dash-empty-text">ERROR AL CARGAR EVENTOS</div>'
          + '</div>';
        if (!container.querySelector('.evt-retry-btn')) {
          var retryBtn = document.createElement('button');
          retryBtn.className = 'panel-btn-primary evt-retry-btn';
          retryBtn.textContent = 'REINTENTAR';
          retryBtn.style.marginTop = '16px';
          retryBtn.style.display = 'block';
          retryBtn.style.margin = '16px auto 0';
          retryBtn.addEventListener('click', function () { load(); });
          container.appendChild(retryBtn);
        }
      }
    });

    BNK_DB.plantillas.list().then(function (docs) {
      _plantillas = docs;
    }).catch(function () {
      _plantillas = [];
    });
  }

  function _bindEvents() {
    var searchEl = document.getElementById('evtSearch');
    if (searchEl) searchEl.addEventListener('input', function () {
      if (_viewMode === 'list') _renderList();
    });

    var estadoEl = document.getElementById('evtEstadoFiltro');
    if (estadoEl) estadoEl.addEventListener('change', function () {
      if (_viewMode === 'list') _renderList();
    });

    // Escape key for plantilla modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('evtPlantillaOverlay');
        if (overlay && overlay.classList.contains('visible')) {
          e.preventDefault();
          overlay.classList.remove('visible');
        }
      }
    });
  }

  function _getFilteredEventos() {
    var search = (document.getElementById('evtSearch') || {}).value || '';
    search = search.trim().toLowerCase();
    var estadoFiltro = (document.getElementById('evtEstadoFiltro') || {}).value || '';

    var filtered = _eventos;
    if (search) {
      filtered = filtered.filter(function (e) {
        return [e.nombre, e.evento, e.cliente, e.folioCotizacion].join(' ').toLowerCase().indexOf(search) !== -1;
      });
    }
    if (estadoFiltro) {
      filtered = filtered.filter(function (e) { return e.estado === estadoFiltro; });
    }
    return filtered;
  }

  function _updateIndicators() {
    var total = _eventos.length;
    var enProd = _eventos.filter(function (e) { return e.estado === 'En Producción'; }).length;
    var ejecutados = _eventos.filter(function (e) { return e.estado === 'Ejecutado'; }).length;

    var elTotal = document.getElementById('indEvtTotal');
    var elProd = document.getElementById('indEvtProd');
    var elEjec = document.getElementById('indEvtEjec');
    var elProx = document.getElementById('indEvtProx');
    if (elTotal) elTotal.textContent = total;
    if (elProd) elProd.textContent = enProd;
    if (elEjec) elEjec.textContent = ejecutados;

    // Find next upcoming event
    if (elProx) {
      var hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      var proximo = null;
      _eventos.forEach(function (e) {
        if (e.estado === 'Ejecutado') return;
        var f = _parseFecha(e.fechaEvento);
        if (f && f >= hoy) {
          if (!proximo || f < proximo.date) {
            proximo = { date: f, nombre: e.nombre || e.evento || '' };
          }
        }
      });
      if (proximo) {
        elProx.textContent = _formatDate(proximo.date) + ' · ' + (proximo.nombre.substring(0, 10) || '');
      } else {
        elProx.textContent = '—';
      }
    }
  }

  function _renderList() {
    var container = document.getElementById('eventosListContainer');
    var toolbar = document.getElementById('evtToolbar');
    if (!container) return;

    _viewMode = 'list';
    if (toolbar) toolbar.style.display = '';

    var filtered = _getFilteredEventos();

    if (filtered.length === 0) {
      var msg = _eventos.length === 0 ? 'Sin eventos registrados' : 'Sin eventos con ese filtro';
      container.innerHTML = '<div class="dash-empty"><div class="dash-empty-icon">&#128197;</div><div class="dash-empty-text">' + msg + '</div></div>';
      return;
    }

    var html = '';
    filtered.forEach(function (evt) {
      var progreso = evt.tareasTotal > 0 ? Math.round((evt.tareasCompletadas / evt.tareasTotal) * 100) : 0;
      var estadoClass = evt.estado === 'Ejecutado' ? 'estado-Ejecutado' : 'estado-EnProd';
      var fechaStr = _formatFechaEvento(evt.fechaEvento);

      html += '<div class="evento-card' + (evt.estado === 'Ejecutado' ? ' evento-card--done' : '') + '" data-eid="' + evt.id + '">'
        + '<div class="evento-card-header">'
        + '<span class="evento-card-title">' + _esc(evt.nombre || evt.evento || 'Evento') + '</span>'
        + '<div class="evento-card-meta">'
        + '<span class="estado-badge ' + estadoClass + '">' + _esc(evt.estado || 'En Producción') + '</span>'
        + '<span class="evento-card-date">' + _esc(fechaStr) + '</span>'
        + '</div>'
        + '</div>'
        + '<div class="evento-card-info">'
        + '<span>Cliente: ' + _esc(evt.cliente || '') + '</span>'
        + '<span>Folio: ' + _esc(evt.folioCotizacion || '') + '</span>'
        + '</div>'
        + '<div class="evento-progress"><div class="evento-progress-fill" style="width:' + progreso + '%"></div></div>'
        + '<div class="evento-progress-text">' + progreso + '% completado (' + (evt.tareasCompletadas || 0) + '/' + (evt.tareasTotal || 0) + ' tareas)</div>'
        + '</div>';
    });
    container.innerHTML = html;

    // Bind clicks
    container.querySelectorAll('.evento-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var eid = this.getAttribute('data-eid');
        _openEvento(eid);
      });
    });
  }

  function _openEvento(eventoId) {
    var evt = _eventos.find(function (e) { return e.id === eventoId; });
    if (!evt) return;
    _currentEvento = evt;

    BNK_DB.tareas.list(eventoId).then(function (tareas) {
      _renderChecklist(evt, tareas);
    }).catch(function (err) {
      BNKToast.error('Error al cargar tareas: ' + (err && err.message ? err.message : 'desconocido'));
    });
  }

  function _renderChecklist(evt, tareas) {
    var container = document.getElementById('eventosListContainer');
    var toolbar = document.getElementById('evtToolbar');
    if (!container) return;

    _viewMode = 'checklist';
    if (toolbar) toolbar.style.display = 'none';

    var canEdit = BNK_AUTH.canEdit('checklist') || BNK_AUTH.canEdit('eventos');
    var fechaStr = _formatFechaEvento(evt.fechaEvento);
    var estadoClass = evt.estado === 'Ejecutado' ? 'estado-Ejecutado' : 'estado-EnProd';

    var html = '<div class="evt-checklist-toolbar">'
      + '<button class="panel-btn-secondary" id="btnVolverEventos">&larr; VOLVER</button>'
      + '<h2 class="panel-section-title">' + _esc(evt.nombre || evt.evento || 'EVENTO') + '</h2>'
      + '<span class="estado-badge ' + estadoClass + '">' + _esc(evt.estado || 'En Producción') + '</span>'
      + '</div>'
      + '<div class="evt-checklist-info">'
      + '<span>Cliente: ' + _esc(evt.cliente || '') + '</span>'
      + '<span>Fecha: ' + _esc(fechaStr) + '</span>'
      + '<span>Folio: ' + _esc(evt.folioCotizacion || '') + '</span>'
      + '</div>';

    if (tareas.length === 0) {
      html += '<div class="dash-empty"><div class="dash-empty-icon">&#128203;</div><div class="dash-empty-text">Sin tareas en este evento</div></div>';
    } else {
      html += '<div class="checklist">';
      tareas.forEach(function (t) {
        var checked = t.completada ? 'checked' : '';
        var completed = t.completada ? 'completed' : '';
        var responsableStr = t.responsable || 'Sin asignar';
        var fechaLimStr = _formatFechaEvento(t.fechaLimite);

        html += '<div class="checklist-item ' + completed + '" data-tid="' + t.id + '">'
          + '<button class="checklist-check ' + checked + '" data-tid="' + t.id + '"' + (canEdit ? '' : ' disabled')
          + ' aria-label="' + (t.completada ? 'Desmarcar' : 'Completar') + ': ' + _esc(t.descripcion) + '"'
          + ' aria-pressed="' + (t.completada ? 'true' : 'false') + '">'
          + (t.completada ? '&#10003;' : '') + '</button>'
          + '<span class="checklist-desc">' + _esc(t.descripcion) + '</span>'
          + '<span class="checklist-responsable">' + _esc(responsableStr) + '</span>'
          + '<span class="checklist-fecha">' + _esc(fechaLimStr) + '</span>'
          + '</div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // Back button
    var volverBtn = document.getElementById('btnVolverEventos');
    if (volverBtn) volverBtn.addEventListener('click', function () {
      _renderList();
    });

    // Checkbox clicks (only if canEdit)
    if (canEdit) {
      container.querySelectorAll('.checklist-check').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var tid = this.getAttribute('data-tid');
          var tarea = tareas.find(function (t) { return t.id === tid; });
          if (!tarea) return;
          var newState = !tarea.completada;
          tarea.completada = newState; // Optimistic update
          btn.disabled = true;

          BNK_DB.tareas.update(evt.id, tid, { completada: newState }).then(function () {
            _updateEventoProgress(evt.id);
            _openEvento(evt.id);
          }).catch(function (err) {
            tarea.completada = !newState; // Revert
            BNKToast.error('Error al actualizar tarea: ' + (err && err.message ? err.message : 'desconocido'));
            _openEvento(evt.id);
          });
        });
      });
    }
  }

  function _updateEventoProgress(eventoId) {
    BNK_DB.tareas.list(eventoId).then(function (tareas) {
      var completadas = tareas.filter(function (t) { return t.completada; }).length;
      BNK_DB.eventos.update(eventoId, {
        tareasCompletadas: completadas,
        tareasTotal: tareas.length
      }).catch(function () {});

      // Update local cache
      var evtLocal = _eventos.find(function (e) { return e.id === eventoId; });
      if (evtLocal) {
        evtLocal.tareasCompletadas = completadas;
        evtLocal.tareasTotal = tareas.length;
      }

      // Si todo completado, confirmar antes de marcar como ejecutado
      if (completadas === tareas.length && tareas.length > 0) {
        var evt = _eventos.find(function (e) { return e.id === eventoId; });
        if (evt && evt.estado !== 'Ejecutado') {
          BNKConfirm.show('Todas las tareas completadas. ¿Marcar evento y cotización como "Ejecutado"?', 'MARCAR EJECUTADO').then(function (ok) {
            if (!ok) return;
            evt.estado = 'Ejecutado';
            if (evt.cotizacionId) {
              BNK_DB.cotizaciones.update(evt.cotizacionId, { estado: 'Ejecutado' }).catch(function (err) {
                BNKToast.error('Error al actualizar cotización: ' + (err && err.message ? err.message : 'desconocido'));
              });
            }
            BNK_DB.eventos.update(eventoId, { estado: 'Ejecutado' }).catch(function () {});
            BNKToast.ok('Evento marcado como Ejecutado.');
            _renderEventos();
          });
        }
      }

      _updateIndicators();
    }).catch(function () {});
  }

  // Función pública para crear evento desde pipeline
  function crearEvento(cotizacionId, cotizacionData) {
    var overlay = document.getElementById('evtPlantillaOverlay');
    if (!overlay) return;

    var list = document.getElementById('evtPlantillaList');
    var emptyEl = document.getElementById('evtPlantillaEmpty');

    // If plantillas not loaded yet, try loading
    if (_plantillas.length === 0) {
      if (list) list.innerHTML = '';
      if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = 'Cargando plantillas...'; }
      overlay.classList.add('visible');

      BNK_DB.plantillas.list().then(function (docs) {
        _plantillas = docs;
        if (emptyEl) emptyEl.style.display = 'none';
        _renderPlantillaList(list, cotizacionId, cotizacionData, overlay);
      }).catch(function () {
        if (emptyEl) { emptyEl.textContent = 'Error al cargar plantillas'; }
        BNKToast.error('Error al cargar plantillas.');
      });
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    _renderPlantillaList(list, cotizacionId, cotizacionData, overlay);
    overlay.classList.add('visible');
  }

  function _renderPlantillaList(list, cotizacionId, cotizacionData, overlay) {
    if (!list) return;

    var html = '';
    if (_plantillas.length === 0) {
      html = '<div style="text-align:center;color:var(--tx);padding:20px;font-size:12px">No hay plantillas disponibles</div>';
      list.innerHTML = html;
      return;
    }

    _plantillas.forEach(function (p) {
      html += '<div class="plantilla-option" data-pid="' + p.id + '">'
        + '<div class="plantilla-name">' + _esc(p.nombre) + '</div>'
        + '<div class="plantilla-count">' + (p.tareas ? p.tareas.length : 0) + ' tareas</div>'
        + '</div>';
    });
    list.innerHTML = html;

    var selectedPid = null;
    list.querySelectorAll('.plantilla-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        list.querySelectorAll('.plantilla-option').forEach(function (o) { o.classList.remove('selected'); });
        this.classList.add('selected');
        selectedPid = this.getAttribute('data-pid');
      });
    });

    var confirmBtn = document.getElementById('evtPlantillaConfirm');
    var closeBtn = document.getElementById('evtPlantillaClose');

    if (confirmBtn) confirmBtn.onclick = function () {
      if (!selectedPid) {
        BNKToast.warn('Selecciona una plantilla.');
        return;
      }
      var plantilla = _plantillas.find(function (p) { return p.id === selectedPid; });
      if (!plantilla) return;

      confirmBtn.disabled = true;
      confirmBtn.textContent = 'CREANDO...';

      var eventoData = {
        nombre: cotizacionData.evento || 'Evento',
        cliente: cotizacionData.cliente || '',
        folioCotizacion: cotizacionData.folio || '',
        cotizacionId: cotizacionId,
        fechaEvento: cotizacionData.fechaEvento || '',
        estado: 'En Producción',
        tareasTotal: plantilla.tareas ? plantilla.tareas.length : 0,
        tareasCompletadas: 0
      };

      BNK_DB.eventos.create(eventoData).then(function (evt) {
        if (plantilla.tareas && plantilla.tareas.length > 0) {
          var promises = plantilla.tareas.map(function (t) {
            return BNK_DB.tareas.add(evt.id, {
              descripcion: t.descripcion,
              orden: t.orden,
              completada: false,
              responsable: '',
              fechaLimite: ''
            });
          });
          return Promise.all(promises).then(function () {
            return evt;
          });
        }
        return evt;
      }).then(function () {
        overlay.classList.remove('visible');
        BNKToast.ok('Evento creado con ' + (plantilla.tareas ? plantilla.tareas.length : 0) + ' tareas.');
        // Refresh events list
        load();
      }).catch(function (err) {
        BNKToast.error('Error al crear evento: ' + (err && err.message ? err.message : 'desconocido'));
      }).finally(function () {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'CREAR EVENTO';
      });
    };

    if (closeBtn) closeBtn.onclick = function () {
      overlay.classList.remove('visible');
    };
  }

  function _parseFecha(f) {
    if (!f) return null;
    if (typeof f === 'object' && f.toDate) return f.toDate();
    var d = new Date(f);
    return isNaN(d.getTime()) ? null : d;
  }

  function _formatDate(d) {
    if (!d) return '';
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    return dd + '/' + mm + '/' + d.getFullYear();
  }

  function _formatFechaEvento(fecha) {
    if (!fecha) return '';
    var d = _parseFecha(fecha);
    if (!d) return String(fecha);
    return _formatDate(d);
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKEventos = { crearEvento: crearEvento, load: load };
})();
