# Calendario para Cotizador MUNET — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los inputs de fecha y checkboxes de días por calendarios visuales en el cotizador MUNET.

**Architecture:** Dos componentes vanilla JS/CSS: (1) calendario popup en paso 1 para selección de rango de fechas, (2) mini-calendario inline por venue en paso 3 para toggle de días individuales. Ambos comparten funciones utilitarias de calendario. Sin dependencias externas.

**Tech Stack:** HTML, CSS, vanilla JS (ES5, consistente con el código existente).

## Global Constraints

- Sin build tools, sin librerías externas — todo vanilla.
- CSS: cero `!important`, usar design tokens de `:root`.
- JS: ES5 style (var, function, no arrow functions) — consistente con el código existente.
- Texto en español.
- Tipografía: `Space Mono` para números/fechas, `Rajdhani` para labels.
- Colores: `--v2-g` (#00FF41) para entre semana, `--v2-go` (#D4AF37) para fin de semana.

---

### Task 1: CSS — Estilos del calendario popup y mini-calendario

**Files:**
- Modify: `cotizador-munet/css/cotizador-munet.css:360-445` (reemplazar estilos de day picker)

**Interfaces:**
- Produces: Clases CSS `.v2-cal-trigger`, `.v2-cal-popup`, `.v2-cal-grid`, `.v2-cal-cell`, `.v2-minical-*` que Tasks 2 y 3 consumen.

- [ ] **Step 1: Eliminar estilos del day picker viejo**

Eliminar todo desde `/* ── DAY PICKER (per-venue) ── */` (línea 360) hasta `/* ── PASO 4 — RESUMEN ── */` (línea 447), incluyendo:
- `.v2-days-picker-wrap`, `.v2-days-picker`
- `.v2-day-check` y todas sus variantes
- `.v2-days-quick`, `.v2-days-qbtn`
- `.v2-days-summary`, `.v2-days-summary-text`
- `.v2-days-toggle`, `.v2-days-picker--collapsed`

También eliminar la referencia mobile en línea 555: `.v2-day-check{flex:1 0 100%;min-width:0}`

- [ ] **Step 2: Agregar estilos del calendario popup (paso 1)**

Insertar antes de `/* ── PASO 4 — RESUMEN ── */`:

```css
/* ── CALENDAR POPUP (paso 1) ── */
.v2-cal-field{position:relative}
.v2-cal-trigger{
  display:flex;align-items:center;justify-content:space-between;
  width:100%;padding:10px 14px;
  background:rgba(5,9,5,.6);border:1px solid var(--v2-bd);
  color:var(--v2-wh);font-family:'Rajdhani',sans-serif;font-weight:600;font-size:16px;
  letter-spacing:.04em;cursor:pointer;transition:all .2s;
}
.v2-cal-trigger:hover{border-color:rgba(0,255,65,.4)}
.v2-cal-trigger--active{border-color:rgba(0,255,65,.4);background:rgba(0,255,65,.05)}
.v2-cal-trigger-placeholder{
  color:rgba(200,236,200,.25);font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.08em;
}
.v2-cal-trigger-arrow{
  font-size:10px;color:var(--v2-g);transition:transform .2s;
}
.v2-cal-trigger--active .v2-cal-trigger-arrow{transform:rotate(180deg)}

.v2-cal-popup{
  display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:100;
  background:rgba(5,9,5,.97);border:1px solid var(--v2-bd);
  padding:16px;
  box-shadow:0 12px 40px rgba(0,0,0,.6);
}
.v2-cal-popup--open{display:block}

.v2-cal-header{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:12px;
}
.v2-cal-nav{
  background:none;border:1px solid var(--v2-bd);color:var(--v2-g);
  width:28px;height:28px;font-size:14px;cursor:pointer;transition:all .15s;
  display:flex;align-items:center;justify-content:center;
}
.v2-cal-nav:hover{border-color:var(--v2-g);background:rgba(0,255,65,.08)}
.v2-cal-month{
  font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.15em;
  color:var(--v2-g);text-transform:uppercase;
}

.v2-cal-weekdays{
  display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;
}
.v2-cal-weekday{
  text-align:center;padding:4px 0;
  font-family:'Space Mono',monospace;font-size:8px;letter-spacing:.15em;
  color:rgba(200,236,200,.3);
}
.v2-cal-weekday:nth-child(5){color:rgba(212,175,55,.4)}
.v2-cal-weekday:nth-child(6){color:rgba(212,175,55,.4)}

.v2-cal-grid{
  display:grid;grid-template-columns:repeat(7,1fr);gap:2px;
}
.v2-cal-cell{
  aspect-ratio:1;display:flex;align-items:center;justify-content:center;
  font-family:'Space Mono',monospace;font-size:12px;
  color:var(--v2-wh);cursor:pointer;transition:all .15s;
  border:1px solid transparent;position:relative;
}
.v2-cal-cell:hover{border-color:rgba(0,255,65,.3);background:rgba(0,255,65,.06)}
.v2-cal-cell--empty{cursor:default}
.v2-cal-cell--empty:hover{border-color:transparent;background:none}
.v2-cal-cell--wknd{color:var(--v2-go)}
.v2-cal-cell--today{border-color:rgba(0,255,65,.2)}
.v2-cal-cell--start,.v2-cal-cell--end{
  background:var(--v2-g);color:var(--v2-bk);font-weight:700;
}
.v2-cal-cell--start.v2-cal-cell--wknd,.v2-cal-cell--end.v2-cal-cell--wknd{
  background:var(--v2-go);color:var(--v2-bk);
}
.v2-cal-cell--range{background:rgba(0,255,65,.1)}
.v2-cal-cell--range.v2-cal-cell--wknd{background:rgba(212,175,55,.1)}
.v2-cal-cell--past{opacity:.25;pointer-events:none}
```

- [ ] **Step 3: Agregar estilos del mini-calendario por venue (paso 3)**

Insertar justo después de los estilos del popup:

```css
/* ── MINI-CALENDAR (per-venue, paso 3) ── */
.v2-minical-wrap{
  flex-direction:column;align-items:stretch;
}
.v2-space-card.selected .v2-minical-wrap{display:flex}
.v2-minical-weekdays{
  display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px;
}
.v2-minical-weekday{
  text-align:center;padding:2px 0;
  font-family:'Space Mono',monospace;font-size:7px;letter-spacing:.12em;
  color:rgba(200,236,200,.3);
}
.v2-minical-weekday:nth-child(5){color:rgba(212,175,55,.3)}
.v2-minical-weekday:nth-child(6){color:rgba(212,175,55,.3)}
.v2-minical-grid{
  display:grid;grid-template-columns:repeat(7,1fr);gap:2px;
}
.v2-minical-cell{
  aspect-ratio:1;max-width:36px;display:flex;align-items:center;justify-content:center;
  font-family:'Space Mono',monospace;font-size:10px;
  color:rgba(200,236,200,.25);cursor:pointer;transition:all .15s;
  border:1px solid rgba(0,255,65,.08);
}
.v2-minical-cell:hover{border-color:rgba(0,255,65,.3)}
.v2-minical-cell--empty{cursor:default;border-color:transparent}
.v2-minical-cell--empty:hover{border-color:transparent}
.v2-minical-cell--active{
  background:var(--v2-g);color:var(--v2-bk);font-weight:700;
  border-color:var(--v2-g);
}
.v2-minical-cell--active.v2-minical-cell--wknd{
  background:var(--v2-go);color:var(--v2-bk);
  border-color:var(--v2-go);
}
.v2-minical-cell--wknd{border-color:rgba(212,175,55,.08)}
.v2-minical-cell--wknd:hover{border-color:rgba(212,175,55,.3)}
.v2-minical-cell--last{opacity:.5;cursor:not-allowed}
.v2-minical-cell--last:hover{border-color:rgba(0,255,65,.08)}
```

- [ ] **Step 4: Verificar visualmente**

Abrir `cotizador-munet/index.html` en navegador. Verificar que no hay errores de CSS, que el paso 1 y paso 3 cargan sin romperse. Los calendarios aún no se renderizan (eso es JS en Tasks 2-3).

- [ ] **Step 5: Commit**

```bash
git add cotizador-munet/css/cotizador-munet.css
git commit -m "Agregar estilos de calendario popup y mini-calendario, eliminar day picker viejo"
```

---

### Task 2: Calendario popup — HTML y JS (Paso 1)

**Files:**
- Modify: `cotizador-munet/index.html:75-84` (reemplazar inputs de fecha)
- Modify: `cotizador-munet/js/cotizador-munet.js` (agregar funciones de calendario, modificar init)

**Interfaces:**
- Consumes: Design tokens CSS de Task 1 (`.v2-cal-*` classes).
- Produces: `v2FechaInicio` y `v2FechaFin` siguen siendo hidden inputs con valores YYYY-MM-DD que el resto del sistema consume. Función `openCalPopup()`, `closeCalPopup()`, `renderCalPopup()`.

- [ ] **Step 1: Reemplazar HTML de inputs de fecha**

En `cotizador-munet/index.html`, reemplazar el bloque de líneas 75-84:

```html
<!-- Viejo -->
<div class="v2-field-row">
  <div class="v2-field">
    <label class="v2-field-label" for="v2FechaInicio">FECHA INICIO</label>
    <input type="date" class="v2-field-input" id="v2FechaInicio">
  </div>
  <div class="v2-field">
    <label class="v2-field-label" for="v2FechaFin">FECHA FIN</label>
    <input type="date" class="v2-field-input" id="v2FechaFin">
  </div>
</div>
```

Reemplazar por:

```html
<div class="v2-field">
  <label class="v2-field-label">FECHAS DEL EVENTO</label>
  <div class="v2-cal-field" id="v2CalField">
    <button type="button" class="v2-cal-trigger" id="v2CalTrigger">
      <span class="v2-cal-trigger-placeholder" id="v2CalDisplay">SELECCIONAR FECHAS</span>
      <span class="v2-cal-trigger-arrow">&#9660;</span>
    </button>
    <div class="v2-cal-popup" id="v2CalPopup">
      <div class="v2-cal-header">
        <button type="button" class="v2-cal-nav" id="v2CalPrev">&#8249;</button>
        <span class="v2-cal-month" id="v2CalMonth"></span>
        <button type="button" class="v2-cal-nav" id="v2CalNext">&#8250;</button>
      </div>
      <div class="v2-cal-weekdays">
        <span class="v2-cal-weekday">LUN</span>
        <span class="v2-cal-weekday">MAR</span>
        <span class="v2-cal-weekday">MIÉ</span>
        <span class="v2-cal-weekday">JUE</span>
        <span class="v2-cal-weekday">VIE</span>
        <span class="v2-cal-weekday">SÁB</span>
        <span class="v2-cal-weekday">DOM</span>
      </div>
      <div class="v2-cal-grid" id="v2CalGrid"></div>
    </div>
    <input type="hidden" id="v2FechaInicio">
    <input type="hidden" id="v2FechaFin">
  </div>
</div>
```

- [ ] **Step 2: Agregar estado y utilidades del calendario popup en JS**

En `cotizador-munet/js/cotizador-munet.js`, después del bloque `/* ── ESTADO ── */` (después de `var daysBreakdown = ...;`, línea ~75), agregar:

```javascript
  /* ── ESTADO CALENDARIO ── */
  var calViewMonth = new Date().getMonth();  // mes visible en el popup
  var calViewYear  = new Date().getFullYear();
  var calSelectState = 0; // 0=nada, 1=inicio seleccionado, esperando fin
```

- [ ] **Step 3: Agregar función renderCalPopup()**

Después de `renderDatesBreakdown()` (y antes de `/* ── WIZARD — Gestión de pasos ── */`), agregar:

```javascript
  /* ── CALENDARIO POPUP (Paso 1) ── */
  function renderCalPopup() {
    var grid = document.getElementById('v2CalGrid');
    if (!grid) return;

    var monthLabel = document.getElementById('v2CalMonth');
    monthLabel.textContent = MONTH_NAMES[calViewMonth] + ' ' + calViewYear;

    // Primer día del mes (lun=0 ... dom=6, ajustado de JS donde dom=0)
    var firstDay = new Date(calViewYear, calViewMonth, 1);
    var startDow = (firstDay.getDay() + 6) % 7; // lun=0, mar=1, ..., dom=6
    var daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var selStart = document.getElementById('v2FechaInicio').value;
    var selEnd   = document.getElementById('v2FechaFin').value;

    var html = '';

    // Celdas vacías antes del día 1
    for (var e = 0; e < startDow; e++) {
      html += '<div class="v2-cal-cell v2-cal-cell--empty"></div>';
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var dateObj = new Date(calViewYear, calViewMonth, d);
      var yyyy = dateObj.getFullYear();
      var mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      var dd = String(d).padStart(2, '0');
      var dateStr = yyyy + '-' + mm + '-' + dd;

      var dow = (dateObj.getDay() + 6) % 7;
      var isWknd = dow === 4 || dow === 5; // vie=4, sáb=5 en lun-based
      var isPast = dateObj < today;

      var cls = 'v2-cal-cell';
      if (isWknd) cls += ' v2-cal-cell--wknd';
      if (isPast) cls += ' v2-cal-cell--past';
      if (dateStr === selStart) cls += ' v2-cal-cell--start';
      if (dateStr === selEnd) cls += ' v2-cal-cell--end';
      if (selStart && selEnd && dateStr > selStart && dateStr < selEnd) cls += ' v2-cal-cell--range';
      if (dateStr === new Date().toISOString().slice(0, 10)) cls += ' v2-cal-cell--today';

      html += '<div class="' + cls + '" data-date="' + dateStr + '">' + d + '</div>';
    }

    grid.innerHTML = html;

    // Event listeners
    grid.querySelectorAll('.v2-cal-cell:not(.v2-cal-cell--empty):not(.v2-cal-cell--past)').forEach(function (cell) {
      cell.addEventListener('click', function () {
        handleCalClick(cell.getAttribute('data-date'));
      });
    });
  }

  function handleCalClick(dateStr) {
    var startInput = document.getElementById('v2FechaInicio');
    var endInput   = document.getElementById('v2FechaFin');

    if (calSelectState === 0) {
      // Primer click: establecer inicio
      startInput.value = dateStr;
      endInput.value = '';
      calSelectState = 1;
      renderCalPopup();
      updateCalDisplay();
      validateStep1();
    } else {
      // Segundo click: establecer fin
      var start = startInput.value;
      if (dateStr < start) {
        endInput.value = start;
        startInput.value = dateStr;
      } else if (dateStr === start) {
        // Mismo día = evento de 1 día
        endInput.value = dateStr;
      } else {
        endInput.value = dateStr;
      }
      calSelectState = 0;
      renderCalPopup();
      updateCalDisplay();
      closeCalPopup();
      validateStep1();
    }
  }

  function updateCalDisplay() {
    var display = document.getElementById('v2CalDisplay');
    var start = document.getElementById('v2FechaInicio').value;
    var end   = document.getElementById('v2FechaFin').value;

    if (!start) {
      display.textContent = 'SELECCIONAR FECHAS';
      display.className = 'v2-cal-trigger-placeholder';
      return;
    }

    var startLabel = formatDayLabel(start);
    display.className = '';
    display.style.color = 'var(--v2-g)';
    display.style.fontFamily = "'Space Mono',monospace";
    display.style.fontSize = '12px';
    display.style.letterSpacing = '.1em';

    if (end && end !== start) {
      display.textContent = startLabel + '  \u2014  ' + formatDayLabel(end);
    } else if (end && end === start) {
      display.textContent = startLabel + '  (1 D\u00CDA)';
    } else {
      display.textContent = startLabel + '  \u2014  SELECCIONA FIN';
    }
  }

  function openCalPopup() {
    document.getElementById('v2CalPopup').classList.add('v2-cal-popup--open');
    document.getElementById('v2CalTrigger').classList.add('v2-cal-trigger--active');

    // Si ya hay fecha seleccionada, navegar a ese mes
    var start = document.getElementById('v2FechaInicio').value;
    if (start) {
      var d = new Date(start + 'T12:00:00');
      calViewMonth = d.getMonth();
      calViewYear = d.getFullYear();
    }

    renderCalPopup();
  }

  function closeCalPopup() {
    document.getElementById('v2CalPopup').classList.remove('v2-cal-popup--open');
    document.getElementById('v2CalTrigger').classList.remove('v2-cal-trigger--active');
  }
```

- [ ] **Step 4: Actualizar DOMContentLoaded para el calendario**

En el bloque `DOMContentLoaded`:

**4a.** En el array de IDs para validación (línea ~1190), quitar `'v2FechaInicio', 'v2FechaFin'` del array (ya no son inputs visibles, se validan en `handleCalClick`). Quedaría:

```javascript
['v2Cliente', 'v2Agencia', 'v2Evento', 'v2Contacto', 'v2Telefono', 'v2Correo', 'v2Asistentes'].forEach(function (id) {
```

**4b.** Eliminar el bloque de `v2FechaFin` change listener (líneas ~1195-1198):

```javascript
// ELIMINAR ESTE BLOQUE:
document.getElementById('v2FechaFin').addEventListener('change', function () {
  var inicio = document.getElementById('v2FechaInicio').value;
  if (inicio && this.value && this.value < inicio) this.value = inicio;
});
```

**4c.** Agregar event listeners del calendario popup, después del bloque de Next buttons:

```javascript
    // Calendario popup
    document.getElementById('v2CalTrigger').addEventListener('click', function (e) {
      e.stopPropagation();
      var popup = document.getElementById('v2CalPopup');
      if (popup.classList.contains('v2-cal-popup--open')) {
        closeCalPopup();
      } else {
        openCalPopup();
      }
    });

    document.getElementById('v2CalPrev').addEventListener('click', function (e) {
      e.stopPropagation();
      calViewMonth--;
      if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
      renderCalPopup();
    });

    document.getElementById('v2CalNext').addEventListener('click', function (e) {
      e.stopPropagation();
      calViewMonth++;
      if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
      renderCalPopup();
    });

    // Cerrar popup al hacer click fuera
    document.addEventListener('click', function (e) {
      var calField = document.getElementById('v2CalField');
      if (calField && !calField.contains(e.target)) {
        closeCalPopup();
      }
    });
```

- [ ] **Step 5: Verificar funcionamiento**

Abrir en navegador. Probar:
1. Click en "SELECCIONAR FECHAS" abre popup.
2. Navegar meses con flechas `<` `>`.
3. Click en un día muestra "LUN 28 JUL — SELECCIONA FIN".
4. Click en segundo día cierra popup, muestra rango "LUN 28 JUL — MAR 05 AGO".
5. El botón CONTINUAR se habilita cuando hay rango.
6. Click fuera cierra popup.

- [ ] **Step 6: Commit**

```bash
git add cotizador-munet/index.html cotizador-munet/js/cotizador-munet.js
git commit -m "Implementar calendario popup para selección de rango de fechas (paso 1)"
```

---

### Task 3: Mini-calendario por venue (Paso 3)

**Files:**
- Modify: `cotizador-munet/js/cotizador-munet.js` — función `buildCards()` (~línea 377-447) y event listeners (~línea 550-583)

**Interfaces:**
- Consumes: `.v2-minical-*` clases CSS de Task 1. `getEventDates()`, `isWeekendDate()`, `toggleSpaceDay()`, `selected[spaceId].eventDays`.
- Produces: Misma funcionalidad que antes (toggle días por venue) con UI de calendario.

- [ ] **Step 1: Reemplazar generación de daysPickerHTML en buildCards()**

En `buildCards()`, reemplazar todo el bloque que genera `daysPickerHTML` (desde `// Build selector de días por venue` hasta el cierre `daysPickerHTML += '</div></div>';`). El bloque actual (~línea 377-447) se reemplaza por:

```javascript
      // Build mini-calendario por venue
      var daysPickerHTML = '';
      if (isSel) {
        var allDates = getEventDates();
        var spaceDays = selected[sp.id].eventDays || [];

        if (allDates.length > 0) {
          // Calcular semanas que cubren el rango
          var firstDate = new Date(allDates[0] + 'T12:00:00');
          var lastDate  = new Date(allDates[allDates.length - 1] + 'T12:00:00');

          // Retroceder al lunes de la semana del primer día
          var startMon = new Date(firstDate);
          var startDow = (startMon.getDay() + 6) % 7; // lun=0
          startMon.setDate(startMon.getDate() - startDow);

          // Avanzar al domingo de la semana del último día
          var endSun = new Date(lastDate);
          var endDow = (endSun.getDay() + 6) % 7;
          endSun.setDate(endSun.getDate() + (6 - endDow));

          var selectedCount = spaceDays.length;
          var totalCount = allDates.length;

          daysPickerHTML += '<div class="v2-sc-montaje v2-minical-wrap">' +
            '<div class="v2-montaje-label" style="width:100%;margin-bottom:6px;">' +
              'D\u00CDAS DEL EVENTO \u00B7 ' + selectedCount + ' DE ' + totalCount + ' SELECCIONADOS' +
            '</div>' +
            '<div class="v2-minical-weekdays">' +
              '<span class="v2-minical-weekday">L</span>' +
              '<span class="v2-minical-weekday">M</span>' +
              '<span class="v2-minical-weekday">M</span>' +
              '<span class="v2-minical-weekday">J</span>' +
              '<span class="v2-minical-weekday">V</span>' +
              '<span class="v2-minical-weekday">S</span>' +
              '<span class="v2-minical-weekday">D</span>' +
            '</div>' +
            '<div class="v2-minical-grid">';

          // Iterar día por día desde startMon hasta endSun
          var cursor = new Date(startMon);
          while (cursor <= endSun) {
            var cy = cursor.getFullYear();
            var cm = String(cursor.getMonth() + 1).padStart(2, '0');
            var cd = String(cursor.getDate()).padStart(2, '0');
            var curDateStr = cy + '-' + cm + '-' + cd;
            var inRange = allDates.indexOf(curDateStr) >= 0;
            var isActive = spaceDays.indexOf(curDateStr) >= 0;
            var isWknd = isWeekendDate(curDateStr);
            var isLast = isActive && spaceDays.length <= 1;

            if (!inRange) {
              daysPickerHTML += '<div class="v2-minical-cell v2-minical-cell--empty"></div>';
            } else {
              var mcCls = 'v2-minical-cell';
              if (isWknd) mcCls += ' v2-minical-cell--wknd';
              if (isActive) mcCls += ' v2-minical-cell--active';
              if (isLast) mcCls += ' v2-minical-cell--last';
              daysPickerHTML += '<div class="' + mcCls + '" data-space="' + sp.id + '" data-date="' + curDateStr + '">' + cursor.getDate() + '</div>';
            }

            cursor.setDate(cursor.getDate() + 1);
          }

          daysPickerHTML += '</div></div>';
        }
      }
```

- [ ] **Step 2: Reemplazar event listeners del day picker**

En `buildCards()`, eliminar estos tres bloques de event listeners:

1. `grid.querySelectorAll('.v2-day-check')` (~línea 553-561)
2. `grid.querySelectorAll('.v2-days-qbtn')` (~línea 563-571)
3. `grid.querySelectorAll('.v2-days-toggle')` (~línea 573-583)

Reemplazar por un solo bloque:

```javascript
    // Mini-calendar day clicks
    grid.querySelectorAll('.v2-minical-cell:not(.v2-minical-cell--empty):not(.v2-minical-cell--last)').forEach(function (cell) {
      cell.addEventListener('click', function (e) {
        e.stopPropagation();
        var spaceId = cell.getAttribute('data-space');
        var dateStr = cell.getAttribute('data-date');
        toggleSpaceDay(spaceId, dateStr);
      });
    });
```

- [ ] **Step 3: Eliminar función quickSelectDays()**

Eliminar la función `quickSelectDays()` completa (~líneas 626-650). Ya no se usa.

- [ ] **Step 4: Limpiar daysExpanded del estado**

En `toggleSpace()`, el estado ya no incluye `daysExpanded` (ya se eliminó en un commit anterior). Verificar que no queden referencias a `daysExpanded` en el código:

```bash
grep -n "daysExpanded" cotizador-munet/js/cotizador-munet.js
```

Si hay alguna referencia restante, eliminarla.

- [ ] **Step 5: Verificar funcionamiento**

Abrir en navegador. Probar:
1. Seleccionar rango 28 jul — 5 ago en calendario popup.
2. Ir a paso 3, seleccionar un venue.
3. Verificar que aparece mini-calendario con solo las semanas del rango.
4. Click en un día activo lo desactiva (se apaga).
5. No se puede desactivar el último día (tiene clase `--last`, no responde a click).
6. El desglose de tarifas se actualiza al cambiar días.
7. El total recalcula correctamente.

- [ ] **Step 6: Commit**

```bash
git add cotizador-munet/js/cotizador-munet.js
git commit -m "Implementar mini-calendario por venue en paso 3, eliminar checkboxes y botones rápidos"
```

---

### Task 4: Limpieza y verificación final

**Files:**
- Modify: `cotizador-munet/css/cotizador-munet.css` (responsive)
- Modify: `cotizador-munet/js/cotizador-munet.js` (edge cases)

**Interfaces:**
- Consumes: Todo lo producido en Tasks 1-3.

- [ ] **Step 1: Responsive — mobile breakpoint**

En la sección `@media (max-width:600px)` del CSS (~línea 540+), reemplazar la línea `.v2-day-check{flex:1 0 100%;min-width:0}` (si aún existe) por:

```css
  .v2-cal-popup{position:fixed;top:auto;bottom:0;left:0;right:0;
    border-radius:12px 12px 0 0;max-height:70vh;overflow-y:auto;
  }
  .v2-minical-cell{font-size:9px}
```

Esto convierte el popup en un bottom sheet en móvil.

- [ ] **Step 2: Edge case — reseteo al cambiar fechas**

Verificar que cuando el usuario reabre el paso 1 y cambia las fechas, los venues seleccionados sincronizan sus días correctamente. La función `syncEventDays()` ya se llama en `goToStep(3)`, así que esto debería funcionar. Probar:

1. Seleccionar rango 28 jul — 2 ago.
2. Seleccionar venues, quitar algunos días.
3. Volver al paso 1, cambiar a 29 jul — 3 ago.
4. Ir al paso 3: verificar que los días se actualizaron.

- [ ] **Step 3: Edge case — evento de 1 solo día**

Probar:
1. Click en un día en el popup.
2. Click en el mismo día como segundo click.
3. Popup se cierra, muestra "LUN 28 JUL (1 DÍA)".
4. En paso 3, el mini-calendario solo muestra 1 celda activa.
5. No se puede desactivar ese día.

- [ ] **Step 4: Verificar PDF y resumen**

1. Completar una cotización completa hasta paso 4.
2. Verificar que el resumen muestra las fechas correctamente.
3. Enviar y descargar PDF.
4. Verificar que el PDF tiene las fechas y desglose correcto.

- [ ] **Step 5: Commit final**

```bash
git add cotizador-munet/css/cotizador-munet.css cotizador-munet/js/cotizador-munet.js
git commit -m "Responsive y verificación final de calendarios"
```
