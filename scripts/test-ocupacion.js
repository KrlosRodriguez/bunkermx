// test-ocupacion.js — Verificación de panel/js/ocupacion.js. Sin dependencias.
// Correr: node scripts/test-ocupacion.js
'use strict';
var fs = require('fs');
var path = require('path');

var src = fs.readFileSync(path.join(__dirname, '..', 'panel', 'js', 'ocupacion.js'), 'utf8');
var sandbox = {};
new Function('window', src)(sandbox);
var O = sandbox.BNKOcupacion;

var fails = 0;
function eq(label, actual, expected) {
  var a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log('  ok   ' + label); return; }
  fails++;
  console.log('  FAIL ' + label + '\n       esperado: ' + e + '\n       obtenido: ' + a);
}
function noLanza(label, fn) {
  try { fn(); console.log('  ok   ' + label); }
  catch (err) { fails++; console.log('  FAIL ' + label + ' lanzó: ' + err.message); }
}

console.log('isoAdd');
eq('resta un día', O.isoAdd('2026-10-14', -1), '2026-10-13');
eq('suma un día', O.isoAdd('2026-10-14', 1), '2026-10-15');
eq('cruza inicio de mes', O.isoAdd('2026-11-01', -1), '2026-10-31');
eq('cruza inicio de año', O.isoAdd('2027-01-01', -1), '2026-12-31');
eq('bisiesto', O.isoAdd('2028-03-01', -1), '2028-02-29');
eq('no bisiesto', O.isoAdd('2027-03-01', -1), '2027-02-28');

console.log('derive');
eq('caso base 2 montaje + 1 desmontaje',
  O.derive(['2026-10-14', '2026-10-15'], 2, 1),
  { montajeDates: ['2026-10-12', '2026-10-13'], desmontajeDates: ['2026-10-16'] });
eq('ordena la entrada desordenada',
  O.derive(['2026-10-20', '2026-10-14'], 1, 1),
  { montajeDates: ['2026-10-13'], desmontajeDates: ['2026-10-21'] });
eq('fechas con hueco: antes de la primera y después de la última',
  O.derive(['2026-10-14', '2026-10-20'], 2, 2),
  { montajeDates: ['2026-10-12', '2026-10-13'], desmontajeDates: ['2026-10-21', '2026-10-22'] });
eq('sin días de evento devuelve vacío', O.derive([], 2, 2),
  { montajeDates: [], desmontajeDates: [] });
eq('contadores en cero', O.derive(['2026-10-14'], 0, 0),
  { montajeDates: [], desmontajeDates: [] });
eq('cruza fin de año', O.derive(['2027-01-01'], 2, 0),
  { montajeDates: ['2026-12-30', '2026-12-31'], desmontajeDates: [] });
eq('bisiesto', O.derive(['2028-03-01'], 1, 0),
  { montajeDates: ['2028-02-29'], desmontajeDates: [] });
eq('undefined se trata como cero', O.derive(['2026-10-14'], undefined, undefined),
  { montajeDates: [], desmontajeDates: [] });

console.log('fechasDeVenue');
eq('usa las fechas explícitas cuando existen',
  O.fechasDeVenue({ eventDays: ['2026-10-14'], montajeDays: 1, montajeDates: ['2026-10-10'], desmontajeDays: 1, desmontajeDates: ['2026-10-20'] }),
  { evento: ['2026-10-14'], montaje: ['2026-10-10'], desmontaje: ['2026-10-20'] });
eq('deriva cuando el registro es viejo y no trae fechas',
  O.fechasDeVenue({ eventDays: ['2026-10-14'], montajeDays: 2 }),
  { evento: ['2026-10-14'], montaje: ['2026-10-12', '2026-10-13'], desmontaje: [] });
eq('entrada vacía', O.fechasDeVenue({}),
  { evento: [], montaje: [], desmontaje: [] });
noLanza('entrada null', function () { O.fechasDeVenue(null); });

console.log('indexar');
var cerrada = {
  id: 'c1', folio: 'MNT-261012-4471', estado: 'Cerrada', fuente: 'MNT',
  desgloseVenues: JSON.stringify([{ nombre: 'VELARIA', eventDays: ['2026-10-14'], montajeDays: 1, desmontajeDays: 1 }])
};
var idx = O.indexar([cerrada]);
eq('marca el día de evento', idx['VELARIA']['2026-10-14'],
  { folio: 'MNT-261012-4471', tipo: 'evento', cotizacionId: 'c1' });
eq('marca el día de montaje derivado', idx['VELARIA']['2026-10-13'],
  { folio: 'MNT-261012-4471', tipo: 'montaje', cotizacionId: 'c1' });
eq('marca el día de desmontaje derivado', idx['VELARIA']['2026-10-15'],
  { folio: 'MNT-261012-4471', tipo: 'desmontaje', cotizacionId: 'c1' });

eq('ignora una cotización que no está cerrada',
  O.indexar([{ id: 'c2', folio: 'X', estado: 'Negociación', fuente: 'MNT', desgloseVenues: cerrada.desgloseVenues }]),
  {});
eq('ignora una cotización BNK',
  O.indexar([{ id: 'c3', folio: 'X', estado: 'Cerrada', fuente: 'BNK', desgloseVenues: cerrada.desgloseVenues }]),
  {});
eq('ignora JSON inválido sin lanzar',
  O.indexar([{ id: 'c4', folio: 'X', estado: 'Cerrada', fuente: 'MNT', desgloseVenues: '{roto' }]),
  {});
eq('ignora una cotización sin desgloseVenues',
  O.indexar([{ id: 'c5', folio: 'X', estado: 'Cerrada', fuente: 'MNT', fechaEvento: '2026-10-14' }]),
  {});
noLanza('lista vacía', function () { O.indexar([]); });
noLanza('lista con null', function () { O.indexar([null]); });

var primera = { id: 'a', folio: 'MNT-A', estado: 'Cerrada', fuente: 'MNT',
  desgloseVenues: JSON.stringify([{ nombre: 'VELARIA', eventDays: ['2026-10-14'] }]) };
var segunda = { id: 'b', folio: 'MNT-B', estado: 'Ejecutado', fuente: 'MNT',
  desgloseVenues: JSON.stringify([{ nombre: 'VELARIA', eventDays: ['2026-10-14'] }]) };
eq('ante empate gana la primera de la lista',
  O.indexar([primera, segunda])['VELARIA']['2026-10-14'].folio, 'MNT-A');

console.log('esquema del cotizador público (Apps Script)');
// google-apps-script-munet.js escribe `name` y `montajeDias`, no `nombre`/`montajeDays`.
var publica = {
  id: 'p1', folio: 'MNT-261120-0001', estado: 'Cerrada', fuente: 'MNT',
  desgloseVenues: JSON.stringify([{ name: 'VELARIA', eventDays: ['2026-11-20'], montajeDias: 2, montajeTotal: 5000 }])
};
eq('lee las fechas de un venue escrito por el Apps Script',
  O.fechasDeVenue({ name: 'VELARIA', eventDays: ['2026-11-20'], montajeDias: 2 }),
  { evento: ['2026-11-20'], montaje: ['2026-11-18', '2026-11-19'], desmontaje: [] });
var idxPub = O.indexar([publica]);
eq('indexa el venue aunque venga como `name`', Object.keys(idxPub), ['VELARIA']);
eq('bloquea el día de evento del cotizador público', idxPub['VELARIA']['2026-11-20'],
  { folio: 'MNT-261120-0001', tipo: 'evento', cotizacionId: 'p1' });
eq('bloquea los días de montaje del cotizador público', idxPub['VELARIA']['2026-11-19'],
  { folio: 'MNT-261120-0001', tipo: 'montaje', cotizacionId: 'p1' });
eq('el campo `nombre` del panel sigue teniendo prioridad',
  Object.keys(O.indexar([{ id: 'x', folio: 'F', estado: 'Cerrada', fuente: 'MNT',
    desgloseVenues: JSON.stringify([{ nombre: 'LOBBY', name: 'OTRO', eventDays: ['2026-10-14'] }]) }])),
  ['LOBBY']);

noLanza('un venue null dentro del desglose no lanza', function () {
  O.indexar([{ id: 'n1', folio: 'F', estado: 'Cerrada', fuente: 'MNT', desgloseVenues: '[null]' }]);
});

console.log(fails === 0 ? '\nTodo pasó.' : '\n' + fails + ' fallas.');
process.exit(fails ? 1 : 0);
