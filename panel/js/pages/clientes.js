/* =========================================================
   clientes.js — Módulo de Clientes para el Panel BUNKER
   Namespace: window.BNKClientes
   Requiere: BNK_DB (firestore.js), BNK_AUTH (auth.js)
   Sintaxis: ES5 (var, function declarations)
   ========================================================= */

(function () {
  'use strict';

  // Array local de clientes en este módulo
  var _clientes = [];
  var _cargado = false;
  var _unsubscribe = null;

  // Sort & pagination state
  var _sortKey = 'id';
  var _sortDir = 'asc';
  var _page = 1;

  // Focus trap cleanup
  var _focusTrapCleanup = null;

  // ── Mapeo campo backend → id de elemento HTML ──
  // NOTA: 'marcas' se maneja aparte como chips (array), no como input simple
  var CAMPO_ID = {
    empresa:             'cliEmpresa',
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
  var CAMPOS_EXCLUIDOS = { id: true, fechaAlta: true, fechaEdicion: true, _pct: true, createdAt: true, updatedAt: true };

  // ── Helpers internos ──
  function _escapeHTML(str) {
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

  // ── Chips de marcas ──
  var _marcasActuales = []; // array de strings para el modal actual

  function _parseMarcas(val) {
    if (Array.isArray(val)) return val.filter(function (v) { return v && String(v).trim(); });
    if (!val || typeof val !== 'string') return [];
    return val.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function _renderChips() {
    var wrap = _getEl('cliMarcasWrap');
    var input = _getEl('cliMarcasInput');
    if (!wrap) return;
    // Remove existing chips
    var existing = wrap.querySelectorAll('.bnk-chip');
    existing.forEach(function (c) { c.remove(); });
    // Insert chips before input
    _marcasActuales.forEach(function (marca, idx) {
      var chip = document.createElement('span');
      chip.className = 'bnk-chip';
      chip.innerHTML = '<span class="bnk-chip-text">' + _escapeHTML(marca) + '</span>'
        + '<button class="bnk-chip-x" data-idx="' + idx + '" type="button" title="Quitar">&times;</button>';
      wrap.insertBefore(chip, input);
    });
  }

  function _addMarca(texto) {
    texto = texto.trim();
    if (!texto) return;
    // No duplicar
    var existe = _marcasActuales.some(function (m) { return m.toLowerCase() === texto.toLowerCase(); });
    if (existe) { BNKToast.warn('La marca "' + texto + '" ya existe.'); return; }
    _marcasActuales.push(texto);
    _renderChips();
  }

  function _removeMarca(idx) {
    _marcasActuales.splice(idx, 1);
    _renderChips();
  }

  function _setupChipsEvents() {
    var wrap = _getEl('cliMarcasWrap');
    var input = _getEl('cliMarcasInput');
    if (!wrap || !input) return;

    // Click on wrap focuses input
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) input.focus();
    });

    // Enter or comma to add
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        _addMarca(input.value.replace(',', ''));
        input.value = '';
      }
      // Backspace on empty input removes last chip
      if (e.key === 'Backspace' && !input.value && _marcasActuales.length > 0) {
        _removeMarca(_marcasActuales.length - 1);
      }
    });

    // Blur also adds if there's text
    input.addEventListener('blur', function () {
      if (input.value.trim()) {
        _addMarca(input.value);
        input.value = '';
      }
    });

    // Delete chip via X button (delegation)
    wrap.addEventListener('click', function (e) {
      var btn = e.target.closest('.bnk-chip-x');
      if (!btn) return;
      var idx = parseInt(btn.getAttribute('data-idx'));
      if (!isNaN(idx)) _removeMarca(idx);
    });
  }

  // ── Detección de duplicados por empresa ──
  function _checkDuplicado(empresa) {
    if (!empresa) return;
    var empresaLower = empresa.trim().toLowerCase();
    var idActual = _getVal('cliId').trim();
    var duplicado = null;
    for (var i = 0; i < _clientes.length; i++) {
      var c = _clientes[i];
      if (c.id === idActual) continue;
      if ((c.empresa || '').trim().toLowerCase() === empresaLower) {
        duplicado = c;
        break;
      }
    }
    // Mostrar/ocultar warning
    var warnEl = _getEl('cliDupWarn');
    if (!warnEl) return;
    if (duplicado) {
      warnEl.textContent = '\u26A0 Ya existe "' + duplicado.empresa + '" (' + duplicado.id + '). Clic para abrir ese registro.';
      warnEl.setAttribute('data-dup-id', duplicado.id);
      warnEl.classList.add('visible');
    } else {
      warnEl.classList.remove('visible');
    }
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
      var marcasArr   = _parseMarcas(c.marcas);
      var marcasSafe  = marcasArr.length > 0 ? _escapeHTML(marcasArr.join(', ')) : '\u2014';
      var fechaEdSafe = _escapeHTML(c.fechaEdicion || '\u2014');

      html += '<tr>'
        + '<td><span class="dash-table col-folio" data-cli-pop="' + idSafe + '" style="cursor:pointer">' + idSafe + '</span></td>'
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

    // Reset marcas chips
    _marcasActuales = [];
    // Hide duplicate warning
    var dupWarn = _getEl('cliDupWarn');
    if (dupWarn) dupWarn.classList.remove('visible');

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

      // Cargar marcas como chips
      if (clienteData) {
        _marcasActuales = _parseMarcas(clienteData.marcas);
      }

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
      // Disable chips wrap in view mode
      var chipsWrap = _getEl('cliMarcasWrap');
      if (chipsWrap) {
        if (esVer) chipsWrap.classList.add('disabled');
        else chipsWrap.classList.remove('disabled');
      }

      var pct = calcCompletitud(clienteData);
      _actualizarCirculo(pct);
    }

    // Renderizar chips de marcas
    _renderChips();

    // Mostrar primer tab
    _activarTab('cliTabGeneral');

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

    // Buscar cotizaciones vinculadas desde Firestore
    var empresaNombre = (clienteData && clienteData.empresa) ? String(clienteData.empresa).toLowerCase() : '';
    var cotHtml = '<div class="bnk-section-label" style="margin-top:16px">COTIZACIONES VINCULADAS</div>';
    cotHtml += '<div id="cliCotizaciones"><span style="color:var(--tx-muted);font-size:12px">Cargando...</span></div>';
    wrap.innerHTML = cotHtml;

    if (empresaNombre) {
      BNK_DB.cotizaciones.list().then(function (allCots) {
        var vinculadas = allCots.filter(function (cot) {
          var cotEmpresa = String(cot.empresa || cot.cliente || '').toLowerCase();
          return cotEmpresa === empresaNombre || cotEmpresa.indexOf(empresaNombre) !== -1 || empresaNombre.indexOf(cotEmpresa) !== -1;
        });
        _renderCotizacionesVinculadas(vinculadas);
      }).catch(function () {
        _renderCotizacionesVinculadas([]);
      });
    } else {
      _renderCotizacionesVinculadas([]);
    }

    // Hacer visible el overlay
    overlay.classList.add('visible');

    // Focus trap
    if (_focusTrapCleanup) _focusTrapCleanup();
    if (window.BNKAccessibility) {
      _focusTrapCleanup = BNKAccessibility.trapFocus(overlay, cerrarModal);
    }
  }

  // ── Renderizar cotizaciones vinculadas ──
  function _renderCotizacionesVinculadas(vinculadas) {
    var wrap = _getEl('cliCotizacionesWrap');
    if (!wrap) return;
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
    var chipsWrap = _getEl('cliMarcasWrap');
    if (chipsWrap) chipsWrap.classList.remove('disabled');
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
    // Permission check
    if (!BNK_AUTH.canEdit('clientes')) {
      BNKToast.warn('No tienes permisos para editar clientes.');
      return;
    }

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
    var data = {};
    Object.keys(CAMPO_ID).forEach(function (campo) {
      data[campo] = _getVal(CAMPO_ID[campo]).trim();
    });

    // Marcas como array
    data.marcas = _marcasActuales.slice();

    // Agregar fecha de edición
    data.fechaEdicion = new Date().toISOString().slice(0, 10);

    var btnGuardar = _getEl('cliGuardar');
    if (btnGuardar) { btnGuardar.textContent = 'GUARDANDO...'; btnGuardar.disabled = true; }

    var promise;
    if (esNuevo) {
      data.fechaAlta = new Date().toISOString().slice(0, 10);
      promise = BNK_DB.clientes.create(data);
    } else {
      promise = BNK_DB.clientes.update(id, data);
    }

    promise
      .then(function () {
        if (btnGuardar) { btnGuardar.textContent = 'GUARDAR'; btnGuardar.disabled = false; }
        BNKToast.ok('Cliente guardado correctamente.');
        cerrarModal();
        load();
      })
      .catch(function (err) {
        if (btnGuardar) { btnGuardar.textContent = 'GUARDAR'; btnGuardar.disabled = false; }
        BNKToast.error('Error al guardar: ' + err.message);
      });
  }

  // ── eliminarCliente ──
  function eliminarCliente(id) {
    // Permission check
    if (!BNK_AUTH.canEdit('clientes')) {
      BNKToast.warn('No tienes permisos para eliminar clientes.');
      return;
    }

    BNKConfirm.show('\xBFEliminar el cliente ' + id + '?\nEsta acci\xF3n no se puede deshacer.')
      .then(function (confirmado) {
        if (!confirmado) return;

        BNK_DB.clientes.delete(id)
          .then(function () {
            BNKToast.ok('Cliente eliminado.');
            load();
          })
          .catch(function (err) {
            BNKToast.error('Error al eliminar: ' + err.message);
          });
      });
  }

  // ── load ──
  function load() {
    var cliLoading = _getEl('cliLoading');
    var cliTable   = _getEl('cliTable');
    var cliEmpty   = _getEl('cliEmpty');

    if (cliLoading) cliLoading.style.display = '';
    if (cliTable)   cliTable.style.display   = 'none';
    if (cliEmpty)   cliEmpty.style.display   = 'none';

    return BNK_DB.clientes.list()
      .then(function (data) {
        if (cliLoading) cliLoading.style.display = 'none';
        _clientes = data || [];
        _cargado = true;
        renderTable();
        updateIndicators();
      })
      .catch(function (err) {
        if (cliLoading) cliLoading.style.display = 'none';
        _clientes = [];
        BNKToast.error('Error al cargar clientes: ' + (err && err.message ? err.message : 'desconocido'));
        if (cliEmpty) {
          cliEmpty.style.display = 'block';
          var txt = cliEmpty.querySelector('.dash-empty-text');
          if (txt) txt.textContent = 'ERROR AL CARGAR CLIENTES';
          var icon = cliEmpty.querySelector('.dash-empty-icon');
          if (icon) icon.textContent = '\u26A0';
          // Add retry button if not already present
          if (!cliEmpty.querySelector('.cli-retry-btn')) {
            var retryBtn = document.createElement('button');
            retryBtn.className = 'panel-btn-primary cli-retry-btn';
            retryBtn.textContent = 'REINTENTAR';
            retryBtn.style.marginTop = '16px';
            retryBtn.addEventListener('click', function () { load(); });
            cliEmpty.appendChild(retryBtn);
          }
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
          var marcasStr = Array.isArray(c.marcas) ? c.marcas.join(', ') : (c.marcas || '');
          return [c.id, c.empresa || '', marcasStr, c.cuentaActiva || '', c.tipoPersona || '',
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
      // Popover on folio click
      var folioPop = e.target.closest('[data-cli-pop]');
      if (folioPop && folioPop.closest('#cliBody')) {
        e.stopPropagation();
        _openClientePopover(folioPop.getAttribute('data-cli-pop'), folioPop);
        return;
      }

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

    // Escape to close modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var overlay = _getEl('cliOverlay');
        if (overlay && overlay.classList.contains('visible')) {
          e.preventDefault();
          cerrarModal();
        }
      }
    });

    _setupModalTabs();
    _setupFiltros();
    _setupTablaAcciones();
    _setupChipsEvents();

    // Inyectar warning de duplicados bajo cliEmpresa
    var empresaGroup = _getEl('cliEmpresa') ? _getEl('cliEmpresa').closest('.bnk-form-group') : null;
    if (empresaGroup && !_getEl('cliDupWarn')) {
      var warn = document.createElement('div');
      warn.className = 'bnk-dup-warn';
      warn.id = 'cliDupWarn';
      empresaGroup.appendChild(warn);
    }

    // Detección de duplicados al escribir empresa
    var cliEmpresa = _getEl('cliEmpresa');
    if (cliEmpresa) {
      cliEmpresa.addEventListener('blur', function () {
        _checkDuplicado(cliEmpresa.value);
      });
    }

    // Click en warning abre el registro existente
    var dupWarn = _getEl('cliDupWarn');
    if (dupWarn) {
      dupWarn.addEventListener('click', function () {
        var dupId = dupWarn.getAttribute('data-dup-id');
        if (!dupId) return;
        cerrarModal();
        setTimeout(function () {
          var cliente = null;
          for (var i = 0; i < _clientes.length; i++) {
            if (_clientes[i].id === dupId) { cliente = _clientes[i]; break; }
          }
          if (cliente) abrirModal(cliente, 'editar');
        }, 300);
      });
    }
  }

  // ══════════════════════════════════════
  // CLIENTE POPOVER (cotizaciones vinculadas)
  // ══════════════════════════════════════
  function _openClientePopover(clienteId, anchorEl) {
    var pop = document.getElementById('entityPopover');
    if (!pop) return;

    var cliente = null;
    for (var i = 0; i < _clientes.length; i++) {
      if (_clientes[i].id === clienteId) { cliente = _clientes[i]; break; }
    }
    if (!cliente) return;

    var empresa = cliente.empresa || '';
    var folio = clienteId;
    var cuentaActiva = String(cliente.cuentaActiva) === 'Sí';
    var estado = cuentaActiva ? 'Activo' : 'Inactivo';

    document.getElementById('entPopFolio').textContent = folio;
    document.getElementById('entPopTipoLabel').textContent = 'CLIENTE';
    document.getElementById('entPopNombre').textContent = empresa;
    var estadoEl = document.getElementById('entPopEstado');
    estadoEl.textContent = estado;
    estadoEl.className = 'estado-badge ' + (cuentaActiva ? 'estado-Cerrada' : 'estado-Perdida');

    // Cargar cotizaciones vinculadas por nombre de empresa
    var listEl = document.getElementById('entPopCotList');
    var countEl = document.getElementById('entPopCotCount');
    listEl.innerHTML = '<div class="entity-popover-empty">Cargando...</div>';
    countEl.textContent = '...';

    BNK_DB.cotizaciones.list().then(function (allCots) {
      var empresaLower = empresa.toLowerCase();
      var vinculadas = allCots.filter(function (cot) {
        var cotEmpresa = String(cot.empresa || cot.cliente || '').toLowerCase();
        return cotEmpresa === empresaLower || cotEmpresa.indexOf(empresaLower) !== -1 || empresaLower.indexOf(cotEmpresa) !== -1;
      });

      countEl.textContent = vinculadas.length;
      if (vinculadas.length === 0) {
        listEl.innerHTML = '<div class="entity-popover-empty">Sin cotizaciones vinculadas</div>';
        return;
      }

      var html = '';
      vinculadas.forEach(function (cot) {
        var cotEstado = cot.estado || 'Recorrido';
        if (cotEstado === 'Nueva') cotEstado = 'Recorrido';
        var fuente = cot.fuente || 'MNT';
        html += '<div class="entity-popover-cot" data-ent-cot="' + _escapeHTML(cot.id) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center">'
          + '<span class="entity-popover-cot-folio">' + _escapeHTML(cot.folio || '') + '</span>'
          + '<span class="tipo-badge tipo-' + fuente + '" style="font-size:10px">' + fuente + '</span>'
          + '</div>'
          + '<div class="entity-popover-cot-detail">'
          + '<div class="entity-popover-cot-row"><span>EVENTO</span><span class="val">' + _escapeHTML(cot.evento || '\u2014') + '</span></div>'
          + '<div class="entity-popover-cot-row"><span>TOTAL</span><span class="val">$' + (Number(cot.total) || 0).toLocaleString('es-MX') + '</span></div>'
          + '<div class="entity-popover-cot-row"><span>ESTADO</span><span class="val">' + _escapeHTML(cotEstado) + '</span></div>'
          + '<div class="entity-popover-cot-row"><span>DETALLE</span><span class="val">' + _escapeHTML(cot.espacios || cot.sede || 'Servicios') + '</span></div>'
          + '</div>'
          + '</div>';
      });
      listEl.innerHTML = html;
    }).catch(function () {
      countEl.textContent = '0';
      listEl.innerHTML = '<div class="entity-popover-empty">Error al cargar cotizaciones</div>';
    });

    // Position
    var rect = anchorEl.getBoundingClientRect();
    pop.style.top = (rect.bottom + 4) + 'px';
    pop.style.left = rect.left + 'px';
    pop.classList.add('visible');

    var popRect = pop.getBoundingClientRect();
    if (popRect.right > window.innerWidth - 16) {
      pop.style.left = Math.max(8, window.innerWidth - 16 - popRect.width) + 'px';
    }
    if (popRect.bottom > window.innerHeight - 16) {
      pop.style.top = (rect.top - popRect.height - 4) + 'px';
    }
  }

  // ── Inicializar con BNK_AUTH.onReady ──
  BNK_AUTH.onReady(function (user) {
    if (!user) return;
    _setupEventos();
    load();
  });

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
    parseMarcas:       _parseMarcas,
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
