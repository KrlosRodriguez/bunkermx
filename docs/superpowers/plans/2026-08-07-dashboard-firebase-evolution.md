# Dashboard BUNKER — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolucionar el dashboard de BUNKER de un CRUD sobre Google Sheets a una plataforma operativa completa con Firebase (Auth, Firestore, pipeline de seguimiento, reportes, producción y calendario).

**Architecture:** El panel interno migra a `/panel/` como app independiente del sitio corporativo, usando Firebase Auth para roles, Firestore como base de datos real-time, y doble escritura transitoria desde Apps Script para mantener compatibilidad con el wizard público. Todo vanilla HTML/CSS/JS sin frameworks.

**Tech Stack:** Firebase Auth, Firestore, Cloud Functions (Node.js), Firebase Hosting, jsPDF 2.5.1, vanilla HTML/CSS/JS.

## Global Constraints

- Todo texto de UI en español
- Sin frameworks JS — vanilla ES5/ES6 compatible con el proyecto existente
- Sin `!important` en CSS — usar cascada y especificidad
- Design tokens en `:root` (CSS custom properties)
- Fuentes: Barlow Condensed (headings), Barlow (body), Space Mono (monospace)
- Firebase project ID: `bunkermx-51834`
- Google Sheet ID: `1MrynkbdpsQOq2IuzalyiRfVesUhWcs_020BDl8S_1vk`
- Apps Script URL actual: `https://script.google.com/macros/s/AKfycbw5jN8Qtu937bhp2XRkmkMwJWfDHjc-9AzYQtgNDhxF1euft0xppwqkorgCGvvkr95T/exec`
- Folios: `MNT-AAMMDD-XXXX`, `BNK-AAMMDD-XXXX`, `CLI-XXXX`, `PRV-XXXX`, `EVT-AAMMDD-XXXX`
- Deploy: `git push` + `firebase deploy`
- El wizard público (`cotizador-munet/index.html`) no se toca hasta Fase 6
- Los PDFs se siguen generando client-side con jsPDF

---

## FASE 1: BASE FIREBASE

---

### Task 1: Inicializar Firebase SDK y estructura de carpetas del panel

**Files:**
- Create: `panel/index.html` (login page)
- Create: `panel/js/firebase-config.js` (config + init)
- Modify: `firebase.json` (agregar rewrite para `/panel`)

**Interfaces:**
- Produces: `window.BNK_FIREBASE` — objeto global con `{ app, auth, db }` para todos los módulos

- [ ] **Step 1: Instalar Firebase CLI tools si no están**

```bash
npm list -g firebase-tools || npm install -g firebase-tools
```

- [ ] **Step 2: Habilitar Firestore y Auth en la consola de Firebase**

Ir a https://console.firebase.google.com/project/bunkermx-51834:
1. **Authentication** → Get Started → habilitar proveedor "Email/Password"
2. **Firestore Database** → Create Database → Start in production mode → location `us-central1`

- [ ] **Step 3: Obtener la configuración Firebase del proyecto**

```bash
firebase apps:sdkconfig web --project bunkermx-51834
```

Copiar el objeto `firebaseConfig` que devuelve (apiKey, authDomain, projectId, etc.)

- [ ] **Step 4: Crear estructura de carpetas del panel**

```bash
mkdir -p panel/js panel/js/pages panel/css
```

- [ ] **Step 5: Crear `panel/js/firebase-config.js`**

```javascript
// firebase-config.js — Inicialización Firebase para panel BUNKER
(function () {
  'use strict';

  var firebaseConfig = {
    // PEGAR AQUÍ la config obtenida en Step 3
    apiKey: "...",
    authDomain: "bunkermx-51834.firebaseapp.com",
    projectId: "bunkermx-51834",
    storageBucket: "bunkermx-51834.appspot.com",
    messagingSenderId: "...",
    appId: "..."
  };

  // Inicializar Firebase
  firebase.initializeApp(firebaseConfig);

  // Exponer instancias para todos los módulos
  window.BNK_FIREBASE = {
    app: firebase.app(),
    auth: firebase.auth(),
    db: firebase.firestore()
  };

  // Persistencia de sesión — se mantiene al cerrar pestaña
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
})();
```

- [ ] **Step 6: Crear `panel/index.html` (placeholder de login)**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BUNKER — Panel Operativo</title>
<link rel="icon" type="image/webp" href="../img/logo-bunker.webp">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@300;400;500&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<!-- Firebase SDKs (compat mode for vanilla JS) -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
<script src="js/firebase-config.js"></script>
</head>
<body>
<h1>Panel BUNKER — Login placeholder</h1>
<script src="js/auth.js"></script>
</body>
</html>
```

- [ ] **Step 7: Agregar rewrite en `firebase.json`**

Agregar al array `rewrites` en `firebase.json`:

```json
{ "source": "/panel", "destination": "/panel/index.html" },
{ "source": "/panel/dashboard", "destination": "/panel/dashboard.html" }
```

- [ ] **Step 8: Verificar que sirve localmente**

```bash
firebase serve --only hosting --project bunkermx-51834
```

Abrir `http://localhost:5000/panel` — debe mostrar el placeholder.

- [ ] **Step 9: Commit**

```bash
git add panel/ firebase.json
git commit -m "feat(panel): inicializar estructura Firebase — config, login placeholder, rewrites"
```

---

### Task 2: Sistema de autenticación y pantalla de login

**Files:**
- Create: `panel/js/auth.js` (login/logout, guard de sesión)
- Modify: `panel/index.html` (UI de login completa)
- Create: `panel/css/login.css` (estilos de login)

**Interfaces:**
- Consumes: `window.BNK_FIREBASE.auth` de Task 1
- Produces: `window.BNK_AUTH` — `{ currentUser(), currentRole(), logout(), onReady(callback) }`

- [ ] **Step 1: Crear `panel/css/login.css`**

Estilos del login con branding BUNKER. Misma paleta dorada del `login-gate.js` actual (`rgba(198,163,80,...)`), fondo oscuro `#0a0a0a`:

```css
/* login.css — Pantalla de login panel BUNKER */
:root {
  --bk: #0a0a0a;
  --gold: rgba(198,163,80,1);
  --gold-dim: rgba(198,163,80,.5);
  --gold-glow: rgba(198,163,80,.15);
  --wh: #fff;
  --wh-dim: rgba(255,255,255,.4);
  --err: #e74c3c;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bk);
  font-family: 'Barlow Condensed', sans-serif;
}

.login-box {
  width: 90%;
  max-width: 400px;
  text-align: center;
  padding: 3rem 2rem;
  border: 1px solid var(--gold-dim);
  background: rgba(15,15,15,.95);
}

.login-logo img { height: 50px; margin-bottom: 1.5rem; opacity: .8; }

.login-tag {
  font-size: .75rem;
  letter-spacing: 3px;
  color: var(--gold-dim);
  margin-bottom: 2.5rem;
  font-family: 'Space Mono', monospace;
}

.login-field { text-align: left; margin-bottom: 1.2rem; }

.login-field label {
  display: block;
  font-size: .7rem;
  letter-spacing: 2px;
  color: var(--wh-dim);
  margin-bottom: .4rem;
  font-family: 'Space Mono', monospace;
}

.login-field input {
  width: 100%;
  padding: .7rem .8rem;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(198,163,80,.2);
  color: var(--wh);
  font-family: 'Barlow', sans-serif;
  font-size: 1rem;
  outline: none;
  transition: border-color .3s;
}

.login-field input:focus { border-color: var(--gold); }

.login-error {
  color: var(--err);
  font-size: .8rem;
  min-height: 1.2rem;
  margin-bottom: .5rem;
}

.login-btn {
  width: 100%;
  padding: .8rem;
  background: transparent;
  border: 1px solid var(--gold-dim);
  color: var(--gold);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1rem;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all .3s;
  text-transform: uppercase;
}

.login-btn:hover { background: var(--gold-glow); border-color: var(--gold); }
.login-btn:disabled { opacity: .5; cursor: wait; }

.login-footer {
  margin-top: 2rem;
  font-size: .65rem;
  letter-spacing: 2px;
  color: rgba(255,255,255,.2);
  font-family: 'Space Mono', monospace;
}
```

- [ ] **Step 2: Actualizar `panel/index.html` con UI de login completa**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BUNKER — Panel Operativo</title>
<link rel="icon" type="image/webp" href="../img/logo-bunker.webp">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@300;400;500&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/login.css">
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
<script src="js/firebase-config.js"></script>
</head>
<body class="login-page">

<div class="login-box">
  <div class="login-logo"><img src="../img/logo-bunker.webp" alt="BUNKER"></div>
  <div class="login-tag">PANEL OPERATIVO — ACCESO RESTRINGIDO</div>
  <form id="loginForm" autocomplete="off">
    <div class="login-field">
      <label>CORREO ELECTRÓNICO</label>
      <input type="email" id="loginEmail" autocomplete="email" placeholder="tu@bunkermx.com" required>
    </div>
    <div class="login-field">
      <label>CONTRASEÑA</label>
      <input type="password" id="loginPass" autocomplete="current-password" required>
    </div>
    <div class="login-error" id="loginError"></div>
    <button type="submit" class="login-btn" id="loginBtn">INGRESAR AL SISTEMA</button>
  </form>
  <div class="login-footer">BUNKER CREATIVIDAD EMPRESARIAL &copy; 2026</div>
</div>

<script src="js/auth.js"></script>
</body>
</html>
```

- [ ] **Step 3: Crear `panel/js/auth.js`**

```javascript
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
      // Cargar datos del usuario (rol, nombre, activo)
      db.collection('usuarios').doc(user.uid).get().then(function (doc) {
        if (doc.exists && doc.data().activo) {
          _userData = doc.data();
          _userData.uid = user.uid;
          _userData.email = user.email;
          _redirectToDashboard();
        } else {
          // Usuario existe en Auth pero no en Firestore o está inactivo
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
```

- [ ] **Step 4: Crear primer usuario admin en Firebase**

Desde Firebase Console → Authentication → Users → Add user:
- Email: el correo del admin (HaDeZ)
- Password: temporal, se cambia después

Luego en Firestore → crear documento manualmente:
- Collection: `usuarios`
- Document ID: el UID del usuario recién creado
- Campos: `nombre: "HaDeZ"`, `email: "correo@..."`, `rol: "admin"`, `activo: true`

- [ ] **Step 5: Probar login localmente**

```bash
firebase serve --only hosting --project bunkermx-51834
```

Abrir `http://localhost:5000/panel` → ingresar credenciales del admin → debe redirigir a dashboard.html (que aún no existe, dará 404 — eso confirma que el redirect funciona).

- [ ] **Step 6: Commit**

```bash
git add panel/
git commit -m "feat(panel): sistema de autenticación Firebase con roles y pantalla de login"
```

---

### Task 3: Guard de sesión en dashboard y estructura base del panel

**Files:**
- Create: `panel/dashboard.html` (shell del dashboard con nav y tabs)
- Create: `panel/css/panel.css` (estilos base del panel)
- Create: `panel/js/guard.js` (protección de ruta — redirige a login si no hay sesión)

**Interfaces:**
- Consumes: `window.BNK_AUTH` de Task 2, `window.BNK_FIREBASE.db` de Task 1
- Produces: `panel/dashboard.html` — shell HTML listo para montar módulos

- [ ] **Step 1: Crear `panel/js/guard.js`**

```javascript
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
```

- [ ] **Step 2: Crear `panel/css/panel.css`**

Tomar los design tokens y estilos base del dashboard actual (`cotizador-munet/dashboard.html` lines 11-270). Incluir:
- Variables `:root` (colores neon del dashboard actual)
- Estilos de nav/header con nombre de usuario y botón logout
- Estilos de tabs (reutilizar `.dash-tab` del original)
- Grid base, tipografía, tabla, badges, modales
- Responsive breakpoints

Este archivo es extenso (~400 lines). Extraer los estilos inline del `dashboard.html` actual y adaptarlos, cambiando las rutas relativas (de `../` a la nueva estructura).

- [ ] **Step 3: Crear `panel/dashboard.html`**

Shell HTML con header, tabs y contenedores para cada módulo. Incluir:

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BUNKER — Panel Operativo</title>
<link rel="icon" type="image/webp" href="../img/logo-bunker.webp">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@300;400;500&family=Space+Mono:wght@400;700&family=Rajdhani:wght@300;400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/panel.css">
<!-- Firebase -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
<script src="js/firebase-config.js"></script>
<script src="js/auth.js"></script>
<script src="js/guard.js"></script>
</head>
<body>

<!-- ── HEADER ── -->
<header class="panel-header">
  <div class="panel-brand">
    <img src="../img/logo-bunker.webp" alt="BUNKER" class="panel-logo">
    <span class="panel-title">PANEL OPERATIVO</span>
  </div>
  <div class="panel-user">
    <span id="panelUserName"></span>
    <span id="panelUserRole" class="panel-role-badge"></span>
    <button id="panelLogout" class="panel-logout-btn" title="Cerrar sesión">SALIR</button>
  </div>
</header>

<!-- ── TABS ── -->
<nav class="panel-tabs">
  <button class="dash-tab active" data-tab="cotizaciones">COTIZACIONES</button>
  <button class="dash-tab" data-tab="pipeline" data-require-role="admin,ventas">PIPELINE</button>
  <button class="dash-tab" data-tab="clientes" data-require-role="admin,ventas,lectura">CLIENTES</button>
  <button class="dash-tab" data-tab="proveedores">PROVEEDORES</button>
  <button class="dash-tab" data-tab="calendario">CALENDARIO</button>
  <button class="dash-tab" data-tab="reportes" data-require-role="admin,ventas">REPORTES</button>
  <button class="dash-tab" data-tab="catalogo" data-require-role="admin,ventas">CATÁLOGO</button>
  <button class="dash-tab" data-tab="usuarios" data-require-role="admin">USUARIOS</button>
</nav>

<!-- ── SECCIONES ── -->
<main class="panel-main">
  <section id="sec-cotizaciones" class="panel-section active">
    <p style="color:var(--tx);padding:40px">Módulo de cotizaciones — se migra en Task 5</p>
  </section>
  <section id="sec-pipeline" class="panel-section">
    <p style="color:var(--tx);padding:40px">Pipeline — Fase 2</p>
  </section>
  <section id="sec-clientes" class="panel-section">
    <p style="color:var(--tx);padding:40px">Clientes — se migra en Task 5</p>
  </section>
  <section id="sec-proveedores" class="panel-section">
    <p style="color:var(--tx);padding:40px">Proveedores — se migra en Task 5</p>
  </section>
  <section id="sec-calendario" class="panel-section">
    <p style="color:var(--tx);padding:40px">Calendario — Fase 4</p>
  </section>
  <section id="sec-reportes" class="panel-section">
    <p style="color:var(--tx);padding:40px">Reportes — Fase 3</p>
  </section>
  <section id="sec-catalogo" class="panel-section">
    <p style="color:var(--tx);padding:40px">Catálogo — Fase 5</p>
  </section>
  <section id="sec-usuarios" class="panel-section">
    <p style="color:var(--tx);padding:40px">Usuarios — se implementa en Task 6</p>
  </section>
</main>

<!-- ── JS CORE ── -->
<script>
(function () {
  'use strict';

  // Tab switching
  var tabs = document.querySelectorAll('.dash-tab');
  var sections = document.querySelectorAll('.panel-section');

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = this.getAttribute('data-tab');
      tabs.forEach(function (t) { t.classList.remove('active'); });
      sections.forEach(function (s) { s.classList.remove('active'); });
      this.classList.add('active');
      var sec = document.getElementById('sec-' + target);
      if (sec) sec.classList.add('active');
    });
  });

  // Logout
  document.getElementById('panelLogout').addEventListener('click', function () {
    BNK_AUTH.logout();
  });
})();
</script>

</body>
</html>
```

- [ ] **Step 4: Probar flujo completo localmente**

```bash
firebase serve --only hosting --project bunkermx-51834
```

1. Abrir `/panel` → ver login
2. Ingresar con credenciales admin → redirige a `/panel/dashboard`
3. Ver header con nombre y rol
4. Ver todos los tabs (es admin)
5. Click en SALIR → vuelve a login

- [ ] **Step 5: Commit**

```bash
git add panel/
git commit -m "feat(panel): dashboard shell con guard de sesión, header y tabs por rol"
```

---

### Task 4: Capa de Firestore — módulo de acceso a datos

**Files:**
- Create: `panel/js/firestore.js` (CRUD genérico para Firestore + real-time listeners)

**Interfaces:**
- Consumes: `window.BNK_FIREBASE.db` de Task 1
- Produces: `window.BNK_DB` — API para todos los módulos:
  - `BNK_DB.cotizaciones.list()` → Promise<Array>
  - `BNK_DB.cotizaciones.get(id)` → Promise<Object>
  - `BNK_DB.cotizaciones.onSnapshot(callback)` → unsubscribe function
  - `BNK_DB.cotizaciones.update(id, data)` → Promise
  - `BNK_DB.clientes.list()`, `.get()`, `.create()`, `.update()`, `.delete()`
  - `BNK_DB.proveedores.list()`, `.get()`, `.create()`, `.update()`, `.delete()`
  - `BNK_DB.catalogo.list()`, `.create()`, `.update()`, `.delete()`
  - `BNK_DB.usuarios.list()`, `.get()`, `.create()`, `.update()`
  - `BNK_DB.actividad.add(cotizacionId, entry)`, `.list(cotizacionId)`
  - `BNK_DB.eventos.list()`, `.get()`, `.create()`, `.update()`
  - `BNK_DB.plantillas.list()`, `.create()`, `.update()`, `.delete()`

- [ ] **Step 1: Crear `panel/js/firestore.js`**

```javascript
// firestore.js — Capa de acceso a datos Firestore para panel BUNKER
(function () {
  'use strict';

  var db = BNK_FIREBASE.db;

  // ── Factory de colección ──
  function collectionAPI(name, options) {
    options = options || {};
    var defaultOrder = options.orderBy || null;

    return {
      list: function (filters) {
        var ref = db.collection(name);
        if (filters) {
          Object.keys(filters).forEach(function (key) {
            ref = ref.where(key, '==', filters[key]);
          });
        }
        if (defaultOrder) ref = ref.orderBy(defaultOrder.field, defaultOrder.dir || 'asc');
        return ref.get().then(function (snap) {
          return snap.docs.map(function (doc) {
            var d = doc.data();
            d.id = doc.id;
            return d;
          });
        });
      },

      get: function (id) {
        return db.collection(name).doc(id).get().then(function (doc) {
          if (!doc.exists) return null;
          var d = doc.data();
          d.id = doc.id;
          return d;
        });
      },

      create: function (data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        return db.collection(name).add(data).then(function (ref) {
          data.id = ref.id;
          return data;
        });
      },

      update: function (id, data) {
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        return db.collection(name).doc(id).update(data);
      },

      delete: function (id) {
        return db.collection(name).doc(id).delete();
      },

      onSnapshot: function (callback, filters) {
        var ref = db.collection(name);
        if (filters) {
          Object.keys(filters).forEach(function (key) {
            ref = ref.where(key, '==', filters[key]);
          });
        }
        if (defaultOrder) ref = ref.orderBy(defaultOrder.field, defaultOrder.dir || 'asc');
        return ref.onSnapshot(function (snap) {
          var docs = snap.docs.map(function (doc) {
            var d = doc.data();
            d.id = doc.id;
            return d;
          });
          callback(docs);
        });
      }
    };
  }

  // ── Actividad (subcollection de cotizaciones) ──
  var actividadAPI = {
    add: function (cotizacionId, entry) {
      entry.fecha = firebase.firestore.FieldValue.serverTimestamp();
      return db.collection('cotizaciones').doc(cotizacionId)
        .collection('actividad').add(entry);
    },
    list: function (cotizacionId) {
      return db.collection('cotizaciones').doc(cotizacionId)
        .collection('actividad').orderBy('fecha', 'desc').get()
        .then(function (snap) {
          return snap.docs.map(function (doc) {
            var d = doc.data();
            d.id = doc.id;
            return d;
          });
        });
    }
  };

  // ── Tareas de evento (subcollection de eventos) ──
  var tareasAPI = {
    add: function (eventoId, tarea) {
      return db.collection('eventos').doc(eventoId)
        .collection('tareas').add(tarea);
    },
    list: function (eventoId) {
      return db.collection('eventos').doc(eventoId)
        .collection('tareas').orderBy('orden', 'asc').get()
        .then(function (snap) {
          return snap.docs.map(function (doc) {
            var d = doc.data();
            d.id = doc.id;
            return d;
          });
        });
    },
    update: function (eventoId, tareaId, data) {
      return db.collection('eventos').doc(eventoId)
        .collection('tareas').doc(tareaId).update(data);
    }
  };

  // ── API pública ──
  window.BNK_DB = {
    cotizaciones: collectionAPI('cotizaciones', { orderBy: { field: 'fecha', dir: 'desc' } }),
    clientes:     collectionAPI('clientes', { orderBy: { field: 'razonSocial', dir: 'asc' } }),
    proveedores:  collectionAPI('proveedores', { orderBy: { field: 'razonSocial', dir: 'asc' } }),
    catalogo:     collectionAPI('catalogo', { orderBy: { field: 'categoria', dir: 'asc' } }),
    usuarios:     collectionAPI('usuarios', { orderBy: { field: 'nombre', dir: 'asc' } }),
    eventos:      collectionAPI('eventos', { orderBy: { field: 'fechaEvento', dir: 'asc' } }),
    plantillas:   collectionAPI('plantillas'),
    config:       collectionAPI('config'),
    actividad:    actividadAPI,
    tareas:       tareasAPI
  };
})();
```

- [ ] **Step 2: Agregar script a `panel/dashboard.html`**

Agregar después de `guard.js` y antes del `<script>` inline:

```html
<script src="js/firestore.js"></script>
```

- [ ] **Step 3: Probar desde consola del navegador**

Abrir `/panel/dashboard`, abrir DevTools Console y ejecutar:

```javascript
BNK_DB.usuarios.list().then(function(u) { console.log('Usuarios:', u); });
```

Debe retornar un array con el usuario admin creado en Task 2.

- [ ] **Step 4: Commit**

```bash
git add panel/js/firestore.js panel/dashboard.html
git commit -m "feat(panel): capa de acceso a datos Firestore con CRUD genérico y real-time"
```

---

### Task 5: Doble escritura en Apps Script + script de migración inicial

**Files:**
- Modify: `cotizador-munet/google-apps-script-munet.js` (agregar función de doble escritura a Firestore)
- Create: `scripts/migrate-sheets-to-firestore.js` (script de migración de datos existentes)

**Interfaces:**
- Consumes: Google Sheets data, Firestore REST API
- Produces: Datos replicados en Firestore para todas las colecciones

- [ ] **Step 1: Agregar función auxiliar de escritura a Firestore en Apps Script**

Agregar al inicio de `google-apps-script-munet.js` (después de las constantes `SHEET_ID` y `DRIVE_FOLDER_ID`):

```javascript
// ── Doble escritura a Firestore (transitorio) ──
var FIREBASE_PROJECT = 'bunkermx-51834';
var FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT + '/databases/(default)/documents';

function writeToFirestore(collection, docId, data) {
  try {
    var token = ScriptApp.getOAuthToken();
    var url = FIRESTORE_BASE + '/' + collection + '/' + docId;
    var fields = {};

    Object.keys(data).forEach(function (key) {
      var val = data[key];
      if (val === null || val === undefined || val === '') {
        fields[key] = { stringValue: '' };
      } else if (typeof val === 'number') {
        fields[key] = { doubleValue: val };
      } else if (typeof val === 'boolean') {
        fields[key] = { booleanValue: val };
      } else if (Array.isArray(val)) {
        fields[key] = {
          arrayValue: {
            values: val.map(function (v) { return { stringValue: String(v) }; })
          }
        };
      } else {
        fields[key] = { stringValue: String(val) };
      }
    });

    var payload = { fields: fields };

    UrlFetchApp.fetch(url, {
      method: 'PATCH',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log('Firestore write error (' + collection + '/' + docId + '): ' + e.message);
  }
}
```

- [ ] **Step 2: Agregar llamada de doble escritura al final de `doPost` para cotizaciones MNT**

En `doPost()`, después de la línea que hace `sheet.appendRow(...)` para cotizaciones MNT (alrededor de línea 180), agregar:

```javascript
// Doble escritura a Firestore
writeToFirestore('cotizaciones', folio, {
  folio: folio,
  fuente: 'MNT',
  fecha: fechaStr,
  cliente: data.empresa || '',
  contacto: data.contacto || '',
  correo: data.correo || '',
  telefono: data.telefono || '',
  evento: data.evento || '',
  espacios: data.espacios || '',
  total: data.total || 0,
  estado: 'Cotizada',
  linkPdf: driveLink
});
```

- [ ] **Step 3: Agregar doble escritura en `crearCotizacionBNK()`**

En la función `crearCotizacionBNK()`, después de `sheet.appendRow(...)` (alrededor de línea 340), agregar:

```javascript
writeToFirestore('cotizaciones', folio, {
  folio: folio,
  fuente: 'BNK',
  folioMNT: data.folioMNT || '',
  fecha: fechaStr,
  cliente: data.empresa || '',
  evento: data.evento || '',
  sede: data.sede || '',
  total: totalFinal,
  estado: 'Cotizada',
  linkPdf: driveLink,
  conceptos: JSON.stringify(data.conceptos || [])
});
```

- [ ] **Step 4: Agregar doble escritura en CRUD de Clientes**

En `createCliente()` después del appendRow, y en `updateCliente()` después del update:

```javascript
// En createCliente — después de appendRow
writeToFirestore('clientes', newId, data);

// En updateCliente — después de actualizar la fila
writeToFirestore('clientes', data.id, data);
```

- [ ] **Step 5: Agregar doble escritura en CRUD de Proveedores**

Mismo patrón que clientes:

```javascript
// En createProveedor — después de appendRow
writeToFirestore('proveedores', newId, data);

// En updateProveedor — después de actualizar la fila
writeToFirestore('proveedores', data.id, data);
```

- [ ] **Step 6: Crear script de migración `scripts/migrate-sheets-to-firestore.js`**

Este es un script para ejecutar UNA VEZ desde Apps Script para migrar datos existentes:

```javascript
// migrate-sheets-to-firestore.js
// Ejecutar UNA VEZ desde el editor de Apps Script
// Copiar este contenido como una función temporal

function migrateAllToFirestore() {
  var ss = SpreadsheetApp.openById('1MrynkbdpsQOq2IuzalyiRfVesUhWcs_020BDl8S_1vk');

  // Migrar Cotizaciones MNT
  _migrateSheet(ss, 'Cotizaciones', 'cotizaciones', function (row, headers) {
    return { fuente: 'MNT', folio: row[0] || '' };
  });

  // Migrar CotizacionesBNK
  _migrateSheet(ss, 'CotizacionesBNK', 'cotizaciones', function (row, headers) {
    return { fuente: 'BNK', folio: row[0] || '' };
  });

  // Migrar Clientes
  _migrateSheet(ss, 'Clientes', 'clientes', function (row, headers) {
    return { id: row[0] || '' };
  });

  // Migrar Proveedores
  _migrateSheet(ss, 'Proveedores', 'proveedores', function (row, headers) {
    return { id: row[0] || '' };
  });

  // Migrar CatalogoPrecio
  _migrateSheet(ss, 'CatalogoPrecio', 'catalogo', function (row, headers) {
    return {};
  });

  Logger.log('Migración completa');
}

function _migrateSheet(ss, sheetName, collection, extraFn) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) { Logger.log('Sheet no encontrada: ' + sheetName); return; }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var doc = {};
    for (var j = 0; j < headers.length; j++) {
      var key = String(headers[j]).trim();
      if (key) doc[key] = row[j] !== undefined ? row[j] : '';
    }
    var extra = extraFn(row, headers);
    Object.keys(extra).forEach(function (k) { doc[k] = extra[k]; });

    var docId = doc.folio || doc.id || Utilities.getUuid();
    writeToFirestore(collection, docId, doc);
    Utilities.sleep(50); // Rate limiting
  }
  Logger.log('Migrada: ' + sheetName + ' → ' + collection + ' (' + (data.length - 1) + ' docs)');
}
```

- [ ] **Step 7: Ejecutar migración**

1. Copiar `writeToFirestore()` y `migrateAllToFirestore()` al editor de Apps Script
2. Ejecutar `migrateAllToFirestore()`
3. Verificar en Firebase Console → Firestore que las colecciones tengan datos
4. Eliminar la función `migrateAllToFirestore` del editor (es de una sola vez)

- [ ] **Step 8: Desplegar nueva versión de Apps Script**

En el editor de Apps Script:
1. Deploy → New deployment → Web app
2. Actualizar la URL si cambia (en `dashboard.html` actual y en `firebase-config.js`)

- [ ] **Step 9: Commit**

```bash
git add cotizador-munet/google-apps-script-munet.js scripts/
git commit -m "feat: doble escritura Apps Script → Firestore + script de migración inicial"
```

---

### Task 6: Módulo de gestión de usuarios (admin)

**Files:**
- Create: `panel/js/pages/usuarios.js` (CRUD de usuarios + crear cuenta en Firebase Auth)
- Modify: `panel/dashboard.html` (agregar HTML de la sección usuarios)

**Interfaces:**
- Consumes: `BNK_DB.usuarios`, `BNK_AUTH`, `BNK_FIREBASE.auth`
- Produces: Sección funcional de gestión de usuarios en el dashboard

- [ ] **Step 1: Agregar HTML de sección usuarios en `panel/dashboard.html`**

Reemplazar el placeholder de `sec-usuarios`:

```html
<section id="sec-usuarios" class="panel-section">
  <div class="panel-toolbar">
    <h2 class="panel-section-title">GESTIÓN DE USUARIOS</h2>
    <button id="btnNuevoUsuario" class="panel-btn-primary">+ NUEVO USUARIO</button>
  </div>
  <table class="dash-table" id="usrTable">
    <thead>
      <tr>
        <th>NOMBRE</th>
        <th>EMAIL</th>
        <th>ROL</th>
        <th>ESTADO</th>
        <th>ACCIONES</th>
      </tr>
    </thead>
    <tbody id="usrBody"></tbody>
  </table>
  <div id="usrEmpty" class="dash-empty" style="display:none">No hay usuarios registrados</div>

  <!-- Modal usuario -->
  <div class="bnk-overlay" id="usrOverlay">
    <div class="bnk-modal" style="max-width:500px">
      <div class="bnk-modal-header">
        <span class="bnk-modal-title" id="usrModalTitle">NUEVO USUARIO</span>
        <button class="bnk-modal-close" id="usrClose">&times;</button>
      </div>
      <div class="bnk-modal-body">
        <div class="bnk-form-grid">
          <div class="bnk-form-group">
            <label class="bnk-label">NOMBRE</label>
            <input type="text" class="bnk-input" id="usrNombre" placeholder="Nombre completo">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">EMAIL</label>
            <input type="email" class="bnk-input" id="usrEmail" placeholder="correo@bunkermx.com">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">ROL</label>
            <select class="bnk-input" id="usrRol">
              <option value="admin">Admin</option>
              <option value="ventas">Ventas</option>
              <option value="produccion">Producción</option>
              <option value="lectura">Lectura</option>
            </select>
          </div>
          <div class="bnk-form-group" id="usrPassGroup">
            <label class="bnk-label">CONTRASEÑA TEMPORAL</label>
            <input type="text" class="bnk-input" id="usrPass" placeholder="Mínimo 6 caracteres">
          </div>
        </div>
      </div>
      <div class="bnk-modal-footer">
        <button class="panel-btn-secondary" id="usrCancel">CANCELAR</button>
        <button class="panel-btn-primary" id="usrGuardar">GUARDAR</button>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Crear Cloud Function para crear usuarios**

Firebase Auth no permite crear usuarios desde el client SDK sin loguearse como ese usuario. Se necesita una Cloud Function:

```bash
cd panel && firebase init functions --project bunkermx-51834
```

Seleccionar JavaScript. Luego crear `functions/index.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.createUser = functions.https.onCall(async (data, context) => {
  // Solo admin puede crear usuarios
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'No autenticado');

  const callerDoc = await admin.firestore().collection('usuarios').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().rol !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Solo admin puede crear usuarios');
  }

  const { email, password, nombre, rol } = data;
  if (!email || !password || !nombre || !rol) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan campos requeridos');
  }

  // Crear usuario en Firebase Auth
  const userRecord = await admin.auth().createUser({
    email: email,
    password: password,
    displayName: nombre
  });

  // Crear documento en Firestore
  await admin.firestore().collection('usuarios').doc(userRecord.uid).set({
    nombre: nombre,
    email: email,
    rol: rol,
    activo: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { uid: userRecord.uid, success: true };
});
```

- [ ] **Step 3: Desplegar Cloud Function**

```bash
firebase deploy --only functions --project bunkermx-51834
```

- [ ] **Step 4: Crear `panel/js/pages/usuarios.js`**

```javascript
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

  function _esc(s) { return BNK_FIREBASE.db ? (s || '').replace(/[<>&"]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }) : s || ''; }

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
      // Actualizar
      BNK_DB.usuarios.update(_editingUid, { nombre: nombre, rol: rol })
        .then(function () {
          _closeModal();
          load();
          if (window.BNKToast) BNKToast.ok('Usuario actualizado.');
        })
        .finally(function () { btn.disabled = false; btn.textContent = 'GUARDAR'; });
    } else {
      // Crear — llamar Cloud Function
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

  // Inicializar cuando auth esté listo
  BNK_AUTH.onReady(function (user) {
    if (user && user.rol === 'admin') init();
  });

  window.BNKUsuarios = { load: load };
})();
```

- [ ] **Step 5: Agregar scripts a `panel/dashboard.html`**

Antes del cierre de `</body>`:

```html
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-functions-compat.js"></script>
<script src="js/pages/usuarios.js"></script>
```

- [ ] **Step 6: Probar flujo completo**

1. Login como admin
2. Click tab USUARIOS
3. Click + NUEVO USUARIO → llenar datos con rol "ventas" → GUARDAR
4. Verificar que aparece en la tabla
5. Abrir incógnito → login con el nuevo usuario → verificar que solo ve tabs permitidos

- [ ] **Step 7: Commit**

```bash
git add panel/ functions/
git commit -m "feat(panel): gestión de usuarios con Cloud Function para crear cuentas"
```

---

### Task 7: Migrar módulo de cotizaciones a Firestore

**Files:**
- Create: `panel/js/pages/cotizaciones.js` (módulo cotizaciones leyendo de Firestore)
- Modify: `panel/dashboard.html` (HTML de sección cotizaciones + KPIs)

**Interfaces:**
- Consumes: `BNK_DB.cotizaciones`, `BNK_AUTH`
- Produces: Tab de cotizaciones funcional con filtros, tabla, KPIs, y cambio de estado

- [ ] **Step 1: Agregar HTML de sección cotizaciones en `panel/dashboard.html`**

Reemplazar el placeholder de `sec-cotizaciones` con la estructura del dashboard actual (indicadores, filtros, tabla). Adaptar del `cotizador-munet/dashboard.html` líneas 295-420 (la zona del HTML de cotizaciones), cambiando los IDs para evitar colisiones con el dashboard viejo.

Estructura clave:
- 5 KPIs mejorados: Pipeline activas, Cotizado, Cerrado, Tasa cierre, Por cobrar
- Barra de filtros: búsqueda, estado (8 estados del pipeline), tipo (MNT/BNK), fechas
- Tabla con columnas: folio, fecha, cliente, evento, tipo, detalle, total, estado, PDF
- Tooltip de detalle de venue (reutilizar del original)

- [ ] **Step 2: Crear `panel/js/pages/cotizaciones.js`**

Módulo IIFE similar al patrón de `clientes.js`/`proveedores.js`:

```javascript
// cotizaciones.js — Módulo de cotizaciones sobre Firestore
(function () {
  'use strict';

  var _data = [];
  var _sortKey = 'fecha';
  var _sortDir = 'desc';
  var _page = 1;
  var _perPage = 20;
  var _unsubscribe = null;

  function init() {
    _bindFilters();
    _bindTableEvents();
    // Real-time listener
    _unsubscribe = BNK_DB.cotizaciones.onSnapshot(function (docs) {
      _data = docs;
      _render();
    });
  }

  function _getFiltered() {
    var search = (document.getElementById('cotSearch2').value || '').trim().toLowerCase();
    var estado = document.getElementById('cotEstado2').value;
    var tipo = document.getElementById('cotTipo2').value;
    var desde = document.getElementById('cotDesde2').value;
    var hasta = document.getElementById('cotHasta2').value;

    return _data.filter(function (d) {
      if (search) {
        var hay = [d.folio, d.cliente, d.evento, d.espacios, d.folioMNT].join(' ').toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      if (estado && d.estado !== estado) return false;
      if (tipo && (d.fuente || 'MNT') !== tipo) return false;
      if (desde || hasta) {
        var fecha = d.fecha || '';
        // Normalizar fecha para comparar
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
      }
      return true;
    });
  }

  function _render() {
    var filtered = _getFiltered();
    // Ordenar
    filtered.sort(function (a, b) {
      var va = a[_sortKey] || '', vb = b[_sortKey] || '';
      if (typeof va === 'number') return _sortDir === 'asc' ? va - vb : vb - va;
      return _sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

    _updateKPIs(filtered);
    _renderTable(filtered);
  }

  function _updateKPIs(filtered) {
    // Pipeline activas (no cerradas, no canceladas, no perdidas, no ejecutado)
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
  }

  function _renderTable(filtered) {
    var tbody = document.getElementById('cotBody2');
    if (!tbody) return;

    // Paginación
    var total = filtered.length;
    var start = (_page - 1) * _perPage;
    var page = filtered.slice(start, start + _perPage);

    var html = '';
    page.forEach(function (d) {
      var estadoClass = 'estado-' + (d.estado || 'Cotizada').replace(/\s/g, '');
      var tipoClass = 'tipo-' + (d.fuente || 'MNT');
      html += '<tr data-id="' + _esc(d.id) + '">'
        + '<td class="col-folio">' + _esc(d.folio) + '</td>'
        + '<td>' + _esc(d.fecha || '') + '</td>'
        + '<td>' + _esc(d.cliente) + '</td>'
        + '<td>' + _esc(d.evento || '\u2014') + '</td>'
        + '<td><span class="tipo-badge ' + tipoClass + '">' + _esc(d.fuente || 'MNT') + '</span></td>'
        + '<td>' + _esc(d.espacios || 'Servicios') + '</td>'
        + '<td class="col-total">' + _formatMXN(d.total) + '</td>'
        + '<td>'
        + '<select class="estado-select ' + estadoClass + '" data-id="' + _esc(d.id) + '">'
        + _estadoOptions(d.estado)
        + '</select>'
        + '</td>'
        + '<td>' + (d.linkPdf ? '<a href="' + _esc(d.linkPdf) + '" target="_blank" class="pdf-link">PDF</a>' : '\u2014') + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
  }

  function _estadoOptions(current) {
    var estados = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];
    return estados.map(function (e) {
      return '<option value="' + e + '"' + (e === current ? ' selected' : '') + '>' + e + '</option>';
    }).join('');
  }

  function _bindFilters() {
    ['cotSearch2', 'cotEstado2', 'cotTipo2', 'cotDesde2', 'cotHasta2'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener(el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change', function () {
        _page = 1;
        _render();
      });
    });
  }

  function _bindTableEvents() {
    var tbody = document.getElementById('cotBody2');
    if (!tbody) return;

    // Cambio de estado
    tbody.addEventListener('change', function (e) {
      var select = e.target.closest('.estado-select');
      if (!select) return;
      var id = select.getAttribute('data-id');
      var newEstado = select.value;
      var user = BNK_AUTH.currentUser();

      BNK_DB.cotizaciones.update(id, { estado: newEstado }).then(function () {
        // Registrar actividad
        BNK_DB.actividad.add(id, {
          tipo: 'cambio_estado',
          estado: newEstado,
          usuario: user ? user.nombre : 'Sistema',
          nota: ''
        });
      });
    });
  }

  function _formatMXN(n) {
    if (!n && n !== 0) return '$0';
    return '$' + Number(n).toLocaleString('es-MX');
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

  window.BNKCotizaciones = { load: function () { /* real-time, no manual load needed */ } };
})();
```

- [ ] **Step 3: Agregar script y vincular**

En `panel/dashboard.html` antes de `</body>`:

```html
<script src="js/pages/cotizaciones.js"></script>
```

- [ ] **Step 4: Probar**

1. Login → tab Cotizaciones
2. Verificar que se cargan los datos migrados de Firestore
3. Cambiar estado de una cotización → verificar que se actualiza en Firestore
4. Filtrar por texto, estado, tipo, fechas

- [ ] **Step 5: Commit**

```bash
git add panel/
git commit -m "feat(panel): módulo de cotizaciones sobre Firestore con real-time y KPIs"
```

---

### Task 8: Migrar módulos de clientes y proveedores a Firestore

**Files:**
- Create: `panel/js/pages/clientes.js` (adaptar de `js/pages/clientes.js`, cambiar backend a Firestore)
- Create: `panel/js/pages/proveedores.js` (adaptar de `js/pages/proveedores.js`, cambiar backend a Firestore)
- Modify: `panel/dashboard.html` (agregar HTML de secciones clientes y proveedores)

**Interfaces:**
- Consumes: `BNK_DB.clientes`, `BNK_DB.proveedores`, `BNK_AUTH`
- Produces: Tabs de clientes y proveedores funcionales con CRUD completo sobre Firestore

- [ ] **Step 1: Copiar y adaptar sección HTML de clientes**

Tomar el HTML de clientes del `cotizador-munet/dashboard.html` (la sección completa con KPIs, tabla, modal con 4 tabs). Pegarlo en `sec-clientes` del panel. Mantener los mismos IDs con prefijo `cli`.

- [ ] **Step 2: Crear `panel/js/pages/clientes.js`**

Tomar `js/pages/clientes.js` como base (715 líneas). Cambios clave:
- Reemplazar todas las llamadas `fetch(APPS_SCRIPT_URL + ...)` por `BNK_DB.clientes.list()`, `.create()`, `.update()`, `.delete()`
- Reemplazar `window.DASH` por `BNK_FIREBASE`/`BNK_AUTH`
- Agregar chequeo de `BNK_AUTH.canEdit('clientes')` antes de operaciones de escritura
- Mantener toda la lógica de UI (modal, tabs, completitud, filtros)

- [ ] **Step 3: Copiar y adaptar sección HTML de proveedores**

Mismo patrón: tomar HTML del dashboard actual, mantener IDs con prefijo `prv`, pegar en `sec-proveedores`.

- [ ] **Step 4: Crear `panel/js/pages/proveedores.js`**

Tomar `js/pages/proveedores.js` como base (1106 líneas). Mismos cambios que clientes:
- `fetch()` → `BNK_DB.proveedores.*`
- `window.DASH` → `BNK_AUTH`/`BNK_FIREBASE`
- Incluir CRUD de servicios via `BNK_DB.tareas` (subcollection)
- Chequeo de permisos

- [ ] **Step 5: Agregar scripts a `panel/dashboard.html`**

```html
<script src="js/pages/clientes.js"></script>
<script src="js/pages/proveedores.js"></script>
```

- [ ] **Step 6: Probar CRUD completo**

1. Clientes: crear, editar, ver, buscar, filtrar, verificar % completitud
2. Proveedores: crear, editar, ver, tab de servicios, filtrar
3. Verificar que datos se guardan en Firestore (no en Sheets)

- [ ] **Step 7: Commit**

```bash
git add panel/
git commit -m "feat(panel): módulos clientes y proveedores migrados a Firestore"
```

---

### Task 9: Reglas de seguridad de Firestore + deploy Fase 1

**Files:**
- Create: `firestore.rules` (reglas de seguridad por rol)
- Modify: `firebase.json` (agregar referencia a rules)

**Interfaces:**
- Consumes: Roles de usuario en `/usuarios/{uid}`
- Produces: Seguridad a nivel de base de datos — cada rol solo accede a lo que le corresponde

- [ ] **Step 1: Crear `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: obtener rol del usuario autenticado
    function userRole() {
      return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol;
    }

    function isActive() {
      return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.activo == true;
    }

    function isAdmin() {
      return isActive() && userRole() == 'admin';
    }

    function isAdminOrVentas() {
      return isActive() && (userRole() == 'admin' || userRole() == 'ventas');
    }

    function isAuthenticated() {
      return request.auth != null && isActive();
    }

    // Usuarios — solo admin lee y escribe
    match /usuarios/{uid} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Cotizaciones — admin/ventas CRUD, produccion lee cerradas, lectura lee
    match /cotizaciones/{docId} {
      allow read: if isAuthenticated();
      allow create, update: if isAdminOrVentas();
      allow delete: if isAdmin();

      // Subcollection actividad
      match /actividad/{actId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated();
      }
    }

    // Clientes — admin/ventas CRUD, lectura lee
    match /clientes/{docId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdminOrVentas();
    }

    // Proveedores — todos leen, admin/ventas escriben
    match /proveedores/{docId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdminOrVentas();

      match /servicios/{srvId} {
        allow read: if isAuthenticated();
        allow create, update, delete: if isAdminOrVentas();
      }
    }

    // Catálogo — admin/ventas CRUD
    match /catalogo/{docId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdminOrVentas();
    }

    // Eventos — todos leen, admin/ventas crean, produccion actualiza tareas
    match /eventos/{docId} {
      allow read: if isAuthenticated();
      allow create, update: if isAdminOrVentas();

      match /tareas/{tareaId} {
        allow read: if isAuthenticated();
        allow create, update: if isAuthenticated();
      }
    }

    // Plantillas — admin CRUD
    match /plantillas/{docId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdmin();
    }

    // Config — admin escribe, todos leen
    match /config/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

- [ ] **Step 2: Agregar referencia en `firebase.json`**

Agregar al objeto raíz de `firebase.json`:

```json
"firestore": {
  "rules": "firestore.rules"
}
```

- [ ] **Step 3: Desplegar reglas**

```bash
firebase deploy --only firestore:rules --project bunkermx-51834
```

- [ ] **Step 4: Probar permisos**

1. Login como admin → debe poder hacer todo
2. Login como usuario ventas → debe poder CRUD cotizaciones/clientes/proveedores pero NO gestionar usuarios
3. Crear usuario de prueba "lectura" → verificar que solo puede leer

- [ ] **Step 5: Deploy completo Fase 1**

```bash
firebase deploy --project bunkermx-51834
git add firestore.rules firebase.json
git commit -m "feat: reglas de seguridad Firestore por rol + deploy Fase 1 completa"
git push
```

---

## FASE 2: PIPELINE DE SEGUIMIENTO

---

### Task 10: Vista pipeline kanban

**Files:**
- Create: `panel/js/pages/pipeline.js` (vista kanban + timeline + notas)
- Create: `panel/css/pipeline.css` (estilos del kanban)
- Modify: `panel/dashboard.html` (HTML de sección pipeline + vincular scripts)

**Interfaces:**
- Consumes: `BNK_DB.cotizaciones`, `BNK_DB.actividad`, `BNK_AUTH`
- Produces: Vista kanban con tarjetas, cambio de estado, timeline, notas rápidas

- [ ] **Step 1: Crear `panel/css/pipeline.css`**

Estilos del kanban:
- Contenedor horizontal con scroll (`.pipeline-board`)
- Columnas por estado (`.pipeline-col`) con header coloreado
- Tarjetas (`.pipeline-card`) con: cliente, evento, monto, tiempo en estado, indicador de alerta
- Modal de detalle con timeline de actividad y campo de nota rápida
- Alerta visual (borde rojo pulsante) para cotizaciones frías/estancadas
- Responsive: en mobile las columnas se apilan verticalmente

- [ ] **Step 2: Agregar HTML de sección pipeline en `panel/dashboard.html`**

```html
<section id="sec-pipeline" class="panel-section">
  <link rel="stylesheet" href="css/pipeline.css">
  <div class="panel-toolbar">
    <h2 class="panel-section-title">PIPELINE DE SEGUIMIENTO</h2>
    <div class="pipeline-legend">
      <span class="legend-item legend-cold">Fría (&gt;3d)</span>
      <span class="legend-item legend-stale">Estancada (&gt;5d)</span>
    </div>
  </div>

  <div class="pipeline-board" id="pipelineBoard">
    <!-- Las columnas se generan dinámicamente por pipeline.js -->
  </div>

  <!-- Modal detalle con timeline -->
  <div class="bnk-overlay" id="pipeDetailOverlay">
    <div class="bnk-modal" style="max-width:700px">
      <div class="bnk-modal-header">
        <span class="bnk-modal-title" id="pipeDetailTitle">DETALLE</span>
        <button class="bnk-modal-close" id="pipeDetailClose">&times;</button>
      </div>
      <div class="bnk-modal-body">
        <div id="pipeDetailInfo"></div>
        <div class="pipe-timeline-header">HISTORIAL DE ACTIVIDAD</div>
        <div id="pipeTimeline" class="pipe-timeline"></div>
        <div class="pipe-note-box">
          <textarea id="pipeNoteInput" class="bnk-textarea" rows="2" placeholder="Agregar nota de seguimiento..."></textarea>
          <button id="pipeNoteBtn" class="panel-btn-primary" style="margin-top:8px">AGREGAR NOTA</button>
        </div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Crear `panel/js/pages/pipeline.js`**

```javascript
// pipeline.js — Vista kanban de pipeline
(function () {
  'use strict';

  var ESTADOS = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];
  var COLORES = {
    'Recorrido': 'var(--tx)', 'Cotizada': 'var(--ylw)', 'Negociación': '#FF9800',
    'Cerrada': 'var(--g)', 'En Producción': '#2196F3', 'Ejecutado': '#4CAF50',
    'Cancelada': 'var(--red)', 'Perdida': '#9E9E9E'
  };
  var CONFIG = { diasFria: 3, diasEstancada: 5 };

  var _data = [];
  var _unsubscribe = null;

  function init() {
    // Cargar config de alertas
    BNK_DB.config.get('alertas').then(function (cfg) {
      if (cfg) {
        CONFIG.diasFria = cfg.diasFria || 3;
        CONFIG.diasEstancada = cfg.diasEstancada || 5;
      }
    });

    _unsubscribe = BNK_DB.cotizaciones.onSnapshot(function (docs) {
      _data = docs;
      _render();
    });

    _bindEvents();
  }

  function _render() {
    var board = document.getElementById('pipelineBoard');
    if (!board) return;

    var html = '';
    ESTADOS.forEach(function (estado) {
      var cards = _data.filter(function (d) { return (d.estado || 'Cotizada') === estado; });
      var totalMonto = cards.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);

      html += '<div class="pipeline-col">'
        + '<div class="pipeline-col-header" style="border-color:' + COLORES[estado] + '">'
        + '<span class="pipeline-col-title">' + estado.toUpperCase() + '</span>'
        + '<span class="pipeline-col-count">' + cards.length + '</span>'
        + '<span class="pipeline-col-total">' + _formatMXN(totalMonto) + '</span>'
        + '</div>'
        + '<div class="pipeline-col-body">';

      cards.forEach(function (d) {
        var diasEnEstado = _diasDesde(d.updatedAt);
        var alertClass = '';
        if (estado === 'Cotizada' && diasEnEstado > CONFIG.diasFria) alertClass = 'pipeline-card--cold';
        if (estado === 'Negociación' && diasEnEstado > CONFIG.diasEstancada) alertClass = 'pipeline-card--stale';

        html += '<div class="pipeline-card ' + alertClass + '" data-id="' + _esc(d.id) + '">'
          + '<div class="pipeline-card-cliente">' + _esc(d.cliente) + '</div>'
          + '<div class="pipeline-card-evento">' + _esc(d.evento || '\u2014') + '</div>'
          + '<div class="pipeline-card-footer">'
          + '<span class="pipeline-card-monto">' + _formatMXN(d.total) + '</span>'
          + '<span class="pipeline-card-tiempo">' + _tiempoDisplay(diasEnEstado) + '</span>'
          + '</div>'
          + '</div>';
      });

      html += '</div></div>';
    });

    board.innerHTML = html;
  }

  function _diasDesde(timestamp) {
    if (!timestamp) return 0;
    var fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    var diff = Date.now() - fecha.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function _tiempoDisplay(dias) {
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'ayer';
    return 'hace ' + dias + 'd';
  }

  function _bindEvents() {
    // Click en tarjeta → abrir detalle
    document.getElementById('pipelineBoard').addEventListener('click', function (e) {
      var card = e.target.closest('.pipeline-card');
      if (!card) return;
      var id = card.getAttribute('data-id');
      _openDetail(id);
    });

    // Cerrar modal
    document.getElementById('pipeDetailClose').addEventListener('click', _closeDetail);
    document.getElementById('pipeDetailOverlay').addEventListener('click', function (e) {
      if (e.target === this) _closeDetail();
    });

    // Agregar nota
    document.getElementById('pipeNoteBtn').addEventListener('click', function () {
      var nota = document.getElementById('pipeNoteInput').value.trim();
      if (!nota || !_currentDetailId) return;
      var user = BNK_AUTH.currentUser();
      BNK_DB.actividad.add(_currentDetailId, {
        tipo: 'nota',
        usuario: user ? user.nombre : 'Sistema',
        nota: nota
      }).then(function () {
        document.getElementById('pipeNoteInput').value = '';
        _loadTimeline(_currentDetailId);
      });
    });
  }

  var _currentDetailId = null;

  function _openDetail(id) {
    _currentDetailId = id;
    var d = _data.find(function (x) { return x.id === id; });
    if (!d) return;

    document.getElementById('pipeDetailTitle').textContent = d.folio || 'DETALLE';

    var info = '<div class="pipe-detail-grid">'
      + '<div><span class="bnk-label">CLIENTE</span><div>' + _esc(d.cliente) + '</div></div>'
      + '<div><span class="bnk-label">EVENTO</span><div>' + _esc(d.evento || '\u2014') + '</div></div>'
      + '<div><span class="bnk-label">TIPO</span><div>' + _esc(d.fuente || 'MNT') + '</div></div>'
      + '<div><span class="bnk-label">TOTAL</span><div>' + _formatMXN(d.total) + '</div></div>'
      + '<div><span class="bnk-label">ESTADO</span><div>'
      + '<select id="pipeDetailEstado" class="bnk-input" style="max-width:200px">' + _estadoOpts(d.estado) + '</select>'
      + '</div></div>'
      + '</div>';
    document.getElementById('pipeDetailInfo').innerHTML = info;

    // Bind cambio de estado en detalle
    document.getElementById('pipeDetailEstado').addEventListener('change', function () {
      var newEstado = this.value;
      var user = BNK_AUTH.currentUser();
      BNK_DB.cotizaciones.update(id, { estado: newEstado }).then(function () {
        BNK_DB.actividad.add(id, {
          tipo: 'cambio_estado',
          estado: newEstado,
          usuario: user ? user.nombre : 'Sistema',
          nota: ''
        });
        _loadTimeline(id);
      });
    });

    _loadTimeline(id);
    document.getElementById('pipeDetailOverlay').classList.add('visible');
  }

  function _loadTimeline(id) {
    BNK_DB.actividad.list(id).then(function (entries) {
      var html = '';
      entries.forEach(function (entry) {
        var fecha = entry.fecha ? (entry.fecha.toDate ? entry.fecha.toDate().toLocaleString('es-MX') : entry.fecha) : '';
        var icon = entry.tipo === 'cambio_estado' ? '\u25B6' : '\u270E';
        var text = entry.tipo === 'cambio_estado'
          ? 'Cambió estado a <strong>' + _esc(entry.estado) + '</strong>'
          : _esc(entry.nota);

        html += '<div class="pipe-timeline-entry">'
          + '<span class="pipe-timeline-icon">' + icon + '</span>'
          + '<div class="pipe-timeline-content">'
          + '<div class="pipe-timeline-text">' + text + '</div>'
          + '<div class="pipe-timeline-meta">' + _esc(entry.usuario) + ' — ' + fecha + '</div>'
          + '</div>'
          + '</div>';
      });
      document.getElementById('pipeTimeline').innerHTML = html || '<div style="color:var(--tx);font-size:12px">Sin actividad registrada</div>';
    });
  }

  function _closeDetail() {
    _currentDetailId = null;
    document.getElementById('pipeDetailOverlay').classList.remove('visible');
  }

  function _estadoOpts(current) {
    return ESTADOS.map(function (e) {
      return '<option value="' + e + '"' + (e === current ? ' selected' : '') + '>' + e + '</option>';
    }).join('');
  }

  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user && (user.rol === 'admin' || user.rol === 'ventas')) init();
  });

  window.BNKPipeline = { load: function () {} };
})();
```

- [ ] **Step 4: Agregar scripts a `panel/dashboard.html`**

```html
<script src="js/pages/pipeline.js"></script>
```

- [ ] **Step 5: Probar pipeline**

1. Login → tab PIPELINE
2. Ver columnas con tarjetas distribuidas por estado
3. Click en tarjeta → ver detalle con timeline
4. Cambiar estado → verificar que se mueve de columna
5. Agregar nota → verificar que aparece en timeline
6. Verificar alertas visuales en tarjetas frías/estancadas

- [ ] **Step 6: Commit**

```bash
git add panel/
git commit -m "feat(panel): pipeline kanban con timeline, notas y alertas de seguimiento"
```

---

## FASE 3: REPORTES

---

### Task 11: Módulo de reportes y métricas

**Files:**
- Create: `panel/js/pages/reportes.js` (4 reportes + KPIs)
- Create: `panel/css/reportes.css` (estilos de barras, tablas de reporte)
- Modify: `panel/dashboard.html` (HTML de sección reportes)

**Interfaces:**
- Consumes: `BNK_DB.cotizaciones`, `BNK_AUTH`
- Produces: 4 reportes: funnel, actividad mensual, top clientes, rendimiento

- [ ] **Step 1: Crear HTML de sección reportes en `panel/dashboard.html`**

```html
<section id="sec-reportes" class="panel-section">
  <link rel="stylesheet" href="css/reportes.css">
  <div class="panel-toolbar">
    <h2 class="panel-section-title">REPORTES</h2>
    <div class="reportes-periodo">
      <select id="repPeriodo" class="bnk-input" style="max-width:200px">
        <option value="mes">Este mes</option>
        <option value="trimestre">Último trimestre</option>
        <option value="anio">Este año</option>
        <option value="todo">Todo</option>
      </select>
    </div>
  </div>
  <div class="reportes-grid">
    <div class="reporte-card" id="repFunnel"></div>
    <div class="reporte-card" id="repMensual"></div>
    <div class="reporte-card" id="repTopClientes"></div>
    <div class="reporte-card" id="repRendimiento"></div>
  </div>
</section>
```

- [ ] **Step 2: Crear `panel/css/reportes.css`**

Estilos para grid de reportes (2x2 en desktop, 1 columna en mobile), barras horizontales del funnel con colores por estado, tablas de reporte compactas, indicadores de tendencia (flechas arriba/abajo).

- [ ] **Step 3: Crear `panel/js/pages/reportes.js`**

Módulo con los 4 reportes. Cada reporte es una función que recibe los datos filtrados por período y renderiza HTML en su contenedor. Sin librería de gráficas — barras con divs, porcentajes con width%.

Funciones clave:
- `_renderFunnel(data)` — barras horizontales por estado del pipeline con monto y count
- `_renderMensual(data)` — tabla mes a mes con enviadas, cerradas, canceladas, monto, ticket
- `_renderTopClientes(data)` — ranking por monto, con barras proporcionales
- `_renderRendimiento(data)` — tiempo promedio de cierre, tasa conversión, cotizaciones/semana

- [ ] **Step 4: Agregar scripts y probar**

```html
<script src="js/pages/reportes.js"></script>
```

Probar con datos reales de Firestore. Cambiar filtro de período y verificar que los reportes se actualizan.

- [ ] **Step 5: Commit**

```bash
git add panel/
git commit -m "feat(panel): módulo de reportes — funnel, actividad mensual, top clientes, rendimiento"
```

---

## FASE 4: PRODUCCIÓN Y CALENDARIO

---

### Task 12: Ficha de evento y checklist de producción

**Files:**
- Create: `panel/js/pages/eventos.js` (ficha de evento, checklist, plantillas)
- Create: `panel/css/eventos.css` (estilos del checklist y ficha)
- Modify: `panel/dashboard.html` (agregar sección eventos dentro de pipeline o como sub-vista)
- Modify: `panel/js/pages/pipeline.js` (trigger creación de evento al cerrar cotización)

**Interfaces:**
- Consumes: `BNK_DB.eventos`, `BNK_DB.tareas`, `BNK_DB.plantillas`, `BNK_DB.cotizaciones`, `BNK_AUTH`
- Produces: Ficha de evento con checklist editable, asignación de responsables, progreso

- [ ] **Step 1: Crear plantillas semilla en Firestore**

Desde la consola de Firebase o via script, crear documentos en colección `plantillas`:

```javascript
// Plantilla: Evento en Foro
{
  nombre: "Evento en Foro",
  tareas: [
    { descripcion: "Confirmar fechas de montaje", orden: 1 },
    { descripcion: "Reservar espacios en calendario", orden: 2 },
    { descripcion: "Rider técnico recibido", orden: 3 },
    { descripcion: "Proveedores confirmados", orden: 4 },
    { descripcion: "Audio e iluminación", orden: 5 },
    { descripcion: "Montaje escenografía", orden: 6 },
    { descripcion: "Ensayo general", orden: 7 },
    { descripcion: "Evento", orden: 8 },
    { descripcion: "Desmontaje", orden: 9 }
  ]
}
```

- [ ] **Step 2: Modificar `pipeline.js` — al cambiar estado a "Cerrada", generar evento**

En el handler de cambio de estado, agregar lógica:

```javascript
if (newEstado === 'Cerrada') {
  _crearEvento(id, d);
}
```

Donde `_crearEvento` muestra un modal para seleccionar plantilla de checklist y responsable, luego crea el documento en `eventos/` y las tareas en la subcollection.

- [ ] **Step 3: Crear `panel/js/pages/eventos.js`**

Módulo que maneja la vista de producción:
- Lista de eventos con estado y progreso
- Click en evento → ficha con checklist
- Cada tarea: checkbox completar, asignar responsable (dropdown de usuarios), fecha límite
- Barra de progreso por evento
- Vista filtrada por rol: producción solo ve los suyos

- [ ] **Step 4: Crear `panel/css/eventos.css`**

Estilos del checklist (items con checkbox, responsable, fecha, animación al completar), barra de progreso, ficha de evento.

- [ ] **Step 5: Probar flujo completo**

1. En pipeline, cambiar cotización a "Cerrada" → se abre selector de plantilla
2. Seleccionar plantilla → se crea evento con tareas
3. Login como producción → ver solo eventos asignados
4. Marcar tareas como completadas → barra de progreso avanza
5. Al completar todo → estado cambia a "Ejecutado"

- [ ] **Step 6: Commit**

```bash
git add panel/
git commit -m "feat(panel): ficha de evento con checklist de producción y plantillas"
```

---

### Task 13: Calendario de eventos con estados de reserva

**Files:**
- Create: `panel/js/pages/calendario.js` (vista mensual con estados de reserva)
- Create: `panel/css/calendario.css` (grid mensual, bloques de evento coloreados)
- Modify: `panel/dashboard.html` (HTML de sección calendario)

**Interfaces:**
- Consumes: `BNK_DB.cotizaciones`, `BNK_DB.eventos`, `BNK_AUTH`
- Produces: Calendario mensual con filtro por espacio y estados Cotizado/Confirmado/Bloqueado

- [ ] **Step 1: Crear `panel/css/calendario.css`**

Grid CSS de 7 columnas (Lu-Do), celdas con día, bloques de evento coloreados por estado (amarillo cotizado, verde confirmado, rojo bloqueado), filtro de espacios como pills, controles de navegación mes anterior/siguiente.

- [ ] **Step 2: Agregar HTML de sección calendario en `panel/dashboard.html`**

```html
<section id="sec-calendario" class="panel-section">
  <link rel="stylesheet" href="css/calendario.css">
  <div class="panel-toolbar">
    <h2 class="panel-section-title">CALENDARIO DE EVENTOS</h2>
    <div class="cal-nav">
      <button id="calPrev" class="panel-btn-icon">&larr;</button>
      <span id="calMesAnio" class="cal-mes-label"></span>
      <button id="calNext" class="panel-btn-icon">&rarr;</button>
    </div>
  </div>
  <div class="cal-filtros" id="calFiltros">
    <button class="cal-filtro active" data-espacio="todos">TODOS</button>
    <button class="cal-filtro" data-espacio="FORO">FORO</button>
    <button class="cal-filtro" data-espacio="JARDÍN SOCIAL">JARDÍN</button>
    <button class="cal-filtro" data-espacio="AUDITORIO">AUDITORIO</button>
    <button class="cal-filtro" data-espacio="BLACK BOX">BLACK BOX</button>
    <button class="cal-filtro" data-espacio="LOBBY">LOBBY</button>
  </div>
  <div class="cal-legend">
    <span class="cal-legend-item cal-legend--cotizado">Cotizado</span>
    <span class="cal-legend-item cal-legend--confirmado">Confirmado</span>
    <span class="cal-legend-item cal-legend--bloqueado">Bloqueado</span>
  </div>
  <div class="cal-grid" id="calGrid"></div>
</section>
```

- [ ] **Step 3: Crear `panel/js/pages/calendario.js`**

```javascript
// calendario.js — Vista mensual con estados de reserva
(function () {
  'use strict';

  var _mes = new Date().getMonth();
  var _anio = new Date().getFullYear();
  var _espacioFiltro = 'todos';
  var _cotizaciones = [];
  var _eventos = [];

  function init() {
    BNK_DB.cotizaciones.onSnapshot(function (docs) {
      _cotizaciones = docs;
      _render();
    });
    BNK_DB.eventos.list().then(function (evts) {
      _eventos = evts;
      _render();
    });
    _bindEvents();
    _render();
  }

  function _render() {
    // Actualizar label del mes
    var meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    var label = document.getElementById('calMesAnio');
    if (label) label.textContent = meses[_mes] + ' ' + _anio;

    var grid = document.getElementById('calGrid');
    if (!grid) return;

    // Generar días del mes
    var primerDia = new Date(_anio, _mes, 1);
    var ultimoDia = new Date(_anio, _mes + 1, 0);
    var startDay = (primerDia.getDay() + 6) % 7; // Lunes = 0

    // Header días
    var html = '<div class="cal-header">LU</div><div class="cal-header">MA</div>'
      + '<div class="cal-header">MI</div><div class="cal-header">JU</div>'
      + '<div class="cal-header">VI</div><div class="cal-header">SA</div>'
      + '<div class="cal-header">DO</div>';

    // Celdas vacías antes del día 1
    for (var i = 0; i < startDay; i++) {
      html += '<div class="cal-cell cal-cell--empty"></div>';
    }

    // Días del mes
    for (var d = 1; d <= ultimoDia.getDate(); d++) {
      var fecha = _anio + '-' + String(_mes + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var bloques = _getBloquesDelDia(fecha);

      html += '<div class="cal-cell">'
        + '<span class="cal-day">' + d + '</span>';

      bloques.forEach(function (b) {
        html += '<div class="cal-bloque cal-bloque--' + b.tipo + '" title="' + _esc(b.cliente + ' — ' + b.evento) + '">'
          + _esc(b.label)
          + '</div>';
      });

      html += '</div>';
    }

    grid.innerHTML = html;
  }

  function _getBloquesDelDia(fecha) {
    var bloques = [];

    // Cotizaciones con fecha de evento en este día (estado no cerrado = cotizado)
    _cotizaciones.forEach(function (c) {
      var fechaEvento = c.fechaEvento || '';
      if (fechaEvento.substring(0, 10) !== fecha) return;
      if (_espacioFiltro !== 'todos') {
        var espacios = (c.espacios || '').toUpperCase();
        if (espacios.indexOf(_espacioFiltro.toUpperCase()) === -1) return;
      }
      var estadosCerrados = ['Cerrada', 'En Producción', 'Ejecutado'];
      var tipo = estadosCerrados.indexOf(c.estado) !== -1 ? 'confirmado' : 'cotizado';
      bloques.push({
        tipo: tipo,
        cliente: c.cliente || '',
        evento: c.evento || '',
        label: (c.cliente || '').substring(0, 12)
      });
    });

    return bloques;
  }

  function _bindEvents() {
    document.getElementById('calPrev').addEventListener('click', function () {
      _mes--;
      if (_mes < 0) { _mes = 11; _anio--; }
      _render();
    });
    document.getElementById('calNext').addEventListener('click', function () {
      _mes++;
      if (_mes > 11) { _mes = 0; _anio++; }
      _render();
    });
    document.getElementById('calFiltros').addEventListener('click', function (e) {
      var btn = e.target.closest('.cal-filtro');
      if (!btn) return;
      document.querySelectorAll('.cal-filtro').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      _espacioFiltro = btn.getAttribute('data-espacio');
      _render();
    });
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });

  window.BNKCalendario = {};
})();
```

- [ ] **Step 4: Agregar scripts y probar**

```html
<script src="js/pages/calendario.js"></script>
```

Probar: navegar meses, filtrar por espacio, ver bloques cotizado vs confirmado.

- [ ] **Step 5: Commit**

```bash
git add panel/
git commit -m "feat(panel): calendario mensual con estados de reserva y filtro por espacio"
```

---

## FASE 5: CATÁLOGO DE PRECIOS

---

### Task 14: Catálogo de precios editable

**Files:**
- Create: `panel/js/pages/catalogo.js` (CRUD de catálogo de precios)
- Modify: `panel/dashboard.html` (HTML de sección catálogo)

**Interfaces:**
- Consumes: `BNK_DB.catalogo`, `BNK_AUTH`
- Produces: Tabla editable de precios con categoría, concepto, unidad, precio

- [ ] **Step 1: Agregar HTML de sección catálogo en `panel/dashboard.html`**

```html
<section id="sec-catalogo" class="panel-section">
  <div class="panel-toolbar">
    <h2 class="panel-section-title">CATÁLOGO DE PRECIOS</h2>
    <input type="text" id="catSearch" class="dash-search" placeholder="Buscar concepto..." style="max-width:300px">
    <button id="btnNuevoConcepto" class="panel-btn-primary">+ NUEVO CONCEPTO</button>
  </div>
  <table class="dash-table" id="catTable">
    <thead>
      <tr>
        <th>CATEGORÍA</th>
        <th>CONCEPTO</th>
        <th>UNIDAD</th>
        <th>PRECIO</th>
        <th>ESTADO</th>
        <th>ACCIONES</th>
      </tr>
    </thead>
    <tbody id="catBody"></tbody>
  </table>

  <!-- Modal concepto -->
  <div class="bnk-overlay" id="catOverlay">
    <div class="bnk-modal" style="max-width:500px">
      <div class="bnk-modal-header">
        <span class="bnk-modal-title" id="catModalTitle">NUEVO CONCEPTO</span>
        <button class="bnk-modal-close" id="catClose">&times;</button>
      </div>
      <div class="bnk-modal-body">
        <input type="hidden" id="catId">
        <div class="bnk-form-grid">
          <div class="bnk-form-group">
            <label class="bnk-label">CATEGORÍA</label>
            <select class="bnk-input" id="catCategoria">
              <option value="Audio">Audio</option>
              <option value="Iluminación">Iluminación</option>
              <option value="Video">Video</option>
              <option value="Escenografía">Escenografía</option>
              <option value="Venue">Venue</option>
              <option value="Streaming">Streaming</option>
              <option value="Personal">Personal</option>
              <option value="Catering">Catering</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CONCEPTO</label>
            <input type="text" class="bnk-input" id="catConcepto" placeholder="Nombre del servicio">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">UNIDAD</label>
            <input type="text" class="bnk-input" id="catUnidad" placeholder="evento, jornada, pieza...">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">PRECIO</label>
            <input type="number" class="bnk-input" id="catPrecio" placeholder="0" min="0" step="0.01">
          </div>
        </div>
      </div>
      <div class="bnk-modal-footer">
        <button class="panel-btn-secondary" id="catCancel">CANCELAR</button>
        <button class="panel-btn-primary" id="catGuardar">GUARDAR</button>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Crear `panel/js/pages/catalogo.js`**

Módulo IIFE con CRUD sobre `BNK_DB.catalogo`. Patrón igual que usuarios.js:
- `load()` → `BNK_DB.catalogo.list()` → render tabla
- Búsqueda por texto (filtro en cliente)
- Modal crear/editar con campos categoría, concepto, unidad, precio
- Toggle activo/inactivo por concepto
- Solo accesible para admin y ventas (`BNK_AUTH.canEdit('catalogo')`)

- [ ] **Step 3: Agregar script y probar**

```html
<script src="js/pages/catalogo.js"></script>
```

1. Crear concepto nuevo → verificar en Firestore
2. Editar precio → verificar actualización
3. Buscar por texto
4. Desactivar concepto

- [ ] **Step 4: Commit**

```bash
git add panel/
git commit -m "feat(panel): catálogo de precios editable con CRUD sobre Firestore"
```

---

## FASE 6: MIGRACIÓN COMPLETA (FUTURA)

---

### Task 15: Migrar wizard público a Firestore y eliminar dependencia de Sheets

**Files:**
- Modify: `cotizador-munet/js/cotizador-munet.js` (cambiar escritura de Apps Script a Firestore)
- Modify: `cotizador-munet/index.html` (agregar Firebase SDK)
- Modify: `cotizador-munet/google-apps-script-munet.js` (eliminar doble escritura, dejar solo Firestore)

**Interfaces:**
- Consumes: Firebase Firestore directamente desde el wizard
- Produces: Wizard escribiendo a Firestore, eliminando dependencia de Sheets

**Nota:** Esta task se ejecuta solo cuando las Fases 1-5 están estables y validadas en producción. No se implementa inmediatamente.

- [ ] **Step 1: Agregar Firebase SDK al wizard público**

En `cotizador-munet/index.html`, agregar los scripts de Firebase (compat) en el `<head>` y el `firebase-config.js` adaptado (sin Auth, solo Firestore anónimo con reglas especiales).

- [ ] **Step 2: Crear regla de Firestore para escritura anónima de cotizaciones MNT**

Agregar regla que permita crear documentos en `cotizaciones/` sin autenticación (solo crear, no leer ni actualizar):

```
match /cotizaciones/{docId} {
  allow create: if true; // Wizard público puede crear
  // Resto de reglas existentes para usuarios autenticados
}
```

- [ ] **Step 3: Modificar `cotizador-munet.js` para escribir a Firestore**

Reemplazar el `fetch()` a Apps Script por escritura directa a Firestore. Mantener la generación de PDF en cliente. Para el upload a Drive y envío de email, crear una Cloud Function que se dispare con un Firestore trigger (onCreate en `cotizaciones/`).

- [ ] **Step 4: Crear Cloud Function para PDF y email**

Cloud Function que detecta nueva cotización en Firestore, genera el enlace de Drive y envía email (reemplazando lo que hacía Apps Script).

- [ ] **Step 5: Eliminar doble escritura de Apps Script**

Remover las llamadas a `writeToFirestore()` del `google-apps-script-munet.js`. El Apps Script ya no es necesario para cotizaciones (puede mantenerse como respaldo o eliminarse).

- [ ] **Step 6: Testing completo end-to-end**

1. Cliente llena wizard → cotización aparece en Firestore → dashboard la muestra en real-time
2. PDF se genera y se sube a Drive via Cloud Function
3. Email se envía al cliente
4. Ventas ve la cotización en pipeline y comienza seguimiento

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: migración completa — wizard escribe a Firestore, eliminar dependencia de Sheets"
```

---

## Resumen de archivos por fase

### Fase 1 (Tasks 1-9)
```
panel/
├── index.html                    (login)
├── dashboard.html                (shell + módulos)
├── css/
│   ├── login.css
│   └── panel.css
├── js/
│   ├── firebase-config.js
│   ├── auth.js
│   ├── guard.js
│   ├── firestore.js
│   └── pages/
│       ├── cotizaciones.js
│       ├── clientes.js
│       ├── proveedores.js
│       └── usuarios.js
functions/
└── index.js                      (Cloud Function createUser)
firestore.rules
scripts/
└── migrate-sheets-to-firestore.js
```

### Fase 2 (Task 10)
```
panel/css/pipeline.css
panel/js/pages/pipeline.js
```

### Fase 3 (Task 11)
```
panel/css/reportes.css
panel/js/pages/reportes.js
```

### Fase 4 (Tasks 12-13)
```
panel/css/eventos.css
panel/css/calendario.css
panel/js/pages/eventos.js
panel/js/pages/calendario.js
```

### Fase 5 (Task 14)
```
panel/js/pages/catalogo.js
```

### Fase 6 (Task 15)
```
Modificaciones a archivos existentes del wizard
```
