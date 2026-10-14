# Días de montaje y desmontaje en cotizaciones MNT — Especificación

**Fecha**: 2026-10-14
**Fuente**: requerimiento del cliente (HaDeZ), sesión 2026-10-14
**Alcance**: solo `/panel/` (wizard COTIZAR MNT y tab CALENDARIO). No toca el sitio público, el cotizador legacy `/cotizador-munet/`, el Apps Script ni `cotizar-bnk.js`.

---

## 1. Requerimiento

Al cotizar un evento MNT se deben poder reservar días de **montaje** (antes del evento) y de
**desmontaje** (después del evento). Esos días ocupan físicamente el espacio, así que:

1. Se eligen desde el wizard con un contador por venue.
2. Se pintan en el calendario del wizard con un color distinto al de los días de evento, y quedan
   bloqueados: no se pueden usar como día de evento.
3. Cuando la cotización pasa a **Cerrada**, esos días quedan bloqueados en los calendarios del panel,
   mostrando los días de evento y diferenciando por color los de montaje y los de desmontaje.

## 2. Estado actual del código

- `panel/js/pages/cotizar-mnt.js` (1028 líneas) — el montaje existe solo como **cantidad**
  (`_selected[vid].montajeDays`, stepper más/menos). No tiene fechas asociadas. **No existe desmontaje.**
- El calendario del wizard (`_buildCalendarDays`) solo deshabilita fechas pasadas y, para
  `SALAS CAPACIT.`, los viernes y sábados. **No consulta la ocupación de otras cotizaciones**: el
  wizard nunca carga la colección `cotizaciones`.
- `desgloseVenues` (JSON string en Firestore) guarda por venue: `nombre`, `diasRegular`,
  `diasWeekend`, `diasTotal`, `montajeDays`, `eventDays[]`, precios, `renta`, `montaje`, `total`.
  Lo leen `calendario.js`, `reportes.js`, `pdf-rebuild.js` y la doble escritura del Apps Script.
- `calendario.js` (`_getBloquesDelDia`) cruza `eventDays` contra la fecha y clasifica en tres tipos:
  `cotizado` (ámbar), `confirmado` (verde, estados `Cerrada` / `En Producción` / `Ejecutado`) y
  `evento` (cian, documentos de la colección `eventos`).

## 3. Decisiones de diseño

Tomadas con el cliente el 2026-10-14:

| Decisión | Elección |
|---|---|
| Cómo se eligen los días | Stepper de cantidad; las fechas se **derivan** como días contiguos |
| Tarifa del desmontaje | La misma `precioMontaje` del catálogo de Venues (sin campo nuevo) |
| Efecto de una cotización cerrada | **Bloqueo duro** de esos días en el wizard, por venue |
| Colores | Evento `#00FF41` (sin cambio) · Montaje `#8B5CF6` violeta · Desmontaje `#FF8C42` naranja |

Supuestos adicionales, asumidos explícitamente:

- **Días naturales, no hábiles.** Si el evento es lunes y se piden 2 días de montaje, se toman el
  sábado y el domingo previos. El espacio se ocupa físicamente sin importar el día de la semana.
- La restricción "`SALAS CAPACIT.` no abre viernes ni sábado" aplica **solo a días de evento**.
  Montaje y desmontaje pueden caer en cualquier día.
- Solo los estados `Cerrada`, `En Producción` y `Ejecutado` bloquean. Una cotización en `Cotizada`
  o `Negociación` no reserva fechas.

---

## 4. Regla de derivación

El estado del wizard **no almacena** las fechas de montaje. `_selected[vid]` guarda únicamente
`eventDays`, `montajeDays` y `desmontajeDays`; las fechas se calculan al vuelo con una función pura
cada vez que se renderiza o se calcula, y solo se materializan al guardar en Firestore. Así no
pueden desincronizarse del evento.

```
_deriveDates(eventDays, montajeDays, desmontajeDays):
  si eventDays está vacío -> { montajeDates: [], desmontajeDates: [] }
  ordenados = eventDays.slice().sort()
  primero   = ordenados[0]
  ultimo    = ordenados[ordenados.length - 1]
  montajeDates    = N días naturales inmediatamente ANTES de `primero`,  en orden ascendente
  desmontajeDates = M días naturales inmediatamente DESPUÉS de `ultimo`, en orden ascendente
```

- Con fechas de evento no contiguas (14 y 20 de octubre), el montaje va antes del 14 y el
  desmontaje después del 20.
- Cada venue del acordeón tiene sus propios contadores y su propia derivación.
- La aritmética de fechas se hace con `new Date(y, m-1, d)` y `setDate(+/-1)` para evitar los
  corrimientos de zona horaria de `Date.parse` sobre cadenas ISO.

### 4.1 Validación del stepper

El botón de incremento **no incrementa** y muestra un `BNKToast.warn` cuando el día que se derivaría:

| Caso | Mensaje |
|---|---|
| No hay días de evento seleccionados | `Selecciona primero los días del evento.` |
| Cae en una fecha pasada | `El <montaje\|desmontaje> caería en una fecha pasada.` |
| Choca con un día ocupado por una cotización cerrada del mismo venue | `No disponible: <folio> ocupa el <d mmm>.` |
| Choca con un día de evento del mismo venue (fechas con huecos) | `Ese día ya es día de evento.` |

Los mensajes se parametrizan con la palabra `montaje` o `desmontaje` según el stepper que se pulsó.

El botón de decremento nunca falla; baja hasta 0.

Al **quitar o agregar días de evento** se recalcula la derivación. Si por el cambio los días
derivados dejan de ser válidos (quedan en el pasado o chocan con ocupación), los contadores se
recortan automáticamente al máximo válido y se avisa con un toast.

---

## 5. Esquema de datos

Cambio **aditivo** sobre cada entrada de `desgloseVenues`. Los lectores que no conocen los campos
nuevos (Apps Script, cotizador público) siguen funcionando sin cambios.

| Campo | Estado | Ejemplo |
|---|---|---|
| `eventDays` | existe | `["2026-10-14","2026-10-15"]` |
| `montajeDays` | existe | `2` |
| `montajeDates` | **nuevo** | `["2026-10-12","2026-10-13"]` |
| `desmontajeDays` | **nuevo** | `1` |
| `desmontajeDates` | **nuevo** | `["2026-10-16"]` |
| `montaje` | existe | `N x precioMontaje` |
| `desmontaje` | **nuevo** | `M x precioMontaje` |

En el documento de la cotización:

- `desmontajeTotal` — **nuevo**, suma de `desmontaje` de todos los venues.
- `montajeTotal` — existe, sin cambios.
- `subtotal` = `rentaTotal + montajeTotal + desmontajeTotal`; `iva` y `total` se recalculan sobre él.
- **`diasTotal` sigue contando solo días de evento.** No se altera la utilización de venues ni los
  KPIs de REPORTES.
- `fechas` (resumen legible) sigue construyéndose solo con `eventDays`.
- `fechaEvento` sigue siendo el **primer día de evento**, no el primer día de montaje: es la fecha
  comercial del evento y la usan el ordenamiento, PIPELINE y FINANZAS.

### 5.1 Compatibilidad hacia atrás

Las cotizaciones cerradas que ya existen tienen `montajeDays: 2` sin fechas. Los lectores aplican la
**misma regla de derivación** cuando falta `montajeDates`, así que las cotizaciones viejas también
bloquean sus días de montaje sin necesidad de migrar datos. `desmontajeDays` ausente se lee como `0`.

### 5.2 Borrador en sessionStorage

`_saveDraft` / `_restoreDraft` solo persisten campos de texto (`DRAFT_FIELDS`), no `_selected`.
No requieren cambios.

---

## 6. Bloqueo duro en el wizard

### 6.1 Índice de ocupación

En `init()`, junto a `BNK_DB.catalogo.list()` y `BNK_DB.clientes.list()`, se agrega
`BNK_DB.cotizaciones.list()` al `Promise.all`. Con el resultado se construye:

```
_ocupacion = {
  "VELARIA": {
    "2026-10-12": { folio: "MNT-261012-4471", tipo: "montaje" },
    "2026-10-14": { folio: "MNT-261012-4471", tipo: "evento" }
  }
}
```

- Se incluyen solo cotizaciones con `fuente === 'MNT'` y estado en
  `['Cerrada','En Producción','Ejecutado']`.
- Se indexa por **nombre** del venue, porque `desgloseVenues` guarda `nombre` (el `concepto` del
  catálogo), no el id del documento.
- Si `cotizaciones.list()` falla, el wizard **no se bloquea**: se registra en consola, `_ocupacion`
  queda vacío y se muestra un toast de advertencia. Cotizar sin verificación de ocupación es
  preferible a no poder cotizar.

**Limitación conocida y aceptada**: si un venue se renombra en CATÁLOGO, la ocupación histórica deja
de empatar. Migrar `desgloseVenues` a `venueId` queda fuera de alcance y se documenta en CLAUDE.md.

### 6.2 Render del calendario del wizard

`_buildCalendarDays` agrega estas clases por celda, en este orden de precedencia:

1. `.ocupado` — ocupado por otra cotización cerrada del mismo venue. No clickeable
   (`pointer-events:none`), atenuado con borde rojo tenue y `title="Ocupado — <folio> (<tipo>)"`.
2. `.montaje` / `.desmontaje` — día derivado de esta cotización. No clickeable, para que no pueda
   convertirse en día de evento por accidente. `title="Día de montaje"` / `"Día de desmontaje"`.
3. `.selected` / `.weekend` / `.disabled` — comportamiento actual, sin cambios.

La leyenda bajo el calendario pasa de una línea a tres entradas: weekend (ámbar, ya existe),
montaje (violeta) y desmontaje (naranja).

### 6.3 Steppers

El bloque `.mnt-montaje` actual se duplica en un contenedor con dos filas:

```
DÍAS DE MONTAJE    ($2,500 / DÍA)   [-] 2 [+]
DÍAS DE DESMONTAJE ($2,500 / DÍA)   [-] 1 [+]
```

Ambos leen `venue.precioMontaje`. Si es 0, la etiqueta dice `SIN COSTO` (comportamiento actual).

### 6.4 Resumen del acordeón

`_venueSummary(vid)` agrega los segmentos nuevos:
`"2 días evento, 2 montaje, 1 desmontaje"`.

---

## 7. Cálculo, resumen y PDF

- `_calcular()` deriva las fechas por venue, calcula `desmontaje = desmontajeDays x precioMontaje`,
  acumula `desmontajeTotal` y lo suma al `subtotal`.
- El paso 4 (RESUMEN) muestra, bajo el renglón de montaje y con el mismo formato:
  `Días desmontaje: M — $X`, y en los totales `Desmontaje total`.
  Las fechas derivadas se listan junto a las de evento:
  `Montaje: 12, 13 oct · Evento: 14, 15 oct · Desmontaje: 16 oct`.
- El PDF del wizard agrega el renglón `M día(s) desmontaje x $X` debajo del de montaje, y
  `Desmontaje total` en los totales. Aplica a las dos paletas (neon y corporativa).
- `panel/js/pdf-rebuild.js` replica exactamente los mismos renglones, con fallback a `0` cuando el
  documento no trae los campos (cotizaciones viejas), para que un PDF regenerado sea idéntico al
  original.

El paso 3 valida hoy que exista al menos un día de evento (`hasDays`). Esa validación **no cambia**:
montaje y desmontaje no sustituyen a los días de evento.

---

## 8. Tab CALENDARIO

### 8.1 Bloques nuevos

`_getBloquesDelDia(fecha)` deja de evaluar solo `eventDays`. Por cada cotización determina el tipo
de coincidencia:

```
si estado está en cerrados:
    si fecha está en eventDays        -> tipo 'confirmado'   (verde, como hoy)
    si fecha está en montajeDates     -> tipo 'montaje'      (violeta)
    si fecha está en desmontajeDates  -> tipo 'desmontaje'   (naranja)
si no:
    si fecha está en eventDays        -> tipo 'cotizado'     (ámbar, como hoy)
    montaje y desmontaje no se muestran
```

`montajeDates` / `desmontajeDates` se obtienen de un helper `_fechasOcupacion(cotizacion)` que
aplica la derivación del punto 4 cuando los campos no existen (cotizaciones previas a este cambio).

Una misma fecha puede generar varios bloques de cotizaciones distintas (por ejemplo, montaje de una
y evento de otra): se muestran como bloques independientes, y el contador "+N más" los incluye.
Dentro de una misma cotización una fecha nunca es de dos tipos, porque la derivación los excluye.

El filtro por venue y el filtro de estado existentes se aplican igual a los bloques nuevos.

### 8.2 Etiquetas y tooltip

- Label en el bloque: `MON ↑ <cliente>` y `DES ↓ <cliente>` (12 caracteres de cliente, como hoy).
- `_buildTooltip` antepone el tipo: `MONTAJE · cliente · evento · folio · espacio`.
- El clic navega al mismo destino que un bloque de evento (la cotización).

### 8.3 Tres vistas y leyenda

Las clases nuevas se definen para las tres vistas ya existentes:
`.cal-bloque--montaje` / `--desmontaje` (mes y semana) y
`.cal-day-item-tipo--montaje` / `--desmontaje` (vista día).

La leyenda de `panel/dashboard.html:1020` pasa de 3 a 5 chips:
Cotizado · Confirmado · Evento · **Montaje** · **Desmontaje**.

### 8.4 Export iCal

Montaje y desmontaje se exportan como `VEVENT` propios, con `SUMMARY` prefijado
(`MONTAJE — <cliente>`, `DESMONTAJE — <cliente>`) y el mismo `LOCATION` del espacio, para que al
importar a Google Calendar se vea la ocupación real del recinto.

---

## 9. CSS

Dos tokens nuevos en el `:root` de `panel/css/panel.css`:

```css
--montaje:    #8B5CF6;
--desmontaje: #FF8C42;
```

Se usan siempre vía token, nunca hardcodeados, y sin `!important` (convención del repo).
Los fondos de bloque siguen el patrón existente: `rgba(...,.12)` de relleno más borde o
`border-left` de 2px en el color sólido.

## 10. Archivos afectados

| Archivo | Cambio | Cache busting |
|---|---|---|
| `panel/js/pages/cotizar-mnt.js` | derivación, 2.º stepper, índice de ocupación, render, cálculo, resumen, PDF, payload | `?v=8` a `?v=9` |
| `panel/js/pages/calendario.js` | tipos de bloque nuevos, derivación de respaldo, tooltips, iCal | `?v=8` a `?v=9` |
| `panel/js/pdf-rebuild.js` | renglón de desmontaje | `?v=1` a `?v=2` |
| `panel/css/panel.css` | 2 tokens, clases del wizard, bloque de 2 steppers, leyenda | `?v=10` a `?v=11` |
| `panel/css/calendario.css` | clases en mes/semana/día, 2 chips de leyenda | `?v=8` a `?v=9` |
| `panel/dashboard.html` | 2 chips de leyenda más las versiones de arriba | — |
| `CLAUDE.md` | esquema de `desgloseVenues`, regla de derivación, nota en la doble escritura | — |

Sin cambios en `firestore.rules`: el esquema vive dentro de un campo JSON string que ya se escribe.

**Fuera de alcance**: cotizador público `/cotizador-munet/`, `google-apps-script-munet.js`,
`cotizar-bnk.js` y `reportes.js`. Se anota en CLAUDE.md que, si en el futuro se agrega montaje al
cotizador público, hay que actualizar también `writeToFirestore`.

---

## 11. Verificación

No hay tests automatizados en el repo. La verificación es manual contra `bunker-panel` después de
`firebase deploy --only hosting --project bunker-panel`, con esta lista:

1. Montaje 2 más desmontaje 1 sobre un evento del 14–15 de octubre: se pintan 12 y 13 en violeta y
   16 en naranja; el total suma 3 x `precioMontaje`.
2. Bajar los steppers a 0 despinta los días. Cambiar los días de evento recalcula la derivación sola.
3. El botón de incremento se bloquea con su toast en los cuatro casos de 4.1.
4. Guardar: en Firestore aparecen `montajeDates`, `desmontajeDates`, `desmontajeDays` y
   `desmontajeTotal`; el PDF lista los dos renglones en las dos paletas.
5. Pasar la cotización a `Cerrada`: CALENDARIO muestra los tres colores en las vistas de mes, semana
   y día; el iCal exporta los tres VEVENT.
6. Cotizar de nuevo el mismo venue en esas fechas: los días salen no clickeables con el folio en el
   tooltip. Otro venue en las mismas fechas sigue libre.
7. Una cotización cerrada **anterior a este cambio** (con `montajeDays` y sin fechas) sigue
   bloqueando sus días por derivación, y su PDF se regenera sin errores.
8. Responsive a 1440 / 1025 / 375 px: el bloque de dos steppers no rompe el acordeón en móvil.
