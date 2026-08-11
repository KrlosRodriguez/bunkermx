// auth.js — Autenticación Firebase + guard de sesión + roles
(function () {
  'use strict';

  var auth = BNK_FIREBASE.auth;
  var db = BNK_FIREBASE.db;
  var _userData = null;
  var _readyCallbacks = [];
  var _resolved = false;

  // ── Escuchar estado de auth ──
  auth.onAuthStateChanged(function (user) {
    if (user) {
      db.collection('usuarios').doc(user.uid).get().then(function (doc) {
        if (doc.exists && doc.data().activo) {
          _userData = doc.data();
          _userData.uid = user.uid;
          _userData.email = user.email;
          _redirectToDashboard();
        } else {
          auth.signOut();
          _showError('Cuenta desactivada. Contacta al administrador.');
        }
        _resolveReady();
      }).catch(function () {
        auth.signOut();
        _showError('Error al verificar permisos.');
        _resolveReady();
      });
    } else {
      _userData = null;
      _resolveReady();
    }
  });

  // ── Login con email/password ──
  var form = document.getElementById('loginForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('loginEmail').value.trim();
      var pass = document.getElementById('loginPass').value;
      var btn = document.getElementById('loginBtn');
      var errorEl = document.getElementById('loginError');

      btn.disabled = true;
      btn.textContent = 'VERIFICANDO...';
      errorEl.textContent = '';

      auth.signInWithEmailAndPassword(email, pass)
        .then(function () {
          // onAuthStateChanged se encarga del redirect
        })
        .catch(function (err) {
          var msg = '> ACCESO DENEGADO';
          if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            msg = '> Correo o contraseña incorrectos';
          } else if (err.code === 'auth/too-many-requests') {
            msg = '> Demasiados intentos. Espera un momento.';
          }
          errorEl.textContent = msg;
          btn.disabled = false;
          btn.textContent = 'INGRESAR AL SISTEMA';
        });
    });
  }

  function _redirectToDashboard() {
    if (window.location.pathname.indexOf('dashboard') === -1 &&
        document.getElementById('loginForm')) {
      window.location.href = 'dashboard.html';
    }
  }

  function _showError(msg) {
    var el = document.getElementById('loginError');
    if (el) el.textContent = msg;
  }

  function _resolveReady() {
    _resolved = true;
    _readyCallbacks.forEach(function (cb) { cb(_userData); });
    _readyCallbacks = [];
  }

  // ── API pública ──
  window.BNK_AUTH = {
    currentUser: function () { return _userData; },
    currentRole: function () { return _userData ? _userData.rol : null; },
    logout: function () { return auth.signOut().then(function () { window.location.href = 'index.html'; }); },
    onReady: function (cb) {
      if (_resolved) { cb(_userData); }
      else { _readyCallbacks.push(cb); }
    },
    canEdit: function (section) {
      if (!_userData) return false;
      var r = _userData.rol;
      if (r === 'admin') return true;
      if (r === 'ventas') {
        return ['cotizaciones', 'clientes', 'proveedores', 'catalogo', 'pipeline'].indexOf(section) !== -1;
      }
      if (r === 'produccion') return section === 'checklist';
      return false;
    },
    canView: function (section) {
      if (!_userData) return false;
      var r = _userData.rol;
      if (r === 'admin' || r === 'ventas') return true;
      if (r === 'lectura') return true;
      if (r === 'produccion') {
        return ['eventos', 'proveedores', 'checklist', 'calendario'].indexOf(section) !== -1;
      }
      return false;
    }
  };
})();
