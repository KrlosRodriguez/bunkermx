# Migración Cotizador MNT+BNK al Panel Firebase — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al panel Firebase (`bunker-panel.web.app`) la capacidad de crear cotizaciones MNT (venues) y BNK (servicios/producción), con tarifas editables, autocompletado de clientes/catálogo, y generación de PDF en dos estilos (Neon y Corporativa).

**Architecture:** Dos tabs nuevos en el dashboard existente (COTIZAR MNT, COTIZAR BNK). La lógica vive en módulos JS separados (`cotizar-mnt.js`, `cotizar-bnk.js`). Los datos se guardan en Firestore via `BNK_DB`. PDFs se generan client-side con jsPDF. Las tarifas de venues se leen de la colección `catalogo` con categoría "Venues".

**Tech Stack:** HTML/CSS/JS vanilla, jsPDF 2.5.1 (CDN), Firebase Firestore (compat mode), IIFEs en `panel/js/pages/`.

## Global Constraints

- Idioma de UI: español
- Sin build tools, sin npm, sin bundler — editar archivos fuente directamente
- CSS: sin `!important`, usar custom properties de `:root` en `panel/css/panel.css`
- No tocar `cotizador-munet/` — simulador público independiente
- `BNK_DB` ya tiene métodos `.create()`, `.list()`, `.update()` para todas las colecciones
- jsPDF 2.5.1 desde CDN: `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`
- Logos: `BUNKER_LOGO_B64` desde `logo-data.js` (copiar al panel)
- Folios: `MNT-AAMMDD-XXXX` y `BNK-AAMMDD-XXXX` (4 dígitos aleatorios)
- Colores Neon: fondo `#050905`, acento `#00FF41`
- Colores Corporativa: fondo `#FFFFFF`, texto `#333333`, acento dorado `#C6A350`, header terra `#2C2419`
- Firebase project: `bunker-panel`

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `panel/dashboard.html` | Tabs, secciones HTML del wizard MNT y formulario BNK, carga de scripts | Modificar |
| `panel/css/panel.css` | Estilos del wizard, calendarios, cards venues, formulario BNK, toggle PDF | Modificar |
| `panel/js/pages/cotizar-mnt.js` | Wizard MNT: 4 pasos, calendarios, cálculos tarifas, generación PDF | Crear |
| `panel/js/pages/cotizar-bnk.js` | Formulario BNK: conceptos, autocompletado, cálculos, generación PDF | Crear |
| `panel/js/pages/catalogo.js` | Campos precioWeekend/precioMontaje cuando categoría=Venues | Modificar |
| `panel/js/logo-data.js` | Logo BUNKER en base64 para embeber en PDFs | Copiar desde cotizador-munet |

---

### Task 1: Setup — Logo, jsPDF, tabs y secciones vacías en dashboard

Preparar la infraestructura: copiar logo, agregar CDN de jsPDF, agregar los 2 tabs nuevos y sus secciones HTML vacías.

**Files:**
- Copy: `cotizador-munet/js/logo-data.js` → `panel/js/logo-data.js`
- Modify: `panel/dashboard.html`

**Interfaces:**
- Consumes: Nada
- Produces: Tabs "COTIZAR MNT" y "COTIZAR BNK" visibles en el nav, secciones `sec-cotizar-mnt` y `sec-cotizar-bnk` presentes en el DOM, `BUNKER_LOGO_B64` disponible globalmente, `jspdf` disponible globalmente

- [ ] **Step 1: Copiar logo-data.js al panel**

Copiar `cotizador-munet/js/logo-data.js` a `panel/js/logo-data.js`.

- [ ] **Step 2: Agregar jsPDF CDN y logo-data al head de dashboard.html**

En `panel/dashboard.html`, después de la línea `<script src="js/firestore.js"></script>` (línea 18), agregar:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" defer></script>
<script src="js/logo-data.js" defer></script>
```

- [ ] **Step 3: Agregar tabs COTIZAR MNT y COTIZAR BNK al nav**

En `panel/dashboard.html`, en la sección `<nav class="panel-tabs">`, agregar después del tab COTIZACIONES (línea 37) y antes de PIPELINE:

```html
  <button class="dash-tab" data-tab="cotizar-mnt" data-require-role="admin,ventas">COTIZAR MNT</button>
  <button class="dash-tab" data-tab="cotizar-bnk" data-require-role="admin,ventas">COTIZAR BNK</button>
```

- [ ] **Step 4: Agregar sección vacía COTIZAR MNT en el main**

En `panel/dashboard.html`, después del cierre de `sec-cotizaciones` (después de `</section>` de cotizaciones, antes de `sec-pipeline`), agregar:

```html
  <!-- ══════════════════════════════════════════════ -->
  <!-- COTIZAR MNT -->
  <!-- ══════════════════════════════════════════════ -->
  <section id="sec-cotizar-mnt" class="panel-section">
    <div id="mntWizardContainer"></div>
  </section>
```

- [ ] **Step 5: Agregar sección vacía COTIZAR BNK en el main**

Justo después de sec-cotizar-mnt:

```html
  <!-- ══════════════════════════════════════════════ -->
  <!-- COTIZAR BNK -->
  <!-- ══════════════════════════════════════════════ -->
  <section id="sec-cotizar-bnk" class="panel-section">
    <div id="bnkFormContainer"></div>
  </section>
```

- [ ] **Step 6: Agregar scripts de los nuevos módulos al final del body**

En `panel/dashboard.html`, después de la línea `<script src="js/pages/eventos.js"></script>` (línea 714), agregar:

```html
<script src="js/pages/cotizar-mnt.js"></script>
<script src="js/pages/cotizar-bnk.js"></script>
```

- [ ] **Step 7: Commit**

```bash
git add panel/js/logo-data.js panel/dashboard.html
git commit -m "feat(panel): setup tabs COTIZAR MNT/BNK, jsPDF CDN, logo-data"
```

---

### Task 2: Catálogo — Campos Venues (precioWeekend, precioMontaje)

Modificar el modal de catálogo para mostrar campos adicionales cuando la categoría es "Venues". Agregar "Venues" al select de categorías en dashboard.html.

**Files:**
- Modify: `panel/dashboard.html` (modal catálogo)
- Modify: `panel/js/pages/catalogo.js`

**Interfaces:**
- Consumes: `BNK_DB.catalogo.create()`, `BNK_DB.catalogo.update()` de `firestore.js`
- Produces: Documentos en colección `catalogo` con campos `precioWeekend` y `precioMontaje` cuando categoría es "Venues". Función `window.BNKCatalogo.load()` actualizada.

- [ ] **Step 1: Agregar "Venues" al select de categorías en dashboard.html**

En `panel/dashboard.html`, en el select `catCategoria` (dentro del modal catálogo), agregar la opción:

```html
<option value="Venues">Venues</option>
```

Ponerla después de `<option value="Venue">Venue</option>`. Eliminar la opción "Venue" vieja (renombrar a Venues).

- [ ] **Step 2: Agregar campos condicionales al modal de catálogo en dashboard.html**

En `panel/dashboard.html`, dentro del modal catálogo, después del form-group de PRECIO y antes del cierre del `bnk-form-grid`, agregar:

```html
            <div class="bnk-form-group" id="catWeekendGroup" style="display:none">
              <label class="bnk-label">PRECIO WEEKEND</label>
              <input type="number" class="bnk-input" id="catPrecioWeekend" placeholder="0" min="0" step="0.01">
            </div>
            <div class="bnk-form-group" id="catMontajeGroup" style="display:none">
              <label class="bnk-label">PRECIO MONTAJE</label>
              <input type="number" class="bnk-input" id="catPrecioMontaje" placeholder="0" min="0" step="0.01">
            </div>
```

- [ ] **Step 3: Agregar lógica de campos condicionales en catalogo.js**

En `panel/js/pages/catalogo.js`, en la función `_bindEvents()`, después de la línea `document.getElementById('catGuardar').addEventListener('click', _save);` (línea 72), agregar:

```javascript
    document.getElementById('catCategoria').addEventListener('change', _toggleVenueFields);
```

Agregar la función `_toggleVenueFields` antes de `_openModal`:

```javascript
  function _toggleVenueFields() {
    var isVenues = document.getElementById('catCategoria').value === 'Venues';
    document.getElementById('catWeekendGroup').style.display = isVenues ? '' : 'none';
    document.getElementById('catMontajeGroup').style.display = isVenues ? '' : 'none';
  }
```

- [ ] **Step 4: Actualizar _openModal para manejar campos Venues**

En `panel/js/pages/catalogo.js`, en la función `_openModal`, después de `document.getElementById('catPrecio').value = '';` (línea 96), agregar:

```javascript
    document.getElementById('catPrecioWeekend').value = '';
    document.getElementById('catPrecioMontaje').value = '';
```

Y dentro del bloque `if (modo === 'editar' && item)`, después de la línea que setea catPrecio (línea 104), agregar:

```javascript
      document.getElementById('catPrecioWeekend').value = item.precioWeekend || '';
      document.getElementById('catPrecioMontaje').value = item.precioMontaje || '';
```

Al final de `_openModal`, antes de abrir el overlay, agregar:

```javascript
    _toggleVenueFields();
```

- [ ] **Step 5: Actualizar _save para incluir campos Venues**

En `panel/js/pages/catalogo.js`, en la función `_save`, después de la línea `var precio = parseFloat(...)` (línea 120), agregar:

```javascript
    var precioWeekend = parseFloat(document.getElementById('catPrecioWeekend').value) || 0;
    var precioMontaje = parseFloat(document.getElementById('catPrecioMontaje').value) || 0;
```

En el objeto `data` (línea 131), agregar los campos:

```javascript
    var data = { categoria: categoria, concepto: concepto, unidad: unidad, precio: precio, activo: true };
    if (categoria === 'Venues') {
      data.precioWeekend = precioWeekend;
      data.precioMontaje = precioMontaje;
    }
```

- [ ] **Step 6: Actualizar _render para mostrar precios Venues**

En `panel/js/pages/catalogo.js`, en `_render`, modificar la columna de precio para mostrar los 3 precios si es Venues:

Reemplazar la línea `+ '<td class="col-total">' + _formatMXN(d.precio) + '</td>'` por:

```javascript
        + '<td class="col-total">' + _formatMXN(d.precio)
          + (d.categoria === 'Venues' && d.precioWeekend ? '<br><span style="font-size:10px;color:var(--tx)">WKD: ' + _formatMXN(d.precioWeekend) + ' · MTJ: ' + _formatMXN(d.precioMontaje) + '</span>' : '')
          + '</td>'
```

- [ ] **Step 7: Commit**

```bash
git add panel/dashboard.html panel/js/pages/catalogo.js
git commit -m "feat(panel): campos precioWeekend y precioMontaje en catálogo para Venues"
```

---

### Task 3: CSS — Estilos del wizard MNT y formulario BNK

Agregar todos los estilos necesarios para el wizard de 4 pasos, calendarios, cards de espacios, formulario BNK con conceptos dinámicos, y toggle de estilo PDF.

**Files:**
- Modify: `panel/css/panel.css`

**Interfaces:**
- Consumes: Design tokens `:root` existentes en panel.css
- Produces: Clases CSS usadas por Task 4 (HTML) y Task 5/6 (JS): `.mnt-wizard`, `.mnt-step`, `.mnt-progress`, `.mnt-space-card`, `.mnt-calendar`, `.bnk-concepto-row`, `.pdf-style-toggle`, etc.

- [ ] **Step 1: Agregar estilos del wizard MNT**

En `panel/css/panel.css`, antes de `/* ── RESPONSIVE ── */` (línea 213), agregar:

```css
/* ── WIZARD MNT ── */
.mnt-wizard{padding:24px 30px}
.mnt-progress{display:flex;gap:0;margin-bottom:30px;border-bottom:2px solid var(--bd)}
.mnt-progress-step{flex:1;padding:12px 16px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:2px;color:var(--tx);cursor:default;position:relative;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .3s}
.mnt-progress-step.active{color:var(--g);border-bottom-color:var(--g)}
.mnt-progress-step.done{color:var(--gd);border-bottom-color:var(--gd)}
.mnt-progress-step .step-num{display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border:1px solid var(--bd);font-family:'Space Mono',monospace;font-size:10px;margin-right:8px;transition:all .3s}
.mnt-progress-step.active .step-num{border-color:var(--g);color:var(--g)}
.mnt-progress-step.done .step-num{border-color:var(--gd);background:rgba(0,204,51,.1);color:var(--gd)}

.mnt-step{display:none}
.mnt-step.active{display:block}

.mnt-step-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:20px;letter-spacing:3px;color:var(--g);margin-bottom:20px}

.mnt-nav{display:flex;justify-content:space-between;margin-top:24px;padding-top:16px;border-top:1px solid var(--bd)}
```

- [ ] **Step 2: Agregar estilos de cards de espacios y calendario**

Continuar en panel.css:

```css
/* ── SPACE CARDS ── */
.mnt-spaces-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:16px}
.mnt-space-card{background:var(--card);border:1px solid var(--bd);padding:16px;cursor:pointer;transition:all .3s;position:relative}
.mnt-space-card:hover{border-color:rgba(0,255,65,.3)}
.mnt-space-card.selected{border-color:var(--g);box-shadow:0 0 12px rgba(0,255,65,.1)}
.mnt-space-card.disabled{opacity:.35;pointer-events:none}
.mnt-space-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;letter-spacing:1px;margin-bottom:4px}
.mnt-space-meta{font-family:'Space Mono',monospace;font-size:9px;color:var(--tx);letter-spacing:1px}
.mnt-space-price{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;margin-top:8px}
.mnt-space-note{font-family:'Space Mono',monospace;font-size:8px;color:var(--ylw);margin-top:4px}

/* ── CALENDAR ── */
.mnt-calendar-wrap{margin-top:16px;background:var(--card);border:1px solid var(--bd);padding:16px}
.mnt-cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.mnt-cal-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;color:var(--g);letter-spacing:2px}
.mnt-cal-nav{background:none;border:1px solid var(--bd);color:var(--g);padding:4px 10px;cursor:pointer;font-size:14px;transition:all .2s}
.mnt-cal-nav:hover{background:rgba(0,255,65,.08)}
.mnt-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}
.mnt-cal-day-label{font-family:'Space Mono',monospace;font-size:9px;color:var(--tx);padding:4px}
.mnt-cal-day{padding:8px 4px;font-family:'Barlow',sans-serif;font-size:13px;cursor:pointer;border:1px solid transparent;transition:all .2s}
.mnt-cal-day:hover{border-color:rgba(0,255,65,.3);background:rgba(0,255,65,.04)}
.mnt-cal-day.selected{background:rgba(0,255,65,.12);border-color:var(--g);color:var(--g);font-weight:700}
.mnt-cal-day.weekend{color:var(--ylw)}
.mnt-cal-day.weekend.selected{background:rgba(240,192,64,.12);border-color:var(--ylw);color:var(--ylw)}
.mnt-cal-day.disabled{opacity:.2;pointer-events:none}
.mnt-cal-day.empty{visibility:hidden}

/* ── MONTAJE STEPPER ── */
.mnt-montaje{display:flex;align-items:center;gap:12px;margin-top:12px;padding:12px;background:rgba(0,255,65,.02);border:1px solid var(--bd)}
.mnt-montaje-label{font-family:'Space Mono',monospace;font-size:10px;color:var(--tx);letter-spacing:1px}
.mnt-montaje-btn{width:28px;height:28px;border:1px solid var(--bd);background:none;color:var(--g);font-size:16px;cursor:pointer;transition:all .2s}
.mnt-montaje-btn:hover{background:rgba(0,255,65,.08);border-color:var(--g)}
.mnt-montaje-val{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;color:var(--g);min-width:30px;text-align:center}

/* ── TIPO EVENTO TOGGLE ── */
.mnt-tipo-toggle{display:flex;gap:0;border:1px solid var(--bd);display:inline-flex}
.mnt-tipo-btn{padding:10px 24px;background:transparent;border:none;color:var(--tx);font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:2px;cursor:pointer;transition:all .2s}
.mnt-tipo-btn.active{background:rgba(0,255,65,.08);color:var(--g)}
```

- [ ] **Step 3: Agregar estilos del formulario BNK**

Continuar en panel.css:

```css
/* ── BNK FORM ── */
.bnk-form-wrap{padding:24px 30px}

/* Autocomplete */
.bnk-autocomplete{display:none;position:absolute;top:100%;left:0;right:0;z-index:210;background:var(--dk);border:1px solid var(--bd);max-height:160px;overflow-y:auto}
.bnk-autocomplete.visible{display:block}
.bnk-ac-item{padding:8px 12px;font-size:13px;cursor:pointer;transition:background .2s}
.bnk-ac-item:hover{background:rgba(240,192,64,.08)}
.bnk-ac-new{color:var(--ylw);font-style:italic}

/* Conceptos table */
.bnk-conceptos-header{display:grid;grid-template-columns:140px 1fr 60px 80px 110px 110px 36px;gap:6px;padding:6px 0;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--tx);border-bottom:1px solid var(--bd)}
.bnk-concepto-row{display:grid;grid-template-columns:140px 1fr 60px 80px 110px 110px 36px;gap:6px;padding:6px 0;align-items:center;border-bottom:1px solid rgba(0,255,65,.06)}
.bnk-concepto-row select,.bnk-concepto-row input{padding:6px 8px;background:var(--card);border:1px solid var(--bd);color:var(--wh);font-family:'Barlow',sans-serif;font-size:12px;outline:none}
.bnk-concepto-row .bnk-sub-val{font-family:'Barlow Condensed',sans-serif;font-weight:700;color:var(--ylw);font-size:14px;text-align:right;padding-right:8px}
.bnk-concepto-row .bnk-del-btn{background:none;border:1px solid rgba(255,68,85,.3);color:var(--red);font-size:14px;cursor:pointer;padding:4px 8px;transition:all .2s}
.bnk-concepto-row .bnk-del-btn:hover{background:rgba(255,68,85,.12)}

.bnk-add-row{display:block;width:100%;padding:10px;background:none;border:1px dashed rgba(240,192,64,.3);color:var(--ylw);font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1px;cursor:pointer;margin-top:8px;transition:all .2s}
.bnk-add-row:hover{background:rgba(240,192,64,.06);border-color:var(--ylw)}

/* Totales */
.bnk-totales{margin-top:16px;border-top:1px solid var(--bd);padding-top:12px}
.bnk-total-row{display:flex;justify-content:space-between;padding:4px 0;font-family:'Barlow Condensed',sans-serif;font-size:14px;color:var(--tx)}
.bnk-total-gran{font-size:20px;font-weight:700;color:var(--ylw);border-top:1px solid var(--ylw);padding-top:8px;margin-top:4px}
```

- [ ] **Step 4: Agregar estilos del toggle PDF y resumen**

Continuar en panel.css:

```css
/* ── PDF STYLE TOGGLE ── */
.pdf-style-toggle{display:flex;gap:0;border:1px solid var(--bd);display:inline-flex;margin-right:12px}
.pdf-style-btn{padding:8px 18px;background:transparent;border:none;color:var(--tx);font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;cursor:pointer;transition:all .2s}
.pdf-style-btn.active{background:rgba(0,255,65,.08);color:var(--g)}
.pdf-style-btn[data-style="corporativa"].active{background:rgba(198,163,80,.08);color:#C6A350}

/* ── MNT RESUMEN ── */
.mnt-resumen{background:var(--card);border:1px solid var(--bd);padding:20px}
.mnt-resumen-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--tx);border-bottom:1px solid var(--bd)}
.mnt-resumen-row:last-child{border-bottom:none}
.mnt-resumen-total{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:24px;color:var(--g);text-align:right;padding-top:12px;margin-top:8px;border-top:2px solid var(--g)}
.mnt-venue-desglose{margin:12px 0;padding:12px;border:1px solid var(--bd)}
.mnt-venue-desglose-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:1px;margin-bottom:8px}
```

- [ ] **Step 5: Agregar responsive para wizard y BNK**

En panel.css, dentro del bloque `@media(max-width:900px)` existente, agregar:

```css
  .mnt-spaces-grid{grid-template-columns:repeat(2,1fr)}
  .mnt-wizard{padding:16px}
  .bnk-form-wrap{padding:16px}
  .bnk-conceptos-header{display:none}
  .bnk-concepto-row{grid-template-columns:1fr 1fr;gap:8px;padding:12px 0;border-bottom:1px solid var(--bd)}
  .bnk-concepto-row select,.bnk-concepto-row input{width:100%}
  .mnt-progress-step{font-size:10px;padding:8px 6px;letter-spacing:1px}
  .mnt-progress-step .step-num{margin-right:4px}
```

Dentro de `@media(max-width:600px)`, agregar:

```css
  .mnt-spaces-grid{grid-template-columns:1fr}
  .bnk-concepto-row{grid-template-columns:1fr}
  .mnt-progress-step{font-size:9px;padding:6px 4px}
```

- [ ] **Step 6: Commit**

```bash
git add panel/css/panel.css
git commit -m "feat(panel): estilos CSS wizard MNT, formulario BNK, calendarios, toggle PDF"
```

---

### Task 4: Dashboard HTML — Wizard MNT y formulario BNK

Agregar el HTML completo de las secciones de cotización en dashboard.html.

**Files:**
- Modify: `panel/dashboard.html`

**Interfaces:**
- Consumes: Clases CSS de Task 3, secciones vacías de Task 1
- Produces: Contenedores HTML con IDs que `cotizar-mnt.js` (Task 5) y `cotizar-bnk.js` (Task 6) referencian

- [ ] **Step 1: Reemplazar el contenido de sec-cotizar-mnt**

En `panel/dashboard.html`, reemplazar `<div id="mntWizardContainer"></div>` dentro de `sec-cotizar-mnt` con:

```html
    <div class="mnt-wizard" id="mntWizard">
      <!-- Progress bar -->
      <div class="mnt-progress">
        <div class="mnt-progress-step active" data-step="1"><span class="step-num">1</span>CONTACTO</div>
        <div class="mnt-progress-step" data-step="2"><span class="step-num">2</span>EVENTO</div>
        <div class="mnt-progress-step" data-step="3"><span class="step-num">3</span>ESPACIOS</div>
        <div class="mnt-progress-step" data-step="4"><span class="step-num">4</span>RESUMEN</div>
      </div>

      <!-- Paso 1: Datos de Contacto -->
      <div class="mnt-step active" data-step="1">
        <div class="mnt-step-title">DATOS DE CONTACTO</div>
        <div class="bnk-form-grid">
          <div class="bnk-form-group">
            <label class="bnk-label">CLIENTE / EMPRESA *</label>
            <input type="text" class="bnk-input" id="mntCliente" placeholder="Buscar cliente..." autocomplete="off">
            <div class="bnk-autocomplete" id="mntAutoCliente"></div>
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">AGENCIA / PRODUCTORA</label>
            <input type="text" class="bnk-input" id="mntAgencia" placeholder="Opcional">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">NOMBRE DEL EVENTO</label>
            <input type="text" class="bnk-input" id="mntEvento" placeholder="Nombre del evento">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CONTACTO *</label>
            <input type="text" class="bnk-input" id="mntContacto" placeholder="Persona de contacto">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">TELÉFONO</label>
            <input type="tel" class="bnk-input" id="mntTelefono" placeholder="Teléfono">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">CORREO</label>
            <input type="email" class="bnk-input" id="mntCorreo" placeholder="correo@empresa.com">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">ASISTENTES</label>
            <input type="number" class="bnk-input" id="mntAsistentes" placeholder="Número estimado" min="0">
          </div>
        </div>
        <div class="mnt-nav">
          <span></span>
          <button class="panel-btn-primary" id="mntNext1">SIGUIENTE →</button>
        </div>
      </div>

      <!-- Paso 2: Tipo de Evento -->
      <div class="mnt-step" data-step="2">
        <div class="mnt-step-title">TIPO DE EVENTO</div>
        <div class="bnk-form-grid">
          <div class="bnk-form-group">
            <label class="bnk-label">MODALIDAD</label>
            <div class="mnt-tipo-toggle">
              <button class="mnt-tipo-btn active" data-tipo="privado">PRIVADO</button>
              <button class="mnt-tipo-btn" data-tipo="publico">PÚBLICO</button>
            </div>
          </div>
          <div class="bnk-form-group"></div>
          <div class="bnk-form-group">
            <label class="bnk-label">HORA INICIO</label>
            <input type="time" class="bnk-input" id="mntHoraInicio">
          </div>
          <div class="bnk-form-group">
            <label class="bnk-label">HORA FIN</label>
            <input type="time" class="bnk-input" id="mntHoraFin">
          </div>
          <div class="bnk-form-group bnk-form-full">
            <label class="bnk-label">DESCRIPCIÓN DEL EVENTO</label>
            <textarea class="bnk-textarea" id="mntDescripcion" rows="3" placeholder="Describe brevemente el evento..."></textarea>
          </div>
        </div>
        <div class="mnt-nav">
          <button class="panel-btn-secondary" id="mntPrev2">← ANTERIOR</button>
          <button class="panel-btn-primary" id="mntNext2">SIGUIENTE →</button>
        </div>
      </div>

      <!-- Paso 3: Espacios y Fechas -->
      <div class="mnt-step" data-step="3">
        <div class="mnt-step-title">SELECCIONA ESPACIOS</div>
        <div class="mnt-spaces-grid" id="mntSpacesGrid"></div>
        <div id="mntCalendarArea"></div>
        <div class="mnt-nav">
          <button class="panel-btn-secondary" id="mntPrev3">← ANTERIOR</button>
          <button class="panel-btn-primary" id="mntNext3">SIGUIENTE →</button>
        </div>
      </div>

      <!-- Paso 4: Resumen -->
      <div class="mnt-step" data-step="4">
        <div class="mnt-step-title">RESUMEN DE COTIZACIÓN</div>
        <div id="mntResumen"></div>
        <div class="mnt-nav">
          <button class="panel-btn-secondary" id="mntPrev4">← ANTERIOR</button>
          <div>
            <div class="pdf-style-toggle" id="mntPdfToggle">
              <button class="pdf-style-btn active" data-style="neon">NEON</button>
              <button class="pdf-style-btn" data-style="corporativa">CORPORATIVA</button>
            </div>
            <button class="panel-btn-primary" id="mntGenerar">GENERAR COTIZACIÓN</button>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Reemplazar el contenido de sec-cotizar-bnk**

En `panel/dashboard.html`, reemplazar `<div id="bnkFormContainer"></div>` dentro de `sec-cotizar-bnk` con:

```html
    <div class="bnk-form-wrap" id="bnkForm">
      <div class="mnt-step-title">NUEVA COTIZACIÓN BNK — SERVICIOS</div>

      <!-- Datos del cliente -->
      <div class="bnk-section-label">DATOS DEL CLIENTE</div>
      <div class="bnk-form-grid">
        <div class="bnk-form-group">
          <label class="bnk-label">EMPRESA *</label>
          <input type="text" class="bnk-input" id="bnkEmpresa" placeholder="Buscar cliente..." autocomplete="off">
          <div class="bnk-autocomplete" id="bnkAutoEmpresa"></div>
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">CONTACTO</label>
          <input type="text" class="bnk-input" id="bnkContacto" placeholder="Persona de contacto">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">TELÉFONO</label>
          <input type="tel" class="bnk-input" id="bnkTelefono" placeholder="Teléfono">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">CORREO</label>
          <input type="email" class="bnk-input" id="bnkCorreo" placeholder="correo@empresa.com">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">EVENTO</label>
          <input type="text" class="bnk-input" id="bnkEvento" placeholder="Nombre del evento">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">FECHA EVENTO</label>
          <input type="date" class="bnk-input" id="bnkFechaEvento">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">SEDE</label>
          <input type="text" class="bnk-input" id="bnkSede" value="MUNET" placeholder="MUNET u otra">
        </div>
        <div class="bnk-form-group">
          <label class="bnk-label">VINCULAR A FOLIO MNT</label>
          <input type="text" class="bnk-input" id="bnkFolioMNT" placeholder="Opcional — ej: MNT-260812-1234">
        </div>
      </div>

      <!-- Conceptos -->
      <div class="bnk-section-label" style="margin-top:24px">CONCEPTOS</div>
      <div class="bnk-conceptos-header">
        <span>CATEGORÍA</span>
        <span>CONCEPTO</span>
        <span>CANT.</span>
        <span>UNIDAD</span>
        <span>PRECIO UNIT.</span>
        <span>SUBTOTAL</span>
        <span></span>
      </div>
      <div id="bnkConceptosBody"></div>
      <button class="bnk-add-row" id="bnkAddRow">+ AGREGAR CONCEPTO</button>

      <!-- Totales -->
      <div class="bnk-totales">
        <div class="bnk-total-row"><span>SUBTOTAL (SIN IVA)</span><span id="bnkSubtotal">$0</span></div>
        <div class="bnk-total-row"><span>IVA (16%)</span><span id="bnkIVA">$0</span></div>
        <div class="bnk-total-row bnk-total-gran"><span>TOTAL</span><span id="bnkTotal">$0</span></div>
      </div>

      <!-- Condiciones -->
      <div class="bnk-section-label" style="margin-top:24px">CONDICIONES COMERCIALES</div>
      <div class="bnk-form-grid">
        <div class="bnk-form-group">
          <label class="bnk-label">PLANTILLA</label>
          <select class="bnk-input" id="bnkPlantilla">
            <option value="estandar">ESTÁNDAR</option>
            <option value="estructura">ESTRUCTURA PESADA</option>
            <option value="especial">EVENTO ESPECIAL</option>
          </select>
        </div>
      </div>
      <textarea class="bnk-textarea" id="bnkCondiciones" rows="8"></textarea>

      <!-- Acciones -->
      <div class="mnt-nav" style="margin-top:24px">
        <button class="panel-btn-secondary" id="bnkLimpiar">LIMPIAR</button>
        <div>
          <div class="pdf-style-toggle" id="bnkPdfToggle">
            <button class="pdf-style-btn active" data-style="neon">NEON</button>
            <button class="pdf-style-btn" data-style="corporativa">CORPORATIVA</button>
          </div>
          <button class="panel-btn-primary" id="bnkGenerar">GENERAR COTIZACIÓN</button>
        </div>
      </div>
    </div>
```

- [ ] **Step 3: Commit**

```bash
git add panel/dashboard.html
git commit -m "feat(panel): HTML wizard MNT y formulario BNK en dashboard"
```

---

### Task 5: cotizar-mnt.js — Lógica del wizard MNT

Implementar toda la lógica del wizard: navegación por pasos, autocompletado de clientes, renderizado de cards de espacios desde Firestore, calendarios de selección de días, cálculos de tarifas, resumen, y generación de PDF en 2 estilos.

**Files:**
- Create: `panel/js/pages/cotizar-mnt.js`

**Interfaces:**
- Consumes: `BNK_DB.catalogo.list({ categoria: 'Venues' })` para tarifas, `BNK_DB.clientes.list()` para autocompletado, `BNK_DB.cotizaciones.create(data)` para guardar, `BUNKER_LOGO_B64` para PDF, `window.jspdf.jsPDF` para PDF, `BNKToast.ok()/.warn()/.error()` para notificaciones, `BNK_AUTH.onReady(cb)` para inicialización
- Produces: Wizard funcional en tab COTIZAR MNT, cotizaciones guardadas en Firestore con `fuente: 'MNT'`

- [ ] **Step 1: Crear el IIFE base con estado y init**

Crear `panel/js/pages/cotizar-mnt.js`:

```javascript
// cotizar-mnt.js — Wizard para cotizar espacios MUNET
(function () {
  'use strict';

  var _venues = [];      // datos de catalogo categoría Venues
  var _clientes = [];    // lista de clientes para autocompletado
  var _selected = {};    // { docId: { montajeDays: 0, eventDays: ['2026-08-15',...] } }
  var _currentStep = 1;
  var _tipo = 'privado'; // 'privado' o 'publico'
  var _pdfStyle = 'neon';
  var _calendarMonth = new Date();

  function init() {
    Promise.all([
      BNK_DB.catalogo.list(),
      BNK_DB.clientes.list()
    ]).then(function (results) {
      var allCatalogo = results[0];
      _venues = allCatalogo.filter(function (c) { return c.categoria === 'Venues' && c.activo !== false; });
      _clientes = results[1];
      _renderSpaces();
      _bindEvents();
    });
  }

  // ── Utilidades ──
  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }

  function _generarFolio() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var rand = String(Math.floor(1000 + Math.random() * 9000));
    return 'MNT-' + yy + mm + dd + '-' + rand;
  }
```

- [ ] **Step 2: Agregar navegación del wizard**

Continuar en el IIFE:

```javascript
  // ── Navegación del wizard ──
  function _goToStep(step) {
    if (step < 1 || step > 4) return;

    // Validar paso actual antes de avanzar
    if (step > _currentStep) {
      if (_currentStep === 1 && !_validateStep1()) return;
      if (_currentStep === 3) _buildResumen();
    }

    _currentStep = step;
    document.querySelectorAll('.mnt-step').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.mnt-progress-step').forEach(function (el) {
      var s = parseInt(el.getAttribute('data-step'));
      el.classList.remove('active', 'done');
      if (s === step) el.classList.add('active');
      else if (s < step) el.classList.add('done');
    });
    var target = document.querySelector('.mnt-step[data-step="' + step + '"]');
    if (target) target.classList.add('active');
  }

  function _validateStep1() {
    var cliente = document.getElementById('mntCliente').value.trim();
    var contacto = document.getElementById('mntContacto').value.trim();
    var tel = document.getElementById('mntTelefono').value.trim();
    var correo = document.getElementById('mntCorreo').value.trim();
    if (!cliente) { BNKToast.warn('El cliente es requerido.'); return false; }
    if (!contacto) { BNKToast.warn('El contacto es requerido.'); return false; }
    if (!tel && !correo) { BNKToast.warn('Teléfono o correo es requerido.'); return false; }
    return true;
  }
```

- [ ] **Step 3: Agregar autocompletado de clientes**

```javascript
  // ── Autocompletado de clientes ──
  function _setupAutocomplete() {
    var input = document.getElementById('mntCliente');
    var dropdown = document.getElementById('mntAutoCliente');
    if (!input || !dropdown) return;

    input.addEventListener('input', function () {
      var val = input.value.trim().toLowerCase();
      if (val.length < 2) { dropdown.classList.remove('visible'); return; }

      var matches = _clientes.filter(function (c) {
        var nombre = (c.empresa || c.razonSocial || '').toLowerCase();
        return nombre.indexOf(val) !== -1;
      });

      var html = '';
      matches.slice(0, 8).forEach(function (c) {
        var nombre = c.empresa || c.razonSocial || '';
        html += '<div class="bnk-ac-item" data-empresa="' + _esc(nombre)
          + '" data-contacto="' + _esc(c.personaContacto || '')
          + '" data-telefono="' + _esc(c.telefonoContacto || '')
          + '" data-correo="' + _esc(c.correoContacto || '') + '">'
          + _esc(nombre) + '</div>';
      });
      if (matches.length === 0) {
        html = '<div class="bnk-ac-item bnk-ac-new">Nuevo: "' + _esc(input.value.trim()) + '"</div>';
      }
      dropdown.innerHTML = html;
      dropdown.classList.add('visible');
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.bnk-ac-item');
      if (!item || item.classList.contains('bnk-ac-new')) { dropdown.classList.remove('visible'); return; }
      document.getElementById('mntCliente').value = item.getAttribute('data-empresa') || '';
      document.getElementById('mntContacto').value = item.getAttribute('data-contacto') || '';
      document.getElementById('mntTelefono').value = item.getAttribute('data-telefono') || '';
      document.getElementById('mntCorreo').value = item.getAttribute('data-correo') || '';
      dropdown.classList.remove('visible');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#mntCliente') && !e.target.closest('#mntAutoCliente')) {
        dropdown.classList.remove('visible');
      }
    });
  }
```

- [ ] **Step 4: Agregar renderizado de cards de espacios y toggle tipo**

```javascript
  // ── Renderizar cards de espacios ──
  function _renderSpaces() {
    var grid = document.getElementById('mntSpacesGrid');
    if (!grid) return;

    var html = '';
    _venues.forEach(function (v) {
      var isPublic = _tipo === 'publico';
      var disponible = true;
      // Salas no permiten público, y espacios onlyPrivado check
      if (isPublic && (v.concepto === 'SALAS CAPACIT.' || v.concepto === 'LOBBY'
        || v.concepto === 'JARDÍN SOCIAL' || v.concepto === 'VELARIA')) {
        disponible = false;
      }
      var isSelected = !!_selected[v.id];
      html += '<div class="mnt-space-card' + (isSelected ? ' selected' : '') + (disponible ? '' : ' disabled') + '" data-vid="' + v.id + '">'
        + '<div class="mnt-space-name" style="color:var(--g)">' + _esc(v.concepto) + '</div>'
        + '<div class="mnt-space-meta">' + _esc(v.unidad || 'día') + '</div>'
        + '<div class="mnt-space-price">' + _formatMXN(v.precio) + ' / DÍA</div>'
        + (v.precioWeekend ? '<div class="mnt-space-meta">WKD: ' + _formatMXN(v.precioWeekend) + '</div>' : '')
        + '</div>';
    });
    grid.innerHTML = html;

    // Bind clicks
    grid.querySelectorAll('.mnt-space-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var vid = this.getAttribute('data-vid');
        if (_selected[vid]) {
          delete _selected[vid];
          this.classList.remove('selected');
        } else {
          _selected[vid] = { montajeDays: 0, eventDays: [] };
          this.classList.add('selected');
        }
        _renderCalendars();
      });
    });
  }

  // ── Toggle tipo evento ──
  function _setupTipoToggle() {
    document.querySelectorAll('.mnt-tipo-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.mnt-tipo-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        _tipo = this.getAttribute('data-tipo');
        // Reset selections that become invalid
        Object.keys(_selected).forEach(function (vid) {
          var venue = _venues.find(function (v) { return v.id === vid; });
          if (!venue) return;
          if (_tipo === 'publico' && (venue.concepto === 'SALAS CAPACIT.' || venue.concepto === 'LOBBY'
            || venue.concepto === 'JARDÍN SOCIAL' || venue.concepto === 'VELARIA')) {
            delete _selected[vid];
          }
        });
        _renderSpaces();
        _renderCalendars();
      });
    });
  }
```

- [ ] **Step 5: Agregar calendario de selección de fechas**

```javascript
  // ── Calendarios ──
  function _renderCalendars() {
    var area = document.getElementById('mntCalendarArea');
    if (!area) return;

    var selectedIds = Object.keys(_selected);
    if (selectedIds.length === 0) { area.innerHTML = ''; return; }

    var html = '';
    selectedIds.forEach(function (vid) {
      var venue = _venues.find(function (v) { return v.id === vid; });
      if (!venue) return;

      html += '<div class="mnt-calendar-wrap" data-vid="' + vid + '">'
        + '<div class="mnt-cal-header">'
        + '<button class="mnt-cal-nav" data-dir="-1" data-vid="' + vid + '">&larr;</button>'
        + '<span class="mnt-cal-title">' + _esc(venue.concepto) + ' — ' + _getMonthLabel() + '</span>'
        + '<button class="mnt-cal-nav" data-dir="1" data-vid="' + vid + '">&rarr;</button>'
        + '</div>'
        + '<div class="mnt-cal-grid">'
        + _buildCalendarDays(vid, venue)
        + '</div>';

      // Montaje stepper
      var montLabel = venue.precioMontaje > 0 ? _formatMXN(venue.precioMontaje) + ' / DÍA' : 'SIN COSTO';
      html += '<div class="mnt-montaje">'
        + '<span class="mnt-montaje-label">DÍAS DE MONTAJE (' + montLabel + ')</span>'
        + '<button class="mnt-montaje-btn" data-vid="' + vid + '" data-dir="-1">−</button>'
        + '<span class="mnt-montaje-val" id="montVal-' + vid + '">' + (_selected[vid].montajeDays || 0) + '</span>'
        + '<button class="mnt-montaje-btn" data-vid="' + vid + '" data-dir="1">+</button>'
        + '</div>';

      html += '</div>';
    });
    area.innerHTML = html;

    // Bind calendar events
    area.querySelectorAll('.mnt-cal-nav').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = parseInt(this.getAttribute('data-dir'));
        _calendarMonth.setMonth(_calendarMonth.getMonth() + dir);
        _renderCalendars();
      });
    });

    area.querySelectorAll('.mnt-cal-day:not(.disabled):not(.empty)').forEach(function (cell) {
      cell.addEventListener('click', function () {
        var vid = this.getAttribute('data-vid');
        var date = this.getAttribute('data-date');
        var days = _selected[vid].eventDays;
        var idx = days.indexOf(date);
        if (idx >= 0) { days.splice(idx, 1); this.classList.remove('selected'); }
        else { days.push(date); this.classList.add('selected'); }
      });
    });

    area.querySelectorAll('.mnt-montaje-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var vid = this.getAttribute('data-vid');
        var dir = parseInt(this.getAttribute('data-dir'));
        var sel = _selected[vid];
        sel.montajeDays = Math.max(0, (sel.montajeDays || 0) + dir);
        var valEl = document.getElementById('montVal-' + vid);
        if (valEl) valEl.textContent = sel.montajeDays;
      });
    });
  }

  function _getMonthLabel() {
    var meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    return meses[_calendarMonth.getMonth()] + ' ' + _calendarMonth.getFullYear();
  }

  function _buildCalendarDays(vid, venue) {
    var year = _calendarMonth.getFullYear();
    var month = _calendarMonth.getMonth();
    var firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = new Date(); today.setHours(0,0,0,0);

    var labels = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
    var html = labels.map(function (l) { return '<div class="mnt-cal-day-label">' + l + '</div>'; }).join('');

    // Empty cells
    for (var e = 0; e < firstDay; e++) { html += '<div class="mnt-cal-day empty"></div>'; }

    var isSalas = venue.concepto === 'SALAS CAPACIT.';

    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(year, month, d);
      var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var dow = date.getDay();
      var isWeekend = dow === 5 || dow === 6; // Vie-Sáb
      var isPast = date < today;
      var isSelected = _selected[vid] && _selected[vid].eventDays.indexOf(iso) >= 0;
      var disabled = isPast || (isSalas && isWeekend);

      html += '<div class="mnt-cal-day' + (isWeekend ? ' weekend' : '') + (isSelected ? ' selected' : '') + (disabled ? ' disabled' : '')
        + '" data-vid="' + vid + '" data-date="' + iso + '">' + d + '</div>';
    }
    return html;
  }
```

- [ ] **Step 6: Agregar cálculos y resumen**

```javascript
  // ── Cálculos ──
  function _calcular() {
    var rentaTotal = 0;
    var montajeTotal = 0;
    var desglose = [];

    Object.keys(_selected).forEach(function (vid) {
      var venue = _venues.find(function (v) { return v.id === vid; });
      if (!venue) return;
      var sel = _selected[vid];

      var diasRegular = 0, diasWeekend = 0;
      sel.eventDays.forEach(function (iso) {
        var parts = iso.split('-');
        var date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        var dow = date.getDay();
        if (dow === 5 || dow === 6) diasWeekend++;
        else diasRegular++;
      });

      var renta = (diasRegular * (venue.precio || 0)) + (diasWeekend * (venue.precioWeekend || venue.precio || 0));
      var montaje = (sel.montajeDays || 0) * (venue.precioMontaje || 0);

      rentaTotal += renta;
      montajeTotal += montaje;

      desglose.push({
        nombre: venue.concepto,
        diasRegular: diasRegular,
        diasWeekend: diasWeekend,
        diasTotal: diasRegular + diasWeekend,
        montajeDays: sel.montajeDays || 0,
        eventDays: sel.eventDays.slice().sort(),
        precioRegular: venue.precio,
        precioWeekend: venue.precioWeekend || venue.precio,
        precioMontaje: venue.precioMontaje || 0,
        renta: renta,
        montaje: montaje,
        total: renta + montaje
      });
    });

    var subtotal = rentaTotal + montajeTotal;
    var iva = Math.round(subtotal * 0.16);
    var total = subtotal + iva;

    return {
      desglose: desglose,
      rentaTotal: rentaTotal,
      montajeTotal: montajeTotal,
      subtotal: subtotal,
      iva: iva,
      total: total
    };
  }

  function _buildResumen() {
    var container = document.getElementById('mntResumen');
    if (!container) return;

    var calc = _calcular();
    if (calc.desglose.length === 0) {
      container.innerHTML = '<div class="dash-empty"><div class="dash-empty-icon">&#128205;</div><div class="dash-empty-text">Selecciona al menos un espacio</div></div>';
      return;
    }

    var html = '';
    calc.desglose.forEach(function (d) {
      html += '<div class="mnt-venue-desglose">'
        + '<div class="mnt-venue-desglose-title">' + _esc(d.nombre) + '</div>'
        + '<div class="mnt-resumen-row"><span>Días regulares (Lun-Jue): ' + d.diasRegular + '</span><span>' + _formatMXN(d.diasRegular * d.precioRegular) + '</span></div>'
        + (d.diasWeekend > 0 ? '<div class="mnt-resumen-row"><span>Días weekend (Vie-Sáb): ' + d.diasWeekend + '</span><span>' + _formatMXN(d.diasWeekend * d.precioWeekend) + '</span></div>' : '')
        + (d.montajeDays > 0 ? '<div class="mnt-resumen-row"><span>Días montaje: ' + d.montajeDays + '</span><span>' + _formatMXN(d.montaje) + '</span></div>' : '')
        + '<div class="mnt-resumen-row" style="font-weight:700;color:var(--wh)"><span>Total espacio</span><span>' + _formatMXN(d.total) + '</span></div>'
        + '</div>';
    });

    html += '<div class="mnt-resumen" style="margin-top:16px">'
      + '<div class="mnt-resumen-row"><span>Renta total</span><span>' + _formatMXN(calc.rentaTotal) + '</span></div>'
      + '<div class="mnt-resumen-row"><span>Montaje total</span><span>' + _formatMXN(calc.montajeTotal) + '</span></div>'
      + '<div class="mnt-resumen-row"><span>Subtotal (sin IVA)</span><span>' + _formatMXN(calc.subtotal) + '</span></div>'
      + '<div class="mnt-resumen-row"><span>IVA (16%)</span><span>' + _formatMXN(calc.iva) + '</span></div>'
      + '<div class="mnt-resumen-total">' + _formatMXN(calc.total) + '</div>'
      + '</div>';

    container.innerHTML = html;
  }
```

- [ ] **Step 7: Agregar generación de PDF (2 estilos)**

```javascript
  // ── PDF ──
  function _generarPDF() {
    var calc = _calcular();
    if (calc.desglose.length === 0) { BNKToast.warn('Selecciona al menos un espacio.'); return; }

    var folio = _generarFolio();
    var cliente = document.getElementById('mntCliente').value.trim();
    var contacto = document.getElementById('mntContacto').value.trim();
    var evento = document.getElementById('mntEvento').value.trim();
    var horaInicio = document.getElementById('mntHoraInicio').value;
    var horaFin = document.getElementById('mntHoraFin').value;
    var horario = (horaInicio && horaFin) ? horaInicio + ' — ' + horaFin : '';

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, margin = 20, contentW = W - margin * 2, H = 297;

    var isNeon = _pdfStyle === 'neon';

    // Paleta
    var BG = isNeon ? [5, 9, 5] : [255, 255, 255];
    var TEXT = isNeon ? [237, 248, 237] : [51, 51, 51];
    var ACCENT = isNeon ? [0, 255, 65] : [198, 163, 80];
    var HEADER_BG = isNeon ? [5, 9, 5] : [44, 36, 25];
    var HEADER_TEXT = [255, 255, 255];
    var SUB_TEXT = isNeon ? [200, 236, 200] : [120, 120, 120];
    var LINE = isNeon ? [0, 255, 65, 0.12] : [232, 220, 200];

    var HEADER_H = 28, FOOTER_H = 20, CONTENT_TOP = 36, MAX_Y = H - FOOTER_H;
    var y = 0;

    function drawBG() {
      doc.setFillColor(BG[0], BG[1], BG[2]);
      doc.rect(0, 0, W, H, 'F');
    }

    function drawHeader() {
      drawBG();
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.rect(0, 0, W, HEADER_H, 'F');
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        try { doc.addImage(BUNKER_LOGO_B64, 'PNG', margin, 5, 30, 11); } catch (e) {}
      }
      doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Cotización MUNET — ' + (evento || 'Evento'), 55, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text(folio + ' | ' + cliente + ' | ' + contacto, 55, 18);
    }

    function drawFooter() {
      var fy = H - FOOTER_H + 2;
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.setLineWidth(0.3); doc.line(margin, fy, W - margin, fy);
      doc.setFontSize(6); doc.setTextColor(SUB_TEXT[0], SUB_TEXT[1], SUB_TEXT[2]);
      var pn = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text('Pág. ' + pn + ' | BÚNKER Creatividad Empresarial | MUNET', margin, fy + 5);
    }

    function checkPage(needed) {
      if (y + needed > MAX_Y) { doc.addPage(); drawHeader(); y = CONTENT_TOP; }
    }

    // Página 1
    drawHeader(); y = CONTENT_TOP;

    // Datos del evento
    doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    var info = 'Tipo: ' + (_tipo === 'publico' ? 'Público' : 'Privado');
    if (horario) info += ' | Horario: ' + horario;
    doc.text(info, margin, y); y += 6;

    // Desglose por venue
    calc.desglose.forEach(function (d) {
      checkPage(40);
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(d.nombre, margin + 4, y + 5.5); y += 10;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);

      if (d.diasRegular > 0) {
        doc.text(d.diasRegular + ' día(s) regular (Lun-Jue) × ' + _formatMXN(d.precioRegular), margin + 4, y + 4);
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text(_formatMXN(d.diasRegular * d.precioRegular), W - margin - 4, y + 4, { align: 'right' });
        doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]); y += 7;
      }
      if (d.diasWeekend > 0) {
        doc.text(d.diasWeekend + ' día(s) weekend (Vie-Sáb) × ' + _formatMXN(d.precioWeekend), margin + 4, y + 4);
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text(_formatMXN(d.diasWeekend * d.precioWeekend), W - margin - 4, y + 4, { align: 'right' });
        doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]); y += 7;
      }
      if (d.montajeDays > 0) {
        doc.text(d.montajeDays + ' día(s) montaje × ' + _formatMXN(d.precioMontaje), margin + 4, y + 4);
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text(_formatMXN(d.montaje), W - margin - 4, y + 4, { align: 'right' });
        doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]); y += 7;
      }
      y += 4;
    });

    // Totales
    checkPage(40);
    doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('RESUMEN GENERAL', margin + 4, y + 5.5); y += 12;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text('Renta total', margin + 4, y + 4);
    doc.text(_formatMXN(calc.rentaTotal), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.text('Montaje total', margin + 4, y + 4);
    doc.text(_formatMXN(calc.montajeTotal), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.text('Subtotal (sin IVA)', margin + 4, y + 4);
    doc.text(_formatMXN(calc.subtotal), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.text('IVA (16%)', margin + 4, y + 4);
    doc.text(_formatMXN(calc.iva), W - margin - 4, y + 4, { align: 'right' }); y += 7;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text('TOTAL: ' + _formatMXN(calc.total), W - margin - 4, y + 4, { align: 'right' });

    // Footers
    var totalPages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) { doc.setPage(p); drawFooter(); }

    return { doc: doc, folio: folio, calc: calc };
  }
```

- [ ] **Step 8: Agregar envío a Firestore y bind de eventos**

```javascript
  // ── Guardar en Firestore ──
  function _enviar() {
    var result = _generarPDF();
    if (!result) return;

    var btn = document.getElementById('mntGenerar');
    btn.disabled = true; btn.textContent = 'GENERANDO...';

    var calc = result.calc;
    var folio = result.folio;

    var espaciosNombres = calc.desglose.map(function (d) { return d.nombre; }).join(', ');
    var fechasResumen = _buildFechasResumen(calc.desglose);

    var data = {
      fuente: 'MNT',
      folio: folio,
      cliente: document.getElementById('mntCliente').value.trim(),
      agencia: document.getElementById('mntAgencia').value.trim(),
      evento: document.getElementById('mntEvento').value.trim(),
      contacto: document.getElementById('mntContacto').value.trim(),
      telefono: document.getElementById('mntTelefono').value.trim(),
      correo: document.getElementById('mntCorreo').value.trim(),
      tipo: _tipo === 'publico' ? 'Público' : 'Privado',
      fechas: fechasResumen,
      desgloseVenues: JSON.stringify(calc.desglose),
      diasTotal: calc.desglose.reduce(function (sum, d) { return sum + d.diasTotal; }, 0),
      descripcion: document.getElementById('mntDescripcion').value.trim(),
      horario: (document.getElementById('mntHoraInicio').value || '') + ' — ' + (document.getElementById('mntHoraFin').value || ''),
      espacios: espaciosNombres,
      rentaTotal: calc.rentaTotal,
      montajeTotal: calc.montajeTotal,
      subtotal: calc.subtotal,
      iva: calc.iva,
      total: calc.total,
      linkPdf: '',
      estado: 'Nueva',
      creadoPor: BNK_AUTH.currentUser ? BNK_AUTH.currentUser.uid : ''
    };

    BNK_DB.cotizaciones.create(data).then(function () {
      result.doc.save('Cotizacion-MNT-' + folio + '.pdf');
      BNKToast.ok('Cotización ' + folio + ' generada.');
      _resetWizard();
    }).catch(function (err) {
      BNKToast.error('Error: ' + err.message);
    }).finally(function () {
      btn.disabled = false; btn.textContent = 'GENERAR COTIZACIÓN';
    });
  }

  function _buildFechasResumen(desglose) {
    var meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    var allDays = [];
    desglose.forEach(function (d) {
      d.eventDays.forEach(function (day) { if (allDays.indexOf(day) < 0) allDays.push(day); });
    });
    allDays.sort();
    var groups = {}; var order = [];
    allDays.forEach(function (iso) {
      var parts = iso.split('-');
      var key = meses[parseInt(parts[1]) - 1] + ' ' + parts[0];
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(parseInt(parts[2]));
    });
    return order.map(function (k) { return k + ': ' + groups[k].join(', '); }).join(' · ');
  }

  function _resetWizard() {
    _selected = {};
    _currentStep = 1;
    _tipo = 'privado';
    ['mntCliente','mntAgencia','mntEvento','mntContacto','mntTelefono','mntCorreo','mntAsistentes','mntDescripcion','mntHoraInicio','mntHoraFin'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.querySelectorAll('.mnt-tipo-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelector('.mnt-tipo-btn[data-tipo="privado"]').classList.add('active');
    _renderSpaces();
    _renderCalendars();
    _goToStep(1);
  }

  // ── Bind all events ──
  function _bindEvents() {
    _setupAutocomplete();
    _setupTipoToggle();

    // Nav buttons
    document.getElementById('mntNext1').addEventListener('click', function () { _goToStep(2); });
    document.getElementById('mntPrev2').addEventListener('click', function () { _goToStep(1); });
    document.getElementById('mntNext2').addEventListener('click', function () { _goToStep(3); });
    document.getElementById('mntPrev3').addEventListener('click', function () { _goToStep(2); });
    document.getElementById('mntNext3').addEventListener('click', function () { _goToStep(4); });
    document.getElementById('mntPrev4').addEventListener('click', function () { _goToStep(3); });

    // PDF style toggle
    document.querySelectorAll('#mntPdfToggle .pdf-style-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#mntPdfToggle .pdf-style-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        _pdfStyle = this.getAttribute('data-style');
      });
    });

    // Generar
    document.getElementById('mntGenerar').addEventListener('click', _enviar);
  }

  // ── Init ──
  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });
})();
```

- [ ] **Step 9: Commit**

```bash
git add panel/js/pages/cotizar-mnt.js
git commit -m "feat(panel): wizard COTIZAR MNT con calendarios, tarifas dinámicas y PDF dual"
```

---

### Task 6: cotizar-bnk.js — Lógica del formulario BNK

Implementar formulario de conceptos dinámicos, autocompletado de clientes y catálogo, cálculos, condiciones comerciales, y generación de PDF en 2 estilos.

**Files:**
- Create: `panel/js/pages/cotizar-bnk.js`

**Interfaces:**
- Consumes: `BNK_DB.catalogo.list()` para autocompletado de conceptos, `BNK_DB.clientes.list()` para autocompletado de clientes, `BNK_DB.cotizaciones.create(data)` para guardar, `BUNKER_LOGO_B64` para PDF, `window.jspdf.jsPDF`, `BNKToast`, `BNK_AUTH.onReady(cb)`
- Produces: Formulario funcional en tab COTIZAR BNK, cotizaciones guardadas en Firestore con `fuente: 'BNK'`

- [ ] **Step 1: Crear el IIFE base con estado, utilidades e init**

Crear `panel/js/pages/cotizar-bnk.js`:

```javascript
// cotizar-bnk.js — Formulario para cotizar servicios/producción BNK
(function () {
  'use strict';

  var _clientes = [];
  var _catalogo = [];
  var _conceptoCounter = 0;
  var _pdfStyle = 'neon';

  var PLANTILLAS = {
    estandar: '1. Precios más IVA.\n2. Vigencia de la cotización: 30 días.\n3. 60% de anticipo para confirmación y bloqueo de fecha.\n4. 40% restante: 5 días naturales previos al evento.\n5. Servicios y/o equipos adicionales serán cotizados por separado.\n6. Cancelaciones: una vez confirmado el servicio, el anticipo no será reembolsado.',
    estructura: '1. Precios más IVA.\n2. Vigencia de la cotización: 30 días.\n3. 60% de anticipo para confirmación y bloqueo de fecha.\n4. 40% restante: 5 días naturales previos al evento.\n5. La Estructura está sujeta a condiciones de pago específicas: 80% de anticipo y 20% al inicio de montaje.\n6. Servicios y/o equipos adicionales serán cotizados por separado.\n7. Cancelaciones: una vez confirmado el servicio, el anticipo no será reembolsado.\n8. El precio del seguro de responsabilidad civil se calculará 30 días antes del evento y deberá ser liquidado por el cliente.',
    especial: '1. Presupuesto tipo ballpark previo a brief de cliente; si los requerimientos exceden lo cotizado, se hará un ajuste.\n2. No incluye creación de arte adicional a lo especificado; en caso de requerirla, se cotizará por separado.\n3. Se requiere un mínimo de 1 mes para la realización del proyecto.\n4. Cambios en la información ya proporcionada pueden afectar los costos.\n5. 50% de anticipo para iniciar el proyecto; liquidación contraentrega.\n6. Entregables editables: costo adicional del 40% del total.\n7. Costo por cancelación: 85%.'
  };

  var CATEGORIAS = ['Servicios Básicos', 'Mobiliario', 'A&B', 'Estructura', 'Contenido/Mapping', 'Suministros', 'Otro'];

  function init() {
    Promise.all([
      BNK_DB.clientes.list(),
      BNK_DB.catalogo.list()
    ]).then(function (results) {
      _clientes = results[0];
      _catalogo = results[1].filter(function (c) { return c.categoria !== 'Venues' && c.activo !== false; });
      _bindEvents();
      _setCondiciones('estandar');
      _agregarFila();
    });
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function _formatMXN(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); }

  function _generarFolio() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var rand = String(Math.floor(1000 + Math.random() * 9000));
    return 'BNK-' + yy + mm + dd + '-' + rand;
  }
```

- [ ] **Step 2: Agregar autocompletado de clientes BNK**

```javascript
  // ── Autocompletado de clientes ──
  function _setupAutocomplete() {
    var input = document.getElementById('bnkEmpresa');
    var dropdown = document.getElementById('bnkAutoEmpresa');
    if (!input || !dropdown) return;

    input.addEventListener('input', function () {
      var val = input.value.trim().toLowerCase();
      if (val.length < 2) { dropdown.classList.remove('visible'); return; }

      var matches = _clientes.filter(function (c) {
        var nombre = (c.empresa || c.razonSocial || '').toLowerCase();
        return nombre.indexOf(val) !== -1;
      });

      var html = '';
      matches.slice(0, 8).forEach(function (c) {
        var nombre = c.empresa || c.razonSocial || '';
        html += '<div class="bnk-ac-item" data-empresa="' + _esc(nombre)
          + '" data-contacto="' + _esc(c.personaContacto || '')
          + '" data-telefono="' + _esc(c.telefonoContacto || '')
          + '" data-correo="' + _esc(c.correoContacto || '') + '">'
          + _esc(nombre) + '</div>';
      });
      if (matches.length === 0) {
        html = '<div class="bnk-ac-item bnk-ac-new">Nuevo: "' + _esc(input.value.trim()) + '"</div>';
      }
      dropdown.innerHTML = html;
      dropdown.classList.add('visible');
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.bnk-ac-item');
      if (!item || item.classList.contains('bnk-ac-new')) { dropdown.classList.remove('visible'); return; }
      document.getElementById('bnkEmpresa').value = item.getAttribute('data-empresa') || '';
      document.getElementById('bnkContacto').value = item.getAttribute('data-contacto') || '';
      document.getElementById('bnkTelefono').value = item.getAttribute('data-telefono') || '';
      document.getElementById('bnkCorreo').value = item.getAttribute('data-correo') || '';
      dropdown.classList.remove('visible');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#bnkEmpresa') && !e.target.closest('#bnkAutoEmpresa')) {
        dropdown.classList.remove('visible');
      }
    });
  }
```

- [ ] **Step 3: Agregar filas de conceptos dinámicas**

```javascript
  // ── Filas de conceptos ──
  function _agregarFila() {
    var body = document.getElementById('bnkConceptosBody');
    if (!body) return;
    var id = 'bc' + (_conceptoCounter++);

    var catOptions = '<option value="">—</option>';
    CATEGORIAS.forEach(function (cat) {
      catOptions += '<option value="' + cat + '">' + cat + '</option>';
    });

    var row = document.createElement('div');
    row.className = 'bnk-concepto-row';
    row.id = id;
    row.innerHTML =
      '<select class="bnk-cat" data-row="' + id + '">' + catOptions + '</select>'
      + '<input type="text" class="bnk-con" data-row="' + id + '" placeholder="Buscar concepto..." list="dl-' + id + '"><datalist id="dl-' + id + '"></datalist>'
      + '<input type="number" class="bnk-cant" data-row="' + id + '" value="1" min="1" step="1">'
      + '<input type="text" class="bnk-uni" data-row="' + id + '" value="servicio" placeholder="unidad">'
      + '<input type="number" class="bnk-pre" data-row="' + id + '" value="0" min="0" step="0.01">'
      + '<span class="bnk-sub-val" data-row="' + id + '">$0</span>'
      + '<button class="bnk-del-btn" data-row="' + id + '">&times;</button>';
    body.appendChild(row);

    row.querySelector('.bnk-cat').addEventListener('change', function () { _actualizarDatalist(id); });
    row.querySelector('.bnk-con').addEventListener('change', function () { _autocompletarPrecio(id); });
    row.querySelector('.bnk-cant').addEventListener('input', function () { _recalcularFila(id); });
    row.querySelector('.bnk-pre').addEventListener('input', function () { _recalcularFila(id); });
    row.querySelector('.bnk-del-btn').addEventListener('click', function () { row.remove(); _recalcularTotales(); });
  }

  function _actualizarDatalist(rowId) {
    var row = document.getElementById(rowId);
    var cat = row.querySelector('.bnk-cat').value;
    var dl = row.querySelector('datalist');
    var opts = '';
    _catalogo.filter(function (c) { return !cat || c.categoria === cat; })
      .forEach(function (c) { opts += '<option value="' + _esc(c.concepto) + '">'; });
    dl.innerHTML = opts;
  }

  function _autocompletarPrecio(rowId) {
    var row = document.getElementById(rowId);
    var nombre = row.querySelector('.bnk-con').value.trim();
    var found = _catalogo.find(function (c) { return c.concepto === nombre; });
    if (found) {
      row.querySelector('.bnk-pre').value = found.precio;
      row.querySelector('.bnk-uni').value = found.unidad || 'servicio';
      if (!row.querySelector('.bnk-cat').value) row.querySelector('.bnk-cat').value = found.categoria;
      _recalcularFila(rowId);
    }
  }

  function _recalcularFila(rowId) {
    var row = document.getElementById(rowId);
    var cant = parseFloat(row.querySelector('.bnk-cant').value) || 0;
    var precio = parseFloat(row.querySelector('.bnk-pre').value) || 0;
    row.querySelector('.bnk-sub-val').textContent = _formatMXN(cant * precio);
    _recalcularTotales();
  }

  function _recalcularTotales() {
    var rows = document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row');
    var subtotal = 0;
    rows.forEach(function (row) {
      var cant = parseFloat(row.querySelector('.bnk-cant').value) || 0;
      var precio = parseFloat(row.querySelector('.bnk-pre').value) || 0;
      subtotal += cant * precio;
    });
    var iva = Math.round(subtotal * 0.16);
    document.getElementById('bnkSubtotal').textContent = _formatMXN(subtotal);
    document.getElementById('bnkIVA').textContent = _formatMXN(iva);
    document.getElementById('bnkTotal').textContent = _formatMXN(subtotal + iva);
  }

  function _setCondiciones(key) {
    document.getElementById('bnkCondiciones').value = PLANTILLAS[key] || '';
  }

  function _recopilarConceptos() {
    var rows = document.querySelectorAll('#bnkConceptosBody .bnk-concepto-row');
    var conceptos = [];
    rows.forEach(function (row) {
      var con = row.querySelector('.bnk-con').value.trim();
      var cant = parseFloat(row.querySelector('.bnk-cant').value) || 0;
      if (con && cant > 0) {
        conceptos.push({
          categoria: row.querySelector('.bnk-cat').value || 'Otro',
          concepto: con,
          cantidad: cant,
          unidad: row.querySelector('.bnk-uni').value.trim() || 'servicio',
          precioUnit: parseFloat(row.querySelector('.bnk-pre').value) || 0,
          subtotal: cant * (parseFloat(row.querySelector('.bnk-pre').value) || 0)
        });
      }
    });
    return conceptos;
  }
```

- [ ] **Step 4: Agregar generación de PDF BNK (2 estilos)**

```javascript
  // ── PDF BNK ──
  function _generarPDF(data) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, margin = 20, contentW = W - margin * 2, H = 297;

    var isNeon = _pdfStyle === 'neon';
    var BG = isNeon ? [5, 9, 5] : [255, 255, 255];
    var TEXT = isNeon ? [237, 248, 237] : [51, 51, 51];
    var ACCENT = isNeon ? [0, 255, 65] : [198, 163, 80];
    var HEADER_BG = isNeon ? [5, 9, 5] : [44, 36, 25];
    var HEADER_TEXT = [255, 255, 255];
    var SUB_TEXT = isNeon ? [200, 236, 200] : [120, 120, 120];

    var HEADER_H = 28, FOOTER_H = 20, CONTENT_TOP = 36, MAX_Y = H - FOOTER_H;
    var y = 0;

    function drawBG() { doc.setFillColor(BG[0], BG[1], BG[2]); doc.rect(0, 0, W, H, 'F'); }

    function drawHeader() {
      drawBG();
      // Logo BUNKER prominente arriba
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.rect(0, 0, W, HEADER_H, 'F');
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        try { doc.addImage(BUNKER_LOGO_B64, 'PNG', margin, 4, 40, 15); } catch (e) {}
      }
      doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Cotización — ' + (data.evento || 'Producción Integral'), 65, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text(data.folio + ' | ' + (data.empresa || '') + ' | ' + (data.contacto || ''), 65, 18);
    }

    function drawFooter() {
      var fy = H - FOOTER_H + 2;
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.setLineWidth(0.3); doc.line(margin, fy, W - margin, fy);
      doc.setFontSize(6); doc.setTextColor(SUB_TEXT[0], SUB_TEXT[1], SUB_TEXT[2]);
      var pn = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text('Pág. ' + pn + ' | BÚNKER Creatividad Empresarial', margin, fy + 5);
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        try { doc.addImage(BUNKER_LOGO_B64, 'PNG', W - margin - 25, H - FOOTER_H + 3, 25, 9); } catch (e) {}
      }
    }

    function checkPage(needed) { if (y + needed > MAX_Y) { doc.addPage(); drawHeader(); y = CONTENT_TOP; } }

    function drawSection(text) {
      checkPage(14);
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text(text, margin + 4, y + 5.5);
      doc.setFont('helvetica', 'normal'); y += 10;
    }

    // Página 1
    drawHeader(); y = CONTENT_TOP;

    // Intro
    doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    var intro = 'En atención a su solicitud, BÚNKER presenta la siguiente propuesta de producción integral para el evento '
      + (data.evento || '') + (data.fechaEvento ? ', a realizarse el ' + data.fechaEvento : '')
      + ' en las instalaciones de ' + (data.sede || 'MUNET') + '.';
    var introLines = doc.splitTextToSize(intro, contentW);
    doc.text(introLines, margin, y); y += introLines.length * 4 + 6;

    // Agrupar por categoría
    var grupos = {};
    data.conceptos.forEach(function (c) {
      if (!grupos[c.categoria]) grupos[c.categoria] = [];
      grupos[c.categoria].push(c);
    });

    Object.keys(grupos).forEach(function (cat) {
      drawSection(cat.toUpperCase());

      grupos[cat].forEach(function (c) {
        checkPage(7);
        doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
        doc.text(c.concepto, margin + 4, y + 4);
        doc.text(String(c.cantidad) + ' ' + c.unidad, margin + 100, y + 4);
        doc.text(_formatMXN(c.precioUnit), W - margin - 35, y + 4);
        doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.text(_formatMXN(c.subtotal), W - margin - 4, y + 4, { align: 'right' });
        doc.setDrawColor(BG[0] + 30, BG[1] + 30, BG[2] + 30);
        doc.setLineWidth(0.1); doc.line(margin, y + 6, W - margin, y + 6);
        y += 7;
      });
      y += 4;
    });

    // Totales
    checkPage(30);
    drawSection('RESUMEN GENERAL');
    doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text('Subtotal (sin IVA)', margin + 4, y + 4);
    doc.text(_formatMXN(data.subtotal), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.text('IVA (16%)', margin + 4, y + 4);
    doc.text(_formatMXN(data.iva), W - margin - 4, y + 4, { align: 'right' }); y += 7;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text('TOTAL: ' + _formatMXN(data.total), W - margin - 4, y + 4, { align: 'right' }); y += 12;

    // Condiciones
    if (data.condiciones) {
      drawSection('CONDICIONES COMERCIALES');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      data.condiciones.split('\n').forEach(function (line) {
        var wrapped = doc.splitTextToSize(line, contentW - 8);
        wrapped.forEach(function (wl) { checkPage(5); doc.text(wl, margin + 4, y + 4); y += 5; });
      });
    }

    // Footers
    var totalPages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) { doc.setPage(p); drawFooter(); }

    return doc;
  }
```

- [ ] **Step 5: Agregar envío a Firestore, limpiar, y bind de eventos**

```javascript
  // ── Enviar ──
  function _enviar() {
    var empresa = document.getElementById('bnkEmpresa').value.trim();
    if (!empresa) { BNKToast.warn('La empresa es requerida.'); return; }

    var conceptos = _recopilarConceptos();
    if (conceptos.length === 0) { BNKToast.warn('Agrega al menos un concepto.'); return; }

    var btn = document.getElementById('bnkGenerar');
    btn.disabled = true; btn.textContent = 'GENERANDO...';

    var folio = _generarFolio();
    var subtotal = 0;
    conceptos.forEach(function (c) { subtotal += c.subtotal; });
    var iva = Math.round(subtotal * 0.16);
    var total = subtotal + iva;

    var pdfData = {
      folio: folio,
      empresa: empresa,
      contacto: document.getElementById('bnkContacto').value.trim(),
      evento: document.getElementById('bnkEvento').value.trim(),
      fechaEvento: document.getElementById('bnkFechaEvento').value,
      sede: document.getElementById('bnkSede').value.trim() || 'MUNET',
      conceptos: conceptos,
      condiciones: document.getElementById('bnkCondiciones').value,
      subtotal: subtotal,
      iva: iva,
      total: total
    };

    var doc = _generarPDF(pdfData);

    var firestoreData = {
      fuente: 'BNK',
      folio: folio,
      folioMNT: document.getElementById('bnkFolioMNT').value.trim(),
      empresa: empresa,
      contacto: pdfData.contacto,
      telefono: document.getElementById('bnkTelefono').value.trim(),
      correo: document.getElementById('bnkCorreo').value.trim(),
      evento: pdfData.evento,
      fechaEvento: pdfData.fechaEvento,
      sede: pdfData.sede,
      conceptos: JSON.stringify(conceptos),
      condiciones: pdfData.condiciones,
      subtotal: subtotal,
      iva: iva,
      total: total,
      linkPdf: '',
      estado: 'Nueva',
      creadoPor: BNK_AUTH.currentUser ? BNK_AUTH.currentUser.uid : ''
    };

    BNK_DB.cotizaciones.create(firestoreData).then(function () {
      doc.save('Cotizacion-BNK-' + folio + '.pdf');
      BNKToast.ok('Cotización ' + folio + ' generada.');
      _limpiar();
    }).catch(function (err) {
      BNKToast.error('Error: ' + err.message);
    }).finally(function () {
      btn.disabled = false; btn.textContent = 'GENERAR COTIZACIÓN';
    });
  }

  function _limpiar() {
    ['bnkEmpresa','bnkContacto','bnkTelefono','bnkCorreo','bnkEvento','bnkFechaEvento','bnkFolioMNT'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('bnkSede').value = 'MUNET';
    document.getElementById('bnkConceptosBody').innerHTML = '';
    _conceptoCounter = 0;
    _agregarFila();
    _setCondiciones('estandar');
    document.getElementById('bnkPlantilla').value = 'estandar';
    _recalcularTotales();
  }

  // ── Bind ──
  function _bindEvents() {
    _setupAutocomplete();

    document.getElementById('bnkAddRow').addEventListener('click', _agregarFila);
    document.getElementById('bnkPlantilla').addEventListener('change', function () {
      _setCondiciones(this.value);
    });
    document.getElementById('bnkGenerar').addEventListener('click', _enviar);
    document.getElementById('bnkLimpiar').addEventListener('click', _limpiar);

    // PDF style toggle
    document.querySelectorAll('#bnkPdfToggle .pdf-style-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#bnkPdfToggle .pdf-style-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        _pdfStyle = this.getAttribute('data-style');
      });
    });
  }

  // ── Init ──
  BNK_AUTH.onReady(function (user) {
    if (user) init();
  });
})();
```

- [ ] **Step 6: Commit**

```bash
git add panel/js/pages/cotizar-bnk.js
git commit -m "feat(panel): formulario COTIZAR BNK con conceptos, autocompletado y PDF dual"
```

---

### Task 7: Seed de venues en Firestore y deploy

Crear script para insertar los 8 venues en la colección catálogo de Firestore, y hacer deploy.

**Files:**
- No crea archivos permanentes — se ejecuta desde la consola del navegador

**Interfaces:**
- Consumes: `BNK_DB.catalogo.create()` ya disponible en el panel
- Produces: 8 documentos en colección `catalogo` con categoría "Venues"

- [ ] **Step 1: Insertar venues desde la consola del navegador**

Después del deploy, abrir `bunker-panel.web.app`, loguearse como admin, abrir la consola del navegador (F12), y ejecutar:

```javascript
var venues = [
  { categoria: 'Venues', concepto: 'EXPLANADA', unidad: 'día', precio: 300000, precioWeekend: 350000, precioMontaje: 150000, activo: true },
  { categoria: 'Venues', concepto: 'FORO', unidad: 'día', precio: 200000, precioWeekend: 250000, precioMontaje: 100000, activo: true },
  { categoria: 'Venues', concepto: 'LOBBY', unidad: 'día', precio: 230000, precioWeekend: 280000, precioMontaje: 150000, activo: true },
  { categoria: 'Venues', concepto: 'AUDITORIO', unidad: 'día', precio: 60000, precioWeekend: 60000, precioMontaje: 0, activo: true },
  { categoria: 'Venues', concepto: 'JARDÍN SOCIAL', unidad: 'día', precio: 70000, precioWeekend: 70000, precioMontaje: 0, activo: true },
  { categoria: 'Venues', concepto: 'SALAS CAPACIT.', unidad: 'día', precio: 20000, precioWeekend: 0, precioMontaje: 0, activo: true },
  { categoria: 'Venues', concepto: 'VELARIA', unidad: 'día', precio: 80000, precioWeekend: 80000, precioMontaje: 0, activo: true },
  { categoria: 'Venues', concepto: 'BLACK BOX', unidad: 'día', precio: 150000, precioWeekend: 150000, precioMontaje: 75000, activo: true }
];
venues.forEach(function(v) { BNK_DB.catalogo.create(v).then(function(r) { console.log('Creado:', r.id, v.concepto); }); });
```

- [ ] **Step 2: Deploy a Firebase Hosting**

```bash
firebase deploy --only hosting --project bunker-panel
```

- [ ] **Step 3: Verificar funcionamiento**

1. Abrir `bunker-panel.web.app`, loguearse
2. Tab COTIZAR MNT: completar paso 1, paso 2, seleccionar espacios, seleccionar fechas, generar PDF
3. Tab COTIZAR BNK: llenar empresa, agregar conceptos, generar PDF
4. Tab COTIZACIONES: verificar que las cotizaciones creadas aparecen
5. Tab CATÁLOGO: verificar que los 8 venues aparecen y se pueden editar precios

- [ ] **Step 4: Commit final (si hubo ajustes)**

```bash
git add -A && git commit -m "fix(panel): ajustes post-verificación del cotizador integrado"
```

---

## Resumen de Tasks

| # | Task | Archivos principales | Dependencias |
|---|---|---|---|
| 1 | Setup: logo, jsPDF, tabs, secciones | dashboard.html, logo-data.js | — |
| 2 | Catálogo: campos Venues | dashboard.html, catalogo.js | — |
| 3 | CSS: wizard + BNK | panel.css | — |
| 4 | HTML: wizard MNT + form BNK | dashboard.html | Task 1 |
| 5 | JS: cotizar-mnt.js | cotizar-mnt.js | Tasks 1, 3, 4 |
| 6 | JS: cotizar-bnk.js | cotizar-bnk.js | Tasks 1, 3, 4 |
| 7 | Seed venues + deploy + verificar | — | Tasks 1-6 |

**Tasks 1, 2, 3 son independientes** y pueden ejecutarse en paralelo.
**Task 4 depende de Task 1** (necesita las secciones vacías).
**Tasks 5 y 6 son independientes entre sí** pero dependen de 1, 3, 4.
**Task 7 depende de todo** (es el cierre).

## Nota de continuidad

Si la sesión se agota antes de completar, este plan queda en `docs/superpowers/plans/2026-08-12-migracion-cotizador-panel.md`. Verificar los checkboxes `- [x]` para saber qué tasks están hechas. Los commits incrementales permiten retomar desde cualquier punto.
