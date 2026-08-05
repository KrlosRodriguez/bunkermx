/* =========================================================
   panel-ui.js — Infraestructura de UI para el Panel de Ventas
   Expone: BNKToast, BNKConfirm, BNKSort, BNKPagination, BNKExport
   Sintaxis: ES5 + Promise (ya usados en el proyecto)
   ========================================================= */

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════
  // BNKToast — sistema de notificaciones no bloqueantes
  // ══════════════════════════════════════════════════════════

  var MAX_TOASTS = 4;
  var DURACION_MS = 3500;
  var SALIDA_MS   = 200;

  var _container = null;
  var _activos   = [];

  function _getContainer() {
    if (!_container) {
      _container = document.getElementById('bnkToastContainer');
      if (!_container) {
        _container = document.createElement('div');
        _container.id = 'bnkToastContainer';
        document.body.appendChild(_container);
      }
    }
    return _container;
  }

  function _descartarToast(el) {
    if (!el || el.getAttribute('data-removing') === '1') return;
    el.setAttribute('data-removing', '1');
    el.classList.remove('bnk-toast--visible');
    el.classList.add('bnk-toast--hiding');

    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      var idx = _activos.indexOf(el);
      if (idx !== -1) _activos.splice(idx, 1);
    }, SALIDA_MS);
  }

  function _crearToast(tipo, msg) {
    // Descartar el más antiguo si se supera el máximo
    if (_activos.length >= MAX_TOASTS) {
      _descartarToast(_activos[0]);
    }

    var iconos = { ok: '\u2713', error: '\u2715', warn: '\u26A0' };

    var el = document.createElement('div');
    el.className = 'bnk-toast bnk-toast--' + tipo;
    var spanIcon  = document.createElement('span');
    spanIcon.className = 'bnk-toast-icon';
    spanIcon.textContent = iconos[tipo];

    var spanText  = document.createElement('span');
    spanText.className = 'bnk-toast-text';
    spanText.textContent = String(msg || '');

    var btnClose  = document.createElement('button');
    btnClose.className = 'bnk-toast-close';
    btnClose.title = 'Cerrar';
    btnClose.textContent = '\u00D7';

    el.appendChild(spanIcon);
    el.appendChild(spanText);
    el.appendChild(btnClose);

    // Botón de cierre manual
    btnClose.addEventListener('click', function () {
      _descartarToast(el);
    });

    _getContainer().appendChild(el);
    _activos.push(el);

    // Entrada (rAF para asegurar que el elemento esté en el DOM)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('bnk-toast--visible');
      });
    });

    // Auto-descarte
    setTimeout(function () {
      _descartarToast(el);
    }, DURACION_MS);
  }

  var BNKToast = {
    ok:    function (msg) { _crearToast('ok',    msg); },
    error: function (msg) { _crearToast('error', msg); },
    warn:  function (msg) { _crearToast('warn',  msg); }
  };


  // ══════════════════════════════════════════════════════════
  // BNKConfirm — modal de confirmación con Promise
  // ══════════════════════════════════════════════════════════

  var _overlay = null;

  function _getOverlay() {
    if (!_overlay) {
      _overlay = document.createElement('div');
      _overlay.className = 'bnk-confirm-overlay';
      _overlay.innerHTML =
        '<div class="bnk-confirm-box">'
        + '<div class="bnk-confirm-icon">\u26A0</div>'
        + '<p class="bnk-confirm-msg"></p>'
        + '<div class="bnk-confirm-btns">'
        +   '<button class="bnk-confirm-btn bnk-confirm-btn--cancel">CANCELAR</button>'
        +   '<button class="bnk-confirm-btn bnk-confirm-btn--ok">ELIMINAR</button>'
        + '</div>'
        + '</div>';
      document.body.appendChild(_overlay);
    }
    return _overlay;
  }

  var BNKConfirm = {
    show: function (mensaje) {
      return new Promise(function (resolve) {
        var overlay = _getOverlay();
        var msgEl   = overlay.querySelector('.bnk-confirm-msg');
        var btnOk   = overlay.querySelector('.bnk-confirm-btn--ok');
        var btnCan  = overlay.querySelector('.bnk-confirm-btn--cancel');

        if (msgEl) msgEl.textContent = String(mensaje || '\xBFConfirmar esta acci\xF3n?');

        // Mostrar overlay
        overlay.classList.add('bnk-confirm--visible');

        function _cerrar(resultado) {
          overlay.classList.remove('bnk-confirm--visible');
          // Clonar para quitar listeners previos
          var nuevoOk  = btnOk.cloneNode(true);
          var nuevoCan = btnCan.cloneNode(true);
          btnOk.parentNode.replaceChild(nuevoOk, btnOk);
          btnCan.parentNode.replaceChild(nuevoCan, btnCan);
          resolve(resultado);
        }

        btnOk.addEventListener('click', function () { _cerrar(true);  }, { once: true });
        btnCan.addEventListener('click', function () { _cerrar(false); }, { once: true });

        // Cerrar al hacer click en el fondo
        overlay.addEventListener('click', function _clickFondo(e) {
          if (e.target === overlay) {
            overlay.removeEventListener('click', _clickFondo);
            _cerrar(false);
          }
        });
      });
    }
  };


  // ══════════════════════════════════════════════════════════
  // BNKSort — ordenamiento de columnas
  // ══════════════════════════════════════════════════════════

  var _RE_FECHA = /^\d{1,2}\/\d{1,2}\/\d{2,4}/;
  var _RE_ISO   = /^\d{4}-\d{2}-\d{2}/;

  function _detectType(val) {
    if (val === null || val === undefined || String(val).trim() === '') return 'empty';
    var s = String(val).trim();
    if (_RE_FECHA.test(s) || _RE_ISO.test(s)) return 'date';
    var n = s.replace(/[$,%]/g, '').replace(/,/g, '');
    if (!isNaN(parseFloat(n)) && isFinite(n)) return 'number';
    return 'string';
  }

  function _parseForSort(val, tipo) {
    if (tipo === 'empty') return null;
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
    if (tipo === 'number') {
      return parseFloat(s.replace(/[$,%]/g, '').replace(/,/g, '')) || 0;
    }
    return s.toLowerCase();
  }

  var BNKSort = {
    apply: function (dataArray, columnKey, direction) {
      if (!dataArray || !dataArray.length) return dataArray;
      var tipo = 'string';
      for (var i = 0; i < dataArray.length; i++) {
        var t = _detectType(dataArray[i][columnKey]);
        if (t !== 'empty') { tipo = t; break; }
      }
      var sorted = dataArray.slice();
      var mult = direction === 'desc' ? -1 : 1;
      sorted.sort(function (a, b) {
        var va = _parseForSort(a[columnKey], tipo);
        var vb = _parseForSort(b[columnKey], tipo);
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        if (va < vb) return -1 * mult;
        if (va > vb) return 1 * mult;
        return 0;
      });
      return sorted;
    }
  };


  // ══════════════════════════════════════════════════════════
  // BNKPagination — paginación de tablas
  // ══════════════════════════════════════════════════════════

  var PER_PAGE = 50;

  var BNKPagination = {
    paginate: function (filteredData, page, perPage) {
      var pp = perPage || PER_PAGE;
      var totalPages = Math.max(1, Math.ceil(filteredData.length / pp));
      var currentPage = Math.max(1, Math.min(page || 1, totalPages));
      var start = (currentPage - 1) * pp;
      var rows = filteredData.slice(start, start + pp);
      return { rows: rows, currentPage: currentPage, totalPages: totalPages, totalFiltered: filteredData.length };
    },

    render: function (containerId, paginationState, onPageChange) {
      var el = document.getElementById(containerId);
      if (!el) return;
      var s = paginationState;
      if (s.totalPages <= 1) { el.style.display = 'none'; return; }
      el.style.display = 'flex';

      var prevDisabled = s.currentPage <= 1 ? ' disabled' : '';
      var nextDisabled = s.currentPage >= s.totalPages ? ' disabled' : '';
      el.innerHTML =
          '<button class="pag-btn pag-prev"' + prevDisabled + '>\u00AB ANTERIOR</button>'
        + '<span class="pag-info">P\u00E1gina ' + s.currentPage + ' de ' + s.totalPages + '</span>'
        + '<button class="pag-btn pag-next"' + nextDisabled + '>SIGUIENTE \u00BB</button>';

      el.querySelector('.pag-prev').addEventListener('click', function () {
        if (s.currentPage > 1) onPageChange(s.currentPage - 1);
      });
      el.querySelector('.pag-next').addEventListener('click', function () {
        if (s.currentPage < s.totalPages) onPageChange(s.currentPage + 1);
      });
    }
  };


  // ══════════════════════════════════════════════════════════
  // BNKExport — exportar a CSV
  // ══════════════════════════════════════════════════════════

  function _csvEscape(val) {
    var s = (val === null || val === undefined) ? '' : String(val);
    if (s.indexOf(',') > -1 || s.indexOf('"') > -1 || s.indexOf('\n') > -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  var BNKExport = {
    csv: function (filename, headers, rows) {
      var lines = [headers.map(_csvEscape).join(',')];
      rows.forEach(function (row) {
        lines.push(row.map(_csvEscape).join(','));
      });
      var content = '\uFEFF' + lines.join('\r\n');
      var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
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


  // ══════════════════════════════════════════════════════════
  // Helpers — contador de resultados y limpiar filtros
  // ══════════════════════════════════════════════════════════

  function _updateResultCount(elementId, showing, totalFiltered, totalAll, label) {
    var el = document.getElementById(elementId);
    if (!el) return;
    if (totalFiltered === 0) {
      el.textContent = 'Sin resultados';
    } else if (totalFiltered === totalAll) {
      el.textContent = 'Mostrando ' + showing + ' de ' + totalAll + ' ' + label;
    } else {
      el.textContent = 'Mostrando ' + showing + ' de ' + totalFiltered + ' (' + totalAll + ' total)';
    }
  }

  function _hasActiveFilters(filterBarId) {
    var bar = document.getElementById(filterBarId);
    if (!bar) return false;
    var inputs = bar.querySelectorAll('input.dash-search, input.dash-date, select.dash-select');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el.tagName === 'SELECT') {
        if (el.selectedIndex > 0) return true;
      } else {
        if (el.value.trim() !== '') return true;
      }
    }
    return false;
  }

  function _clearFilters(filterBarId, renderFn) {
    var bar = document.getElementById(filterBarId);
    if (!bar) return;
    var inputs = bar.querySelectorAll('input.dash-search, input.dash-date, select.dash-select');
    inputs.forEach(function (el) {
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else {
        el.value = '';
      }
    });
    if (renderFn) renderFn();
  }

  function _toggleClearButton(buttonId, filterBarId) {
    var btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.style.display = _hasActiveFilters(filterBarId) ? '' : 'none';
  }


  // ── Exponer globalmente ──
  window.BNKToast      = BNKToast;
  window.BNKConfirm    = BNKConfirm;
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
