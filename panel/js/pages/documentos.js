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
    html += '<div class="doc-progress"><div class="doc-progress-bar"></div></div>';
    html += '</div>';

    html += '</div>'; // .doc-list

    _container.removeEventListener('click', _handleClick);
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
