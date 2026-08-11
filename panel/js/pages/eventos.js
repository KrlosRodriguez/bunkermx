// eventos.js — Ficha de evento y checklist de producción
(function () {
  'use strict';

  var _eventos = [];
  var _plantillas = [];
  var _usuarios = [];
  var _currentEvento = null;

  function init() {
    BNK_DB.eventos.list().then(function (docs) {
      _eventos = docs;
      _renderList();
    });
    BNK_DB.plantillas.list().then(function (docs) {
      _plantillas = docs;
    });
    BNK_DB.usuarios.list().then(function (docs) {
      _usuarios = docs;
    });
  }

  function _renderList() {
    var container = document.getElementById('eventosListContainer');
    if (!container) return;

    if (_eventos.length === 0) {
      container.innerHTML = '<div class="dash-empty"><div class="dash-empty-icon">&#128197;</div><div class="dash-empty-text">Sin eventos registrados</div></div>';
      return;
    }

    var html = '';
    _eventos.forEach(function (evt) {
      var progreso = evt.tareasTotal > 0 ? Math.round((evt.tareasCompletadas / evt.tareasTotal) * 100) : 0;
      html += '<div class="evento-card" data-eid="' + evt.id + '">'
        + '<div class="evento-card-header">'
        + '<span class="evento-card-title">' + _esc(evt.nombre || evt.evento || 'Evento') + '</span>'
        + '<span class="evento-card-date">' + _esc(evt.fechaEvento || '') + '</span>'
        + '</div>'
        + '<div class="evento-card-info">'
        + '<span>Cliente: ' + _esc(evt.cliente || '') + '</span>'
        + '<span>Folio: ' + _esc(evt.folioCotizacion || '') + '</span>'
        + '</div>'
        + '<div class="evento-progress"><div class="evento-progress-fill" style="width:' + progreso + '%"></div></div>'
        + '<div class="evento-progress-text">' + progreso + '% completado</div>'
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

    // Load tasks
    BNK_DB.tareas.list(eventoId).then(function (tareas) {
      _renderChecklist(evt, tareas);
    });
  }

  function _renderChecklist(evt, tareas) {
    var container = document.getElementById('eventosListContainer');
    if (!container) return;

    var html = '<div class="panel-toolbar">'
      + '<button class="panel-btn-secondary" id="btnVolverEventos">&larr; VOLVER</button>'
      + '<h2 class="panel-section-title">' + _esc(evt.nombre || evt.evento || 'EVENTO') + '</h2>'
      + '</div>'
      + '<div style="padding:0 30px 12px;color:var(--tx);font-size:13px">'
      + 'Cliente: ' + _esc(evt.cliente) + ' | Fecha: ' + _esc(evt.fechaEvento) + ' | Folio: ' + _esc(evt.folioCotizacion)
      + '</div>'
      + '<div class="checklist">';

    tareas.forEach(function (t) {
      var checked = t.completada ? 'checked' : '';
      var completed = t.completada ? 'completed' : '';
      html += '<div class="checklist-item ' + completed + '" data-tid="' + t.id + '">'
        + '<button class="checklist-check ' + checked + '" data-tid="' + t.id + '">' + (t.completada ? '&#10003;' : '') + '</button>'
        + '<span class="checklist-desc">' + _esc(t.descripcion) + '</span>'
        + '<span class="checklist-responsable">' + _esc(t.responsable || 'Sin asignar') + '</span>'
        + '<span class="checklist-fecha">' + _esc(t.fechaLimite || '') + '</span>'
        + '</div>';
    });

    html += '</div>';
    container.innerHTML = html;

    // Back button
    document.getElementById('btnVolverEventos').addEventListener('click', function () {
      _renderList();
    });

    // Checkbox clicks
    container.querySelectorAll('.checklist-check').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tid = this.getAttribute('data-tid');
        var tarea = tareas.find(function (t) { return t.id === tid; });
        if (!tarea) return;
        var newState = !tarea.completada;
        BNK_DB.tareas.update(evt.id, tid, { completada: newState }).then(function () {
          _openEvento(evt.id);
          _updateEventoProgress(evt.id, tareas.length);
        });
      });
    });
  }

  function _updateEventoProgress(eventoId, totalTareas) {
    BNK_DB.tareas.list(eventoId).then(function (tareas) {
      var completadas = tareas.filter(function (t) { return t.completada; }).length;
      BNK_DB.eventos.update(eventoId, {
        tareasCompletadas: completadas,
        tareasTotal: tareas.length
      });

      // Si todo completado, marcar como ejecutado
      if (completadas === tareas.length && tareas.length > 0) {
        var evt = _eventos.find(function (e) { return e.id === eventoId; });
        if (evt && evt.cotizacionId) {
          BNK_DB.cotizaciones.update(evt.cotizacionId, { estado: 'Ejecutado' });
        }
      }
    });
  }

  // Función pública para crear evento desde pipeline
  function crearEvento(cotizacionId, cotizacionData) {
    var overlay = document.getElementById('evtPlantillaOverlay');
    if (!overlay) return;

    var list = document.getElementById('evtPlantillaList');
    var html = '';
    _plantillas.forEach(function (p) {
      html += '<div class="plantilla-option" data-pid="' + p.id + '">'
        + '<div class="plantilla-name">' + _esc(p.nombre) + '</div>'
        + '<div class="plantilla-count">' + (p.tareas ? p.tareas.length : 0) + ' tareas</div>'
        + '</div>';
    });
    list.innerHTML = html;

    overlay.classList.add('visible');

    var selectedPid = null;
    list.querySelectorAll('.plantilla-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        list.querySelectorAll('.plantilla-option').forEach(function (o) { o.classList.remove('selected'); });
        this.classList.add('selected');
        selectedPid = this.getAttribute('data-pid');
      });
    });

    document.getElementById('evtPlantillaConfirm').onclick = function () {
      if (!selectedPid) return;
      var plantilla = _plantillas.find(function (p) { return p.id === selectedPid; });
      if (!plantilla) return;

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
        if (plantilla.tareas) {
          plantilla.tareas.forEach(function (t) {
            BNK_DB.tareas.add(evt.id, {
              descripcion: t.descripcion,
              orden: t.orden,
              completada: false,
              responsable: '',
              fechaLimite: ''
            });
          });
        }
        overlay.classList.remove('visible');
        if (window.BNKToast) BNKToast.ok('Evento creado con ' + (plantilla.tareas ? plantilla.tareas.length : 0) + ' tareas.');
      });
    };

    document.getElementById('evtPlantillaClose').onclick = function () {
      overlay.classList.remove('visible');
    };
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKEventos = { crearEvento: crearEvento };
})();
