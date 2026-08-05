/* =========================================================
   proveedores.js — Módulo de Proveedores para el Panel de Ventas
   Namespace: window.BNKProveedores
   Requiere: window.DASH (expuesto desde el script inline de dashboard.html)
   Sintaxis: ES5 (var, function declarations)
   ========================================================= */

(function () {
  'use strict';

  // Array local de proveedores en este módulo
  var _proveedores = [];
  var _cargado = false;

  // Proveedor activo en el modal (para carga de servicios en Tab 5)
  var _proveedorActivoId = null;

  // Sort & pagination state
  var _sortKey = 'id';
  var _sortDir = 'asc';
  var _page = 1;

  // ── Mapeo campo backend → id de elemento HTML ──
  var CAMPO_ID = {
    razonSocial:          'prvRazonSocial',
    nombreComercial:      'prvNombreComercial',
    tipoPersona:          'prvTipoPersona',
    tipoProveedor:        'prvTipoProveedor',
    cuentaActiva:         'prvCuentaActiva',
    fechaAlta:            'prvFechaAlta',
    actividadPrincipal:   'prvActividadPrincipal',
    fechaConstitucion:    'prvFechaConstitucion',
    observaciones:        'prvObservaciones',
    nombreContacto:       'prvNombreContacto',
    puestoContacto:       'prvPuestoContacto',
    correoContacto:       'prvCorreoContacto',
    telefonoContacto:     'prvTelefonoContacto',
    rfc:                  'prvRfc',
    curp:                 'prvCurp',
    regimenFiscal:        'prvRegimenFiscal',
    usoCfdi:              'prvUsoCfdi',
    formaPago:            'prvFormaPago',
    metodoPago:           'prvMetodoPago',
    diasCredito:          'prvDiasCredito',
    opinion32d:           'prvOpinion32d',
    fechaConstanciaFiscal:'prvFechaConstanciaFiscal',
    calle:                'prvCalle',
    numero:               'prvNumero',
    colonia:              'prvColonia',
    cp:                   'prvCp',
    alcaldia:             'prvAlcaldia',
    entidad:              'prvEntidad',
    pais:                 'prvPais',
    bancoMxn:             'prvBancoMxn',
    sucursalPlaza:        'prvSucursalPlaza',
    titularCuenta:        'prvTitularCuenta',
    cuentaCorta:          'prvCuentaCorta',
    clabe:                'prvClabe',
    tipoCuenta:           'prvTipoCuenta',
    direccionBanco:       'prvDireccionBanco',
    bancoExtranjero:      'prvBancoExtranjero',
    divisa:               'prvDivisa',
    titularExtranjero:    'prvTitularExtranjero',
    cuentaIban:           'prvCuentaIban',
    swiftBic:             'prvSwiftBic',
    abaRouting:           'prvAbaRouting',
    bancoIntermediario:   'prvBancoIntermediario',
    swiftIntermediario:   'prvSwiftIntermediario',
    gastosBancarios:      'prvGastosBancarios'
  };

  // Campos que se excluyen del cálculo de completitud
  var CAMPOS_EXCLUIDOS = { id: true, fechaAlta: true, fechaEdicion: true };

  // ── Helpers internos ──
  function _dash() {
    return window.DASH || {};
  }

  function _url() {
    return _dash().APPS_SCRIPT_URL || '';
  }

  function _escapeHTML(str) {
    var fn = _dash().escapeHTML;
    if (fn) return fn(str);
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function _formatMXN(val) {
    var fn = _dash().formatMXN;
    if (fn) return fn(val);
    var n = parseFloat(val) || 0;
    return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function _getEl(id) {
    return document.getElementById(id);
  }

  function _getVal(id) {
    var el = _getEl(id);
    if (!el) return '';
    return el.value || '';
  }

  function _setVal(id, val) {
    var el = _getEl(id);
    if (!el) return;
    el.value = (val !== undefined && val !== null) ? val : '';
  }

  // ── calcCompletitud ──
  function calcCompletitud(obj) {
    if (!obj) return 0;
    var total = 0;
    var llenos = 0;
    Object.keys(obj).forEach(function (key) {
      if (CAMPOS_EXCLUIDOS[key]) return;
      total++;
      var v = obj[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') llenos++;
    });
    if (total === 0) return 0;
    return Math.round((llenos / total) * 100);
  }

  // ── updateIndicators ──
  function updateIndicators() {
    var total    = _proveedores.length;
    var pool     = _proveedores.filter(function (p) { return String(p.tipoProveedor) === 'Pool'; }).length;
    var oneShot  = _proveedores.filter(function (p) { return String(p.tipoProveedor) === 'One Shot'; }).length;
    var sumPct   = 0;
    _proveedores.forEach(function (p) { sumPct += calcCompletitud(p); });
    var avgPct   = total > 0 ? Math.round(sumPct / total) : 0;

    var elTotal   = _getEl('indPrvTotal');
    var elPool    = _getEl('indPrvPool');
    var elOneShot = _getEl('indPrvOneShot');
    var elComp    = _getEl('indPrvCompletitud');

    if (elTotal)   elTotal.textContent   = total;
    if (elPool)    elPool.textContent    = pool;
    if (elOneShot) elOneShot.textContent = oneShot;
    if (elComp)    elComp.textContent    = avgPct + '%';
  }

  // ── renderTable ──
  function renderTable(keepPage) {
    var search    = (_getEl('prvSearch')  ? _getEl('prvSearch').value.trim().toLowerCase()  : '');
    var tipoFiltro  = (_getEl('prvTipo')  ? _getEl('prvTipo').value  : '');
    var estadoFiltro = (_getEl('prvEstado') ? _getEl('prvEstado').value : '');

    // Toggle clear button
    if (window.BNKHelpers) BNKHelpers.toggleClearButton('prvClear', 'prvFilters');

    var filtered = _proveedores.filter(function (p) {
      if (search) {
        var hay = [p.id, p.razonSocial, p.nombreComercial, p.nombreContacto].join(' ').toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      if (tipoFiltro && String(p.tipoProveedor) !== tipoFiltro) return false;
      if (estadoFiltro && String(p.cuentaActiva) !== estadoFiltro) return false;
      return true;
    });

    // Enrich with _pct for sorting
    filtered.forEach(function (p) { p._pct = calcCompletitud(p); });

    var prvTable   = _getEl('prvTable');
    var prvEmpty   = _getEl('prvEmpty');
    var prvLoading = _getEl('prvLoading');
    var prvBody    = _getEl('prvBody');

    if (prvLoading) prvLoading.style.display = 'none';

    if (!filtered.length) {
      if (prvTable)  prvTable.style.display  = 'none';
      if (prvEmpty)  prvEmpty.style.display  = 'block';
      if (window.BNKHelpers) BNKHelpers.updateResultCount('prvCount', '0', 0, _proveedores.length, 'proveedores');
      var pagEl = _getEl('prvPagination');
      if (pagEl) pagEl.style.display = 'none';
      return;
    }

    if (prvTable)  prvTable.style.display  = 'table';
    if (prvEmpty)  prvEmpty.style.display  = 'none';

    // Sort
    if (window.BNKSort && _sortKey) {
      filtered = BNKSort.apply(filtered, _sortKey, _sortDir);
    }

    // Reset page on filter change
    if (!keepPage) _page = 1;

    // Paginate
    var pageResult = { rows: filtered, currentPage: 1, totalPages: 1, totalFiltered: filtered.length };
    if (window.BNKPagination) {
      pageResult = BNKPagination.paginate(filtered, _page);
      _page = pageResult.currentPage;
      BNKPagination.render('prvPagination', pageResult, function (p) { _page = p; renderTable(true); });
    }

    // Result count
    var showRange = pageResult.rows.length > 0
      ? ((pageResult.currentPage - 1) * 50 + 1) + '\u2013' + ((pageResult.currentPage - 1) * 50 + pageResult.rows.length)
      : '0';
    if (window.BNKHelpers) BNKHelpers.updateResultCount('prvCount', showRange, filtered.length, _proveedores.length, 'proveedores');

    // Update sort indicators
    _updateSortHeaders('prvTable', _sortKey, _sortDir);

    var html = '';
    pageResult.rows.forEach(function (p) {
      var pct = p._pct;
      var pctClass = pct >= 70 ? 'status-pct--high' : pct >= 40 ? 'status-pct--mid' : 'status-pct--low';
      var cuentaActiva = String(p.cuentaActiva) === 'Sí';
      var cuentaClass  = cuentaActiva ? 'cuenta-badge--on' : 'cuenta-badge--off';
      var cuentaLabel  = cuentaActiva ? 'ACTIVA' : 'INACTIVA';
      var tipo         = String(p.tipoProveedor) || '';
      var tipoClass    = tipo ? 'tipo-' + tipo.replace(/\s+/g, '-') : '';

      var idSafe            = _escapeHTML(p.id || '');
      var razonSocialSafe   = _escapeHTML(p.razonSocial    || '\u2014');
      var nombreComSafe     = _escapeHTML(p.nombreComercial || '\u2014');
      var fechaAltaSafe     = _escapeHTML(p.fechaAlta      || '\u2014');
      var fechaEdSafe       = _escapeHTML(p.fechaEdicion    || '\u2014');

      html += '<tr>'
        + '<td><span class="dash-table col-folio">' + idSafe + '</span></td>'
        + '<td><span class="status-pct ' + pctClass + '">' + pct + '%</span></td>'
        + '<td>' + razonSocialSafe + '</td>'
        + '<td style="color:var(--tx);font-size:12px">' + nombreComSafe + '</td>'
        + '<td>' + (tipo ? '<span class="tipo-badge ' + tipoClass + '">' + _escapeHTML(tipo) + '</span>' : '\u2014') + '</td>'
        + '<td><span class="cuenta-badge ' + cuentaClass + '" title="' + cuentaLabel + '"></span></td>'
        + '<td style="color:var(--tx);font-size:12px">' + fechaAltaSafe + '</td>'
        + '<td style="color:var(--tx);font-size:12px">' + fechaEdSafe + '</td>'
        + '<td>'
        +   '<button class="tbl-action tbl-action--edit" data-id="' + idSafe + '" title="Editar">&#9998;</button>'
        +   '<button class="tbl-action tbl-action--view" data-id="' + idSafe + '" title="Ver">&#128065;</button>'
        +   '<button class="tbl-action tbl-action--del" data-id="' + idSafe + '" title="Eliminar">&times;</button>'
        + '</td>'
        + '</tr>';
    });

    if (prvBody) prvBody.innerHTML = html;
  }

  // Helper para actualizar clases de sort en headers
  function _updateSortHeaders(tableId, activeKey, activeDir) {
    var table = _getEl(tableId);
    if (!table) return;
    var ths = table.querySelectorAll('th.sortable');
    ths.forEach(function (th) {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.getAttribute('data-key') === activeKey) {
        th.classList.add(activeDir === 'desc' ? 'sort-desc' : 'sort-asc');
      }
    });
  }

  // ── Actualizar círculo de completitud en el modal ──
  function _actualizarCirculo(pct) {
    var path = _getEl('prvCompletitudPath');
    var text = _getEl('prvCompletitudText');
    if (path) path.setAttribute('stroke-dasharray', pct + ', 100');
    if (text) text.textContent = pct + '%';
  }

  // ── abrirModal ──
  function abrirModal(proveedorData, modo) {
    var overlay = _getEl('prvOverlay');
    var titulo  = _getEl('prvModalTitle');
    if (!overlay) return;

    // Limpiar siempre primero
    _setVal('prvId', '');
    _proveedorActivoId = null;
    Object.keys(CAMPO_ID).forEach(function (campo) {
      _setVal(CAMPO_ID[campo], '');
    });
    // Valores por defecto para selects
    _setVal('prvCuentaActiva', 'Sí');
    _setVal('prvPais', 'México');

    // Limpiar tabla de servicios
    var srvBody = _getEl('prvServiciosBody');
    if (srvBody) srvBody.innerHTML = '';
    _mostrarServiciosEmpty(true);

    if (modo === 'crear') {
      if (titulo) titulo.textContent = 'NUEVO PROVEEDOR';
      _actualizarCirculo(0);
    } else {
      var esModo = (modo === 'editar') ? 'EDITAR PROVEEDOR' : 'VER PROVEEDOR';
      if (titulo) titulo.textContent = esModo;

      if (proveedorData && proveedorData.id) {
        _setVal('prvId', proveedorData.id);
        _proveedorActivoId = proveedorData.id;
      }

      // Popular todos los campos mapeados
      Object.keys(CAMPO_ID).forEach(function (campo) {
        if (proveedorData && proveedorData[campo] !== undefined) {
          _setVal(CAMPO_ID[campo], proveedorData[campo]);
        }
      });

      // Modo ver: deshabilitar todos los campos
      var esVer = (modo === 'ver');
      var modal = overlay.querySelector('.bnk-modal');
      if (modal) {
        var inputs = modal.querySelectorAll('input, select, textarea');
        inputs.forEach(function (el) {
          if (el.id === 'prvId') return;
          el.disabled = esVer;
        });
        var btnGuardar = _getEl('prvGuardar');
        if (btnGuardar) btnGuardar.style.display = esVer ? 'none' : '';
        var btnAddSrv = _getEl('prvAddServicio');
        if (btnAddSrv) btnAddSrv.style.display = esVer ? 'none' : '';
      }

      var pct = calcCompletitud(proveedorData);
      _actualizarCirculo(pct);
    }

    // Mostrar primer tab
    _activarTab('prvTab1');

    // ── Cotizaciones vinculadas ──
    var wrap = _getEl('prvCotizacionesWrap');
    if (!wrap) {
      // Inyectar contenedor si no existe en el HTML
      wrap = document.createElement('div');
      wrap.id = 'prvCotizacionesWrap';
      wrap.style.marginTop = '16px';
      var modalBody = overlay.querySelector('.bnk-modal-body');
      if (modalBody) modalBody.appendChild(wrap);
    }
    var prvId = (proveedorData && proveedorData.id) ? String(proveedorData.id) : '';
    var prvNombreComercial = (proveedorData && proveedorData.nombreComercial) ? String(proveedorData.nombreComercial).toLowerCase() : '';
    var prvRazonSocial = (proveedorData && proveedorData.razonSocial) ? String(proveedorData.razonSocial).toLowerCase() : '';
    var allCots = (window.DASH && window.DASH.allData) ? window.DASH.allData : [];
    var vinculadas = allCots.filter(function (cot) {
      // Filtrar por proveedorId si está disponible, o por coincidencia de nombre
      if (prvId && cot.proveedorId && String(cot.proveedorId) === prvId) return true;
      var cotEmpresa = String(cot.empresa || cot.cliente || '').toLowerCase();
      return (prvNombreComercial && cotEmpresa === prvNombreComercial) ||
             (prvRazonSocial && cotEmpresa === prvRazonSocial);
    });
    var cotHtml = '<div class="bnk-section-label" style="margin-top:16px">COTIZACIONES VINCULADAS: ' + vinculadas.length + '</div>';
    cotHtml += '<div id="prvCotizaciones">';
    if (vinculadas.length === 0) {
      cotHtml += '<span style="color:var(--tx-muted);font-size:12px">Sin cotizaciones vinculadas</span>';
    } else {
      vinculadas.forEach(function (cot) {
        var folio = _escapeHTML(cot.folio || '');
        var estado = _escapeHTML(cot.estado || '');
        var pdfUrl = cot.pdfUrl || cot.linkPDF || '';
        if (pdfUrl) {
          cotHtml += '<a href="' + _escapeHTML(pdfUrl) + '" target="_blank" rel="noopener" style="display:inline-block;margin:4px 8px 4px 0;font-size:12px;color:var(--accent)">' + folio + '</a>';
        } else {
          cotHtml += '<span style="display:inline-block;margin:4px 8px 4px 0;font-size:12px;color:var(--tx-muted)">' + folio + '</span>';
        }
        if (estado) {
          cotHtml += '<span style="font-size:11px;color:var(--tx-muted)">(' + estado + ')</span> ';
        }
      });
    }
    cotHtml += '</div>';
    wrap.innerHTML = cotHtml;

    // Hacer visible el overlay
    overlay.classList.add('visible');
  }

  // ── cerrarModal ──
  function cerrarModal() {
    var overlay = _getEl('prvOverlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    _proveedorActivoId = null;

    // Re-habilitar inputs por si venía de modo 'ver'
    var inputs = overlay.querySelectorAll('input, select, textarea');
    inputs.forEach(function (el) { el.disabled = false; });
    var btnGuardar = _getEl('prvGuardar');
    if (btnGuardar) btnGuardar.style.display = '';
    var btnAddSrv = _getEl('prvAddServicio');
    if (btnAddSrv) btnAddSrv.style.display = '';
  }

  // ── Activar tab en el modal ──
  function _activarTab(tabId) {
    var overlay = _getEl('prvOverlay');
    if (!overlay) return;

    // Desactivar todos los tabs
    var tabs = overlay.querySelectorAll('.modal-tab');
    tabs.forEach(function (t) { t.classList.remove('active'); });
    var panels = overlay.querySelectorAll('.modal-tab-content');
    panels.forEach(function (p) {
      p.classList.remove('active');
      p.style.display = 'none';
    });

    // Activar el solicitado
    var panelTarget = _getEl(tabId);
    if (panelTarget) {
      panelTarget.classList.add('active');
      panelTarget.style.display = 'block';
    }

    // Activar botón de tab correspondiente
    var btn = overlay.querySelector('[data-target="' + tabId + '"]');
    if (btn) btn.classList.add('active');

    // Si se abre Tab5 y hay proveedor activo, cargar servicios
    if (tabId === 'prvTab5' && _proveedorActivoId) {
      loadServicios(_proveedorActivoId);
    }
  }

  // ── Validar email ──
  var _EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function _validarEmail(valor, nombreCampo) {
    if (valor && !_EMAIL_RE.test(valor)) {
      BNKToast.warn('Email no válido: ' + nombreCampo);
      return false;
    }
    return true;
  }

  // ── guardarProveedor ──
  function guardarProveedor() {
    var razonSocial = _getVal('prvRazonSocial').trim();
    if (!razonSocial) {
      BNKToast.warn('La razón social es obligatoria.');
      return;
    }

    // Validación de email
    var correo = _getVal('prvCorreoContacto').trim();
    if (!_validarEmail(correo, 'Correo de contacto')) return;

    var id = _getVal('prvId').trim();
    var esNuevo = !id;

    // Recopilar todos los campos
    var payload = { tipoOperacion: esNuevo ? 'createProveedor' : 'updateProveedor' };
    if (!esNuevo) payload.id = id;

    Object.keys(CAMPO_ID).forEach(function (campo) {
      payload[campo] = _getVal(CAMPO_ID[campo]).trim();
    });

    var url = _url();
    if (!url) { BNKToast.warn('URL del backend no configurada.'); return; }

    var btnGuardar = _getEl('prvGuardar');
    if (btnGuardar) { btnGuardar.textContent = 'GUARDANDO...'; btnGuardar.disabled = true; }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    })
    .then(function (res) { return res.json(); })
    .then(function (result) {
      if (btnGuardar) { btnGuardar.textContent = 'GUARDAR'; btnGuardar.disabled = false; }
      if (result.status === 'ok') {
        BNKToast.ok('Proveedor guardado correctamente.');
        cerrarModal();
        load();
      } else {
        BNKToast.error('Error: ' + (result.message || 'No se pudo guardar.'));
      }
    })
    .catch(function (err) {
      if (btnGuardar) { btnGuardar.textContent = 'GUARDAR'; btnGuardar.disabled = false; }
      BNKToast.error('Error de conexión: ' + err.message);
    });
  }

  // ── eliminarProveedor ──
  function eliminarProveedor(id) {
    BNKConfirm.show('\xBFEliminar el proveedor ' + id + '?\nEsta acci\xF3n lo marcar\xE1 como inactivo.')
      .then(function (confirmado) {
        if (!confirmado) return;
        var url = _url();
        if (!url) return;

        fetch(url + '?action=deleteProveedor&id=' + encodeURIComponent(id))
          .then(function (res) { return res.json(); })
          .then(function (result) {
            if (result.status === 'ok') {
              BNKToast.ok('Proveedor eliminado.');
              load();
            } else {
              BNKToast.error('Error: ' + (result.message || 'No se pudo eliminar.'));
            }
          })
          .catch(function (err) {
            BNKToast.error('Error de conexión: ' + err.message);
          });
      });
  }

  // ── load ──
  function load() {
    var url        = _url();
    var prvLoading = _getEl('prvLoading');
    var prvTable   = _getEl('prvTable');
    var prvEmpty   = _getEl('prvEmpty');

    if (prvLoading) prvLoading.style.display = 'block';
    if (prvTable)   prvTable.style.display   = 'none';
    if (prvEmpty)   prvEmpty.style.display   = 'none';

    if (!url) {
      if (prvLoading) prvLoading.style.display = 'none';
      if (prvEmpty)   prvEmpty.style.display   = 'block';
      _proveedores = [];
      updateIndicators();
      return;
    }

    fetch(url + '?action=listProveedores')
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (prvLoading) prvLoading.style.display = 'none';
        if (result.status === 'ok') {
          _proveedores = result.data || [];
          _cargado = true;
          renderTable();
          updateIndicators();
        } else {
          _proveedores = [];
          if (prvEmpty) prvEmpty.style.display = 'block';
          updateIndicators();
        }
      })
      .catch(function () {
        if (prvLoading) prvLoading.style.display = 'none';
        _proveedores = [];
        if (prvEmpty) {
          prvEmpty.style.display = 'block';
          var txt = prvEmpty.querySelector('.dash-empty-text');
          if (txt) txt.textContent = 'ERROR AL CARGAR PROVEEDORES';
        }
        updateIndicators();
      });
  }

  // ══════════════════════════════════════════════════════════
  // TAB 5 — SERVICIOS
  // ══════════════════════════════════════════════════════════

  // ── Mostrar/ocultar estado vacío de servicios ──
  function _mostrarServiciosEmpty(mostrar) {
    var srvTable = _getEl('prvServiciosTable');
    var srvEmpty = _getEl('prvServiciosEmpty');
    if (srvTable) srvTable.style.display = mostrar ? 'none' : 'table';
    if (srvEmpty) srvEmpty.style.display = mostrar ? 'block' : 'none';
  }

  // ── loadServicios ──
  function loadServicios(proveedorId) {
    var url = _url();
    if (!url || !proveedorId) return;

    var srvBody = _getEl('prvServiciosBody');
    if (srvBody) srvBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--tx-muted)">Cargando...</td></tr>';
    _mostrarServiciosEmpty(false);

    fetch(url + '?action=listServicios&proveedorId=' + encodeURIComponent(proveedorId))
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (result.status === 'ok') {
          var servicios = result.data || [];
          _renderServicios(servicios);
        } else {
          if (srvBody) srvBody.innerHTML = '';
          _mostrarServiciosEmpty(true);
        }
      })
      .catch(function () {
        if (srvBody) srvBody.innerHTML = '';
        _mostrarServiciosEmpty(true);
      });
  }

  // ── Renderizar filas de servicios ──
  function _renderServicios(servicios) {
    var srvBody = _getEl('prvServiciosBody');
    if (!srvBody) return;

    if (!servicios || servicios.length === 0) {
      srvBody.innerHTML = '';
      _mostrarServiciosEmpty(true);
      return;
    }

    _mostrarServiciosEmpty(false);
    var html = '';
    servicios.forEach(function (s) {
      var idSafe        = _escapeHTML(s.id        || '');
      var catSafe       = _escapeHTML(s.categoria  || '');
      var srvSafe       = _escapeHTML(s.servicio   || '');
      var unidSafe      = _escapeHTML(s.unidad     || '');
      var costoFmt      = _formatMXN(s.costoUnitario);

      html += '<tr data-srv-id="' + idSafe + '">'
        + '<td>' + catSafe + '</td>'
        + '<td>' + srvSafe + '</td>'
        + '<td>' + unidSafe + '</td>'
        + '<td>' + _escapeHTML(costoFmt) + '</td>'
        + '<td>'
        +   '<button class="tbl-action tbl-action--edit srv-edit-btn" data-srv-id="' + idSafe + '" title="Editar">&#9998;</button>'
        +   '<button class="tbl-action tbl-action--del srv-del-btn" data-srv-id="' + idSafe + '" title="Eliminar">&times;</button>'
        + '</td>'
        + '</tr>';
    });
    srvBody.innerHTML = html;
  }

  // ── Agregar fila inline de nuevo servicio ──
  function _agregarFilaServicio() {
    var srvBody = _getEl('prvServiciosBody');
    if (!srvBody) return;

    // Evitar duplicar si ya hay una fila de edición nueva
    if (srvBody.querySelector('.srv-edit-row[data-new="1"]')) return;

    _mostrarServiciosEmpty(false);

    var tr = document.createElement('tr');
    tr.className = 'srv-edit-row';
    tr.setAttribute('data-new', '1');
    tr.innerHTML =
        '<td><input type="text" class="bnk-input srv-in-cat"  placeholder="Categoría"></td>'
      + '<td><input type="text" class="bnk-input srv-in-srv"  placeholder="Servicio"></td>'
      + '<td><input type="text" class="bnk-input srv-in-uni"  placeholder="Unidad"></td>'
      + '<td><input type="text" class="bnk-input srv-in-cost" placeholder="0.00"></td>'
      + '<td>'
      +   '<button class="tbl-action tbl-action--edit srv-save-new-btn" title="Guardar">&#10003;</button>'
      +   '<button class="tbl-action tbl-action--del srv-cancel-new-btn" title="Cancelar">&times;</button>'
      + '</td>';
    srvBody.appendChild(tr);

    // Enfocar primer campo
    var firstInput = tr.querySelector('.srv-in-cat');
    if (firstInput) firstInput.focus();
  }

  // ── Guardar nuevo servicio ──
  function _guardarNuevoServicio(tr) {
    var proveedorId = _getVal('prvId').trim();
    if (!proveedorId) { BNKToast.warn('Guarda el proveedor antes de agregar servicios.'); return; }

    var categoria     = tr.querySelector('.srv-in-cat').value.trim();
    var servicio      = tr.querySelector('.srv-in-srv').value.trim();
    var unidad        = tr.querySelector('.srv-in-uni').value.trim();
    var costoUnitario = tr.querySelector('.srv-in-cost').value.trim();

    if (!servicio) { BNKToast.warn('El campo Servicio es obligatorio.'); return; }

    var url = _url();
    if (!url) return;

    var payload = {
      tipoOperacion: 'createServicio',
      proveedorId:   proveedorId,
      categoria:     categoria,
      servicio:      servicio,
      unidad:        unidad,
      costoUnitario: costoUnitario
    };

    var saveBtn = tr.querySelector('.srv-save-new-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '...'; }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    })
    .then(function (res) { return res.json(); })
    .then(function (result) {
      if (result.status === 'ok') {
        loadServicios(proveedorId);
      } else {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '&#10003;'; }
        BNKToast.error('Error: ' + (result.message || 'No se pudo guardar el servicio.'));
      }
    })
    .catch(function (err) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '&#10003;'; }
      BNKToast.error('Error de conexión: ' + err.message);
    });
  }

  // ── Convertir fila de servicios a modo edición ──
  function _editarFilaServicio(srvId) {
    var srvBody = _getEl('prvServiciosBody');
    if (!srvBody) return;
    var tr = srvBody.querySelector('tr[data-srv-id="' + srvId + '"]');
    if (!tr) return;

    var tds = tr.querySelectorAll('td');
    var catVal  = tds[0].textContent;
    var srvVal  = tds[1].textContent;
    var uniVal  = tds[2].textContent;
    var costRaw = tds[3].textContent.replace(/[$,]/g, '');

    tr.className = 'srv-edit-row';
    tr.innerHTML =
        '<td><input type="text" class="bnk-input srv-in-cat"  value="' + _escapeHTML(catVal)  + '"></td>'
      + '<td><input type="text" class="bnk-input srv-in-srv"  value="' + _escapeHTML(srvVal)  + '"></td>'
      + '<td><input type="text" class="bnk-input srv-in-uni"  value="' + _escapeHTML(uniVal)  + '"></td>'
      + '<td><input type="text" class="bnk-input srv-in-cost" value="' + _escapeHTML(costRaw) + '"></td>'
      + '<td>'
      +   '<button class="tbl-action tbl-action--edit srv-save-edit-btn" data-srv-id="' + _escapeHTML(srvId) + '" title="Guardar">&#10003;</button>'
      +   '<button class="tbl-action tbl-action--del srv-cancel-edit-btn" data-srv-id="' + _escapeHTML(srvId) + '" title="Cancelar">&times;</button>'
      + '</td>';
  }

  // ── Guardar edición de servicio existente ──
  function _guardarEdicionServicio(tr, srvId) {
    var proveedorId   = _getVal('prvId').trim();
    var categoria     = tr.querySelector('.srv-in-cat').value.trim();
    var servicio      = tr.querySelector('.srv-in-srv').value.trim();
    var unidad        = tr.querySelector('.srv-in-uni').value.trim();
    var costoUnitario = tr.querySelector('.srv-in-cost').value.trim();

    if (!servicio) { BNKToast.warn('El campo Servicio es obligatorio.'); return; }

    var url = _url();
    if (!url) return;

    var payload = {
      tipoOperacion: 'updateServicio',
      id:            srvId,
      proveedorId:   proveedorId,
      categoria:     categoria,
      servicio:      servicio,
      unidad:        unidad,
      costoUnitario: costoUnitario
    };

    var saveBtn = tr.querySelector('.srv-save-edit-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '...'; }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    })
    .then(function (res) { return res.json(); })
    .then(function (result) {
      if (result.status === 'ok') {
        loadServicios(proveedorId);
      } else {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '&#10003;'; }
        BNKToast.error('Error: ' + (result.message || 'No se pudo actualizar el servicio.'));
      }
    })
    .catch(function (err) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '&#10003;'; }
      BNKToast.error('Error de conexión: ' + err.message);
    });
  }

  // ── eliminarServicio ──
  function eliminarServicio(id) {
    BNKConfirm.show('\xBFEliminar este servicio?\nEsta acci\xF3n no se puede deshacer.')
      .then(function (confirmado) {
        if (!confirmado) return;
        var proveedorId = _getVal('prvId').trim();
        var url = _url();
        if (!url) return;

        fetch(url + '?action=deleteServicio&id=' + encodeURIComponent(id))
          .then(function (res) { return res.json(); })
          .then(function (result) {
            if (result.status === 'ok') {
              BNKToast.ok('Servicio eliminado.');
              loadServicios(proveedorId || _proveedorActivoId);
            } else {
              BNKToast.error('Error: ' + (result.message || 'No se pudo eliminar el servicio.'));
            }
          })
          .catch(function (err) {
            BNKToast.error('Error de conexión: ' + err.message);
          });
      });
  }

  // ══════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ══════════════════════════════════════════════════════════

  // ── Event listeners de tabs internos del modal ──
  function _setupModalTabs() {
    var overlay = _getEl('prvOverlay');
    if (!overlay) return;
    overlay.addEventListener('click', function (e) {
      var tab = e.target.closest('.modal-tab');
      if (!tab) return;
      // Solo tabs del overlay de proveedores
      if (!overlay.contains(tab)) return;
      var target = tab.getAttribute('data-target');
      if (target && target.indexOf('prv') === 0) _activarTab(target);
    });
  }

  // ── Event listeners de filtros ──
  function _setupFiltros() {
    var search  = _getEl('prvSearch');
    var tipo    = _getEl('prvTipo');
    var estado  = _getEl('prvEstado');
    if (search) search.addEventListener('input', function () { renderTable(); });
    if (tipo)   tipo.addEventListener('change', function () { renderTable(); });
    if (estado) estado.addEventListener('change', function () { renderTable(); });

    // Sort headers
    var table = _getEl('prvTable');
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
          renderTable(true);
        });
      });
    }

    // Export CSV
    var btnExport = _getEl('prvExport');
    if (btnExport) {
      btnExport.addEventListener('click', function () {
        if (!window.BNKExport) return;
        var data = _proveedores.slice();
        if (window.BNKSort && _sortKey) data = BNKSort.apply(data, _sortKey, _sortDir);
        var headers = ['No. Proveedor', 'Razón Social', 'Nombre Comercial', 'Tipo', 'Cuenta Activa',
          'Contacto', 'Correo', 'Teléfono', 'RFC', 'Fecha Alta', 'Últ. Edición'];
        var rows = data.map(function (p) {
          return [p.id, p.razonSocial || '', p.nombreComercial || '', p.tipoProveedor || '',
            p.cuentaActiva || '', p.nombreContacto || '', p.correoContacto || '',
            p.telefonoContacto || '', p.rfc || '', p.fechaAlta || '', p.fechaEdicion || ''];
        });
        var hoy = new Date().toISOString().slice(0, 10);
        BNKExport.csv('proveedores_' + hoy + '.csv', headers, rows);
      });
    }

    // Clear filters
    var btnClear = _getEl('prvClear');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        if (window.BNKHelpers) BNKHelpers.clearFilters('prvFilters', function () { renderTable(); });
      });
    }
  }

  // ── Event delegation en la tabla principal ──
  function _setupTablaAcciones() {
    var prvBody = _getEl('prvBody');
    if (!prvBody) return;

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.tbl-action');
      if (!btn) return;

      // Solo botones dentro de #prvBody (tabla principal)
      if (!btn.closest('#prvBody')) return;

      var id = btn.getAttribute('data-id');
      var proveedor = null;
      for (var i = 0; i < _proveedores.length; i++) {
        if (_proveedores[i].id === id) { proveedor = _proveedores[i]; break; }
      }

      if (btn.classList.contains('tbl-action--edit')) {
        if (proveedor) abrirModal(proveedor, 'editar');
      } else if (btn.classList.contains('tbl-action--view')) {
        if (proveedor) abrirModal(proveedor, 'ver');
      } else if (btn.classList.contains('tbl-action--del')) {
        eliminarProveedor(id);
      }
    });
  }

  // ── Event delegation en la tabla de servicios (Tab 5) ──
  function _setupServiciosAcciones() {
    var overlay = _getEl('prvOverlay');
    if (!overlay) return;

    overlay.addEventListener('click', function (e) {
      // Botón "+ Agregar Servicio"
      if (e.target.id === 'prvAddServicio' || e.target.closest('#prvAddServicio')) {
        _agregarFilaServicio();
        return;
      }

      var btn = e.target.closest('.tbl-action');
      if (!btn) return;

      // Verificar que estamos en el body de servicios
      if (!btn.closest('#prvServiciosBody')) return;

      var srvId = btn.getAttribute('data-srv-id');
      var tr    = btn.closest('tr');

      // Guardar nuevo servicio
      if (btn.classList.contains('srv-save-new-btn')) {
        _guardarNuevoServicio(tr);
        return;
      }

      // Cancelar nuevo servicio
      if (btn.classList.contains('srv-cancel-new-btn')) {
        if (tr && tr.parentNode) tr.parentNode.removeChild(tr);
        var srvBody = _getEl('prvServiciosBody');
        if (srvBody && srvBody.querySelectorAll('tr:not(.srv-edit-row)').length === 0
            && !srvBody.querySelector('.srv-edit-row')) {
          _mostrarServiciosEmpty(true);
        }
        return;
      }

      // Guardar edición de servicio
      if (btn.classList.contains('srv-save-edit-btn')) {
        _guardarEdicionServicio(tr, srvId);
        return;
      }

      // Cancelar edición de servicio
      if (btn.classList.contains('srv-cancel-edit-btn')) {
        if (_proveedorActivoId) loadServicios(_proveedorActivoId);
        return;
      }

      // Editar servicio (convertir fila)
      if (btn.classList.contains('srv-edit-btn')) {
        _editarFilaServicio(srvId);
        return;
      }

      // Eliminar servicio
      if (btn.classList.contains('srv-del-btn')) {
        eliminarServicio(srvId);
        return;
      }
    });
  }

  // ── Event listeners generales del modal ──
  function _setupEventos() {
    var btnNuevo = _getEl('btnNuevoProveedor');
    if (btnNuevo) btnNuevo.addEventListener('click', function () { abrirModal({}, 'crear'); });

    var btnGuardar = _getEl('prvGuardar');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarProveedor);

    var btnCancel = _getEl('prvCancel');
    if (btnCancel) btnCancel.addEventListener('click', cerrarModal);

    var btnClose = _getEl('prvClose');
    if (btnClose) btnClose.addEventListener('click', cerrarModal);

    // Cerrar al hacer click en el overlay (fuera del modal)
    var overlay = _getEl('prvOverlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) cerrarModal();
      });
    }

    _setupModalTabs();
    _setupFiltros();
    _setupTablaAcciones();
    _setupServiciosAcciones();
  }

  // ── Inicializar ──
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setupEventos);
    } else {
      _setupEventos();
    }
  }

  init();

  // ── Namespace público ──
  window.BNKProveedores = {
    load:              load,
    renderTable:       renderTable,
    updateIndicators:  updateIndicators,
    calcCompletitud:   calcCompletitud,
    abrirModal:        abrirModal,
    cerrarModal:       cerrarModal,
    guardarProveedor:  guardarProveedor,
    eliminarProveedor: eliminarProveedor,
    loadServicios:     loadServicios,
    eliminarServicio:  eliminarServicio,
    // Expuesto para que el autocompletado BNK pueda filtrar proveedores
    getAll: function () { return _proveedores; }
  };

})();
