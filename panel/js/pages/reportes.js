// reportes.js — Módulo de reportes y métricas
(function () {
  'use strict';

  var _data = [];

  function init() {
    BNK_DB.cotizaciones.list().then(function (docs) {
      _data = docs;
      _render();
    });

    var periodoEl = document.getElementById('repPeriodo');
    if (periodoEl) periodoEl.addEventListener('change', _render);
  }

  function _getFiltered() {
    var periodo = (document.getElementById('repPeriodo') || {}).value || 'todo';
    var now = new Date();
    var desde = null;

    if (periodo === 'mes') {
      desde = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (periodo === 'trimestre') {
      desde = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (periodo === 'anio') {
      desde = new Date(now.getFullYear(), 0, 1);
    }

    if (!desde) return _data;

    return _data.filter(function (d) {
      var fecha = d.fecha ? new Date(d.fecha) : null;
      return fecha && fecha >= desde;
    });
  }

  function _render() {
    var filtered = _getFiltered();
    _renderFunnel(filtered);
    _renderMensual(filtered);
    _renderTopClientes(filtered);
    _renderRendimiento(filtered);
  }

  function _renderFunnel(data) {
    var container = document.getElementById('repFunnel');
    if (!container) return;

    var estados = ['Recorrido', 'Cotizada', 'Negociación', 'Cerrada', 'En Producción', 'Ejecutado', 'Cancelada', 'Perdida'];
    var colores = {
      'Recorrido': 'rgba(200,236,200,.3)', 'Cotizada': 'rgba(240,192,64,.5)', 'Negociación': 'rgba(255,152,0,.5)',
      'Cerrada': 'rgba(0,255,65,.4)', 'En Producción': 'rgba(0,212,255,.4)', 'Ejecutado': 'rgba(76,175,80,.4)',
      'Cancelada': 'rgba(255,68,85,.4)', 'Perdida': 'rgba(158,158,158,.4)'
    };

    var maxCount = 0;
    var counts = {};
    var montos = {};
    estados.forEach(function (e) {
      var items = data.filter(function (d) { return (d.estado || 'Cotizada') === e; });
      counts[e] = items.length;
      montos[e] = items.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
      if (counts[e] > maxCount) maxCount = counts[e];
    });

    var html = '<div class="reporte-card-title">FUNNEL DE VENTAS</div>';
    estados.forEach(function (e) {
      var pct = maxCount > 0 ? Math.round((counts[e] / maxCount) * 100) : 0;
      html += '<div class="funnel-row">'
        + '<span class="funnel-label">' + e + '</span>'
        + '<div class="funnel-bar-wrap">'
        + '<div class="funnel-bar" style="width:' + pct + '%;background:' + colores[e] + '"></div>'
        + '<span class="funnel-count">' + counts[e] + '</span>'
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
      var mes = fecha.substring(0, 7);
      if (!mes) return;
      if (!mesesMap[mes]) mesesMap[mes] = { enviadas: 0, cerradas: 0, canceladas: 0, monto: 0 };
      mesesMap[mes].enviadas++;
      if (d.estado === 'Cerrada' || d.estado === 'En Producción' || d.estado === 'Ejecutado') {
        mesesMap[mes].cerradas++;
        mesesMap[mes].monto += parseFloat(d.total) || 0;
      }
      if (d.estado === 'Cancelada' || d.estado === 'Perdida') mesesMap[mes].canceladas++;
    });

    var meses = Object.keys(mesesMap).sort().reverse().slice(0, 12);

    var html = '<div class="reporte-card-title">ACTIVIDAD MENSUAL</div>'
      + '<table class="reporte-table"><thead><tr>'
      + '<th>MES</th><th>ENVIADAS</th><th>CERRADAS</th><th>CANC.</th><th>MONTO</th><th>TICKET</th>'
      + '</tr></thead><tbody>';

    meses.forEach(function (m) {
      var r = mesesMap[m];
      var ticket = r.cerradas > 0 ? Math.round(r.monto / r.cerradas) : 0;
      html += '<tr>'
        + '<td style="color:var(--g)">' + m + '</td>'
        + '<td>' + r.enviadas + '</td>'
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
      var cli = d.cliente || 'Sin cliente';
      if (!clientesMap[cli]) clientesMap[cli] = 0;
      clientesMap[cli] += parseFloat(d.total) || 0;
    });

    var ranking = Object.keys(clientesMap).map(function (k) {
      return { nombre: k, monto: clientesMap[k] };
    }).sort(function (a, b) { return b.monto - a.monto; }).slice(0, 10);

    var maxMonto = ranking.length > 0 ? ranking[0].monto : 1;

    var html = '<div class="reporte-card-title">TOP 10 CLIENTES</div>';
    ranking.forEach(function (c) {
      var pct = Math.round((c.monto / maxMonto) * 100);
      html += '<div class="top-bar-wrap">'
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
    var cerradas = data.filter(function (d) { return d.estado === 'Cerrada' || d.estado === 'En Producción' || d.estado === 'Ejecutado'; });
    var tasaConversion = total > 0 ? Math.round((cerradas.length / total) * 100) : 0;
    var montoTotal = cerradas.reduce(function (s, d) { return s + (parseFloat(d.total) || 0); }, 0);
    var ticketPromedio = cerradas.length > 0 ? Math.round(montoTotal / cerradas.length) : 0;

    // Cotizaciones por semana (últimas 4 semanas)
    var now = Date.now();
    var semana4 = data.filter(function (d) {
      var f = d.fecha ? new Date(d.fecha).getTime() : 0;
      return (now - f) < (28 * 24 * 60 * 60 * 1000);
    });
    var cotSemana = semana4.length > 0 ? Math.round(semana4.length / 4) : 0;

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

  window.BNKReportes = {};
})();
