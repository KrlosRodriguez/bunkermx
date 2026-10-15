// ocupacion.js — Fechas de ocupación de venues (montaje, evento, desmontaje).
// Compartido por cotizar-mnt.js y calendario.js. Sin DOM ni Firebase: se verifica
// con `node scripts/test-ocupacion.js`.
(function (root) {
  'use strict';

  var ESTADOS_BLOQUEAN = ['Cerrada', 'En Producción', 'Ejecutado'];

  function _pad(n) { return (n < 10 ? '0' : '') + n; }

  // '2026-10-14' + delta días -> '2026-10-13'. Aritmética en hora local con
  // componentes separados: nunca Date.parse sobre la cadena ISO, que la
  // interpretaría como UTC y correría el día.
  function isoAdd(iso, delta) {
    var p = String(iso).split('-');
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    d.setDate(d.getDate() + delta);
    return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());
  }

  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());
  }

  // Días naturales contiguos: N antes del primer día de evento, M después del último.
  function derive(eventDays, montajeDays, desmontajeDays) {
    var vacio = { montajeDates: [], desmontajeDates: [] };
    if (!eventDays || !eventDays.length) return vacio;

    var ordenados = eventDays.slice().sort();
    var primero = ordenados[0];
    var ultimo = ordenados[ordenados.length - 1];
    var n = Math.max(0, parseInt(montajeDays, 10) || 0);
    var m = Math.max(0, parseInt(desmontajeDays, 10) || 0);

    var montajeDates = [];
    for (var i = n; i >= 1; i--) { montajeDates.push(isoAdd(primero, -i)); }

    var desmontajeDates = [];
    for (var j = 1; j <= m; j++) { desmontajeDates.push(isoAdd(ultimo, j)); }

    return { montajeDates: montajeDates, desmontajeDates: desmontajeDates };
  }

  // Un elemento de desgloseVenues -> sus tres listas de fechas. Los registros
  // anteriores a oct-2026 traen montajeDays sin fechas: se derivan al vuelo. El
  // cotizador público (Apps Script) escribe `montajeDias`, con otro nombre.
  function fechasDeVenue(entry) {
    if (!entry) return { evento: [], montaje: [], desmontaje: [] };
    var evento = entry.eventDays || [];
    var montaje = entry.montajeDates;
    var desmontaje = entry.desmontajeDates;
    if (!montaje || !desmontaje) {
      var nMontaje = entry.montajeDays != null ? entry.montajeDays : entry.montajeDias;
      var d = derive(evento, nMontaje, entry.desmontajeDays);
      if (!montaje) montaje = d.montajeDates;
      if (!desmontaje) desmontaje = d.desmontajeDates;
    }
    return { evento: evento, montaje: montaje, desmontaje: desmontaje };
  }

  // Lista de cotizaciones -> { nombreVenue: { iso: { folio, tipo, cotizacionId } } }.
  // Solo MNT en estado cerrado. Ante empate en el mismo venue y fecha gana la
  // primera de la lista. Un documento ilegible se ignora en silencio.
  function indexar(cotizaciones) {
    var idx = {};
    (cotizaciones || []).forEach(function (c) {
      if (!c || (c.fuente || 'MNT') !== 'MNT') return;
      if (ESTADOS_BLOQUEAN.indexOf(c.estado) === -1) return;
      if (!c.desgloseVenues) return;

      var desglose;
      try {
        desglose = JSON.parse(c.desgloseVenues);
      } catch (e) { return; }
      if (!desglose || !desglose.length) return;

      desglose.forEach(function (entry) {
        if (!entry) return;
        // El panel escribe `nombre`; el cotizador público (Apps Script) escribe `name`.
        var venueNombre = entry.nombre || entry.name;
        if (!venueNombre) return;
        var f = fechasDeVenue(entry);
        if (!idx[venueNombre]) idx[venueNombre] = {};
        var destino = idx[venueNombre];
        ['evento', 'montaje', 'desmontaje'].forEach(function (tipo) {
          f[tipo].forEach(function (iso) {
            if (destino[iso]) return; // primera gana
            destino[iso] = { folio: c.folio || '', tipo: tipo, cotizacionId: c.id || '' };
          });
        });
      });
    });
    return idx;
  }

  root.BNKOcupacion = {
    ESTADOS_BLOQUEAN: ESTADOS_BLOQUEAN,
    isoAdd: isoAdd,
    hoy: hoy,
    derive: derive,
    fechasDeVenue: fechasDeVenue,
    indexar: indexar
  };
})(typeof window !== 'undefined' ? window : this);
