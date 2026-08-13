// finanzas.js — Módulo FINANZAS para el Panel BUNKER
// Sub-tabs: Cuentas por Pagar, Partners, Dispersiones
(function () {
  'use strict';

  var _partners = [];
  var _pagos = [];
  var _cotPartners = []; // cotizacionPartners
  var _cotizaciones = [];
  var _proveedores = [];
  var _isAdmin = false;

  function init() {
    _checkAdmin();
    _loadData();
    _bindPartnerEvents();
    _bindCuentasEvents();
  }

  function _checkAdmin() {
    var user = BNK_AUTH.currentUser();
    if (!user) return;
    BNK_DB.usuarios.get(user.uid).then(function (u) {
      _isAdmin = u && u.rol === 'admin';
      if (_isAdmin) {
        document.getElementById('sec-finanzas').classList.add('fin-admin-visible');
      }
    });
  }

  function _loadData() {
    Promise.all([
      BNK_DB.partners.list(),
      BNK_DB.pagos.list(),
      BNK_DB.cotizacionPartners.list(),
      BNK_DB.cotizaciones.list(),
      BNK_DB.proveedores.list()
    ]).then(function (results) {
      _partners = results[0];
      _pagos = results[1];
      _cotPartners = results[2];
      _cotizaciones = results[3];
      _proveedores = results[4];
      _renderPartners();
      _renderCuentas();
      _renderDispersiones();
      _renderKPIs();
    });
  }

  // ── Utilidades ──
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }
  function _modal(id, show) {
    var el = document.getElementById(id);
    if (el) { if (show) el.classList.add('visible'); else el.classList.remove('visible'); }
  }

  function _generarFolioPTR() {
    var max = 0;
    _partners.forEach(function (p) {
      var m = (p.folio || '').match(/PTR-(\d+)/);
      if (m) { var n = parseInt(m[1]); if (n > max) max = n; }
    });
    return 'PTR-' + String(max + 1).padStart(4, '0');
  }

  // Construye array de "cuentas" agrupando pagos por cotización+destinatario
  // y merge con cotizacionPartners (partners sin pagos aún)
  function _buildCuentasAgrupadas() {
    var map = {}; // key = cotizacionId|destinatarioId

    // 1. Agrupar pagos existentes
    _pagos.forEach(function (p) {
      var key = p.cotizacionId + '|' + p.destinatarioId;
      if (!map[key]) {
        map[key] = {
          cotizacionId: p.cotizacionId,
          cotizacionFolio: p.cotizacionFolio,
          destinatarioId: p.destinatarioId,
          destinatarioNombre: p.destinatarioNombre,
          tipo: p.tipo,
          totalPagado: 0,
          ultimoPago: '',
          cerrada: false,
          pagos: []
        };
      }
      map[key].totalPagado += (p.monto || 0);
      map[key].pagos.push(p);
      if (!map[key].ultimoPago || p.fechaPago > map[key].ultimoPago) {
        map[key].ultimoPago = p.fechaPago;
      }
    });

    // 2. Agregar cotizacionPartners sin pagos aún
    _cotPartners.forEach(function (cp) {
      var key = cp.cotizacionId + '|' + cp.partnerId;
      if (!map[key]) {
        map[key] = {
          cotizacionId: cp.cotizacionId,
          cotizacionFolio: cp.cotizacionFolio,
          destinatarioId: cp.partnerId,
          destinatarioNombre: cp.partnerNombre,
          tipo: 'partner',
          totalPagado: 0,
          ultimoPago: '',
          cerrada: cp.cerrada || false,
          pagos: []
        };
      } else {
        map[key].cerrada = cp.cerrada || false;
      }
    });

    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function _setupCotAutocomplete(inputId, autoId, hiddenId) {
    var input = document.getElementById(inputId);
    var dropdown = document.getElementById(autoId);
    if (!input || !dropdown) return;

    input.addEventListener('input', function () {
      var val = input.value.trim().toLowerCase();
      if (val.length < 2) { dropdown.classList.remove('visible'); return; }
      var matches = _cotizaciones.filter(function (c) {
        return (c.folio || '').toLowerCase().indexOf(val) !== -1 || (c.cliente || c.empresa || '').toLowerCase().indexOf(val) !== -1;
      });
      var html = '';
      matches.slice(0, 8).forEach(function (c) {
        html += '<div class="bnk-ac-item" data-cot-id="' + c.id + '" data-cot-folio="' + _esc(c.folio) + '">'
          + _esc(c.folio) + ' \u2014 ' + _esc(c.cliente || c.empresa || '') + '</div>';
      });
      dropdown.innerHTML = html || '<div class="bnk-ac-item bnk-ac-new">Sin resultados</div>';
      dropdown.classList.add('visible');
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.bnk-ac-item');
      if (!item || item.classList.contains('bnk-ac-new')) { dropdown.classList.remove('visible'); return; }
      input.value = item.getAttribute('data-cot-folio') || '';
      document.getElementById(hiddenId).value = item.getAttribute('data-cot-id') || '';
      dropdown.classList.remove('visible');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#' + inputId) && !e.target.closest('#' + autoId)) {
        dropdown.classList.remove('visible');
      }
    });
  }

  function _openPagoModal(opts) {
    opts = opts || {};
    document.getElementById('finPagoCotizacion').value = opts.folio || '';
    document.getElementById('finPagoCotId').value = opts.cotizacionId || '';
    document.getElementById('finPagoTipo').value = opts.tipo || 'proveedor';
    document.getElementById('finPagoMonto').value = '';
    document.getElementById('finPagoFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('finPagoMetodo').value = 'Transferencia';
    document.getElementById('finPagoRef').value = '';
    document.getElementById('finPagoNotas').value = '';
    _populateDestinatarios(opts.tipo || 'proveedor', opts.destinatarioId || '');
    _modal('finPagoOverlay', true);
  }

  function _populateDestinatarios(tipo, selectedId) {
    var select = document.getElementById('finPagoDest');
    var list = tipo === 'partner' ? _partners : _proveedores;
    var html = '<option value="">\u2014 Seleccionar \u2014</option>';
    list.forEach(function (item) {
      var nombre = item.nombre || item.razonSocial || item.nombreComercial || '';
      var sel = item.id === selectedId ? ' selected' : '';
      html += '<option value="' + item.id + '"' + sel + '>' + _esc(nombre) + '</option>';
    });
    select.innerHTML = html;
  }

  function _savePago() {
    var cotId = document.getElementById('finPagoCotId').value;
    var cotFolio = document.getElementById('finPagoCotizacion').value.trim();
    var tipo = document.getElementById('finPagoTipo').value;
    var destId = document.getElementById('finPagoDest').value;
    var monto = parseFloat(document.getElementById('finPagoMonto').value) || 0;
    var fecha = document.getElementById('finPagoFecha').value;

    if (!cotId) { BNKToast.warn('Selecciona una cotización.'); return; }
    if (!destId) { BNKToast.warn('Selecciona un destinatario.'); return; }
    if (monto <= 0) { BNKToast.warn('El monto debe ser mayor a 0.'); return; }
    if (!fecha) { BNKToast.warn('La fecha es requerida.'); return; }

    var destList = tipo === 'partner' ? _partners : _proveedores;
    var dest = destList.find(function (d) { return d.id === destId; });
    var destNombre = dest ? (dest.nombre || dest.razonSocial || dest.nombreComercial || '') : '';

    var user = BNK_AUTH.currentUser();
    var data = {
      tipo: tipo,
      destinatarioId: destId,
      destinatarioNombre: destNombre,
      cotizacionId: cotId,
      cotizacionFolio: cotFolio,
      monto: monto,
      fechaPago: fecha,
      metodoPago: document.getElementById('finPagoMetodo').value,
      referencia: document.getElementById('finPagoRef').value.trim(),
      notas: document.getElementById('finPagoNotas').value.trim(),
      registradoPor: user ? user.uid : ''
    };

    BNK_DB.pagos.create(data).then(function () {
      BNKToast.ok('Pago registrado.');
      _modal('finPagoOverlay', false);
      _loadData();
    }).catch(function (err) {
      BNKToast.error('Error: ' + err.message);
    });
  }

  function _openDetalleModal(cotizacionId, destinatarioId, tipo) {
    var cot = _cotizaciones.find(function (c) { return c.id === cotizacionId; });
    var destList = tipo === 'partner' ? _partners : _proveedores;
    var dest = destList.find(function (d) { return d.id === destinatarioId; });

    document.getElementById('finDetalleTitle').textContent = 'DETALLE \u2014 ' + (cot ? cot.folio : '') + ' \u2192 ' + (dest ? (dest.nombre || dest.razonSocial || '') : '');

    // Info
    var infoHtml = '<div class="fin-info-grid">'
      + '<div class="fin-info-item"><div class="fin-info-label">FOLIO</div><div class="fin-info-value">' + _esc(cot ? cot.folio : '') + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">CLIENTE</div><div class="fin-info-value">' + _esc(cot ? (cot.cliente || cot.empresa || '') : '') + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">EVENTO</div><div class="fin-info-value">' + _esc(cot ? cot.evento : '') + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">TOTAL COT.</div><div class="fin-info-value">' + _formatMXN(cot ? cot.total : 0) + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">DESTINATARIO</div><div class="fin-info-value">' + _esc(dest ? (dest.nombre || dest.razonSocial || '') : '') + '</div></div>'
      + '<div class="fin-info-item"><div class="fin-info-label">BANCO / CLABE</div><div class="fin-info-value">' + _esc(dest ? (dest.banco || '') : '') + ' \u2014 ' + _esc(dest ? (dest.clabe || dest.CLABE || '') : '') + '</div></div>'
      + '</div>';
    document.getElementById('finDetalleInfo').innerHTML = infoHtml;

    // Pagos (parcialidades)
    var pagosFiltrados = _pagos.filter(function (p) {
      return p.cotizacionId === cotizacionId && p.destinatarioId === destinatarioId;
    });
    var pagosHtml = '';
    if (pagosFiltrados.length === 0) {
      pagosHtml = '<tr><td colspan="5" style="text-align:center;color:var(--tx)">Sin pagos registrados</td></tr>';
    } else {
      pagosFiltrados.forEach(function (p) {
        pagosHtml += '<tr>'
          + '<td>' + _esc(p.fechaPago) + '</td>'
          + '<td class="col-total">' + _formatMXN(p.monto) + '</td>'
          + '<td>' + _esc(p.metodoPago || '') + '</td>'
          + '<td>' + _esc(p.referencia || '\u2014') + '</td>'
          + '<td>' + _esc(p.registradoPor || '') + '</td>'
          + '</tr>';
      });
    }
    document.getElementById('finDetallePagos').innerHTML = pagosHtml;

    // Check if cerrada (for cotizacionPartners)
    var cerrarBtn = document.getElementById('finDetalleCerrar');
    var cpRecord = _cotPartners.find(function (cp) { return cp.cotizacionId === cotizacionId && cp.partnerId === destinatarioId; });
    if (cpRecord) {
      cerrarBtn.textContent = cpRecord.cerrada ? 'REABRIR CUENTA' : 'MARCAR COMO CERRADA';
      cerrarBtn.onclick = function () {
        BNK_DB.cotizacionPartners.update(cpRecord.id, { cerrada: !cpRecord.cerrada }).then(function () {
          BNKToast.ok(cpRecord.cerrada ? 'Cuenta reabierta.' : 'Cuenta marcada como cerrada.');
          _modal('finDetalleOverlay', false);
          _loadData();
        });
      };
      cerrarBtn.style.display = '';
    } else {
      // For proveedores there's no cotizacionPartners record — hide cerrar btn
      cerrarBtn.style.display = 'none';
    }

    // Agregar pago button
    document.getElementById('finDetalleAgregar').onclick = function () {
      _modal('finDetalleOverlay', false);
      _openPagoModal({ cotizacionId: cotizacionId, folio: cot ? cot.folio : '', tipo: tipo, destinatarioId: destinatarioId });
    };

    _modal('finDetalleOverlay', true);
  }

  function _bindCuentasEvents() {
    _setupCotAutocomplete('finPagoCotizacion', 'finPagoCotAuto', 'finPagoCotId');

    document.getElementById('finBtnRegistrarPago').addEventListener('click', function () { _openPagoModal(); });
    document.getElementById('finPagoGuardar').addEventListener('click', _savePago);
    document.getElementById('finPagoCancel').addEventListener('click', function () { _modal('finPagoOverlay', false); });
    document.getElementById('finPagoClose').addEventListener('click', function () { _modal('finPagoOverlay', false); });
    document.getElementById('finDetalleClose').addEventListener('click', function () { _modal('finDetalleOverlay', false); });

    // Tipo change → repopulate destinatarios
    document.getElementById('finPagoTipo').addEventListener('change', function () {
      _populateDestinatarios(this.value, '');
    });

    // Filters
    ['finCuentasSearch', 'finCuentasTipo', 'finCuentasEstado'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', _renderCuentas);
    });

    // Table clicks
    document.getElementById('finCuentasBody').addEventListener('click', function (e) {
      var tr = e.target.closest('tr');
      if (!tr) return;
      var cotId = tr.getAttribute('data-cot-id');
      var destId = tr.getAttribute('data-dest-id');
      var tipo = tr.getAttribute('data-tipo');

      if (e.target.closest('[data-cuenta-pago]')) {
        var cot = _cotizaciones.find(function (c) { return c.id === cotId; });
        _openPagoModal({ cotizacionId: cotId, folio: cot ? cot.folio : '', tipo: tipo, destinatarioId: destId });
        return;
      }
      if (e.target.closest('[data-cuenta-ver]')) {
        _openDetalleModal(cotId, destId, tipo);
      }
    });
  }

  // ══════════════════════════════════════
  // PARTNERS CRUD
  // ══════════════════════════════════════

  function _renderPartners() {
    var search = (document.getElementById('finPartnerSearch') || {}).value || '';
    search = search.trim().toLowerCase();

    var filtered = _partners.filter(function (p) {
      if (!search) return true;
      return [p.nombre, p.nombreComercial, p.contacto, p.correo, p.folio].join(' ').toLowerCase().indexOf(search) !== -1;
    });

    var body = document.getElementById('finPartnersBody');
    var empty = document.getElementById('finPartnersEmpty');
    if (!body) return;

    if (filtered.length === 0) {
      body.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    var html = '';
    filtered.forEach(function (p) {
      var cotCount = _cotPartners.filter(function (cp) { return cp.partnerId === p.id; }).length;
      var estado = p.cuentaActiva === 'No' ? 'Inactivo' : 'Activo';
      html += '<tr>'
        + '<td class="col-folio">' + _esc(p.folio) + '</td>'
        + '<td>' + _esc(p.nombre) + '</td>'
        + '<td>' + _esc(p.contacto || '') + '</td>'
        + '<td>' + _esc(p.correo || '') + '</td>'
        + '<td>' + _esc(p.telefono || '') + '</td>'
        + '<td>' + cotCount + '</td>'
        + '<td><span class="estado-badge ' + (estado === 'Activo' ? 'estado-Cerrada' : 'estado-Perdida') + '">' + estado + '</span></td>'
        + '<td>'
        + '<button class="tbl-action tbl-action--edit fin-admin-only" data-ptr-edit="' + p.id + '" title="Editar">&#9998;</button>'
        + '<button class="tbl-action tbl-action--del fin-admin-only" data-ptr-del="' + p.id + '" title="Eliminar">&times;</button>'
        + '</td>'
        + '</tr>';
    });
    body.innerHTML = html;
  }

  function _openPartnerModal(id) {
    var isNew = !id;
    document.getElementById('finPartnerModalTitle').textContent = isNew ? 'NUEVO PARTNER' : 'EDITAR PARTNER';
    document.getElementById('finPartnerId').value = id || '';

    // Reset tabs to General
    document.querySelectorAll('[data-ptr-tab]').forEach(function (t) { t.classList.remove('active'); });
    document.querySelector('[data-ptr-tab="general"]').classList.add('active');
    document.getElementById('ptrTabGeneral').style.display = '';
    document.getElementById('ptrTabContacto').style.display = 'none';
    document.getElementById('ptrTabBancarios').style.display = 'none';

    var fields = ['ptrNombre','ptrNombreComercial','ptrTipoPersona','ptrCuentaActiva',
      'ptrObservaciones','ptrContacto','ptrPuesto','ptrCorreo','ptrTelefono',
      'ptrBanco','ptrClabe','ptrTitular','ptrTipoCuenta',
      'ptrBancoExtranjero','ptrDivisa','ptrCuentaIBAN','ptrSwift'];

    if (isNew) {
      fields.forEach(function (f) { var el = document.getElementById(f); if (el) el.value = ''; });
      document.getElementById('ptrCuentaActiva').value = 'Sí';
      document.getElementById('ptrCotizaciones').innerHTML = 'Sin cotizaciones vinculadas.';
    } else {
      var p = _partners.find(function (x) { return x.id === id; });
      if (!p) return;
      document.getElementById('ptrNombre').value = p.nombre || '';
      document.getElementById('ptrNombreComercial').value = p.nombreComercial || '';
      document.getElementById('ptrTipoPersona').value = p.tipoPersona || '';
      document.getElementById('ptrCuentaActiva').value = p.cuentaActiva || 'Sí';
      document.getElementById('ptrObservaciones').value = p.observaciones || '';
      document.getElementById('ptrContacto').value = p.contacto || '';
      document.getElementById('ptrPuesto').value = p.puesto || '';
      document.getElementById('ptrCorreo').value = p.correo || '';
      document.getElementById('ptrTelefono').value = p.telefono || '';
      document.getElementById('ptrBanco').value = p.banco || '';
      document.getElementById('ptrClabe').value = p.clabe || '';
      document.getElementById('ptrTitular').value = p.titular || '';
      document.getElementById('ptrTipoCuenta').value = p.tipoCuenta || '';
      document.getElementById('ptrBancoExtranjero').value = p.bancoExtranjero || '';
      document.getElementById('ptrDivisa').value = p.divisa || '';
      document.getElementById('ptrCuentaIBAN').value = p.cuentaIBAN || '';
      document.getElementById('ptrSwift').value = p.swift || '';

      // Cotizaciones vinculadas
      var cots = _cotPartners.filter(function (cp) { return cp.partnerId === id; });
      if (cots.length === 0) {
        document.getElementById('ptrCotizaciones').innerHTML = 'Sin cotizaciones vinculadas.';
      } else {
        var ch = '';
        cots.forEach(function (cp) {
          var pagosPartner = _pagos.filter(function (pg) { return pg.destinatarioId === id && pg.cotizacionId === cp.cotizacionId; });
          var totalPagado = pagosPartner.reduce(function (s, pg) { return s + (pg.monto || 0); }, 0);
          var estado = cp.cerrada ? 'Cerrada' : (totalPagado > 0 ? 'Parcial' : 'Pendiente');
          ch += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd);font-size:13px">'
            + '<span style="color:var(--g);font-family:\'Space Mono\',monospace;font-size:12px">' + _esc(cp.cotizacionFolio) + '</span>'
            + '<span>' + _formatMXN(totalPagado) + ' pagado</span>'
            + '<span class="estado-badge estado-' + estado + '">' + estado + '</span>'
            + '</div>';
        });
        document.getElementById('ptrCotizaciones').innerHTML = ch;
      }
    }
    _modal('finPartnerOverlay', true);
  }

  function _savePartner() {
    var nombre = document.getElementById('ptrNombre').value.trim();
    if (!nombre) { BNKToast.warn('El nombre es requerido.'); return; }

    var data = {
      nombre: nombre,
      nombreComercial: document.getElementById('ptrNombreComercial').value.trim(),
      tipoPersona: document.getElementById('ptrTipoPersona').value,
      cuentaActiva: document.getElementById('ptrCuentaActiva').value,
      observaciones: document.getElementById('ptrObservaciones').value.trim(),
      contacto: document.getElementById('ptrContacto').value.trim(),
      puesto: document.getElementById('ptrPuesto').value.trim(),
      correo: document.getElementById('ptrCorreo').value.trim(),
      telefono: document.getElementById('ptrTelefono').value.trim(),
      rfc: '',
      curp: '',
      regimenFiscal: '',
      banco: document.getElementById('ptrBanco').value.trim(),
      clabe: document.getElementById('ptrClabe').value.trim(),
      titular: document.getElementById('ptrTitular').value.trim(),
      tipoCuenta: document.getElementById('ptrTipoCuenta').value.trim(),
      bancoExtranjero: document.getElementById('ptrBancoExtranjero').value.trim(),
      divisa: document.getElementById('ptrDivisa').value.trim(),
      cuentaIBAN: document.getElementById('ptrCuentaIBAN').value.trim(),
      swift: document.getElementById('ptrSwift').value.trim()
    };

    var id = document.getElementById('finPartnerId').value;
    var promise;
    if (id) {
      promise = BNK_DB.partners.update(id, data);
    } else {
      data.folio = _generarFolioPTR();
      promise = BNK_DB.partners.create(data);
    }

    promise.then(function () {
      BNKToast.ok(id ? 'Partner actualizado.' : 'Partner creado.');
      _modal('finPartnerOverlay', false);
      _loadData();
    }).catch(function (err) {
      BNKToast.error('Error: ' + err.message);
    });
  }

  function _deletePartner(id) {
    if (!confirm('¿Eliminar este partner?')) return;
    BNK_DB.partners.delete(id).then(function () {
      BNKToast.ok('Partner eliminado.');
      _loadData();
    }).catch(function (err) {
      BNKToast.error('Error: ' + err.message);
    });
  }

  function _bindPartnerEvents() {
    document.getElementById('finBtnNuevoPartner').addEventListener('click', function () { _openPartnerModal(null); });
    document.getElementById('finPartnerGuardar').addEventListener('click', _savePartner);
    document.getElementById('finPartnerCancel').addEventListener('click', function () { _modal('finPartnerOverlay', false); });
    document.getElementById('finPartnerClose').addEventListener('click', function () { _modal('finPartnerOverlay', false); });

    document.getElementById('finPartnersBody').addEventListener('click', function (e) {
      var editBtn = e.target.closest('[data-ptr-edit]');
      if (editBtn) { _openPartnerModal(editBtn.getAttribute('data-ptr-edit')); return; }
      var delBtn = e.target.closest('[data-ptr-del]');
      if (delBtn) { _deletePartner(delBtn.getAttribute('data-ptr-del')); }
    });

    var searchEl = document.getElementById('finPartnerSearch');
    if (searchEl) searchEl.addEventListener('input', _renderPartners);
  }

  // ══════════════════════════════════════
  // CUENTAS POR PAGAR
  // ══════════════════════════════════════
  function _renderKPIs() {
    // Total pagado (all time for now)
    var totalPagado = _pagos.reduce(function (s, p) { return s + (p.monto || 0); }, 0);
    document.getElementById('finKpiPagado').textContent = _formatMXN(totalPagado);

    // Pendiente proveedores: unique cotizacionId+destinatarioId combos with tipo=proveedor, not cerrada
    var provCuentas = _buildCuentasAgrupadas().filter(function (c) { return c.tipo === 'proveedor' && !c.cerrada; });
    document.getElementById('finKpiPendProv').textContent = provCuentas.length;

    // Pendiente partners: cotizacionPartners not cerrada
    var pendPartners = _cotPartners.filter(function (cp) { return !cp.cerrada; }).length;
    document.getElementById('finKpiPendPart').textContent = pendPartners;

    // Pagos del mes
    var now = new Date();
    var mesActual = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var pagosMes = _pagos.filter(function (p) { return (p.fechaPago || '').substring(0, 7) === mesActual; }).length;
    document.getElementById('finKpiMes').textContent = pagosMes;
  }

  function _renderCuentas() {
    var cuentas = _buildCuentasAgrupadas();

    // Apply filters
    var search = (document.getElementById('finCuentasSearch') || {}).value || '';
    search = search.trim().toLowerCase();
    var tipoFilter = (document.getElementById('finCuentasTipo') || {}).value || '';
    var estadoFilter = (document.getElementById('finCuentasEstado') || {}).value || '';

    cuentas = cuentas.filter(function (c) {
      if (search && [c.cotizacionFolio, c.destinatarioNombre].join(' ').toLowerCase().indexOf(search) === -1) return false;
      if (tipoFilter && c.tipo !== tipoFilter) return false;
      var estado = c.cerrada ? 'Cerrada' : (c.totalPagado > 0 ? 'Parcial' : 'Pendiente');
      if (estadoFilter && estado !== estadoFilter) return false;
      return true;
    });

    var body = document.getElementById('finCuentasBody');
    var empty = document.getElementById('finCuentasEmpty');
    if (!body) return;

    if (cuentas.length === 0) {
      body.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    var html = '';
    cuentas.forEach(function (c) {
      var estado = c.cerrada ? 'Cerrada' : (c.totalPagado > 0 ? 'Parcial' : 'Pendiente');
      var tipoBadge = c.tipo === 'partner' ? 'tipo-partner' : 'tipo-proveedor';
      html += '<tr data-cot-id="' + c.cotizacionId + '" data-dest-id="' + c.destinatarioId + '" data-tipo="' + c.tipo + '">'
        + '<td class="col-folio">' + _esc(c.cotizacionFolio) + '</td>'
        + '<td><span class="tipo-badge ' + tipoBadge + '">' + _esc(c.tipo) + '</span></td>'
        + '<td>' + _esc(c.destinatarioNombre) + '</td>'
        + '<td class="col-total">' + _formatMXN(c.totalPagado) + '</td>'
        + '<td>' + _esc(c.ultimoPago || '\u2014') + '</td>'
        + '<td><span class="estado-badge estado-' + estado + '">' + estado + '</span></td>'
        + '<td>'
        + '<button class="tbl-action tbl-action--edit fin-admin-only" data-cuenta-pago="1" title="+ Pago">$+</button>'
        + '<button class="tbl-action" data-cuenta-ver="1" title="Ver detalle">&#128269;</button>'
        + '</td>'
        + '</tr>';
    });
    body.innerHTML = html;
  }

  // ══════════════════════════════════════
  // DISPERSIONES (placeholder — Task 6)
  // ══════════════════════════════════════
  function _renderDispersiones() { /* Task 5/6 */ }

  // ── Init ──
  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });
})();
