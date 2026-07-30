# Calendario para selección de fechas — Cotizador MUNET

**Fecha:** 2026-07-30
**Estado:** Aprobado

## Contexto

El cliente quiere reemplazar los inputs de fecha y los checkboxes de días por venue con calendarios visuales. Dos componentes: un calendario global (popup) en paso 1 para seleccionar rango de fechas, y mini-calendarios inline por venue en paso 3 para personalizar días.

## Componente 1: Calendario global (Paso 1)

### Qué reemplaza
Los dos `<input type="date">` de fecha inicio y fecha fin.

### UI
- Un botón/trigger que muestra el rango seleccionado (ej: "28 JUL — 05 AGO") o placeholder "SELECCIONAR FECHAS" si no hay rango.
- Al hacer click abre un popup/dropdown posicionado debajo del botón.
- Grid de calendario mensual con encabezados LUN MAR MIÉ JUE VIE SÁB DOM.
- Flechas `<` `>` para navegar entre meses.
- Header del popup muestra "MES AAAA" (ej: "JULIO 2026").

### Interacción
- Primer click en un día = establece fecha inicio (se resalta ese día).
- Segundo click en otro día = establece fecha fin (se resalta el rango completo entre ambos).
- Si fecha fin < fecha inicio, se intercambian automáticamente.
- Si ya hay rango seleccionado y se hace click, se reinicia (nuevo inicio).
- El popup se cierra automáticamente al seleccionar el segundo día (rango completo).
- Click fuera del popup lo cierra sin cambios.

### Estilos
- Fondo del popup: oscuro, consistente con `--v2-card` / `rgba(5,9,5,.95)`.
- Borde: `var(--v2-bd)` con accent `var(--v2-g)`.
- Días entre semana: texto en `var(--v2-g)` (verde).
- Días fin de semana (vie-sáb): texto en `var(--v2-go)` (dorado).
- Día seleccionado (inicio/fin): fondo verde sólido, texto oscuro.
- Rango intermedio: fondo `rgba(0,255,65,.1)`.
- Día hover: borde verde sutil.
- Días del mes anterior/siguiente: no se muestran (celdas vacías).
- Tipografía: `Space Mono` para números, `Rajdhani` para labels.

### Datos
- Los valores de fecha inicio/fin se siguen almacenando internamente igual (formato YYYY-MM-DD).
- La función `getEventDates()` sigue funcionando sin cambios.
- `calcDaysBreakdown()` sigue funcionando sin cambios.

## Componente 2: Mini-calendario por venue (Paso 3)

### Qué reemplaza
- Los checkboxes de días (`v2-day-check`) dentro de cada card de espacio.
- Los botones rápidos (TODOS / ENTRE SEMANA / FIN DE SEMANA).
- El resumen colapsable y botón toggle de días.

### UI
- Grid compacto de calendario que solo muestra las semanas que contienen días del rango del evento.
- Encabezados: L M M J V S D (abreviados a 1 letra para ser compactos).
- Cada día del rango es un cuadro clickeable.
- Días fuera del rango: celdas vacías (no visibles).
- Se muestra dentro de la card del espacio, debajo del label "DÍAS DEL EVENTO PARA ESTE ESPACIO".

### Interacción
- Click en un día activo lo desactiva (y viceversa).
- No se permite desactivar todos los días: si queda 1 solo día activo, no se puede quitar.
- Todos los días inician activos (seleccionados) al agregar un venue.

### Estilos
- Día activo entre semana: fondo `var(--v2-g)`, texto oscuro.
- Día activo fin de semana: fondo `var(--v2-go)`, texto oscuro.
- Día inactivo: fondo transparente, texto tenue `rgba(200,236,200,.25)`, borde sutil.
- Hover: borde más visible.
- Tamaño de celda: ~32x32px, gap 2-3px.
- El grid usa `display: grid; grid-template-columns: repeat(7, 1fr)`.

### Datos
- `selected[spaceId].eventDays` sigue siendo el array de fechas activas (sin cambios en la lógica).
- `toggleSpaceDay()` sigue funcionando para activar/desactivar.
- Se elimina `quickSelectDays()` (ya no hay botones rápidos).
- Se elimina `daysExpanded` del estado (ya no hay colapso).

## Lo que NO cambia

- Estructura del wizard (4 pasos).
- Lógica de tarifas (regular/weekend por día).
- Cálculo de costos (`calcSpaceRenta`, `getSpaceDaysBreakdown`).
- Montaje (selector +/- de días).
- Desglose en cards, resumen (paso 4) y PDF.
- `renderDatesBreakdown()` en paso 2 (muestra desglose de días LUN-JUE / VIE-SÁB).

## Archivos afectados

- `cotizador-munet/index.html` — reemplazar inputs de fecha por botón trigger, quitar checkboxes de venue.
- `cotizador-munet/css/cotizador-munet.css` — nuevos estilos para calendario popup y mini-calendario. Eliminar estilos de `.v2-day-check`, `.v2-days-quick`, `.v2-days-summary`, `.v2-days-toggle`, `.v2-days-picker--collapsed`.
- `cotizador-munet/js/cotizador-munet.js` — nuevo render de calendario popup y mini-calendario. Eliminar `quickSelectDays()`, lógica de `daysExpanded`, event listeners de botones rápidos y toggle.

## Dependencias externas

Ninguna. Todo es vanilla JS/CSS, sin librerías de calendario.
