// cotizar-bnk.js — Formulario para cotizar servicios/producción BNK
(function () {
  'use strict';

  var _clientes = [];
  var _catalogo = [];
  var _proveedores = [];
  var _allServicios = [];
  var _allBloques = [];
  var _serviciosCategorias = [];
  var _conceptoCounter = 0;
  var _pdfStyle = 'neon';

  var PLANTILLAS = {
    estandar: '1. Precios más IVA.\n2. Vigencia de la cotización: 30 días.\n3. 60% de anticipo para confirmación y bloqueo de fecha.\n4. 40% restante: 5 días naturales previos al evento.\n5. Servicios y/o equipos adicionales serán cotizados por separado.\n6. Cancelaciones: una vez confirmado el servicio, el anticipo no será reembolsado.',
    estructura: '1. Precios más IVA.\n2. Vigencia de la cotización: 30 días.\n3. 60% de anticipo para confirmación y bloqueo de fecha.\n4. 40% restante: 5 días naturales previos al evento.\n5. La Estructura está sujeta a condiciones de pago específicas: 80% de anticipo y 20% al inicio de montaje.\n6. Servicios y/o equipos adicionales serán cotizados por separado.\n7. Cancelaciones: una vez confirmado el servicio, el anticipo no será reembolsado.\n8. El precio del seguro de responsabilidad civil se calculará 30 días antes del evento y deberá ser liquidado por el cliente.',
    especial: '1. Presupuesto tipo ballpark previo a brief de cliente; si los requerimientos exceden lo cotizado, se hará un ajuste.\n2. No incluye creación de arte adicional a lo especificado; en caso de requerirla, se cotizará por separado.\n3. Se requiere un mínimo de 1 mes para la realización del proyecto.\n4. Cambios en la información ya proporcionada pueden afectar los costos.\n5. 50% de anticipo para iniciar el proyecto; liquidación contraentrega.\n6. Entregables editables: costo adicional del 40% del total.\n7. Costo por cancelación: 85%.'
  };

  var CATEGORIAS = ['Servicios Básicos', 'Mobiliario', 'A&B', 'Estructura', 'Contenido/Mapping', 'Suministros', 'Otro'];

  function init() {
    Promise.all([
      BNK_DB.clientes.list(),
      BNK_DB.catalogo.list(),
      BNK_DB.proveedores.list(),
      BNK_DB.allServicios(),
      BNK_DB.allBloques()
    ]).then(function (results) {
      _clientes = results[0];
      _catalogo = results[1].filter(function (c) { return c.categoria !== 'Venues' && c.activo !== false; });
      _proveedores = results[2];
      _allServicios = results[3];
      _allBloques = results[4];

      // Extract unique service categories from providers
      var catSet = {};
      _allServicios.forEach(function (s) { if (s.categoria) catSet[s.categoria] = true; });
      _serviciosCategorias = Object.keys(catSet).sort();

      _bindEvents();
      _setCondiciones('estandar');
      _agregarFila();
      _restoreBnkDraft();
      // Auto-save draft on input
      BNK_DRAFT_FIELDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', _saveBnkDraft);
      });
    });
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }

  function _generarFolio() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var arr = new Uint16Array(1);
    crypto.getRandomValues(arr);
    var rand = String(1000 + (arr[0] % 9000)).padStart(4, '0');
    return 'BNK-' + yy + mm + dd + '-' + rand;
  }

  // ── Selector de marca ──
  function _showMarcaSelector(prefix, clienteId) {
    var wrap = document.getElementById(prefix + 'MarcaWrap');
    var select = document.getElementById(prefix + 'Marca');
    if (!wrap || !select) return;

    var cliente = null;
    for (var i = 0; i < _clientes.length; i++) {
      if (_clientes[i].id === clienteId) { cliente = _clientes[i]; break; }
    }

    var marcas = cliente && window.BNKClientes ? BNKClientes.parseMarcas(cliente.marcas) : [];
    if (marcas.length === 0) {
      wrap.classList.remove('visible');
      select.innerHTML = '<option value="">\u2014 Sin marca \u2014</option>';
      return;
    }

    var html = '<option value="">\u2014 Seleccionar marca \u2014</option>';
    marcas.forEach(function (m) {
      html += '<option value="' + _esc(m) + '">' + _esc(m) + '</option>';
    });
    select.innerHTML = html;

    if (marcas.length === 1) {
      select.value = marcas[0];
    }

    wrap.classList.add('visible');
  }

  function _hideMarcaSelector(prefix) {
    var wrap = document.getElementById(prefix + 'MarcaWrap');
    if (wrap) wrap.classList.remove('visible');
  }

  // ── Autocompletado de clientes ──
  function _setupAutocomplete() {
    var input = document.getElementById('bnkEmpresa');
    var dropdown = document.getElementById('bnkAutoEmpresa');
    if (!input || !dropdown) return;

    var _acIndex = -1;

    function _acItems() { return dropdown.querySelectorAll('.bnk-ac-item'); }

    function _acHighlight(idx) {
      var items = _acItems();
      items.forEach(function (it) { it.classList.remove('bnk-ac-active'); });
      if (idx >= 0 && idx < items.length) {
        items[idx].classList.add('bnk-ac-active');
        items[idx].scrollIntoView({ block: 'nearest' });
      }
    }

    function _acSelect(item) {
      if (!item || item.classList.contains('bnk-ac-new')) {
        dropdown.classList.remove('visible');
        _hideMarcaSelector('bnk');
        return;
      }
      document.getElementById('bnkEmpresa').value = item.getAttribute('data-empresa') || '';
      document.getElementById('bnkContacto').value = item.getAttribute('data-contacto') || '';
      document.getElementById('bnkTelefono').value = item.getAttribute('data-telefono') || '';
      document.getElementById('bnkCorreo').value = item.getAttribute('data-correo') || '';
      dropdown.classList.remove('visible');
      _acIndex = -1;
      // Mostrar selector de marca si tiene marcas
      var clienteId = item.getAttribute('data-cliente-id') || '';
      _showMarcaSelector('bnk', clienteId);
    }

    input.addEventListener('input', function () {
      _acIndex = -1;
      var val = input.value.trim().toLowerCase();
      if (val.length < 2) { dropdown.classList.remove('visible'); return; }

      var matches = _clientes.filter(function (c) {
        var nombre = (c.empresa || c.razonSocial || '').toLowerCase();
        return nombre.indexOf(val) !== -1;
      });

      var html = '';
      matches.slice(0, 8).forEach(function (c) {
        var nombre = c.empresa || c.razonSocial || '';
        var marcasArr = window.BNKClientes ? BNKClientes.parseMarcas(c.marcas) : [];
        var marcasHint = marcasArr.length > 0 ? ' <span style="color:var(--tx);font-size:10px">(' + _esc(marcasArr.join(', ')) + ')</span>' : '';
        html += '<div class="bnk-ac-item" data-empresa="' + _esc(nombre)
          + '" data-contacto="' + _esc(c.personaContacto || '')
          + '" data-telefono="' + _esc(c.telefonoContacto || '')
          + '" data-correo="' + _esc(c.correoContacto || '')
          + '" data-cliente-id="' + _esc(c.id || '') + '">'
          + _esc(nombre) + marcasHint + '</div>';
      });
      if (matches.length === 0) {
        html = '<div class="bnk-ac-item bnk-ac-new">Nuevo: "' + _esc(input.value.trim()) + '"</div>';
      }
      dropdown.innerHTML = html;
      dropdown.classList.add('visible');
    });

    input.addEventListener('keydown', function (e) {
      if (!dropdown.classList.contains('visible')) return;
      var items = _acItems();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _acIndex = Math.min(_acIndex + 1, items.length - 1);
        _acHighlight(_acIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _acIndex = Math.max(_acIndex - 1, 0);
        _acHighlight(_acIndex);
      } else if (e.key === 'Enter') {
        if (_acIndex >= 0 && _acIndex < items.length) {
          e.preventDefault();
          _acSelect(items[_acIndex]);
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('visible');
        _acIndex = -1;
      }
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.bnk-ac-item');
      _acSelect(item);
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#bnkEmpresa') && !e.target.closest('#bnkAutoEmpresa')) {
        dropdown.classList.remove('visible');
        _acIndex = -1;
      }
    });
  }

  // ── Filas de conceptos (dual mode: manual + proveedor) ──
  function _agregarFila() {
    var body = document.getElementById('bnkConceptosBody');
    if (!body) return;
    var id = 'bc' + (_conceptoCounter++);

    var catOptions = '<option value="">\u2014</option>';
    CATEGORIAS.forEach(function (cat) {
      catOptions += '<option value="' + cat + '">' + cat + '</option>';
    });

    var prvCatOptions = '<option value="">\u2014 Tipo servicio \u2014</option>';
    _serviciosCategorias.forEach(function (cat) {
      prvCatOptions += '<option value="' + _esc(cat) + '">' + _esc(cat) + '</option>';
    });

    var row = document.createElement('div');
    row.className = 'bnk-concepto-row';
    row.id = id;
    row.setAttribute('data-modo', 'manual');

    row.innerHTML =
      '<button class="bnk-modo-toggle" data-row="' + id + '" title="Cambiar modo">&#9881;</button>'
      // Manual mode fields
      + '<div class="bnk-modo-manual">'
      +   '<select class="bnk-cat" data-row="' + id + '" data-label="Categor\xEDa">' + catOptions + '</select>'
      +   '<input type="text" class="bnk-con" data-row="' + id + '" data-label="Concepto" placeholder="Buscar concepto..." list="dl-' + id + '"><datalist id="dl-' + id + '"></datalist>'
      + '</div>'
      // Provider mode fields
      + '<div class="bnk-modo-proveedor" style="display:none">'
      +   '<select class="bnk-prv-cat" data-row="' + id + '">' + prvCatOptions + '</select>'
      +   '<select class="bnk-prv-prov" data-row="' + id + '"><option value="">\u2014 Proveedor \u2014</option></select>'
      +   '<select class="bnk-prv-srv" data-row="' + id + '"><option value="">\u2014 Servicio \u2014</option></select>'
      + '</div>'
      // Shared fields
      + '<input type="number" class="bnk-cant" data-row="' + id + '" data-label="Cant." value="1" min="1" step="1">'
      + '<input type="text" class="bnk-uni" data-row="' + id + '" data-label="Unidad" value="servicio" placeholder="unidad">'
      + '<input type="number" class="bnk-pre" data-row="' + id + '" data-label="Precio" value="0" min="0" step="0.01">'
      + '<input type="hidden" class="bnk-costo-prov" data-row="' + id + '" value="0">'
      + '<input type="hidden" class="bnk-prov-id" data-row="' + id + '" value="">'
      + '<input type="hidden" class="bnk-prov-nombre" data-row="' + id + '" value="">'
      + '<input type="hidden" class="bnk-bloque-id" data-row="' + id + '" value="">'
      + '<input type="hidden" class="bnk-bloque-nombre" data-row="' + id + '" value="">'
      + '<span class="bnk-sub-val" data-row="' + id + '" data-label="Subtotal">$0</span>'
      + '<button class="bnk-del-btn" data-row="' + id + '">&times;</button>';
    body.appendChild(row);

    // Mode toggle
    row.querySelector('.bnk-modo-toggle').addEventListener('click', function () {
      _toggleModo(id);
    });

    // Manual mode events
    row.querySelector('.bnk-cat').addEventListener('change', function () { _actualizarDatalist(id); });
    row.querySelector('.bnk-con').addEventListener('change', function () { _autocompletarPrecio(id); });

    // Provider mode cascade events
    row.querySelector('.bnk-prv-cat').addEventListener('change', function () { _actualizarProveedores(id); });
    row.querySelector('.bnk-prv-prov').addEventListener('change', function () { _actualizarServiciosProv(id); });
    row.querySelector('.bnk-prv-srv').addEventListener('change', function () { _autocompletarPrecioProv(id); });

    // Shared events
    row.querySelector('.bnk-cant').addEventListener('input', function () { _recalcularFila(id); });
    row.querySelector('.bnk-pre').addEventListener('input', function () { _recalcularFila(id); });
    row.querySelector('.bnk-del-btn').addEventListener('click', function () {
      row.remove();
      _recalcularTotales();
      var remaining = document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row');
      if (remaining.length === 0) _agregarFila();
    });
  }

  function _toggleModo(rowId) {
    var row = document.getElementById(rowId);
    var modo = row.getAttribute('data-modo');
    var newModo = modo === 'manual' ? 'proveedor' : 'manual';
    row.setAttribute('data-modo', newModo);

    var manualDiv = row.querySelector('.bnk-modo-manual');
    var provDiv = row.querySelector('.bnk-modo-proveedor');
    manualDiv.style.display = newModo === 'manual' ? '' : 'none';
    provDiv.style.display = newModo === 'proveedor' ? '' : 'none';

    // Reset hidden fields
    row.querySelector('.bnk-costo-prov').value = '0';
    row.querySelector('.bnk-prov-id').value = '';
    row.querySelector('.bnk-prov-nombre').value = '';
    row.querySelector('.bnk-bloque-id').value = '';
    row.querySelector('.bnk-bloque-nombre').value = '';
  }

  function _actualizarProveedores(rowId) {
    var row = document.getElementById(rowId);
    var catSel = row.querySelector('.bnk-prv-cat').value;
    var provSel = row.querySelector('.bnk-prv-prov');

    // Filter providers that have services in this category
    var provIds = {};
    _allServicios.forEach(function (s) {
      if (s.categoria === catSel) provIds[s.proveedorId] = true;
    });

    var html = '<option value="">\u2014 Proveedor \u2014</option>';
    _proveedores.forEach(function (p) {
      if (provIds[p.id]) {
        html += '<option value="' + _esc(p.id) + '">' + _esc(p.razonSocial || p.nombreComercial || p.id) + '</option>';
      }
    });
    provSel.innerHTML = html;

    // Reset service select
    row.querySelector('.bnk-prv-srv').innerHTML = '<option value="">\u2014 Servicio \u2014</option>';
  }

  function _actualizarServiciosProv(rowId) {
    var row = document.getElementById(rowId);
    var catSel = row.querySelector('.bnk-prv-cat').value;
    var provId = row.querySelector('.bnk-prv-prov').value;
    var srvSel = row.querySelector('.bnk-prv-srv');

    var html = '<option value="">\u2014 Servicio \u2014</option>';

    // Add bloques for this provider+category
    _allBloques.forEach(function (b) {
      if (b.proveedorId === provId) {
        var hasCategory = _allServicios.some(function (s) {
          return s.bloqueId === b.id && s.categoria === catSel;
        });
        if (hasCategory) {
          html += '<option value="bloque:' + _esc(b.id) + '" data-tipo="bloque">'
            + '\uD83D\uDCE6 ' + _esc(b.nombre) + '</option>';
        }
      }
    });

    // Add individual services
    _allServicios.forEach(function (s) {
      if (s.proveedorId === provId && s.categoria === catSel && !s.bloqueId) {
        var srvPrecio = Number(s.precioCliente) > 0 ? s.precioCliente : (Number(s.costoUnitario) > 0 ? s.costoUnitario : 0);
        html += '<option value="srv:' + _esc(s.id) + '" data-precio="' + srvPrecio
          + '" data-costo="' + (s.costoUnitario || 0)
          + '" data-unidad="' + _esc(s.unidad || 'servicio') + '">'
          + _esc(s.servicio) + '</option>';
      }
    });

    srvSel.innerHTML = html;
  }

  function _autocompletarPrecioProv(rowId) {
    var row = document.getElementById(rowId);
    var srvSel = row.querySelector('.bnk-prv-srv');
    var val = srvSel.value;
    var provId = row.querySelector('.bnk-prv-prov').value;
    var provNombre = '';
    var opt = srvSel.options[srvSel.selectedIndex];

    // Find provider name
    _proveedores.forEach(function (p) {
      if (p.id === provId) provNombre = p.razonSocial || p.nombreComercial || '';
    });
    row.querySelector('.bnk-prov-id').value = provId;
    row.querySelector('.bnk-prov-nombre').value = provNombre;

    if (val.indexOf('bloque:') === 0) {
      var bloqueId = val.replace('bloque:', '');
      _expandBloque(rowId, bloqueId, provId, provNombre);
    } else if (val.indexOf('srv:') === 0) {
      var precio = parseFloat(opt.getAttribute('data-precio')) || 0;
      var costo = parseFloat(opt.getAttribute('data-costo')) || 0;
      var unidad = opt.getAttribute('data-unidad') || 'servicio';
      row.querySelector('.bnk-pre').value = precio;
      row.querySelector('.bnk-uni').value = unidad;
      row.querySelector('.bnk-costo-prov').value = costo;
      row.querySelector('.bnk-bloque-id').value = '';
      row.querySelector('.bnk-bloque-nombre').value = '';
      _recalcularFila(rowId);
    }
  }

  function _expandBloque(rowId, bloqueId, provId, provNombre) {
    var row = document.getElementById(rowId);
    var body = document.getElementById('bnkConceptosBody');

    // Find bloque
    var bloque = null;
    _allBloques.forEach(function (b) { if (b.id === bloqueId) bloque = b; });
    if (!bloque) return;

    // Find services in this block
    // Remove the originating row (if it exists — may be null when called from picker)
    var srvs = _allServicios.filter(function (s) {
      return s.bloqueId === bloqueId && s.proveedorId === provId;
    });

    // Replace current row with block services
    if (row) row.remove();

    srvs.forEach(function (srv) {
      var id = 'bc' + (_conceptoCounter++);
      var newRow = document.createElement('div');
      newRow.className = 'bnk-concepto-row bnk-bloque-child';
      newRow.id = id;
      newRow.setAttribute('data-modo', 'proveedor');
      newRow.innerHTML =
        '<span class="bnk-bloque-badge">' + _esc(bloque.nombre) + '</span>'
        + '<div class="bnk-modo-manual" style="display:none"></div>'
        + '<div class="bnk-modo-proveedor" style="display:none">'
        +   '<span class="bnk-prv-label">' + _esc(srv.servicio) + '</span>'
        + '</div>'
        + '<input type="number" class="bnk-cant" value="1" min="1" step="1">'
        + '<input type="text" class="bnk-uni" value="' + _esc(srv.unidad || 'servicio') + '">'
        + '<input type="number" class="bnk-pre" value="' + (Number(srv.precioCliente) > 0 ? srv.precioCliente : (Number(srv.costoUnitario) > 0 ? srv.costoUnitario : 0)) + '" min="0" step="0.01">'
        + '<input type="hidden" class="bnk-costo-prov" value="' + (srv.costoUnitario || 0) + '">'
        + '<input type="hidden" class="bnk-prov-id" value="' + _esc(provId) + '">'
        + '<input type="hidden" class="bnk-prov-nombre" value="' + _esc(provNombre) + '">'
        + '<input type="hidden" class="bnk-bloque-id" value="' + _esc(bloqueId) + '">'
        + '<input type="hidden" class="bnk-bloque-nombre" value="' + _esc(bloque.nombre) + '">'
        + '<input type="hidden" class="bnk-con" value="' + _esc(srv.servicio) + '">'
        + '<input type="hidden" class="bnk-cat" value="' + _esc(srv.categoria || '') + '">'
        + '<span class="bnk-sub-val">$0</span>'
        + '<button class="bnk-del-btn">&times;</button>';
      body.appendChild(newRow);

      newRow.querySelector('.bnk-cant').addEventListener('input', function () { _recalcularFila(id); });
      newRow.querySelector('.bnk-pre').addEventListener('input', function () { _recalcularFila(id); });
      newRow.querySelector('.bnk-del-btn').addEventListener('click', function () {
        newRow.remove(); _recalcularTotales();
      });
      _recalcularFila(id);
    });

    _recalcularTotales();
    _agregarFila();
  }

  function _actualizarDatalist(rowId) {
    var row = document.getElementById(rowId);
    var cat = row.querySelector('.bnk-cat').value;
    var dl = row.querySelector('datalist');
    var opts = '';
    _catalogo.filter(function (c) { return !cat || c.categoria === cat; })
      .forEach(function (c) { opts += '<option value="' + _esc(c.concepto) + '">'; });
    dl.innerHTML = opts;
  }

  function _autocompletarPrecio(rowId) {
    var row = document.getElementById(rowId);
    var nombre = row.querySelector('.bnk-con').value.trim();
    var found = _catalogo.find(function (c) { return c.concepto === nombre; });
    if (found) {
      row.querySelector('.bnk-pre').value = found.precio;
      row.querySelector('.bnk-uni').value = found.unidad || 'servicio';
      if (!row.querySelector('.bnk-cat').value) row.querySelector('.bnk-cat').value = found.categoria;
      _recalcularFila(rowId);
    }
  }

  function _recalcularFila(rowId) {
    var row = document.getElementById(rowId);
    var cant = parseFloat(row.querySelector('.bnk-cant').value) || 0;
    var precio = parseFloat(row.querySelector('.bnk-pre').value) || 0;
    row.querySelector('.bnk-sub-val').textContent = _formatMXN(cant * precio);
    _recalcularTotales();
  }

  function _recalcularTotales() {
    var rows = document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row');
    var subtotal = 0;
    rows.forEach(function (row) {
      var cant = parseFloat(row.querySelector('.bnk-cant').value) || 0;
      var precio = parseFloat(row.querySelector('.bnk-pre').value) || 0;
      subtotal += cant * precio;
    });
    var iva = Math.round(subtotal * 0.16);
    document.getElementById('bnkSubtotal').textContent = _formatMXN(subtotal);
    document.getElementById('bnkIVA').textContent = _formatMXN(iva);
    document.getElementById('bnkTotal').textContent = _formatMXN(subtotal + iva);
  }

  function _setCondiciones(key) {
    document.getElementById('bnkCondiciones').value = PLANTILLAS[key] || '';
  }

  function _recopilarConceptos() {
    var rows = document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row');
    var conceptos = [];
    rows.forEach(function (row) {
      var con = (row.querySelector('.bnk-con') || {}).value;
      if (!con) return;
      con = con.trim();
      var cant = parseFloat((row.querySelector('.bnk-cant') || {}).value) || 0;
      if (!con || cant <= 0) return;

      var modo = row.getAttribute('data-modo') || 'manual';
      var precio = parseFloat((row.querySelector('.bnk-pre') || {}).value) || 0;

      var concepto = {
        modo: modo,
        categoria: (row.querySelector('.bnk-cat') || {}).value || 'Otro',
        concepto: con,
        cantidad: cant,
        unidad: (row.querySelector('.bnk-uni') || {}).value || 'servicio',
        precioUnit: precio,
        subtotal: cant * precio
      };

      if (modo === 'proveedor') {
        concepto.costoProveedor = parseFloat((row.querySelector('.bnk-costo-prov') || {}).value) || 0;
        concepto.proveedorId = (row.querySelector('.bnk-prov-id') || {}).value || '';
        concepto.proveedorNombre = (row.querySelector('.bnk-prov-nombre') || {}).value || '';
        concepto.bloqueId = (row.querySelector('.bnk-bloque-id') || {}).value || '';
        concepto.bloqueNombre = (row.querySelector('.bnk-bloque-nombre') || {}).value || '';
      }

      conceptos.push(concepto);
    });
    return conceptos;
  }

  // ── Validation ──
  function _validarFormulario() {
    var empresaEl = document.getElementById('bnkEmpresa');
    var eventoEl = document.getElementById('bnkEvento');
    var telEl = document.getElementById('bnkTelefono');
    var correoEl = document.getElementById('bnkCorreo');

    // Clear previous
    [empresaEl, eventoEl, telEl, correoEl].forEach(function (el) { BNKValidate.clear(el); });

    if (!empresaEl.value.trim()) { BNKValidate.error(empresaEl, 'Empresa requerida'); BNKToast.warn('La empresa es requerida.'); return false; }
    if (!eventoEl.value.trim()) { BNKValidate.error(eventoEl, 'Evento requerido'); BNKToast.warn('El nombre del evento es requerido.'); return false; }
    if (!telEl.value.trim() && !correoEl.value.trim()) {
      BNKValidate.error(telEl, 'Teléfono o correo requerido');
      BNKValidate.error(correoEl, 'Teléfono o correo requerido');
      BNKToast.warn('Ingresa al menos teléfono o correo.');
      return false;
    }
    if (correoEl.value.trim() && !BNKValidate.email(correoEl)) {
      BNKToast.warn('Formato de correo inválido.');
      return false;
    }

    var conceptos = _recopilarConceptos();
    if (conceptos.length === 0) { BNKToast.warn('Agrega al menos un concepto.'); return false; }

    var hayPreciosCero = conceptos.some(function (c) { return c.precioUnit <= 0; });
    if (hayPreciosCero) { BNKToast.warn('Todos los conceptos deben tener precio mayor a $0.'); return false; }

    return true;
  }

  // ── PDF BNK ──
  function _generarPDF(data) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, margin = 20, contentW = W - margin * 2, H = 297;

    var isNeon = _pdfStyle === 'neon';
    var BG = isNeon ? [5, 9, 5] : [255, 255, 255];
    var TEXT = isNeon ? [237, 248, 237] : [51, 51, 51];
    var ACCENT = isNeon ? [0, 255, 65] : [198, 163, 80];
    var HEADER_BG = isNeon ? [5, 9, 5] : [44, 36, 25];
    var HEADER_TEXT = [255, 255, 255];
    var SUB_TEXT = isNeon ? [200, 236, 200] : [120, 120, 120];

    var HEADER_H = 28, FOOTER_H = 20, CONTENT_TOP = 36, MAX_Y = H - FOOTER_H;
    var y = 0;

    function drawBG() { doc.setFillColor(BG[0], BG[1], BG[2]); doc.rect(0, 0, W, H, 'F'); }

    function drawHeader() {
      drawBG();
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.rect(0, 0, W, HEADER_H, 'F');
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        try { doc.addImage(BUNKER_LOGO_B64, 'PNG', margin, 4, 40, 15); } catch (e) {}
      }
      doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Cotización — ' + (data.evento || 'Producción Integral'), 65, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text(data.folio + ' | ' + (data.empresa || '') + ' | ' + (data.contacto || ''), 65, 18);
    }

    function drawFooter() {
      var fy = H - FOOTER_H + 2;
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.setLineWidth(0.3); doc.line(margin, fy, W - margin, fy);
      doc.setFontSize(6); doc.setTextColor(SUB_TEXT[0], SUB_TEXT[1], SUB_TEXT[2]);
      var pn = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text('Pág. ' + pn + ' | BÚNKER Creatividad Empresarial', margin, fy + 5);
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        try { doc.addImage(BUNKER_LOGO_B64, 'PNG', W - margin - 25, H - FOOTER_H + 3, 25, 9); } catch (e) {}
      }
    }

    function checkPage(needed) { if (y + needed > MAX_Y) { doc.addPage(); drawHeader(); y = CONTENT_TOP; } }

    function drawSection(text) {
      checkPage(14);
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(text, margin + 4, y + 5.5);
      doc.setFont('helvetica', 'normal'); y += 10;
    }

    // Página 1
    drawHeader(); y = CONTENT_TOP;

    // Fecha de emisión
    doc.setFontSize(7); doc.setTextColor(SUB_TEXT[0], SUB_TEXT[1], SUB_TEXT[2]);
    var hoy = new Date();
    var fechaEmision = hoy.getDate() + '/' + (hoy.getMonth() + 1) + '/' + hoy.getFullYear();
    doc.text('Fecha de emisión: ' + fechaEmision, W - margin, y - 2, { align: 'right' });

    // Intro
    doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    var intro = 'En atención a su solicitud, BÚNKER presenta la siguiente propuesta de producción integral para el evento '
      + (data.evento || '') + (data.fechaEvento ? ', a realizarse el ' + data.fechaEvento : '')
      + ' en las instalaciones de ' + (data.sede || 'MUNET') + '.';
    var introLines = doc.splitTextToSize(intro, contentW);
    doc.text(introLines, margin, y); y += introLines.length * 4 + 6;

    // Agrupar por categoría
    var grupos = {};
    data.conceptos.forEach(function (c) {
      if (!grupos[c.categoria]) grupos[c.categoria] = [];
      grupos[c.categoria].push(c);
    });

    Object.keys(grupos).forEach(function (cat) {
      drawSection(cat.toUpperCase());

      // Sub-group by bloque within category
      var bloquesEnCat = {};
      var sinBloque = [];
      grupos[cat].forEach(function (c) {
        if (c.bloqueNombre) {
          if (!bloquesEnCat[c.bloqueNombre]) bloquesEnCat[c.bloqueNombre] = [];
          bloquesEnCat[c.bloqueNombre].push(c);
        } else {
          sinBloque.push(c);
        }
      });

      // Render block groups
      Object.keys(bloquesEnCat).forEach(function (bName) {
        checkPage(10);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text('\u25B8 ' + bName, margin + 2, y + 4);
        doc.setFont('helvetica', 'normal'); y += 6;

        bloquesEnCat[bName].forEach(function (c) {
          checkPage(7);
          doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
          doc.text('  ' + c.concepto, margin + 6, y + 4);
          doc.text(String(c.cantidad) + ' ' + c.unidad, margin + 100, y + 4);
          doc.text(_formatMXN(c.precioUnit), W - margin - 35, y + 4);
          doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
          doc.text(_formatMXN(c.subtotal), W - margin - 4, y + 4, { align: 'right' });
          doc.setDrawColor(BG[0] + 30, BG[1] + 30, BG[2] + 30);
          doc.setLineWidth(0.1); doc.line(margin, y + 6, W - margin, y + 6);
          y += 7;
        });
      });

      // Render loose concepts
      sinBloque.forEach(function (c) {
        checkPage(7);
        doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
        doc.text(c.concepto, margin + 4, y + 4);
        doc.text(String(c.cantidad) + ' ' + c.unidad, margin + 100, y + 4);
        doc.text(_formatMXN(c.precioUnit), W - margin - 35, y + 4);
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text(_formatMXN(c.subtotal), W - margin - 4, y + 4, { align: 'right' });
        doc.setDrawColor(BG[0] + 30, BG[1] + 30, BG[2] + 30);
        doc.setLineWidth(0.1); doc.line(margin, y + 6, W - margin, y + 6);
        y += 7;
      });
      y += 4;
    });

    // Totales
    checkPage(30);
    drawSection('RESUMEN GENERAL');
    doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text('Subtotal (sin IVA)', margin + 4, y + 4);
    doc.text(_formatMXN(data.subtotal), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.text('IVA (16%)', margin + 4, y + 4);
    doc.text(_formatMXN(data.iva), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text('TOTAL: ' + _formatMXN(data.total), W - margin - 4, y + 4, { align: 'right' }); y += 12;

    // Vigencia y condiciones de pago
    if (data.vigencia || data.condPago) {
      checkPage(18);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      if (data.vigencia) {
        doc.text('Vigencia: ' + data.vigencia + ' días a partir de la fecha de emisión.', margin + 4, y + 4);
        y += 6;
      }
      if (data.condPago) {
        doc.text('Condiciones de pago: ' + data.condPago, margin + 4, y + 4);
        y += 6;
      }
      y += 4;
    }

    // Condiciones
    if (data.condiciones) {
      drawSection('CONDICIONES COMERCIALES');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      data.condiciones.split('\n').forEach(function (line) {
        var wrapped = doc.splitTextToSize(line, contentW - 8);
        wrapped.forEach(function (wl) { checkPage(5); doc.text(wl, margin + 4, y + 4); y += 5; });
      });
    }

    // Notas
    if (data.notas) {
      y += 4;
      checkPage(14);
      drawSection('NOTAS');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      var notasLines = doc.splitTextToSize(data.notas, contentW - 8);
      notasLines.forEach(function (nl) { checkPage(5); doc.text(nl, margin + 4, y + 4); y += 5; });
    }

    // Footers
    var totalPages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) { doc.setPage(p); drawFooter(); }

    return doc;
  }

  // ── Enviar ──
  function _enviar() {
    if (!_validarFormulario()) return;

    // Online check
    if (!navigator.onLine) {
      BNKToast.error('Sin conexión a internet. Verifica tu red.');
      return;
    }

    var btn = document.getElementById('bnkGenerar');
    btn.disabled = true; btn.textContent = 'GENERANDO...';

    var conceptos = _recopilarConceptos();
    var folio = _generarFolio();
    var subtotal = 0;
    conceptos.forEach(function (c) { subtotal += c.subtotal; });
    var iva = Math.round(subtotal * 0.16);
    var total = subtotal + iva;

    var vigencia = document.getElementById('bnkVigencia').value || '30';
    var condPago = document.getElementById('bnkCondPago').value.trim();
    var notas = document.getElementById('bnkNotas').value.trim();

    var marcaSel = document.getElementById('bnkMarca');
    var marcaVal = marcaSel ? marcaSel.value : '';

    var pdfData = {
      folio: folio,
      empresa: document.getElementById('bnkEmpresa').value.trim(),
      marca: marcaVal,
      contacto: document.getElementById('bnkContacto').value.trim(),
      evento: document.getElementById('bnkEvento').value.trim(),
      fechaEvento: document.getElementById('bnkFechaEvento').value,
      sede: document.getElementById('bnkSede').value.trim() || 'MUNET',
      conceptos: conceptos,
      condiciones: document.getElementById('bnkCondiciones').value,
      vigencia: vigencia,
      condPago: condPago,
      notas: notas,
      subtotal: subtotal,
      iva: iva,
      total: total
    };

    var doc = _generarPDF(pdfData);

    var firestoreData = {
      fuente: 'BNK',
      folio: folio,
      fecha: new Date().toISOString(),
      folioMNT: document.getElementById('bnkFolioMNT').value.trim(),
      empresa: pdfData.empresa,
      marca: marcaVal,
      contacto: pdfData.contacto,
      telefono: document.getElementById('bnkTelefono').value.trim(),
      correo: document.getElementById('bnkCorreo').value.trim(),
      evento: pdfData.evento,
      fechaEvento: pdfData.fechaEvento,
      sede: pdfData.sede,
      conceptos: JSON.stringify(conceptos),
      condiciones: pdfData.condiciones,
      vigencia: vigencia,
      condPago: condPago,
      notas: notas,
      subtotal: subtotal,
      iva: iva,
      total: total,
      linkPdf: '',
      estado: 'Recorrido',
      creadoPor: BNK_AUTH.currentUser() ? BNK_AUTH.currentUser().uid : ''
    };

    BNK_DB.cotizaciones.create(firestoreData).then(function (saved) {
      // Auto-link providers
      var parsedConceptos = JSON.parse(firestoreData.conceptos);
      return _autoVincularProveedores(saved.id, folio, parsedConceptos).then(function () {
        doc.save('Cotizacion-BNK-' + folio + '.pdf');
        BNKToast.ok('Cotización ' + folio + ' generada.');
        _limpiar();
        if (window.BNKFinanzas && BNKFinanzas.reload) BNKFinanzas.reload();
      });
    }).catch(function (err) {
      BNKToast.error('Error al guardar: ' + err.message);
      btn.textContent = 'REINTENTAR';
    }).finally(function () {
      btn.disabled = false;
      if (btn.textContent === 'GENERANDO...') btn.textContent = 'GENERAR COTIZACIÓN';
    });
  }

  function _autoVincularProveedores(cotizacionId, folio, conceptos) {
    var provMap = {};
    conceptos.forEach(function (c) {
      if (c.modo !== 'proveedor' || !c.proveedorId) return;
      if (!provMap[c.proveedorId]) {
        provMap[c.proveedorId] = {
          proveedorId: c.proveedorId,
          proveedorNombre: c.proveedorNombre,
          montoTotal: 0,
          servicios: []
        };
      }
      provMap[c.proveedorId].montoTotal += (c.costoProveedor || 0) * (c.cantidad || 1);
      provMap[c.proveedorId].servicios.push(c.concepto + ' x' + c.cantidad);
    });

    var promises = [];
    Object.keys(provMap).forEach(function (provId) {
      var p = provMap[provId];
      promises.push(BNK_DB.cotizacionProveedores.create({
        cotizacionId: cotizacionId,
        cotizacionFolio: folio,
        proveedorId: p.proveedorId,
        proveedorNombre: p.proveedorNombre,
        montoTotal: p.montoTotal,
        servicios: p.servicios,
        autoVinculado: true
      }));
    });

    return Promise.all(promises);
  }

  function _limpiar() {
    var hayDatos = document.getElementById('bnkEmpresa').value.trim() ||
      document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row').length > 0;
    if (!hayDatos) { _doLimpiar(); return; }
    BNKConfirm.show('¿Limpiar todo el formulario? Se perderán los datos ingresados.', 'LIMPIAR').then(function (ok) {
      if (ok) _doLimpiar();
    });
  }

  function _doLimpiar() {
    _clearBnkDraft();
    ['bnkEmpresa','bnkContacto','bnkTelefono','bnkCorreo','bnkEvento','bnkFechaEvento','bnkFolioMNT'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    _hideMarcaSelector('bnk');
    document.getElementById('bnkSede').value = 'MUNET';
    document.getElementById('bnkConceptosBody').innerHTML = '';
    _conceptoCounter = 0;
    _agregarFila();
    _setCondiciones('estandar');
    document.getElementById('bnkPlantilla').value = 'estandar';
    document.getElementById('bnkVigencia').value = '30';
    document.getElementById('bnkCondPago').value = '60% anticipo, 40% antes del evento';
    document.getElementById('bnkNotas').value = '';
    _recalcularTotales();
    document.getElementById('bnkGenerar').textContent = 'GENERAR COTIZACIÓN';
  }

  // ── Bloque picker ──
  function _openBloquePicker() {
    var overlay = document.getElementById('bnkBloqueOverlay');
    var provSel = document.getElementById('bnkBloqueProv');

    // Populate provider select with those that have blocks
    var provConBloques = {};
    _allBloques.forEach(function (b) { provConBloques[b.proveedorId] = true; });

    var html = '<option value="">\u2014 Seleccionar proveedor \u2014</option>';
    _proveedores.forEach(function (p) {
      if (provConBloques[p.id]) {
        html += '<option value="' + _esc(p.id) + '">' + _esc(p.razonSocial || p.nombreComercial || p.id) + '</option>';
      }
    });
    provSel.innerHTML = html;

    document.getElementById('bnkBloqueSelect').innerHTML = '<option value="">\u2014 Seleccionar bloque \u2014</option>';
    document.getElementById('bnkBloquePreview').innerHTML = '';
    document.getElementById('bnkBloqueAdd').disabled = true;

    overlay.style.display = '';
    overlay.classList.add('visible');
  }

  function _setupBloquePicker() {
    var overlay = document.getElementById('bnkBloqueOverlay');
    var provSel = document.getElementById('bnkBloqueProv');
    var bloqueSel = document.getElementById('bnkBloqueSelect');
    var preview = document.getElementById('bnkBloquePreview');
    var addBtn = document.getElementById('bnkBloqueAdd');
    var closeBtn = document.getElementById('bnkBloqueClose');

    function _close() { overlay.classList.remove('visible'); overlay.style.display = 'none'; }

    closeBtn.addEventListener('click', _close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _close(); });

    provSel.addEventListener('change', function () {
      var provId = provSel.value;
      var html = '<option value="">\u2014 Seleccionar bloque \u2014</option>';
      _allBloques.forEach(function (b) {
        if (b.proveedorId === provId) {
          html += '<option value="' + _esc(b.id) + '">' + _esc(b.nombre) + '</option>';
        }
      });
      bloqueSel.innerHTML = html;
      preview.innerHTML = '';
      addBtn.disabled = true;
    });

    bloqueSel.addEventListener('change', function () {
      var bloqueId = bloqueSel.value;
      var provId = provSel.value;
      if (!bloqueId) { preview.innerHTML = ''; addBtn.disabled = true; return; }

      var srvs = _allServicios.filter(function (s) {
        return s.bloqueId === bloqueId && s.proveedorId === provId;
      });

      if (srvs.length === 0) {
        preview.innerHTML = '<em>Sin servicios en este bloque</em>';
        addBtn.disabled = true;
        return;
      }

      var html = '<div style="margin-top:8px;padding:8px;border:1px solid var(--bd);border-radius:4px">';
      html += '<strong style="color:var(--g);font-size:11px">' + srvs.length + ' servicios:</strong><ul style="margin:4px 0 0 16px;list-style:disc">';
      srvs.forEach(function (s) {
        var precio = (s.precioCliente && parseFloat(s.precioCliente) > 0) ? s.precioCliente : (s.costoUnitario || 0);
        html += '<li>' + _esc(s.servicio) + ' \u2014 ' + _formatMXN(precio) + '</li>';
      });
      html += '</ul></div>';
      preview.innerHTML = html;
      addBtn.disabled = false;
    });

    addBtn.addEventListener('click', function () {
      var provId = provSel.value;
      var bloqueId = bloqueSel.value;
      if (!provId || !bloqueId) return;

      var provNombre = '';
      _proveedores.forEach(function (p) {
        if (p.id === provId) provNombre = p.razonSocial || p.nombreComercial || '';
      });

      // Remove last empty row if it exists
      var rows = document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row');
      if (rows.length > 0) {
        var lastRow = rows[rows.length - 1];
        var lastCon = (lastRow.querySelector('.bnk-con') || {}).value;
        if (!lastCon || !lastCon.trim()) lastRow.remove();
      }

      _expandBloque('__picker__', bloqueId, provId, provNombre);
      _close();
      BNKToast.ok('Bloque agregado.');
    });
  }

  // ── Bind ──
  function _bindEvents() {
    _setupAutocomplete();

    document.getElementById('bnkAddRow').addEventListener('click', _agregarFila);
    document.getElementById('bnkAddBloque').addEventListener('click', _openBloquePicker);
    _setupBloquePicker();
    document.getElementById('bnkPlantilla').addEventListener('change', function () {
      _setCondiciones(this.value);
    });
    document.getElementById('bnkGenerar').addEventListener('click', _enviar);
    document.getElementById('bnkLimpiar').addEventListener('click', _limpiar);

    // PDF style toggle
    document.querySelectorAll('#bnkPdfToggle .pdf-style-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#bnkPdfToggle .pdf-style-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        _pdfStyle = this.getAttribute('data-style');
      });
    });

    // Keyboard shortcut: Ctrl+Enter to submit
    document.getElementById('sec-cotizar-bnk').addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        _enviar();
      }
    });
  }

  // ── Draft recovery (sessionStorage) ──
  var BNK_DRAFT_KEY = 'bnk_bnk_draft';
  var BNK_DRAFT_FIELDS = ['bnkEmpresa','bnkContacto','bnkTelefono','bnkCorreo','bnkEvento','bnkFechaEvento','bnkFolioMNT'];

  function _saveBnkDraft() {
    var draft = {};
    BNK_DRAFT_FIELDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.value) draft[id] = el.value;
    });
    if (Object.keys(draft).length > 0) {
      sessionStorage.setItem(BNK_DRAFT_KEY, JSON.stringify(draft));
    }
  }

  function _restoreBnkDraft() {
    var raw = sessionStorage.getItem(BNK_DRAFT_KEY);
    if (!raw) return;
    try {
      var draft = JSON.parse(raw);
      Object.keys(draft).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = draft[id];
      });
      BNKToast.ok('Borrador BNK restaurado.');
    } catch (e) { /* ignore */ }
  }

  function _clearBnkDraft() {
    sessionStorage.removeItem(BNK_DRAFT_KEY);
  }

  // ── Init ──
  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });
})();
