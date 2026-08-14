// reportes.js — Módulo de reportes y métricas
(function () {
  'use strict';

  var _data = [];
  var _loaded = false;

  function init() {
    _bindEvents();
    load();
  }

  function load() {
    var repLoading = document.getElementById('repLoading');
    var repGrid = document.getElementById('repGrid');
    var repEmpty = document.getElementById('repEmpty');
    var periodoEl = document.getElementById('repPeriodo');

    if (repLoading) repLoading.style.display = '';
    if (repGrid) repGrid.style.display = 'none';
    if (repEmpty) repEmpty.style.display = 'none';
    if (periodoEl) periodoEl.disabled = true;

    BNK_DB.cotizaciones.list().then(function (docs) {
      _data = docs;
      _loaded = true;
      if (repLoading) repLoading.style.display = 'none';
      if (periodoEl) periodoEl.disabled = false;
      _render();
    }).catch(function (err) {
      _data = [];
      _loaded = true;
      if (repLoading) repLoading.style.display = 'none';
      if (periodoEl) periodoEl.disabled = false;
      BNKToast.error('Error al cargar reportes: ' + (err && err.message ? err.message : 'desconocido'));
      if (repEmpty) {
        repEmpty.style.display = 'block';
        var txt = repEmpty.querySelector('.dash-empty-text');
        if (txt) txt.textContent = 'ERROR AL CARGAR REPORTES';
        var icon = repEmpty.querySelector('.dash-empty-icon');
        if (icon) icon.textContent = '\u26A0';
        if (!repEmpty.querySelector('.rep-retry-btn')) {
          var retryBtn = document.createElement('button');
          retryBtn.className = 'panel-btn-primary rep-retry-btn';
          retryBtn.textContent = 'REINTENTAR';
          retryBtn.style.marginTop = '16px';
          retryBtn.addEventListener('click', function () { load(); });
          repEmpty.appendChild(retryBtn);
        }
      }
    });
  }

  function _bindEvents() {
    var periodoEl = document.getElementById('repPeriodo');
    if (periodoEl) periodoEl.addEventListener('change', function () {
      if (_loaded) _render();
    });
  }

  function _getFiltered() {
    var periodoEl = document.getElementById('repPeriodo');
    var periodo = periodoEl ? periodoEl.value : 'todo';
    var now = new Date();
    var desde = null;

    if (periodo === 'mes') {
      desde = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (periodo === 'trimestre') {
      desde = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else if (periodo === 'anio') {
      desde = new Date(now.getFullYear(), 0, 1);
    }

    if (!desde) return _data;

    return _data.filter(function (d) {
      var fecha = _parseFecha(d.fecha);
      return fecha && fecha >= desde;
    });
  }

  function _parseFecha(f) {
    if (!f) return null;
    if (typeof f === 'object' && f.toDate) return f.toDate();
    var d = new Date(f);
    return isNaN(d.getTime()) ? null : d;
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
        var icon = repEmpty.querySelector('.dash-empty-icon');
        if (icon) icon.textContent = '\uD83D\uDCCA';
      }
      _updateKPIs(filtered);
      return;
    }

    if (repGrid) repGrid.style.display = '';
    if (repEmpty) repEmpty.style.display = 'none';

    _updateKPIs(filtered);
    _renderFunnel(filtered);
    _renderMensual(filtered);
    _renderTopClientes(filtered);
    _renderRendimiento(filtered);
  }

  function _updateKPIs(data) {
    var total = data.length;
    var estadosCerrados = ['Cerrada', 'En Producción', 'Ejecutado'];
    var cerradas = data.filter(function (d) { return estadosCerrados.indexOf(d.estado) !== -1; });
    var montoTotal = cerradas.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
    var tasa = total > 0 ? Math.round((cerradas.length / total) * 100) : 0;
    var ticket = cerradas.length > 0 ? Math.round(montoTotal / cerradas.length) : 0;

    var elTotal = document.getElementById('indRepTotal');
    var elMonto = document.getElementById('indRepMonto');
    var elTasa = document.getElementById('indRepTasa');
    var elTicket = document.getElementById('indRepTicket');
    if (elTotal) elTotal.textContent = total;
    if (elMonto) elMonto.textContent = _formatMXN(montoTotal);
    if (elTasa) elTasa.textContent = tasa + '%';
    if (elTicket) elTicket.textContent = _formatMXN(ticket);
  }

  function _renderFunnel(data) {
    var container = document.getElementById('repFunnel');
    if (!container) return;

    var estados = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];

    var totalCount = data.length;
    var counts = {};
    var montos = {};
    estados.forEach(function (e) {
      var items = data.filter(function (d) { return (d.estado || 'Cotizada') === e; });
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
    var container = document.getElementById('repMensual');
    if (!container) return;

    var mesesMap = {};
    data.forEach(function (d) {
      var fecha = d.fecha || '';
      if (typeof fecha === 'object' && fecha.toDate) fecha = fecha.toDate().toISOString();
      var mes = String(fecha).substring(0, 7);
      if (!mes || mes.length < 7) return;
      if (!mesesMap[mes]) mesesMap[mes] = { registradas: 0, cerradas: 0, canceladas: 0, monto: 0 };
      mesesMap[mes].registradas++;
      if (d.estado === 'Cerrada' || d.estado === 'En Producción' || d.estado === 'Ejecutado') {
        mesesMap[mes].cerradas++;
        mesesMap[mes].monto += parseFloat(d.total) || 0;
      }
      if (d.estado === 'Cancelada' || d.estado === 'Perdida') mesesMap[mes].canceladas++;
    });

    var meses = Object.keys(mesesMap).sort().reverse().slice(0, 12);

    var html = '<div class="reporte-card-title">ACTIVIDAD MENSUAL</div>';

    if (meses.length === 0) {
      html += '<div style="text-align:center;color:var(--tx);padding:40px;font-size:12px">Sin actividad mensual</div>';
      container.innerHTML = html;
      return;
    }

    html += '<table class="reporte-table"><thead><tr>'
      + '<th>MES</th><th>REGISTRADAS</th><th>CERRADAS</th><th>CANC.</th><th>MONTO</th><th>TICKET</th>'
      + '</tr></thead><tbody>';

    meses.forEach(function (m) {
      var r = mesesMap[m];
      var ticket = r.cerradas > 0 ? Math.round(r.monto / r.cerradas) : 0;
      html += '<tr>'
        + '<td style="color:var(--g)">' + _esc(m) + '</td>'
        + '<td>' + r.registradas + '</td>'
        + '<td style="color:var(--g)">' + r.cerradas + '</td>'
        + '<td style="color:var(--red)">' + r.canceladas + '</td>'
        + '<td>' + _formatMXN(r.monto) + '</td>'
        + '<td>' + _formatMXN(ticket) + '</td>'
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
      if (d.estado === 'Cancelada' || d.estado === 'Perdida') return;
      var cli = (d.cliente || 'Sin cliente').trim().toUpperCase();
      if (!clientesMap[cli]) clientesMap[cli] = { monto: 0, nombre: d.cliente || 'Sin cliente' };
      clientesMap[cli].monto += parseFloat(d.total) || 0;
    });

    var ranking = Object.keys(clientesMap).map(function (k) {
      return { nombre: clientesMap[k].nombre, monto: clientesMap[k].monto };
    }).sort(function (a, b) { return b.monto - a.monto; }).slice(0, 10);

    var maxMonto = ranking.length > 0 ? ranking[0].monto : 1;

    var html = '<div class="reporte-card-title">TOP 10 CLIENTES</div>';

    if (ranking.length === 0) {
      html += '<div style="text-align:center;color:var(--tx);padding:40px;font-size:12px">Sin clientes en este período</div>';
      container.innerHTML = html;
      return;
    }

    ranking.forEach(function (c, i) {
      var pct = Math.round((c.monto / maxMonto) * 100);
      html += '<div class="top-bar-wrap">'
        + '<span class="top-bar-rank">' + (i + 1) + '</span>'
        + '<span class="top-bar-name">' + _esc(c.nombre) + '</span>'
        + '<div class="funnel-bar-wrap"><div class="top-bar" style="width:' + pct + '%">'
        + '<span class="top-bar-val">' + _formatMXN(c.monto) + '</span>'
        + '</div></div>'
        + '</div>';
    });
    container.innerHTML = html;
  }

  function _renderRendimiento(data) {
    var container = document.getElementById('repRendimiento');
    if (!container) return;

    var total = data.length;
    var estadosCerrados = ['Cerrada', 'En Producción', 'Ejecutado'];
    var cerradas = data.filter(function (d) { return estadosCerrados.indexOf(d.estado) !== -1; });
    var tasaConversion = total > 0 ? Math.round((cerradas.length / total) * 100) : 0;
    var montoTotal = cerradas.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
    var ticketPromedio = cerradas.length > 0 ? Math.round(montoTotal / cerradas.length) : 0;

    // Cotizaciones por semana — use full _data (unfiltered) for last 28 days
    var now = Date.now();
    var ms28d = 28 * 24 * 60 * 60 * 1000;
    var semana4 = _data.filter(function (d) {
      var f = _parseFecha(d.fecha);
      return f && (now - f.getTime()) < ms28d;
    });

    // Calculate actual weeks elapsed (min 1 to avoid division by zero)
    var oldestInRange = now;
    semana4.forEach(function (d) {
      var f = _parseFecha(d.fecha);
      if (f && f.getTime() < oldestInRange) oldestInRange = f.getTime();
    });
    var weeksElapsed = semana4.length > 0 ? Math.max(1, Math.ceil((now - oldestInRange) / (7 * 24 * 60 * 60 * 1000))) : 1;
    var cotSemana = semana4.length > 0 ? (semana4.length / weeksElapsed).toFixed(1) : '0';

    var html = '<div class="reporte-card-title">RENDIMIENTO</div>'
      + '<div class="rendimiento-grid">'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + tasaConversion + '%</div><div class="rendimiento-label">TASA CONVERSIÓN</div></div>'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + _formatMXN(ticketPromedio) + '</div><div class="rendimiento-label">TICKET PROMEDIO</div></div>'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + cotSemana + '</div><div class="rendimiento-label">COT./SEMANA</div></div>'
      + '<div class="rendimiento-item"><div class="rendimiento-value">' + total + '</div><div class="rendimiento-label">TOTAL PERÍODO</div></div>'
      + '</div>';
    container.innerHTML = html;
  }

  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  BNK_AUTH.onReady(function (user) {
    if (user && (user.rol === 'admin' || user.rol === 'ventas')) init();
  });

  window.BNKReportes = { load: load };
})();
