// eventos.js — Módulo completo de Eventos / Producción
(function () {
  'use strict';

  var _eventos = [];
  var _plantillas = [];
  var _usuarios = [];
  var _currentEvento = null;
  var _loaded = false;
  var _viewMode = 'list'; // 'list' or 'checklist'
  var _dragSrcId = null;

  // ── Init ──
  function init() {
    _loadUsuarios();
    _loadPlantillas();
    _bindEvents();
    load();
  }

  // ── Carga de usuarios para dropdowns de responsable ──
  function _loadUsuarios() {
    BNK_DB.usuarios.list().then(function (docs) {
      _usuarios = docs;
    }).catch(function () {
      _usuarios = [];
    });
  }

  // ── Carga de plantillas ──
  function _loadPlantillas(cb) {
    BNK_DB.plantillas.list().then(function (docs) {
      _plantillas = docs;
      if (cb) cb();
    }).catch(function () {
      _plantillas = [];
      if (cb) cb();
    });
  }

  // ── Carga principal de eventos ──
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
          retryBtn.style.cssText = 'margin:16px auto 0;display:block';
          retryBtn.addEventListener('click', function () { load(); });
          container.appendChild(retryBtn);
        }
      }
    });
  }

  // ── Bind eventos globales ──
  function _bindEvents() {
    var searchEl = document.getElementById('evtSearch');
    if (searchEl) searchEl.addEventListener('input', function () {
      if (_viewMode === 'list') _renderList();
    });

    var estadoEl = document.getElementById('evtEstadoFiltro');
    if (estadoEl) estadoEl.addEventListener('change', function () {
      if (_viewMode === 'list') _renderList();
    });

    // Botón NUEVO EVENTO
    var btnNuevo = document.getElementById('evtBtnNuevo');
    if (btnNuevo) btnNuevo.addEventListener('click', function () {
      _openFormModal(null);
    });

    // Botón PLANTILLAS (admin only)
    var btnPlantillas = document.getElementById('evtBtnPlantillas');
    if (btnPlantillas) btnPlantillas.addEventListener('click', function () {
      _openPlantillasCrud();
    });

    // Modal crear/editar evento — cerrar
    var evtFormClose = document.getElementById('evtFormClose');
    if (evtFormClose) evtFormClose.addEventListener('click', function () { _closeFormModal(); });
    var evtFormCancel = document.getElementById('evtFormCancel');
    if (evtFormCancel) evtFormCancel.addEventListener('click', function () { _closeFormModal(); });
    var evtFormGuardar = document.getElementById('evtFormGuardar');
    if (evtFormGuardar) evtFormGuardar.addEventListener('click', function () { _submitFormModal(); });

    // Modal CRUD plantillas — cerrar
    var crudClose = document.getElementById('evtPlantillaCrudClose');
    if (crudClose) crudClose.addEventListener('click', function () {
      var overlay = document.getElementById('evtPlantillaCrudOverlay');
      if (overlay) overlay.classList.remove('visible');
    });

    // Botón nueva plantilla
    var btnNuevaPlantilla = document.getElementById('evtPlantillaCrudNueva');
    if (btnNuevaPlantilla) btnNuevaPlantilla.addEventListener('click', function () {
      _openPlantillaEditor(null);
    });

    // Escape key para cerrar modales
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        ['evtPlantillaOverlay', 'evtFormOverlay', 'evtPlantillaCrudOverlay'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el && el.classList.contains('visible')) {
            e.preventDefault();
            el.classList.remove('visible');
          }
        });
      }
    });
  }

  // ── Filtros ──
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

  // ── Indicadores KPI ──
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

  // ── Vista lista de eventos ──
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

    var isAdmin = BNK_AUTH.currentRole() === 'admin';
    var canEdit = BNK_AUTH.canEdit('eventos') || BNK_AUTH.currentRole() === 'produccion';

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
        + (canEdit ? '<button class="evento-card-edit" data-edit-eid="' + evt.id + '" aria-label="Editar evento">EDITAR</button>' : '')
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

    // Bind click en tarjeta (abre checklist)
    container.querySelectorAll('.evento-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        // No abrir si se hizo clic en el botón editar
        if (e.target.hasAttribute('data-edit-eid') || e.target.closest('[data-edit-eid]')) return;
        var eid = this.getAttribute('data-eid');
        _openEvento(eid);
      });
    });

    // Bind botón editar
    container.querySelectorAll('[data-edit-eid]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var eid = this.getAttribute('data-edit-eid');
        var evt = _eventos.find(function (ev) { return ev.id === eid; });
        if (evt) _openFormModal(evt);
      });
    });
  }

  // ── Modal crear/editar evento ──
  function _openFormModal(evt) {
    var overlay = document.getElementById('evtFormOverlay');
    var title = document.getElementById('evtFormTitle');
    var plantillaWrap = document.getElementById('evtFormPlantillaWrap');
    var estadoWrap = document.getElementById('evtFormEstadoWrap');
    var plantillaSelect = document.getElementById('evtFormPlantilla');

    if (!overlay) return;

    if (evt) {
      // Modo edición
      if (title) title.textContent = 'EDITAR EVENTO';
      document.getElementById('evtFormId').value = evt.id;
      document.getElementById('evtFormNombre').value = evt.nombre || evt.evento || '';
      document.getElementById('evtFormCliente').value = evt.cliente || '';
      document.getElementById('evtFormFecha').value = _toDateInput(evt.fechaEvento);
      document.getElementById('evtFormFolio').value = evt.folioCotizacion || '';
      document.getElementById('evtFormCotId').value = evt.cotizacionId || '';
      if (plantillaWrap) plantillaWrap.style.display = 'none'; // ocultar plantilla en edición
      if (estadoWrap) estadoWrap.style.display = '';
      var estadoSel = document.getElementById('evtFormEstado');
      if (estadoSel) estadoSel.value = evt.estado || 'En Producción';
    } else {
      // Modo crear
      if (title) title.textContent = 'NUEVO EVENTO';
      document.getElementById('evtFormId').value = '';
      document.getElementById('evtFormNombre').value = '';
      document.getElementById('evtFormCliente').value = '';
      document.getElementById('evtFormFecha').value = '';
      document.getElementById('evtFormFolio').value = '';
      document.getElementById('evtFormCotId').value = '';
      if (plantillaWrap) plantillaWrap.style.display = '';
      if (estadoWrap) estadoWrap.style.display = 'none';

      // Poblar select de plantillas
      if (plantillaSelect) {
        var options = '<option value="">Sin plantilla (evento vacío)</option>';
        _plantillas.forEach(function (p) {
          options += '<option value="' + p.id + '">' + _esc(p.nombre) + ' (' + (p.tareas ? p.tareas.length : 0) + ' tareas)</option>';
        });
        plantillaSelect.innerHTML = options;
      }
    }

    overlay.classList.add('visible');
  }

  function _closeFormModal() {
    var overlay = document.getElementById('evtFormOverlay');
    if (overlay) overlay.classList.remove('visible');
  }

  function _submitFormModal() {
    var evtId = document.getElementById('evtFormId').value.trim();
    var nombre = document.getElementById('evtFormNombre').value.trim();
    var cliente = document.getElementById('evtFormCliente').value.trim();
    var fecha = document.getElementById('evtFormFecha').value;
    var folio = document.getElementById('evtFormFolio').value.trim();
    var cotId = document.getElementById('evtFormCotId').value.trim();

    if (!nombre) {
      BNKToast.warn('El nombre del evento es obligatorio.');
      return;
    }

    var btn = document.getElementById('evtFormGuardar');
    if (btn) { btn.disabled = true; btn.textContent = 'GUARDANDO...'; }

    var _done = function () {
      if (btn) { btn.disabled = false; btn.textContent = 'GUARDAR'; }
    };

    if (evtId) {
      // Editar evento existente
      var estado = document.getElementById('evtFormEstado').value;
      var updateData = {
        nombre: nombre,
        cliente: cliente,
        fechaEvento: fecha,
        folioCotizacion: folio,
        estado: estado
      };
      if (cotId) updateData.cotizacionId = cotId;

      BNK_DB.eventos.update(evtId, updateData).then(function () {
        // Actualizar cache local
        var evtLocal = _eventos.find(function (e) { return e.id === evtId; });
        if (evtLocal) {
          evtLocal.nombre = nombre;
          evtLocal.cliente = cliente;
          evtLocal.fechaEvento = fecha;
          evtLocal.folioCotizacion = folio;
          evtLocal.estado = estado;
        }
        BNK_DB.logActividad({ tipo: 'editar', entidad: 'evento', entidadId: evtId, referencia: nombre, detalle: 'Evento actualizado' });
        BNKToast.ok('Evento actualizado.');
        _closeFormModal();
        _renderList();
        _updateIndicators();
        _done();
      }).catch(function (err) {
        BNKToast.error('Error al actualizar: ' + (err && err.message ? err.message : 'desconocido'));
        _done();
      });

    } else {
      // Crear nuevo evento
      var plantillaId = document.getElementById('evtFormPlantilla').value;
      var plantilla = plantillaId ? _plantillas.find(function (p) { return p.id === plantillaId; }) : null;
      var numTareas = plantilla && plantilla.tareas ? plantilla.tareas.length : 0;

      var eventoData = {
        nombre: nombre,
        cliente: cliente,
        fechaEvento: fecha,
        folioCotizacion: folio,
        estado: 'En Producción',
        tareasTotal: numTareas,
        tareasCompletadas: 0
      };
      if (cotId) eventoData.cotizacionId = cotId;

      BNK_DB.eventos.create(eventoData).then(function (newEvt) {
        var promises = [];
        if (plantilla && plantilla.tareas && plantilla.tareas.length > 0) {
          plantilla.tareas.forEach(function (t) {
            promises.push(BNK_DB.tareas.add(newEvt.id, {
              descripcion: t.descripcion,
              orden: t.orden,
              completada: false,
              responsable: '',
              responsableNombre: '',
              fechaLimite: ''
            }));
          });
        }
        return Promise.all(promises).then(function () { return newEvt; });
      }).then(function (newEvt) {
        BNK_DB.logActividad({ tipo: 'evento_creado', entidad: 'evento', entidadId: newEvt.id, referencia: nombre, detalle: 'Evento creado' + (plantilla ? ' desde plantilla ' + plantilla.nombre : '') });
        BNKToast.ok('Evento creado' + (plantilla ? ' con ' + plantilla.tareas.length + ' tareas.' : '.'));
        _closeFormModal();
        load();
        _done();
      }).catch(function (err) {
        BNKToast.error('Error al crear evento: ' + (err && err.message ? err.message : 'desconocido'));
        _done();
      });
    }
  }

  // ── Abrir vista checklist de un evento ──
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

  // ── Render checklist ──
  function _renderChecklist(evt, tareas) {
    var container = document.getElementById('eventosListContainer');
    var toolbar = document.getElementById('evtToolbar');
    if (!container) return;

    _viewMode = 'checklist';
    if (toolbar) toolbar.style.display = 'none';

    var rol = BNK_AUTH.currentRole();
    var canEdit = rol === 'admin' || rol === 'ventas' || rol === 'produccion';
    var isAdmin = rol === 'admin';

    var fechaStr = _formatFechaEvento(evt.fechaEvento);
    var estadoClass = evt.estado === 'Ejecutado' ? 'estado-Ejecutado' : 'estado-EnProd';

    // Ordenar tareas por 'orden'
    var sorted = tareas.slice().sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

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

    html += '<div class="checklist" id="evtChecklistContainer">';
    if (sorted.length === 0) {
      html += '<div class="dash-empty" style="border:none"><div class="dash-empty-icon">&#128203;</div><div class="dash-empty-text">Sin tareas en este evento</div></div>';
    } else {
      sorted.forEach(function (t) {
        var checked = t.completada ? 'checked' : '';
        var completedClass = t.completada ? 'completed' : '';
        var fechaLimDate = _parseFecha(t.fechaLimite);
        var isOverdue = fechaLimDate && !t.completada && fechaLimDate < hoy;
        var overdueClass = isOverdue ? ' checklist-item--overdue' : '';
        var fechaLimVal = t.fechaLimite && typeof t.fechaLimite === 'string' ? t.fechaLimite : (fechaLimDate ? _toIsoDate(fechaLimDate) : '');

        // Responsable: dropdown o texto estático
        var responsableHtml = '';
        if (canEdit) {
          responsableHtml = '<span class="checklist-responsable"><select data-tfield="responsable" data-tid="' + t.id + '">'
            + '<option value="">Sin asignar</option>';
          _usuarios.forEach(function (u) {
            var sel = (t.responsable === u.id || t.responsableNombre === u.nombre) ? ' selected' : '';
            responsableHtml += '<option value="' + u.id + '"' + sel + '>' + _esc(u.nombre) + '</option>';
          });
          responsableHtml += '</select></span>';
        } else {
          responsableHtml = '<span class="checklist-responsable">' + _esc(t.responsableNombre || t.responsable || 'Sin asignar') + '</span>';
        }

        // Fecha límite: input o texto
        var fechaHtml = '';
        if (canEdit) {
          fechaHtml = '<span class="checklist-fecha"><input type="date" data-tfield="fechaLimite" data-tid="' + t.id + '" value="' + _esc(fechaLimVal) + '"></span>';
        } else {
          fechaHtml = '<span class="checklist-fecha">' + _esc(_formatFechaEvento(t.fechaLimite)) + '</span>';
        }

        // Botón eliminar (solo admin)
        var deleteHtml = isAdmin
          ? '<button class="checklist-delete" data-del-tid="' + t.id + '" aria-label="Eliminar tarea" title="Eliminar tarea">&times;</button>'
          : '';

        html += '<div class="checklist-item ' + completedClass + overdueClass + '" data-tid="' + t.id + '" draggable="' + (canEdit ? 'true' : 'false') + '">'
          + '<button class="checklist-check ' + checked + '" data-tid="' + t.id + '"' + (canEdit ? '' : ' disabled')
          + ' aria-label="' + (t.completada ? 'Desmarcar' : 'Completar') + ': ' + _esc(t.descripcion) + '"'
          + ' aria-pressed="' + (t.completada ? 'true' : 'false') + '">'
          + (t.completada ? '&#10003;' : '') + '</button>'
          + '<span class="checklist-desc">' + _esc(t.descripcion) + '</span>'
          + responsableHtml
          + fechaHtml
          + deleteHtml
          + '</div>';
      });
    }

    // Botón + TAREA
    if (canEdit) {
      html += '<div class="evt-add-task" id="evtAddTaskRow">'
        + '<input type="text" class="bnk-input" id="evtNewTaskInput" placeholder="Nueva tarea...">'
        + '<div class="evt-add-task-actions">'
        + '<button class="panel-btn-primary" id="evtAddTaskConfirm">+ AGREGAR</button>'
        + '</div>'
        + '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // ── Volver ──
    var volverBtn = document.getElementById('btnVolverEventos');
    if (volverBtn) volverBtn.addEventListener('click', function () { _renderList(); });

    // ── Checkbox clicks ──
    if (canEdit) {
      container.querySelectorAll('.checklist-check').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var tid = this.getAttribute('data-tid');
          var tarea = sorted.find(function (t) { return t.id === tid; });
          if (!tarea) return;
          var newState = !tarea.completada;
          tarea.completada = newState;
          btn.disabled = true;

          BNK_DB.tareas.update(evt.id, tid, { completada: newState }).then(function () {
            if (newState) {
              BNK_DB.logActividad({ tipo: 'tarea_completada', entidad: 'evento', entidadId: evt.id, referencia: evt.folioCotizacion || evt.nombre, detalle: 'Tarea completada en ' + evt.nombre });
            }
            _updateEventoProgress(evt.id);
            BNK_DB.tareas.list(evt.id).then(function (t2) { _renderChecklist(evt, t2); });
          }).catch(function (err) {
            tarea.completada = !newState;
            BNKToast.error('Error al actualizar tarea: ' + (err && err.message ? err.message : 'desconocido'));
            BNK_DB.tareas.list(evt.id).then(function (t2) { _renderChecklist(evt, t2); });
          });
        });
      });

      // ── Select responsable ──
      container.querySelectorAll('select[data-tfield="responsable"]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var tid = this.getAttribute('data-tid');
          var uid = this.value;
          var uNombre = '';
          if (uid) {
            var uObj = _usuarios.find(function (u) { return u.id === uid; });
            if (uObj) uNombre = uObj.nombre;
          }
          BNK_DB.tareas.update(evt.id, tid, { responsable: uid, responsableNombre: uNombre }).catch(function (err) {
            BNKToast.error('Error al asignar responsable: ' + (err && err.message ? err.message : 'desconocido'));
          });
        });
      });

      // ── Input fecha límite ──
      container.querySelectorAll('input[data-tfield="fechaLimite"]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var tid = this.getAttribute('data-tid');
          BNK_DB.tareas.update(evt.id, tid, { fechaLimite: this.value }).then(function () {
            // Re-renderizar para actualizar overdue styling
            BNK_DB.tareas.list(evt.id).then(function (t2) { _renderChecklist(evt, t2); });
          }).catch(function (err) {
            BNKToast.error('Error al actualizar fecha: ' + (err && err.message ? err.message : 'desconocido'));
          });
        });
      });

      // ── + TAREA ──
      var addTaskConfirm = document.getElementById('evtAddTaskConfirm');
      var newTaskInput = document.getElementById('evtNewTaskInput');
      if (addTaskConfirm && newTaskInput) {
        addTaskConfirm.addEventListener('click', function () { _addTarea(evt, sorted, newTaskInput); });
        newTaskInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') _addTarea(evt, sorted, newTaskInput);
        });
      }

      // ── Drag & Drop ──
      _bindDragDrop(container, evt, sorted);
    }

    // ── Delete tarea (admin) ──
    if (isAdmin) {
      container.querySelectorAll('[data-del-tid]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var tid = this.getAttribute('data-del-tid');
          var tarea = sorted.find(function (t) { return t.id === tid; });
          var desc = tarea ? tarea.descripcion : 'esta tarea';
          BNKConfirm.show('¿Eliminar "' + desc + '"?', 'ELIMINAR').then(function (ok) {
            if (!ok) return;
            BNK_DB.tareas.delete(evt.id, tid).then(function () {
              BNKToast.ok('Tarea eliminada.');
              _updateEventoProgress(evt.id);
              BNK_DB.tareas.list(evt.id).then(function (t2) { _renderChecklist(evt, t2); });
            }).catch(function (err) {
              BNKToast.error('Error al eliminar: ' + (err && err.message ? err.message : 'desconocido'));
            });
          });
        });
      });
    }
  }

  // ── Agregar tarea inline ──
  function _addTarea(evt, sorted, inputEl) {
    var desc = inputEl.value.trim();
    if (!desc) { BNKToast.warn('Escribe una descripción para la tarea.'); return; }

    var maxOrden = sorted.reduce(function (max, t) { return Math.max(max, t.orden || 0); }, 0);
    var btn = document.getElementById('evtAddTaskConfirm');
    if (btn) { btn.disabled = true; btn.textContent = 'AGREGANDO...'; }

    BNK_DB.tareas.add(evt.id, {
      descripcion: desc,
      orden: maxOrden + 1,
      completada: false,
      responsable: '',
      responsableNombre: '',
      fechaLimite: ''
    }).then(function () {
      _updateEventoProgress(evt.id);
      BNKToast.ok('Tarea agregada.');
      BNK_DB.tareas.list(evt.id).then(function (t2) { _renderChecklist(evt, t2); });
    }).catch(function (err) {
      BNKToast.error('Error al agregar tarea: ' + (err && err.message ? err.message : 'desconocido'));
      if (btn) { btn.disabled = false; btn.textContent = '+ AGREGAR'; }
    });
  }

  // ── Drag & Drop para reordenar tareas ──
  function _bindDragDrop(container, evt, sorted) {
    var items = container.querySelectorAll('.checklist-item[draggable="true"]');
    items.forEach(function (item) {
      item.addEventListener('dragstart', function (e) {
        _dragSrcId = this.getAttribute('data-tid');
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', function () {
        this.classList.remove('dragging');
        container.querySelectorAll('.checklist-item').forEach(function (i) {
          i.classList.remove('drag-over');
        });
      });
      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        container.querySelectorAll('.checklist-item').forEach(function (i) {
          i.classList.remove('drag-over');
        });
        if (this.getAttribute('data-tid') !== _dragSrcId) {
          this.classList.add('drag-over');
        }
      });
      item.addEventListener('drop', function (e) {
        e.preventDefault();
        var targetId = this.getAttribute('data-tid');
        if (!_dragSrcId || _dragSrcId === targetId) return;

        // Recalcular órdenes
        var srcIndex = sorted.findIndex(function (t) { return t.id === _dragSrcId; });
        var tgtIndex = sorted.findIndex(function (t) { return t.id === targetId; });
        if (srcIndex === -1 || tgtIndex === -1) return;

        // Mover elemento en el array
        var reordered = sorted.slice();
        var moved = reordered.splice(srcIndex, 1)[0];
        reordered.splice(tgtIndex, 0, moved);

        // Actualizar orden en Firestore (batch de updates)
        var updates = reordered.map(function (t, idx) {
          return BNK_DB.tareas.update(evt.id, t.id, { orden: idx });
        });
        Promise.all(updates).then(function () {
          BNK_DB.tareas.list(evt.id).then(function (t2) { _renderChecklist(evt, t2); });
        }).catch(function (err) {
          BNKToast.error('Error al reordenar: ' + (err && err.message ? err.message : 'desconocido'));
        });
        _dragSrcId = null;
      });
    });
  }

  // ── Progreso del evento ──
  function _updateEventoProgress(eventoId) {
    BNK_DB.tareas.list(eventoId).then(function (tareas) {
      var completadas = tareas.filter(function (t) { return t.completada; }).length;
      BNK_DB.eventos.update(eventoId, {
        tareasCompletadas: completadas,
        tareasTotal: tareas.length
      }).catch(function () {});

      var evtLocal = _eventos.find(function (e) { return e.id === eventoId; });
      if (evtLocal) {
        evtLocal.tareasCompletadas = completadas;
        evtLocal.tareasTotal = tareas.length;
      }

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
            _renderList();
          });
        }
      }

      _updateIndicators();
    }).catch(function () {});
  }

  // ── CRUD Plantillas ──
  function _openPlantillasCrud() {
    var overlay = document.getElementById('evtPlantillaCrudOverlay');
    if (!overlay) return;
    _renderPlantillasCrudList();
    overlay.classList.add('visible');
  }

  function _renderPlantillasCrudList() {
    var listEl = document.getElementById('evtPlantillaCrudList');
    if (!listEl) return;

    if (_plantillas.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--tx);padding:20px;font-size:12px">No hay plantillas. Crea la primera.</div>';
      return;
    }

    var html = '';
    _plantillas.forEach(function (p) {
      html += '<div class="plantilla-crud-item" data-pid="' + p.id + '">'
        + '<span class="plantilla-crud-name">' + _esc(p.nombre) + '</span>'
        + '<span class="plantilla-crud-count">' + (p.tareas ? p.tareas.length : 0) + ' tareas</span>'
        + '<div class="plantilla-crud-actions">'
        + '<button class="panel-btn-secondary" data-edit-pid="' + p.id + '">EDITAR</button>'
        + '<button class="panel-btn-secondary" data-del-pid="' + p.id + '" style="color:var(--red)">ELIMINAR</button>'
        + '</div>'
        + '</div>';
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll('[data-edit-pid]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pid = this.getAttribute('data-edit-pid');
        var plantilla = _plantillas.find(function (p) { return p.id === pid; });
        if (plantilla) _openPlantillaEditor(plantilla);
      });
    });

    listEl.querySelectorAll('[data-del-pid]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pid = this.getAttribute('data-del-pid');
        var plantilla = _plantillas.find(function (p) { return p.id === pid; });
        var nombre = plantilla ? plantilla.nombre : 'esta plantilla';
        BNKConfirm.show('¿Eliminar plantilla "' + nombre + '"? Esta acción no se puede deshacer.', 'ELIMINAR').then(function (ok) {
          if (!ok) return;
          BNK_DB.plantillas.delete(pid).then(function () {
            BNKToast.ok('Plantilla eliminada.');
            _loadPlantillas(function () { _renderPlantillasCrudList(); });
          }).catch(function (err) {
            BNKToast.error('Error al eliminar: ' + (err && err.message ? err.message : 'desconocido'));
          });
        });
      });
    });
  }

  // ── Editor inline de plantilla (en el modal CRUD) ──
  function _openPlantillaEditor(plantilla) {
    var listEl = document.getElementById('evtPlantillaCrudList');
    if (!listEl) return;

    var isNew = !plantilla;
    var nombre = plantilla ? plantilla.nombre : '';
    var tareas = plantilla && plantilla.tareas ? plantilla.tareas.slice() : [];

    var tareaInputsHtml = '';
    tareas.forEach(function (t, idx) {
      tareaInputsHtml += '<div class="plantilla-task-item" data-tidx="' + idx + '">'
        + '<input type="text" class="bnk-input plantilla-task-input" value="' + _esc(t.descripcion) + '" data-tidx="' + idx + '">'
        + '<button class="checklist-delete" data-rm-tidx="' + idx + '">&times;</button>'
        + '</div>';
    });

    var editorHtml = '<div id="evtPlantillaEditor">'
      + '<div class="bnk-form-group"><label class="bnk-label">NOMBRE DE LA PLANTILLA</label>'
      + '<input type="text" id="evtPlantillaEditorNombre" class="bnk-input" value="' + _esc(nombre) + '"></div>'
      + '<div class="bnk-label" style="margin:12px 0 4px">TAREAS</div>'
      + '<div class="plantilla-task-list" id="evtPlantillaEditorTareas">' + tareaInputsHtml + '</div>'
      + '<div style="display:flex;gap:8px;margin:8px 0 16px">'
      + '<input type="text" id="evtPlantillaNewTarea" class="bnk-input" placeholder="Nueva tarea...">'
      + '<button class="panel-btn-secondary" id="evtPlantillaAddTarea">+ AGREGAR</button>'
      + '</div>'
      + '<div style="display:flex;gap:8px">'
      + '<button class="panel-btn-secondary" id="evtPlantillaEditorCancel">CANCELAR</button>'
      + '<button class="panel-btn-primary" id="evtPlantillaEditorGuardar">GUARDAR PLANTILLA</button>'
      + '</div>'
      + '</div>';

    listEl.innerHTML = editorHtml;
    document.getElementById('evtPlantillaCrudNueva').style.display = 'none';

    // Agregar tarea al editor
    document.getElementById('evtPlantillaAddTarea').addEventListener('click', function () {
      var inp = document.getElementById('evtPlantillaNewTarea');
      var desc = inp.value.trim();
      if (!desc) return;
      tareas.push({ descripcion: desc, orden: tareas.length });
      inp.value = '';
      _refreshEditorTareasList(tareas);
    });
    document.getElementById('evtPlantillaNewTarea').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { document.getElementById('evtPlantillaAddTarea').click(); }
    });

    // Cancelar
    document.getElementById('evtPlantillaEditorCancel').addEventListener('click', function () {
      document.getElementById('evtPlantillaCrudNueva').style.display = '';
      _renderPlantillasCrudList();
    });

    // Guardar
    document.getElementById('evtPlantillaEditorGuardar').addEventListener('click', function () {
      var newNombre = document.getElementById('evtPlantillaEditorNombre').value.trim();
      if (!newNombre) { BNKToast.warn('El nombre es obligatorio.'); return; }

      // Recoger tareas del DOM actualizado
      var tareasFinales = [];
      document.querySelectorAll('.plantilla-task-input').forEach(function (inp, idx) {
        var val = inp.value.trim();
        if (val) tareasFinales.push({ descripcion: val, orden: idx });
      });

      var btn = document.getElementById('evtPlantillaEditorGuardar');
      if (btn) { btn.disabled = true; btn.textContent = 'GUARDANDO...'; }

      var data = { nombre: newNombre, tareas: tareasFinales };
      var promise = isNew
        ? BNK_DB.plantillas.create(data)
        : BNK_DB.plantillas.update(plantilla.id, data);

      promise.then(function () {
        BNKToast.ok(isNew ? 'Plantilla creada.' : 'Plantilla actualizada.');
        document.getElementById('evtPlantillaCrudNueva').style.display = '';
        _loadPlantillas(function () { _renderPlantillasCrudList(); });
      }).catch(function (err) {
        BNKToast.error('Error: ' + (err && err.message ? err.message : 'desconocido'));
        if (btn) { btn.disabled = false; btn.textContent = 'GUARDAR PLANTILLA'; }
      });
    });

    _refreshEditorTareasList(tareas);
  }

  function _refreshEditorTareasList(tareas) {
    var container = document.getElementById('evtPlantillaEditorTareas');
    if (!container) return;
    var html = '';
    tareas.forEach(function (t, idx) {
      html += '<div class="plantilla-task-item" data-tidx="' + idx + '">'
        + '<input type="text" class="bnk-input plantilla-task-input" value="' + _esc(t.descripcion) + '" data-tidx="' + idx + '">'
        + '<button class="checklist-delete" data-rm-tidx="' + idx + '">&times;</button>'
        + '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('[data-rm-tidx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-rm-tidx'), 10);
        // Leer estado actual de inputs antes de eliminar
        var updatedTareas = [];
        container.querySelectorAll('.plantilla-task-input').forEach(function (inp, i) {
          if (i !== idx) updatedTareas.push({ descripcion: inp.value.trim(), orden: updatedTareas.length });
        });
        tareas.length = 0;
        updatedTareas.forEach(function (t) { tareas.push(t); });
        _refreshEditorTareasList(tareas);
      });
    });
  }

  // ── Función pública para crear evento desde pipeline ──
  function crearEvento(cotizacionId, cotizacionData) {
    var overlay = document.getElementById('evtPlantillaOverlay');
    if (!overlay) return;

    var list = document.getElementById('evtPlantillaList');
    var emptyEl = document.getElementById('evtPlantillaEmpty');

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

    if (_plantillas.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--tx);padding:20px;font-size:12px">No hay plantillas disponibles</div>';
      return;
    }

    var html = '';
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
              responsableNombre: '',
              fechaLimite: ''
            });
          });
          return Promise.all(promises).then(function () { return evt; });
        }
        return evt;
      }).then(function (newEvt) {
        BNK_DB.logActividad({ tipo: 'evento_creado', entidad: 'evento', entidadId: newEvt.id, referencia: eventoData.nombre, detalle: 'Evento creado desde pipeline con plantilla ' + plantilla.nombre });
        overlay.classList.remove('visible');
        BNKToast.ok('Evento creado con ' + (plantilla.tareas ? plantilla.tareas.length : 0) + ' tareas.');
        load();
      }).catch(function (err) {
        BNKToast.error('Error al crear evento: ' + (err && err.message ? err.message : 'desconocido'));
      }).finally(function () {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'CREAR EVENTO';
      });
    };

    if (closeBtn) closeBtn.onclick = function () { overlay.classList.remove('visible'); };
  }

  // ── Helpers de fecha ──
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

  function _toDateInput(fecha) {
    if (!fecha) return '';
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
    var d = _parseFecha(fecha);
    if (!d) return '';
    return _toIsoDate(d);
  }

  function _toIsoDate(d) {
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  // ── XSS prevention ──
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ── Bootstrap ──
  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKEventos = { crearEvento: crearEvento, load: load };
})();
