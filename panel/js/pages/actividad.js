// actividad.js — Feed de actividad global
(function () {
  'use strict';

  var _entries = [];
  var _isOpen = false;

  var TIPO_ICONS = {
    'cotizacion_creada': '\u{1F4DD}',
    'estado_cambio': '\u25B6',
    'pago_registrado': '\u{1F4B0}',
    'cliente_creado': '\u{1F465}',
    'cliente_editado': '\u270F',
    'proveedor_creado': '\u{1F3ED}',
    'proveedor_editado': '\u270F',
    'evento_creado': '\u{1F3AC}',
    'evento_editado': '\u270F',
    'tarea_completada': '\u2705',
    'partner_creado': '\u{1F91D}',
    'partner_editado': '\u270F',
    'cobrar_registrada': '\u{1F4B5}',
    'export_csv': '\u{1F4CA}'
  };

  var TIPO_TAB = {
    'cotizacion_creada': 'cotizaciones',
    'estado_cambio': 'pipeline',
    'pago_registrado': 'finanzas',
    'cliente_creado': 'clientes',
    'cliente_editado': 'clientes',
    'proveedor_creado': 'proveedores',
    'proveedor_editado': 'proveedores',
    'evento_creado': 'eventos',
    'evento_editado': 'eventos',
    'tarea_completada': 'eventos',
    'partner_creado': 'finanzas',
    'partner_editado': 'finanzas',
    'cobrar_registrada': 'finanzas'
  };

  function init() {
    _bindEvents();
    load();
  }

  function load() {
    if (!BNK_DB.actividadGlobal) return;
    BNK_DB.actividadGlobal.list().then(function (docs) {
      _entries = docs.slice(0, 50);
      _renderDropdown();
      _updateBadge();
    }).catch(function () {
      _entries = [];
    });
  }

  function _updateBadge() {
    var badge = document.getElementById('actBellBadge');
    if (!badge) return;

    var user = BNK_AUTH.currentUser();
    var storageKey = 'bnk_last_activity_' + (user ? user.uid : 'anon');
    var lastSeen = parseInt(localStorage.getItem(storageKey)) || 0;

    var now24h = Date.now() - 24 * 60 * 60 * 1000;
    var count = 0;
    _entries.forEach(function (e) {
      var ts = e.timestamp;
      if (!ts) return;
      var time = ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
      if (time > now24h && time > lastSeen) count++;
    });

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  function _renderDropdown() {
    var list = document.getElementById('actDropdownList');
    var empty = document.getElementById('actDropdownEmpty');
    if (!list) return;

    if (_entries.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    var html = '';
    _entries.slice(0, 20).forEach(function (e) {
      var icon = TIPO_ICONS[e.tipo] || '\u2022';
      var tab = TIPO_TAB[e.tipo] || '';
      var timeStr = _tiempoRelativo(e.timestamp);
      html += '<div class="act-entry" data-tab="' + tab + '" data-ref="' + _esc(e.referencia) + '">'
        + '<span class="act-entry-icon">' + icon + '</span>'
        + '<div class="act-entry-content">'
        + '<div class="act-entry-text">' + _esc(e.detalle || e.referencia) + '</div>'
        + '<div class="act-entry-meta">' + _esc(e.usuario) + ' \u2014 ' + timeStr + '</div>'
        + '</div>'
        + '</div>';
    });
    list.innerHTML = html;
  }

  function _tiempoRelativo(timestamp) {
    if (!timestamp) return '';
    var time = timestamp.toDate ? timestamp.toDate().getTime() : new Date(timestamp).getTime();
    var diff = Date.now() - time;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return 'hace ' + mins + ' min';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return 'hace ' + hrs + 'h';
    var days = Math.floor(hrs / 24);
    if (days === 1) return 'ayer';
    return 'hace ' + days + 'd';
  }

  function _bindEvents() {
    var btn = document.getElementById('actBellBtn');
    var dropdown = document.getElementById('actDropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      _isOpen = !_isOpen;
      dropdown.classList.toggle('visible', _isOpen);
      if (_isOpen) {
        // Mark as seen
        var user = BNK_AUTH.currentUser();
        var storageKey = 'bnk_last_activity_' + (user ? user.uid : 'anon');
        localStorage.setItem(storageKey, String(Date.now()));
        _updateBadge();
      }
    });

    document.addEventListener('click', function (e) {
      if (_isOpen && !dropdown.contains(e.target) && e.target !== btn) {
        _isOpen = false;
        dropdown.classList.remove('visible');
      }
    });

    dropdown.addEventListener('click', function (e) {
      var entry = e.target.closest('.act-entry');
      if (!entry) return;
      var tab = entry.getAttribute('data-tab');
      if (tab) {
        // Navigate to tab
        var tabBtn = document.querySelector('.dash-tab[data-tab="' + tab + '"]');
        if (tabBtn) tabBtn.click();
      }
      _isOpen = false;
      dropdown.classList.remove('visible');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _isOpen) {
        _isOpen = false;
        dropdown.classList.remove('visible');
      }
    });
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKActividad = { load: load, updateBadge: _updateBadge };
})();
