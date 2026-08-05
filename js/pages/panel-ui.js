/* =========================================================
   panel-ui.js — Infraestructura de UI para el Panel de Ventas
   Expone: window.BNKToast, window.BNKConfirm
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


  // ── Exponer globalmente ──
  window.BNKToast   = BNKToast;
  window.BNKConfirm = BNKConfirm;

})();
