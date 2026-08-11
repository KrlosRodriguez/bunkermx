// guard.js — Redirige a login si no hay sesión activa
(function () {
  'use strict';

  // Ocultar body mientras se verifica auth
  document.documentElement.style.visibility = 'hidden';

  BNK_AUTH.onReady(function (user) {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    document.documentElement.style.visibility = 'visible';

    // Inyectar nombre y rol en el header
    var nameEl = document.getElementById('panelUserName');
    var roleEl = document.getElementById('panelUserRole');
    if (nameEl) nameEl.textContent = user.nombre || user.email;
    if (roleEl) roleEl.textContent = user.rol.toUpperCase();

    // Ocultar tabs según rol
    var tabs = document.querySelectorAll('[data-require-role]');
    tabs.forEach(function (tab) {
      var roles = tab.getAttribute('data-require-role').split(',');
      if (roles.indexOf(user.rol) === -1) {
        tab.style.display = 'none';
      }
    });
  });
})();
