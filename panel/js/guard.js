// guard.js — Redirige a login si no hay sesión activa
(function () {
  'use strict';

  // Ocultar body mientras se verifica auth
  document.documentElement.style.visibility = 'hidden';

  var _resuelto = false;

  // Red de seguridad: si la verificación de sesión no responde (Firestore
  // colgado, SDK bloqueado por la CSP, red caída) la página se queda negra
  // para siempre porque nadie quita el visibility:hidden. A los 10 s se
  // muestra la página con un aviso en vez de dejar la pantalla en negro.
  var _watchdog = setTimeout(function () {
    if (_resuelto) return;
    document.documentElement.style.visibility = 'visible';
    var aviso = document.createElement('div');
    aviso.setAttribute('role', 'alert');
    aviso.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:10px 16px;'
      + 'background:#9C1C1C;color:#fff;font-family:monospace;font-size:12px;text-align:center';
    aviso.textContent = 'No se pudo verificar la sesión. Revisa tu conexión y recarga la página.';
    document.body.appendChild(aviso);
  }, 10000);

  BNK_AUTH.onReady(function (user) {
    _resuelto = true;
    clearTimeout(_watchdog);

    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    document.documentElement.style.visibility = 'visible';

    // Inyectar nombre y rol en el header
    var rol = user.rol || '';
    var nameEl = document.getElementById('panelUserName');
    var roleEl = document.getElementById('panelUserRole');
    if (nameEl) nameEl.textContent = user.nombre || user.email;
    if (roleEl) roleEl.textContent = rol ? rol.toUpperCase() : 'SIN ROL';

    // Ocultar tabs según rol. Sin rol se ocultan todas las restringidas
    // (falla cerrado): antes user.rol.toUpperCase() lanzaba antes de llegar
    // aquí y el usuario terminaba viendo todos los tabs.
    var tabs = document.querySelectorAll('[data-require-role]');
    tabs.forEach(function (tab) {
      var roles = tab.getAttribute('data-require-role').split(',');
      if (!rol || roles.indexOf(rol) === -1) {
        tab.style.display = 'none';
      }
    });
  });
})();
