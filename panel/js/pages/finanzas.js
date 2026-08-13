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
  // CUENTAS POR PAGAR (placeholder — Task 5)
  // ══════════════════════════════════════
  function _renderCuentas() { /* Task 5 */ }
  function _renderKPIs() { /* Task 5 */ }

  // ══════════════════════════════════════
  // DISPERSIONES (placeholder — Task 6)
  // ══════════════════════════════════════
  function _renderDispersiones() { /* Task 5/6 */ }

  // ── Init ──
  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });
})();
