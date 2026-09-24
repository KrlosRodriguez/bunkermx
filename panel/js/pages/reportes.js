// reportes.js — Módulo de reportes avanzados con margen real
(function () {
  'use strict';

  var _cotizaciones = [];
  var _cotProveedores = [];
  var _pagos = [];
  var _cuentasCobrar = [];
  var _loaded = false;
  var _chartMensual = null;
  var _chartVenues = null;

  var ESTADOS_CERRADOS = ['Cerrada', 'En Producción', 'Ejecutado'];

  function init() {
    _bindEvents();
    load();
  }

  function load() {
    var repLoading = document.getElementById('repLoading');
    var repGrid = document.getElementById('repGrid');
    var repEmpty = document.getElementById('repEmpty');
    var periodoEl = document.getElementById('repPeriodo');
    var csvBtn = document.getElementById('repExportCSV');

    if (repLoading) repLoading.style.display = '';
    if (repGrid) repGrid.style.display = 'none';
    if (repEmpty) repEmpty.style.display = 'none';
    if (periodoEl) periodoEl.disabled = true;
    if (csvBtn) csvBtn.disabled = true;

    Promise.all([
      BNK_DB.cotizaciones.list(),
      BNK_DB.cotizacionProveedores.list().catch(function () { return []; }),
      BNK_DB.pagos.list().catch(function () { return []; }),
      BNK_DB.cuentasCobrar.list().catch(function () { return []; })
    ]).then(function (results) {
      _cotizaciones = results[0];
      _cotProveedores = results[1];
      _pagos = results[2];
      _cuentasCobrar = results[3];
      _loaded = true;
      if (repLoading) repLoading.style.display = 'none';
      if (periodoEl) periodoEl.disabled = false;
      if (csvBtn) csvBtn.disabled = false;
      _render();
    }).catch(function (err) {
      _loaded = true;
      if (repLoading) repLoading.style.display = 'none';
      BNKToast.error('Error al cargar reportes: ' + (err && err.message ? err.message : 'desconocido'), function () { load(); });
      if (repEmpty) {
        repEmpty.style.display = 'block';
        var txt = repEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = 'ERROR AL CARGAR REPORTES';
      }
    });
  }

  function _bindEvents() {
    var periodoEl = document.getElementById('repPeriodo');
    if (periodoEl) periodoEl.addEventListener('change', function () { if (_loaded) _render(); });
    var refreshBtn = document.getElementById('repRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { load(); });
    var csvBtn = document.getElementById('repExportCSV');
    if (csvBtn) csvBtn.addEventListener('click', _exportCSV);
  }

  function _getFiltered() {
    var periodo = (document.getElementById('repPeriodo') || {}).value || 'todo';
    var now = new Date();
    var desde = null;
    if (periodo === 'mes') desde = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (periodo === 'trimestre') desde = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    else if (periodo === 'anio') desde = new Date(now.getFullYear(), 0, 1);
    if (!desde) return _cotizaciones;
    return _cotizaciones.filter(function (d) {
      var fecha = _parseFecha(d.fecha || d.createdAt);
      return fecha && fecha >= desde;
    });
  }

  function _parseFecha(f) {
    if (!f) return null;
    if (typeof f === 'object' && f.toDate) return f.toDate();
    var d = new Date(f);
    return isNaN(d.getTime()) ? null : d;
  }

  // Calculate provider cost for a single BNK cotización
  function _calcCosto(cot) {
    if (cot.fuente !== 'BNK' || !cot.conceptos) return 0;
    try {
      var conceptos = JSON.parse(cot.conceptos);
      return conceptos.reduce(function (sum, c) {
        if (c.modo === 'proveedor' && c.costoProveedor) {
          return sum + (parseFloat(c.costoProveedor) || 0) * (parseInt(c.cantidad) || 1);
        }
        return sum;
      }, 0);
    } catch (e) { return 0; }
  }

  function _render() {
    var filtered = _getFiltered();
    var repGrid = document.getElementById('repGrid');
    var repEmpty = document.getElementById('repEmpty');
    if (filtered.length === 0) {
      if (repGrid) repGrid.style.display = 'none';
      if (repEmpty) {
        repEmpty.style.display = 'block';
        var txt = repEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = 'Sin datos para el período seleccionado';
      }
      _updateKPIs([]);
      return;
    }
    if (repGrid) repGrid.style.display = '';
    if (repEmpty) repEmpty.style.display = 'none';
    _updateKPIs(filtered);
    _renderFunnel(filtered);
    _renderMensual(filtered);
    _renderCategorias(filtered);
    _renderTopClientes(filtered);
    _renderVenues(filtered);
    _renderRendimiento(filtered);
  }

  function _updateKPIs(data) {
    var total = data.length;
    var cerradas = data.filter(function (d) { return ESTADOS_CERRADOS.indexOf(d.estado) !== -1; });
    var revenue = cerradas.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
    var costo = cerradas.reduce(function (s, d) { return s + _calcCosto(d); }, 0);
    var margen = revenue - costo;
    var margenPct = revenue > 0 ? Math.round((margen / revenue) * 100) : 0;
    var tasa = total > 0 ? Math.round((cerradas.length / total) * 100) : 0;

    var el = document.getElementById('indRepRevenue');
    if (el) el.textContent = _formatMXN(revenue);
    el = document.getElementById('indRepCosto');
    if (el) el.textContent = _formatMXN(costo);
    el = document.getElementById('indRepMargen');
    if (el) el.textContent = _formatMXN(margen);
    el = document.getElementById('indRepMargenPct');
    if (el) el.textContent = margenPct + '% margen';
    el = document.getElementById('indRepTasa');
    if (el) el.textContent = tasa + '%';
  }

  function _renderFunnel(data) {
    var container = document.getElementById('repFunnel');
    if (!container) return;
    var estados = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];
    var totalCount = data.length;
    var counts = {};
    var montos = {};
    estados.forEach(function (e) {
      var items = data.filter(function (d) {
        var est = d.estado || 'Recorrido';
        if (est === 'Nueva') est = 'Recorrido';
        return est === e;
      });
      counts[e] = items.length;
      montos[e] = items.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
    });
    var html = '<div class="reporte-card-title">FUNNEL DE VENTAS</div>';
    estados.forEach(function (e) {
      var pct = totalCount > 0 ? Math.round((counts[e] / totalCount) * 100) : 0;
      var estadoClass = 'funnel-bar--' + e.toLowerCase().replace(/\s+/g, '-');
      html += '<div class="funnel-row">'
        + '<span class="funnel-label">' + _esc(e) + '</span>'
        + '<div class="funnel-bar-wrap">'
        + '<div class="funnel-bar ' + estadoClass + '" style="width:' + pct + '%"></div>'
        + '<span class="funnel-count">' + counts[e] + ' (' + pct + '%)</span>'
        + '</div>'
        + '<span class="funnel-monto">' + _formatMXN(montos[e]) + '</span>'
        + '</div>';
    });
    container.innerHTML = html;
  }

  function _renderMensual(data) {
    var tablaEl = document.getElementById('repTablaMensual');
    if (!tablaEl) return;

    var mesesMap = {};
    data.forEach(function (d) {
      var fecha = d.fecha || d.createdAt || '';
      if (typeof fecha === 'object' && fecha.toDate) fecha = fecha.toDate().toISOString();
      var mes = String(fecha).substring(0, 7);
      if (!mes || mes.length < 7) return;
      if (!mesesMap[mes]) mesesMap[mes] = { registradas: 0, cerradas: 0, revenue: 0, costo: 0 };
      mesesMap[mes].registradas++;
      if (ESTADOS_CERRADOS.indexOf(d.estado) !== -1) {
        mesesMap[mes].cerradas++;
        mesesMap[mes].revenue += parseFloat(d.total) || 0;
        mesesMap[mes].costo += _calcCosto(d);
      }
    });

    var meses = Object.keys(mesesMap).sort().reverse().slice(0, 12);

    // Table
    var html = '<table class="reporte-table"><thead><tr>'
      + '<th>MES</th><th>COTIZADAS</th><th>CERRADAS</th><th>REVENUE</th><th>COSTO</th><th>MARGEN</th><th>%</th>'
      + '</tr></thead><tbody>';
    meses.forEach(function (m) {
      var r = mesesMap[m];
      var margen = r.revenue - r.costo;
      var pct = r.revenue > 0 ? Math.round((margen / r.revenue) * 100) : 0;
      var pctColor = pct > 30 ? 'var(--g)' : pct > 15 ? 'var(--ylw)' : 'var(--red)';
      html += '<tr>'
        + '<td style="color:var(--g)">' + _esc(m) + '</td>'
        + '<td>' + r.registradas + '</td>'
        + '<td style="color:var(--g)">' + r.cerradas + '</td>'
        + '<td>' + _formatMXN(r.revenue) + '</td>'
        + '<td style="color:var(--red)">' + _formatMXN(r.costo) + '</td>'
        + '<td>' + _formatMXN(margen) + '</td>'
        + '<td style="color:' + pctColor + '">' + pct + '%</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    tablaEl.innerHTML = html;

    // Chart.js bar chart
    if (typeof Chart === 'undefined') return;
    var chartMeses = meses.slice().reverse();
    var revenues = chartMeses.map(function (m) { return Math.round(mesesMap[m].revenue); });
    var costos = chartMeses.map(function (m) { return Math.round(mesesMap[m].costo); });

    var canvas = document.getElementById('repChartMensual');
    if (!canvas) return;
    if (_chartMensual) _chartMensual.destroy();

    var styles = getComputedStyle(document.documentElement);
    var colorG = styles.getPropertyValue('--g').trim() || '#00FF41';
    var colorRed = styles.getPropertyValue('--red').trim() || '#FF4455';
    var colorTx = styles.getPropertyValue('--tx').trim() || '#777';

    _chartMensual = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: chartMeses.map(function (m) { return m.substring(5); }),
        datasets: [
          { label: 'Revenue', data: revenues, backgroundColor: colorG + '66', borderColor: colorG, borderWidth: 1 },
          { label: 'Costo', data: costos, backgroundColor: colorRed + '66', borderColor: colorRed, borderWidth: 1 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: colorTx, font: { family: 'Space Mono', size: 10 } } } },
        scales: {
          x: { ticks: { color: colorTx, font: { family: 'Space Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,.03)' } },
          y: { ticks: { color: colorTx, font: { family: 'Space Mono', size: 9 }, callback: function (v) { return '$' + (v / 1000).toFixed(0) + 'k'; } }, grid: { color: 'rgba(255,255,255,.06)' } }
        }
      }
    });
  }

  function _renderCategorias(data) {
    var container = document.getElementById('repCategorias');
    if (!container) return;

    var cerradasBNK = data.filter(function (d) {
      return d.fuente === 'BNK' && ESTADOS_CERRADOS.indexOf(d.estado) !== -1 && d.conceptos;
    });

    var catMap = {};
    cerradasBNK.forEach(function (d) {
      try {
        var conceptos = JSON.parse(d.conceptos);
        conceptos.forEach(function (c) {
          var cat = c.categoria || 'Sin categoría';
          if (!catMap[cat]) catMap[cat] = { revenue: 0, costo: 0 };
          var qty = parseInt(c.cantidad) || 1;
          catMap[cat].revenue += (parseFloat(c.precioUnit) || 0) * qty;
          if (c.modo === 'proveedor' && c.costoProveedor) {
            catMap[cat].costo += (parseFloat(c.costoProveedor) || 0) * qty;
          }
        });
      } catch (e) {}
    });

    var cats = Object.keys(catMap).map(function (k) {
      var m = catMap[k];
      return { cat: k, revenue: m.revenue, costo: m.costo, margen: m.revenue - m.costo };
    }).sort(function (a, b) { return b.revenue - a.revenue; });

    var maxRevenue = cats.length > 0 ? cats[0].revenue : 1;

    var html = '<div class="reporte-card-title">REVENUE POR CATEGORÍA (BNK)</div>';
    if (cats.length === 0) {
      html += '<div style="text-align:center;color:var(--tx);padding:40px;font-size:12px">Sin cotizaciones BNK cerradas</div>';
      container.innerHTML = html;
      return;
    }

    html += '<table class="reporte-table"><thead><tr>'
      + '<th>CATEGORÍA</th><th>REVENUE</th><th>COSTO</th><th>MARGEN</th><th>%</th>'
      + '</tr></thead><tbody>';
    cats.forEach(function (c) {
      var pct = c.revenue > 0 ? Math.round((c.margen / c.revenue) * 100) : 0;
      var pctColor = pct > 30 ? 'var(--g)' : pct > 15 ? 'var(--ylw)' : 'var(--red)';
      var barW = Math.round((c.revenue / maxRevenue) * 100);
      html += '<tr>'
        + '<td style="color:var(--g)">' + _esc(c.cat) + '</td>'
        + '<td>' + _formatMXN(c.revenue) + ' <div class="cat-bar" style="width:' + barW + '%"></div></td>'
        + '<td style="color:var(--red)">' + _formatMXN(c.costo) + '</td>'
        + '<td>' + _formatMXN(c.margen) + '</td>'
        + '<td style="color:' + pctColor + '">' + pct + '%</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function _renderTopClientes(data) {
    var container = document.getElementById('repTopClientes');
    if (!container) return;

    var clientesMap = {};
    data.forEach(function (d) {
      if (ESTADOS_CERRADOS.indexOf(d.estado) === -1) return;
      var cli = (d.cliente || d.empresa || 'Sin cliente').trim().toUpperCase();
      if (!clientesMap[cli]) clientesMap[cli] = { monto: 0, costo: 0, nombre: d.cliente || d.empresa || 'Sin cliente' };
      clientesMap[cli].monto += parseFloat(d.total) || 0;
      clientesMap[cli].costo += _calcCosto(d);
    });

    var ranking = Object.keys(clientesMap).map(function (k) {
      return { nombre: clientesMap[k].nombre, monto: clientesMap[k].monto, costo: clientesMap[k].costo, margen: clientesMap[k].monto - clientesMap[k].costo };
    }).sort(function (a, b) { return b.monto - a.monto; }).slice(0, 10);

    var maxMonto = ranking.length > 0 ? ranking[0].monto : 1;

    var html = '<div class="reporte-card-title">TOP 10 CLIENTES (CERRADAS)</div>';
    if (ranking.length === 0) {
      html += '<div style="text-align:center;color:var(--tx);padding:40px;font-size:12px">Sin clientes cerrados</div>';
      container.innerHTML = html;
      return;
    }

    ranking.forEach(function (c, i) {
      var pct = Math.round((c.monto / maxMonto) * 100);
      var margenPct = c.monto > 0 ? Math.round((c.margen / c.monto) * 100) : 0;
      html += '<div class="top-bar-wrap">'
        + '<span class="top-bar-rank">' + (i + 1) + '</span>'
        + '<span class="top-bar-name">' + _esc(c.nombre) + '</span>'
        + '<div class="funnel-bar-wrap"><div class="top-bar" style="width:' + pct + '%">'
        + '<span class="top-bar-val">' + _formatMXN(c.monto) + '</span>'
        + '</div></div>'
        + '<span class="top-bar-margen" style="color:' + (margenPct > 30 ? 'var(--g)' : margenPct > 15 ? 'var(--ylw)' : 'var(--red)') + '">' + margenPct + '%</span>'
        + '</div>';
    });
    container.innerHTML = html;
  }

  function _renderVenues(data) {
    var tablaEl = document.getElementById('repTablaVenues');
    if (!tablaEl) return;

    var mntCerradas = data.filter(function (d) {
      return (d.fuente || 'MNT') === 'MNT' && ESTADOS_CERRADOS.indexOf(d.estado) !== -1 && d.desgloseVenues;
    });

    var espacioMap = {};
    var totalRevenue = 0;
    mntCerradas.forEach(function (d) {
      try {
        var desglose = JSON.parse(d.desgloseVenues);
        desglose.forEach(function (v) {
          var esp = v.espacio || 'Otro';
          if (!espacioMap[esp]) espacioMap[esp] = { count: 0, revenue: 0 };
          espacioMap[esp].count++;
          espacioMap[esp].revenue += parseFloat(v.subtotal || v.precio || 0);
          totalRevenue += parseFloat(v.subtotal || v.precio || 0);
        });
      } catch (e) {}
    });

    var espacios = Object.keys(espacioMap).map(function (k) {
      return { espacio: k, count: espacioMap[k].count, revenue: espacioMap[k].revenue };
    }).sort(function (a, b) { return b.revenue - a.revenue; });

    if (espacios.length === 0) {
      tablaEl.innerHTML = '<div style="text-align:center;color:var(--tx);padding:40px;font-size:12px">Sin venues en cotizaciones MNT cerradas</div>';
      return;
    }

    var html = '<table class="reporte-table"><thead><tr>'
      + '<th>ESPACIO</th><th>EVENTOS</th><th>REVENUE</th><th>%</th>'
      + '</tr></thead><tbody>';
    espacios.forEach(function (e) {
      var pct = totalRevenue > 0 ? Math.round((e.revenue / totalRevenue) * 100) : 0;
      html += '<tr>'
        + '<td style="color:var(--g)">' + _esc(e.espacio) + '</td>'
        + '<td>' + e.count + '</td>'
        + '<td>' + _formatMXN(e.revenue) + '</td>'
        + '<td>' + pct + '%</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    tablaEl.innerHTML = html;

    // Donut chart
    if (typeof Chart === 'undefined') return;
    var canvas = document.getElementById('repChartVenues');
    if (!canvas) return;
    if (_chartVenues) _chartVenues.destroy();

    var chartColors = ['#00FF41', '#F0C040', '#FF9800', '#00D4FF', '#4CAF50', '#9E9E9E'];
    _chartVenues = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: espacios.map(function (e) { return e.espacio; }),
        datasets: [{
          data: espacios.map(function (e) { return Math.round(e.revenue); }),
          backgroundColor: chartColors.slice(0, espacios.length),
          borderColor: 'rgba(5,9,5,1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--tx').trim() || '#777', font: { family: 'Space Mono', size: 9 }, padding: 8 } }
        }
      }
    });
  }

  function _renderRendimiento(data) {
    var container = document.getElementById('repRendimiento');
    if (!container) return;

    var total = data.length;
    var cerradas = data.filter(function (d) { return ESTADOS_CERRADOS.indexOf(d.estado) !== -1; });
    var tasaConversion = total > 0 ? Math.round((cerradas.length / total) * 100) : 0;
    var montoTotal = cerradas.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
    var ticketPromedio = cerradas.length > 0 ? Math.round(montoTotal / cerradas.length) : 0;

    var now = Date.now();
    var ms28d = 28 * 24 * 60 * 60 * 1000;
    var semana4 = _cotizaciones.filter(function (d) {
      var f = _parseFecha(d.fecha || d.createdAt);
      return f && (now - f.getTime()) < ms28d;
    });
    var oldestInRange = now;
    semana4.forEach(function (d) {
      var f = _parseFecha(d.fecha || d.createdAt);
      if (f && f.getTime() < oldestInRange) oldestInRange = f.getTime();
    });
    var weeksElapsed = semana4.length > 0 ? Math.max(1, Math.ceil((now - oldestInRange) / (7 * 24 * 60 * 60 * 1000))) : 1;
    var cotSemana = semana4.length > 0 ? (semana4.length / weeksElapsed).toFixed(1) : '0';

    container.innerHTML = '<div class="reporte-card-title">RENDIMIENTO</div>'
      + '<div class="rendimiento-grid">'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + tasaConversion + '%</div><div class="rendimiento-label">TASA CONVERSIÓN</div></div>'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + _formatMXN(ticketPromedio) + '</div><div class="rendimiento-label">TICKET PROMEDIO</div></div>'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + cotSemana + '</div><div class="rendimiento-label">COT./SEMANA</div></div>'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + total + '</div><div class="rendimiento-label">TOTAL PERÍODO</div></div>'
      + '</div>';
  }

  // Sanitize CSV cell to prevent formula injection (=, +, -, @, tab, CR)
  function _csvSafe(val) {
    var s = String(val == null ? '' : val);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function _exportCSV() {
    var filtered = _getFiltered();
    if (filtered.length === 0) { BNKToast.warn('Sin datos para exportar.'); return; }

    var rows = [['Folio', 'Tipo', 'Cliente', 'Evento', 'Fecha', 'Estado', 'Total', 'Costo Estimado', 'Margen'].join(',')];
    filtered.forEach(function (d) {
      var fecha = d.fecha || d.createdAt || '';
      if (typeof fecha === 'object' && fecha.toDate) fecha = fecha.toDate().toISOString().substring(0, 10);
      else fecha = String(fecha).substring(0, 10);
      var costo = _calcCosto(d);
      var total = parseFloat(d.total) || 0;
      rows.push([
        _csvSafe(d.folio || ''),
        _csvSafe(d.fuente || 'MNT'),
        _csvSafe(d.cliente || d.empresa || ''),
        _csvSafe(d.evento || ''),
        _csvSafe(fecha),
        _csvSafe(d.estado || ''),
        total.toFixed(2),
        costo.toFixed(2),
        (total - costo).toFixed(2)
      ].join(','));
    });

    var blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'reportes-bunker-' + new Date().toISOString().substring(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);

    // Audit log
    BNK_DB.actividadGlobal && BNK_DB.logActividad && BNK_DB.logActividad({
      tipo: 'export_csv', entidad: 'reportes', entidadId: '', referencia: 'CSV Export', detalle: filtered.length + ' registros exportados'
    });

    BNKToast.ok('CSV exportado con ' + filtered.length + ' registros.');
  }

  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user && (user.rol === 'admin' || user.rol === 'ventas')) init();
  });

  window.BNKReportes = { load: load };
})();
