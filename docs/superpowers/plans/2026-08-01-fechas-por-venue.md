# Fechas por Venue — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover la selección de fechas del Paso 1 (global) al Paso 3 (por venue), donde cada espacio tiene su propio calendario mensual navegable con selección de días individuales.

**Architecture:** Se elimina el calendario popup del Paso 1 y su lógica asociada (rango global). En Paso 3, cada card de espacio seleccionado incluye un calendario mensual navegable que permite seleccionar/deseleccionar días individuales. El desglose regular/premium se calcula y muestra per-venue. El Paso 4 (resumen) y PDF se adaptan para mostrar fechas por espacio.

**Tech Stack:** Vanilla HTML/CSS/JS (sin build tools). jsPDF para PDFs.

## Global Constraints

- Sin `!important` en CSS
- Todo texto visible en español
- CSS tokens desde `:root` custom properties
- Sin npm, sin frameworks, sin build step
- Archivos: `cotizador-munet/index.html`, `cotizador-munet/css/cotizador-munet.css`, `cotizador-munet/js/cotizador-munet.js`

---

### Task 1: Eliminar calendario del Paso 1 y limpiar estado global

**Files:**
- Modify: `cotizador-munet/index.html:75-102` (eliminar bloque FECHAS DEL EVENTO)
- Modify: `cotizador-munet/js/cotizador-munet.js` (eliminar funciones y estado del calendario global)

**Interfaces:**
- Produces: Paso 1 sin fechas, sin variables globales de calendario. `isStep1Valid()` ya no requiere fecha. Funciones eliminadas: `calcDaysBreakdown`, `renderDatesBreakdown`, `getEventDates`, `handleCalClick`, `renderCalPopup`, `updateCalDisplay`, `openCalPopup`, `closeCalPopup`, `syncEventDays`. Variables eliminadas: `daysBreakdown`, `calViewMonth`, `calViewYear`, `calSelectState`.

- [ ] **Step 1: Eliminar bloque HTML de fechas en Paso 1**

En `cotizador-munet/index.html`, eliminar las líneas 75-102 (el `<div class="v2-field">` con label "FECHAS DEL EVENTO", el `v2-cal-field`, el popup, y los hidden inputs):

```html
<!-- ELIMINAR TODO ESTE BLOQUE (líneas 75-102) -->
<div class="v2-field">
  <label class="v2-field-label">FECHAS DEL EVENTO</label>
  <div class="v2-cal-field" id="v2CalField">
    ...todo el contenido del calendario...
    <input type="hidden" id="v2FechaInicio">
    <input type="hidden" id="v2FechaFin">
  </div>
</div>
```

- [ ] **Step 2: Eliminar `#v2DatesBreakdown` del Paso 2**

En `cotizador-munet/index.html`, eliminar la línea 157 (ajustar número de línea tras step anterior):

```html
<!-- ELIMINAR -->
<div class="v2-dates-breakdown" id="v2DatesBreakdown"></div>
```

- [ ] **Step 3: Eliminar estado global del calendario en JS**

En `cotizador-munet/js/cotizador-munet.js`, eliminar:

1. Variable `daysBreakdown` (línea 75):
```js
// ELIMINAR
var daysBreakdown = { regular: 0, weekend: 0, total: 0 };
```

2. Variables de estado del calendario (líneas 77-80):
```js
// ELIMINAR
var calViewMonth = new Date().getMonth();
var calViewYear  = new Date().getFullYear();
var calSelectState = 0;
```

3. Función `getEventDates()` (líneas 114-132): eliminar completa.

4. Función `calcDaysBreakdown()` (líneas 159-187): eliminar completa.

5. Función `renderDatesBreakdown()` (líneas 228-261): eliminar completa.

6. Función `renderCalPopup()` (líneas 264-316): eliminar completa.

7. Función `handleCalClick()` (líneas 318-345): eliminar completa.

8. Función `updateCalDisplay()` (líneas 347-373): eliminar completa.

9. Función `openCalPopup()` (líneas 375-387): eliminar completa.

10. Función `closeCalPopup()` (líneas 389-392): eliminar completa.

11. Función `syncEventDays()` (líneas 742-751): eliminar completa.

- [ ] **Step 4: Actualizar `isStep1Valid()` — quitar validación de fecha**

Cambiar la función `isStep1Valid()` (línea 418):

```js
// ANTES:
function isStep1Valid() {
  var cliente  = document.getElementById('v2Cliente').value.trim();
  var contacto = document.getElementById('v2Contacto').value.trim();
  var telefono = document.getElementById('v2Telefono').value.trim();
  var correo   = document.getElementById('v2Correo').value.trim();
  var fecha    = document.getElementById('v2FechaInicio').value;
  return cliente && contacto && (telefono || correo) && fecha;
}

// DESPUÉS:
function isStep1Valid() {
  var cliente  = document.getElementById('v2Cliente').value.trim();
  var contacto = document.getElementById('v2Contacto').value.trim();
  var telefono = document.getElementById('v2Telefono').value.trim();
  var correo   = document.getElementById('v2Correo').value.trim();
  return cliente && contacto && (telefono || correo);
}
```

- [ ] **Step 5: Actualizar `goToStep()` — quitar llamadas eliminadas**

En `goToStep()` (línea 395), cambiar:

```js
// ANTES:
if (stepNum === 2) renderDatesBreakdown();
if (stepNum === 3) { syncEventDays(); buildCards(); }

// DESPUÉS:
if (stepNum === 3) { buildCards(); }
```

- [ ] **Step 6: Eliminar event listeners del calendario en `DOMContentLoaded`**

Eliminar todo el bloque de listeners del calendario popup (líneas 1298-1328):

```js
// ELIMINAR TODO ESTE BLOQUE:
// Calendario popup
document.getElementById('v2CalTrigger').addEventListener('click', ...);
document.getElementById('v2CalPrev').addEventListener('click', ...);
document.getElementById('v2CalNext').addEventListener('click', ...);
document.addEventListener('click', function (e) {
  var calField = document.getElementById('v2CalField');
  ...
});
```

- [ ] **Step 7: Actualizar `getSpaceDaysBreakdown()` — quitar fallback global**

```js
// ANTES:
function getSpaceDaysBreakdown(sp) {
  if (selected[sp.id] && selected[sp.id].eventDays) {
    return calcDaysBreakdownForDates(selected[sp.id].eventDays);
  }
  return daysBreakdown;
}

// DESPUÉS:
function getSpaceDaysBreakdown(sp) {
  if (selected[sp.id] && selected[sp.id].eventDays && selected[sp.id].eventDays.length > 0) {
    return calcDaysBreakdownForDates(selected[sp.id].eventDays);
  }
  return { regular: 0, weekend: 0, total: 0 };
}
```

- [ ] **Step 8: Verificar que la página carga sin errores**

Abrir `cotizador-munet/index.html` en el navegador. Verificar:
- Paso 1 muestra los campos sin el calendario
- Botón "CONTINUAR" se habilita sin necesidad de fechas
- No hay errores en consola
- Se puede navegar al Paso 2 y 3

- [ ] **Step 9: Commit**

```bash
git add cotizador-munet/index.html cotizador-munet/js/cotizador-munet.js
git commit -m "Eliminar calendario global del Paso 1 y limpiar estado asociado"
```

---

### Task 2: Implementar calendario navegable por venue en Paso 3

**Files:**
- Modify: `cotizador-munet/js/cotizador-munet.js` (agregar `renderSpaceCalendar`, refactorizar `buildCards`, adaptar `toggleSpace`, actualizar `toggleSpaceDay`)
- Modify: `cotizador-munet/css/cotizador-munet.css` (estilos del nuevo calendario per-venue)

**Interfaces:**
- Consumes: `SPACES[]`, `selected{}`, `isWeekendDate(dateStr)`, `calcDaysBreakdownForDates(dates)`, `formatMXN(n)`, `MONTH_NAMES[]`, `DAY_NAMES[]`
- Produces: `renderSpaceCalendar(spaceId, container)` — renderiza calendario mensual dentro de un contenedor; `selected[id].calViewMonth`, `selected[id].calViewYear` — estado de navegación per-venue; `selected[id].eventDays` — array de strings `YYYY-MM-DD` seleccionados individualmente

- [ ] **Step 1: Agregar estado de calendario per-venue en `toggleSpace()`**

Cambiar `toggleSpace()` para inicializar estado de calendario per-venue (sin fechas del rango global):

```js
// ANTES:
function toggleSpace(id) {
  if (selected[id]) {
    delete selected[id];
  } else {
    selected[id] = { montajeDays: 0, eventDays: getEventDates().slice() };
  }
  if (cotizacionEnviada) resetEnvio();
  buildCards();
  validateStep3();
}

// DESPUÉS:
function toggleSpace(id) {
  if (selected[id]) {
    delete selected[id];
  } else {
    var now = new Date();
    selected[id] = {
      montajeDays: 0,
      eventDays: [],
      calViewMonth: now.getMonth(),
      calViewYear: now.getFullYear()
    };
  }
  if (cotizacionEnviada) resetEnvio();
  buildCards();
  validateStep3();
}
```

- [ ] **Step 2: Actualizar `validateStep3()` y `hasSpacesSelected()`**

Ahora se requiere que al menos un espacio tenga ≥ 1 día seleccionado:

```js
// ANTES:
function hasSpacesSelected() {
  return Object.keys(selected).length > 0;
}

// DESPUÉS:
function hasSpacesSelected() {
  var ids = Object.keys(selected);
  if (ids.length === 0) return false;
  return ids.some(function (id) {
    return selected[id].eventDays && selected[id].eventDays.length > 0;
  });
}
```

- [ ] **Step 3: Agregar función `renderSpaceCalendar(spaceId)`**

Agregar esta función después de `getSpaceDaysBreakdown()`:

```js
function renderSpaceCalendar(spaceId) {
  var state = selected[spaceId];
  if (!state) return '';

  var viewMonth = state.calViewMonth;
  var viewYear = state.calViewYear;

  var firstDay = new Date(viewYear, viewMonth, 1);
  var startDow = (firstDay.getDay() + 6) % 7; // lun=0
  var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var spaceDays = state.eventDays || [];

  var html = '<div class="v2-vcal" data-space="' + spaceId + '">';

  // Header con navegación
  html += '<div class="v2-vcal-header">' +
    '<button type="button" class="v2-vcal-nav v2-vcal-prev" data-space="' + spaceId + '" data-dir="-1">&#8249;</button>' +
    '<span class="v2-vcal-month">' + MONTH_NAMES[viewMonth] + ' ' + viewYear + '</span>' +
    '<button type="button" class="v2-vcal-nav v2-vcal-next" data-space="' + spaceId + '" data-dir="1">&#8250;</button>' +
  '</div>';

  // Weekday headers
  html += '<div class="v2-vcal-weekdays">' +
    '<span>LUN</span><span>MAR</span><span>MI\u00C9</span><span>JUE</span>' +
    '<span>VIE</span><span>S\u00C1B</span><span>DOM</span>' +
  '</div>';

  // Grid
  html += '<div class="v2-vcal-grid">';

  // Empty cells before first day
  for (var e = 0; e < startDow; e++) {
    html += '<div class="v2-vcal-cell v2-vcal-cell--empty"></div>';
  }

  for (var d = 1; d <= daysInMonth; d++) {
    var dateObj = new Date(viewYear, viewMonth, d);
    var yyyy = dateObj.getFullYear();
    var mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    var dd = String(d).padStart(2, '0');
    var dateStr = yyyy + '-' + mm + '-' + dd;

    var dow = (dateObj.getDay() + 6) % 7;
    var isWknd = dow === 4 || dow === 5; // vie=4, sáb=5 (lun-based)
    var isPast = dateObj < today;
    var isSelected = spaceDays.indexOf(dateStr) >= 0;
    var isToday = dateObj.getTime() === today.getTime();

    var cls = 'v2-vcal-cell';
    if (isWknd) cls += ' v2-vcal-cell--wknd';
    if (isPast) cls += ' v2-vcal-cell--past';
    if (isSelected) cls += ' v2-vcal-cell--selected';
    if (isToday) cls += ' v2-vcal-cell--today';

    html += '<div class="' + cls + '" data-space="' + spaceId + '" data-date="' + dateStr + '">' + d + '</div>';
  }

  html += '</div>'; // grid

  // Desglose debajo del calendario
  var bd = calcDaysBreakdownForDates(spaceDays);
  if (bd.total > 0) {
    html += '<div class="v2-vcal-breakdown">';
    if (bd.regular > 0) {
      html += '<span class="v2-vcal-bd-tag">LUN\u2013JUE: ' + bd.regular + '</span>';
    }
    if (bd.weekend > 0) {
      html += '<span class="v2-vcal-bd-tag v2-vcal-bd-tag--wknd">VIE\u2013S\u00C1B: ' + bd.weekend + '</span>';
    }
    html += '<span class="v2-vcal-bd-total">' + bd.total + ' D\u00CDA' + (bd.total > 1 ? 'S' : '') + '</span>';
    html += '</div>';
  } else {
    html += '<div class="v2-vcal-breakdown"><span class="v2-vcal-bd-empty">SELECCIONA LOS D\u00CDAS DEL EVENTO</span></div>';
  }

  html += '</div>'; // v2-vcal

  return html;
}
```

- [ ] **Step 4: Refactorizar `buildCards()` — reemplazar mini-calendario con calendario navegable**

En `buildCards()`, reemplazar la sección que construye `daysPickerHTML` (líneas 513-577). Primero, eliminar la llamada `calcDaysBreakdown()` de la línea 445:

```js
// ELIMINAR esta línea al inicio de buildCards():
calcDaysBreakdown();
```

Luego reemplazar todo el bloque de `daysPickerHTML` (líneas 513-577):

```js
// ANTES: var daysPickerHTML = ''; ... (todo el bloque del mini-cal)

// DESPUÉS:
var daysPickerHTML = '';
if (isSel) {
  daysPickerHTML = renderSpaceCalendar(sp.id);
}
```

- [ ] **Step 5: Actualizar lógica de precio en cards cuando no hay días seleccionados**

En `buildCards()`, el bloque que calcula `precioDisplay` (líneas 464-497) usa `daysBreakdown` global. Reemplazar todas las referencias a `daysBreakdown` por el desglose per-venue:

```js
// ANTES (dentro del bloque tipo === 'privado'):
if (sp.onlySala && daysBreakdown.weekend > 0) {
// ...
if (daysBreakdown.regular > 0 && daysBreakdown.weekend > 0 ...
// ...

// DESPUÉS: usar desglose per-venue
var spBdForPrice = isSel ? getSpaceDaysBreakdown(sp) : { regular: 0, weekend: 0, total: 0 };

if (tipo === 'privado') {
  if (sp.onlySala && spBdForPrice.weekend > 0) {
    precioDisplay = 'NO DISP.';
    periodoDisplay = 'SOLO LUN\u2013JUE';
  } else if (sp.priv) {
    if (spBdForPrice.regular > 0 && spBdForPrice.weekend > 0 && sp.priv.regular !== (sp.priv.weekend ?? sp.priv.regular)) {
      precioDisplay = formatMXN(sp.priv.regular) + ' / ' + formatMXN(sp.priv.weekend ?? sp.priv.regular);
      periodoDisplay = 'LUN\u2013JUE / VIE\u2013S\u00C1B';
    } else if (spBdForPrice.weekend > 0 && spBdForPrice.regular === 0) {
      precioDisplay = formatMXN(sp.priv.weekend ?? sp.priv.regular);
      periodoDisplay = 'VIE\u2013S\u00C1B / D\u00CDA';
    } else {
      precioDisplay = formatMXN(sp.priv.regular);
      periodoDisplay = sp.id === 'salas' ? 'POR SALA / D\u00CDA' : 'LUN\u2013JUE / D\u00CDA';
    }
  }
} else {
  if (sp.pub && sp.priv) {
    if (spBdForPrice.regular > 0 && spBdForPrice.weekend > 0 && sp.priv.regular !== (sp.priv.weekend ?? sp.priv.regular)) {
      precioDisplay = formatMXN(sp.priv.regular) + ' / ' + formatMXN(sp.priv.weekend ?? sp.priv.regular);
      periodoDisplay = 'LUN\u2013JUE / VIE\u2013S\u00C1B';
    } else if (spBdForPrice.weekend > 0 && spBdForPrice.regular === 0) {
      precioDisplay = formatMXN(sp.priv.weekend ?? sp.priv.regular);
      periodoDisplay = 'VIE\u2013S\u00C1B / D\u00CDA';
    } else {
      precioDisplay = formatMXN(sp.priv.regular);
      periodoDisplay = 'LUN\u2013JUE / D\u00CDA';
    }
  } else {
    precioDisplay = 'SOLO PRIVADO';
  }
}
```

- [ ] **Step 6: Actualizar `isSpaceAvailable()` para usar per-venue**

```js
// ANTES:
function isSpaceAvailable(sp) {
  if (tipo === 'publico' && sp.onlyPrivado) return false;
  if (sp.onlySala) {
    var bd = getSpaceDaysBreakdown(sp);
    if (bd.weekend > 0) return false;
  }
  return true;
}

// DESPUÉS: (sin cambio funcional — getSpaceDaysBreakdown ya no usa fallback global)
// La función se mantiene igual, solo verificar que sigue funcionando.
```

- [ ] **Step 7: Actualizar `toggleSpaceDay()` para selección individual**

```js
// ANTES:
function toggleSpaceDay(spaceId, dateStr) {
  if (!selected[spaceId]) return;
  var days = selected[spaceId].eventDays;
  var idx = days.indexOf(dateStr);
  if (idx >= 0) {
    if (days.length <= 1) return;
    days.splice(idx, 1);
  } else {
    days.push(dateStr);
    days.sort();
  }
  if (cotizacionEnviada) resetEnvio();
  buildCards();
}

// DESPUÉS:
function toggleSpaceDay(spaceId, dateStr) {
  if (!selected[spaceId]) return;
  var days = selected[spaceId].eventDays;
  var idx = days.indexOf(dateStr);
  if (idx >= 0) {
    days.splice(idx, 1);
  } else {
    days.push(dateStr);
    days.sort();
  }
  if (cotizacionEnviada) resetEnvio();
  buildCards();
  validateStep3();
}
```

Nota: Ya no se restringe quitar el último día (el usuario puede deseleccionar todos y el botón se deshabilitará via `validateStep3`).

- [ ] **Step 8: Reemplazar event listeners del mini-cal con listeners del nuevo calendario**

En `buildCards()`, reemplazar el bloque de listeners del mini-calendar (líneas 683-691):

```js
// ELIMINAR:
grid.querySelectorAll('.v2-minical-cell:not(.v2-minical-cell--empty):not(.v2-minical-cell--last)').forEach(function (cell) {
  cell.addEventListener('click', function (e) {
    e.stopPropagation();
    var spaceId = cell.getAttribute('data-space');
    var dateStr = cell.getAttribute('data-date');
    toggleSpaceDay(spaceId, dateStr);
  });
});

// AGREGAR:
// Calendario per-venue: clicks en días
grid.querySelectorAll('.v2-vcal-cell:not(.v2-vcal-cell--empty):not(.v2-vcal-cell--past)').forEach(function (cell) {
  cell.addEventListener('click', function (e) {
    e.stopPropagation();
    var spaceId = cell.getAttribute('data-space');
    var dateStr = cell.getAttribute('data-date');
    toggleSpaceDay(spaceId, dateStr);
  });
});

// Calendario per-venue: navegación mes
grid.querySelectorAll('.v2-vcal-nav').forEach(function (btn) {
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var spaceId = btn.getAttribute('data-space');
    var dir = parseInt(btn.getAttribute('data-dir'), 10);
    if (!selected[spaceId]) return;
    selected[spaceId].calViewMonth += dir;
    if (selected[spaceId].calViewMonth > 11) {
      selected[spaceId].calViewMonth = 0;
      selected[spaceId].calViewYear++;
    } else if (selected[spaceId].calViewMonth < 0) {
      selected[spaceId].calViewMonth = 11;
      selected[spaceId].calViewYear--;
    }
    buildCards();
  });
});
```

- [ ] **Step 9: Agregar estilos CSS para el calendario per-venue**

En `cotizador-munet/css/cotizador-munet.css`, agregar al final (antes de los media queries si los hay):

```css
/* ── Calendario per-venue (Paso 3) ── */
.v2-vcal {
  padding: 12px 16px;
  border-top: 1px solid rgba(0,255,65,.08);
}

.v2-vcal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.v2-vcal-month {
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  color: var(--v2-g);
  letter-spacing: .15em;
}

.v2-vcal-nav {
  background: none;
  border: 1px solid rgba(0,255,65,.15);
  color: var(--v2-g);
  width: 28px;
  height: 28px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .2s;
}

.v2-vcal-nav:hover {
  background: rgba(0,255,65,.08);
}

.v2-vcal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
}

.v2-vcal-weekdays span {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  color: rgba(0,255,65,.4);
  text-align: center;
  letter-spacing: .1em;
}

.v2-vcal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.v2-vcal-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  color: var(--v2-txt);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background .15s, border-color .15s;
}

.v2-vcal-cell:hover:not(.v2-vcal-cell--past):not(.v2-vcal-cell--empty) {
  background: rgba(0,255,65,.08);
  border-color: rgba(0,255,65,.2);
}

.v2-vcal-cell--empty {
  cursor: default;
}

.v2-vcal-cell--past {
  color: rgba(237,248,237,.15);
  cursor: not-allowed;
}

.v2-vcal-cell--wknd {
  color: var(--v2-g);
}

.v2-vcal-cell--today {
  border-color: rgba(0,255,65,.3);
}

.v2-vcal-cell--selected {
  background: rgba(0,255,65,.2);
  border-color: var(--v2-g);
  color: var(--v2-g);
  font-weight: 700;
}

.v2-vcal-cell--selected.v2-vcal-cell--wknd {
  background: rgba(0,255,65,.3);
}

.v2-vcal-breakdown {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0 4px;
  flex-wrap: wrap;
}

.v2-vcal-bd-tag {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: var(--v2-g);
  background: rgba(0,255,65,.08);
  padding: 2px 8px;
  letter-spacing: .1em;
}

.v2-vcal-bd-tag--wknd {
  color: #F0C040;
  background: rgba(240,192,64,.1);
}

.v2-vcal-bd-total {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: var(--v2-txt);
  margin-left: auto;
  letter-spacing: .1em;
}

.v2-vcal-bd-empty {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: rgba(237,248,237,.3);
  letter-spacing: .08em;
}
```

- [ ] **Step 10: Verificar calendario per-venue funciona**

Abrir en el navegador y verificar:
- Al seleccionar un espacio, aparece el calendario mensual debajo
- Se puede navegar mes a mes y a años futuros sin límite
- Fechas pasadas están deshabilitadas
- Click en un día lo selecciona (verde), click de nuevo lo deselecciona
- El desglose LUN-JUE / VIE-SÁB se actualiza en tiempo real
- Botón "VER PRECOTIZACIÓN" solo se habilita con ≥ 1 día seleccionado en algún espacio
- Cada espacio tiene su propio calendario independiente

- [ ] **Step 11: Commit**

```bash
git add cotizador-munet/js/cotizador-munet.js cotizador-munet/css/cotizador-munet.css
git commit -m "Agregar calendario navegable por venue en Paso 3 con selección de días individuales"
```

---

### Task 3: Adaptar resumen (Paso 4), PDF y payload para fechas per-venue

**Files:**
- Modify: `cotizador-munet/js/cotizador-munet.js` — funciones `renderResumen()`, `collectFormData()`, `generarPDFDoc()`
- Modify: `cotizador-munet/index.html` — fila de FECHAS en resumen

**Interfaces:**
- Consumes: `selected{}` con `eventDays[]` per-venue, `getSpaceDaysBreakdown(sp)`, `formatFecha(val)`, `formatDayLabel(dateStr)`, `MONTH_NAMES[]`
- Produces: Resumen muestra fechas por espacio, PDF lista fechas por venue, payload sin `fechaInicio`/`fechaFin` globales

- [ ] **Step 1: Actualizar `renderResumen()` — fechas per-venue en vez de rango global**

Reemplazar la sección de fechas y días en `renderResumen()`:

```js
// ANTES (líneas 772-773, 791-810):
var fechaInicio = document.getElementById('v2FechaInicio').value;
var fechaFin    = document.getElementById('v2FechaFin').value;
// ...
var fechaStr = formatFecha(fechaInicio);
if (fechaFin && fechaFin !== fechaInicio) fechaStr += ' — ' + formatFecha(fechaFin);
document.getElementById('v2ResFechas').textContent = fechaStr || '—';
// ...
var diasStr = daysBreakdown.total + ' día' + ...

// DESPUÉS:
// Calcular fechas y días agregados de todos los venues
var allEventDays = [];
Object.keys(selected).forEach(function (id) {
  var days = selected[id].eventDays || [];
  days.forEach(function (d) {
    if (allEventDays.indexOf(d) < 0) allEventDays.push(d);
  });
});
allEventDays.sort();

// Mostrar fechas agrupadas por mes
var fechaStr = '';
if (allEventDays.length > 0) {
  var byMonth = {};
  allEventDays.forEach(function (d) {
    var parts = d.split('-');
    var key = MONTH_NAMES[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(parseInt(parts[2], 10));
  });
  var monthParts = [];
  Object.keys(byMonth).forEach(function (k) {
    monthParts.push(k + ': ' + byMonth[k].join(', '));
  });
  fechaStr = monthParts.join(' \u00B7 ');
}
document.getElementById('v2ResFechas').textContent = fechaStr || '\u2014';

// Días total agregado
var totalBd = calcDaysBreakdownForDates(allEventDays);
var diasStr = totalBd.total + ' d\u00EDa' + (totalBd.total > 1 ? 's' : '');
if (totalBd.regular > 0 && totalBd.weekend > 0) {
  diasStr += ' (' + totalBd.regular + ' LUN\u2013JUE + ' + totalBd.weekend + ' VIE\u2013S\u00C1B)';
} else if (totalBd.weekend > 0) {
  diasStr += ' (VIE\u2013S\u00C1B)';
} else if (totalBd.total > 0) {
  diasStr += ' (LUN\u2013JUE)';
}
document.getElementById('v2ResDias').textContent = diasStr;
```

También eliminar las líneas que leían `fechaInicio` y `fechaFin` del DOM (ya no existen esos inputs).

- [ ] **Step 2: Actualizar `collectFormData()` — quitar fechas globales**

```js
// ANTES (líneas 964-966, 971-973):
fechaInicio:  document.getElementById('v2FechaInicio').value,
fechaFin:     document.getElementById('v2FechaFin').value,
// ...
diasRegular:  daysBreakdown.regular,
diasWeekend:  daysBreakdown.weekend,
diasTotal:    daysBreakdown.total,

// DESPUÉS: calcular totales agregados
var allDaysForPayload = [];
ids.forEach(function (id) {
  var days = selected[id].eventDays || [];
  days.forEach(function (d) {
    if (allDaysForPayload.indexOf(d) < 0) allDaysForPayload.push(d);
  });
});
allDaysForPayload.sort();
var totalBdPayload = calcDaysBreakdownForDates(allDaysForPayload);

// En el return:
// Eliminar: fechaInicio, fechaFin
// Cambiar:
diasRegular:  totalBdPayload.regular,
diasWeekend:  totalBdPayload.weekend,
diasTotal:    totalBdPayload.total,
```

- [ ] **Step 3: Actualizar `generarPDFDoc()` — fechas per-venue en PDF**

En la sección del client box del PDF, reemplazar la parte de fechas (líneas 1136-1139):

```js
// ANTES:
var fechaDisplay = formatFecha(data.fechaInicio) || '—';
if (data.fechaFin && data.fechaFin !== data.fechaInicio) fechaDisplay += ' — ' + formatFecha(data.fechaFin);
doc.setFontSize(6); doc.setTextColor(0, 200, 50); doc.text('FECHAS EVENTO', labelX, cy);
doc.setFontSize(9); doc.setTextColor(237, 248, 237); doc.text(fechaDisplay, valX, cy); cy += 6;

// DESPUÉS:
// Construir lista de fechas agrupadas por mes
var allPdfDays = [];
data.espaciosArr.forEach(function (esp) {
  (esp.eventDays || []).forEach(function (d) {
    if (allPdfDays.indexOf(d) < 0) allPdfDays.push(d);
  });
});
allPdfDays.sort();

var fechaDisplay = '\u2014';
if (allPdfDays.length > 0) {
  var byMonth = {};
  allPdfDays.forEach(function (d) {
    var parts = d.split('-');
    var key = MONTH_NAMES[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(parseInt(parts[2], 10));
  });
  var monthParts = [];
  Object.keys(byMonth).forEach(function (k) {
    monthParts.push(k + ': ' + byMonth[k].join(', '));
  });
  fechaDisplay = monthParts.join(' \u00B7 ');
}

doc.setFontSize(6); doc.setTextColor(0, 200, 50); doc.text('FECHAS EVENTO', labelX, cy);
doc.setFontSize(9); doc.setTextColor(237, 248, 237);
// Truncar si es muy largo para caber en una línea
var fechaLines = doc.splitTextToSize(fechaDisplay, contentW - 45);
doc.text(fechaLines[0], valX, cy);
if (fechaLines.length > 1) { cy += 4; doc.text(fechaLines[1], valX, cy); }
cy += 6;
```

También actualizar el cálculo de `boxRows` para manejar que fechas puede ocupar 2 líneas:

```js
// Ajustar boxRows: agregar 1 si hay muchas fechas
var muchasFechas = allPdfDays.length > 10;
if (muchasFechas) boxRows++;
```

Y en la sección per-venue del PDF, agregar las fechas de cada espacio:

```js
// Después de espDiasLabel (línea ~1195), agregar las fechas del venue:
var espDates = (esp.eventDays || []).slice().sort();
if (espDates.length > 0 && espDates.length <= 10) {
  var espDateLabels = espDates.map(function (d) {
    return formatDayLabel(d);
  }).join(', ');
  doc.setFontSize(6); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  var espDateLines = doc.splitTextToSize(espDateLabels, contentW - 10);
  doc.text(espDateLines[0], margin + 5, y); y += 3.5;
  if (espDateLines.length > 1) { doc.text(espDateLines[1], margin + 5, y); y += 3.5; }
}
```

- [ ] **Step 4: Limpiar CSS del calendario del Paso 1 (si ya no se usa)**

Revisar en `cotizador-munet/css/cotizador-munet.css` si las clases `.v2-cal-field`, `.v2-cal-trigger`, `.v2-cal-popup`, `.v2-cal-header`, `.v2-cal-grid`, `.v2-cal-cell`, etc. aún se usan en algún otro lugar. Si no, eliminarlas para mantener el CSS limpio.

También eliminar estilos del mini-calendario viejo (`.v2-minical-*`) si ya no se usan.

- [ ] **Step 5: Verificar flujo completo**

Abrir en el navegador y hacer test end-to-end:
1. Paso 1: llenar datos de contacto (sin fechas) → CONTINUAR
2. Paso 2: seleccionar tipo, descripción, horario → CONTINUAR
3. Paso 3: seleccionar 2+ espacios, elegir días individuales en cada uno → VER PRECOTIZACIÓN
4. Paso 4: verificar que el resumen muestra fechas por espacio agrupadas por mes
5. Verificar que el desglose de días es correcto (regular/premium)
6. Enviar cotización → verificar que funciona
7. Descargar PDF → verificar que las fechas aparecen correctamente por venue

- [ ] **Step 6: Commit**

```bash
git add cotizador-munet/js/cotizador-munet.js cotizador-munet/css/cotizador-munet.css cotizador-munet/index.html
git commit -m "Adaptar resumen, PDF y payload para fechas per-venue"
```
