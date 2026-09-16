# Requerimientos Cliente 14/09/2026 — Design Spec

> Requisitos capturados en reunión con cliente el 14 de septiembre de 2026.
> 10 requerimientos agrupados en 5 fases por dependencia técnica.

---

## Fase 1 — Schema de Servicios + Bloques de Categoría

### 1.1 Doble precio por servicio

**Problema**: cada servicio de proveedor solo tiene `costoUnitario`. Se necesitan dos precios: lo que cobra el proveedor y lo que se cobra al cliente.

**Solución**: agregar campo `precioCliente` a cada servicio. `costoUnitario` se mantiene como costo del proveedor (no se renombra para compatibilidad con datos existentes).

**Schema servicio** (`proveedores/{id}/servicios/{srvId}`):

```
{
  categoria: "Limpieza",          // texto libre (existente)
  servicio: "Limpieza profunda",  // nombre (existente)
  unidad: "Servicio",             // (existente)
  costoUnitario: 3500,            // costo proveedor (existente)
  precioCliente: 5000,            // NUEVO — precio sugerido al cliente
  bloqueId: "xxx",                // NUEVO — FK opcional a bloque
  createdAt, updatedAt            // (existentes)
}
```

**UI en Tab Servicios del proveedor** (proveedores.js):
- Tabla agrega columna "Precio cliente" junto a "Costo unitario"
- Formulario de agregar/editar servicio muestra ambos campos
- Labels: "Costo proveedor" y "Precio cliente"

### 1.2 Bloques de categoría

**Problema**: no existe forma de agrupar servicios bajo un nombre de bloque para seleccionarlos como paquete en cotizaciones BNK.

**Nueva subcolección** `proveedores/{id}/bloques/{bloqueId}`:

```
{
  nombre: "Paquete Limpieza",
  precioManual: 15000,          // precio override (opcional)
  usaPrecioManual: false,       // toggle: false = suma automática
  orden: 1,                     // para ordenar en UI
  createdAt, updatedAt
}
```

**Relación**: cada servicio tiene campo opcional `bloqueId`. Servicios sin `bloqueId` son servicios sueltos.

**UI en Tab Servicios del proveedor**:
- Botón **"+ Agregar bloque"** debajo de "+ Agregar concepto"
- Bloque se muestra como sección colapsable con header (nombre editable)
- Dentro del bloque: botón "Agregar servicio" crea servicios con ese `bloqueId`
- Header del bloque tiene toggle "Precio especial":
  - OFF: muestra subtotal calculado (Σ costoUnitario de servicios del bloque)
  - ON: campo editable de `precioManual`
- Servicios sueltos (sin bloque) se muestran como hoy, en tabla plana

**Archivos impactados**:
- `panel/js/pages/proveedores.js` — Tab Servicios: UI de bloques + doble precio
- `panel/dashboard.html` — markup del tab servicios (agregar columna + botón bloque)
- `panel/js/firestore.js` — agregar API para subcolección `bloques`
- `firestore.rules` — reglas para `bloques` subcolección

---

## Fase 2 — Cotizador BNK Rediseñado

### 2.1 Input dual: manual o desde proveedores

**Problema**: el cotizador BNK solo muestra conceptos del catálogo global. No integra servicios de proveedores.

**Nuevo flujo por fila de concepto**:

| Modo | Campos |
|---|---|
| **Manual** (default) | Categoría → Concepto (texto libre) → Cantidad → Precio → Unidad |
| **Proveedor** | Tipo servicio → Proveedor → Servicio/Bloque → Cantidad → Precio cliente (auto, editable) |

Toggle de modo al inicio de cada fila (ícono o switch).

**Modo Proveedor — cascada de selects**:
1. **Tipo de servicio**: categorías únicas de todos los servicios de proveedores activos
2. **Proveedor**: filtrado a proveedores que ofrecen servicios en esa categoría
3. **Servicio/Bloque**: servicios sueltos + bloques de ese proveedor en esa categoría. Si selecciona bloque, se expanden N líneas (una por servicio del bloque)
4. **Cantidad**: default 1, editable
5. **Precio cliente**: auto-llenado de `precioCliente` del servicio, editable

**Costo proveedor**: se guarda en el documento pero NO se imprime en el PDF del cliente.

### 2.2 Estructura de datos por concepto

Cada elemento del array `conceptos` en la cotización BNK:

```
{
  modo: "proveedor",              // o "manual"
  categoria: "Limpieza",
  concepto: "Limpieza profunda",
  cantidad: 2,
  precioUnitario: 5000,           // precio al cliente
  costoProveedor: 3500,           // costo real (solo modo proveedor)
  proveedorId: "xxx",             // FK al proveedor (solo modo proveedor)
  proveedorNombre: "CleanLimp",
  bloqueId: "yyy",                // si viene de bloque (opcional)
  bloqueNombre: "Paquete Limpieza",
  unidad: "Servicio"
}
```

### 2.3 Bloques en el PDF BNK

- Conceptos con `bloqueNombre` se agrupan bajo header del bloque
- Si `usaPrecioManual`: solo nombre del bloque + precio global
- Si no: cada servicio individual con su precio

### 2.4 Auto-vinculación de proveedores

**Al guardar la cotización BNK**, automáticamente:

1. Extraer `proveedorId` únicos de conceptos en modo "proveedor"
2. Calcular monto por proveedor: Σ(costoProveedor × cantidad)
3. Crear/actualizar en `cotizacionProveedores`:

```
{
  cotizacionId: "xxx",
  cotizacionFolio: "BNK-260915-0001",
  proveedorId: "yyy",
  proveedorNombre: "CleanLimp",
  montoTotal: 7000,
  servicios: ["Limpieza profunda x2"],
  autoVinculado: true
}
```

4. Aparece automáticamente en Cuentas por Pagar (finanzas.js)

### 2.5 Carga de datos

- **Collection group query** `collectionGroup('servicios')` para traer todos los servicios de todos los proveedores en una llamada
- Requiere índice compuesto en Firestore para la subcolección `servicios`
- Los bloques se cargan por proveedor seleccionado (lazy, son pocos)

**Archivos impactados**:
- `panel/js/pages/cotizar-bnk.js` — rediseño completo del flujo de conceptos
- `panel/dashboard.html` — markup de filas de concepto BNK
- `panel/js/firestore.js` — collection group query para servicios, API bloques
- `panel/js/pdf-rebuild.js` — agrupación de bloques en PDF BNK
- `panel/js/pages/finanzas.js` — verificar que cuentas por pagar refleje auto-vinculaciones
- `firestore.rules` — reglas para collection group query
- Índice Firestore — crear índice compuesto para `servicios` collection group

---

## Fase 3 — Vinculación de Clientes + Precio Especial MNT

### 3.1 Vincular cliente a cotización

**Problema**: la relación cotización↔cliente es por fuzzy match de nombre de empresa. No hay FK formal.

**Nuevo campo en cotizaciones**: `clienteId` (string), `clienteNombre` (string).

**Popover de folio** (cotizaciones.js):
- Nuevo botón **"Vincular cliente"** junto a partner/proveedor
- Auto-match: si `cotización.cliente` coincide (lowercase) con algún `cliente.empresa`, mostrar sugerencia con botón "Vincular"
- Manual: campo de búsqueda con autocomplete de clientes registrados
- Al vincular: guardar `clienteId` y `clienteNombre` en el documento

**Modal de cliente** (clientes.js):
- Lista de cotizaciones vinculadas usa `clienteId` (formal) + fuzzy match (legacy)
- Badge visual: "Vinculada" vs "Coincidencia por nombre"
- Botón "Vincular" en cotizaciones con solo match fuzzy

**Archivos impactados**:
- `panel/js/pages/cotizaciones.js` — popover: botón vincular cliente
- `panel/js/pages/clientes.js` — modal: vinculación formal + badges
- `panel/dashboard.html` — markup del popover (botón cliente)
- `panel/css/panel.css` — estilos del botón en popover

### 3.2 Precio especial Valeria y Lobby

**Problema**: los precios de venues vienen del catálogo sin opción de override por cotización.

**Solución**: en las cards de venues cuyo nombre contiene "Valeria" o "Lobby", agregar campo "Precio especial".

**UI en wizard MNT** (paso de selección de venues):
- Campo numérico "Precio especial" debajo del precio del catálogo
- Placeholder: precio normal del catálogo
- Si se llena: precio catálogo se muestra tachado, especial resaltado
- Si se deja vacío: usa precio del catálogo (comportamiento actual)

**Guardado** en `desgloseVenues`:

```
{
  nombre: "Valeria",
  precioOriginal: 25000,       // del catálogo
  precioEspecial: 18000,       // override (puede ser null)
  precio: 18000,               // el que se usa para cálculos
  dias: 2,
  ...campos existentes
}
```

**PDF**: imprime `precio` (el efectivo). No muestra el original tachado.

**Identificación**: por nombre del venue en catálogo — `nombre.includes('Valeria')` o `nombre.includes('Lobby')`.

**Archivos impactados**:
- `panel/js/pages/cotizar-mnt.js` — campo precio especial en cards Valeria/Lobby
- `panel/js/pdf-rebuild.js` — usar `precioEspecial || precio` en rebuild MNT
- `panel/dashboard.html` — markup del campo (si se genera dinámicamente, solo JS)

---

## Fase 4 — Fixes UX + Completitud

### 4.1 Toggle "No aplica" para % completitud

**Problema**: campos opcionales (cuenta bancaria extranjero) bajan el % aunque no apliquen al cliente/proveedor.

**Solución**: toggle "No aplica" por grupo de campos opcionales.

**Grupo identificado**: "Cuenta bancaria en el extranjero"
- Campos: `bancoExtranjero`, `cuentaIban`, `swiftBic`, `abaRouting`, `direccionBanco`

**Nuevo campo en documento**: `noAplicaExtranjero: boolean`

**UI**: checkbox/toggle "No aplica" en el header de la sección "Datos bancarios extranjero" del modal
- Si activado: campos se deshabilitan (grayed out), se excluyen del cálculo
- Si desactivado: comportamiento normal

**Cálculo modificado** (`calcCompletitud`):

```js
function calcCompletitud(obj) {
  const excluirExtra = obj.noAplicaExtranjero ? CAMPOS_EXTRANJERO : [];
  Object.keys(obj).forEach(function(key) {
    if (CAMPOS_EXCLUIDOS[key]) return;
    if (excluirExtra.includes(key)) return;
    total++;
    if (v !== undefined && v !== null && String(v).trim() !== '') llenos++;
  });
  return Math.round((llenos / total) * 100);
}
```

**Archivos impactados**:
- `panel/js/pages/clientes.js` — toggle UI + cálculo modificado
- `panel/js/pages/proveedores.js` — toggle UI + cálculo modificado
- `panel/dashboard.html` — markup del toggle en modales

### 4.2 Fix overflow dropdowns en modal de pagos

**Problema**: autocomplete `#finPagoCotAuto` con `position: absolute` se clipea por `overflow-y: auto` del modal body.

**Fix**: cambiar autocomplete dentro de modales a `position: fixed` con cálculo dinámico de posición basado en `getBoundingClientRect()` del input.

**Archivos impactados**:
- `panel/js/pages/finanzas.js` — posicionamiento dinámico del autocomplete
- `panel/css/panel.css` o `panel/css/finanzas.css` — ajuste de overflow/z-index

---

## Fase 5 — PDF Orden de Trabajo

### 5.1 Contenido

PDF por proveedor, estilo corporativo (blanco + dorado), generado con jsPDF.

**Secciones**:
1. **Header**: logo BUNKER, título "ORDEN DE TRABAJO", folio BNK, fecha
2. **Proveedor**: nombre, contacto (email, teléfono), folio PRV-XXXX
3. **Servicios requeridos**: tabla (Servicio | Cantidad | Unidad | Notas). Solo servicios de ESE proveedor. Bloques agrupados bajo header
4. **Detalles del evento**: fecha(s), espacio/venue (del MNT vinculado si existe), personal, horario
5. **Notas**: texto libre capturado en modal previo a descarga
6. **Footer**: referencia al folio, datos contacto BUNKER

### 5.2 Puntos de acceso

1. **Popover folio BNK** (cotizaciones.js): botón "Orden de trabajo". Si múltiples proveedores → selector
2. **Perfil proveedor** (proveedores.js): en cotizaciones vinculadas, botón "OT" por cotización

### 5.3 Modal previo

Antes de generar: modal con:
- Select de proveedor (si hay varios vinculados, pre-seleccionado si viene desde perfil)
- Campo de notas (textarea)
- Preview de servicios que se incluirán
- Botón "Descargar PDF"

**Archivos impactados**:
- `panel/js/pdf-workorder.js` — NUEVO módulo para generar PDF de orden de trabajo
- `panel/js/pages/cotizaciones.js` — botón en popover
- `panel/js/pages/proveedores.js` — botón en cotizaciones vinculadas
- `panel/dashboard.html` — modal de notas previo a descarga + script tag

---

## Resumen de archivos impactados

| Archivo | Fases |
|---|---|
| `panel/js/pages/proveedores.js` | 1, 4, 5 |
| `panel/js/pages/cotizar-bnk.js` | 2 |
| `panel/js/pages/cotizaciones.js` | 3, 5 |
| `panel/js/pages/cotizar-mnt.js` | 3 |
| `panel/js/pages/clientes.js` | 3, 4 |
| `panel/js/pages/finanzas.js` | 2, 4 |
| `panel/js/firestore.js` | 1, 2 |
| `panel/js/pdf-rebuild.js` | 2, 3 |
| `panel/js/pdf-workorder.js` | 5 (NUEVO) |
| `panel/dashboard.html` | 1, 2, 3, 4, 5 |
| `panel/css/panel.css` | 3, 4 |
| `panel/css/finanzas.css` | 4 |
| `firestore.rules` | 1, 2 |

## Notas técnicas

- **Firestore índice**: se necesita índice compuesto para `collectionGroup('servicios')` — crear desde consola Firebase
- **No se toca Apps Script**: los cambios de schema (precioCliente, bloqueId) son solo en Firestore. Si en el futuro se quiere sync con Sheets, se agrega en otra iteración
- **Backward compatibility**: `costoUnitario` no se renombra. Conceptos en modo "manual" siguen funcionando exactamente como hoy. Cotizaciones existentes sin `clienteId` siguen mostrando fuzzy match
- **Horario 24h MNT**: ya funciona así (HTML time inputs). No requiere cambio
- **PDF corporativa MNT**: ya existe (toggle neon/corporativa). No requiere cambio
