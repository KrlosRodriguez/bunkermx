# Fechas por Venue — Spec de Diseño

**Fecha:** 2026-08-01
**Estado:** Aprobado
**Contexto:** El cliente solicita eliminar la selección de fechas del Paso 1 (Datos de contacto) y mover la selección de fechas al Paso 3, donde cada espacio/venue tiene su propio calendario para seleccionar días individuales, con navegación libre a cualquier año futuro.

---

## 1. Paso 1 — Datos de Contacto

### Eliminar
- Bloque HTML completo de "FECHAS DEL EVENTO" (botón trigger `#v2CalTrigger`, popup `#v2CalPopup`, inputs hidden `#v2FechaInicio` y `#v2FechaFin`).
- CSS asociado al calendario del Paso 1 (`.v2-cal-field`, `.v2-cal-trigger`, `.v2-cal-popup`, `.v2-cal-header`, `.v2-cal-grid`, etc.).

### Mantener
- Campos: Cliente, Agencia, Evento, Contacto, Teléfono, Correo, Asistentes.

### Validación
- `isStep1Valid()` ya no requiere `v2FechaInicio`. Solo valida campos obligatorios de contacto (Cliente, Contacto, Teléfono o Correo).

---

## 2. Paso 2 — Tipo de Evento

### Eliminar
- Div `#v2DatesBreakdown` y su renderizado (`renderDatesBreakdown()`).

### Mantener
- Selector Privado/Público.
- Campo Descripción del evento.
- Campos Hora Inicio / Hora Fin.

---

## 3. Paso 3 — Espacios (cambio principal)

### Calendario por venue
Cada card de espacio seleccionado incluye un **calendario mensual navegable** como selector principal de fechas.

#### Estructura del calendario
- Grid de 7 columnas (LUN–DOM), igual al calendario existente visualmente.
- Navegación con flechas ‹ › para cambiar mes/año.
- **Sin límite superior de año** — el usuario puede navegar a 2027, 2028, etc.
- **Fechas pasadas bloqueadas** — no se pueden seleccionar.
- Mes inicial: mes actual.

#### Selección de días
- Click en un día lo **selecciona** (toggle on). Click de nuevo lo **deselecciona** (toggle off).
- Los días seleccionados se marcan visualmente (fondo destacado, similar al estilo actual de rango).
- Se pueden seleccionar días no consecutivos, en diferentes meses/años.
- Cada venue mantiene su propio array `eventDays: string[]` (formato `YYYY-MM-DD`).

#### Desglose en tiempo real
Debajo del calendario de cada venue se muestra:
- Conteo: "X días LUN–JUE (regular) · Y días VIE–SÁB (premium)"
- Precio calculado: `(X × tarifa regular) + (Y × tarifa premium)`
- Se actualiza inmediatamente al seleccionar/deseleccionar un día.

#### Montaje
- Input de días de montaje se mantiene igual, debajo del desglose de fechas.

#### Validación
- Botón "VER PRECOTIZACIÓN" se habilita solo si al menos un espacio tiene ≥ 1 día seleccionado.

---

## 4. Paso 4 — Precotización (Resumen y PDF)

### Resumen
- Fila "FECHAS" (`#v2ResFechas`): cambia de rango global a lista de fechas por espacio. Si son muchas, agrupar por mes (ej. "Ago: 15, 17, 20 · Sep: 3, 5").
- Fila "DÍAS" (`#v2ResDias`): total agregado de todos los espacios con desglose regular/premium.
- Cada espacio en `#v2ResEspacios` muestra sus propias fechas seleccionadas y su desglose.

### PDF
- Refleja las fechas por venue (no rango global).
- El payload de `collectFormData()` ya no incluye `fechaInicio`/`fechaFin` globales; cada espacio lleva su array `eventDays`, `diasRegular`, `diasWeekend`, `diasTotal`.

---

## 5. Cambios en JavaScript (`js/cotizador-munet.js`)

### Eliminar
- `calcDaysBreakdown()` — calculaba desglose global desde rango.
- `renderDatesBreakdown()` — renderizaba desglose en Paso 2.
- `getEventDates()` — generaba array de fechas del rango global.
- `handleCalClick(dateStr)` — máquina de estados para selección de rango.
- `renderCalPopup()` — renderizaba calendario del Paso 1.
- `updateCalDisplay()` — actualizaba texto del trigger.
- `syncEventDays()` — sincronizaba eventDays con rango global.
- Variable global `daysBreakdown`.
- Variables de estado del calendario: `calSelectState`, `calViewMonth`, `calViewYear`.

### Agregar
- `renderSpaceCalendar(spaceId)` — renderiza calendario mensual navegable dentro de la card del espacio. Cada espacio tiene su propio estado de navegación (mes/año visible).
- `toggleSpaceCalDay(spaceId, dateStr)` — agrega/quita fecha del array `selected[spaceId].eventDays` y re-renderiza.
- `updateSpaceBreakdown(spaceId)` — calcula y muestra desglose regular/premium y precio debajo del calendario.

### Adaptar
- `getSpaceDaysBreakdown(sp)` — ya no necesita fallback al `daysBreakdown` global; opera exclusivamente desde `selected[id].eventDays`.
- `calcSpaceRenta(sp)` — sin cambios, ya opera sobre desglose per-venue.
- `buildCards()` — integra el calendario navegable en cada card de espacio seleccionado.
- `collectFormData()` — elimina campos globales de fechas; cada espacio incluye `eventDays[]`, `diasRegular`, `diasWeekend`, `diasTotal`.
- `renderResumen()` — muestra fechas por espacio en vez de rango global.
- `generarPDFDoc()` — adapta sección de fechas para listar por venue.
- `isStep1Valid()` — elimina validación de fechas.
- Validación Paso 3: requiere ≥ 1 espacio con ≥ 1 día seleccionado.

---

## 6. Cambios en CSS (`css/cotizador-munet.css`)

- Reutilizar estilos del calendario existente (`.v2-cal-*`) adaptados al contexto per-venue.
- El calendario dentro de cada card de espacio usa el mismo grid/tipografía pero se ajusta al ancho de la card.
- Nuevo estilo para días seleccionados individualmente (en vez de rango con inicio/fin/medio).
- Se pueden limpiar estilos de `.v2-cal-field`, `.v2-cal-trigger` si ya no se usan en Paso 1.

---

## 7. Fuera de alcance

- Cambios en Google Apps Script (el backend recibe el payload que le manden, sin validación de fechas).
- Cambios en el dashboard de ventas.
- Disponibilidad de espacios por fecha (no hay sistema de reservas).
