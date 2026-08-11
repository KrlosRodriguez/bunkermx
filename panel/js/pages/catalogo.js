// catalogo.js — Catálogo de precios editable
(function () {
  'use strict';

  var _data = [];
  var _editingId = null;

  function init() {
    if (!BNK_AUTH.canEdit('catalogo') && !BNK_AUTH.canView('catalogo')) return;
    _bindEvents();
    load();
  }

  function load() {
    BNK_DB.catalogo.list().then(function (docs) {
      _data = docs;
      _render();
    });
  }

  function _render() {
    var tbody = document.getElementById('catBody');
    if (!tbody) return;

    var search = (document.getElementById('catSearch') || {}).value || '';
    search = search.trim().toLowerCase();

    var filtered = _data;
    if (search) {
      filtered = _data.filter(function (d) {
        return [d.categoria, d.concepto, d.unidad].join(' ').toLowerCase().indexOf(search) !== -1;
      });
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--tx);padding:40px">Sin conceptos</td></tr>';
      return;
    }

    var html = '';
    filtered.forEach(function (d) {
      var activo = d.activo !== false;
      var estadoClass = activo ? 'estado-Nueva' : 'estado-Cancelada';
      html += '<tr>'
        + '<td><span class="tipo-badge">' + _esc(d.categoria || '') + '</span></td>'
        + '<td>' + _esc(d.concepto || '') + '</td>'
        + '<td style="color:var(--tx)">' + _esc(d.unidad || '') + '</td>'
        + '<td class="col-total">' + _formatMXN(d.precio) + '</td>'
        + '<td><span class="estado-badge ' + estadoClass + '">' + (activo ? 'Activo' : 'Inactivo') + '</span></td>'
        + '<td>'
        + '<button class="tbl-action tbl-action--edit" data-cid="' + d.id + '" title="Editar">&#9998;</button>'
        + '<button class="tbl-action" data-cid="' + d.id + '" data-toggle-cat title="Activar/Desactivar">&#9679;</button>'
        + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
  }

  function _bindEvents() {
    var searchEl = document.getElementById('catSearch');
    if (searchEl) searchEl.addEventListener('input', _render);

    document.getElementById('btnNuevoConcepto').addEventListener('click', function () {
      _openModal('crear');
    });

    document.getElementById('catClose').addEventListener('click', _closeModal);
    document.getElementById('catCancel').addEventListener('click', _closeModal);
    document.getElementById('catOverlay').addEventListener('click', function (e) {
      if (e.target === this) _closeModal();
    });
    document.getElementById('catGuardar').addEventListener('click', _save);

    document.getElementById('catBody').addEventListener('click', function (e) {
      var editBtn = e.target.closest('.tbl-action--edit');
      if (editBtn) {
        var cid = editBtn.getAttribute('data-cid');
        var item = _data.find(function (d) { return d.id === cid; });
        if (item) _openModal('editar', item);
        return;
      }
      var toggleBtn = e.target.closest('[data-toggle-cat]');
      if (toggleBtn) {
        var cid2 = toggleBtn.getAttribute('data-cid');
        var item2 = _data.find(function (d) { return d.id === cid2; });
        if (item2) _toggleActivo(item2);
      }
    });
  }

  function _openModal(modo, item) {
    _editingId = null;
    document.getElementById('catCategoria').value = 'Audio';
    document.getElementById('catConcepto').value = '';
    document.getElementById('catUnidad').value = '';
    document.getElementById('catPrecio').value = '';

    if (modo === 'editar' && item) {
      _editingId = item.id;
      document.getElementById('catModalTitle').textContent = 'EDITAR CONCEPTO';
      document.getElementById('catCategoria').value = item.categoria || 'Audio';
      document.getElementById('catConcepto').value = item.concepto || '';
      document.getElementById('catUnidad').value = item.unidad || '';
      document.getElementById('catPrecio').value = item.precio || '';
    } else {
      document.getElementById('catModalTitle').textContent = 'NUEVO CONCEPTO';
    }

    document.getElementById('catOverlay').classList.add('visible');
  }

  function _closeModal() {
    document.getElementById('catOverlay').classList.remove('visible');
  }

  function _save() {
    var categoria = document.getElementById('catCategoria').value;
    var concepto = document.getElementById('catConcepto').value.trim();
    var unidad = document.getElementById('catUnidad').value.trim();
    var precio = parseFloat(document.getElementById('catPrecio').value) || 0;

    if (!concepto) {
      if (window.BNKToast) BNKToast.warn('El concepto es requerido.');
      return;
    }

    var btn = document.getElementById('catGuardar');
    btn.disabled = true;
    btn.textContent = 'GUARDANDO...';

    var data = { categoria: categoria, concepto: concepto, unidad: unidad, precio: precio, activo: true };

    var promise = _editingId
      ? BNK_DB.catalogo.update(_editingId, data)
      : BNK_DB.catalogo.create(data);

    promise.then(function () {
      _closeModal();
      load();
      if (window.BNKToast) BNKToast.ok(_editingId ? 'Concepto actualizado.' : 'Concepto creado.');
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = 'GUARDAR';
    });
  }

  function _toggleActivo(item) {
    var newState = item.activo === false ? true : false;
    BNK_DB.catalogo.update(item.id, { activo: newState }).then(function () {
      load();
      if (window.BNKToast) BNKToast.ok(item.concepto + (newState ? ' activado' : ' desactivado'));
    });
  }

  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKCatalogo = { load: load };
})();
