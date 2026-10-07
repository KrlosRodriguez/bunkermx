// table-helpers.js — Sort, paginación, export CSV y helpers de filtros para tablas del panel
// Portado de js/pages/panel-ui.js (cotizador legacy). Lo consumen clientes.js y proveedores.js.
(function () {
  'use strict';

  // ── BNKSort — ordenamiento con detección de tipo (fecha / número / texto) ──
  var _RE_FECHA = /^\d{1,2}\/\d{1,2}\/\d{2,4}/;
  var _RE_ISO   = /^\d{4}-\d{2}-\d{2}/;

  function _sortValue(val) {
    if (Array.isArray(val)) return val.join(', ');
    if (val && typeof val === 'object' && val.toDate) return val.toDate().toISOString();
    return val;
  }

  function _detectType(val) {
    if (val === null || val === undefined || String(val).trim() === '') return 'empty';
    var s = String(val).trim();
    if (_RE_FECHA.test(s) || _RE_ISO.test(s)) return 'date';
    var n = s.replace(/[$,%]/g, '');
    if (!isNaN(parseFloat(n)) && isFinite(n)) return 'number';
    return 'string';
  }

  function _parseForSort(val, tipo) {
    if (tipo === 'empty' || val === null || val === undefined || String(val).trim() === '') return null;
    var s = String(val).trim();
    if (tipo === 'date') {
      var parts = s.split(' ')[0].split('/');
      if (parts.length === 3 && parts[0].length <= 2) {
        var y = parseInt(parts[2], 10);
        if (y < 100) y += 2000;
        return new Date(y, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
      }
      var iso = new Date(s);
      return isNaN(iso.getTime()) ? 0 : iso.getTime();
    }
    if (tipo === 'number') return parseFloat(s.replace(/[$,%]/g, '')) || 0;
    return s.toLowerCase();
  }

  var BNKSort = {
    apply: function (dataArray, columnKey, direction) {
      if (!dataArray || !dataArray.length) return dataArray;
      var tipo = 'string';
      for (var i = 0; i < dataArray.length; i++) {
        var t = _detectType(_sortValue(dataArray[i][columnKey]));
        if (t !== 'empty') { tipo = t; break; }
      }
      var mult = direction === 'desc' ? -1 : 1;
      return dataArray.slice().sort(function (a, b) {
        var va = _parseForSort(_sortValue(a[columnKey]), tipo);
        var vb = _parseForSort(_sortValue(b[columnKey]), tipo);
        if (va === null && vb === null) return 0;
        if (va === null) return 1;   // vacíos siempre al final
        if (vb === null) return -1;
        if (tipo === 'string') return va.localeCompare(vb, 'es') * mult;
        if (va < vb) return -1 * mult;
        if (va > vb) return 1 * mult;
        return 0;
      });
    }
  };

  // ── BNKPagination — mismo look que la paginación de cotizaciones ──
  var PER_PAGE = 50;

  var BNKPagination = {
    perPage: PER_PAGE,

    paginate: function (filteredData, page, perPage) {
      var pp = perPage || PER_PAGE;
      var totalPages = Math.max(1, Math.ceil(filteredData.length / pp));
      var currentPage = Math.max(1, Math.min(page || 1, totalPages));
      var start = (currentPage - 1) * pp;
      return { rows: filteredData.slice(start, start + pp), currentPage: currentPage, totalPages: totalPages, totalFiltered: filteredData.length };
    },

    render: function (containerId, s, onPageChange) {
      var el = document.getElementById(containerId);
      if (!el) return;
      if (s.totalPages <= 1) { el.style.display = 'none'; el.innerHTML = ''; return; }
      el.className = 'dash-pagination';
      el.style.display = '';
      el.innerHTML =
          '<button class="panel-btn-icon" data-pag="prev" aria-label="Página anterior"' + (s.currentPage <= 1 ? ' disabled' : '') + '>&larr;</button>'
        + '<span class="dash-pagination-info">Página ' + s.currentPage + ' de ' + s.totalPages + ' (' + s.totalFiltered + ' registros)</span>'
        + '<button class="panel-btn-icon" data-pag="next" aria-label="Página siguiente"' + (s.currentPage >= s.totalPages ? ' disabled' : '') + '>&rarr;</button>';
      el.querySelector('[data-pag="prev"]').addEventListener('click', function () {
        if (s.currentPage > 1) onPageChange(s.currentPage - 1);
      });
      el.querySelector('[data-pag="next"]').addEventListener('click', function () {
        if (s.currentPage < s.totalPages) onPageChange(s.currentPage + 1);
      });
    }
  };

  // ── BNKExport — CSV con BOM UTF-8 y protección contra formula injection ──
  function _csvCell(val) {
    var s = (val === null || val === undefined) ? '' : String(val);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  var BNKExport = {
    csv: function (filename, headers, rows) {
      var lines = [headers.map(_csvCell).join(',')];
      rows.forEach(function (row) { lines.push(row.map(_csvCell).join(',')); });
      var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }
  };

  // ── BNKHelpers — contador de resultados y limpiar filtros ──
  var FILTER_INPUTS = 'input.dash-search, input.dash-date, select.dash-select';

  function _updateResultCount(elementId, showing, totalFiltered, totalAll, label) {
    var el = document.getElementById(elementId);
    if (!el) return;
    if (totalFiltered === 0) el.textContent = 'Sin resultados';
    else if (totalFiltered === totalAll) el.textContent = 'Mostrando ' + showing + ' de ' + totalAll + ' ' + label;
    else el.textContent = 'Mostrando ' + showing + ' de ' + totalFiltered + ' (' + totalAll + ' total)';
  }

  function _hasActiveFilters(filterBarId) {
    var bar = document.getElementById(filterBarId);
    if (!bar) return false;
    var inputs = bar.querySelectorAll(FILTER_INPUTS);
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el.tagName === 'SELECT' ? el.selectedIndex > 0 : el.value.trim() !== '') return true;
    }
    return false;
  }

  function _clearFilters(filterBarId, renderFn) {
    var bar = document.getElementById(filterBarId);
    if (!bar) return;
    bar.querySelectorAll(FILTER_INPUTS).forEach(function (el) {
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
    if (renderFn) renderFn();
  }

  function _toggleClearButton(buttonId, filterBarId) {
    var btn = document.getElementById(buttonId);
    if (btn) btn.style.display = _hasActiveFilters(filterBarId) ? '' : 'none';
  }

  window.BNKSort       = BNKSort;
  window.BNKPagination = BNKPagination;
  window.BNKExport     = BNKExport;
  window.BNKHelpers    = {
    updateResultCount: _updateResultCount,
    hasActiveFilters:  _hasActiveFilters,
    clearFilters:      _clearFilters,
    toggleClearButton: _toggleClearButton
  };
})();
