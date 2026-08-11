// usuarios.js — Gestión de usuarios (solo admin)
(function () {
  'use strict';

  var _usuarios = [];

  function init() {
    if (!BNK_AUTH.canEdit('usuarios')) return;
    _bindEvents();
    load();
  }

  function load() {
    BNK_DB.usuarios.list().then(function (data) {
      _usuarios = data;
      _render();
    });
  }

  function _render() {
    var tbody = document.getElementById('usrBody');
    var empty = document.getElementById('usrEmpty');
    if (!tbody) return;

    if (_usuarios.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    var html = '';
    _usuarios.forEach(function (u) {
      var estadoClass = u.activo ? 'estado-Nueva' : 'estado-Cancelada';
      var estadoText = u.activo ? 'Activo' : 'Inactivo';
      html += '<tr>'
        + '<td>' + _esc(u.nombre) + '</td>'
        + '<td style="font-size:12px;color:var(--tx)">' + _esc(u.email) + '</td>'
        + '<td><span class="tipo-badge">' + _esc(u.rol) + '</span></td>'
        + '<td><span class="estado-badge ' + estadoClass + '">' + estadoText + '</span></td>'
        + '<td>'
        + '<button class="tbl-action tbl-action--edit" data-uid="' + u.id + '" title="Editar">&#9998;</button>'
        + '<button class="tbl-action" data-uid="' + u.id + '" data-toggle="estado" title="Activar/Desactivar">&#9679;</button>'
        + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
  }

  function _esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function _bindEvents() {
    document.getElementById('btnNuevoUsuario').addEventListener('click', function () {
      _openModal('crear');
    });

    document.getElementById('usrClose').addEventListener('click', _closeModal);
    document.getElementById('usrCancel').addEventListener('click', _closeModal);
    document.getElementById('usrOverlay').addEventListener('click', function (e) {
      if (e.target === this) _closeModal();
    });

    document.getElementById('usrGuardar').addEventListener('click', _save);

    document.getElementById('usrBody').addEventListener('click', function (e) {
      var editBtn = e.target.closest('.tbl-action--edit');
      if (editBtn) {
        var uid = editBtn.getAttribute('data-uid');
        var user = _usuarios.find(function (u) { return u.id === uid; });
        if (user) _openModal('editar', user);
        return;
      }
      var toggleBtn = e.target.closest('[data-toggle="estado"]');
      if (toggleBtn) {
        var uid2 = toggleBtn.getAttribute('data-uid');
        var user2 = _usuarios.find(function (u) { return u.id === uid2; });
        if (user2) _toggleActivo(user2);
      }
    });
  }

  var _editingUid = null;

  function _openModal(modo, user) {
    _editingUid = null;
    document.getElementById('usrNombre').value = '';
    document.getElementById('usrEmail').value = '';
    document.getElementById('usrRol').value = 'ventas';
    document.getElementById('usrPass').value = '';

    if (modo === 'editar' && user) {
      _editingUid = user.id;
      document.getElementById('usrModalTitle').textContent = 'EDITAR USUARIO';
      document.getElementById('usrNombre').value = user.nombre || '';
      document.getElementById('usrEmail').value = user.email || '';
      document.getElementById('usrEmail').disabled = true;
      document.getElementById('usrRol').value = user.rol || 'ventas';
      document.getElementById('usrPassGroup').style.display = 'none';
    } else {
      document.getElementById('usrModalTitle').textContent = 'NUEVO USUARIO';
      document.getElementById('usrEmail').disabled = false;
      document.getElementById('usrPassGroup').style.display = '';
    }

    document.getElementById('usrOverlay').classList.add('visible');
  }

  function _closeModal() {
    document.getElementById('usrOverlay').classList.remove('visible');
  }

  function _save() {
    var nombre = document.getElementById('usrNombre').value.trim();
    var email = document.getElementById('usrEmail').value.trim();
    var rol = document.getElementById('usrRol').value;

    if (!nombre || !email) {
      if (window.BNKToast) BNKToast.warn('Nombre y email son requeridos.');
      return;
    }

    var btn = document.getElementById('usrGuardar');
    btn.disabled = true;
    btn.textContent = 'GUARDANDO...';

    if (_editingUid) {
      BNK_DB.usuarios.update(_editingUid, { nombre: nombre, rol: rol })
        .then(function () {
          _closeModal();
          load();
          if (window.BNKToast) BNKToast.ok('Usuario actualizado.');
        })
        .finally(function () { btn.disabled = false; btn.textContent = 'GUARDAR'; });
    } else {
      var pass = document.getElementById('usrPass').value;
      if (!pass || pass.length < 6) {
        if (window.BNKToast) BNKToast.warn('La contraseña debe tener al menos 6 caracteres.');
        btn.disabled = false;
        btn.textContent = 'GUARDAR';
        return;
      }

      var createUser = firebase.functions().httpsCallable('createUser');
      createUser({ email: email, password: pass, nombre: nombre, rol: rol })
        .then(function () {
          _closeModal();
          load();
          if (window.BNKToast) BNKToast.ok('Usuario creado. Contraseña temporal: ' + pass);
        })
        .catch(function (err) {
          if (window.BNKToast) BNKToast.error('Error: ' + (err.message || 'No se pudo crear'));
        })
        .finally(function () { btn.disabled = false; btn.textContent = 'GUARDAR'; });
    }
  }

  function _toggleActivo(user) {
    var newState = !user.activo;
    BNK_DB.usuarios.update(user.id, { activo: newState }).then(function () {
      load();
      if (window.BNKToast) BNKToast.ok(user.nombre + ' ' + (newState ? 'activado' : 'desactivado'));
    });
  }

  BNK_AUTH.onReady(function (user) {
    if (user && user.rol === 'admin') init();
  });

  window.BNKUsuarios = { load: load };
})();
