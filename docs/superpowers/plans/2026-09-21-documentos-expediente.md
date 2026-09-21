# Documentos de Expediente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow uploading, viewing, versioning, and deleting PDF/JPG/PNG documents (RFC, INE, comprobante domicilio, etc.) within client, vendor, and partner profiles in the BUNKER panel.

**Architecture:** A shared IIFE module `BNKDocumentos` handles all upload/download/delete/versioning logic against Firebase Storage + Firestore subcollections. Each entity modal (clientes, proveedores, partners) adds a "Documentos" tab that delegates to this module. Storage security rules enforce auth + admin-only delete.

**Tech Stack:** Firebase Storage compat SDK 10.12.0, Firebase Firestore (existing), vanilla JS IIFEs, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-09-21-documentos-expediente-design.md`

## Global Constraints

- Vanilla HTML/CSS/JS — no build tools, no bundler, no transpiler
- Firebase compat mode SDK 10.12.0 (already loaded for auth/firestore)
- All user-facing text in Spanish
- CSS: no `!important`, use design tokens from `:root` in `panel.css`
- Module pattern: IIFE exposing on `window.*`
- Admin role check: `BNK_AUTH.currentRole() === 'admin'`
- File formats: PDF, JPG, JPEG, PNG only. Max 10 MB per file
- Firestore subcollection path: `{entidad}/{entityId}/documentos/{docId}`
- Storage path: `documentos/{entidad}/{entityId}/{tipo}/{timestamp}_{filename}`

---

### Task 1: Firebase Storage Infrastructure

**Files:**
- Modify: `panel/dashboard.html:13` (add Storage SDK script tag)
- Modify: `panel/js/firebase-config.js:18-22` (expose `storage`)
- Modify: `panel/js/firestore.js:120-187` (add `documentosAPI`)
- Modify: `firestore.rules:43-61,89-91` (add subcollection rules)
- Create: `storage.rules`

**Interfaces:**
- Consumes: `BNK_FIREBASE.db` (existing), `firebase.storage()` (new)
- Produces: `BNK_FIREBASE.storage` (Storage instance), `BNK_DB.documentos(entidad, entityId)` returning `{ list(), listByTipo(tipo), create(data), update(id, data), delete(id) }`

- [ ] **Step 1: Add Firebase Storage SDK to dashboard.html**

In `panel/dashboard.html`, after line 13 (`firebase-firestore-compat.js`), add:

```html
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js"></script>
```

- [ ] **Step 2: Expose storage in firebase-config.js**

In `panel/js/firebase-config.js`, change lines 18-22 from:

```js
  window.BNK_FIREBASE = {
    app: firebase.app(),
    auth: firebase.auth(),
    db: firebase.firestore()
  };
```

to:

```js
  window.BNK_FIREBASE = {
    app: firebase.app(),
    auth: firebase.auth(),
    db: firebase.firestore(),
    storage: firebase.storage()
  };
```

- [ ] **Step 3: Add documentosAPI to firestore.js**

In `panel/js/firestore.js`, before the `// ── API pública ──` comment (line 167), add:

```js
  // ── Documentos de expediente (subcollection genérica) ──
  function documentosAPI(entidad, entityId) {
    var ref = db.collection(entidad).doc(entityId).collection('documentos');
    return {
      list: function () {
        return ref.orderBy('subidoEn', 'desc').get().then(function (snap) {
          return snap.docs.map(function (doc) {
            var d = doc.data(); d.id = doc.id; return d;
          });
        });
      },
      listByTipo: function (tipo) {
        return ref.where('tipo', '==', tipo).orderBy('subidoEn', 'desc').get().then(function (snap) {
          return snap.docs.map(function (doc) {
            var d = doc.data(); d.id = doc.id; return d;
          });
        });
      },
      create: function (data) {
        data.subidoEn = firebase.firestore.FieldValue.serverTimestamp();
        return ref.add(data).then(function (r) { data.id = r.id; return data; });
      },
      update: function (id, data) {
        return ref.doc(id).update(data);
      },
      delete: function (id) {
        return ref.doc(id).delete();
      }
    };
  }
```

Then in the `window.BNK_DB` object (line 168), add after the `bloques` line (line 182):

```js
    documentos:            documentosAPI,
```

- [ ] **Step 4: Add Firestore rules for documentos subcollections**

In `firestore.rules`, add a `documentos` subcollection rule inside the `clientes` match block (after line 45):

```
      match /documentos/{docId} {
        allow read: if isAuthenticated();
        allow create, update: if isAuthenticated();
        allow delete: if isAdmin();
      }
```

Add the same block inside the `proveedores` match (after line 50, before the `servicios` block):

```
      match /documentos/{docId} {
        allow read: if isAuthenticated();
        allow create, update: if isAuthenticated();
        allow delete: if isAdmin();
      }
```

Add the same block inside the `partners` match (after line 90):

```
      match /documentos/{docId} {
        allow read: if isAuthenticated();
        allow create, update: if isAuthenticated();
        allow delete: if isAdmin();
      }
```

Add a collection group rule for documentos (after line 116, before the closing `}`):

```
    match /{path=**}/documentos/{docId} {
      allow read: if isAuthenticated();
    }
```

- [ ] **Step 5: Create storage.rules**

Create file `storage.rules` at project root:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /documentos/{entidad}/{entityId}/{tipo}/{fileName} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
        && request.resource.size < 10 * 1024 * 1024
        && request.resource.contentType.matches('application/pdf|image/jpeg|image/png');
      allow delete: if request.auth != null
        && firestore.get(/databases/(default)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin';
    }
  }
}
```

- [ ] **Step 6: Update firebase.json to deploy storage rules**

Check if `firebase.json` already has a `storage` section. If not, add `"storage": { "rules": "storage.rules" }` at the top level.

- [ ] **Step 7: Verify — open panel in browser**

Open `panel/dashboard.html` in browser. Open DevTools console. Verify:
- No errors loading the page
- `BNK_FIREBASE.storage` exists and is a Storage instance: type `BNK_FIREBASE.storage` in console
- `BNK_DB.documentos` is a function: type `typeof BNK_DB.documentos`
- `BNK_DB.documentos('clientes', 'test').list` is a function

- [ ] **Step 8: Commit**

```bash
git add panel/dashboard.html panel/js/firebase-config.js panel/js/firestore.js firestore.rules storage.rules firebase.json
git commit -m "feat: add Firebase Storage infrastructure for document uploads"
```

---

### Task 2: CSS Styles for Document Tab

**Files:**
- Modify: `panel/css/panel.css` (append ~80 lines of doc styles)

**Interfaces:**
- Consumes: CSS tokens `--card`, `--bd`, `--g`, `--gd`, `--wh`, `--tx`, `--bk`, `--ylw`, `--red`
- Produces: CSS classes `.doc-header`, `.doc-indicador`, `.doc-list`, `.doc-card`, `.doc-card-header`, `.doc-badge-req`, `.doc-archivo`, `.doc-meta`, `.doc-actions`, `.doc-dropzone`, `.doc-dropzone.dragover`, `.doc-historial`, `.doc-historial-item`, `.doc-libre-row`, `.doc-progress`

- [ ] **Step 1: Add document tab styles to panel.css**

Append at the end of `panel/css/panel.css`:

```css
/* ── Documentos de expediente ── */
.doc-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.doc-header h3{font-family:'Barlow Condensed',sans-serif;font-size:16px;letter-spacing:2px;color:var(--wh);margin:0}
.doc-indicador{font-family:'Space Mono',monospace;font-size:13px;color:var(--tx);background:var(--bk);border:1px solid var(--bd);padding:4px 12px;border-radius:4px}
.doc-indicador b{color:var(--g)}
.doc-list{display:flex;flex-direction:column;gap:12px}
.doc-card{background:var(--card);border:1px solid var(--bd);padding:16px;transition:border-color .2s}
.doc-card:hover{border-color:rgba(0,255,65,0.25)}
.doc-card.doc-card--empty{border-style:dashed}
.doc-card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.doc-card-header span{font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:1.5px;color:var(--wh)}
.doc-badge-req{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:var(--ylw);border:1px solid var(--ylw);padding:2px 8px;border-radius:2px}
.doc-archivo{display:flex;align-items:center;gap:10px;padding:8px 0}
.doc-archivo-icon{font-size:20px;opacity:.7}
.doc-archivo-name{font-size:13px;color:var(--wh);word-break:break-all}
.doc-archivo-size{font-size:11px;color:var(--tx);white-space:nowrap}
.doc-meta{font-size:11px;color:var(--tx);margin-bottom:8px}
.doc-actions{display:flex;gap:8px;flex-wrap:wrap}
.doc-actions button{font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:1px;padding:4px 12px;border:1px solid var(--bd);background:transparent;color:var(--tx);cursor:pointer;transition:all .2s}
.doc-actions button:hover{color:var(--wh);border-color:var(--g)}
.doc-actions button.doc-btn-del{color:var(--red);border-color:var(--red)}
.doc-actions button.doc-btn-del:hover{background:var(--red);color:var(--bk)}
.doc-dropzone{border:2px dashed var(--bd);padding:24px;text-align:center;cursor:pointer;transition:all .2s}
.doc-dropzone:hover,.doc-dropzone.dragover{border-color:var(--g);background:rgba(0,255,65,0.03)}
.doc-dropzone p{font-size:13px;color:var(--tx);margin:0 0 4px}
.doc-dropzone small{font-size:11px;color:var(--tx);opacity:.6}
.doc-dropzone input[type="file"]{display:none}
.doc-historial{margin-top:8px;padding-top:8px;border-top:1px solid var(--bd);display:none}
.doc-historial.visible{display:block}
.doc-historial-item{display:flex;justify-content:space-between;align-items:center;padding:4px 0;opacity:.55}
.doc-historial-item span{font-size:11px;color:var(--tx)}
.doc-historial-item button{font-size:10px;padding:2px 8px;border:1px solid var(--bd);background:transparent;color:var(--tx);cursor:pointer}
.doc-libre-row{display:flex;gap:8px;align-items:center}
.doc-libre-row input{flex:1;font-size:13px;padding:8px 12px;background:var(--bk);border:1px solid var(--bd);color:var(--wh);font-family:'Barlow',sans-serif}
.doc-libre-row button{white-space:nowrap}
.doc-progress{width:100%;height:3px;background:var(--bd);margin-top:8px;border-radius:2px;overflow:hidden;display:none}
.doc-progress.visible{display:block}
.doc-progress-bar{height:100%;background:var(--g);width:0;transition:width .3s}
@media(max-width:768px){
  .doc-card{padding:12px}
  .doc-header{flex-direction:column;gap:8px;align-items:flex-start}
  .doc-actions{gap:4px}
  .doc-actions button{padding:4px 8px;font-size:10px}
}
```

- [ ] **Step 2: Verify — inspect styles**

Open panel in browser, open DevTools. Create a temporary element with class `doc-card` in Elements panel. Confirm it picks up background, border, padding from the new styles.

- [ ] **Step 3: Commit**

```bash
git add panel/css/panel.css
git commit -m "feat: add CSS styles for document upload tab"
```

---

### Task 3: Documentos Module (`documentos.js`)

**Files:**
- Create: `panel/js/pages/documentos.js`

**Interfaces:**
- Consumes: `BNK_FIREBASE.storage`, `BNK_DB.documentos(entidad, entityId)`, `BNK_AUTH.currentRole()`, `BNK_AUTH.currentUser()`, `BNKToast.ok/warn/error(msg)`
- Produces: `window.BNKDocumentos.render(container, opts)`, `window.BNKDocumentos.getIndicador(entidad, entityId)`, `window.BNKDocumentos.destroy()`

- [ ] **Step 1: Create the module scaffold with types catalog and state**

Create `panel/js/pages/documentos.js`:

```js
/* panel/js/pages/documentos.js — Documentos de expediente */
(function () {
  'use strict';

  var TIPOS = [
    { key: 'rfc',        nombre: 'Constancia de Situación Fiscal',  req: { clientes: true,  proveedores: true,  partners: true  } },
    { key: 'domicilio',  nombre: 'Comprobante de Domicilio',        req: { clientes: false, proveedores: true,  partners: false } },
    { key: 'ine',        nombre: 'INE / Identificación Oficial',    req: { clientes: false, proveedores: true,  partners: true  } },
    { key: 'opinion32d', nombre: 'Opinión de Cumplimiento (32-D)',  req: { clientes: false, proveedores: true,  partners: false } },
    { key: 'caratula',   nombre: 'Carátula Bancaria',               req: { clientes: false, proveedores: true,  partners: true  } },
    { key: 'acta',       nombre: 'Acta Constitutiva',               req: { clientes: false, proveedores: true,  partners: false } },
    { key: 'poder',      nombre: 'Poder Notarial',                  req: { clientes: false, proveedores: false, partners: false } }
  ];

  var MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  var ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  var ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png'];

  // ── State ──
  var _container = null;
  var _opts = null;       // { entidad, entityId }
  var _docs = [];         // all docs from Firestore subcollection
  var _unsubscribe = null;

  // ── Helpers ──
  function _isAdmin() {
    return BNK_AUTH.currentRole() === 'admin';
  }

  function _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function _formatDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function _validateFile(file) {
    var ext = '.' + file.name.split('.').pop().toLowerCase();
    if (ALLOWED_EXT.indexOf(ext) === -1) {
      BNKToast.error('Formato no válido. Solo PDF, JPG o PNG.');
      return false;
    }
    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
      BNKToast.error('Tipo MIME no permitido: ' + file.type);
      return false;
    }
    if (file.size > MAX_SIZE) {
      BNKToast.error('El archivo excede 10 MB (' + _formatSize(file.size) + ')');
      return false;
    }
    return true;
  }

  function _storagePath(tipo, file) {
    var ts = Date.now();
    var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    return 'documentos/' + _opts.entidad + '/' + _opts.entityId + '/' + tipo + '/' + ts + '_' + safeName;
  }

  // ── Upload logic ──
  function _upload(file, tipo, tipoNombre, progressBar) {
    var path = _storagePath(tipo, file);
    var ref = BNK_FIREBASE.storage.ref(path);
    var metadata = { contentType: file.type };
    var task = ref.put(file, metadata);

    if (progressBar) {
      progressBar.parentElement.classList.add('visible');
    }

    return new Promise(function (resolve, reject) {
      task.on('state_changed',
        function (snap) {
          if (progressBar) {
            var pct = (snap.bytesTransferred / snap.totalBytes) * 100;
            progressBar.style.width = pct + '%';
          }
        },
        function (err) {
          if (progressBar) progressBar.parentElement.classList.remove('visible');
          BNKToast.error('Error al subir: ' + err.message);
          reject(err);
        },
        function () {
          task.snapshot.ref.getDownloadURL().then(function (url) {
            if (progressBar) progressBar.parentElement.classList.remove('visible');
            resolve({ url: url, path: path });
          });
        }
      );
    });
  }

  function _handleUpload(file, tipo, tipoNombre, progressBar) {
    if (!_validateFile(file)) return Promise.reject('invalid');

    var api = BNK_DB.documentos(_opts.entidad, _opts.entityId);
    var user = BNK_AUTH.currentUser();

    return _upload(file, tipo, tipoNombre, progressBar).then(function (result) {
      // Mark previous vigente doc as non-vigente
      var prev = _docs.filter(function (d) { return d.tipo === tipo && d.vigente; });
      var updates = prev.map(function (d) { return api.update(d.id, { vigente: false }); });

      return Promise.all(updates).then(function () {
        return api.create({
          tipo: tipo,
          tipoNombre: tipoNombre,
          nombreArchivo: file.name,
          contentType: file.type,
          tamano: file.size,
          storagePath: result.path,
          downloadURL: result.url,
          vigente: true,
          subidoPor: user ? user.email : 'desconocido'
        });
      });
    }).then(function () {
      BNKToast.ok('Documento subido correctamente');
      return _loadDocs();
    });
  }

  // ── Delete logic ──
  function _deleteDoc(doc) {
    if (!_isAdmin()) { BNKToast.error('Solo admin puede eliminar'); return Promise.resolve(); }
    if (!confirm('¿Eliminar "' + doc.nombreArchivo + '"?')) return Promise.resolve();

    var api = BNK_DB.documentos(_opts.entidad, _opts.entityId);
    var storageRef = BNK_FIREBASE.storage.ref(doc.storagePath);

    return storageRef.delete().catch(function () {
      // File may already be gone — continue
    }).then(function () {
      return api.delete(doc.id);
    }).then(function () {
      // Promote most recent non-vigente of same type
      var sameType = _docs.filter(function (d) { return d.id !== doc.id && d.tipo === doc.tipo; });
      if (sameType.length > 0) {
        var newest = sameType[0]; // already sorted desc by subidoEn
        return api.update(newest.id, { vigente: true });
      }
    }).then(function () {
      BNKToast.warn('Documento eliminado');
      return _loadDocs();
    });
  }

  // ── Load & render ──
  function _loadDocs() {
    var api = BNK_DB.documentos(_opts.entidad, _opts.entityId);
    return api.list().then(function (docs) {
      _docs = docs;
      _render();
    });
  }

  function _getVigente(tipo) {
    return _docs.filter(function (d) { return d.tipo === tipo && d.vigente; })[0] || null;
  }

  function _getHistorial(tipo) {
    return _docs.filter(function (d) { return d.tipo === tipo && !d.vigente; });
  }

  function _getLibres() {
    var fixedKeys = TIPOS.map(function (t) { return t.key; });
    var libres = {};
    _docs.forEach(function (d) {
      if (fixedKeys.indexOf(d.tipo) === -1) {
        if (!libres[d.tipo]) libres[d.tipo] = { nombre: d.tipoNombre, docs: [] };
        libres[d.tipo].docs.push(d);
      }
    });
    return libres;
  }

  function _render() {
    if (!_container || !_opts) return;
    var entidad = _opts.entidad;
    var isAdm = _isAdmin();

    // Count required
    var requeridos = TIPOS.filter(function (t) { return t.req[entidad]; });
    var completados = requeridos.filter(function (t) { return _getVigente(t.key); }).length;

    var html = '';
    // Header
    html += '<div class="doc-header">';
    html += '<h3>DOCUMENTOS</h3>';
    html += '<span class="doc-indicador"><b>' + completados + '/' + requeridos.length + '</b> requeridos</span>';
    html += '</div>';
    html += '<div class="doc-list">';

    // Fixed types
    TIPOS.forEach(function (t) {
      var vigente = _getVigente(t.key);
      var historial = _getHistorial(t.key);
      var esReq = t.req[entidad];

      html += '<div class="doc-card' + (vigente ? '' : ' doc-card--empty') + '" data-tipo="' + t.key + '">';
      html += '<div class="doc-card-header">';
      html += '<span>' + t.nombre + '</span>';
      if (esReq) html += '<span class="doc-badge-req">REQ</span>';
      html += '</div>';

      if (vigente) {
        html += _renderVigente(vigente, t.key, t.nombre, historial, isAdm);
      } else {
        html += _renderEmpty(t.key, t.nombre);
      }

      html += '</div>'; // .doc-card
    });

    // Libre documents
    var libres = _getLibres();
    Object.keys(libres).forEach(function (key) {
      var libre = libres[key];
      var vigente = libre.docs.filter(function (d) { return d.vigente; })[0];
      var historial = libre.docs.filter(function (d) { return !d.vigente; });

      html += '<div class="doc-card" data-tipo="' + key + '">';
      html += '<div class="doc-card-header">';
      html += '<span>' + libre.nombre + ' <small style="opacity:.5">(libre)</small></span>';
      html += '</div>';

      if (vigente) {
        html += _renderVigente(vigente, key, libre.nombre, historial, isAdm);
      } else {
        html += _renderEmpty(key, libre.nombre);
      }

      html += '</div>';
    });

    // Add libre row
    html += '<div class="doc-card doc-card--empty">';
    html += '<div class="doc-libre-row">';
    html += '<input type="text" placeholder="Nombre del documento..." id="docLibreNombre">';
    html += '<button class="doc-actions" id="docLibreSubir">SUBIR</button>';
    html += '</div>';
    html += '</div>';

    html += '</div>'; // .doc-list

    _container.innerHTML = html;
    _bindEvents();
  }

  function _renderVigente(doc, tipo, tipoNombre, historial, isAdm) {
    var h = '';
    var icon = doc.contentType === 'application/pdf' ? '📄' : '🖼️';
    h += '<div class="doc-archivo">';
    h += '<span class="doc-archivo-icon">' + icon + '</span>';
    h += '<span class="doc-archivo-name">' + doc.nombreArchivo + '</span>';
    h += '<span class="doc-archivo-size">' + _formatSize(doc.tamano) + '</span>';
    h += '</div>';
    h += '<div class="doc-meta">Subido: ' + _formatDate(doc.subidoEn) + ' por ' + (doc.subidoPor || '—') + '</div>';
    h += '<div class="doc-actions">';
    h += '<button data-action="download" data-url="' + doc.downloadURL + '">DESCARGAR</button>';
    h += '<button data-action="replace" data-tipo="' + tipo + '" data-nombre="' + tipoNombre + '">REEMPLAZAR</button>';
    if (historial.length > 0) {
      h += '<button data-action="historial" data-tipo="' + tipo + '">HISTORIAL (' + historial.length + ')</button>';
    }
    if (isAdm) {
      h += '<button class="doc-btn-del" data-action="delete" data-docid="' + doc.id + '">ELIMINAR</button>';
    }
    h += '</div>';
    // Progress bar for replace
    h += '<div class="doc-progress"><div class="doc-progress-bar"></div></div>';
    // Hidden file input for replace
    h += '<input type="file" accept=".pdf,.jpg,.jpeg,.png" data-fileinput="' + tipo + '" style="display:none">';
    // Historial
    if (historial.length > 0) {
      h += '<div class="doc-historial" data-hist="' + tipo + '">';
      historial.forEach(function (d) {
        h += '<div class="doc-historial-item">';
        h += '<span>' + _formatDate(d.subidoEn) + ' — ' + d.nombreArchivo + ' (' + _formatSize(d.tamano) + ')</span>';
        h += '<button data-action="download" data-url="' + d.downloadURL + '">Descargar</button>';
        h += '</div>';
      });
      h += '</div>';
    }
    return h;
  }

  function _renderEmpty(tipo, tipoNombre) {
    var h = '';
    h += '<div class="doc-dropzone" data-drop="' + tipo + '" data-nombre="' + tipoNombre + '">';
    h += '<p>Arrastra un archivo o haz clic para seleccionar</p>';
    h += '<small>PDF, JPG, PNG — máx 10 MB</small>';
    h += '<input type="file" accept=".pdf,.jpg,.jpeg,.png" data-fileinput="' + tipo + '">';
    h += '</div>';
    h += '<div class="doc-progress"><div class="doc-progress-bar"></div></div>';
    return h;
  }

  // ── Event binding ──
  function _bindEvents() {
    if (!_container) return;

    // Delegation
    _container.addEventListener('click', _handleClick);

    // Drag & drop on dropzones
    var zones = _container.querySelectorAll('.doc-dropzone');
    zones.forEach(function (zone) {
      zone.addEventListener('click', function () {
        var inp = zone.querySelector('input[type="file"]');
        if (inp) inp.click();
      });
      zone.addEventListener('dragover', function (e) {
        e.preventDefault(); zone.classList.add('dragover');
      });
      zone.addEventListener('dragleave', function () {
        zone.classList.remove('dragover');
      });
      zone.addEventListener('drop', function (e) {
        e.preventDefault(); zone.classList.remove('dragover');
        var file = e.dataTransfer.files[0];
        if (!file) return;
        var tipo = zone.getAttribute('data-drop');
        var nombre = zone.getAttribute('data-nombre');
        var bar = zone.parentElement.querySelector('.doc-progress-bar');
        _handleUpload(file, tipo, nombre, bar);
      });
    });

    // File inputs (both dropzone and replace)
    var inputs = _container.querySelectorAll('input[type="file"]');
    inputs.forEach(function (inp) {
      inp.addEventListener('change', function () {
        if (!this.files[0]) return;
        var tipo = this.getAttribute('data-fileinput');
        // Find tipo nombre from TIPOS or from card header
        var tipoObj = TIPOS.filter(function (t) { return t.key === tipo; })[0];
        var nombre = tipoObj ? tipoObj.nombre : (this.closest('.doc-card').querySelector('.doc-card-header span').textContent.trim());
        var bar = this.closest('.doc-card').querySelector('.doc-progress-bar');
        _handleUpload(this.files[0], tipo, nombre, bar);
      });
    });

    // Libre upload
    var libreBtn = _container.querySelector('#docLibreSubir');
    if (libreBtn) {
      libreBtn.addEventListener('click', function () {
        var nameInput = _container.querySelector('#docLibreNombre');
        var nombre = nameInput ? nameInput.value.trim() : '';
        if (!nombre) { BNKToast.error('Escribe un nombre para el documento'); return; }
        // Create a safe key from the name
        var key = 'libre_' + nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
        // Create a file input and trigger it
        var inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.pdf,.jpg,.jpeg,.png';
        inp.addEventListener('change', function () {
          if (!inp.files[0]) return;
          var bar = libreBtn.closest('.doc-card').querySelector('.doc-progress-bar');
          _handleUpload(inp.files[0], key, nombre, bar).then(function () {
            if (nameInput) nameInput.value = '';
          });
        });
        inp.click();
      });
    }
  }

  function _handleClick(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');

    if (action === 'download') {
      window.open(btn.getAttribute('data-url'), '_blank');
    }
    if (action === 'replace') {
      var tipo = btn.getAttribute('data-tipo');
      var inp = _container.querySelector('input[data-fileinput="' + tipo + '"]');
      if (inp) inp.click();
    }
    if (action === 'historial') {
      var hTipo = btn.getAttribute('data-tipo');
      var panel = _container.querySelector('[data-hist="' + hTipo + '"]');
      if (panel) panel.classList.toggle('visible');
    }
    if (action === 'delete') {
      var docId = btn.getAttribute('data-docid');
      var doc = _docs.filter(function (d) { return d.id === docId; })[0];
      if (doc) _deleteDoc(doc);
    }
  }

  // ── Public API ──
  function render(container, opts) {
    destroy();
    _container = container;
    _opts = opts; // { entidad: 'clientes'|'proveedores'|'partners', entityId: 'CLI-0012' }
    _container.innerHTML = '<p style="color:var(--tx);font-size:13px">Cargando documentos...</p>';
    _loadDocs();
  }

  function getIndicador(entidad, entityId) {
    var api = BNK_DB.documentos(entidad, entityId);
    return api.list().then(function (docs) {
      var requeridos = TIPOS.filter(function (t) { return t.req[entidad]; });
      var vigentes = docs.filter(function (d) { return d.vigente; });
      var completados = requeridos.filter(function (t) {
        return vigentes.some(function (d) { return d.tipo === t.key; });
      }).length;
      return { completados: completados, requeridos: requeridos.length, total: docs.filter(function (d) { return d.vigente; }).length };
    });
  }

  function destroy() {
    if (_container) {
      _container.removeEventListener('click', _handleClick);
      _container.innerHTML = '';
    }
    _container = null;
    _opts = null;
    _docs = [];
  }

  window.BNKDocumentos = {
    render: render,
    getIndicador: getIndicador,
    destroy: destroy
  };
})();
```

- [ ] **Step 2: Verify — check module loads**

Add the script tag temporarily in `dashboard.html` (will be done properly in Task 4). Open browser console and verify `typeof BNKDocumentos` returns `'object'` and `typeof BNKDocumentos.render` returns `'function'`.

- [ ] **Step 3: Commit**

```bash
git add panel/js/pages/documentos.js
git commit -m "feat: add BNKDocumentos module for document uploads"
```

---

### Task 4: HTML — Add Documentos Tab to All Three Modals

**Files:**
- Modify: `panel/dashboard.html:659-663` (clientes modal tabs)
- Modify: `panel/dashboard.html:817-822` (proveedores modal tabs)
- Modify: `panel/dashboard.html:1658-1661` (partners modal tabs)
- Modify: `panel/dashboard.html:1843-1853` (partner tab switching inline script)
- Modify: `panel/dashboard.html:1984-1998` (script tags)

**Interfaces:**
- Consumes: existing modal HTML structure, `BNKDocumentos.render()`
- Produces: `#cliTabDocumentos`, `#prvTabDocumentos`, `#ptrTabDocumentos` container divs; `documentos.js` script loaded before consumer modules

- [ ] **Step 1: Add Documentos tab to clientes modal**

In `panel/dashboard.html`, at line 663 (after the BANCARIOS tab button), add:

```html
            <button class="modal-tab" data-target="cliTabDocumentos">DOCUMENTOS</button>
```

Find the closing `</div>` of `cliTabBancarios` (the last tab content div in the clientes modal). After it, add:

```html
          <!-- Tab Documentos -->
          <div class="modal-tab-content" id="cliTabDocumentos" style="display:none"></div>
```

- [ ] **Step 2: Add Documentos tab to proveedores modal**

At line 822 (after the SERVICIOS tab button), add:

```html
            <button class="modal-tab" data-target="prvTabDocumentos">DOCUMENTOS</button>
```

Find the closing `</div>` of `prvTabServicios` (the last tab content div in the proveedores modal). After it, add:

```html
          <!-- Tab Documentos -->
          <div class="modal-tab-content" id="prvTabDocumentos" style="display:none"></div>
```

- [ ] **Step 3: Add Documentos tab to partners modal**

At line 1661 (after the bancarios tab button in the partner modal), add:

```html
            <button class="modal-tab" data-ptr-tab="documentos">DOCUMENTOS</button>
```

Find the closing `</div>` of `ptrTabBancarios` (the last tab content div in the partner modal). After it, add:

```html
          <!-- Tab Documentos -->
          <div class="modal-tab-content" id="ptrTabDocumentos" style="display:none"></div>
```

- [ ] **Step 4: Update partner tab switching inline script**

In the inline `<script>` block at line 1848, the array currently lists:

```js
      ['general', 'contacto', 'bancarios'].forEach(function (t) {
```

Change it to:

```js
      ['general', 'contacto', 'bancarios', 'documentos'].forEach(function (t) {
```

- [ ] **Step 5: Add documentos.js script tag**

In the script tags section (line 1984+), add `documentos.js` BEFORE `clientes.js` (since clientes/proveedores/finanzas consume it). After line 1986 (`pdf-workorder.js`), add:

```html
<script src="js/pages/documentos.js?v=1"></script>
```

- [ ] **Step 6: Verify — check tabs appear**

Open panel in browser. Open a client modal — confirm 5 tabs show, "DOCUMENTOS" is the last. Open a proveedor modal — confirm 6 tabs, "DOCUMENTOS" is last. Open a partner modal — confirm 4 tabs, "DOCUMENTOS" is last. Clicking each tab should show an empty div (no content yet — integration comes in next tasks).

- [ ] **Step 7: Commit**

```bash
git add panel/dashboard.html
git commit -m "feat: add Documentos tab to client, vendor, and partner modals"
```

---

### Task 5: Integration — Clientes Module

**Files:**
- Modify: `panel/js/pages/clientes.js` (modal open + close functions)

**Interfaces:**
- Consumes: `BNKDocumentos.render(container, opts)`, `BNKDocumentos.destroy()`, `#cliTabDocumentos` DOM element
- Produces: Documents tab functional in clientes modal

- [ ] **Step 1: Add BNKDocumentos.render() call in abrirModal**

In `panel/js/pages/clientes.js`, find the `abrirModal` function. Locate the line that adds `.visible` to the overlay (approximately `document.getElementById('cliOverlay').classList.add('visible')`). Just BEFORE that line, add:

```js
      // Render documentos tab
      var cliDocContainer = document.getElementById('cliTabDocumentos');
      var cliDocId = document.getElementById('cliId').value;
      if (cliDocContainer && cliDocId) {
        BNKDocumentos.render(cliDocContainer, { entidad: 'clientes', entityId: cliDocId });
      }
```

Note: `cliId` is populated earlier in `abrirModal` from `clienteData.id`. This code runs after that. For new clients (no ID yet), the tab will remain empty — documents can only be uploaded to saved clients.

- [ ] **Step 2: Add BNKDocumentos.destroy() call in cerrarModal**

In `cerrarModal`, at the beginning of the function (right after removing `.visible` from the overlay), add:

```js
      BNKDocumentos.destroy();
```

- [ ] **Step 3: Verify — test upload flow in a client**

1. Open panel → Clientes → open an existing client
2. Click "DOCUMENTOS" tab
3. Verify the 7 types appear with correct REQ badges (only RFC should say REQ for clientes)
4. Verify the "0/1 requeridos" indicator
5. Upload a PDF to RFC — confirm toast, confirm file shows
6. Close modal, reopen — confirm document persists
7. Upload a replacement — confirm versioning (old goes to historial)

- [ ] **Step 4: Commit**

```bash
git add panel/js/pages/clientes.js
git commit -m "feat: integrate document uploads in clientes modal"
```

---

### Task 6: Integration — Proveedores Module

**Files:**
- Modify: `panel/js/pages/proveedores.js` (modal open + close functions)

**Interfaces:**
- Consumes: `BNKDocumentos.render(container, opts)`, `BNKDocumentos.destroy()`, `#prvTabDocumentos` DOM element
- Produces: Documents tab functional in proveedores modal

- [ ] **Step 1: Add BNKDocumentos.render() call in abrirModal**

In `panel/js/pages/proveedores.js`, find the `abrirModal` function. Locate the line that adds `.visible` to the overlay (`document.getElementById('prvOverlay').classList.add('visible')`). Just BEFORE that line, add:

```js
      // Render documentos tab
      var prvDocContainer = document.getElementById('prvTabDocumentos');
      var prvDocId = document.getElementById('prvId').value;
      if (prvDocContainer && prvDocId) {
        BNKDocumentos.render(prvDocContainer, { entidad: 'proveedores', entityId: prvDocId });
      }
```

- [ ] **Step 2: Add BNKDocumentos.destroy() call in cerrarModal**

In `cerrarModal`, at the beginning (right after removing `.visible` from `#prvOverlay`), add:

```js
      BNKDocumentos.destroy();
```

- [ ] **Step 3: Verify — test upload flow in a proveedor**

1. Open panel → Proveedores → open an existing proveedor
2. Click "DOCUMENTOS" tab
3. Verify 7 types with 6 REQ badges (all except Poder Notarial)
4. Verify "0/6 requeridos" indicator
5. Upload documents to several types — confirm uploads, toasts, persistence
6. Test drag & drop on an empty slot
7. Test "Agregar documento libre" — enter name, select file, confirm it appears

- [ ] **Step 4: Commit**

```bash
git add panel/js/pages/proveedores.js
git commit -m "feat: integrate document uploads in proveedores modal"
```

---

### Task 7: Integration — Partners (Finanzas Module)

**Files:**
- Modify: `panel/js/pages/finanzas.js` (partner modal open + close)

**Interfaces:**
- Consumes: `BNKDocumentos.render(container, opts)`, `BNKDocumentos.destroy()`, `#ptrTabDocumentos` DOM element
- Produces: Documents tab functional in partners modal

- [ ] **Step 1: Add BNKDocumentos.render() call in _openPartnerModal**

In `panel/js/pages/finanzas.js`, find `_openPartnerModal`. Locate the call to `_modal('finPartnerOverlay', true)` (the line that shows the modal). Just BEFORE that line, add:

```js
      // Render documentos tab
      var ptrDocContainer = document.getElementById('ptrTabDocumentos');
      var ptrDocId = document.getElementById('finPartnerId').value;
      if (ptrDocContainer && ptrDocId) {
        BNKDocumentos.render(ptrDocContainer, { entidad: 'partners', entityId: ptrDocId });
      }
```

- [ ] **Step 2: Add BNKDocumentos.destroy() call on partner modal close**

Find where the partner modal close buttons (`finPartnerCancel`, `finPartnerClose`) call `_modal('finPartnerOverlay', false)`. After that call (or in the same handler), add:

```js
      BNKDocumentos.destroy();
```

If close is handled via an event listener like:
```js
document.getElementById('finPartnerCancel').addEventListener('click', function () {
  _modal('finPartnerOverlay', false);
});
```
Add the destroy call inside that same callback.

- [ ] **Step 3: Verify — test upload flow in a partner**

1. Open panel → Finanzas → Partners → open an existing partner
2. Click "DOCUMENTOS" tab
3. Verify 7 types with 3 REQ badges (RFC, INE, Carátula Bancaria)
4. Verify "0/3 requeridos" indicator
5. Upload a document, confirm it works
6. Test historial with version replacement
7. Test delete with admin role — confirm button appears and works
8. Test with non-admin role — confirm delete button is hidden

- [ ] **Step 4: Commit**

```bash
git add panel/js/pages/finanzas.js
git commit -m "feat: integrate document uploads in partners modal"
```

---

### Task 8: Deploy & Final Verification

**Files:**
- No file changes — deployment and verification only

**Interfaces:**
- Consumes: all previous tasks completed
- Produces: live deployed feature

- [ ] **Step 1: Deploy storage rules**

```bash
firebase deploy --only storage --project bunker-panel
```

- [ ] **Step 2: Deploy firestore rules**

```bash
firebase deploy --only firestore:rules --project bunker-panel
```

- [ ] **Step 3: Deploy hosting**

```bash
firebase deploy --only hosting --project bunker-panel
```

- [ ] **Step 4: Verify on live site**

Open `bunker-panel.web.app/dashboard`. Test:
1. Open a client → Documentos tab → upload a PDF → confirm stored
2. Open a proveedor → Documentos tab → upload a JPG → confirm stored
3. Open a partner → Documentos tab → upload a PNG → confirm stored
4. Verify file > 10 MB is rejected with toast error
5. Verify `.exe` file is rejected
6. Verify non-admin user cannot see delete buttons
7. Verify admin user can delete and version promotes correctly
8. Close and reopen modal — confirm docs persist from Firestore

- [ ] **Step 5: Final commit (if any deploy config adjustments)**

```bash
git add -A
git commit -m "chore: deploy document uploads feature"
```
