// cotizaciones.js — Módulo de cotizaciones sobre Firestore
(function () {
  'use strict';

  var _data = [];
  var _sortKey = 'fecha';
  var _sortDir = 'desc';
  var _page = 1;
  var _perPage = 20;
  var _unsubscribe = null;
  var _firstLoad = true;
  var _canEdit = false;

  // Datos vinculados (para popover)
  var _cotPartners = [];
  var _cotProveedores = [];
  var _partners = [];
  var _proveedores = [];
  var _pagos = [];

  function init() {
    _canEdit = BNK_AUTH.canEdit('cotizaciones');
    _bindFilters();
    _bindTableEvents();
    _bindSortHeaders();
    _bindPagination();
    _bindShortcuts();
    _bindPopover();
    _bindVincModals();

    var cotLoading = document.getElementById('cotLoading');
    var cotTable = document.getElementById('cotTable2');
    if (cotLoading) cotLoading.style.display = '';
    if (cotTable) cotTable.style.display = 'none';

    _unsubscribe = BNK_DB.cotizaciones.onSnapshot(function (docs) {
      _data = docs;
      if (_firstLoad) {
        _firstLoad = false;
        var cl = document.getElementById('cotLoading');
        if (cl) cl.style.display = 'none';
      }
      _render();
    }, function (err) {
      _firstLoad = false;
      var cl = document.getElementById('cotLoading');
      if (cl) cl.style.display = 'none';
      BNKToast.error('Error al cargar cotizaciones: ' + (err && err.message ? err.message : 'desconocido'));
      var cotEmpty = document.getElementById('cotEmpty2');
      if (cotEmpty) {
        cotEmpty.style.display = 'block';
        var txt = cotEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = 'ERROR AL CARGAR COTIZACIONES';
        var icon = cotEmpty.querySelector('.dash-empty-icon');
        if (icon) icon.textContent = '\u26A0';
      }
    });

    // Cargar datos vinculados
    _loadVinculados();
  }

  function _loadVinculados() {
    function _safe(p) { return p.catch(function () { return []; }); }
    Promise.all([
      _safe(BNK_DB.cotizacionPartners.list()),
      _safe(BNK_DB.cotizacionProveedores.list()),
      _safe(BNK_DB.partners.list()),
      _safe(BNK_DB.proveedores.list()),
      _safe(BNK_DB.pagos.list())
    ]).then(function (r) {
      _cotPartners = r[0];
      _cotProveedores = r[1];
      _partners = r[2];
      _proveedores = r[3];
      _pagos = r[4];
    });
  }

  function _parseFecha(f) {
    if (!f) return '';
    if (typeof f === 'object' && f.toDate) return f.toDate().toISOString().substring(0, 10);
    return String(f).substring(0, 10);
  }

  function _formatDate(f) {
    if (!f) return '';
    var s = _parseFecha(f);
    if (s.length < 10) return s;
    return s.substring(8, 10) + '/' + s.substring(5, 7) + '/' + s.substring(0, 4);
  }

  function _getFiltered() {
    var search = (document.getElementById('cotSearch2') || {}).value || '';
    search = search.trim().toLowerCase();
    var estado = (document.getElementById('cotEstado2') || {}).value || '';
    var tipo = (document.getElementById('cotTipo2') || {}).value || '';
    var desde = (document.getElementById('cotDesde2') || {}).value || '';
    var hasta = (document.getElementById('cotHasta2') || {}).value || '';

    return _data.filter(function (d) {
      if (search) {
        var hay = [d.folio, d.cliente, d.marca, d.evento, d.espacios, d.folioMNT].join(' ').toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      var dEstado = d.estado || 'Recorrido';
      if (dEstado === 'Nueva') dEstado = 'Recorrido';
      if (estado && dEstado !== estado) return false;
      if (tipo && (d.fuente || 'MNT') !== tipo) return false;
      if (desde || hasta) {
        var fecha = _parseFecha(d.fecha || d.createdAt);
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
      }
      return true;
    });
  }

  function _render() {
    var filtered = _getFiltered();

    // Sort
    filtered.sort(function (a, b) {
      var va = a[_sortKey] || '';
      var vb = b[_sortKey] || '';
      // Normalize Timestamps for sorting
      if (_sortKey === 'fecha') { va = _parseFecha(va); vb = _parseFecha(vb); }
      if (typeof va === 'number' && typeof vb === 'number') {
        return _sortDir === 'asc' ? va - vb : vb - va;
      }
      return _sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

    _updateSortHeaders();
    _updateKPIs(filtered);
    _renderTable(filtered);
  }

  function _updateKPIs(filtered) {
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
    if (el('kpiTotal')) el('kpiTotal').textContent = filtered.length;
  }

  function _renderTable(filtered) {
    var tbody = document.getElementById('cotBody2');
    var cotTable = document.getElementById('cotTable2');
    var cotEmpty = document.getElementById('cotEmpty2');
    if (!tbody) return;

    var total = filtered.length;
    var totalPages = Math.ceil(total / _perPage) || 1;
    if (_page > totalPages) _page = totalPages;
    var start = (_page - 1) * _perPage;
    var page = filtered.slice(start, start + _perPage);

    if (total === 0) {
      if (cotTable) cotTable.style.display = 'none';
      if (cotEmpty) {
        cotEmpty.style.display = 'block';
        var txt = cotEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = _data.length === 0 ? 'Sin cotizaciones registradas' : 'Sin cotizaciones con ese filtro';
      }
      tbody.innerHTML = '';
      _updatePagination(0, 1);
      return;
    }

    if (cotTable) cotTable.style.display = 'table';
    if (cotEmpty) cotEmpty.style.display = 'none';

    var html = '';
    page.forEach(function (d) {
      var estado = d.estado || 'Recorrido';
      if (estado === 'Nueva') estado = 'Recorrido';
      var estadoClass = 'estado-' + estado.replace(/\s/g, '');
      var tipoClass = 'tipo-' + (d.fuente || 'MNT');
      var fechaFormatted = _formatDate(d.fecha || d.createdAt);

      html += '<tr data-id="' + _esc(d.id) + '">'
        + '<td class="col-folio" data-pop-id="' + _esc(d.id) + '" style="cursor:pointer">' + _esc(d.folio) + '</td>'
        + '<td>' + _esc(fechaFormatted) + '</td>'
        + '<td>' + _esc(d.cliente) + '</td>'
        + '<td style="color:var(--tx);font-size:12px">' + _esc(d.marca || '\u2014') + '</td>'
        + '<td>' + _esc(d.evento || '\u2014') + '</td>'
        + '<td><span class="tipo-badge ' + tipoClass + '">' + _esc(d.fuente || 'MNT') + '</span></td>'
        + '<td>' + _esc(d.espacios || 'Servicios') + '</td>'
        + '<td class="col-total">' + _formatMXN(d.total) + '</td>'
        + '<td>';

      if (_canEdit) {
        html += '<select class="estado-select ' + estadoClass + '" data-id="' + _esc(d.id) + '" data-prev="' + _esc(estado) + '">'
          + _estadoOptions(estado)
          + '</select>';
      } else {
        html += '<span class="estado-badge ' + estadoClass + '">' + _esc(estado) + '</span>';
      }

      html += '</td>'
        + '<td>'
        + '<button class="tbl-action tbl-action--pdf" data-cot-pdf="' + _esc(d.id) + '" title="Descargar PDF">&#128196;</button>'
        + '<button class="tbl-action tbl-action--del" data-cot-del="' + _esc(d.id) + '" title="Eliminar">&times;</button>'
        + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;

    _updatePagination(total, totalPages);
  }

  function _updatePagination(total, totalPages) {
    var paginationEl = document.getElementById('cotPagination2');
    var pageInfo = document.getElementById('cotPageInfo');
    var prevBtn = document.getElementById('cotPrevPage');
    var nextBtn = document.getElementById('cotNextPage');

    if (paginationEl) paginationEl.style.display = total > 0 ? 'flex' : 'none';
    if (pageInfo) pageInfo.textContent = 'Página ' + _page + ' de ' + totalPages + ' (' + total + ' registros)';
    if (prevBtn) prevBtn.disabled = _page <= 1;
    if (nextBtn) nextBtn.disabled = _page >= totalPages;
  }

  function _estadoOptions(current) {
    var estados = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];
    return estados.map(function (e) {
      return '<option value="' + e + '"' + (e === current ? ' selected' : '') + '>' + e + '</option>';
    }).join('');
  }

  function _updateSortHeaders() {
    var table = document.getElementById('cotTable2');
    if (!table) return;
    table.querySelectorAll('th.sortable').forEach(function (th) {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.getAttribute('data-key') === _sortKey) {
        th.classList.add(_sortDir === 'desc' ? 'sort-desc' : 'sort-asc');
      }
    });
  }

  function _bindSortHeaders() {
    var table = document.getElementById('cotTable2');
    if (!table) return;
    table.querySelectorAll('th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = this.getAttribute('data-key');
        if (_sortKey === key) {
          _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          _sortKey = key;
          _sortDir = key === 'fecha' ? 'desc' : 'asc';
        }
        _page = 1;
        _render();
      });
    });
  }

  function _bindPagination() {
    var prevBtn = document.getElementById('cotPrevPage');
    var nextBtn = document.getElementById('cotNextPage');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      if (_page > 1) { _page--; _render(); }
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      var totalPages = Math.ceil(_getFiltered().length / _perPage) || 1;
      if (_page < totalPages) { _page++; _render(); }
    });
  }

  function _bindShortcuts() {
    // Navigate to cotizador tabs
    var btnMNT = document.getElementById('cotBtnNuevaMNT');
    var btnBNK = document.getElementById('cotBtnNuevaBNK');
    if (btnMNT) btnMNT.addEventListener('click', function () {
      var tab = document.querySelector('[data-tab="cotizar-mnt"]');
      if (tab) tab.click();
    });
    if (btnBNK) btnBNK.addEventListener('click', function () {
      var tab = document.querySelector('[data-tab="cotizar-bnk"]');
      if (tab) tab.click();
    });
  }

  function _bindFilters() {
    var searchEl = document.getElementById('cotSearch2');
    if (searchEl) searchEl.addEventListener('input', function () { _page = 1; _render(); });

    var estadoEl = document.getElementById('cotEstado2');
    if (estadoEl) estadoEl.addEventListener('change', function () { _page = 1; _render(); });

    var tipoEl = document.getElementById('cotTipo2');
    if (tipoEl) tipoEl.addEventListener('change', function () { _page = 1; _render(); });

    var desdeEl = document.getElementById('cotDesde2');
    if (desdeEl) desdeEl.addEventListener('change', function () { _page = 1; _render(); });

    var hastaEl = document.getElementById('cotHasta2');
    if (hastaEl) hastaEl.addEventListener('change', function () { _page = 1; _render(); });

    // Clear filters button
    var limpiarBtn = document.getElementById('cotLimpiarFiltros');
    if (limpiarBtn) limpiarBtn.addEventListener('click', function () {
      if (searchEl) searchEl.value = '';
      if (estadoEl) estadoEl.value = '';
      if (tipoEl) tipoEl.value = '';
      if (desdeEl) desdeEl.value = '';
      if (hastaEl) hastaEl.value = '';
      _page = 1;
      _render();
    });
  }

  function _bindTableEvents() {
    var tbody = document.getElementById('cotBody2');
    if (!tbody) return;

    // Estado change
    tbody.addEventListener('change', function (e) {
      var select = e.target.closest('.estado-select');
      if (!select) return;
      if (!_canEdit) return;
      var id = select.getAttribute('data-id');
      var newEstado = select.value;
      var prevEstado = select.getAttribute('data-prev') || '';
      var user = BNK_AUTH.currentUser();

      function doUpdate() {
        select.setAttribute('data-prev', newEstado);
        BNK_DB.cotizaciones.update(id, { estado: newEstado }).then(function () {
          BNKToast.ok('Estado actualizado a ' + newEstado);
          BNK_DB.actividad.add(id, {
            tipo: 'cambio_estado',
            estado: newEstado,
            usuario: user ? user.nombre : 'Sistema',
            nota: ''
          }).catch(function () {});
        }).catch(function (err) {
          select.value = prevEstado;
          BNKToast.error('Error al actualizar estado: ' + (err && err.message ? err.message : 'desconocido'));
        });
      }

      // Confirm destructive states
      if (newEstado === 'Cancelada' || newEstado === 'Perdida') {
        BNKConfirm.show('¿Cambiar estado a "' + newEstado + '"? Esta acción es significativa.', 'CONFIRMAR').then(function (ok) {
          if (ok) { doUpdate(); } else { select.value = prevEstado; }
        });
      } else {
        doUpdate();
      }
    });

    // Download PDF & Delete
    tbody.addEventListener('click', function (e) {
      // Popover on folio click
      var folioTd = e.target.closest('[data-pop-id]');
      if (folioTd) {
        e.stopPropagation();
        _openPopover(folioTd.getAttribute('data-pop-id'), folioTd);
        return;
      }

      var pdfBtn = e.target.closest('[data-cot-pdf]');
      if (pdfBtn) {
        var id = pdfBtn.getAttribute('data-cot-pdf');
        var cot = _data.find(function (d) { return d.id === id; });
        if (cot && window.BNKPdfRebuild) {
          BNKPdfRebuild.download(cot);
          BNKToast.ok('PDF generado: ' + (cot.folio || id));
        } else {
          BNKToast.error('No se pudo generar el PDF.');
        }
        return;
      }

      // Delete
      var delBtn = e.target.closest('[data-cot-del]');
      if (!delBtn) return;
      var id2 = delBtn.getAttribute('data-cot-del');
      _deleteCotizacion(id2);
    });
  }

  // ══════════════════════════════════════════
  // POPOVER
  // ══════════════════════════════════════════
  var _popoverCotId = null;

  function _bindPopover() {
    // Close popover on click outside
    document.addEventListener('click', function (e) {
      var pop = document.getElementById('cotPopover');
      if (!pop || !pop.classList.contains('visible')) return;
      if (pop.contains(e.target)) return;
      if (e.target.closest('[data-pop-id]')) return;
      _closePopover();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') _closePopover();
    });

    document.getElementById('popClose').addEventListener('click', _closePopover);

    // Crear BNK action
    document.getElementById('popCrearBnk').addEventListener('click', function () {
      var cot = _data.find(function (d) { return d.id === _popoverCotId; });
      if (!cot) return;
      _closePopover();
      _navegarCrearBnk(cot);
    });

    // PDF action
    document.getElementById('popPdf').addEventListener('click', function () {
      var cot = _data.find(function (d) { return d.id === _popoverCotId; });
      if (cot && window.BNKPdfRebuild) {
        BNKPdfRebuild.download(cot);
        BNKToast.ok('PDF generado: ' + (cot.folio || _popoverCotId));
      }
      _closePopover();
    });

    // Vincular partner
    document.getElementById('popVincPartner').addEventListener('click', function () {
      var cotId = _popoverCotId;
      var cot = _data.find(function (d) { return d.id === cotId; });
      _closePopover();
      if (cot) _openVincModal('partner', cot);
    });

    // Vincular proveedor
    document.getElementById('popVincProveedor').addEventListener('click', function () {
      var cotId = _popoverCotId;
      var cot = _data.find(function (d) { return d.id === cotId; });
      _closePopover();
      if (cot) _openVincModal('proveedor', cot);
    });
  }

  function _openPopover(cotId, anchorEl) {
    var cot = _data.find(function (d) { return d.id === cotId; });
    if (!cot) return;

    _popoverCotId = cotId;
    var pop = document.getElementById('cotPopover');

    // Fill info
    var estado = cot.estado || 'Recorrido';
    if (estado === 'Nueva') estado = 'Recorrido';
    var fuente = cot.fuente || 'MNT';

    document.getElementById('popFolio').textContent = cot.folio || cotId;
    var tipoBadge = document.getElementById('popTipo');
    tipoBadge.textContent = fuente;
    tipoBadge.className = 'tipo-badge tipo-' + fuente;
    document.getElementById('popCliente').textContent = cot.cliente || '\u2014';
    document.getElementById('popEvento').textContent = cot.evento || '\u2014';
    document.getElementById('popTotal').textContent = _formatMXN(cot.total);
    var estadoEl = document.getElementById('popEstado');
    estadoEl.textContent = estado;
    estadoEl.className = 'estado-badge estado-' + estado.replace(/\s/g, '');

    // BNK vinculadas (solo para MNT)
    var bnkSection = document.getElementById('popBnkSection');
    var crearBnkBtn = document.getElementById('popCrearBnk');
    if (fuente === 'MNT') {
      bnkSection.style.display = '';
      crearBnkBtn.style.display = '';
      var bnkList = _data.filter(function (d) { return d.folioMNT === cot.folio && d.fuente === 'BNK'; });
      var listEl = document.getElementById('popBnkList');
      if (bnkList.length === 0) {
        listEl.innerHTML = '<div class="cot-popover-bnk-empty">Sin cotizaciones BNK vinculadas</div>';
      } else {
        listEl.innerHTML = bnkList.map(function (b) {
          return '<div class="cot-popover-bnk-item" data-scroll-folio="' + _esc(b.folio) + '">'
            + '<span class="bnk-folio">' + _esc(b.folio) + '</span>'
            + '<span class="bnk-total">' + _formatMXN(b.total) + '</span>'
            + '</div>';
        }).join('');
      }
    } else {
      bnkSection.style.display = 'none';
      crearBnkBtn.style.display = 'none';
    }

    // Partners count
    var partnersCount = _cotPartners.filter(function (cp) { return cp.cotizacionId === cotId; }).length;
    document.getElementById('popPartnersCount').textContent = partnersCount;
    var chipP = document.getElementById('popChipPartners');
    chipP.classList.toggle('has-items', partnersCount > 0);

    // Proveedores count (from cotizacionProveedores + pagos tipo proveedor)
    var provFromJoin = _cotProveedores.filter(function (cp) { return cp.cotizacionId === cotId; });
    var provFromPagos = _pagos.filter(function (p) { return p.cotizacionId === cotId && p.tipo === 'proveedor'; });
    var provIds = {};
    provFromJoin.forEach(function (p) { provIds[p.proveedorId] = true; });
    provFromPagos.forEach(function (p) { provIds[p.destinatarioId] = true; });
    var provCount = Object.keys(provIds).length;
    document.getElementById('popProveedoresCount').textContent = provCount;
    var chipPr = document.getElementById('popChipProveedores');
    chipPr.classList.toggle('has-items', provCount > 0);

    // Position popover (fixed)
    var rect = anchorEl.getBoundingClientRect();
    pop.style.top = (rect.bottom + 4) + 'px';
    pop.style.left = rect.left + 'px';

    pop.classList.add('visible');

    // Clamp to viewport edges
    var popRect = pop.getBoundingClientRect();
    if (popRect.right > window.innerWidth - 16) {
      pop.style.left = Math.max(8, window.innerWidth - 16 - popRect.width) + 'px';
    }
    if (popRect.bottom > window.innerHeight - 16) {
      pop.style.top = (rect.top - popRect.height - 4) + 'px';
    }
  }

  function _closePopover() {
    var pop = document.getElementById('cotPopover');
    if (pop) pop.classList.remove('visible');
    _popoverCotId = null;
  }

  function _navegarCrearBnk(cotMNT) {
    // Pre-fill BNK form fields
    var fields = {
      bnkFolioMNT: cotMNT.folio,
      bnkEmpresa: cotMNT.cliente || '',
      bnkContacto: cotMNT.contacto || '',
      bnkTelefono: cotMNT.telefono || '',
      bnkCorreo: cotMNT.correo || '',
      bnkEvento: cotMNT.evento || '',
      bnkFechaEvento: cotMNT.fechaEvento || ''
    };
    Object.keys(fields).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = fields[id];
    });

    // Navigate to BNK tab
    var tab = document.querySelector('[data-tab="cotizar-bnk"]');
    if (tab) tab.click();
    BNKToast.ok('Datos copiados de ' + cotMNT.folio);
  }

  // ══════════════════════════════════════════
  // BNK LIST — scroll to folio
  // ══════════════════════════════════════════
  document.addEventListener('click', function (e) {
    var item = e.target.closest('[data-scroll-folio]');
    if (!item) return;
    var folio = item.getAttribute('data-scroll-folio');
    _closePopover();

    // Find the row with that folio and scroll to it
    var rows = document.querySelectorAll('#cotBody2 tr');
    for (var i = 0; i < rows.length; i++) {
      var td = rows[i].querySelector('.col-folio');
      if (td && td.textContent.trim() === folio) {
        rows[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        rows[i].style.outline = '2px solid var(--ylw)';
        setTimeout(function () { rows[i].style.outline = ''; }, 2000);
        return;
      }
    }

    // If not on current page, search in filtered data and switch page
    var filtered = _getFiltered();
    for (var j = 0; j < filtered.length; j++) {
      if (filtered[j].folio === folio) {
        _page = Math.floor(j / _perPage) + 1;
        _render();
        setTimeout(function () {
          var rows2 = document.querySelectorAll('#cotBody2 tr');
          for (var k = 0; k < rows2.length; k++) {
            var td2 = rows2[k].querySelector('.col-folio');
            if (td2 && td2.textContent.trim() === folio) {
              rows2[k].scrollIntoView({ behavior: 'smooth', block: 'center' });
              rows2[k].style.outline = '2px solid var(--ylw)';
              setTimeout(function () { rows2[k].style.outline = ''; }, 2000);
              return;
            }
          }
        }, 100);
        return;
      }
    }
  });

  // ══════════════════════════════════════════
  // MODALES DE VINCULACIÓN
  // ══════════════════════════════════════════
  var _vincType = ''; // 'partner' or 'proveedor'
  var _vincCot = null;

  function _bindVincModals() {
    // Partner modal
    document.getElementById('vincPartnerClose').addEventListener('click', function () {
      _modal('vincPartnerOverlay', false);
    });
    document.getElementById('vincPartnerOverlay').addEventListener('click', function (e) {
      if (e.target === this) _modal('vincPartnerOverlay', false);
    });

    // Proveedor modal
    document.getElementById('vincProveedorClose').addEventListener('click', function () {
      _modal('vincProveedorOverlay', false);
    });
    document.getElementById('vincProveedorOverlay').addEventListener('click', function (e) {
      if (e.target === this) _modal('vincProveedorOverlay', false);
    });

    // Autocomplete partner
    var pSearch = document.getElementById('vincPartnerSearch');
    pSearch.addEventListener('input', function () {
      _renderVincAC('partner', this.value.trim());
    });

    // Autocomplete proveedor
    var prSearch = document.getElementById('vincProveedorSearch');
    prSearch.addEventListener('input', function () {
      _renderVincAC('proveedor', this.value.trim());
    });

    // Click on AC items
    document.getElementById('vincPartnerAC').addEventListener('click', function (e) {
      var item = e.target.closest('.bnk-ac-item');
      if (!item) return;
      _vincularItem('partner', item.getAttribute('data-id'), item.getAttribute('data-name'));
    });
    document.getElementById('vincProveedorAC').addEventListener('click', function (e) {
      var item = e.target.closest('.bnk-ac-item');
      if (!item) return;
      _vincularItem('proveedor', item.getAttribute('data-id'), item.getAttribute('data-name'));
    });

    // Remove linked items (delegated)
    document.getElementById('vincPartnerList').addEventListener('click', function (e) {
      var btn = e.target.closest('.vinc-item-del');
      if (btn) _desvincular('partner', btn.getAttribute('data-vinc-id'));
    });
    document.getElementById('vincProveedorList').addEventListener('click', function (e) {
      var btn = e.target.closest('.vinc-item-del');
      if (btn) _desvincular('proveedor', btn.getAttribute('data-vinc-id'));
    });
  }

  function _openVincModal(tipo, cot) {
    _vincType = tipo;
    _vincCot = cot;

    if (tipo === 'partner') {
      document.getElementById('vincPartnerFolio').textContent = cot.folio || '';
      document.getElementById('vincPartnerSearch').value = '';
      document.getElementById('vincPartnerAC').innerHTML = '';
      _renderVincList('partner');
      _modal('vincPartnerOverlay', true);
    } else {
      document.getElementById('vincProveedorFolio').textContent = cot.folio || '';
      document.getElementById('vincProveedorSearch').value = '';
      document.getElementById('vincProveedorAC').innerHTML = '';
      _renderVincList('proveedor');
      _modal('vincProveedorOverlay', true);
    }
  }

  function _renderVincAC(tipo, query) {
    var acEl = document.getElementById(tipo === 'partner' ? 'vincPartnerAC' : 'vincProveedorAC');
    if (!query || query.length < 2) { acEl.innerHTML = ''; acEl.classList.remove('visible'); return; }

    var list = tipo === 'partner' ? _partners : _proveedores;
    var linked = tipo === 'partner'
      ? _cotPartners.filter(function (cp) { return cp.cotizacionId === _vincCot.id; }).map(function (cp) { return cp.partnerId; })
      : _cotProveedores.filter(function (cp) { return cp.cotizacionId === _vincCot.id; }).map(function (cp) { return cp.proveedorId; });

    var q = query.toLowerCase();
    var matches = list.filter(function (item) {
      var name = (item.nombre || item.razonSocial || '').toLowerCase();
      return name.indexOf(q) !== -1 && linked.indexOf(item.id) === -1;
    }).slice(0, 8);

    if (matches.length === 0) {
      acEl.innerHTML = '<div class="bnk-ac-item" style="color:var(--tx);font-style:italic">Sin resultados</div>';
      acEl.classList.add('visible');
      return;
    }

    acEl.innerHTML = matches.map(function (item) {
      var name = item.nombre || item.razonSocial || '';
      return '<div class="bnk-ac-item" data-id="' + _esc(item.id) + '" data-name="' + _esc(name) + '">' + _esc(name) + '</div>';
    }).join('');
    acEl.classList.add('visible');
  }

  function _vincularItem(tipo, itemId, itemName) {
    if (!_vincCot || !itemId) return;

    var data = {
      cotizacionId: _vincCot.id,
      cotizacionFolio: _vincCot.folio || ''
    };

    var collection;
    if (tipo === 'partner') {
      data.partnerId = itemId;
      data.partnerNombre = itemName;
      data.cerrada = false;
      collection = BNK_DB.cotizacionPartners;
    } else {
      data.proveedorId = itemId;
      data.proveedorNombre = itemName;
      collection = BNK_DB.cotizacionProveedores;
    }

    collection.create(data).then(function (created) {
      BNKToast.ok((tipo === 'partner' ? 'Partner' : 'Proveedor') + ' vinculado: ' + itemName);
      // Update local cache
      if (tipo === 'partner') {
        _cotPartners.push(created);
      } else {
        _cotProveedores.push(created);
      }
      _renderVincList(tipo);
      // Clear AC
      var searchEl = document.getElementById(tipo === 'partner' ? 'vincPartnerSearch' : 'vincProveedorSearch');
      if (searchEl) searchEl.value = '';
      var acEl = document.getElementById(tipo === 'partner' ? 'vincPartnerAC' : 'vincProveedorAC');
      if (acEl) { acEl.innerHTML = ''; acEl.classList.remove('visible'); }
    }).catch(function (err) {
      BNKToast.error('Error al vincular: ' + (err && err.message ? err.message : 'desconocido'));
    });
  }

  function _desvincular(tipo, vincId) {
    if (!vincId) return;
    var collection = tipo === 'partner' ? BNK_DB.cotizacionPartners : BNK_DB.cotizacionProveedores;
    var cache = tipo === 'partner' ? _cotPartners : _cotProveedores;

    var record = cache.find(function (r) { return r.id === vincId; });
    var nombre = record ? (record.partnerNombre || record.proveedorNombre || '') : '';

    BNKConfirm.show('¿Desvincular "' + nombre + '" de esta cotización?', 'DESVINCULAR').then(function (ok) {
      if (!ok) return;
      collection.delete(vincId).then(function () {
        BNKToast.ok((tipo === 'partner' ? 'Partner' : 'Proveedor') + ' desvinculado.');
        // Update local cache
        if (tipo === 'partner') {
          _cotPartners = _cotPartners.filter(function (r) { return r.id !== vincId; });
        } else {
          _cotProveedores = _cotProveedores.filter(function (r) { return r.id !== vincId; });
        }
        _renderVincList(tipo);
      }).catch(function (err) {
        BNKToast.error('Error al desvincular: ' + (err && err.message ? err.message : 'desconocido'));
      });
    });
  }

  function _renderVincList(tipo) {
    var listEl = document.getElementById(tipo === 'partner' ? 'vincPartnerList' : 'vincProveedorList');
    if (!listEl || !_vincCot) return;

    var items;
    if (tipo === 'partner') {
      items = _cotPartners.filter(function (cp) { return cp.cotizacionId === _vincCot.id; });
    } else {
      items = _cotProveedores.filter(function (cp) { return cp.cotizacionId === _vincCot.id; });
    }

    if (items.length === 0) {
      listEl.innerHTML = '<div class="vinc-empty">Sin ' + (tipo === 'partner' ? 'partners' : 'proveedores') + ' vinculados</div>';
      return;
    }

    listEl.innerHTML = items.map(function (item) {
      var name = item.partnerNombre || item.proveedorNombre || '';
      return '<div class="vinc-item">'
        + '<span class="vinc-item-name">' + _esc(name) + '</span>'
        + '<button class="vinc-item-del" data-vinc-id="' + _esc(item.id) + '">&times;</button>'
        + '</div>';
    }).join('');
  }

  function _modal(id, show) {
    var el = document.getElementById(id);
    if (el) { if (show) el.classList.add('visible'); else el.classList.remove('visible'); }
  }

  function _deleteCotizacion(id) {
    var cot = _data.find(function (d) { return d.id === id; });
    var folio = cot ? cot.folio : id;

    // Verificar datos vinculados antes de permitir eliminar
    Promise.all([
      BNK_DB.pagos.list(),
      BNK_DB.cotizacionPartners.list(),
      BNK_DB.eventos.list(),
      BNK_DB.actividad.list(id)
    ]).then(function (results) {
      var pagos = results[0].filter(function (p) { return p.cotizacionId === id; });
      var partners = results[1].filter(function (cp) { return cp.cotizacionId === id; });
      var eventos = results[2].filter(function (ev) { return ev.cotizacionId === id; });
      var actividad = results[3];

      var bloqueos = [];
      if (pagos.length > 0) bloqueos.push(pagos.length + ' pago(s) registrado(s)');
      if (partners.length > 0) bloqueos.push(partners.length + ' partner(s) asignado(s)');
      if (eventos.length > 0) bloqueos.push(eventos.length + ' evento(s) vinculado(s)');

      if (bloqueos.length > 0) {
        BNKToast.error('No se puede eliminar "' + folio + '": tiene ' + bloqueos.join(', ') + '.');
        return;
      }

      var msg = '¿Eliminar cotización "' + folio + '"?';
      if (actividad.length > 0) msg += ' Se eliminarán también ' + actividad.length + ' registro(s) de actividad.';
      msg += ' Esta acción no se puede deshacer.';

      BNKConfirm.show(msg, 'ELIMINAR').then(function (ok) {
        if (!ok) return;

        // Eliminar actividad primero, luego la cotización
        var delActividad = actividad.map(function (a) {
          return BNK_FIREBASE.db.collection('cotizaciones').doc(id).collection('actividad').doc(a.id).delete();
        });

        Promise.all(delActividad).then(function () {
          return BNK_DB.cotizaciones.delete(id);
        }).then(function () {
          BNKToast.ok('Cotización "' + folio + '" eliminada.');
        }).catch(function (err) {
          BNKToast.error('Error al eliminar: ' + (err && err.message ? err.message : 'desconocido'));
        });
      });
    }).catch(function () {
      BNKToast.error('Error al verificar datos vinculados.');
    });
  }

  function _formatMXN(n) {
    return '$' + (Number(n) || 0).toLocaleString('es-MX');
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

  window.BNKCotizaciones = {
    load: function () {
      // onSnapshot handles live updates — manual refresh not needed
      // but re-render if called externally
      if (_data.length > 0) _render();
    }
  };
})();
