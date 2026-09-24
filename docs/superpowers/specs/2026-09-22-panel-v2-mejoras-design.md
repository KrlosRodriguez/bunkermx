# Panel Operativo V2 — Design Spec

**Fecha**: 2026-09-22
**Alcance**: 6 áreas de mejora para el panel operativo de BUNKER

---

## 1. Reportes Avanzados

### 1.1 Estado actual
`reportes.js` (200 líneas) solo consume `BNK_DB.cotizaciones.list()`. Muestra 4 widgets: funnel por estado (barras CSS), tabla mensual, top 10 clientes, y rendimiento (tasa conversión, ticket promedio, cot/semana). No cruza datos de costos ni proveedores. No tiene gráficas reales ni export.

### 1.2 Cambios

**Nuevas fuentes de datos:**
- `BNK_DB.cotizacionProveedores.list()` — para costos por cotización
- `BNK_DB.pagos.list()` — para egresos reales
- `BNK_DB.cuentasCobrar.list()` — para ingresos facturados
- Conceptos de cotizaciones BNK (`JSON.parse(d.conceptos)`) — para margen por concepto y revenue por categoría

**Nuevos KPIs (reemplazan los 4 actuales):**
| KPI | Cálculo |
|-----|---------|
| REVENUE CERRADO | `sum(total)` de cotizaciones en estados Cerrada/En Producción/Ejecutado |
| COSTO ESTIMADO | `sum(costoProveedor * cantidad)` de conceptos BNK en cotizaciones cerradas |
| MARGEN BRUTO | `revenue - costo`, con `%` = `(margen / revenue) * 100` |
| TASA CONVERSIÓN | `cerradas / total * 100` (se mantiene) |

**Widget 1 — Funnel de ventas (se mantiene, se mejora):**
- Sin cambios estructurales, solo agregar monto acumulado por estado
- Barras CSS existentes son suficientes

**Widget 2 — Revenue & Margen mensual (reemplaza "Actividad mensual"):**
- Tabla con columnas: MES | COTIZADAS | CERRADAS | REVENUE | COSTO | MARGEN | %
- Revenue = `sum(total)` de cerradas del mes
- Costo = `sum(costoProveedor * cantidad)` de conceptos proveedor en cotizaciones cerradas del mes (parseando `conceptos` JSON de cada cotización BNK)
- Margen = Revenue - Costo
- % = (Margen / Revenue) * 100
- Celda de % con color condicional: verde >30%, amarillo 15-30%, rojo <15%

**Widget 3 — Revenue por categoría (reemplaza "Top clientes"):**
- Agrupa conceptos de cotizaciones BNK cerradas por `categoria`
- Muestra: CATEGORÍA | REVENUE (precioUnit * cantidad) | COSTO (costoProveedor * cantidad) | MARGEN | %
- Barras horizontales proporcionales al revenue
- Solo cotizaciones con `fuente === 'BNK'` y estados cerrados

**Widget 4 — Top 10 clientes (se mueve aquí, con margen):**
- Igual que el actual pero agrega columna de margen estimado
- Solo clientes con cotizaciones cerradas

**Widget 5 — Utilización de venues (NUEVO):**
- Solo cotizaciones MNT con `desgloseVenues`
- Agrupa por espacio (FORO, JARDÍN SOCIAL, AUDITORIO, BLACK BOX, LOBBY)
- Muestra: ESPACIO | EVENTOS (count) | REVENUE | % del total
- Barras proporcionales

**Widget 6 — Rendimiento (se mantiene):**
- Mismos 4 indicadores: tasa conversión, ticket promedio, cot/semana, total

**Gráficas con Chart.js:**
- Agregar `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" defer>` en `dashboard.html`
- Widget 2 (Revenue & Margen mensual): chart de barras apiladas (revenue verde, costo rojo) con línea de margen %
- Widget 5 (Utilización venues): chart de dona/pie
- Los widgets 1, 3, 4, 6 se quedan con renderizado HTML (son más legibles como tablas/barras)

**Export CSV:**
- Botón "EXPORTAR CSV" junto al botón ACTUALIZAR en toolbar
- Exporta los datos del período seleccionado en formato CSV
- Columnas: Folio, Tipo, Cliente, Evento, Fecha, Estado, Total, Costo Estimado, Margen
- Usa `Blob` + `URL.createObjectURL` + `<a download>` pattern
- Registra en `BNK_DB.auditLog` (ya existe el patrón)

**Cálculo de margen — lógica detallada:**
Para cada cotización BNK cerrada:
1. Parsear `JSON.parse(d.conceptos)` 
2. Filtrar conceptos con `modo === 'proveedor'`
3. `costoTotal = sum(c.costoProveedor * c.cantidad)` — lo que BUNKER paga
4. `revenueTotal = d.total` — lo que el cliente paga (ya incluye todos los conceptos)
5. `margen = revenueTotal - costoTotal`
6. Nota: conceptos con `modo === 'manual'` no tienen costo proveedor — su margen es 100% (el revenue es ganancia directa)

Para cotizaciones MNT: no tienen conceptos con costos de proveedor, su `total` es revenue puro de venue. Se incluyen en revenue pero con costo = 0.

### 1.3 Archivos tocados
- `panel/js/pages/reportes.js` — reescritura mayor (~400-500 líneas estimadas)
- `panel/css/reportes.css` — agregar estilos para nuevos widgets, chart containers, CSV button
- `panel/dashboard.html` — agregar `<script>` de Chart.js con `defer`, actualizar HTML de `#sec-reportes` (nuevos KPIs, contenedores de chart)

---

## 2. Eventos / Producción Completo

### 2.1 Estado actual
`eventos.js` (456 líneas) muestra lista de eventos como cards con progress bar. Abre checklist view read-only (solo toggle completado). No permite crear eventos directamente, solo via `BNKEventos.crearEvento()` llamado desde pipeline. No hay asignación de responsables, ni fechas límite editables, ni CRUD de plantillas, ni edición de campos del evento.

### 2.2 Cambios

**Crear evento directamente:**
- Botón "NUEVO EVENTO" en toolbar (roles admin, ventas, produccion)
- Modal con campos: Nombre, Cliente, Fecha evento, Folio cotización (autocomplete opcional), Plantilla
- Si se elige plantilla, las tareas se pre-cargan. Si no, se crea evento vacío

**Editar evento:**
- Botón de editar en cada card (ícono lápiz) o desde checklist view
- Modal permite cambiar: nombre, cliente, fecha, estado
- No se puede cambiar la cotización vinculada (es FK)

**Asignación de responsables en tareas:**
- En checklist view, el campo `responsable` (hoy read-only y vacío) se convierte en un `<select>` inline
- Opciones: lista de usuarios del panel (`BNK_DB.usuarios.list()`)
- Al cambiar: `BNK_DB.tareas.update(eventoId, tareaId, { responsable: uid, responsableNombre: nombre })`
- Mostrar nombre en la columna de 120px existente (`.checklist-responsable`)

**Fechas límite editables en tareas:**
- En checklist view, el campo `fechaLimite` se convierte en `<input type="date">` inline
- Al cambiar: `BNK_DB.tareas.update(eventoId, tareaId, { fechaLimite: valor })`
- Si la tarea está vencida (fecha límite < hoy y no completada): clase `.checklist-item--overdue` con borde rojo

**Agregar tareas a evento existente:**
- Botón "+ TAREA" al final del checklist
- Inline: input de descripción + botón confirmar
- Crea tarea con `{ descripcion, completada: false, responsable: '', fechaLimite: '', orden: tareas.length }`
- Actualiza `tareasTotal` en el evento

**Eliminar tareas:**
- Botón × en cada tarea (solo admin)
- Confirma antes de borrar
- Actualiza `tareasTotal` y `tareasCompletadas` en el evento

**CRUD de plantillas:**
- Botón "GESTIONAR PLANTILLAS" en toolbar (solo admin)
- Modal con lista de plantillas existentes + botón "Nueva plantilla"
- Cada plantilla: nombre editable, lista de tareas con descripción
- Agregar/eliminar tareas de la plantilla
- Guardar: `BNK_DB.plantillas.create/update/delete()`

**Ordenamiento de tareas:**
- Las tareas ya tienen campo `orden` — aplicar `sort` por `orden` en `_renderChecklist`
- Drag & drop para reordenar (usando HTML5 Drag API nativo, sin librería)
- Al soltar: actualizar campo `orden` de todas las tareas afectadas

### 2.3 Archivos tocados
- `panel/js/pages/eventos.js` — reescritura mayor (~700-800 líneas estimadas)
- `panel/css/eventos.css` — agregar estilos para inline edits, overdue, add-task, plantillas CRUD
- `panel/dashboard.html` — agregar modales de crear/editar evento y gestionar plantillas en `#sec-eventos`

---

## 3. Pipeline con Drag & Drop y Filtros

### 3.1 Estado actual
`pipeline.js` (328 líneas) muestra kanban de 8 columnas con `onSnapshot` live. Cards muestran cliente, folio, evento, monto, tiempo en estado. Alertas cold/stale. Side panel con estado dropdown y timeline de notas. Sin drag & drop, sin filtros por tipo/fecha, sin totales ponderados.

### 3.2 Cambios

**Drag & drop para cambiar estado:**
- HTML5 Drag API nativo (sin librería externa)
- `draggable="true"` en `.pipeline-card`
- Eventos: `dragstart` (guarda cotizacionId + estado origen), `dragover` (previene default + clase visual en columna), `drop` (lee estado destino, actualiza Firestore)
- Al soltar en Cancelada/Perdida: confirmar con `BNKConfirm.show()`
- Actualización optimista: mover la card visualmente de inmediato, revertir si Firestore falla
- Registrar cambio en `actividad` subcollection (como ya hace el detail modal)
- Touch support: `touchstart`/`touchmove`/`touchend` con cálculo de posición

**Filtros:**
- Agregar debajo del toolbar actual:
  - Tipo: botones toggle MNT | BNK | TODOS (default TODOS)
  - Rango de fecha: `<input type="date">` desde/hasta (filtra por `fecha || createdAt`)
  - Monto mínimo: `<input type="number">` (filtra por `d.total >= monto`)
- Filtros se combinan con la búsqueda de texto existente (`#pipeSearch`)
- Estado de filtros se guarda en variables del módulo (no persiste entre sesiones)

**Totales ponderados por columna:**
- Ya se muestra `$X` total por columna — mantener
- Agregar debajo: porcentaje del pipeline total (`colTotal / pipelineTotal * 100`)
- En el header del board: mostrar pipeline total (suma de todas las columnas activas, excluyendo Cancelada/Perdida)

**Fix: BNK children search:**
- Actualmente busca en `filtered` (post-búsqueda), debería buscar en `_data` completo
- Cambiar: `_data.filter(x => x.folioMNT === d.folio)` en vez de `filtered.filter(...)`

**Fix: Cleanup del snapshot listener:**
- Llamar `_unsubscribe()` cuando el tab se desactiva o en `beforeunload`
- Previene memory leaks en sesiones largas

### 3.3 Archivos tocados
- `panel/js/pages/pipeline.js` — expansión significativa (~500-600 líneas estimadas)
- `panel/css/pipeline.css` — agregar estilos para drag visual, filtros, drop targets, touch feedback
- `panel/dashboard.html` — agregar filtros HTML en `#sec-pipeline`

---

## 4. Finanzas — Vista P&L y Aging

### 4.1 Estado actual
`finanzas.js` (1100 líneas) tiene 4 sub-tabs: Cuentas por Pagar (pagos a proveedores/partners), Partners CRUD, Dispersiones, Cuentas por Cobrar. KPIs separados por sub-tab. No existe vista consolidada P&L. Cuentas por Cobrar no tiene aging. No hay alertas de pagos vencidos.

### 4.2 Cambios

**Nuevo sub-tab: "P&L" (Profit & Loss):**
- Insertar como 5to sub-tab después de "Cuentas por Cobrar"
- Solo visible para admin
- Vista consolidada que cruza ingresos vs egresos

Contenido del sub-tab P&L:

**KPIs P&L:**
| KPI | Cálculo |
|-----|---------|
| INGRESOS PERÍODO | `sum(montoSinIva)` de cuentasCobrar con `fechaIngreso` en el período |
| EGRESOS PERÍODO | `sum(monto)` de pagos en el período |
| RESULTADO | Ingresos - Egresos |
| MARGEN OPERATIVO | `(Resultado / Ingresos) * 100` % |

**Tabla P&L mensual:**
- Filas: últimos 12 meses
- Columnas: MES | INGRESOS | EGRESOS PROV. | EGRESOS PARTNERS | TOTAL EGRESOS | RESULTADO | %
- Ingresos: `sum(montoSinIva)` de cuentasCobrar con `fechaIngreso` en el mes
- Egresos proveedores: `sum(monto)` de pagos tipo `proveedor` con `fechaPago` en el mes
- Egresos partners: `sum(monto)` de pagos tipo `partner` con `fechaPago` en el mes
- Resultado: Ingresos - Total Egresos
- Color condicional en resultado: verde si positivo, rojo si negativo

**Gráfica P&L:**
- Chart.js barras: ingresos (verde) vs egresos (rojo) por mes
- Línea superpuesta: margen %
- Mismo canvas pattern que reportes

**Aging buckets en Cuentas por Cobrar:**
- Agregar 4 KPIs de aging encima de la tabla existente de CxC:
  - CORRIENTE (0-30 días sin cobrar)
  - 30-60 DÍAS
  - 60-90 DÍAS
  - >90 DÍAS (con estilo `dash-card--warn`)
- Cálculo: días desde `fechaConfirmacion` (o fecha de creación si no hay confirmación) hasta hoy, para registros sin `fechaIngreso`
- Agregar columna "DÍAS" en la tabla de CxC mostrando antigüedad
- Rows con >90 días: clase `.fin-overdue` con fondo rojo sutil

**Alertas de pagos vencidos:**
- En Cuentas por Pagar: si un proveedor/partner tiene cuenta no cerrada y la cotización asociada está en estado `Ejecutado` (ya se entregó el servicio): mostrar badge "⚠ VENCIDO" en la tabla
- En CxC: si una factura tiene más de 30 días sin `fechaIngreso` y `prefacturaConfirmada === 'si'`: badge "⚠ VENCIDO"
- KPI en Cuentas por Pagar: agregar "PAGOS VENCIDOS" (count de cuentas con cotización Ejecutado sin cerrar)

**Filtro de período en P&L:**
- Select: Este mes | Trimestre | Semestre | Año | Todo
- Aplica a KPIs y tabla

### 4.3 Archivos tocados
- `panel/js/pages/finanzas.js` — expansión (~1300-1400 líneas estimadas)
- `panel/css/finanzas.css` — agregar estilos para P&L, aging badges, gráfica container
- `panel/dashboard.html` — agregar sub-tab P&L con KPIs, tabla, chart canvas, y aging KPIs en CxC

---

## 5. Calendario Mejorado

### 5.1 Estado actual
`calendario.js` (393 líneas) muestra vista mensual con grid de 7 columnas. Bloques coloreados (cotizado/confirmado/evento). Filtros por venue. Keyboard nav. Click en bloque navega a cotizaciones.

### 5.2 Cambios

**Vista semanal:**
- Botón toggle "MES | SEMANA" en toolbar (junto a prev/next/hoy)
- Vista semanal: grid de 7 columnas (LU-DO) pero con filas de hora (8:00 - 22:00, cada hora)
- Cada bloque se posiciona según hora de inicio/fin si existe, o como all-day si no
- Para cotizaciones MNT: `desgloseVenues` tiene `horario` si fue llenado en el wizard
- Para eventos sin hora: mostrar como barra en sección "Todo el día" arriba del grid
- Navegación: prev/next mueve por semanas en vez de meses
- "HOY" va a la semana actual
- Keyboard: ArrowLeft/Right navega semanas (en modo semana)

**Vista diaria (simplificada):**
- Click en un día del calendario mensual → abre vista de ese día
- Muestra lista vertical de todos los bloques del día con detalle expandido (cliente, evento, folio, estado, monto)
- Botón "Volver a mes" para regresar
- No es un timeline horario completo, es una lista detallada

**Export a Google Calendar / iCal:**
- Botón "EXPORTAR" en toolbar
- Genera archivo `.ics` con todos los eventos del mes/semana visible
- Formato iCalendar estándar (RFC 5545)
- Campos: SUMMARY (cliente + evento), DTSTART/DTEND (fecha), DESCRIPTION (folio + estado + monto), LOCATION (espacio/venue)
- Download via `Blob` + `<a download>`

**Mini mejoras:**
- Mostrar hora en bloques si está disponible (hoy solo muestra nombre truncado)
- Tooltip on hover con info completa (cliente, evento, folio, estado)
- Contador de bloques por día cuando hay más de 3 ("+2 más" clickeable que abre vista día)

### 5.3 Archivos tocados
- `panel/js/pages/calendario.js` — expansión significativa (~600-700 líneas estimadas)
- `panel/css/calendario.css` — agregar estilos para vista semanal, vista día, tooltips, overflow indicator
- `panel/dashboard.html` — agregar botones de toggle vista y export en toolbar de `#sec-calendario`

---

## 6. Feed de Actividad y Notificaciones

### 6.1 Estado actual
No existe ningún sistema de actividad global ni notificaciones. La subcollection `actividad` existe en cotizaciones (usada por pipeline para notas y cambios de estado) pero no hay feed centralizado. Los cambios en el panel no dejan rastro visible de quién hizo qué.

### 6.2 Cambios

**Colección `actividadGlobal` en Firestore:**
Schema de cada documento:
```
{
  tipo: string,       // 'cotizacion_creada', 'estado_cambio', 'pago_registrado', 
                      // 'cliente_creado', 'proveedor_creado', 'evento_creado',
                      // 'tarea_completada', 'partner_creado', 'cobrar_registrada'
  entidad: string,    // 'cotizacion', 'cliente', 'proveedor', 'evento', 'partner', 'cobrar'
  entidadId: string,  // Firestore doc ID
  referencia: string, // folio o nombre (para mostrar sin lookup)
  detalle: string,    // texto descriptivo corto
  usuario: string,    // nombre del usuario
  usuarioId: string,  // UID
  timestamp: FieldValue.serverTimestamp()
}
```

**Puntos de registro (instrumentación):**
Se agrega `_logActividad(data)` como función utilitaria. Se llama desde:
- `cotizar-mnt.js` → `_enviar()` después de guardar: tipo `cotizacion_creada`
- `cotizar-bnk.js` → `_enviar()` después de guardar: tipo `cotizacion_creada`
- `pipeline.js` → cambio de estado: tipo `estado_cambio` (ya registra en subcollection `actividad`, ahora también en global)
- `finanzas.js` → `_savePago()`: tipo `pago_registrado`
- `finanzas.js` → `_saveCobrar()`: tipo `cobrar_registrada`
- `finanzas.js` → `_savePartner()`: tipo `partner_creado`/`partner_editado`
- `clientes.js` → guardar cliente: tipo `cliente_creado`/`cliente_editado`
- `proveedores.js` → guardar proveedor: tipo `proveedor_creado`/`proveedor_editado`
- `eventos.js` → crear evento: tipo `evento_creado`
- `eventos.js` → completar tarea: tipo `tarea_completada`

**Widget de actividad en header:**
- Ícono de campana (🔔) en `.panel-user` del header, junto al nombre de usuario
- Badge con count de actividades de las últimas 24h
- Click abre dropdown/panel lateral con las últimas 20 actividades
- Cada entrada: ícono por tipo + texto + tiempo relativo ("hace 5 min", "hace 2h", "ayer")
- Click en una entrada navega al tab y registro correspondiente (via hash routing + search)
- Se carga con `BNK_DB.actividadGlobal.list()` ordenado por timestamp desc, limitado a 50

**Indicador en tab de Cotizaciones:**
- Badge numérico en el tab "COTIZACIONES" mostrando cotizaciones nuevas desde la última visita
- Se basa en `actividadGlobal` tipo `cotizacion_creada` con timestamp > última visita
- `lastVisited` se guarda en `localStorage` por usuario

**Firestore rules para `actividadGlobal`:**
```
match /actividadGlobal/{docId} {
  allow read: if isAuth();
  allow create: if isAuth() && hasOnly(['tipo','entidad','entidadId','referencia','detalle','usuario','usuarioId','timestamp']);
  allow update, delete: if false;
}
```

Nota: los registros son inmutables (no se editan ni borran). Para limpieza futura, un Cloud Function scheduled puede purgar registros >90 días.

### 6.3 Archivos tocados
- `panel/js/firestore.js` — agregar `actividadGlobal` collection API + función helper `BNK_DB.logActividad(data)`
- `panel/js/pages/actividad.js` — NUEVO archivo (~200 líneas) para el widget de actividad
- `panel/dashboard.html` — agregar ícono campana en header + dropdown HTML + cargar script
- `panel/css/panel.css` — agregar estilos para campana, badge, dropdown de actividad
- `firestore.rules` — agregar reglas para `actividadGlobal`
- Instrumentar 10+ archivos existentes con llamadas a `BNK_DB.logActividad()`

---

## Dependencias compartidas

### Chart.js
- CDN: `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`
- Con `defer` + `integrity="sha384-..."` + `crossorigin="anonymous"` (generar hash SRI al momento de implementar)
- No bloquea carga inicial
- Usado por: Reportes (widget revenue mensual, venues) y Finanzas (P&L mensual)
- Palette: usar tokens CSS del panel (`--g`, `--ylw`, `--red`, `--blu`) vía `getComputedStyle`

### Firestore rules
- Agregar `actividadGlobal` collection
- Actualizar `plantillas` collection si no tiene reglas (para CRUD desde panel)

### CSP
- Agregar `cdn.jsdelivr.net` a `script-src` en `firebase.json` para Chart.js

---

## Orden de implementación sugerido

1. **Reportes Avanzados** — es el cambio más impactante y el más independiente
2. **Pipeline D&D + Filtros** — mejora diaria inmediata para ventas
3. **Finanzas P&L + Aging** — completa la visibilidad financiera
4. **Eventos Completo** — habilita producción como módulo real
5. **Feed de Actividad** — requiere instrumentar otros módulos (mejor al final)
6. **Calendario Mejorado** — nice-to-have, menor impacto

---

## Fuera de alcance

- Integración CFDI/SAT (requiere servicio externo de facturación)
- Notificaciones push/email (requiere Cloud Functions + plan Blaze activo)
- Reconciliación bancaria automática
- Multi-idioma
- App móvil nativa
