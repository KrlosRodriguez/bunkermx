# Mejoras del Panel a partir de la auditoría de ROMA/14D — Design Spec

**Fecha:** 2026-10-27
**Alcance:** panel operativo (`/panel/`), `firestore.rules`, `storage.rules`. No toca el sitio público ni el cotizador legacy salvo donde se indica.
**Origen:** el cliente pidió revisar el panel contra la auditoría de traspaso del sistema ROMA/14D (STORY → HOLON, oct-2026), del que salió parte del diseño de este panel (finanzas, CxC con prefactura, expedientes de clientes/proveedores). Este documento es el resultado de cruzar esa auditoría contra el código actual (`main` @ `04ab7f3`).

> **Para Claude Code:** lee `CLAUDE.md` completo antes de empezar. Todas sus convenciones aplican (ES5 + Promise, IIFE, sin `!important`, subir `?v=N`, `_esc()` en todo HTML dinámico, verificar en navegador leyendo la consola). Trabaja **un lote a la vez**, en una rama por lote, y detente al terminar cada lote para que Carlos lo revise. No avances al siguiente sin su visto bueno.

---

## 0. Contexto: qué encontró la auditoría de 14D y qué aplica aquí

| Hallazgo en ROMA/14D | ¿Aplica al panel? | Lote |
|---|---|---|
| Candado: no modificar costos sin cotización / re-bloqueo al rechazar | **Sí, parcial.** La UI no edita cotizaciones, pero las reglas dejan a `ventas` modificar cualquier campo de cualquier cotización (incluso `Cerrada`) y regresar estados sin control | A1 |
| Validación/rechazo de cotizaciones; validación de proyectos con pérdida | **Sí.** No existe aprobación por margen | B1 |
| Bitácora de cambios del proyecto | **Parcial.** Solo se registra el cambio de estado; al borrar una cotización se borra su historial | A3 |
| Activar/desactivar en lugar de borrar (`activo` en todas las tablas) | **Sí.** Clientes, proveedores, partners, CxC y cotizaciones se borran físicamente (catálogo ya tiene `activo`) | A2 |
| Comprobantes con fecha y quién los subió (`archivo_x_fecha`, `archivo_x_id_cargo`) | **Sí.** `pagos` solo tiene `referencia` en texto; Storage no tiene ruta para pagos ni CxC | C1 |
| Facturas ligadas al proyecto por ID | **Sí.** `cuentasCobrar.folioProyecto` y `cliente` son texto libre, sin FK | C2 |
| Presupuestado vs real por proyecto | **Sí.** Costo estimado (REPORTES) y pagos reales (FINANZAS) nunca se cruzan por cotización | C3 |
| Sandbox dentro de producción | **Sí, pospuesto.** Los canales de preview usan la misma Firestore que producción; el staging separado queda fuera de este alcance por decisión de Carlos (ver *Cómo probar*) | — |
| Respaldos sin automatizar | **Ya cubierto.** Carlos configuró los respaldos de Firestore en consola | — |
| Módulo de Gastos generales | No existe; lo decide el cliente | D |
| Carga masiva de costos | No existe; lo decide el cliente | D |
| Git, reglas de negocio documentadas, dependencias fijadas | **Ya cubierto** (mejor que ROMA) | — |

Fuera de alcance de este documento: visibilidad del repo (lo resuelve Carlos aparte) y LFPDPPP (requiere abogado).

---

## Cómo probar (sin ambiente de staging)

No hay proyecto de staging: los canales de preview (`firebase hosting:channel:deploy`) escriben en la **Firestore de producción**. Por eso:

- **Reglas:** se prueban **siempre** primero en el emulador (`firebase emulators:start --only firestore,storage`). Si falta el bloque `emulators` en `firebase.json`, agregarlo (firestore 8080, auth 9099, storage 9199, ui). Ninguna regla nueva se despliega sin haber pasado por el emulador.
- **UI:** usar un canal de preview, pero crear solo registros de prueba claramente marcados (cliente y evento con el prefijo `PRUEBA-AUDITORIA`) y, al terminar, listarlos en el resumen del lote para que Carlos los anule o borre. No modificar ni cambiar de estado registros reales.
- No tocar `.firebaserc` ni `firebase-config.js` para apuntar a otro proyecto.

---

## Lote A — Integridad de datos

### A1. Candado de cotizaciones en el servidor

**Problema:** `match /cotizaciones/{docId}` permite `create, update` a admin y ventas sobre **cualquier campo**. Con la consola del navegador, un usuario de ventas puede cambiar `total`, `conceptos` o `desgloseVenues` de una cotización `Cerrada`, o moverla de `Ejecutado` a `Recorrido`.

**Regla de negocio:**
- Estados abiertos: `Recorrido`, `Cotizada`, `Negociación` (y el legacy `Nueva`).
- Estados cerrados: `Cerrada`, `En Producción`, `Ejecutado`.
- Estados finales: `Cancelada`, `Perdida`, `Anulada` (nuevo, ver A2).
- **Ventas** puede, en una cotización abierta, cambiar el estado a cualquiera y vincular o desvincular el cliente.
- **Ventas**, en una cotización cerrada, solo puede avanzar (`Cerrada → En Producción → Ejecutado`) y vincular o desvincular el cliente. No puede regresarla a abierta ni tocar montos.
- **Producción** puede pasar `En Producción → Ejecutado` (hoy `eventos.js:719` lo intenta con rol producción y la regla lo rechaza: es un bug que hay que corregir en el mismo cambio).
- **Admin** puede todo, incluido reabrir.
- Estados finales: solo admin puede sacarlas de ahí.

**Implementación en `firestore.rules`:** usar `request.resource.data.diff(resource.data).affectedKeys()`, que **sí** compara solo lo modificado. Esto evita el problema documentado de `hasOnly()` sobre el documento completo. Esbozo:

```
function cambios() { return request.resource.data.diff(resource.data).affectedKeys(); }
function soloCampos(lista) { return cambios().hasOnly(lista); }
function estadoAntes() { return resource.data.get('estado', 'Recorrido'); }
function estadoDespues() { return request.resource.data.get('estado', estadoAntes()); }
function abierto(e) { return e in ['Nueva','Recorrido','Cotizada','Negociación']; }
function avanceCerrado(a, d) {
  return a == d
    || (a == 'Cerrada' && d in ['En Producción','Ejecutado'])
    || (a == 'En Producción' && d == 'Ejecutado');
}
```

- `update` admin: permitido.
- `update` ventas, cuando `abierto(estadoAntes())`: permitido si `soloCampos([...])` incluye `estado`, `clienteId`, `clienteNombre`, `updatedAt` **más los campos que hoy escriben los flujos de ventas sobre cotizaciones existentes**. Antes de escribir la lista, Claude Code tiene que hacer `grep` de todos los `cotizaciones.update(` y `collection('cotizaciones').doc(...).update/set` del panel y armarla desde el código, no desde este documento.
- `update` ventas, cuando el estado está cerrado: `soloCampos(['estado','clienteId','clienteNombre','updatedAt'])` y `avanceCerrado(estadoAntes(), estadoDespues())`.
- `update` producción: `soloCampos(['estado','updatedAt'])`, con `estadoAntes() == 'En Producción'` y `estadoDespues() == 'Ejecutado'`.
- Agregar `produccion` donde corresponda sin abrirle nada más.

**UI (`cotizaciones.js`, `pipeline.js`):** en el `<select>` de estado y en las columnas del kanban, deshabilitar o rechazar del lado cliente las transiciones que la regla negaría (con un toast que explique por qué). No basta con la regla: el kanban tiene que regresar la tarjeta a su columna.

**Importante:** el Apps Script escribe por REST con el token OAuth del dueño, que **no pasa por las reglas**, así que este cambio no lo rompe. Aun así, verificar que las cotizaciones creadas desde el cotizador web sigan apareciendo.

**Verificación:**
- Emulador: tests manuales o un script con `@firebase/rules-unit-testing` (si se agrega, que quede en `scripts/` con instrucciones en CLAUDE.md) que cubra al menos: ventas mueve abierta→Cerrada ✔; ventas cambia `total` en Cerrada ✘; ventas regresa Cerrada→Cotizada ✘; producción En Producción→Ejecutado ✔; admin reabre ✔.
- En navegador (canal de preview, con una cotización `PRUEBA-AUDITORIA`): arrastrar en el kanban una tarjeta cerrada hacia una columna abierta con rol ventas → la tarjeta regresa y aparece un toast.

### A2. Borrado lógico en lugar de borrado físico

**Problema:** se borran documentos con historia. Además la ocupación de venues empata por **nombre**, así que perder o renombrar registros rompe el histórico en silencio.

**Diseño:**

| Colección | Hoy | Nuevo |
|---|---|---|
| `cotizaciones` | `delete` (admin) + borra `actividad` | Estado `Anulada` + `anulada: {por, porNombre, fecha, motivo}`. Se quita el botón eliminar de la UI. Se conserva el bloqueo actual si hay pagos/partners/eventos |
| `clientes`, `proveedores`, `partners` | `delete` | `activo: false` + `desactivadoPor`, `desactivadoEn`. Botón "Desactivar" / "Reactivar" |
| `cuentasCobrar` | `delete` (admin) | `cancelada: true` + motivo |
| `catalogo` | `delete` (ya tiene `activo`) | Usar `activo: false` en lugar de borrar |
| `pagos` | `delete` (admin) | `anulado: true` + motivo (no se borra un pago registrado) |

- **Regla de lectura en todos los lectores:** un documento sin el campo cuenta como activo (`d.activo !== false`, `!d.anulada`). Los registros legacy y los que escribe el Apps Script no traen esos campos.
- Listas y autocompletados (cotizar MNT/BNK, cascada de proveedores, vincular cliente, registrar pago) **excluyen** inactivos. Tablas de administración: filtro "Mostrar inactivos" apagado por defecto.
- REPORTES y FINANZAS excluyen `Anulada`, `cancelada` y `anulado` de los totales.
- `firestore.rules`: quitar `delete` de esas colecciones (dejar `allow delete: if false`, salvo `catalogo`, `servicios`, `bloques`, `tareas` y `plantillas`, que siguen igual). `cotizaciones/{id}/actividad` pasa a `delete: if false`.
- **Gotcha del Apps Script:** `writeToFirestore()` hace PATCH sin `updateMask` y **borra** campos que no conoce. Editar desde el dashboard legacy un cliente desactivado lo reactivaría (pierde `activo:false`). Agregar `updateMask.fieldPaths` en `writeToFirestore` para `clientes` y `proveedores` (los campos que el legacy sí maneja). Si no se hace en este lote, documentarlo en *Gotchas* de CLAUDE.md.

**Verificación:** desactivar un proveedor → no aparece en la cascada de COTIZAR BNK, pero sus cotizaciones históricas siguen mostrando su nombre. Anular una cotización → sale de REPORTES y del calendario, y su actividad sigue visible.

### A3. Bitácora completa de cotizaciones

**Problema:** `cotizaciones/{id}/actividad` solo recibe `cambio_estado`. Vincular o desvincular cliente, anular, aprobar/rechazar (B1) y la vinculación de proveedores no dejan rastro por cotización.

- Registrar en `BNK_DB.actividad.add(id, {...})` (y en `logActividad` cuando aplique): `cliente_vinculado`, `cliente_desvinculado`, `cotizacion_anulada` (con motivo), `aprobacion_solicitada`, `aprobacion_aprobada`, `aprobacion_rechazada` (con comentario) y `proveedores_vinculados`.
- Guardar `estadoAnterior` además del `estado` en `cambio_estado`.
- Agregar los tipos nuevos a `TIPO_ICONS`/`TIPO_TAB` en `actividad.js`. **Ojo:** `actividadGlobal` tiene lista blanca en las reglas (`tipo, entidad, entidadId, referencia, detalle, usuario, usuarioId, timestamp`): no agregar campos nuevos ahí, mete el detalle en `detalle`.
- En el popover de folio, una sección "Historial" con la línea de tiempo de la subcolección.

---

## Lote B — Control comercial

### B1. Aprobación por margen (BNK)

**Equivalente en ROMA:** `validar_cotizacion`, `porcentaje_utilidad_validado`, `valida_proyecto_perdida`.

**Config:** documento `config/aprobaciones` (lo edita admin; agregar una pequeña sección en USUARIOS o en FINANZAS):
```
{ margenMinimoPct: 20, requiereAprobacionPerdida: true, activo: true }
```

**Cálculo (en `cotizar-bnk.js` al guardar):**
- `costoEstimado = Σ(costoProveedor × cantidad)` de los conceptos en modo `proveedor`.
- `margenPct = (subtotal − costoEstimado) / subtotal × 100`. Usar **`subtotal` (sin IVA)**, no `total`.
- Si `costoEstimado == 0` (todo manual): `aprobacion.estado = 'no_requerida'`.
- Si `margenPct < margenMinimoPct` o `margenPct < 0`: `aprobacion = { estado: 'pendiente', margenPct, costoEstimado, solicitadoPor, fecha }`.
- Si no: `aprobacion.estado = 'no_requerida'`.
- Guardar `costoEstimado` y `margenPct` en la cotización. Así REPORTES ya no tiene que reparsear `conceptos`.
- Mostrar el margen en vivo en el formulario BNK, con un aviso amarillo o rojo cuando caiga bajo el umbral.

**Regla de negocio:** una cotización con `aprobacion.estado == 'pendiente'` o `'rechazada'` **no puede pasar a `Cerrada`** con rol ventas. Agregarlo a la regla de A1: si `estadoDespues() == 'Cerrada'` y el usuario no es admin, exigir `resource.data.get('aprobacion', {}).get('estado', 'no_requerida') in ['aprobada','no_requerida']`. Las cotizaciones legacy, sin el campo, pasan.

**Bandeja del director (admin):**
- En COTIZACIONES: KPI "POR APROBAR" (clicable, filtra) y filtro de estado de aprobación.
- En el popover de folio: botones APROBAR / RECHAZAR con comentario obligatorio al rechazar. Escribe `aprobacion.{estado, resueltoPor, resueltoNombre, fechaResolucion, comentario}` y registra en actividad (A3).
- Rechazar **no** borra nada. Ventas genera una cotización nueva corregida (no hay edición) y puede vincularla en las notas.
- Badge en la tarjeta del kanban cuando la aprobación está pendiente.

**MNT:** no tiene costos de proveedor, así que no aplica el margen. **Opcional, preguntar a Carlos antes de hacerlo:** pedir aprobación cuando el "precio especial por venue" quede por debajo de la tarifa del catálogo en más de X %.

**Verificación:** con umbral de 20 %, una BNK con margen de 12 % queda pendiente; ventas no puede moverla a Cerrada (ni por kanban ni por select ni por consola); admin la aprueba y entonces ventas sí puede.

---

## Lote C — Finanzas

### C1. Comprobantes de pago y de facturas

- Reusar `BNKDocumentos.render(container, { entidad, entityId })` con dos entidades nuevas:
  - `pagos` → tipos `comprobante_pago`, `complemento_pdf`, `complemento_xml`.
  - `cuentasCobrar` → tipos `factura_pdf`, `factura_xml`, `prefactura`, `orden_compra`.
- `storage.rules`: dos matches nuevos, `documentos/pagos/...` y `documentos/cuentasCobrar/...`, **solo admin** (igual que las colecciones). Para estas rutas el contentType permitido agrega `application/xml|text/xml`. No cambiar el regex de las rutas existentes.
- `firestore.rules`: subcolección `documentos` bajo `pagos/{id}` y `cuentasCobrar/{id}`, solo admin.
- `documentos.js` ya guarda fecha y quién subió; verificar que lo muestre. Si el XML no tiene preview, basta con un enlace de descarga.
- En la tabla de Cuentas por Pagar, un ícono 📎 si el pago tiene comprobante, y un KPI "Pagos sin comprobante".

### C2. Cuentas por cobrar ligadas a cotización y cliente

- En el modal de CxC, reemplazar el `folioProyecto` de texto libre por un autocomplete de cotizaciones (mismo patrón que "Registrar pago"). Al elegir una cotización, se llenan `cotizacionId`, `folioProyecto` (folio), `clienteId`, `cliente` (`cliente || empresa`) y `proyecto` (evento).
- Mantener los campos de texto denormalizados para mostrar.
- Registros existentes sin `cotizacionId`: badge "Sin vincular" y acción "Vincular" que intente empatar por `folioProyecto == folio`. **No** migrar automáticamente; solo sugerir.
- En el popover de folio de COTIZACIONES (admin): mostrar lo facturado y lo cobrado de esa cotización.

### C3. Cotizado vs real por cotización

Nueva sub-tab en FINANZAS, **RENTABILIDAD**, o una sección en REPORTES; Claude Code propone dónde antes de implementar. Una fila por cotización en `Cerrada`/`En Producción`/`Ejecutado` (sin `Anulada`):

| FOLIO | CLIENTE | VENTA (subtotal) | COSTO ESTIMADO | PAGADO REAL | FACTURADO | COBRADO | MARGEN EST. | MARGEN REAL |
|---|---|---|---|---|---|---|---|---|

- `PAGADO REAL` = Σ `pagos` (no anulados) con ese `cotizacionId`.
- `FACTURADO` / `COBRADO` = Σ `cuentasCobrar.montoSinIva` (no canceladas) con ese `cotizacionId` / con `fechaIngreso`.
- `MARGEN REAL` = `VENTA − PAGADO REAL`; resaltar en rojo cuando quede por debajo del margen estimado.
- Export CSV con `BNKExport.csv` + registro en `auditLog`, como el resto.

**Corrección relacionada (bug):** en `reportes.js` el margen se calcula como `total − costo`, pero `total` **incluye IVA** y `costoProveedor` no. El margen sale inflado. Cambiar a `subtotal` cuando exista (BNK lo guarda), con fallback a `total / 1.16` solo si no hay `subtotal`, y documentar el supuesto. Revisar también el P&L de `finanzas.js` (usa `montoSinIva` para ingresos y `pagos.monto` para egresos, que puede o no traer IVA): dejar una nota en la UI que diga qué se suma.

---

## Lote D — A decidir con el cliente (NO implementar sin confirmación)

- **D1. Gastos generales:** colección `gastos` (renta, nómina, servicios, viáticos) sin cotización, con categoría, comprobante (reusar C1) y que entre al P&L. Equivale al módulo *Gastos* de ROMA.
- **D2. Importación masiva:** importar servicios de proveedor o catálogo desde CSV, con vista previa, validación fila por fila y escritura en `batch()` de ≤ 500 operaciones, todo o nada por lote. A ROMA esto le falló por el hosting compartido; en Firestore se puede, pero solo si el cliente lo necesita.
- **D3. Lecturas al arranque:** `cotizaciones` se lee 4 veces (ver *Gotchas*). Unificar en un solo listener compartido. Solo si el volumen crece.

---

## Orden, ramas y entregables

1. Ramas: `panel/auditoria-a-integridad`, `panel/auditoria-b-aprobacion`, `panel/auditoria-c-finanzas`. Un PR o merge por lote.
2. Cada lote: reglas con emulador antes de desplegarlas; UI en canal de preview con registros `PRUEBA-AUDITORIA` (ver *Cómo probar*); subir `?v=N` de todo JS/CSS tocado; recorrer en navegador los tabs afectados con los roles admin, ventas y producción, leyendo la consola.
3. Al cerrar cada lote, actualizar `CLAUDE.md`: colecciones y campos nuevos, reglas, estados (`Anulada`), convenciones (borrado lógico, aprobación) y *Gotchas*.
4. Cambios en `firestore.rules` / `storage.rules`: listarlos explícitamente en el resumen del lote para que Carlos los revise antes del deploy a producción.
5. Deploy a producción de reglas y hosting **juntos** y en ese orden: primero reglas compatibles con el cliente viejo y el nuevo, luego hosting. Si una regla nueva rechazaría escrituras del cliente viejo, desplegar hosting primero.
