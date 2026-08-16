// cotizaciones.js — Módulo de cotizaciones sobre Firestore
(function () {
  'use strict';

  var _data = [];
  var _sortKey = 'fecha';
  var _sortDir = 'desc';
  var _page = 1;
  var _perPage = 20;
  var _unsubscribe = null;
  var _firstLoad = true;
  var _canEdit = false;

  function init() {
    _canEdit = BNK_AUTH.canEdit('cotizaciones');
    _bindFilters();
    _bindTableEvents();
    _bindSortHeaders();
    _bindPagination();
    _bindShortcuts();

    var cotLoading = document.getElementById('cotLoading');
    var cotTable = document.getElementById('cotTable2');
    if (cotLoading) cotLoading.style.display = '';
    if (cotTable) cotTable.style.display = 'none';

    _unsubscribe = BNK_DB.cotizaciones.onSnapshot(function (docs) {
      _data = docs;
      if (_firstLoad) {
        _firstLoad = false;
        var cl = document.getElementById('cotLoading');
        if (cl) cl.style.display = 'none';
      }
      _render();
    }, function (err) {
      _firstLoad = false;
      var cl = document.getElementById('cotLoading');
      if (cl) cl.style.display = 'none';
      BNKToast.error('Error al cargar cotizaciones: ' + (err && err.message ? err.message : 'desconocido'));
      var cotEmpty = document.getElementById('cotEmpty2');
      if (cotEmpty) {
        cotEmpty.style.display = 'block';
        var txt = cotEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = 'ERROR AL CARGAR COTIZACIONES';
        var icon = cotEmpty.querySelector('.dash-empty-icon');
        if (icon) icon.textContent = '\u26A0';
      }
    });
  }

  function _parseFecha(f) {
    if (!f) return '';
    if (typeof f === 'object' && f.toDate) return f.toDate().toISOString().substring(0, 10);
    return String(f).substring(0, 10);
  }

  function _formatDate(f) {
    if (!f) return '';
    var s = _parseFecha(f);
    if (s.length < 10) return s;
    return s.substring(8, 10) + '/' + s.substring(5, 7) + '/' + s.substring(0, 4);
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
        var fecha = _parseFecha(d.fecha);
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
      }
      return true;
    });
  }

  function _render() {
    var filtered = _getFiltered();

    // Sort
    filtered.sort(function (a, b) {
      var va = a[_sortKey] || '';
      var vb = b[_sortKey] || '';
      // Normalize Timestamps for sorting
      if (_sortKey === 'fecha') { va = _parseFecha(va); vb = _parseFecha(vb); }
      if (typeof va === 'number' && typeof vb === 'number') {
        return _sortDir === 'asc' ? va - vb : vb - va;
      }
      return _sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

    _updateSortHeaders();
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
    if (el('kpiTotal')) el('kpiTotal').textContent = filtered.length;
  }

  function _renderTable(filtered) {
    var tbody = document.getElementById('cotBody2');
    var cotTable = document.getElementById('cotTable2');
    var cotEmpty = document.getElementById('cotEmpty2');
    if (!tbody) return;

    var total = filtered.length;
    var totalPages = Math.ceil(total / _perPage) || 1;
    if (_page > totalPages) _page = totalPages;
    var start = (_page - 1) * _perPage;
    var page = filtered.slice(start, start + _perPage);

    if (total === 0) {
      if (cotTable) cotTable.style.display = 'none';
      if (cotEmpty) {
        cotEmpty.style.display = 'block';
        var txt = cotEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = _data.length === 0 ? 'Sin cotizaciones registradas' : 'Sin cotizaciones con ese filtro';
      }
      tbody.innerHTML = '';
      _updatePagination(0, 1);
      return;
    }

    if (cotTable) cotTable.style.display = 'table';
    if (cotEmpty) cotEmpty.style.display = 'none';

    var html = '';
    page.forEach(function (d) {
      var estadoClass = 'estado-' + (d.estado || 'Cotizada').replace(/\s/g, '');
      var tipoClass = 'tipo-' + (d.fuente || 'MNT');
      var fechaFormatted = _formatDate(d.fecha);

      html += '<tr data-id="' + _esc(d.id) + '">'
        + '<td class="col-folio">' + _esc(d.folio) + '</td>'
        + '<td>' + _esc(fechaFormatted) + '</td>'
        + '<td>' + _esc(d.cliente) + '</td>'
        + '<td>' + _esc(d.evento || '\u2014') + '</td>'
        + '<td><span class="tipo-badge ' + tipoClass + '">' + _esc(d.fuente || 'MNT') + '</span></td>'
        + '<td>' + _esc(d.espacios || 'Servicios') + '</td>'
        + '<td class="col-total">' + _formatMXN(d.total) + '</td>'
        + '<td>';

      if (_canEdit) {
        html += '<select class="estado-select ' + estadoClass + '" data-id="' + _esc(d.id) + '" data-prev="' + _esc(d.estado || 'Cotizada') + '">'
          + _estadoOptions(d.estado)
          + '</select>';
      } else {
        html += '<span class="estado-badge ' + estadoClass + '">' + _esc(d.estado || 'Cotizada') + '</span>';
      }

      html += '</td>'
        + '<td>'
        + (d.linkPdf ? '<a href="' + _esc(d.linkPdf) + '" target="_blank" class="pdf-link" title="Ver PDF">PDF</a>' : '')
        + '<button class="tbl-action tbl-action--del" data-cot-del="' + _esc(d.id) + '" title="Eliminar">&times;</button>'
        + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;

    _updatePagination(total, totalPages);
  }

  function _updatePagination(total, totalPages) {
    var paginationEl = document.getElementById('cotPagination2');
    var pageInfo = document.getElementById('cotPageInfo');
    var prevBtn = document.getElementById('cotPrevPage');
    var nextBtn = document.getElementById('cotNextPage');

    if (paginationEl) paginationEl.style.display = total > 0 ? 'flex' : 'none';
    if (pageInfo) pageInfo.textContent = 'Página ' + _page + ' de ' + totalPages + ' (' + total + ' registros)';
    if (prevBtn) prevBtn.disabled = _page <= 1;
    if (nextBtn) nextBtn.disabled = _page >= totalPages;
  }

  function _estadoOptions(current) {
    var estados = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];
    return estados.map(function (e) {
      return '<option value="' + e + '"' + (e === current ? ' selected' : '') + '>' + e + '</option>';
    }).join('');
  }

  function _updateSortHeaders() {
    var table = document.getElementById('cotTable2');
    if (!table) return;
    table.querySelectorAll('th.sortable').forEach(function (th) {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.getAttribute('data-key') === _sortKey) {
        th.classList.add(_sortDir === 'desc' ? 'sort-desc' : 'sort-asc');
      }
    });
  }

  function _bindSortHeaders() {
    var table = document.getElementById('cotTable2');
    if (!table) return;
    table.querySelectorAll('th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = this.getAttribute('data-key');
        if (_sortKey === key) {
          _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          _sortKey = key;
          _sortDir = key === 'fecha' ? 'desc' : 'asc';
        }
        _page = 1;
        _render();
      });
    });
  }

  function _bindPagination() {
    var prevBtn = document.getElementById('cotPrevPage');
    var nextBtn = document.getElementById('cotNextPage');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      if (_page > 1) { _page--; _render(); }
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      var totalPages = Math.ceil(_getFiltered().length / _perPage) || 1;
      if (_page < totalPages) { _page++; _render(); }
    });
  }

  function _bindShortcuts() {
    // Navigate to cotizador tabs
    var btnMNT = document.getElementById('cotBtnNuevaMNT');
    var btnBNK = document.getElementById('cotBtnNuevaBNK');
    if (btnMNT) btnMNT.addEventListener('click', function () {
      var tab = document.querySelector('[data-tab="sec-cotizar-mnt"]');
      if (tab) tab.click();
    });
    if (btnBNK) btnBNK.addEventListener('click', function () {
      var tab = document.querySelector('[data-tab="sec-cotizar-bnk"]');
      if (tab) tab.click();
    });
  }

  function _bindFilters() {
    var searchEl = document.getElementById('cotSearch2');
    if (searchEl) searchEl.addEventListener('input', function () { _page = 1; _render(); });

    var estadoEl = document.getElementById('cotEstado2');
    if (estadoEl) estadoEl.addEventListener('change', function () { _page = 1; _render(); });

    var tipoEl = document.getElementById('cotTipo2');
    if (tipoEl) tipoEl.addEventListener('change', function () { _page = 1; _render(); });

    var desdeEl = document.getElementById('cotDesde2');
    if (desdeEl) desdeEl.addEventListener('change', function () { _page = 1; _render(); });

    var hastaEl = document.getElementById('cotHasta2');
    if (hastaEl) hastaEl.addEventListener('change', function () { _page = 1; _render(); });

    // Clear filters button
    var limpiarBtn = document.getElementById('cotLimpiarFiltros');
    if (limpiarBtn) limpiarBtn.addEventListener('click', function () {
      if (searchEl) searchEl.value = '';
      if (estadoEl) estadoEl.value = '';
      if (tipoEl) tipoEl.value = '';
      if (desdeEl) desdeEl.value = '';
      if (hastaEl) hastaEl.value = '';
      _page = 1;
      _render();
    });
  }

  function _bindTableEvents() {
    var tbody = document.getElementById('cotBody2');
    if (!tbody) return;

    // Estado change
    tbody.addEventListener('change', function (e) {
      var select = e.target.closest('.estado-select');
      if (!select) return;
      if (!_canEdit) return;
      var id = select.getAttribute('data-id');
      var newEstado = select.value;
      var prevEstado = select.getAttribute('data-prev') || '';
      var user = BNK_AUTH.currentUser();

      function doUpdate() {
        select.setAttribute('data-prev', newEstado);
        BNK_DB.cotizaciones.update(id, { estado: newEstado }).then(function () {
          BNKToast.ok('Estado actualizado a ' + newEstado);
          BNK_DB.actividad.add(id, {
            tipo: 'cambio_estado',
            estado: newEstado,
            usuario: user ? user.nombre : 'Sistema',
            nota: ''
          }).catch(function () {});
        }).catch(function (err) {
          select.value = prevEstado;
          BNKToast.error('Error al actualizar estado: ' + (err && err.message ? err.message : 'desconocido'));
        });
      }

      // Confirm destructive states
      if (newEstado === 'Cancelada' || newEstado === 'Perdida') {
        BNKConfirm.show('¿Cambiar estado a "' + newEstado + '"? Esta acción es significativa.', 'CONFIRMAR').then(function (ok) {
          if (ok) { doUpdate(); } else { select.value = prevEstado; }
        });
      } else {
        doUpdate();
      }
    });

    // Delete
    tbody.addEventListener('click', function (e) {
      var delBtn = e.target.closest('[data-cot-del]');
      if (!delBtn) return;
      var id = delBtn.getAttribute('data-cot-del');
      _deleteCotizacion(id);
    });
  }

  function _deleteCotizacion(id) {
    var cot = _data.find(function (d) { return d.id === id; });
    var folio = cot ? cot.folio : id;
    BNKConfirm.show('¿Eliminar cotización "' + folio + '"? Esta acción no se puede deshacer.', 'ELIMINAR').then(function (ok) {
      if (!ok) return;
      BNK_DB.cotizaciones.delete(id).then(function () {
        BNKToast.ok('Cotización eliminada.');
      }).catch(function (err) {
        BNKToast.error('Error al eliminar: ' + (err && err.message ? err.message : 'desconocido'));
      });
    });
  }

  function _formatMXN(n) {
    return '$' + (Number(n) || 0).toLocaleString('es-MX');
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

  window.BNKCotizaciones = {
    load: function () {
      // onSnapshot handles live updates — manual refresh not needed
      // but re-render if called externally
      if (_data.length > 0) _render();
    }
  };
})();
