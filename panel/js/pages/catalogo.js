// catalogo.js — Catálogo de precios editable
(function () {
  'use strict';

  var _data = [];
  var _editingId = null;
  var _sortKey = 'categoria';
  var _sortDir = 'asc';

  function init() {
    if (!BNK_AUTH.canEdit('catalogo') && !BNK_AUTH.canView('catalogo')) return;
    _bindEvents();
    load();
  }

  function load() {
    var catLoading = document.getElementById('catLoading');
    var catTable = document.getElementById('catTable');
    var catEmpty = document.getElementById('catEmpty');

    if (catLoading) catLoading.style.display = '';
    if (catTable) catTable.style.display = 'none';
    if (catEmpty) catEmpty.style.display = 'none';

    BNK_DB.catalogo.list().then(function (docs) {
      _data = docs;
      if (catLoading) catLoading.style.display = 'none';
      _render();
      _updateIndicators();
    }).catch(function (err) {
      if (catLoading) catLoading.style.display = 'none';
      _data = [];
      BNKToast.error('Error al cargar catálogo: ' + (err && err.message ? err.message : 'desconocido'));
      if (catEmpty) {
        catEmpty.style.display = 'block';
        var txt = catEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = 'ERROR AL CARGAR CATÁLOGO';
        var icon = catEmpty.querySelector('.dash-empty-icon');
        if (icon) icon.textContent = '\u26A0';
        if (!catEmpty.querySelector('.cat-retry-btn')) {
          var retryBtn = document.createElement('button');
          retryBtn.className = 'panel-btn-primary cat-retry-btn';
          retryBtn.textContent = 'REINTENTAR';
          retryBtn.style.marginTop = '16px';
          retryBtn.addEventListener('click', function () { load(); });
          catEmpty.appendChild(retryBtn);
        }
      }
      _updateIndicators();
    });
  }

  function _updateIndicators() {
    var total = _data.length;
    var activos = _data.filter(function (d) { return d.activo !== false; }).length;
    var inactivos = total - activos;
    var venues = _data.filter(function (d) { return d.categoria === 'Venues'; }).length;

    var elTotal = document.getElementById('indCatTotal');
    var elActivos = document.getElementById('indCatActivos');
    var elInactivos = document.getElementById('indCatInactivos');
    var elVenues = document.getElementById('indCatVenues');
    if (elTotal) elTotal.textContent = total;
    if (elActivos) elActivos.textContent = activos;
    if (elInactivos) elInactivos.textContent = inactivos;
    if (elVenues) elVenues.textContent = venues;
  }

  function _render() {
    var tbody = document.getElementById('catBody');
    var catTable = document.getElementById('catTable');
    var catEmpty = document.getElementById('catEmpty');
    if (!tbody) return;

    var search = (document.getElementById('catSearch') || {}).value || '';
    search = search.trim().toLowerCase();

    var catFiltro = (document.getElementById('catCatFiltro') || {}).value || '';
    var estadoFiltro = (document.getElementById('catEstadoFiltro') || {}).value || '';

    var filtered = _data;
    if (search) {
      filtered = filtered.filter(function (d) {
        return [d.categoria, d.concepto, d.unidad].join(' ').toLowerCase().indexOf(search) !== -1;
      });
    }
    if (catFiltro) {
      filtered = filtered.filter(function (d) { return d.categoria === catFiltro; });
    }
    if (estadoFiltro === 'activo') {
      filtered = filtered.filter(function (d) { return d.activo !== false; });
    } else if (estadoFiltro === 'inactivo') {
      filtered = filtered.filter(function (d) { return d.activo === false; });
    }

    // Sort
    filtered.sort(function (a, b) {
      var va = a[_sortKey] || '';
      var vb = b[_sortKey] || '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return _sortDir === 'asc' ? va - vb : vb - va;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return _sortDir === 'asc' ? -1 : 1;
      if (va > vb) return _sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    // Update sort indicators
    _updateSortHeaders();

    // Count
    var countEl = document.getElementById('catCount');
    if (countEl) countEl.textContent = filtered.length + ' de ' + _data.length + ' conceptos';

    if (filtered.length === 0) {
      if (catTable) catTable.style.display = 'none';
      if (catEmpty) {
        catEmpty.style.display = 'block';
        var txt = catEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = 'Sin conceptos';
      }
      tbody.innerHTML = '';
      return;
    }

    if (catTable) catTable.style.display = 'table';
    if (catEmpty) catEmpty.style.display = 'none';

    var html = '';
    filtered.forEach(function (d) {
      var activo = d.activo !== false;
      var estadoClass = activo ? 'estado-Nueva' : 'estado-Cancelada';
      html += '<tr' + (activo ? '' : ' style="opacity:.5"') + '>'
        + '<td><span class="tipo-badge">' + _esc(d.categoria || '') + '</span></td>'
        + '<td>' + _esc(d.concepto || '') + '</td>'
        + '<td style="color:var(--tx)">' + _esc(d.unidad || '') + '</td>'
        + '<td class="col-total">' + _formatMXN(d.precio)
          + (d.categoria === 'Venues' && d.precioWeekend ? '<br><span style="font-size:10px;color:var(--tx)">WKD: ' + _formatMXN(d.precioWeekend) + ' · MTJ: ' + _formatMXN(d.precioMontaje) + '</span>' : '')
          + '</td>'
        + '<td><span class="estado-badge ' + estadoClass + '">' + (activo ? 'Activo' : 'Inactivo') + '</span></td>'
        + '<td>'
        + '<button class="tbl-action tbl-action--edit" data-cid="' + d.id + '" title="Editar">&#9998;</button>'
        + '<button class="tbl-action" data-cid="' + d.id + '" data-toggle-cat title="' + (activo ? 'Desactivar' : 'Activar') + '">&#9679;</button>'
        + '<button class="tbl-action tbl-action--del" data-cid="' + d.id + '" data-delete-cat title="Eliminar">&times;</button>'
        + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
  }

  function _updateSortHeaders() {
    var table = document.getElementById('catTable');
    if (!table) return;
    var ths = table.querySelectorAll('th.sortable');
    ths.forEach(function (th) {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.getAttribute('data-key') === _sortKey) {
        th.classList.add(_sortDir === 'desc' ? 'sort-desc' : 'sort-asc');
      }
    });
  }

  function _bindEvents() {
    var searchEl = document.getElementById('catSearch');
    if (searchEl) searchEl.addEventListener('input', _render);

    var catFiltro = document.getElementById('catCatFiltro');
    if (catFiltro) catFiltro.addEventListener('change', _render);

    var estadoFiltro = document.getElementById('catEstadoFiltro');
    if (estadoFiltro) estadoFiltro.addEventListener('change', _render);

    // Sort headers
    var table = document.getElementById('catTable');
    if (table) {
      table.querySelectorAll('th.sortable').forEach(function (th) {
        th.addEventListener('click', function () {
          var key = this.getAttribute('data-key');
          if (_sortKey === key) {
            _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            _sortKey = key;
            _sortDir = 'asc';
          }
          _render();
        });
      });
    }

    document.getElementById('btnNuevoConcepto').addEventListener('click', function () {
      _openModal('crear');
    });

    document.getElementById('catClose').addEventListener('click', _closeModal);
    document.getElementById('catCancel').addEventListener('click', _closeModal);
    document.getElementById('catOverlay').addEventListener('click', function (e) {
      if (e.target === this) _closeModal();
    });
    document.getElementById('catGuardar').addEventListener('click', _save);
    document.getElementById('catCategoria').addEventListener('change', _toggleVenueFields);

    // Escape to close modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('catOverlay');
        if (overlay && overlay.classList.contains('visible')) {
          e.preventDefault();
          _closeModal();
        }
      }
    });

    document.getElementById('catBody').addEventListener('click', function (e) {
      var editBtn = e.target.closest('.tbl-action--edit');
      if (editBtn) {
        var cid = editBtn.getAttribute('data-cid');
        var item = _data.find(function (d) { return d.id === cid; });
        if (item) _openModal('editar', item);
        return;
      }
      var deleteBtn = e.target.closest('[data-delete-cat]');
      if (deleteBtn) {
        var cid3 = deleteBtn.getAttribute('data-cid');
        _deleteItem(cid3);
        return;
      }
      var toggleBtn = e.target.closest('[data-toggle-cat]');
      if (toggleBtn) {
        var cid2 = toggleBtn.getAttribute('data-cid');
        var item2 = _data.find(function (d) { return d.id === cid2; });
        if (item2) _toggleActivo(item2, toggleBtn);
      }
    });
  }

  function _toggleVenueFields() {
    var isVenues = document.getElementById('catCategoria').value === 'Venues';
    document.getElementById('catWeekendGroup').style.display = isVenues ? '' : 'none';
    document.getElementById('catMontajeGroup').style.display = isVenues ? '' : 'none';
  }

  function _openModal(modo, item) {
    _editingId = null;
    document.getElementById('catCategoria').value = 'Audio';
    document.getElementById('catConcepto').value = '';
    document.getElementById('catUnidad').value = '';
    document.getElementById('catPrecio').value = '';
    document.getElementById('catPrecioWeekend').value = '';
    document.getElementById('catPrecioMontaje').value = '';

    if (modo === 'editar' && item) {
      _editingId = item.id;
      document.getElementById('catModalTitle').textContent = 'EDITAR CONCEPTO';
      document.getElementById('catCategoria').value = item.categoria || 'Audio';
      document.getElementById('catConcepto').value = item.concepto || '';
      document.getElementById('catUnidad').value = item.unidad || '';
      document.getElementById('catPrecio').value = item.precio || '';
      document.getElementById('catPrecioWeekend').value = item.precioWeekend || '';
      document.getElementById('catPrecioMontaje').value = item.precioMontaje || '';
    } else {
      document.getElementById('catModalTitle').textContent = 'NUEVO CONCEPTO';
    }

    _toggleVenueFields();
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
    var precioWeekend = parseFloat(document.getElementById('catPrecioWeekend').value) || 0;
    var precioMontaje = parseFloat(document.getElementById('catPrecioMontaje').value) || 0;

    if (!concepto) {
      BNKToast.warn('El concepto es requerido.');
      return;
    }
    if (precio <= 0) {
      BNKToast.warn('El precio debe ser mayor a $0.');
      return;
    }
    if (categoria === 'Venues') {
      if (precioWeekend <= 0) { BNKToast.warn('El precio weekend es requerido para Venues.'); return; }
      if (precioMontaje <= 0) { BNKToast.warn('El precio montaje es requerido para Venues.'); return; }
    }

    var btn = document.getElementById('catGuardar');
    btn.disabled = true;
    btn.textContent = 'GUARDANDO...';

    var data = { categoria: categoria, concepto: concepto, unidad: unidad, precio: precio };

    // Preserve activo state on edit, default true on create
    if (_editingId) {
      var existing = _data.find(function (d) { return d.id === _editingId; });
      data.activo = existing ? existing.activo !== false : true;
    } else {
      data.activo = true;
    }

    if (categoria === 'Venues') {
      data.precioWeekend = precioWeekend;
      data.precioMontaje = precioMontaje;
    }

    var promise = _editingId
      ? BNK_DB.catalogo.update(_editingId, data)
      : BNK_DB.catalogo.create(data);

    promise.then(function () {
      _closeModal();
      load();
      BNKToast.ok(_editingId ? 'Concepto actualizado.' : 'Concepto creado.');
    }).catch(function (err) {
      BNKToast.error('Error al guardar: ' + (err && err.message ? err.message : 'desconocido'));
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = 'GUARDAR';
    });
  }

  function _toggleActivo(item, btn) {
    var newState = item.activo === false ? true : false;
    if (btn) { btn.disabled = true; btn.style.opacity = '.3'; }
    BNK_DB.catalogo.update(item.id, { activo: newState }).then(function () {
      load();
      BNKToast.ok(item.concepto + (newState ? ' activado' : ' desactivado'));
    }).catch(function (err) {
      BNKToast.error('Error: ' + (err && err.message ? err.message : 'desconocido'));
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    });
  }

  function _deleteItem(id) {
    var item = _data.find(function (d) { return d.id === id; });
    var nombre = item ? item.concepto : id;
    if (!confirm('¿Eliminar "' + nombre + '" del catálogo?\nEsta acción no se puede deshacer.')) return;

    BNK_DB.catalogo.delete(id).then(function () {
      BNKToast.ok('Concepto eliminado.');
      load();
    }).catch(function (err) {
      BNKToast.error('Error al eliminar: ' + (err && err.message ? err.message : 'desconocido'));
    });
  }

  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKCatalogo = { load: load };
})();
