// usuarios.js — Gestión de usuarios (solo admin)
(function () {
  'use strict';

  var _usuarios = [];
  var _editingUid = null;
  var _sortKey = 'nombre';
  var _sortDir = 'asc';

  function init() {
    _bindEvents();
    load();
  }

  function load() {
    var usrLoading = document.getElementById('usrLoading');
    var usrTable = document.getElementById('usrTable');
    var usrEmpty = document.getElementById('usrEmpty');

    if (usrLoading) usrLoading.style.display = '';
    if (usrTable) usrTable.style.display = 'none';
    if (usrEmpty) usrEmpty.style.display = 'none';

    BNK_DB.usuarios.list().then(function (data) {
      _usuarios = data;
      if (usrLoading) usrLoading.style.display = 'none';
      _render();
      _updateIndicators();
    }).catch(function (err) {
      _usuarios = [];
      if (usrLoading) usrLoading.style.display = 'none';
      BNKToast.error('Error al cargar usuarios: ' + (err && err.message ? err.message : 'desconocido'));
      if (usrEmpty) {
        usrEmpty.style.display = 'block';
        var txt = usrEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = 'ERROR AL CARGAR USUARIOS';
        var icon = usrEmpty.querySelector('.dash-empty-icon');
        if (icon) icon.textContent = '\u26A0';
        if (!usrEmpty.querySelector('.usr-retry-btn')) {
          var retryBtn = document.createElement('button');
          retryBtn.className = 'panel-btn-primary usr-retry-btn';
          retryBtn.textContent = 'REINTENTAR';
          retryBtn.style.marginTop = '16px';
          retryBtn.addEventListener('click', function () { load(); });
          usrEmpty.appendChild(retryBtn);
        }
      }
      _updateIndicators();
    });
  }

  function _updateIndicators() {
    var total = _usuarios.length;
    var activos = _usuarios.filter(function (u) { return u.activo !== false; }).length;
    var inactivos = total - activos;
    var admins = _usuarios.filter(function (u) { return u.rol === 'admin'; }).length;

    var elTotal = document.getElementById('indUsrTotal');
    var elActivos = document.getElementById('indUsrActivos');
    var elInactivos = document.getElementById('indUsrInactivos');
    var elAdmins = document.getElementById('indUsrAdmins');
    if (elTotal) elTotal.textContent = total;
    if (elActivos) elActivos.textContent = activos;
    if (elInactivos) elInactivos.textContent = inactivos;
    if (elAdmins) elAdmins.textContent = admins;
  }

  function _render() {
    var tbody = document.getElementById('usrBody');
    var usrTable = document.getElementById('usrTable');
    var usrEmpty = document.getElementById('usrEmpty');
    if (!tbody) return;

    var search = (document.getElementById('usrSearch') || {}).value || '';
    search = search.trim().toLowerCase();
    var rolFiltro = (document.getElementById('usrRolFiltro') || {}).value || '';
    var estadoFiltro = (document.getElementById('usrEstadoFiltro') || {}).value || '';

    var filtered = _usuarios;
    if (search) {
      filtered = filtered.filter(function (u) {
        return [u.nombre, u.email, u.rol].join(' ').toLowerCase().indexOf(search) !== -1;
      });
    }
    if (rolFiltro) {
      filtered = filtered.filter(function (u) { return u.rol === rolFiltro; });
    }
    if (estadoFiltro === 'activo') {
      filtered = filtered.filter(function (u) { return u.activo !== false; });
    } else if (estadoFiltro === 'inactivo') {
      filtered = filtered.filter(function (u) { return u.activo === false; });
    }

    // Sort
    filtered.sort(function (a, b) {
      var va = (a[_sortKey] || '').toString().toLowerCase();
      var vb = (b[_sortKey] || '').toString().toLowerCase();
      if (va < vb) return _sortDir === 'asc' ? -1 : 1;
      if (va > vb) return _sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    _updateSortHeaders();

    // Count
    var countEl = document.getElementById('usrCount');
    if (countEl) countEl.textContent = filtered.length + ' de ' + _usuarios.length + ' usuarios';

    if (filtered.length === 0) {
      if (usrTable) usrTable.style.display = 'none';
      if (usrEmpty) {
        usrEmpty.style.display = 'block';
        var txt = usrEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = _usuarios.length === 0 ? 'Sin usuarios registrados' : 'Sin usuarios con ese filtro';
      }
      tbody.innerHTML = '';
      return;
    }

    if (usrTable) usrTable.style.display = 'table';
    if (usrEmpty) usrEmpty.style.display = 'none';

    var html = '';
    filtered.forEach(function (u) {
      var activo = u.activo !== false;
      var estadoClass = activo ? 'estado-Nueva' : 'estado-Cancelada';
      var estadoText = activo ? 'Activo' : 'Inactivo';
      var updatedAt = _formatDate(u.updatedAt);

      html += '<tr' + (activo ? '' : ' style="opacity:.5"') + '>'
        + '<td>' + _esc(u.nombre) + '</td>'
        + '<td style="font-size:12px;color:var(--tx)">' + _esc(u.email) + '</td>'
        + '<td><span class="tipo-badge">' + _esc(u.rol) + '</span></td>'
        + '<td><span class="estado-badge ' + estadoClass + '">' + estadoText + '</span></td>'
        + '<td style="font-size:11px;color:var(--tx)">' + _esc(updatedAt) + '</td>'
        + '<td>'
        + '<button class="tbl-action tbl-action--edit" data-uid="' + u.id + '" title="Editar">&#9998;</button>'
        + '<button class="tbl-action" data-uid="' + u.id + '" data-toggle-usr title="' + (activo ? 'Desactivar' : 'Activar') + '">&#9679;</button>'
        + '<button class="tbl-action tbl-action--del" data-uid="' + u.id + '" data-delete-usr title="Eliminar">&times;</button>'
        + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
  }

  function _updateSortHeaders() {
    var table = document.getElementById('usrTable');
    if (!table) return;
    table.querySelectorAll('th.sortable').forEach(function (th) {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.getAttribute('data-key') === _sortKey) {
        th.classList.add(_sortDir === 'desc' ? 'sort-desc' : 'sort-asc');
      }
    });
  }

  function _bindEvents() {
    var btnNuevo = document.getElementById('btnNuevoUsuario');
    if (btnNuevo) btnNuevo.addEventListener('click', function () { _openModal('crear'); });

    var usrClose = document.getElementById('usrClose');
    if (usrClose) usrClose.addEventListener('click', _closeModal);

    var usrCancel = document.getElementById('usrCancel');
    if (usrCancel) usrCancel.addEventListener('click', _closeModal);

    var usrOverlay = document.getElementById('usrOverlay');
    if (usrOverlay) usrOverlay.addEventListener('click', function (e) {
      if (e.target === this) _closeModal();
    });

    var usrGuardar = document.getElementById('usrGuardar');
    if (usrGuardar) usrGuardar.addEventListener('click', _save);

    // Search and filters
    var searchEl = document.getElementById('usrSearch');
    if (searchEl) searchEl.addEventListener('input', _render);

    var rolFiltro = document.getElementById('usrRolFiltro');
    if (rolFiltro) rolFiltro.addEventListener('change', _render);

    var estadoFiltro = document.getElementById('usrEstadoFiltro');
    if (estadoFiltro) estadoFiltro.addEventListener('change', _render);

    // Sort headers
    var table = document.getElementById('usrTable');
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

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('usrOverlay');
        if (overlay && overlay.classList.contains('visible')) {
          e.preventDefault();
          _closeModal();
        }
      }
    });

    // Table body delegation
    var usrBody = document.getElementById('usrBody');
    if (usrBody) usrBody.addEventListener('click', function (e) {
      var editBtn = e.target.closest('.tbl-action--edit');
      if (editBtn) {
        var uid = editBtn.getAttribute('data-uid');
        var user = _usuarios.find(function (u) { return u.id === uid; });
        if (user) _openModal('editar', user);
        return;
      }
      var deleteBtn = e.target.closest('[data-delete-usr]');
      if (deleteBtn) {
        var did = deleteBtn.getAttribute('data-uid');
        _deleteUser(did);
        return;
      }
      var toggleBtn = e.target.closest('[data-toggle-usr]');
      if (toggleBtn) {
        var tid = toggleBtn.getAttribute('data-uid');
        var user2 = _usuarios.find(function (u) { return u.id === tid; });
        if (user2) _toggleActivo(user2, toggleBtn);
      }
    });
  }

  function _openModal(modo, user) {
    _editingUid = null;
    var nombre = document.getElementById('usrNombre');
    var email = document.getElementById('usrEmail');
    var rol = document.getElementById('usrRol');
    var pass = document.getElementById('usrPass');
    var passGroup = document.getElementById('usrPassGroup');
    var title = document.getElementById('usrModalTitle');

    if (nombre) nombre.value = '';
    if (email) { email.value = ''; email.disabled = false; }
    if (rol) rol.value = 'ventas';
    if (pass) pass.value = '';

    if (modo === 'editar' && user) {
      _editingUid = user.id;
      if (title) title.textContent = 'EDITAR USUARIO';
      if (nombre) nombre.value = user.nombre || '';
      if (email) { email.value = user.email || ''; email.disabled = true; }
      if (rol) rol.value = user.rol || 'ventas';
      if (passGroup) passGroup.style.display = 'none';
    } else {
      if (title) title.textContent = 'NUEVO USUARIO';
      if (passGroup) passGroup.style.display = '';
    }

    var overlay = document.getElementById('usrOverlay');
    if (overlay) overlay.classList.add('visible');
  }

  function _closeModal() {
    var overlay = document.getElementById('usrOverlay');
    if (overlay) overlay.classList.remove('visible');
    // Reset email disabled state
    var email = document.getElementById('usrEmail');
    if (email) email.disabled = false;
  }

  function _save() {
    var nombre = (document.getElementById('usrNombre') || {}).value || '';
    nombre = nombre.trim();
    var email = (document.getElementById('usrEmail') || {}).value || '';
    email = email.trim();
    var rol = (document.getElementById('usrRol') || {}).value || 'ventas';

    if (!nombre || !email) {
      BNKToast.warn('Nombre y email son requeridos.');
      return;
    }

    var btn = document.getElementById('usrGuardar');
    if (btn) { btn.disabled = true; btn.textContent = 'GUARDANDO...'; }

    if (_editingUid) {
      // Track role change
      var existingUser = _usuarios.find(function (u) { return u.id === _editingUid; });
      var rolChanged = existingUser && existingUser.rol !== rol;

      BNK_DB.usuarios.update(_editingUid, { nombre: nombre, rol: rol })
        .then(function () {
          _closeModal();
          load();
          BNKToast.ok('Usuario actualizado.' + (rolChanged ? ' Rol cambiado a ' + rol + '.' : ''));
        })
        .catch(function (err) {
          BNKToast.error('Error al actualizar: ' + (err && err.message ? err.message : 'desconocido'));
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = 'GUARDAR'; }
        });
    } else {
      var pass = (document.getElementById('usrPass') || {}).value || '';
      if (!pass || pass.length < 6) {
        BNKToast.warn('La contraseña debe tener al menos 6 caracteres.');
        if (btn) { btn.disabled = false; btn.textContent = 'GUARDAR'; }
        return;
      }

      var createUser = firebase.functions().httpsCallable('createUser');
      createUser({ email: email, password: pass, nombre: nombre, rol: rol })
        .then(function () {
          _closeModal();
          load();
          BNKToast.ok('Usuario creado. Comparte la contraseña de forma segura.');
        })
        .catch(function (err) {
          BNKToast.error('Error: ' + (err.message || 'No se pudo crear'));
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = 'GUARDAR'; }
        });
    }
  }

  function _toggleActivo(user, btn) {
    var newState = user.activo === false ? true : false;
    if (btn) { btn.disabled = true; btn.style.opacity = '.3'; }
    BNK_DB.usuarios.update(user.id, { activo: newState }).then(function () {
      load();
      BNKToast.ok(user.nombre + ' ' + (newState ? 'activado' : 'desactivado'));
    }).catch(function (err) {
      BNKToast.error('Error: ' + (err && err.message ? err.message : 'desconocido'));
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    });
  }

  function _deleteUser(id) {
    var user = _usuarios.find(function (u) { return u.id === id; });
    var nombre = user ? user.nombre : id;
    BNKConfirm.show('¿Eliminar a "' + nombre + '"? El registro se elimina de Firestore. El usuario de Firebase Auth debe eliminarse manualmente desde la consola.', 'ELIMINAR').then(function (ok) {
      if (!ok) return;
      BNK_DB.usuarios.delete(id).then(function () {
        BNKToast.ok('Usuario eliminado de Firestore.');
        load();
      }).catch(function (err) {
        BNKToast.error('Error al eliminar: ' + (err && err.message ? err.message : 'desconocido'));
      });
    });
  }

  function _formatDate(d) {
    if (!d) return '';
    if (typeof d === 'object' && d.toDate) d = d.toDate();
    if (typeof d === 'string') d = new Date(d);
    if (isNaN(d.getTime())) return '';
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var yy = String(d.getFullYear());
    return dd + '/' + mm + '/' + yy;
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user && user.rol === 'admin') init();
  });

  window.BNKUsuarios = { load: load };
})();
