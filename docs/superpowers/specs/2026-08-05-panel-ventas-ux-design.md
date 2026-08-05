# Panel de Ventas — UX Upgrade

**Fecha**: 2026-08-05
**Alcance**: `cotizador-munet/dashboard.html`, `js/pages/clientes.js`, `js/pages/proveedores.js`
**Archivos nuevos**: `js/pages/panel-ui.js`, `css/pages/panel-ui.css`

---

## Resumen

16 mejoras al panel de ventas interno organizadas en 4 bloques: feedback/confirmación, tablas profesionales, animaciones, y conectividad/accesibilidad. Todo el código compartido se centraliza en un módulo `panel-ui.js` + `panel-ui.css` que los tres contextos (cotizaciones inline, clientes, proveedores) consumen.

---

## Arquitectura

### Archivos nuevos

- **`js/pages/panel-ui.js`** — módulo IIFE que expone `window.BNKToast`, `window.BNKConfirm`, `window.BNKSort`, `window.BNKPagination`, `window.BNKExport`, `window.BNKAnimate`, `window.BNKAccessibility`.
- **`css/pages/panel-ui.css`** — estilos de toasts, modal de confirmación, skeleton loaders, animaciones de modales, indicadores de ordenamiento, controles de paginación, contador de resultados.

### Carga

Ambos archivos se incluyen en `dashboard.html` antes de `clientes.js` y `proveedores.js`:

```html
<link rel="stylesheet" href="../css/pages/panel-ui.css">
<script src="../js/pages/panel-ui.js"></script>
```

### Patrón de consumo

Cada módulo (`clientes.js`, `proveedores.js`, script inline de cotizaciones) llama a las utilidades de `panel-ui.js` sin conocer su implementación interna. Ejemplo:

```js
// Antes
alert('Cliente guardado correctamente');

// Después
BNKToast.ok('Cliente guardado correctamente');
```

---

## Bloque 1: Feedback y Confirmación

### 1. Sistema de toasts (`BNKToast`)

**Contenedor**: `#bnkToastContainer`, posición fija, esquina superior derecha, `z-index: 300`.

**Variantes**:

| Método | Borde izquierdo | Icono | Uso |
|--------|----------------|-------|-----|
| `BNKToast.ok(msg)` | `var(--g)` verde | ✓ | Éxito |
| `BNKToast.error(msg)` | `#ff4444` rojo | ✕ | Error servidor/conexión |
| `BNKToast.warn(msg)` | `var(--ylw)` amarillo | ⚠ | Validación, advertencia |

**Comportamiento**:
- Entra con `translateX(120%)` → `translateX(0)`, 250ms ease-out
- Permanece 3.5 segundos
- Sale con `opacity:1` → `opacity:0` + `translateX(40px)`, 200ms
- Máximo 4 toasts visibles; si hay más, el más antiguo se descarta
- Cada toast tiene botón ✕ para descarte manual

**Estilo**: fondo `var(--card)`, borde `1px solid var(--bd)`, borde izquierdo 3px del color de variante, tipografía Space Mono 12px, color `var(--tx)`.

**Reemplazos**: 24 `alert()` en `clientes.js` y `proveedores.js` se sustituyen:
- Validaciones (`'obligatorio'`, `'no configurada'`) → `BNKToast.warn()`
- Éxitos (post-guardado, post-eliminación) → `BNKToast.ok()`
- Errores (`'Error:'`, `'Error de conexión'`) → `BNKToast.error()`

### 2. Modal de confirmación (`BNKConfirm`)

**API**: `BNKConfirm.show(mensaje)` → devuelve `Promise<boolean>`.

**Estructura**: overlay propio con clase `.bnk-confirm-overlay`, reutilizando la estética del panel. Contenido centrado:
- Icono ⚠ grande en amarillo
- Texto del mensaje
- Dos botones: `CANCELAR` (gris, cierra) y `ELIMINAR` (rojo `#ff4444`, confirma)

**Animación**: misma que los modales principales (fade overlay + slide-up contenido).

**Reemplazos**: 3 `confirm()` nativos:
- `clientes.js:383` — eliminar cliente
- `proveedores.js:424` — eliminar proveedor
- `proveedores.js:709` — eliminar servicio

### 3. Validación de email

Al guardar cliente o proveedor, antes del fetch, validar todos los campos de tipo email con regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

Campos afectados:
- Clientes: `correoContacto`, `correoFacturacion`
- Proveedores: `correoContacto`, `correoFacturacion`

Si falla → `BNKToast.warn('Email no válido: [nombre del campo]')`, no se envía el request.

---

## Bloque 2: Tablas Profesionales

### 4. Columnas ordenables (`BNKSort`)

**API**: `BNKSort.apply(dataArray, columnKey, direction)` → retorna array ordenado (no muta el original).

- `direction`: `'asc'` o `'desc'`
- Detección automática de tipo: si el valor parece fecha (`DD/MM/YYYY` o ISO) → ordena como fecha; si es numérico → ordena como número; si no → ordena como string case-insensitive

**Columnas por tabla**:

| Tabla | Columnas ordenables |
|-------|-------------------|
| Cotizaciones | Folio, Fecha, Cliente, Evento, Monto, Estado |
| Clientes | No. Cliente, Status %, Empresa, Última Edición |
| Proveedores | No. Proveedor, Status %, Razón Social, Tipo, Fecha Alta, Última Edición |

**UI**: `<th>` con clase `.sortable`. Indicador `▲`/`▼` via pseudo-elemento `::after`. Estado activo: `color: var(--g)`. Click alterna asc → desc → asc. Cada tabla almacena su estado de sort actual en una variable local.

**Cursor**: `cursor: pointer` en headers ordenables, con `hover` que ilumina el header.

### 5. Paginación (`BNKPagination`)

**API**: `BNKPagination.paginate(filteredData, page, perPage)` → `{ rows: Array, currentPage: number, totalPages: number }`.

- `perPage`: 50 (constante)
- Si `page` excede `totalPages`, se ajusta al último

**Controles**: barra debajo de la tabla con:
- `« ANTERIOR` (deshabilitado en página 1)
- `Página X de Y` (texto central)
- `SIGUIENTE »` (deshabilitado en última página)

**Estilo**: botones con `background: var(--card)`, `border: 1px solid var(--bd)`, `color: var(--g)`. Deshabilitado: `opacity: 0.4`, `pointer-events: none`.

**Integración**: cada `renderTable()` pasa los datos filtrados+ordenados por `BNKPagination.paginate()` antes de generar HTML. Cambio de filtro/búsqueda resetea a página 1. Cambio de sort mantiene la página actual.

### 6. Contador de resultados

Un `<span>` con clase `.result-count` encima de cada tabla, a la derecha de los filtros.

Formato:
- Sin filtros activos: `"Mostrando 1–50 de 127 cotizaciones"`
- Con filtros: `"Mostrando 1–50 de 83 (127 total)"`
- Sin resultados: `"Sin resultados"`

Se actualiza en cada llamada a `renderTable()`.

### 7. Exportar CSV (`BNKExport`)

**API**: `BNKExport.csv(filename, headers, rows)`.

- `headers`: array de strings (nombres de columna)
- `rows`: array de arrays (datos por fila)
- Genera Blob con BOM UTF-8 (`\uFEFF` al inicio) para compatibilidad con Excel
- Valores con comas o comillas se escapan correctamente (RFC 4180)
- Descarga automática via `<a>` temporal con `URL.createObjectURL`

**Botón**: `⬇ EXPORTAR` en la barra de filtros de cada tabla. Exporta los datos filtrados completos (todas las páginas, no solo la visible).

**Nombres de archivo**: `cotizaciones_YYYY-MM-DD.csv`, `clientes_YYYY-MM-DD.csv`, `proveedores_YYYY-MM-DD.csv`.

### 8. Botón "Limpiar filtros"

Botón `✕ LIMPIAR` al final de la barra de filtros. Solo visible cuando al menos un filtro tiene valor no-default.

Al clickear:
- Resetea todos los `<input>` y `<select>` de la barra a su valor por defecto
- Dispara `renderTable()` (que resetea paginación y contador)

Detección de filtros activos: se compara el valor actual de cada input/select contra su `defaultValue`/primera opción.

### 9. Fecha de última edición

Columna nueva `ÚLT. EDICIÓN` en tablas de Clientes y Proveedores. Lee el campo `fechaModificacion` del backend. Formato: `DD/MM/YY`. Columna ordenable (incluida en el sort).

Si el campo viene vacío, muestra `—`.

---

## Bloque 3: Animaciones y Transiciones

### 10. Animación de modales

**Cambio de base**: los overlays pasan de `display:none/flex` a usar `visibility + opacity + pointer-events`:

```css
/* Estado cerrado */
.bnk-overlay {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease, visibility 0s 200ms;
}

/* Estado abierto */
.bnk-overlay.visible {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
  transition: opacity 200ms ease, visibility 0s;
}
```

**Modal interior** (`.bnk-modal`):

```css
.bnk-modal {
  transform: translateY(24px);
  opacity: 0;
  transition: transform 250ms ease-out 50ms, opacity 250ms ease-out 50ms;
}

.bnk-overlay.visible .bnk-modal {
  transform: translateY(0);
  opacity: 1;
}
```

Aplica a: `#bnkOverlay`, `#cliOverlay`, `#prvOverlay`, y el nuevo `#bnkConfirmOverlay`.

### 11. Loading state animado (skeleton shimmer)

Reemplazar los textos "CARGANDO DATOS..." por un skeleton loader:

- 3 barras rectangulares apiladas (alto 16px, ancho 100%/80%/60%, border-radius 4px)
- Fondo: `var(--card)`
- Shimmer: gradiente lineal `transparent → rgba(0,255,65,0.06) → transparent` barriendo de izquierda a derecha

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

Duración: 1.5s, infinite, ease-in-out.

La versión compacta para servicios dentro del modal usa una sola barra.

### 12. Count-up animado en KPIs (`BNKAnimate`)

**API**: `BNKAnimate.countUp(element, targetValue, options)`.

- `options.duration`: 800ms default
- `options.prefix`: `'$'` para montos
- `options.suffix`: `'%'` para porcentajes
- `options.separator`: `','` para miles

Usa `requestAnimationFrame` con easing ease-out (`1 - Math.pow(1 - t, 3)`).

Para montos, formatea con `$` y separador de miles en cada frame. Para porcentajes, agrega `%`.

**Stagger**: los 4 indicadores de cada sección se disparan con 100ms de delay entre sí (0ms, 100ms, 200ms, 300ms) para efecto cascada.

Se dispara en `updateIndicators()` de cada sección al recibir datos nuevos.

### 13. Transición entre tabs

**Tabs principales** (Cotizaciones / Clientes / Proveedores):
- Sección saliente: `opacity: 1 → 0`, 80ms ease-out
- Al completar: `display:none` en la saliente, `display:block` en la entrante
- Sección entrante: `opacity: 0 → 1`, 120ms ease-in
- Total: 200ms

**Tabs de modal** (General, Contacto, etc.):
- Misma mecánica, más rápido: 60ms + 80ms (140ms total)

Implementación: transición via JS (`element.style.opacity` + `transitionend` listener) para mantener compatibilidad con el `display:none/block` existente.

---

## Bloque 4: Conectividad y Accesibilidad

### 14. Link de cliente en cotizaciones

La celda del nombre del cliente en la tabla de cotizaciones se renderiza como `<span class="client-link">`. Estilo: `color: var(--g)`, `cursor: pointer`, `text-decoration: underline` on hover.

Al hacer click:
1. Buscar en `BNKClientes.getData()` por nombre (match case-insensitive, trim)
2. Si el tab Clientes no se ha cargado → llamar `BNKClientes.load()` y esperar
3. Si se encuentra → cambiar al tab Clientes y abrir modal con `BNKClientes.openDetail(clienteId)`
4. Si no se encuentra → `BNKToast.warn('Cliente no registrado en el CRM')`

Requiere que `clientes.js` exponga `getData()` y `openDetail(id)` en el IIFE público.

### 15. Focus trap en modales (`BNKAccessibility`)

**API**: `BNKAccessibility.trapFocus(overlayElement)` → retorna función `cleanup()`.

Al abrir un modal:
1. Se llama `trapFocus(overlay)` que registra un listener `keydown` en el overlay
2. Detecta elementos focuseables: `input:not(:disabled), select:not(:disabled), button:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])`
3. `Tab` en último → foco al primero; `Shift+Tab` en primero → foco al último
4. `Escape` → cierra el modal
5. Al cerrar, se llama `cleanup()` para remover el listener

Aplica a: los 3 overlays existentes + el modal de confirmación.

### 16. Accesibilidad de colores en badges

Agregar prefijo textual a todos los badges de estado para no depender solo del color:

**Badges de estado de cotización**:

| Estado | Antes | Después |
|--------|-------|---------|
| Pendiente | `Pendiente` (amarillo) | `◷ Pendiente` (amarillo) |
| Aprobada | `Aprobada` (verde) | `✓ Aprobada` (verde) |
| Rechazada | `Rechazada` (rojo) | `✕ Rechazada` (rojo) |
| Completada | `Completada` (verde) | `● Completada` (verde) |

**Badges de cuenta activa** (Clientes/Proveedores):

| Estado | Antes | Después |
|--------|-------|---------|
| Activa | dot verde | dot verde + "Activa" |
| Inactiva | dot rojo | dot rojo + "Inactiva" |

---

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `js/pages/panel-ui.js` | **Nuevo** — todas las utilidades compartidas |
| `css/pages/panel-ui.css` | **Nuevo** — todos los estilos compartidos |
| `cotizador-munet/dashboard.html` | Cargar panel-ui, skeleton loaders, controles de paginación/sort/export/limpiar/contador, badges accesibles, links de cliente, transiciones de tabs y modales, count-up en KPIs |
| `js/pages/clientes.js` | Reemplazar alert/confirm, consumir sort/paginación/export, exponer getData/openDetail, fecha edición, focus trap, validación email |
| `js/pages/proveedores.js` | Reemplazar alert/confirm, consumir sort/paginación/export, fecha edición, focus trap, validación email |

## Orden de implementación sugerido

1. `panel-ui.js` + `panel-ui.css` (infraestructura base)
2. Toasts + confirmación (bloque 1) — desbloquea todo lo demás
3. Sort + paginación + contador + CSV + limpiar filtros (bloque 2)
4. Animaciones: modales, skeleton, count-up, tabs (bloque 3)
5. Link cliente, focus trap, badges accesibles (bloque 4)
