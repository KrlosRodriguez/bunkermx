/* =========================================================
   clientes.js — Módulo de Clientes para el Panel de Ventas
   Namespace: window.BNKClientes
   Requiere: window.DASH (expuesto desde el script inline de dashboard.html)
   Sintaxis: ES5 (var, function declarations)
   ========================================================= */

(function () {
  'use strict';

  // Array local de clientes en este módulo
  var _clientes = [];
  var _cargado = false;

  // Sort & pagination state
  var _sortKey = 'id';
  var _sortDir = 'asc';
  var _page = 1;

  // Focus trap cleanup
  var _focusTrapCleanup = null;

  // ── Mapeo campo backend → id de elemento HTML ──
  var CAMPO_ID = {
    empresa:             'cliEmpresa',
    marcas:              'cliMarcas',
    tipoPersona:         'cliTipoPersona',
    condicionesPago:     'cliCondicionesPago',
    cuentaActiva:        'cliCuentaActiva',
    fechaAlta:           'cliFechaAlta',
    observaciones:       'cliObservaciones',
    personaContacto:     'cliPersonaContacto',
    puestoContacto:      'cliPuestoContacto',
    correoContacto:      'cliCorreoContacto',
    telefonoContacto:    'cliTelefonoContacto',
    razonSocial:         'cliRazonSocial',
    rfc:                 'cliRfc',
    curp:                'cliCurp',
    regimenFiscal:       'cliRegimenFiscal',
    usoCfdi:             'cliUsoCfdi',
    formaPago:           'cliFormaPago',
    metodoPago:          'cliMetodoPago',
    calle:               'cliCalle',
    noExt:               'cliNoExt',
    noInt:               'cliNoInt',
    colonia:             'cliColonia',
    cp:                  'cliCp',
    alcaldia:            'cliAlcaldia',
    estado:              'cliEstadoGeo',
    pais:                'cliPais',
    bancoMxn:            'cliBancoMxn',
    sucursal:            'cliSucursal',
    titularCuenta:       'cliTitularCuenta',
    cuentaCorta:         'cliCuentaCorta',
    clabe:               'cliClabe',
    tipoCuenta:          'cliTipoCuenta',
    bancoExtranjero:     'cliBancoExtranjero',
    divisa:              'cliDivisa',
    titularExtranjero:   'cliTitularExtranjero',
    cuentaIban:          'cliCuentaIban',
    swiftBic:            'cliSwiftBic',
    abaRouting:          'cliAbaRouting',
    bancoIntermediario:  'cliBancoIntermediario',
    swiftIntermediario:  'cliSwiftIntermediario'
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
    var total = _clientes.length;
    var activos = _clientes.filter(function (c) { return String(c.cuentaActiva) === 'Sí'; }).length;
    var inactivos = total - activos;
    var sumPct = 0;
    _clientes.forEach(function (c) { sumPct += calcCompletitud(c); });
    var avgPct = total > 0 ? Math.round(sumPct / total) : 0;

    if (window.BNKAnimate) {
      BNKAnimate.staggerCountUp([
        { element: _getEl('indCliTotal'), value: total, options: {} },
        { element: _getEl('indCliActivos'), value: activos, options: {} },
        { element: _getEl('indCliInactivos'), value: inactivos, options: {} },
        { element: _getEl('indCliCompletitud'), value: avgPct, options: { suffix: '%' } }
      ]);
    } else {
      var elTotal = _getEl('indCliTotal');
      var elActivos = _getEl('indCliActivos');
      var elInactivos = _getEl('indCliInactivos');
      var elComp = _getEl('indCliCompletitud');
      if (elTotal) elTotal.textContent = total;
      if (elActivos) elActivos.textContent = activos;
      if (elInactivos) elInactivos.textContent = inactivos;
      if (elComp) elComp.textContent = avgPct + '%';
    }
  }

  // ── renderTable ──
  function renderTable(keepPage) {
    var search = (_getEl('cliSearch') ? _getEl('cliSearch').value.trim().toLowerCase() : '');
    var estadoFiltro = (_getEl('cliEstado') ? _getEl('cliEstado').value : '');

    // Toggle clear button
    if (window.BNKHelpers) BNKHelpers.toggleClearButton('cliClear', 'cliFilters');

    var filtered = _clientes.filter(function (c) {
      if (search) {
        var hay = [c.id, c.empresa, c.marcas, c.personaContacto].join(' ').toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      if (estadoFiltro && String(c.cuentaActiva) !== estadoFiltro) return false;
      return true;
    });

    // Enrich with _pct for sorting
    filtered.forEach(function (c) { c._pct = calcCompletitud(c); });

    var cliTable   = _getEl('cliTable');
    var cliEmpty   = _getEl('cliEmpty');
    var cliLoading = _getEl('cliLoading');
    var cliBody    = _getEl('cliBody');

    if (cliLoading) cliLoading.style.display = 'none';

    if (!filtered.length) {
      if (cliTable)  cliTable.style.display  = 'none';
      if (cliEmpty)  cliEmpty.style.display  = 'block';
      if (window.BNKHelpers) BNKHelpers.updateResultCount('cliCount', '0', 0, _clientes.length, 'clientes');
      var pagEl = _getEl('cliPagination');
      if (pagEl) pagEl.style.display = 'none';
      return;
    }

    if (cliTable)  cliTable.style.display  = 'table';
    if (cliEmpty)  cliEmpty.style.display  = 'none';

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
      BNKPagination.render('cliPagination', pageResult, function (p) { _page = p; renderTable(true); });
    }

    // Result count
    var showRange = pageResult.rows.length > 0
      ? ((pageResult.currentPage - 1) * 50 + 1) + '\u2013' + ((pageResult.currentPage - 1) * 50 + pageResult.rows.length)
      : '0';
    if (window.BNKHelpers) BNKHelpers.updateResultCount('cliCount', showRange, filtered.length, _clientes.length, 'clientes');

    // Update sort indicators
    _updateSortHeaders('cliTable', _sortKey, _sortDir);

    var html = '';
    pageResult.rows.forEach(function (c) {
      var pct = c._pct;
      var pctClass = pct >= 70 ? 'status-pct--high' : pct >= 40 ? 'status-pct--mid' : 'status-pct--low';
      var cuentaActiva = String(c.cuentaActiva) === 'Sí';
      var cuentaClass  = cuentaActiva ? 'cuenta-badge--on' : 'cuenta-badge--off';
      var cuentaLabel  = cuentaActiva ? 'ACTIVA' : 'INACTIVA';

      var idSafe      = _escapeHTML(c.id || '');
      var empresaSafe = _escapeHTML(c.empresa || '\u2014');
      var marcasSafe  = _escapeHTML(c.marcas  || '\u2014');
      var fechaEdSafe = _escapeHTML(c.fechaEdicion || '\u2014');

      html += '<tr>'
        + '<td><span class="dash-table col-folio">' + idSafe + '</span></td>'
        + '<td><span class="status-pct ' + pctClass + '">' + pct + '%</span></td>'
        + '<td>' + empresaSafe + '</td>'
        + '<td style="color:var(--tx);font-size:12px">' + marcasSafe + '</td>'
        + '<td><span class="cuenta-badge-wrap"><span class="cuenta-badge ' + cuentaClass + '"></span><span class="cuenta-badge-label--' + (cuentaActiva ? 'on' : 'off') + '">' + cuentaLabel + '</span></span></td>'
        + '<td style="color:var(--tx);font-size:12px">' + fechaEdSafe + '</td>'
        + '<td>'
        +   '<button class="tbl-action tbl-action--edit" data-id="' + idSafe + '" title="Editar">&#9998;</button>'
        +   '<button class="tbl-action tbl-action--view" data-id="' + idSafe + '" title="Ver">&#128065;</button>'
        +   '<button class="tbl-action tbl-action--del" data-id="' + idSafe + '" title="Eliminar">&times;</button>'
        + '</td>'
        + '</tr>';
    });

    if (cliBody) cliBody.innerHTML = html;
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
    var path = _getEl('cliCompletitudPath');
    var text = _getEl('cliCompletitudText');
    if (path) path.setAttribute('stroke-dasharray', pct + ', 100');
    if (text) text.textContent = pct + '%';
  }

  // ── abrirModal ──
  function abrirModal(clienteData, modo) {
    var overlay = _getEl('cliOverlay');
    var titulo  = _getEl('cliModalTitle');
    if (!overlay) return;

    // Limpiar siempre primero
    _setVal('cliId', '');
    Object.keys(CAMPO_ID).forEach(function (campo) {
      _setVal(CAMPO_ID[campo], '');
    });
    // Valores por defecto para selects
    _setVal('cliCuentaActiva', 'Sí');
    _setVal('cliPais', 'México');

    if (modo === 'crear') {
      if (titulo) titulo.textContent = 'NUEVO CLIENTE';
      _actualizarCirculo(0);
    } else {
      var esModo = (modo === 'editar') ? 'EDITAR CLIENTE' : 'VER CLIENTE';
      if (titulo) titulo.textContent = esModo;

      if (clienteData && clienteData.id) {
        _setVal('cliId', clienteData.id);
      }

      // Popular todos los campos mapeados
      Object.keys(CAMPO_ID).forEach(function (campo) {
        if (clienteData && clienteData[campo] !== undefined) {
          _setVal(CAMPO_ID[campo], clienteData[campo]);
        }
      });

      // Modo ver: deshabilitar todos los campos
      var esVer = (modo === 'ver');
      var modal = overlay.querySelector('.bnk-modal');
      if (modal) {
        var inputs = modal.querySelectorAll('input, select, textarea');
        inputs.forEach(function (el) {
          if (el.id === 'cliId') return;
          el.disabled = esVer;
        });
        var btnGuardar = _getEl('cliGuardar');
        if (btnGuardar) btnGuardar.style.display = esVer ? 'none' : '';
      }

      var pct = calcCompletitud(clienteData);
      _actualizarCirculo(pct);
    }

    // Mostrar primer tab
    _activarTab('cliTab1');

    // ── Cotizaciones vinculadas ──
    var wrap = _getEl('cliCotizacionesWrap');
    if (!wrap) {
      // Inyectar contenedor si no existe en el HTML
      wrap = document.createElement('div');
      wrap.id = 'cliCotizacionesWrap';
      wrap.style.marginTop = '16px';
      var modalBody = overlay.querySelector('.bnk-modal-body');
      if (modalBody) modalBody.appendChild(wrap);
    }
    var empresaNombre = (clienteData && clienteData.empresa) ? String(clienteData.empresa).toLowerCase() : '';
    var allCots = (window.DASH && window.DASH.allData) ? window.DASH.allData : [];
    var vinculadas = [];
    if (empresaNombre) {
      vinculadas = allCots.filter(function (cot) {
        var cotEmpresa = String(cot.empresa || cot.cliente || '').toLowerCase();
        return cotEmpresa === empresaNombre;
      });
    }
    var cotHtml = '<div class="bnk-section-label" style="margin-top:16px">COTIZACIONES VINCULADAS: ' + vinculadas.length + '</div>';
    cotHtml += '<div id="cliCotizaciones">';
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

    // Focus trap
    if (_focusTrapCleanup) _focusTrapCleanup();
    if (window.BNKAccessibility) {
      _focusTrapCleanup = BNKAccessibility.trapFocus(overlay, cerrarModal);
    }
  }

  // ── cerrarModal ──
  function cerrarModal() {
    var overlay = _getEl('cliOverlay');
    if (!overlay) return;
    overlay.classList.remove('visible');

    // Cleanup focus trap
    if (_focusTrapCleanup) { _focusTrapCleanup(); _focusTrapCleanup = null; }

    // Re-habilitar inputs por si venía de modo 'ver'
    var inputs = overlay.querySelectorAll('input, select, textarea');
    inputs.forEach(function (el) { el.disabled = false; });
    var btnGuardar = _getEl('cliGuardar');
    if (btnGuardar) btnGuardar.style.display = '';
  }

  // ── Activar tab en el modal (con fade) ──
  var _modalTabSwitching = false;
  function _activarTab(tabId) {
    var overlay = _getEl('cliOverlay');
    if (!overlay || _modalTabSwitching) return;

    var currentPanel = overlay.querySelector('.modal-tab-content.active');
    var nextPanel = _getEl(tabId);

    // Actualizar botones de tab
    var tabs = overlay.querySelectorAll('.modal-tab');
    tabs.forEach(function (t) { t.classList.remove('active'); });
    var btn = overlay.querySelector('[data-target="' + tabId + '"]');
    if (btn) btn.classList.add('active');

    // Si no hay panel actual o es el mismo, activar directo
    if (!currentPanel || currentPanel === nextPanel || !nextPanel) {
      if (currentPanel && currentPanel !== nextPanel) {
        currentPanel.classList.remove('active');
        currentPanel.style.display = 'none';
      }
      if (nextPanel) { nextPanel.classList.add('active'); nextPanel.style.display = 'block'; }
      return;
    }

    // Fade transition
    _modalTabSwitching = true;
    currentPanel.style.transition = 'opacity 60ms ease-out';
    currentPanel.style.opacity = '0';
    setTimeout(function () {
      currentPanel.classList.remove('active');
      currentPanel.style.display = 'none';
      currentPanel.style.opacity = '';
      currentPanel.style.transition = '';

      nextPanel.style.opacity = '0';
      nextPanel.style.display = 'block';
      nextPanel.classList.add('active');
      requestAnimationFrame(function () {
        nextPanel.style.transition = 'opacity 80ms ease-in';
        nextPanel.style.opacity = '1';
        setTimeout(function () {
          nextPanel.style.transition = '';
          _modalTabSwitching = false;
        }, 80);
      });
    }, 60);
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

  // ── guardarCliente ──
  function guardarCliente() {
    var empresa = _getVal('cliEmpresa').trim();
    if (!empresa) {
      BNKToast.warn('El nombre de la empresa es obligatorio.');
      return;
    }

    // Validación de email
    var correo = _getVal('cliCorreoContacto').trim();
    if (!_validarEmail(correo, 'Correo de contacto')) return;

    var id = _getVal('cliId').trim();
    var esNuevo = !id;

    // Recopilar todos los campos
    var payload = { tipoOperacion: esNuevo ? 'createCliente' : 'updateCliente' };
    if (!esNuevo) payload.id = id;

    Object.keys(CAMPO_ID).forEach(function (campo) {
      payload[campo] = _getVal(CAMPO_ID[campo]).trim();
    });

    var url = _url();
    if (!url) { BNKToast.warn('URL del backend no configurada.'); return; }

    var btnGuardar = _getEl('cliGuardar');
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
        BNKToast.ok('Cliente guardado correctamente.');
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

  // ── eliminarCliente ──
  function eliminarCliente(id) {
    BNKConfirm.show('\xBFEliminar el cliente ' + id + '?\nEsta acci\xF3n lo marcar\xE1 como inactivo.')
      .then(function (confirmado) {
        if (!confirmado) return;
        var url = _url();
        if (!url) return;

        fetch(url + '?action=deleteCliente&id=' + encodeURIComponent(id))
          .then(function (res) { return res.json(); })
          .then(function (result) {
            if (result.status === 'ok') {
              BNKToast.ok('Cliente eliminado.');
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
    var url = _url();
    var cliLoading = _getEl('cliLoading');
    var cliTable   = _getEl('cliTable');
    var cliEmpty   = _getEl('cliEmpty');

    if (cliLoading) cliLoading.style.display = 'block';
    if (cliTable)   cliTable.style.display   = 'none';
    if (cliEmpty)   cliEmpty.style.display   = 'none';

    if (!url) {
      if (cliLoading) cliLoading.style.display = 'none';
      if (cliEmpty)   cliEmpty.style.display   = 'block';
      _clientes = [];
      updateIndicators();
      return;
    }

    fetch(url + '?action=listClientes')
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (cliLoading) cliLoading.style.display = 'none';
        if (result.status === 'ok') {
          _clientes = result.data || [];
          // Sincronizar con window.DASH para que el autocompletado BNK tenga datos frescos
          if (window.DASH) window.DASH.allClientes = _clientes;
          _cargado = true;
          renderTable();
          updateIndicators();
        } else {
          _clientes = [];
          if (cliEmpty) cliEmpty.style.display = 'block';
          updateIndicators();
        }
      })
      .catch(function () {
        if (cliLoading) cliLoading.style.display = 'none';
        _clientes = [];
        if (cliEmpty) {
          cliEmpty.style.display = 'block';
          var txt = cliEmpty.querySelector('.dash-empty-text');
          if (txt) txt.textContent = 'ERROR AL CARGAR CLIENTES';
        }
        updateIndicators();
      });
  }

  // ── Event listeners de tabs internos del modal ──
  function _setupModalTabs() {
    var overlay = _getEl('cliOverlay');
    if (!overlay) return;
    overlay.addEventListener('click', function (e) {
      var tab = e.target.closest('.modal-tab');
      if (!tab) return;
      var target = tab.getAttribute('data-target');
      if (target) _activarTab(target);
    });
  }

  // ── Event listeners de filtros ──
  function _setupFiltros() {
    var search = _getEl('cliSearch');
    var estado = _getEl('cliEstado');
    if (search) search.addEventListener('input', function () { renderTable(); });
    if (estado) estado.addEventListener('change', function () { renderTable(); });

    // Sort headers
    var table = _getEl('cliTable');
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
    var btnExport = _getEl('cliExport');
    if (btnExport) {
      btnExport.addEventListener('click', function () {
        if (!window.BNKExport) return;
        var data = _clientes.slice();
        if (window.BNKSort && _sortKey) data = BNKSort.apply(data, _sortKey, _sortDir);
        var headers = ['No. Cliente', 'Empresa', 'Marcas', 'Cuenta Activa', 'Tipo Persona', 'Contacto', 'Correo', 'Teléfono', 'RFC', 'Fecha Alta', 'Últ. Edición'];
        var rows = data.map(function (c) {
          return [c.id, c.empresa || '', c.marcas || '', c.cuentaActiva || '', c.tipoPersona || '',
            c.personaContacto || '', c.correoContacto || '', c.telefonoContacto || '',
            c.rfc || '', c.fechaAlta || '', c.fechaEdicion || ''];
        });
        var hoy = new Date().toISOString().slice(0, 10);
        BNKExport.csv('clientes_' + hoy + '.csv', headers, rows);
      });
    }

    // Clear filters
    var btnClear = _getEl('cliClear');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        if (window.BNKHelpers) BNKHelpers.clearFilters('cliFilters', function () { renderTable(); });
      });
    }
  }

  // ── Event delegation en la tabla ──
  function _setupTablaAcciones() {
    var cliBody = _getEl('cliBody');
    if (!cliBody) return;

    // Delegación de eventos en tbody
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.tbl-action');
      if (!btn) return;

      // Verificar que el botón está dentro de #cliBody
      if (!btn.closest('#cliBody')) return;

      var id = btn.getAttribute('data-id');
      var cliente = null;
      for (var i = 0; i < _clientes.length; i++) {
        if (_clientes[i].id === id) { cliente = _clientes[i]; break; }
      }

      if (btn.classList.contains('tbl-action--edit')) {
        if (cliente) abrirModal(cliente, 'editar');
      } else if (btn.classList.contains('tbl-action--view')) {
        if (cliente) abrirModal(cliente, 'ver');
      } else if (btn.classList.contains('tbl-action--del')) {
        eliminarCliente(id);
      }
    });
  }

  // ── Event listeners generales ──
  function _setupEventos() {
    var btnNuevo = _getEl('btnNuevoCliente');
    if (btnNuevo) btnNuevo.addEventListener('click', function () { abrirModal({}, 'crear'); });

    var btnGuardar = _getEl('cliGuardar');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarCliente);

    var btnCancel = _getEl('cliCancel');
    if (btnCancel) btnCancel.addEventListener('click', cerrarModal);

    var btnClose = _getEl('cliClose');
    if (btnClose) btnClose.addEventListener('click', cerrarModal);

    // Cerrar al hacer click en el overlay (fuera del modal)
    var overlay = _getEl('cliOverlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) cerrarModal();
      });
    }

    _setupModalTabs();
    _setupFiltros();
    _setupTablaAcciones();
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
  window.BNKClientes = {
    load:              load,
    renderTable:       renderTable,
    updateIndicators:  updateIndicators,
    calcCompletitud:   calcCompletitud,
    abrirModal:        abrirModal,
    cerrarModal:       cerrarModal,
    guardarCliente:    guardarCliente,
    eliminarCliente:   eliminarCliente,
    getData:           function () { return _clientes; },
    openDetail:        function (clienteId) {
      var cliente = null;
      for (var i = 0; i < _clientes.length; i++) {
        if (_clientes[i].id === clienteId) { cliente = _clientes[i]; break; }
      }
      if (cliente) abrirModal(cliente, 'ver');
    }
  };

})();
