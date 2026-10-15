# Días de montaje y desmontaje en cotizaciones MNT — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir reservar días de montaje y desmontaje por venue al cotizar MNT, derivados como días naturales contiguos al evento, bloqueados contra cotizaciones cerradas y diferenciados por color en el wizard y en el tab CALENDARIO.

**Architecture:** La lógica de fechas (derivación, lectura de `desgloseVenues` con respaldo para registros viejos, e índice de ocupación) se extrae a un archivo compartido nuevo, `panel/js/ocupacion.js`, que expone el global `BNKOcupacion` y lo consumen tanto `cotizar-mnt.js` como `calendario.js`. Es el mismo patrón de `panel/js/table-helpers.js` y evita el gotcha documentado en CLAUDE.md de tener dos copias divergentes del mismo helper. Al no tocar ninguna API del navegador, ese archivo se verifica con un script de Node sin dependencias (`scripts/test-ocupacion.js`), igual que `scripts/check_site.py` verifica el sitio público. El resto —render, cálculo, PDF y calendario— se verifica a mano en el navegador con pasos concretos.

**Tech Stack:** HTML/CSS/JS vanilla ES5 + Promise, Firebase SDK compat 10.12.0, jsPDF 2.5.1, Node (solo para el script de verificación). Sin bundler, sin transpiler.

**Spec:** `docs/superpowers/specs/2026-10-14-mnt-montaje-desmontaje-design.md`

## Global Constraints

- **ES5 + Promise** en todo el JS: `var`, `function`, sin arrow functions, sin `async/await`, sin template literals. `Object.assign` sí está permitido (ya se usa en `calendario.js:353`).
- **Cada `js/pages/*.js` es un IIFE auto-contenido**; los helpers compartidos exponen un global (`BNKOcupacion`, como `BNKSort`).
- **CSS**: nunca `!important`. Solo design tokens de `panel/css/panel.css`, nunca valores hardcodeados en las reglas nuevas.
- **Todo el texto visible al usuario, en español.**
- **Cache busting obligatorio**: al modificar un JS o CSS hay que subir su `?v=N` en `panel/dashboard.html`, o el CDN de Firebase Hosting sirve la copia vieja.
- **XSS**: todo dato que venga de Firestore pasa por `_esc()` antes de concatenarse a `innerHTML`.
- **Estados que bloquean fechas**, exactamente estas tres cadenas con acento: `'Cerrada'`, `'En Producción'`, `'Ejecutado'`.
- **Colores**: montaje `#8B5CF6`, desmontaje `#FF8C42`. Evento se queda en `--g` `#00FF41`.
- **No tocar**: `/cotizador-munet/`, `cotizador-munet/google-apps-script-munet.js`, `panel/js/pages/cotizar-bnk.js`, `panel/js/pages/reportes.js`, `firestore.rules`, `storage.rules`.
- **`diasTotal` y `fechaEvento` siguen refiriéndose solo a días de evento.** Montaje y desmontaje suman al dinero, no a los días ni a la fecha comercial.

## Review Focus

Casos que la spec implica pero que es fácil que se rompan en silencio. Cada uno tiene su verificación en la tarea que lo posee:

1. **`desgloseVenues` con JSON inválido** en una cotización cerrada: el índice de ocupación y el calendario deben ignorar ese documento, no tumbar el tab completo. → Tarea 1 (`indexar`) y Tarea 8.
2. **Cotización cerrada sin `desgloseVenues`** (las que llegan del cotizador público vía Apps Script): solo tiene `fechaEvento`; no debe generar fechas de montaje ni lanzar excepción. → Tarea 1 (`indexar`).
3. **Montaje que cruza fin de mes o fin de año**: evento el 1 de enero de 2027 con 2 días de montaje debe dar 30 y 31 de diciembre de 2026, no `2027-01--1`. → Tarea 1 (`derive`).
4. **Año bisiesto**: evento el 1 de marzo de 2028 con 1 día de montaje debe dar el 29 de febrero. → Tarea 1 (`derive`).
5. **Dato corrupto con `eventDays` vacío y `montajeDays > 0`**: `derive` devuelve listas vacías en vez de inventar fechas o lanzar. → Tarea 1 (`derive`).

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `panel/js/ocupacion.js` | **Nuevo.** Aritmética de fechas ISO, derivación de montaje/desmontaje, lectura de un venue de `desgloseVenues` con respaldo legacy, índice de ocupación por venue. Sin DOM, sin Firebase. | 1 |
| `scripts/test-ocupacion.js` | **Nuevo.** Verificación en Node de `ocupacion.js`, sin dependencias. | 1 |
| `panel/css/panel.css` | Tokens `--montaje` / `--desmontaje`, celdas `.montaje` / `.desmontaje` / `.ocupado` del wizard, bloque de dos steppers, leyenda. | 2 |
| `panel/js/pages/cotizar-mnt.js` | Carga del índice de ocupación, render del calendario, segundo stepper y validaciones, cálculo, resumen, PDF, payload. | 3–7 |
| `panel/js/pdf-rebuild.js` | Renglones de desmontaje en PDFs regenerados. | 7 |
| `panel/js/pages/calendario.js` | Bloques `montaje` / `desmontaje`, tooltip, iCal. | 8 |
| `panel/css/calendario.css` | Clases de bloque y de leyenda en las tres vistas. | 8 |
| `panel/dashboard.html` | `<script>` de `ocupacion.js`, chips de leyenda, cache busting. | 1, 8, 9 |
| `CLAUDE.md` | Esquema de `desgloseVenues`, regla de derivación, el helper compartido nuevo. | 9 |

### Entorno de pruebas

Las tareas 2 a 9 se verifican en el navegador. Dos formas, de más rápida a más fiel:

```bash
# Bucle rápido: servidor estático desde la carpeta del panel.
# localhost ya está en los dominios autorizados de Firebase Auth.
cd panel && python -m http.server 5501
# abrir http://localhost:5501/dashboard.html

# Verificación fiel (headers y CSP reales), sin tocar producción:
firebase hosting:channel:deploy montaje --project bunker-panel --expires 7d
```

Si el login falla en el canal de preview, agregar el dominio `bunker-panel--montaje-*.web.app` en Firebase Console → Authentication → Settings → Authorized domains.

**No hacer `firebase deploy` a producción hasta la Tarea 9.**

---

## Task 1: Helper compartido de fechas y ocupación

**Files:**
- Create: `panel/js/ocupacion.js`
- Create: `scripts/test-ocupacion.js`
- Modify: `panel/dashboard.html:2191` (agregar el `<script>` después de `table-helpers.js`)

**Interfaces:**
- Consumes: nada.
- Produces: el global `BNKOcupacion` con:
  - `BNKOcupacion.ESTADOS_BLOQUEAN` → `['Cerrada', 'En Producción', 'Ejecutado']`
  - `BNKOcupacion.isoAdd(iso, delta)` → `String` — `('2026-10-14', -1)` → `'2026-10-13'`
  - `BNKOcupacion.hoy()` → `String` — fecha local de hoy en ISO corto
  - `BNKOcupacion.derive(eventDays, montajeDays, desmontajeDays)` → `{ montajeDates: Array<String>, desmontajeDates: Array<String> }`
  - `BNKOcupacion.fechasDeVenue(entry)` → `{ evento: Array<String>, montaje: Array<String>, desmontaje: Array<String> }` — `entry` es un elemento de `desgloseVenues`; aplica el respaldo legacy
  - `BNKOcupacion.indexar(cotizaciones)` → `{ [nombreVenue]: { [iso]: { folio, tipo, cotizacionId } } }` — `tipo` es `'evento'`, `'montaje'` o `'desmontaje'`

- [ ] **Step 1: Escribir el script de verificación (va a fallar)**

Crear `scripts/test-ocupacion.js`:

```js
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

console.log(fails === 0 ? '\nTodo pasó.' : '\n' + fails + ' fallas.');
process.exit(fails ? 1 : 0);
```

- [ ] **Step 2: Correr el script para confirmar que falla**

Run: `node scripts/test-ocupacion.js`
Expected: FAIL con `ENOENT: no such file or directory ... panel\js\ocupacion.js`

- [ ] **Step 3: Escribir `panel/js/ocupacion.js`**

```js
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
  // anteriores a oct-2026 traen montajeDays sin fechas: se derivan al vuelo.
  function fechasDeVenue(entry) {
    if (!entry) return { evento: [], montaje: [], desmontaje: [] };
    var evento = entry.eventDays || [];
    var montaje = entry.montajeDates;
    var desmontaje = entry.desmontajeDates;
    if (!montaje || !desmontaje) {
      var d = derive(evento, entry.montajeDays, entry.desmontajeDays);
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
        if (!entry || !entry.nombre) return;
        var f = fechasDeVenue(entry);
        if (!idx[entry.nombre]) idx[entry.nombre] = {};
        var destino = idx[entry.nombre];
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
```

- [ ] **Step 4: Correr el script y confirmar que todo pasa**

Run: `node scripts/test-ocupacion.js`
Expected: todas las líneas con `ok` y `Todo pasó.`, código de salida 0.

- [ ] **Step 5: Cargar el helper en el dashboard**

En `panel/dashboard.html`, después de la línea `<script src="js/table-helpers.js?v=1"></script>`, agregar:

```html
<script src="js/ocupacion.js?v=1"></script>
```

Tiene que quedar antes de `calendario.js` y de `cotizar-mnt.js`, que lo consumen.

- [ ] **Step 6: Verificar en el navegador que el global existe**

Abrir el panel (ver "Entorno de pruebas") y en la consola de DevTools:

```js
BNKOcupacion.derive(['2026-10-14','2026-10-15'], 2, 1)
```

Expected: `{montajeDates: ['2026-10-12','2026-10-13'], desmontajeDates: ['2026-10-16']}`

- [ ] **Step 7: Commit**

```bash
git add panel/js/ocupacion.js scripts/test-ocupacion.js panel/dashboard.html
git commit -m "feat(panel): helper compartido de fechas de ocupación de venues"
```

---

## Task 2: Tokens y estilos del wizard

**Files:**
- Modify: `panel/css/panel.css:7-25` (bloque `:root`) y `panel/css/panel.css:324-341` (calendario y montaje del wizard)
- Modify: `panel/dashboard.html:9` (`panel.css?v=10` → `?v=11`)

**Interfaces:**
- Consumes: nada.
- Produces: tokens `--montaje` y `--desmontaje`; clases `.mnt-cal-day.montaje`, `.mnt-cal-day.desmontaje`, `.mnt-cal-day.ocupado`, `.mnt-steppers`, `.mnt-cal-legend-row`, `.mnt-legend-chip` — las usan las tareas 3 y 4.

- [ ] **Step 1: Agregar los dos tokens**

En `panel/css/panel.css`, dentro de `:root`, después de la línea `--cyan: #00e5ff;`:

```css
  --montaje:    #8B5CF6;
  --desmontaje: #FF8C42;
```

- [ ] **Step 2: Agregar los estilos de celda**

Después de la regla `.mnt-cal-day.disabled{...}` (línea ~330):

```css
.mnt-cal-day.montaje{background:rgba(139,92,246,.14);border-color:var(--montaje);color:var(--montaje);font-weight:700;cursor:default;pointer-events:none}
.mnt-cal-day.desmontaje{background:rgba(255,140,66,.14);border-color:var(--desmontaje);color:var(--desmontaje);font-weight:700;cursor:default;pointer-events:none}
.mnt-cal-day.ocupado{background:rgba(255,68,85,.06);border-color:rgba(255,68,85,.35);color:var(--red);opacity:.55;cursor:not-allowed;pointer-events:none}
```

`pointer-events:none` es lo que impide convertir un día derivado u ocupado en día de evento. Se declara aquí y no en JS para que el bloqueo no dependa de que un listener se haya enlazado.

- [ ] **Step 3: Agregar la leyenda de tres chips y el contenedor de steppers**

Reemplazar la regla `.mnt-cal-legend{...}` (línea ~334) por:

```css
.mnt-cal-legend{font-family:'Space Mono',monospace;font-size:8px;color:var(--tx);letter-spacing:1px;margin-top:6px;opacity:.6}
.mnt-cal-legend-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
.mnt-legend-chip{font-family:'Space Mono',monospace;font-size:8px;letter-spacing:1px;display:flex;align-items:center;gap:4px}
.mnt-legend-chip::before{content:'';width:8px;height:8px;flex-shrink:0;background:currentColor}
.mnt-legend-chip--weekend{color:var(--ylw)}
.mnt-legend-chip--montaje{color:var(--montaje)}
.mnt-legend-chip--desmontaje{color:var(--desmontaje)}
```

Y antes de la regla `.mnt-montaje{...}` (línea ~337):

```css
.mnt-steppers{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.mnt-steppers .mnt-montaje{margin-top:0;justify-content:space-between}
.mnt-montaje-label{flex:1}
```

- [ ] **Step 4: Subir la versión del CSS**

En `panel/dashboard.html` línea 9: `css/panel.css?v=10` → `css/panel.css?v=11`.

- [ ] **Step 5: Verificar los colores en el navegador**

Abrir el panel, ir a COTIZAR MNT, seleccionar un espacio para que aparezca el calendario, y en la consola:

```js
var c = document.querySelectorAll('.mnt-cal-day:not(.empty)');
c[10].classList.add('montaje'); c[11].classList.add('desmontaje'); c[12].classList.add('ocupado');
```

Expected: tres celdas consecutivas en violeta, naranja y rojo atenuado; ninguna de las tres responde al clic.

- [ ] **Step 6: Commit**

```bash
git add panel/css/panel.css panel/dashboard.html
git commit -m "style(panel): tokens y estilos de montaje, desmontaje y ocupado en el wizard MNT"
```

---

## Task 3: Cargar el índice de ocupación al iniciar el wizard

**Files:**
- Modify: `panel/js/pages/cotizar-mnt.js:5-35` (declaraciones e `init`)

**Interfaces:**
- Consumes: `BNKOcupacion.indexar` (Tarea 1).
- Produces: la variable de módulo `_ocupacion` y la función `_ocupado(venueNombre, iso)` → `{ folio, tipo, cotizacionId }` o `null`. La usan las tareas 4 y 5.

- [ ] **Step 1: Declarar la variable de módulo**

En `panel/js/pages/cotizar-mnt.js`, después de `var _expandedVid = null;` (línea 11):

```js
  var _ocupacion = {};   // { nombreVenue: { iso: { folio, tipo, cotizacionId } } }
```

Y actualizar el comentario de `_selected` (línea 7) a:

```js
  var _selected = {};    // { docId: { montajeDays: 0, desmontajeDays: 0, eventDays: [...], calMonth: Date } }
```

- [ ] **Step 2: Cargar las cotizaciones en el `Promise.all` de `init`**

Reemplazar el bloque de `init` que va de `Promise.all([` a `.catch(...)` por:

```js
    Promise.all([
      BNK_DB.catalogo.list(),
      BNK_DB.clientes.list(),
      BNK_DB.cotizaciones.list().catch(function (err) {
        // Sin el índice se puede cotizar igual, solo sin verificación de ocupación.
        console.error('[BNK] No se pudo cargar la ocupación:', err);
        return null;
      })
    ]).then(function (results) {
      var allCatalogo = results[0];
      _venues = allCatalogo.filter(function (c) { return c.categoria === 'Venues' && c.activo !== false; });
      _clientes = results[1];
      if (results[2] === null) {
        _ocupacion = {};
        BNKToast.warn('No se pudo verificar la ocupación de los espacios. Revisa las fechas a mano.');
      } else {
        _ocupacion = BNKOcupacion.indexar(results[2]);
      }
      if (loadingEl.parentNode) loadingEl.remove();
      if (wizard) wizard.style.opacity = '';
      _renderSpaces();
      _bindEvents();
      _restoreDraft();
      _bindDraftAutoSave();
    }).catch(function () {
      loadingEl.textContent = 'Error al cargar catálogo. Recarga la página.';
    });
```

- [ ] **Step 3: Agregar el lector del índice**

Junto a las demás utilidades, después de `function _formatMXN(n) {...}` (línea ~39):

```js
  function _ocupado(venueNombre, iso) {
    var porVenue = _ocupacion[venueNombre];
    return (porVenue && porVenue[iso]) ? porVenue[iso] : null;
  }
```

- [ ] **Step 4: Verificar en el navegador**

Abrir COTIZAR MNT y en la consola de DevTools confirmar que no hay errores `[BNK]`. Para ver el índice, pegar temporalmente en la consola:

```js
BNK_DB.cotizaciones.list().then(function (cs) { console.log(BNKOcupacion.indexar(cs)); });
```

Expected: un objeto con los venues que tengan cotizaciones cerradas. Si no hay ninguna cerrada en la base, devuelve `{}` — es correcto, y la Tarea 9 lo prueba creando una.

- [ ] **Step 5: Commit**

```bash
git add panel/js/pages/cotizar-mnt.js
git commit -m "feat(panel): cargar el índice de ocupación de venues al abrir el wizard MNT"
```

---

## Task 4: Pintar montaje, desmontaje y ocupado en el calendario del wizard

**Files:**
- Modify: `panel/js/pages/cotizar-mnt.js:510-533` (`_buildCalendarDays`) y `panel/js/pages/cotizar-mnt.js:418` (la línea de `mnt-cal-legend`)

**Interfaces:**
- Consumes: `BNKOcupacion.derive` (Tarea 1), `_ocupado` (Tarea 3), las clases CSS de la Tarea 2.
- Produces: `_fechasDerivadas(vid)` → `{ montajeDates, desmontajeDates }` para el venue seleccionado. La usan las tareas 5, 6 y 7.

- [ ] **Step 1: Agregar el derivador por venue**

Antes de `function _buildCalendarDays(...)`:

```js
  function _fechasDerivadas(vid) {
    var sel = _selected[vid];
    if (!sel) return { montajeDates: [], desmontajeDates: [] };
    return BNKOcupacion.derive(sel.eventDays, sel.montajeDays, sel.desmontajeDays);
  }
```

- [ ] **Step 2: Pintar las clases nuevas en cada celda**

En `_buildCalendarDays`, reemplazar el cuerpo del `for (var d = 1; d <= daysInMonth; d++)` por:

```js
    var derivadas = _fechasDerivadas(vid);

    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(year, month, d);
      var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var dow = date.getDay();
      var isWeekend = dow === 5 || dow === 6; // Vie-Sáb
      var isPast = date < today;
      var isSelected = _selected[vid] && _selected[vid].eventDays.indexOf(iso) >= 0;
      var esMontaje = derivadas.montajeDates.indexOf(iso) >= 0;
      var esDesmontaje = derivadas.desmontajeDates.indexOf(iso) >= 0;
      var ocupa = _ocupado(venue.concepto, iso);
      var disabled = isPast || (isSalas && isWeekend);

      // Precedencia: ocupado por otra cotización > derivado de esta > no disponible.
      var extraClass = '', title = '';
      if (ocupa) {
        extraClass = ' ocupado';
        title = 'Ocupado — ' + ocupa.folio + ' (' + ocupa.tipo + ')';
      } else if (esMontaje) {
        extraClass = ' montaje';
        title = 'Día de montaje';
      } else if (esDesmontaje) {
        extraClass = ' desmontaje';
        title = 'Día de desmontaje';
      } else if (disabled) {
        title = isPast ? 'Fecha pasada — no disponible' : 'No disponible para este tipo de evento';
      }

      html += '<div class="mnt-cal-day' + (isWeekend ? ' weekend' : '') + (isSelected ? ' selected' : '')
        + (disabled ? ' disabled' : '') + extraClass + '"'
        + (title ? ' title="' + _esc(title) + '"' : '')
        + ' data-vid="' + vid + '" data-date="' + iso + '">' + d + '</div>';
    }
    return html;
  }
```

- [ ] **Step 3: Reemplazar la leyenda de una línea por tres chips**

En `_renderCalendars`, sustituir:

```js
          + '<div class="mnt-cal-legend"><span style="color:var(--ylw)">■</span> TARIFA WEEKEND (VIE-SÁB)</div>';
```

por:

```js
          + '<div class="mnt-cal-legend-row">'
          + '<span class="mnt-legend-chip mnt-legend-chip--weekend">TARIFA WEEKEND (VIE-SÁB)</span>'
          + '<span class="mnt-legend-chip mnt-legend-chip--montaje">MONTAJE</span>'
          + '<span class="mnt-legend-chip mnt-legend-chip--desmontaje">DESMONTAJE</span>'
          + '</div>';
```

- [ ] **Step 4: Verificar en el navegador**

1. COTIZAR MNT → paso 3 → seleccionar VELARIA → elegir los días 14 y 15 de un mes futuro.
2. En la consola: `_selected` no es accesible (está dentro del IIFE), así que la verificación es visual en la Tarea 5, cuando exista el stepper. Por ahora, confirmar que la leyenda muestra los tres chips con sus colores y que el calendario sigue funcionando: los días se seleccionan y se deseleccionan igual que antes.

Expected: tres chips (ámbar, violeta, naranja) bajo el calendario; ninguna regresión al seleccionar días.

- [ ] **Step 5: Commit**

```bash
git add panel/js/pages/cotizar-mnt.js
git commit -m "feat(panel): pintar días de montaje, desmontaje y ocupados en el calendario del wizard"
```

---

## Task 5: Stepper de desmontaje, validaciones y recorte automático

**Files:**
- Modify: `panel/js/pages/cotizar-mnt.js:319` (estado inicial), `:370-380` (`_venueSummary`), `:424-433` (markup de steppers), `:465-495` (listeners)

**Interfaces:**
- Consumes: `_fechasDerivadas` (Tarea 4), `_ocupado` (Tarea 3), `BNKOcupacion.hoy` / `.isoAdd` (Tarea 1).
- Produces: `_selected[vid].desmontajeDays`, y `_recortarDias(vid)` que ajusta los contadores cuando cambian los días de evento. La Tarea 6 lee `desmontajeDays`.

- [ ] **Step 1: Inicializar el contador nuevo**

Línea 319, en el `toggle()` de las tarjetas de espacio:

```js
          _selected[vid] = { montajeDays: 0, desmontajeDays: 0, eventDays: [], calMonth: new Date() };
```

- [ ] **Step 2: Agregar el validador y el recorte**

Después de `_fechasDerivadas`:

```js
  var MESES_CORTO_MSG = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  function _fechaCorta(iso) {
    var p = iso.split('-');
    return parseInt(p[2], 10) + ' ' + MESES_CORTO_MSG[parseInt(p[1], 10) - 1];
  }

  // Devuelve null si el día siguiente de ese tipo se puede reservar, o el
  // mensaje de por qué no.
  function _porQueNoSePuede(vid, venue, tipo) {
    var sel = _selected[vid];
    if (!sel.eventDays.length) return 'Selecciona primero los días del evento.';

    var ordenados = sel.eventDays.slice().sort();
    var iso = tipo === 'montaje'
      ? BNKOcupacion.isoAdd(ordenados[0], -((sel.montajeDays || 0) + 1))
      : BNKOcupacion.isoAdd(ordenados[ordenados.length - 1], (sel.desmontajeDays || 0) + 1);

    if (iso < BNKOcupacion.hoy()) return 'El ' + tipo + ' caería en una fecha pasada.';
    if (sel.eventDays.indexOf(iso) >= 0) return 'Ese día ya es día de evento.';

    var ocupa = _ocupado(venue.concepto, iso);
    if (ocupa) return 'No disponible: ' + ocupa.folio + ' ocupa el ' + _fechaCorta(iso) + '.';

    return null;
  }

  // Tras cambiar los días de evento, baja los contadores hasta que todos los
  // días derivados vuelvan a ser válidos.
  function _recortarDias(vid, venue) {
    var sel = _selected[vid];
    var recortado = false;
    ['montaje', 'desmontaje'].forEach(function (tipo) {
      var prop = tipo === 'montaje' ? 'montajeDays' : 'desmontajeDays';
      while ((sel[prop] || 0) > 0) {
        var guardado = sel[prop];
        sel[prop] = guardado - 1;
        var motivo = _porQueNoSePuede(vid, venue, tipo); // ¿se podría volver a subir?
        sel[prop] = guardado;
        if (motivo === null) break;      // el nivel actual es válido
        sel[prop] = guardado - 1;        // no lo es: bajar uno y reintentar
        recortado = true;
      }
    });
    return recortado;
  }
```

- [ ] **Step 3: Reemplazar el bloque de un stepper por dos**

En `_renderCalendars`, sustituir todo el bloque `// Montaje stepper` (las 7 líneas desde `var montLabel = ...` hasta el `+ '</div>';` que cierra `.mnt-montaje`) por:

```js
        // Steppers de montaje y desmontaje
        var montLabel = venue.precioMontaje > 0 ? _formatMXN(venue.precioMontaje) + ' / DÍA' : 'SIN COSTO';
        html += '<div class="mnt-steppers">'
          + '<div class="mnt-montaje">'
          + '<span class="mnt-montaje-label">DÍAS DE MONTAJE (' + montLabel + ')</span>'
          + '<button class="mnt-montaje-btn" data-vid="' + vid + '" data-tipo="montaje" data-dir="-1">&minus;</button>'
          + '<span class="mnt-montaje-val" id="montVal-' + vid + '">' + (sel.montajeDays || 0) + '</span>'
          + '<button class="mnt-montaje-btn" data-vid="' + vid + '" data-tipo="montaje" data-dir="1">+</button>'
          + '</div>'
          + '<div class="mnt-montaje">'
          + '<span class="mnt-montaje-label">DÍAS DE DESMONTAJE (' + montLabel + ')</span>'
          + '<button class="mnt-montaje-btn" data-vid="' + vid + '" data-tipo="desmontaje" data-dir="-1">&minus;</button>'
          + '<span class="mnt-montaje-val" id="desmVal-' + vid + '">' + (sel.desmontajeDays || 0) + '</span>'
          + '<button class="mnt-montaje-btn" data-vid="' + vid + '" data-tipo="desmontaje" data-dir="1">+</button>'
          + '</div>'
          + '</div>';
```

- [ ] **Step 4: Reemplazar el listener de los steppers**

Sustituir todo el bloque `area.querySelectorAll('.mnt-montaje-btn').forEach(...)` por:

```js
    area.querySelectorAll('.mnt-montaje-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var vid = this.getAttribute('data-vid');
        var tipo = this.getAttribute('data-tipo');
        var dir = parseInt(this.getAttribute('data-dir'));
        var sel = _selected[vid];
        var venue = _venues.find(function (v) { return v.id === vid; });
        if (!sel || !venue) return;
        var prop = tipo === 'montaje' ? 'montajeDays' : 'desmontajeDays';

        if (dir > 0) {
          var motivo = _porQueNoSePuede(vid, venue, tipo);
          if (motivo) { BNKToast.warn(motivo); return; }
          sel[prop] = (sel[prop] || 0) + 1;
        } else {
          sel[prop] = Math.max(0, (sel[prop] || 0) - 1);
        }
        _renderCalendars();
      });
    });
```

Se vuelve a renderizar el calendario completo en vez de solo actualizar el número, porque los días derivados cambian de color.

- [ ] **Step 5: Recortar al cambiar los días de evento**

En el listener de las celdas (`area.querySelectorAll('.mnt-cal-day:not(.disabled):not(.empty)')`), reemplazar el cuerpo del `click` por:

```js
      cell.addEventListener('click', function () {
        var vid = this.getAttribute('data-vid');
        var date = this.getAttribute('data-date');
        var days = _selected[vid].eventDays;
        var idx = days.indexOf(date);
        if (idx >= 0) { days.splice(idx, 1); }
        else { days.push(date); }

        var venue = _venues.find(function (v) { return v.id === vid; });
        if (venue && _recortarDias(vid, venue)) {
          BNKToast.warn('Se ajustaron los días de montaje o desmontaje por el cambio de fechas.');
        }
        _renderCalendars();
      });
```

- [ ] **Step 6: Actualizar el resumen del acordeón**

Reemplazar `_venueSummary` por:

```js
  function _venueSummary(vid) {
    var sel = _selected[vid];
    if (!sel) return '';
    var parts = [];
    if (sel.eventDays.length > 0) parts.push(sel.eventDays.length + ' día' + (sel.eventDays.length > 1 ? 's' : '') + ' evento');
    if (sel.montajeDays > 0) parts.push(sel.montajeDays + ' montaje');
    if (sel.desmontajeDays > 0) parts.push(sel.desmontajeDays + ' desmontaje');
    return parts.length > 0 ? parts.join(', ') : 'Sin fechas';
  }
```

- [ ] **Step 7: Verificar los cinco comportamientos en el navegador**

En COTIZAR MNT → paso 3 → VELARIA (o cualquier venue con `precioMontaje`):

| Acción | Resultado esperado |
|---|---|
| Sin días de evento, pulsar `+` de montaje | Toast `Selecciona primero los días del evento.`, el contador sigue en 0 |
| Elegir 14 y 15 de un mes futuro, subir montaje a 2 | 12 y 13 en violeta, no clickeables; el resumen del acordeón dice `2 días evento, 2 montaje` |
| Subir desmontaje a 1 | 16 en naranja; resumen `2 días evento, 2 montaje, 1 desmontaje` |
| Bajar montaje a 0 | 12 y 13 vuelven a su color normal y se pueden volver a clickear |
| Elegir el día 1 del mes en curso y subir montaje | Toast `El montaje caería en una fecha pasada.` |
| Con montaje en 2, deseleccionar el día 14 (queda solo el 15) | El montaje pasa a 13 y 14 solos; si alguno ya no es válido, toast de ajuste |

- [ ] **Step 8: Commit**

```bash
git add panel/js/pages/cotizar-mnt.js
git commit -m "feat(panel): stepper de desmontaje con validación y recorte automático"
```

---

## Task 6: Cálculo, resumen del paso 4 y guardado

**Files:**
- Modify: `panel/js/pages/cotizar-mnt.js:536-600` (`_calcular`), `:605-640` (resumen), `:838-875` (payload)

**Interfaces:**
- Consumes: `_fechasDerivadas` (Tarea 4), `_selected[vid].desmontajeDays` (Tarea 5).
- Produces: cada entrada de `calc.desglose` gana `montajeDates`, `desmontajeDays`, `desmontajeDates` y `desmontaje`; `calc` gana `desmontajeTotal`. Los consume la Tarea 7.

- [ ] **Step 1: Calcular el desmontaje**

En `_calcular`, después de `var montajeTotal = 0;`:

```js
    var desmontajeTotal = 0;
```

Reemplazar la línea `var montaje = (sel.montajeDays || 0) * (venue.precioMontaje || 0);` por:

```js
      var montaje = (sel.montajeDays || 0) * (venue.precioMontaje || 0);
      var desmontaje = (sel.desmontajeDays || 0) * (venue.precioMontaje || 0);
      var derivadas = _fechasDerivadas(vid);
```

Después de `montajeTotal += montaje;`:

```js
      desmontajeTotal += desmontaje;
```

En el objeto que se mete a `desglose`, después de `montajeDays: sel.montajeDays || 0,`:

```js
        montajeDates: derivadas.montajeDates,
        desmontajeDays: sel.desmontajeDays || 0,
        desmontajeDates: derivadas.desmontajeDates,
```

Y después de `montaje: montaje,`:

```js
        desmontaje: desmontaje,
```

Cambiar `total: renta + montaje` por `total: renta + montaje + desmontaje`.

- [ ] **Step 2: Sumar al subtotal y devolverlo**

Reemplazar `var subtotal = rentaTotal + montajeTotal;` por:

```js
    var subtotal = rentaTotal + montajeTotal + desmontajeTotal;
```

Y en el objeto de retorno, después de `montajeTotal: montajeTotal,`:

```js
      desmontajeTotal: desmontajeTotal,
```

- [ ] **Step 3: Mostrarlo en el resumen del paso 4**

En el `forEach` del desglose, reemplazar la línea de fechas:

```js
        + '<div class="mnt-resumen-row mnt-resumen-fechas"><span>Fechas: ' + _esc(d.eventDays.join(', ')) + '</span></div>'
```

por:

```js
        + (d.montajeDates.length > 0 ? '<div class="mnt-resumen-row mnt-resumen-fechas"><span style="color:var(--montaje)">Montaje: ' + _esc(d.montajeDates.join(', ')) + '</span></div>' : '')
        + '<div class="mnt-resumen-row mnt-resumen-fechas"><span>Evento: ' + _esc(d.eventDays.join(', ')) + '</span></div>'
        + (d.desmontajeDates.length > 0 ? '<div class="mnt-resumen-row mnt-resumen-fechas"><span style="color:var(--desmontaje)">Desmontaje: ' + _esc(d.desmontajeDates.join(', ')) + '</span></div>' : '')
```

Y después de la línea de `Días montaje`:

```js
        + (d.desmontajeDays > 0 ? '<div class="mnt-resumen-row"><span>Días desmontaje: ' + d.desmontajeDays + '</span><span>' + _formatMXN(d.desmontaje) + '</span></div>' : '')
```

En el bloque de totales, después del renglón `Montaje total`:

```js
      + '<div class="mnt-resumen-row"><span>Desmontaje total</span><span>' + _formatMXN(calc.desmontajeTotal) + '</span></div>'
```

- [ ] **Step 4: Guardar el total nuevo en Firestore**

En `_guardar`, en el objeto `data`, después de `montajeTotal: calc.montajeTotal,`:

```js
      desmontajeTotal: calc.desmontajeTotal,
```

`desgloseVenues: JSON.stringify(calc.desglose)` ya arrastra los campos nuevos por venue, no hay que tocarlo. `diasTotal`, `fechaEvento` y `fechas` se quedan exactamente como están: siguen contando solo días de evento.

- [ ] **Step 5: Verificar en el navegador**

1. Cotizar VELARIA con evento 14–15, montaje 2, desmontaje 1.
2. Paso 4: deben verse los tres renglones de fechas con sus colores, `Días desmontaje: 1` con su importe, y `Desmontaje total` en los totales.
3. Comprobar la aritmética a mano: `Subtotal = Renta + Montaje total + Desmontaje total`, `IVA = 16%` del subtotal.
4. Generar la cotización y abrir el documento en Firebase Console → Firestore → `cotizaciones`: debe traer `desmontajeTotal`, y dentro de `desgloseVenues` los campos `montajeDates`, `desmontajeDays`, `desmontajeDates`, `desmontaje`.

- [ ] **Step 6: Commit**

```bash
git add panel/js/pages/cotizar-mnt.js
git commit -m "feat(panel): cobrar y guardar los días de desmontaje en cotizaciones MNT"
```

---

## Task 7: Desmontaje en los dos generadores de PDF

**Files:**
- Modify: `panel/js/pages/cotizar-mnt.js:756-780` (PDF del wizard)
- Modify: `panel/js/pdf-rebuild.js:148-168` (PDF regenerado)
- Modify: `panel/dashboard.html:2189` (`pdf-rebuild.js?v=1` → `?v=2`)

**Interfaces:**
- Consumes: `d.desmontajeDays`, `d.desmontaje`, `calc.desmontajeTotal` (Tarea 6); en `pdf-rebuild.js`, los mismos campos leídos del documento de Firestore.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Renglón por venue en el PDF del wizard**

En `cotizar-mnt.js`, justo después del bloque `if (d.montajeDays > 0) {...}`:

```js
      if (d.desmontajeDays > 0) {
        doc.text(d.desmontajeDays + ' día(s) desmontaje × ' + _formatMXN(d.precioMontaje), margin + 4, y + 4);
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text(_formatMXN(d.desmontaje), W - margin - 4, y + 4, { align: 'right' });
        doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]); y += 7;
      }
```

- [ ] **Step 2: Total en el PDF del wizard**

Después de las dos líneas del renglón `Montaje total`:

```js
    doc.text('Desmontaje total', margin + 4, y + 4);
    doc.text(_formatMXN(calc.desmontajeTotal), W - margin - 4, y + 4, { align: 'right' }); y += 7;
```

- [ ] **Step 3: Los mismos dos renglones en `pdf-rebuild.js`**

Después del bloque `if ((d.montajeDays || 0) > 0) {...}`:

```js
      if ((d.desmontajeDays || 0) > 0) {
        doc.text(d.desmontajeDays + ' día(s) desmontaje × ' + _formatMXN(d.precioMontaje), margin + 4, yRef.y + 4);
        doc.setTextColor(p.ACCENT[0], p.ACCENT[1], p.ACCENT[2]);
        doc.text(_formatMXN(d.desmontaje || 0), W - margin - 4, yRef.y + 4, { align: 'right' });
        doc.setTextColor(p.TEXT[0], p.TEXT[1], p.TEXT[2]); yRef.y += 7;
      }
```

Y en los totales, después del renglón `Montaje total`:

```js
    doc.text('Desmontaje total', margin + 4, yRef.y + 4);
    doc.text(_formatMXN(data.desmontajeTotal || 0), W - margin - 4, yRef.y + 4, { align: 'right' }); yRef.y += 7;
```

Los `|| 0` son lo que permite regenerar sin romperse el PDF de una cotización anterior a este cambio.

- [ ] **Step 4: Subir la versión**

`panel/dashboard.html` línea 2189: `js/pdf-rebuild.js?v=1` → `js/pdf-rebuild.js?v=2`.

- [ ] **Step 5: Verificar los cuatro PDFs**

1. Generar la cotización del paso anterior en paleta **neon**: el PDF trae `1 día(s) desmontaje × $…` bajo el de montaje, y `Desmontaje total` en el resumen.
2. Repetir en paleta **corporativa**.
3. En COTIZACIONES, usar el botón de PDF de esa misma cotización (eso llama a `BNKPdfRebuild`): el documento debe salir idéntico al del wizard.
4. Hacer lo mismo con una cotización MNT **vieja** (sin los campos nuevos): debe generarse sin errores en consola, con `Desmontaje total $0` y sin renglón de desmontaje por venue.

- [ ] **Step 6: Commit**

```bash
git add panel/js/pages/cotizar-mnt.js panel/js/pdf-rebuild.js panel/dashboard.html
git commit -m "feat(panel): renglones de desmontaje en los PDFs MNT del wizard y regenerados"
```

---

## Task 8: Montaje y desmontaje en el tab CALENDARIO

**Files:**
- Modify: `panel/js/pages/calendario.js:415-477` (`_buildTooltip` y `_getBloquesDelDia`) y `:376-396` (iCal)
- Modify: `panel/css/calendario.css` (bloques y leyenda)
- Modify: `panel/dashboard.html:1020-1023` (chips de leyenda), `:989` (`calendario.css?v=8` → `?v=9`), `:2197` (`calendario.js?v=8` → `?v=9`)

**Interfaces:**
- Consumes: `BNKOcupacion.fechasDeVenue` y `BNKOcupacion.ESTADOS_BLOQUEAN` (Tarea 1).
- Produces: bloques con `tipo` `'montaje'` y `'desmontaje'`. Las vistas de mes (`calendario.js:131`), semana (`:229`) y día (`:303`) ya concatenan `b.tipo` en el nombre de la clase, así que no hay que tocar su render.

- [ ] **Step 1: Estilos de los dos tipos nuevos**

En `panel/css/calendario.css`, después de `.cal-bloque--evento{...}`:

```css
.cal-bloque--montaje{background:rgba(139,92,246,.12);color:var(--montaje);border-left:2px solid var(--montaje)}
.cal-bloque--desmontaje{background:rgba(255,140,66,.12);color:var(--desmontaje);border-left:2px solid var(--desmontaje)}
```

Después de `.cal-day-item-tipo--evento{...}`:

```css
.cal-day-item-tipo--montaje{background:var(--montaje)}
.cal-day-item-tipo--desmontaje{background:var(--desmontaje)}
```

Después de `.cal-legend--evento{...}`:

```css
.cal-legend--montaje{color:var(--montaje);border-color:rgba(139,92,246,.3);background:rgba(139,92,246,.06)}
.cal-legend--desmontaje{color:var(--desmontaje);border-color:rgba(255,140,66,.3);background:rgba(255,140,66,.06)}
```

Y para que los cinco chips envuelvan en pantallas angostas, cambiar la regla base:

```css
.cal-legend{display:flex;flex-wrap:wrap;gap:16px;padding:0 30px 16px}
```

- [ ] **Step 2: Los dos chips en la leyenda del HTML**

`panel/dashboard.html`, dentro de `<div class="cal-legend">`, después del chip de Evento:

```html
      <span class="cal-legend-item cal-legend--montaje">Montaje</span>
      <span class="cal-legend-item cal-legend--desmontaje">Desmontaje</span>
```

- [ ] **Step 3: Reescribir la detección de coincidencias en `_getBloquesDelDia`**

En `panel/js/pages/calendario.js`, reemplazar desde `_cotizaciones.forEach(function (c) {` hasta el cierre de ese `forEach` (justo antes de `_eventos.forEach(`) por:

```js
    _cotizaciones.forEach(function (c) {
      var esCerrada = BNKOcupacion.ESTADOS_BLOQUEAN.indexOf(c.estado) !== -1;

      // Qué papel juega esta fecha en esta cotización.
      var papel = null;
      if (c.desgloseVenues) {
        try {
          var desglose = JSON.parse(c.desgloseVenues);
          for (var i = 0; i < desglose.length && !papel; i++) {
            var f = BNKOcupacion.fechasDeVenue(desglose[i]);
            if (f.evento.indexOf(fecha) !== -1) papel = 'evento';
            else if (esCerrada && f.montaje.indexOf(fecha) !== -1) papel = 'montaje';
            else if (esCerrada && f.desmontaje.indexOf(fecha) !== -1) papel = 'desmontaje';
          }
        } catch (e) { /* documento ilegible: se ignora */ }
      }
      if (!papel) {
        var fechaEvento = c.fechaEvento || c.fecha || c.createdAt || '';
        if (typeof fechaEvento === 'object' && fechaEvento.toDate) {
          fechaEvento = fechaEvento.toDate().toISOString().substring(0, 10);
        }
        if (String(fechaEvento).substring(0, 10) === fecha) papel = 'evento';
      }
      if (!papel) return;

      if (_espacioFiltro !== 'todos') {
        var espacios = _normalizarTexto(c.espacios || '');
        var filtroNorm = _normalizarTexto(_espacioFiltro);
        var espaciosList = espacios.split(',');
        var match = false;
        for (var j = 0; j < espaciosList.length; j++) {
          if (espaciosList[j].trim().indexOf(filtroNorm) !== -1) { match = true; break; }
        }
        if (!match) return;
      }

      var tipo;
      if (papel === 'montaje' || papel === 'desmontaje') tipo = papel;
      else tipo = esCerrada ? 'confirmado' : 'cotizado';

      var prefijo = papel === 'montaje' ? 'MON ↑ ' : (papel === 'desmontaje' ? 'DES ↓ ' : '');

      bloques.push({
        tipo: tipo,
        papel: papel,
        cliente: c.cliente || '',
        evento: c.evento || '',
        folio: c.folio || '',
        espacio: c.espacios || '',
        estado: c.estado || '',
        label: prefijo + (c.cliente || '').substring(0, 12),
        cotizacionId: c.id
      });
    });
```

Nota: el bucle corta en la **primera** coincidencia (`&& !papel`), y los días de evento tienen prioridad sobre montaje y desmontaje. Dentro de una misma cotización eso nunca entra en conflicto, porque la derivación excluye los días de evento.

- [ ] **Step 4: Prefijo del tipo en el tooltip**

Reemplazar `_buildTooltip` por:

```js
  function _buildTooltip(b) {
    var parts = [];
    if (b.papel === 'montaje') parts.push('MONTAJE');
    if (b.papel === 'desmontaje') parts.push('DESMONTAJE');
    if (b.cliente) parts.push(b.cliente);
    if (b.evento) parts.push(b.evento);
    if (b.folio) parts.push(b.folio);
    if (b.espacio) parts.push(b.espacio);
    return parts.join(' — ');
  }
```

- [ ] **Step 5: Prefijo en el `SUMMARY` del iCal**

En `_exportICS`, reemplazar la línea del `SUMMARY` por:

```js
      var prefijoICS = b.papel === 'montaje' ? 'MONTAJE — ' : (b.papel === 'desmontaje' ? 'DESMONTAJE — ' : '');
      lines.push('SUMMARY:' + _icsEscape(prefijoICS + b.cliente + ' - ' + (b.evento || b.label)));
```

Y en la línea del `uid`, para que montaje, evento y desmontaje de la misma cotización no colapsen en un solo UID:

```js
      var uid = (b.folio || b.cotizacionId || b.eventoId || b.fecha + '-' + Math.random().toString(36).slice(2))
        + '-' + (b.papel || 'evento') + '-' + dtstart + '@bunker-panel';
```

- [ ] **Step 6: Subir las versiones**

`panel/dashboard.html`: línea 989 `css/calendario.css?v=8` → `?v=9`; línea 2197 `js/pages/calendario.js?v=8` → `?v=9`.

- [ ] **Step 7: Verificar en el navegador**

Con la cotización de prueba de la Tarea 6 (VELARIA, evento 14–15, montaje 2, desmontaje 1):

1. En COTIZACIONES, cambiar su estado a **Cerrada**.
2. Ir a CALENDARIO, vista **mes**, navegar a ese mes: los días 12 y 13 muestran un bloque violeta `MON ↑ <cliente>`, 14 y 15 uno verde, y 16 uno naranja `DES ↓ <cliente>`.
3. Pasar el cursor sobre el bloque del 12: el tooltip empieza con `MONTAJE — `.
4. Cambiar a vista **semana** y a vista **día** del 12: mismos colores.
5. Volver a poner la cotización en **Negociación** y recargar: los días 12, 13 y 16 ya no muestran nada; 14 y 15 salen en ámbar.
6. Dejarla en **Cerrada** otra vez y exportar el iCal: el archivo debe traer tres `VEVENT` con `SUMMARY` de montaje, evento y desmontaje, y tres `UID` distintos.
7. Verificar que la leyenda del tab muestra los cinco chips y que no hay errores en consola.

- [ ] **Step 8: Verificar la robustez ante datos malos**

En la consola del tab CALENDARIO, comprobar que un documento ilegible no tumba el render:

```js
BNKOcupacion.indexar([{id:'x', folio:'X', estado:'Cerrada', fuente:'MNT', desgloseVenues:'{roto'}])
```

Expected: `{}` sin excepción. Y confirmar que el tab sigue pintando el mes completo si alguna cotización real tuviera el campo corrupto.

- [ ] **Step 9: Commit**

```bash
git add panel/js/pages/calendario.js panel/css/calendario.css panel/dashboard.html
git commit -m "feat(panel): bloques de montaje y desmontaje en el tab CALENDARIO"
```

---

## Task 9: Documentación, cache busting y verificación end-to-end

**Files:**
- Modify: `panel/dashboard.html:2202` (`cotizar-mnt.js?v=8` → `?v=9`)
- Modify: `CLAUDE.md` (secciones "Tabs y módulos", "Patrones del panel" y "Cache busting")

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Subir la versión de `cotizar-mnt.js`**

`panel/dashboard.html` línea 2202: `js/pages/cotizar-mnt.js?v=8` → `?v=9`.

- [ ] **Step 2: Confirmar que no quedó ningún archivo modificado sin subir versión**

```bash
git diff --name-only main...HEAD -- panel/js panel/css
grep -nE "panel\.css\?v|calendario\.css\?v|pdf-rebuild\.js\?v|calendario\.js\?v|cotizar-mnt\.js\?v|ocupacion\.js\?v" panel/dashboard.html
```

Expected: `panel.css?v=11`, `calendario.css?v=9`, `pdf-rebuild.js?v=2`, `ocupacion.js?v=1`, `calendario.js?v=9`, `cotizar-mnt.js?v=9`.

- [ ] **Step 3: Documentar en CLAUDE.md**

En la tabla de módulos de `panel/js/pages/`, actualizar el renglón de `cotizar-mnt.js` para que diga:

```
| `cotizar-mnt.js` | ~1120 | Wizard 4 pasos (Contacto → Evento → Espacios → Resumen), venue cards desde catálogo, calendario, tarifas regular/weekend/montaje, días de montaje y desmontaje derivados, bloqueo de fechas ocupadas, precio especial por venue, PDF dual, selector de marca |
```

En la sección "Core", después del renglón de `panel/js/firestore.js`, agregar:

```
- **`panel/js/ocupacion.js`** (~110) — `BNKOcupacion`: aritmética de fechas ISO, derivación de días de montaje/desmontaje e índice de ocupación de venues. Sin DOM ni Firebase; lo comparten `cotizar-mnt.js` y `calendario.js`. Se verifica con `node scripts/test-ocupacion.js`.
```

En "Patrones del panel", después del renglón de "Fechas en cotizaciones", agregar:

```
- **Montaje y desmontaje MNT**: `desgloseVenues[i]` lleva `montajeDays`/`montajeDates` y `desmontajeDays`/`desmontajeDates`. Las fechas son días **naturales contiguos**: N antes del primer día de evento y M después del último, derivados con `BNKOcupacion.derive()`. El wizard no guarda esas fechas en su estado, las deriva al vuelo y solo las materializa al guardar. Los registros anteriores a oct-2026 traen `montajeDays` sin fechas: los lectores las derivan con la misma regla, no hay migración. Ambos se cobran a `precioMontaje`. `diasTotal` y `fechaEvento` siguen refiriéndose solo a días de evento.
- **Ocupación de venues**: `BNKOcupacion.indexar(cotizaciones)` arma `{ nombreVenue: { iso: {folio, tipo} } }` con las cotizaciones MNT en `Cerrada`/`En Producción`/`Ejecutado`. El wizard lo usa para bloquear fechas. Empata por **nombre** de venue, no por id: si se renombra un venue en CATÁLOGO, la ocupación histórica deja de empatar.
```

En "Cache busting", actualizar la lista de versiones: `panel.css?v=11`, `calendario.css?v=9`, `pdf-rebuild?v=2`, `ocupacion?v=1`, `calendario?v=9`, `cotizar-mnt?v=9`.

En el gotcha de la doble escritura Sheets → Firestore, agregar al final:

```
Los campos de montaje/desmontaje del panel son aditivos: el Apps Script no los escribe y los lectores los derivan. Si algún día se agrega montaje al cotizador público, hay que actualizar también `writeToFirestore`.
```

- [ ] **Step 4: Correr el script de verificación una última vez**

Run: `node scripts/test-ocupacion.js`
Expected: `Todo pasó.`

- [ ] **Step 5: Desplegar al canal de preview y correr la lista completa**

```bash
firebase hosting:channel:deploy montaje --project bunker-panel --expires 7d
```

Recorrer las ocho verificaciones de la sección 11 de la spec contra la URL del canal. La 6 y la 7 solo se pueden hacer aquí, porque necesitan datos reales:

- **(6)** Con la cotización de prueba en `Cerrada`, abrir COTIZAR MNT y elegir el **mismo venue**: los días 12 a 16 salen atenuados en rojo, no clickeables, con el folio en el tooltip. Elegir **otro venue**: esos mismos días están libres.
- **(7)** Buscar en COTIZACIONES una cotización MNT cerrada **anterior a este cambio** que tenga `montajeDays > 0`. Confirmar que sus días de montaje aparecen en violeta en CALENDARIO y que su PDF se regenera sin errores. Si no existe ninguna, crear una a mano en Firestore con `desgloseVenues` sin los campos nuevos y repetir.
- **Responsive**: 1440, 1025 y 375 px. A 375 px el bloque de dos steppers se apila sin desbordar el acordeón y la leyenda de cinco chips envuelve en varias líneas.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md panel/dashboard.html
git commit -m "docs: documentar montaje/desmontaje MNT y el helper de ocupación"
```

- [ ] **Step 7: Desplegar a producción**

Solo después de que las ocho verificaciones hayan pasado en el canal de preview:

```bash
firebase deploy --only hosting --project bunker-panel
```

Comprobar en `https://bunker-panel.web.app/dashboard` que los archivos nuevos se sirven con su versión correcta (DevTools → Network → filtrar por `ocupacion.js`).

El sitio público no se toca, así que **no hace falta ningún deploy en cPanel**.
