# Lote A — Integridad de datos: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el servidor —y no solo la UI— impida que una cotización cerrada cambie de monto o retroceda de estado, que ningún registro con historia se borre físicamente, y que toda acción sobre una cotización quede en su bitácora.

**Architecture:** Tres capas. (1) `firestore.rules` gana un candado por campo usando `diff().affectedKeys()`, que compara **solo lo modificado** y por eso no repite el fracaso de `hasOnly()` del 2026-10-13. (2) La lógica de qué transición es legal se extrae a `panel/js/estados.js` — módulo puro, sin DOM ni Firebase, igual que `ocupacion.js`— para que la UI y las reglas digan lo mismo y se pueda probar con `node`. (3) El borrado físico se reemplaza por marcas (`estado: 'Anulada'`, `activo: false`, `cancelada`, `anulado`) y las reglas pierden el `delete`.

**Tech Stack:** Firebase SDK compat 10.12.0, ES5 + Promise, Firestore Security Rules v2, emulador de Firestore, `@firebase/rules-unit-testing` como única dependencia nueva (dev-only, en la raíz).

**Spec:** `docs/superpowers/specs/2026-10-27-mejoras-auditoria-14d-design.md` (secciones A1, A2, A3 y *Cómo probar*)

## Global Constraints

- **ES5 + Promise** en todo el JS del panel: `var`, `function`, sin arrow, sin `async`. Cada módulo de página es un IIFE.
- **Sin build tools.** La dependencia nueva es solo para correr pruebas en la máquina; ningún archivo servido al navegador la importa.
- **Nunca `!important`.** Tokens de `panel/css/panel.css`, no valores hardcodeados.
- **Todo HTML dinámico pasa por el `_esc()` del módulo** (en `clientes.js`/`proveedores.js` se llama `_escapeHTML()`).
- **Subir `?v=N` en `panel/dashboard.html` de cada JS/CSS tocado**, también entre deploys de la misma tarea: una vez servida, una versión se cachea 1 h.
- **Texto visible al usuario en español.**
- **Ninguna regla se despliega sin haber pasado por el emulador** (*Cómo probar* del spec).
- **`node --check` no basta.** Toda tarea que toque JS del panel se cierra cargando la página en el navegador y leyendo la consola.
- **Modales:** `.bnk-overlay` + `.bnk-modal` con `.visible`. El `role="dialog"`, la trampa de foco y la devolución del foco los pone un helper genérico inline en `dashboard.html`; un modal nuevo solo necesita la misma estructura.
- **`BNKConfirm.show(msg, okLabel?)` recibe exactamente dos parámetros.**
- El Apps Script escribe por REST con el token OAuth del dueño y **no pasa por las reglas**: ningún cambio de reglas lo rompe, pero tampoco lo protege.
- **No tocar `.firebaserc` ni `panel/js/firebase-config.js`** para apuntar a otro proyecto (*Cómo probar* del spec).

## Review Focus

Entradas que el spec implica y que ninguna tarea probaría si no se añade el test:

1. **Cotización sin campo `estado`** (registros pre-panel y los que crea el Apps Script): `estadoAntes()` tiene que resolver a `Recorrido` por defecto, no denegar la escritura. — test en Task 2.
2. **`FieldValue.delete()` cuenta como campo afectado.** Desvincular cliente borra `clienteId`/`clienteNombre`; si `affectedKeys()` no los incluyera como se espera, la lista blanca los dejaría pasar por accidente en lugar de a propósito. — test en Task 2.
3. **Desvincular cliente en una cotización *cerrada* con rol ventas** está permitido por el spec (es dato de vinculación, no monto). Fácil de romper al escribir la rama "cerrada". — test en Task 2.
4. **Documento de cliente/proveedor sin el campo `activo`** (todos los existentes y todo lo que escriba el Apps Script) cuenta como activo. Un `=== true` en lugar de `!== false` los desaparece a todos de las listas. — test en Task 6.
5. **Un pago anulado no debe contar como pago.** `finanzas.js` decide `cerrada`/`Parcial`/`Dispersado` sumando pagos; si la exclusión se olvida en uno de los tres sitios, una cuenta liquidada con pagos anulados se sigue viendo liquidada. — test en Task 7.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `firebase.json` | Bloque `emulators` (firestore 8080, auth 9099, storage 9199, ui 4000) | 1 |
| `package.json` (raíz, nuevo) | Solo `devDependencies` + scripts `test:rules`, `test:unit` | 1 |
| `scripts/test-rules.js` (nuevo) | Pruebas de `firestore.rules` contra el emulador | 1, 2, 5, 6, 7 |
| `scripts/README-tests.md` (nuevo) | Cómo correr las pruebas | 1 |
| `panel/js/estados.js` (nuevo) | `BNKEstados`: clasificación de estados y transiciones legales. Puro, sin DOM ni Firebase | 3 |
| `scripts/test-estados.js` (nuevo) | Pruebas de `BNKEstados` con `node`, sin dependencias | 3 |
| `firestore.rules` | Candado de cotizaciones; `delete: if false` | 2, 5, 6, 7 |
| `panel/js/pages/cotizaciones.js` | Select de estado acotado; Anular en lugar de Eliminar; sección Historial | 4, 5, 8 |
| `panel/js/pages/pipeline.js` | Kanban rechaza transiciones ilegales; excluye Anuladas | 4 |
| `panel/js/pages/clientes.js` | Archivar/Restaurar en lugar de Eliminar | 6 |
| `panel/js/pages/proveedores.js` | Archivar/Restaurar en lugar de Eliminar | 6 |
| `panel/js/pages/catalogo.js` | Quitar el borrado físico; solo activar/desactivar | 6 |
| `panel/js/pages/finanzas.js` | Archivar partners; cancelar CxC; anular pagos; excluirlos de totales | 7 |
| `panel/js/pages/cotizar-mnt.js`, `cotizar-bnk.js` | Excluir archivados de autocompletes y cascadas | 6 |
| `panel/js/pages/actividad.js` | Tipos nuevos en `TIPO_ICONS`/`TIPO_TAB` | 8 |
| `cotizador-munet/google-apps-script-munet.js` | `updateMask` en `writeToFirestore` | 9 |
| `panel/dashboard.html` | `?v=N`, `<script>` de `estados.js`, modales nuevos, opciones de filtro | varias |
| `panel/css/panel.css` | `.estado-Anulada`, `.row-archivada` | 4, 6 |
| `CLAUDE.md` | Colecciones, campos, estados, convenciones y gotchas nuevos | 10 |

**Decisión de nombres (resolver con Carlos antes de Task 6):** `clientes` y `proveedores` **ya** tienen `cuentaActiva` (`'Sí'`/`'No'`), un estado *comercial* editable en el modal, con filtro "Activas/Inactivas" y badge ACTIVA/INACTIVA. El borrado lógico es otra cosa. Para que no se lean como lo mismo, el campo nuevo es `activo: false` (consistente con `catalogo`) pero en la UI se llama **ARCHIVADO**: botón "ARCHIVAR"/"RESTAURAR" y filtro "Mostrar archivados". Nunca "inactivo".

---

## Task 1: Emulador y arnés de pruebas de reglas

Sin esto ninguna regla se puede cambiar con seguridad: es la razón por la que las listas blancas de 2026-10-13 llegaron a producción rotas.

**Files:**
- Modify: `firebase.json` (agregar `emulators` al nivel raíz, junto a `firestore`)
- Create: `package.json` (raíz), `scripts/test-rules.js`, `scripts/README-tests.md`
- Modify: `.gitignore` (confirmar que `node_modules/` ya está; agregarlo si no)

**Interfaces:**
- Produces: `scripts/test-rules.js` expone, para las tareas siguientes:
  - `test(nombre, promesa)` — registra el resultado
  - `assertAllow(promesa)` / `assertDeny(promesa)`
  - `db(rol)` → Firestore autenticado como un usuario con ese rol (`admin` | `ventas` | `produccion` | `lectura` | `inactivo`); `dbSinAuth()`
  - `seed(ruta, datos)` — escribe con `withSecurityRulesDisabled`
  - `updCol(rol, coleccion, id, data)` → `db(rol).collection(coleccion).doc(id).update(data)`, **sin** inyectar `updatedAt`
  - `AHORA` (`FieldValue.serverTimestamp()`) y `BORRAR` (`FieldValue.delete()`)
- El resumen final imprime `OK n / FALLO m` y sale con código ≠ 0 si hay fallos.

- [ ] **Step 1: Agregar el bloque `emulators` a `firebase.json`**

```json
"emulators": {
  "firestore": { "port": 8080 },
  "auth": { "port": 9099 },
  "storage": { "port": 9199 },
  "ui": { "enabled": true, "port": 4000 },
  "singleProjectMode": true
}
```

- [ ] **Step 2: Crear `package.json` en la raíz**

Solo `devDependencies` y scripts; `"private": true`. Dependencia: `@firebase/rules-unit-testing` ^4. Scripts: `"test:rules": "node scripts/test-rules.js"`, `"test:unit": "node scripts/test-ocupacion.js && node scripts/test-estados.js"`.

- [ ] **Step 3: Instalar y confirmar que el emulador arranca**

Run: `npm install` y, en otra terminal, `firebase emulators:start --only firestore --project bunker-panel`
Expected: `firestore: Emulator started at http://127.0.0.1:8080`. `node_modules/` no aparece en `git status` (ya está en `.gitignore`).

- [ ] **Step 4: Escribir el arnés en `scripts/test-rules.js` con una prueba de humo**

Usa `initializeTestEnvironment({ projectId: 'bunker-panel', firestore: { rules: readFileSync('firestore.rules'), host: '127.0.0.1', port: 8080 } })`. En el arranque, `withSecurityRulesDisabled` siembra `usuarios/u-admin`, `usuarios/u-ventas`, `usuarios/u-produccion` y `usuarios/u-lectura` con `{nombre, email, rol, activo: true}` más `usuarios/u-inactivo` con `activo: false` — las reglas resuelven el rol leyendo esos documentos. Prueba de humo, que pasa con las reglas **actuales** y por tanto valida el arnés y no las reglas:

```
test('ventas lee cotizaciones', assertAllow(db('ventas').collection('cotizaciones').get()))
test('sin sesion no lee cotizaciones', assertDeny(dbSinAuth().collection('cotizaciones').get()))
test('usuario inactivo no lee cotizaciones', assertDeny(db('inactivo').collection('cotizaciones').get()))
test('ventas no lee pagos', assertDeny(db('ventas').collection('pagos').get()))
```

- [ ] **Step 5: Correr el arnés contra las reglas actuales**

Run: `npm run test:rules` (con el emulador levantado)
Expected: `OK 4 / FALLO 0`, código de salida 0.

- [ ] **Step 6: Documentar en `scripts/README-tests.md`**

Las dos terminales, los puertos, que el emulador **no** toca la Firestore de producción, y que `npm install` solo se necesita para `test:rules` (`test:unit` corre sin dependencias).

- [ ] **Step 7: Commit**

```bash
git add firebase.json package.json package-lock.json scripts/test-rules.js scripts/README-tests.md
git commit -m "test(panel): emulador de Firestore y arnes de pruebas de reglas"
```

---

## Task 2: A1 — candado de cotizaciones en `firestore.rules`

**Files:**
- Modify: `firestore.rules:61-75` (bloque `match /cotizaciones/{docId}`)
- Modify: `scripts/test-rules.js`

**Interfaces:**
- Consumes: los helpers de Task 1.
- Produces: en `firestore.rules`, las funciones `cambios()`, `soloCampos(lista)`, `estadoAntes()`, `estadoDespues()`, `abierto(e)`, `avanceCerrado(a,d)` y `esFinal(e)`, definidas dentro del `match` de cotizaciones. La lista blanca de ventas es exactamente `['estado','clienteId','clienteNombre','updatedAt']` — verificada contra las cinco únicas escrituras del panel (`cotizaciones.js:359`, `:1087`, `:1101`, `eventos.js:719`, `pipeline.js:224`) más el `updatedAt` que inyecta `collectionAPI.update()` en `firestore.js:52`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Siembra con reglas desactivadas `cot-abierta` (`estado: 'Cotizada'`, `total: 100000`), `cot-cerrada` (`estado: 'Cerrada'`, `total: 100000`, `clienteId: 'c1'`), `cot-produccion` (`estado: 'En Producción'`), `cot-final` (`estado: 'Cancelada'`) y `cot-legacy` (**sin** campo `estado`, `total: 5000`).

```
// ventas, cotización abierta
test('ventas avanza abierta a Cerrada',        assertAllow(upd('ventas','cot-abierta',{estado:'Cerrada'})))
test('ventas vincula cliente en abierta',      assertAllow(upd('ventas','cot-abierta',{clienteId:'c1',clienteNombre:'ACME'})))
test('ventas NO cambia total en abierta',      assertDeny (upd('ventas','cot-abierta',{total:1})))
test('ventas NO cambia conceptos en abierta',  assertDeny (upd('ventas','cot-abierta',{conceptos:'[]'})))

// ventas, cotización cerrada
test('ventas avanza Cerrada a En Producción',  assertAllow(upd('ventas','cot-cerrada',{estado:'En Producción'})))
test('ventas avanza Cerrada a Ejecutado',      assertAllow(upd('ventas','cot-cerrada',{estado:'Ejecutado'})))
test('ventas NO regresa Cerrada a Cotizada',   assertDeny (upd('ventas','cot-cerrada',{estado:'Cotizada'})))
test('ventas NO cambia total en Cerrada',      assertDeny (upd('ventas','cot-cerrada',{total:1})))
test('ventas desvincula cliente en Cerrada',   assertAllow(upd('ventas','cot-cerrada',{clienteId:BORRAR,clienteNombre:BORRAR})))

// producción
test('produccion cierra En Producción',        assertAllow(upd('produccion','cot-produccion',{estado:'Ejecutado'})))
test('produccion NO toca cotización abierta',  assertDeny (upd('produccion','cot-abierta',{estado:'Cotizada'})))
test('produccion NO cambia total',             assertDeny (upd('produccion','cot-produccion',{total:1})))

// estados finales y admin
test('ventas NO saca de Cancelada',            assertDeny (upd('ventas','cot-final',{estado:'Cotizada'})))
test('admin reabre Cancelada',                 assertAllow(upd('admin','cot-final',{estado:'Cotizada'})))
test('admin cambia total en Cerrada',          assertAllow(upd('admin','cot-cerrada',{total:1})))

// legacy sin campo estado (Review Focus 1)
test('ventas avanza legacy sin estado',        assertAllow(upd('ventas','cot-legacy',{estado:'Cotizada'})))
test('ventas NO cambia total en legacy',       assertDeny (upd('ventas','cot-legacy',{total:1})))

// lectura y creación
test('lectura NO escribe cotizaciones',        assertDeny (upd('lectura','cot-abierta',{estado:'Cerrada'})))
test('ventas crea cotización completa',        assertAllow(crear('ventas',{folio:'BNK-1',estado:'Recorrido',total:1000})))
```

`upd(rol, id, data)` es el atajo de `updCol(rol, 'cotizaciones', id, data)`. Una prueba aparte confirma que `{estado, updatedAt}` juntos también pasan — es exactamente lo que manda el cliente real, porque `collectionAPI.update()` inyecta `updatedAt` siempre. El `create` se prueba con el documento completo porque `cotizar-mnt.js`/`cotizar-bnk.js` escriben decenas de campos y ahí **no** hay lista blanca.

- [ ] **Step 2: Correr para verificar que fallan**

Run: `npm run test:rules`
Expected: FALLO en todas las que esperan `assertDeny` sobre montos (las reglas actuales dejan a ventas escribir cualquier campo); las `assertAllow` de producción también fallan (hoy la regla es `isAdminOrVentas`).

- [ ] **Step 3: Reescribir el `match /cotizaciones/{docId}` en `firestore.rules`**

Mantener `allow read: if isAuthenticated()` y `allow create: if isAdminOrVentas()` tal cual. Dividir `update` en tres ramas (admin; ventas según `abierto(estadoAntes())`; producción) y dejar `allow delete: if isAdmin()` **sin tocar** — lo cambia Task 4. `esFinal(e)` cubre `['Cancelada','Perdida','Anulada']`; `avanceCerrado` acepta `a == d` para que un update que no mueve el estado (solo vinculación) pase. Un comentario encima explica por qué `diff().affectedKeys()` sí sirve donde `hasOnly()` falló, y que la lista blanca se derivó de las cinco escrituras del panel, con la instrucción de regenerarla con `grep -rn "cotizaciones\.update(" panel/js/` al agregar una nueva.

- [ ] **Step 4: Correr hasta verde**

Run: `npm run test:rules`
Expected: `FALLO 0`.

- [ ] **Step 5: Confirmar que el cotizador público sigue entrando**

El Apps Script escribe por REST con el token OAuth del dueño y no pasa por las reglas, así que esto no debería cambiar nada — pero es la suposición más cara del lote si resulta falsa. Enviar una cotización de prueba desde el wizard público de `cotizador-munet/` (marcándola `PRUEBA-AUDITORIA`) y confirmar que aparece en COTIZACIONES del panel. Si no aparece, parar: la doble escritura sí pasa por reglas y toda la premisa de A1 cambia.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules scripts/test-rules.js
git commit -m "fix(panel): candado por campo y por estado en las reglas de cotizaciones"
```

---

## Task 3: `BNKEstados` — una sola fuente de verdad para las transiciones

La UI tiene que negar exactamente lo que niega la regla. Duplicar la tabla en `cotizaciones.js` y en `pipeline.js` garantiza que se desfasen.

**Files:**
- Create: `panel/js/estados.js`, `scripts/test-estados.js`
- Modify: `panel/dashboard.html` (cargar `estados.js?v=1` antes de los módulos de página, junto a `ocupacion.js`)

**Interfaces:**
- Produces: `window.BNKEstados` con
  - `TODOS` → array de los 9 estados en orden (`Recorrido, Cotizada, Negociación, Cerrada, En Producción, Ejecutado, Cancelada, Perdida, Anulada`)
  - `ABIERTOS`, `CERRADOS`, `FINALES` → arrays
  - `normalizar(estado)` → string; `'Nueva'` y vacío/undefined → `'Recorrido'`
  - `esAbierto(estado)`, `esCerrado(estado)`, `esFinal(estado)` → bool
  - `puedeCambiar(rol, desde, hacia)` → bool, misma semántica que la regla de Task 2
  - `motivo(rol, desde, hacia)` → string en español explicando la negativa, o `''` si está permitido
  - `permitidos(rol, desde)` → array de estados a los que `rol` sí puede mover
- Consumido por Tasks 4 y 5.

- [ ] **Step 1: Escribir `scripts/test-estados.js` (sin dependencias, estilo `test-ocupacion.js`)**

```
normalizar('Nueva') === 'Recorrido'
normalizar(undefined) === 'Recorrido'
normalizar('Cerrada') === 'Cerrada'
puedeCambiar('ventas','Cotizada','Cerrada') === true
puedeCambiar('ventas','Cerrada','Cotizada') === false
puedeCambiar('ventas','Cerrada','En Producción') === true
puedeCambiar('ventas','Cerrada','Ejecutado') === true
puedeCambiar('ventas','Ejecutado','Cerrada') === false
puedeCambiar('ventas','Cancelada','Cotizada') === false
puedeCambiar('admin','Cancelada','Cotizada') === true
puedeCambiar('produccion','En Producción','Ejecutado') === true
puedeCambiar('produccion','Cotizada','Cerrada') === false
puedeCambiar('lectura','Cotizada','Cerrada') === false
puedeCambiar('ventas','Nueva','Cerrada') === true          // legacy
puedeCambiar('ventas','Cotizada','Cotizada') === true      // sin cambio
puedeCambiar('ventas','Cotizada','Anulada') === false      // anular es acción aparte (Task 4)
permitidos('ventas','Cerrada') ordenado === ['Cerrada','En Producción','Ejecutado']
permitidos('admin','Cerrada').length === 8                 // todos menos Anulada
motivo('ventas','Cerrada','Cotizada') !== ''
motivo('ventas','Cotizada','Cerrada') === ''
```

El archivo carga `panel/js/estados.js` con `fs.readFileSync` + `new Function` y un `window` de mentira, como hace `test-ocupacion.js` con `ocupacion.js`.

- [ ] **Step 2: Correr para verificar que falla**

Run: `node scripts/test-estados.js`
Expected: FALLA al no encontrar `panel/js/estados.js`.

- [ ] **Step 3: Implementar `panel/js/estados.js`**

IIFE, ES5, sin DOM ni Firebase. `Anulada` solo se alcanza por la acción de anular (Task 4), así que `permitidos()` nunca la devuelve y `puedeCambiar(_, _, 'Anulada')` siempre es `false`.

- [ ] **Step 4: Correr hasta verde**

Run: `node scripts/test-estados.js && node scripts/test-ocupacion.js`
Expected: ambos OK.

- [ ] **Step 5: Cargar el script en `dashboard.html`**

`<script src="js/estados.js?v=1" defer></script>` junto a `ocupacion.js`, antes de los módulos de `js/pages/`.

- [ ] **Step 6: Commit**

```bash
git add panel/js/estados.js scripts/test-estados.js panel/dashboard.html
git commit -m "feat(panel): BNKEstados, transiciones de cotizacion en un solo lugar"
```

---

## Task 4: A1 UI — la UI niega lo mismo que la regla

**Files:**
- Modify: `panel/js/pages/cotizaciones.js` (`_estadoOptions` en :252, handler de `change` en :348)
- Modify: `panel/js/pages/pipeline.js` (`_changeEstado` en :222, y el `drop` del arrastre propio)
- Modify: `panel/dashboard.html` (`?v=N` de ambos)

**Interfaces:**
- Consumes: `BNKEstados.permitidos(rol, desde)`, `.puedeCambiar()`, `.motivo()` de Task 3; `BNK_AUTH.currentRole()`.

- [ ] **Step 1: Acotar el `<select>` de estado**

`_estadoOptions(current)` pasa a `_estadoOptions(current, rol)` y arma las opciones con `BNKEstados.permitidos(rol, current)`, más `current` siempre presente y `selected` aunque no esté en la lista (si no, el select se auto-movería al renderizar una cotización en un estado que el rol no puede producir). Actualizar la llamada en la fila de la tabla para pasar el rol.

- [ ] **Step 2: Rechazar en el handler de `change` antes de escribir**

Al principio de `doUpdate()`: si `!BNKEstados.puedeCambiar(rol, prevEstado, newEstado)`, devolver `select.value = prevEstado`, `BNKToast.warn(BNKEstados.motivo(rol, prevEstado, newEstado))` y salir sin tocar Firestore.

- [ ] **Step 3: Rechazar el drop ilegal en el kanban**

En `_changeEstado(id, newEstado, prevEstado)`, antes del `update`: si la transición no es legal, `BNKToast.warn(motivo)` + `_render()` (que ya es el camino de reversión visual) y `return`. Además, durante el arrastre, no resaltar como destino válido las columnas a las que el rol no puede mover: la tarjeta regresa sola.

- [ ] **Step 4: Excluir `Anulada` del tablero y de los KPIs de PIPELINE**

`ESTADOS` (pipeline.js:5) **no** gana una novena columna: el tablero ya mide ~1930px y no cabe en 1440. Las anuladas se filtran al cargar `_data`. `ESTADOS_ACTIVOS` queda igual.

- [ ] **Step 5: Verificar en el navegador**

Desplegar a un canal de preview (`firebase hosting:channel:deploy lote-a --project bunker-panel --expires 7d`), entrar con rol ventas y una cotización `PRUEBA-AUDITORIA` en `Cerrada`: el select no ofrece estados abiertos, y arrastrarla en el kanban a una columna abierta la devuelve con un toast explicativo. Consola sin errores. Repetir con admin (puede todo) y con producción (solo `En Producción → Ejecutado`).

- [ ] **Step 6: Commit**

```bash
git add panel/js/pages/cotizaciones.js panel/js/pages/pipeline.js panel/dashboard.html
git commit -m "feat(panel): la UI de estados respeta las mismas reglas que el servidor"
```

---

## Task 5: A2 — anular cotizaciones en lugar de borrarlas

**Files:**
- Modify: `firestore.rules` (cotizaciones y su subcolección `actividad`)
- Modify: `panel/js/pages/cotizaciones.js` (`_deleteCotizacion` en :1112, botón de la fila, `_estadoOptions`)
- Modify: `panel/dashboard.html` (modal `#cotAnularOverlay`, opción `Anulada` en el filtro `#cotEstado2` en :123, `?v=N`)
- Modify: `panel/css/panel.css` (`.estado-Anulada`)
- Modify: `scripts/test-rules.js`
- Modify: `panel/js/pages/reportes.js` (opción `Anulada` en el filtro de :153)

**Interfaces:**
- Produces: el campo `anulada: { por, porNombre, fecha, motivo }` en `cotizaciones`, más `estado: 'Anulada'`. Lo consume Task 8 (bitácora) y el Lote C.

- [ ] **Step 1: Escribir las pruebas que fallan**

```
test('admin NO borra cotizacion',            assertDeny(db('admin').collection('cotizaciones').doc('cot-abierta').delete()))
test('admin NO borra actividad',             assertDeny(db('admin').collection('cotizaciones').doc('cot-abierta').collection('actividad').doc('a1').delete()))
test('ventas NO anula',                      assertDeny(upd('ventas','cot-abierta',{estado:'Anulada',anulada:{motivo:'x'}})))
test('admin anula con motivo',               assertAllow(upd('admin','cot-abierta',{estado:'Anulada',anulada:{por:'u-admin',porNombre:'A',fecha:AHORA,motivo:'duplicada'}})))
test('ventas NO saca de Anulada',            assertDeny(upd('ventas','cot-anulada',{estado:'Cotizada'})))
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `npm run test:rules`
Expected: FALLO en las cinco (hoy admin sí borra y `Anulada` no está en `esFinal`).

- [ ] **Step 3: Cambiar las reglas**

`allow delete: if false` en `cotizaciones` y en `cotizaciones/{id}/actividad`. Reemplazar el comentario de :69-72 —que explicaba por qué la subcolección necesitaba `delete`— por el motivo nuevo: ya no se borra la cotización, así que la limpieza en cascada desaparece con ella. El campo `anulada` no necesita entrada en ninguna lista blanca: solo admin lo escribe y admin no tiene lista. `esFinal(e)` ya incluye `Anulada` desde Task 2.

- [ ] **Step 4: Correr hasta verde**

Run: `npm run test:rules`
Expected: `FALLO 0`.

- [ ] **Step 5: Reemplazar el borrado por "Anular" en la UI**

`_deleteCotizacion(id)` pasa a `_anularCotizacion(id)`: conserva la verificación de pagos/partners/eventos como **advertencia** (ya no como bloqueo: anular no destruye nada, pero el usuario debe saber qué cuelga de ahí), abre `#cotAnularOverlay` con un `<textarea>` de motivo obligatorio (`BNKValidate.required`) y escribe `{estado:'Anulada', anulada:{...}}` con un solo `update`. Ya no se borra la subcolección `actividad`. El botón de la fila cambia de título a "Anular" y solo se muestra a admin. `Anulada` **no** se agrega a `_estadoOptions` (se llega por el botón, con motivo).

- [ ] **Step 6: Excluir anuladas de las vistas y los totales**

Filtrar `estado !== 'Anulada'` en: KPIs y tabla de COTIZACIONES, `pipeline.js` (ya en Task 4), `reportes.js` (los filtros por `ESTADOS_CERRADOS` ya la excluyen; verificar el funnel y el conteo de conversión de :153 y :455), `calendario.js` (`ESTADOS_BLOQUEAN` ya la excluye; verificar la vista de cotizadas de :490) y `ocupacion.js` (`ESTADOS_BLOQUEAN` no la incluye: nada que hacer, pero confirmarlo con `node scripts/test-ocupacion.js`). En COTIZACIONES y en REPORTES, la opción `Anulada` en el filtro de estado permite verlas a propósito.

- [ ] **Step 7: Estilo del badge**

`.estado-Anulada` en `panel/css/panel.css` junto a las demás, con `var(--red)` apagado y `text-decoration: line-through`, siguiendo el patrón de `.estado-Perdida`.

- [ ] **Step 8: Verificar en el navegador**

En el canal de preview, con admin: anular una `PRUEBA-AUDITORIA` sin motivo → error inline; con motivo → desaparece de PIPELINE, de REPORTES y del calendario, sigue en COTIZACIONES al filtrar por `Anulada`, y su actividad sigue visible. Consola limpia.

- [ ] **Step 9: Commit**

```bash
git add firestore.rules scripts/test-rules.js panel/js/pages/cotizaciones.js panel/js/pages/reportes.js panel/dashboard.html panel/css/panel.css
git commit -m "feat(panel): anular cotizaciones en lugar de borrarlas"
```

---

## Task 6: A2 — archivar clientes, proveedores y partners

**Files:**
- Modify: `firestore.rules` (`clientes`, `proveedores`, `partners`)
- Modify: `panel/js/pages/clientes.js` (`eliminarCliente` en :678), `proveedores.js` (:624), `finanzas.js` (:602), `catalogo.js` (`_deleteItem` en :342)
- Modify: `panel/js/pages/cotizar-mnt.js` (:37), `cotizar-bnk.js` (:25,:27), `cotizaciones.js` (:82-85)
- Modify: `panel/dashboard.html` (filtros "Mostrar archivados", `?v=N`), `panel/css/panel.css` (`.row-archivada`)
- Modify: `scripts/test-rules.js`

**Interfaces:**
- Produces: `activo: false` + `desactivadoPor`, `desactivadoNombre`, `desactivadoEn` en `clientes`, `proveedores`, `partners`. **La ausencia del campo significa activo** (`d.activo !== false`), porque ningún documento existente lo trae y el Apps Script no lo escribe.

- [ ] **Step 1: Escribir las pruebas que fallan**

```
test('ventas NO borra cliente',      assertDeny(db('ventas').collection('clientes').doc('cli-1').delete()))
test('admin NO borra cliente',       assertDeny(db('admin').collection('clientes').doc('cli-1').delete()))
test('ventas archiva cliente',       assertAllow(updCol('ventas','clientes','cli-1',{activo:false,desactivadoPor:'u-ventas'})))
test('ventas NO borra proveedor',    assertDeny(db('ventas').collection('proveedores').doc('prv-1').delete()))
test('admin NO borra partner',       assertDeny(db('admin').collection('partners').doc('prt-1').delete()))
test('admin archiva partner',        assertAllow(updCol('admin','partners','prt-1',{activo:false})))
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `npm run test:rules`
Expected: FALLO en los cuatro `assertDeny` de borrado.

- [ ] **Step 3: Quitar `delete` de las tres colecciones en las reglas**

`clientes` y `proveedores` pasan de `allow create, update, delete: if isAdminOrVentas()` a `allow create, update: if isAdminOrVentas();` + `allow delete: if false;`. `partners` pasa de `allow read, delete: if isAdmin()` a `allow read: if isAdmin();` + `allow delete: if false;`. **No** tocar las subcolecciones `documentos`, `servicios` ni `bloques`: ahí el borrado es legítimo (un archivo subido por error).

- [ ] **Step 4: Correr hasta verde**

Run: `npm run test:rules`
Expected: `FALLO 0`.

- [ ] **Step 5: Archivar/Restaurar en las tres tablas**

`eliminarCliente(id)` → `archivarCliente(id, archivar)`: `BNKConfirm` + `update({activo: !archivar, desactivadoPor, desactivadoNombre, desactivadoEn})`. Mismo cambio en `proveedores.js` y en el borrado de partners de `finanzas.js`. El botón de la fila alterna ARCHIVAR/RESTAURAR según `d.activo !== false`, con el patrón que ya usa `catalogo.js:331` (`_toggleActivo`) como referencia. La fila archivada lleva `.row-archivada` (opacidad reducida, como `catalogo.js:135`). **Restaurar es admin-only** aunque archivar sea admin+ventas, para que ventas no pueda deshacer una decisión del director.

- [ ] **Step 6: Filtro "Mostrar archivados", apagado por defecto**

Un `<label>` con checkbox (`#cliVerArchivados`, `#prvVerArchivados`, `#finPartnersVerArchivados`) en la barra de filtros. Apagado = `filtered.filter(function (d) { return d.activo !== false; })`. **No** reutilizar los selects `#cliEstado`/`#prvEstado`: esos filtran `cuentaActiva`, que es el estado comercial y otra cosa. Los indicadores de totales y el export CSV respetan el filtro visible.

- [ ] **Step 7: Excluir archivados de autocompletes y cascadas**

En `cotizar-mnt.js` y `cotizar-bnk.js`, filtrar `activo !== false` sobre `clientes` y `proveedores` al cargarlos, con el mismo patrón que ya aplican a `catalogo` (`cotizar-mnt.js:45`, `cotizar-bnk.js:32`). En `cotizaciones.js`, el modal de vincular cliente y el de vincular proveedor/partner también los excluyen. Las cotizaciones históricas **siguen mostrando el nombre** del proveedor archivado: se lee de `proveedorNombre` denormalizado, no de la colección.

- [ ] **Step 8: Dejar de borrar conceptos del catálogo**

`catalogo` ya tiene el campo `activo` y el toggle (`catalogo.js:331`), pero `_deleteItem` (`catalogo.js:342`) **sigue borrando físicamente** — y borrar un venue rompe el histórico de ocupación en silencio, porque `BNKOcupacion` empata por **nombre**. Quitar el botón eliminar de la fila y dejar solo el toggle activar/desactivar. La regla de `catalogo` **conserva** su `allow delete: if isAdminOrVentas()` (el spec lo deja explícitamente igual): es la salida para un concepto recién capturado con un error, borrado desde la consola de Firebase, no desde el panel.

- [ ] **Step 9: Prueba de la ausencia del campo (Review Focus 4)**

Agregar a `scripts/test-rules.js` una prueba que siembre `clientes/cli-sin-campo` **sin** `activo` y confirme que `db('ventas')` lo lee. En el navegador: todos los clientes existentes (ninguno tiene `activo`) siguen apareciendo en la tabla y en el autocomplete de COTIZAR MNT.

- [ ] **Step 10: Verificar en el navegador**

Canal de preview: archivar un proveedor `PRUEBA-AUDITORIA` → desaparece de la cascada de COTIZAR BNK y de la tabla, reaparece con "Mostrar archivados", y una cotización vieja que lo usaba sigue mostrando su nombre. Con rol ventas, el botón RESTAURAR no está. Consola limpia.

- [ ] **Step 11: Commit**

```bash
git add firestore.rules scripts/test-rules.js panel/js/pages/clientes.js panel/js/pages/proveedores.js panel/js/pages/catalogo.js panel/js/pages/finanzas.js panel/js/pages/cotizar-mnt.js panel/js/pages/cotizar-bnk.js panel/js/pages/cotizaciones.js panel/dashboard.html panel/css/panel.css
git commit -m "feat(panel): archivar clientes, proveedores y partners en lugar de borrarlos"
```

---

## Task 7: A2 — cancelar cuentas por cobrar y anular pagos

**Files:**
- Modify: `firestore.rules` (`pagos`, `cuentasCobrar`, `cotizacionPartners`)
- Modify: `panel/js/pages/finanzas.js` (`cuentasCobrar.delete` en :1106; sumas de pagos en :523, :670, :688, :731, :1203; P&L)
- Modify: `panel/dashboard.html` (modales de motivo, filtros, `?v=N`)
- Modify: `scripts/test-rules.js`

**Interfaces:**
- Produces: `cancelada: true` + `canceladaPor`, `canceladaEn`, `motivoCancelacion` en `cuentasCobrar`; `anulado: true` + `anuladoPor`, `anuladoEn`, `motivoAnulacion` en `pagos`. Lo consume el Lote C (C3 excluye ambos de los totales).

- [ ] **Step 1: Escribir las pruebas que fallan**

```
test('admin NO borra cuentaCobrar',  assertDeny(db('admin').collection('cuentasCobrar').doc('cxc-1').delete()))
test('admin cancela cuentaCobrar',   assertAllow(updCol('admin','cuentasCobrar','cxc-1',{cancelada:true,motivoCancelacion:'x'})))
test('admin NO borra pago',          assertDeny(db('admin').collection('pagos').doc('pago-1').delete()))
test('admin anula pago',             assertAllow(updCol('admin','pagos','pago-1',{anulado:true,motivoAnulacion:'x'})))
test('ventas NO anula pago',         assertDeny(updCol('ventas','pagos','pago-1',{anulado:true})))
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `npm run test:rules`
Expected: FALLO en los dos `assertDeny` de borrado.

- [ ] **Step 3: Quitar `delete` de `pagos` y `cuentasCobrar`**

`allow read: if isAdmin();` + `allow create, update: if isAdmin();` + `allow delete: if false;`. **`cotizacionPartners` y `cotizacionProveedores` conservan el `delete`**: son tablas de vinculación sin historia propia y desvincular es una corrección legítima (`cotizaciones.js:834`, `finanzas.js:880`).

- [ ] **Step 4: Correr hasta verde**

Run: `npm run test:rules`
Expected: `FALLO 0`.

- [ ] **Step 5: Cancelar en lugar de borrar en Cuentas por Cobrar**

El botón eliminar de :1106 abre un modal de motivo y escribe `{cancelada:true, ...}`. La fila cancelada se muestra tachada y fuera del aging; un filtro "Mostrar canceladas" las trae de vuelta.

- [ ] **Step 6: Anular pagos**

Acción nueva (no existía borrado de pagos en la UI) en la tabla de Cuentas por Pagar, admin-only, con motivo obligatorio. **Excluir `anulado` de las cinco sumas** de `finanzas.js` (:523, :670, :688, :731, :1203) y del P&L, con un helper local `_pagosVigentes(pagos)` para no repetir el filtro — es el punto exacto que el Review Focus 5 señala.

- [ ] **Step 7: Prueba del pago anulado (Review Focus 5)**

En el canal de preview, sobre una cotización `PRUEBA-AUDITORIA` con dos pagos: anular uno → el saldo sube, el estado vuelve de "Dispersado"/"Cerrada" a "Parcial" y el P&L baja el egreso. Verificar los tres sitios, no solo la tabla.

- [ ] **Step 8: Verificar en el navegador**

Los cinco sub-tabs de FINANZAS cargan sin errores de consola con rol admin; con rol ventas, FINANZAS sigue oculto.

- [ ] **Step 9: Commit**

```bash
git add firestore.rules scripts/test-rules.js panel/js/pages/finanzas.js panel/dashboard.html
git commit -m "feat(panel): cancelar cuentas por cobrar y anular pagos sin borrarlos"
```

---

## Task 8: A3 — bitácora completa por cotización

**Files:**
- Modify: `panel/js/pages/cotizaciones.js` (`cambio_estado` en :361, `_vincularCliente` :1086, `_desvincularCliente` :1100, `_anularCotizacion` de Task 5, `_vincular`/`_desvincular` :824, popover `_openPopover` :490)
- Modify: `panel/js/pages/pipeline.js` (`cambio_estado` en :226)
- Modify: `panel/js/pages/eventos.js` (:719)
- Modify: `panel/js/pages/actividad.js` (`TIPO_ICONS` :8, `TIPO_TAB` :25)
- Modify: `panel/dashboard.html` (`?v=N`), `panel/css/panel.css` (`.cot-hist-*`)

**Interfaces:**
- Consumes: `BNK_DB.actividad.add(cotizacionId, entry)` (`firestore.js:88`), que ya inyecta `fecha`.
- Produces: tipos nuevos en la subcolección `actividad`: `cliente_vinculado`, `cliente_desvinculado`, `cotizacion_anulada`, `proveedores_vinculados`, `partner_vinculado`, `partner_desvinculado`. `cambio_estado` gana `estadoAnterior`.
- **Fuera de este lote:** los tipos `aprobacion_solicitada`, `aprobacion_aprobada` y `aprobacion_rechazada` que el spec lista en A3 pertenecen al Lote B — no hay nada que los emita todavía. La sección Historial del Step 4 tiene que pintar un tipo desconocido con un icono genérico en vez de romperse, para que el Lote B solo agregue entradas a los mapas.

- [ ] **Step 1: Registrar `estadoAnterior` en los dos sitios que cambian estado**

`cotizaciones.js:361` y `pipeline.js:226` agregan `estadoAnterior: prevEstado` al entry. `eventos.js:719` —que hoy no registra nada al cerrar una cotización— agrega su propio `BNK_DB.actividad.add(evt.cotizacionId, {tipo:'cambio_estado', estado:'Ejecutado', estadoAnterior: evt.estado, usuario, nota:'Cerrado desde EVENTOS al completar el checklist'})`.

- [ ] **Step 2: Registrar vinculación, desvinculación y anulación**

Un entry por acción en `_vincularCliente`, `_desvincularCliente`, `_anularCotizacion` (con el motivo en `nota`) y `_vincular`/`_desvincular` de partner/proveedor. Cada uno dentro de `.catch(function(){})` como los existentes: la bitácora no puede tumbar la acción.

- [ ] **Step 3: Agregar los tipos a `actividad.js`**

Entradas nuevas en `TIPO_ICONS` y `TIPO_TAB` para los tipos que también se registran en `actividadGlobal`. **No agregar campos nuevos a `actividadGlobal`**: su lista blanca en las reglas (`firestore.rules:181`) es real y está verificada; el detalle va dentro de `detalle`.

- [ ] **Step 4: Sección "Historial" en el popover de folio**

En `_openPopover`, tras el bloque de BNK vinculadas, un contenedor que carga `BNK_DB.actividad.list(cotId)` y pinta una línea de tiempo (icono, texto, usuario, fecha relativa), con "Sin historial" cuando esté vacía y `_esc()` en todo. Mostrar los últimos 10 con un "ver todos" si hay más. Reutilizar los tokens de `.act-*` que ya existen en `panel.css` para el dropdown de actividad.

- [ ] **Step 5: Verificar en el navegador**

Canal de preview: sobre una `PRUEBA-AUDITORIA`, cambiar estado → vincular cliente → desvincular → anular, y comprobar que el popover de folio muestra los cuatro eventos en orden con el usuario correcto, y que la campana de actividad no se rompe con los tipos nuevos. Consola limpia.

- [ ] **Step 6: Commit**

```bash
git add panel/js/pages/cotizaciones.js panel/js/pages/pipeline.js panel/js/pages/eventos.js panel/js/pages/actividad.js panel/dashboard.html panel/css/panel.css
git commit -m "feat(panel): bitacora completa por cotizacion y seccion de historial"
```

---

## Task 9: `updateMask` en la doble escritura del Apps Script

Sin esto el borrado lógico tiene una fuga desde el primer día: `writeToFirestore()` hace `PATCH` sin máscara, así que editar un cliente archivado desde `cotizador-munet/dashboard.html` **borra** `activo:false` y lo resucita.

**Files:**
- Modify: `cotizador-munet/google-apps-script-munet.js` (`writeToFirestore`)

- [ ] **Step 1: Leer `writeToFirestore` y listar los campos que el legacy sí maneja**

Run: `grep -n "writeToFirestore" -A40 cotizador-munet/google-apps-script-munet.js`
Expected: la URL del `PATCH` sin `updateMask`, y el mapa de campos por colección.

- [ ] **Step 2: Agregar `updateMask.fieldPaths` para `clientes` y `proveedores`**

Un `updateMask.fieldPaths=<campo>` repetido por cada clave del payload, anexado al query string del `PATCH`. Para `cotizaciones` **no** se agrega: ahí el Apps Script es el autor del documento completo. Comentario que explique qué campos del panel protege (`activo`, `desactivadoPor`, `desactivadoEn`, `marcas`, `noAplicaExtranjero`, `createdAt`).

- [ ] **Step 3: Verificar sin desplegar**

Run: `node --check cotizador-munet/google-apps-script-munet.js`
Expected: sin salida. El archivo no se ejecuta en el navegador; el despliegue al editor de Apps Script lo hace Carlos y queda fuera de esta tarea — anotarlo en el resumen del lote.

- [ ] **Step 4: Commit**

```bash
git add cotizador-munet/google-apps-script-munet.js
git commit -m "fix(cotizador): updateMask en la doble escritura para no borrar campos del panel"
```

---

## Task 10: Documentación y cierre del lote

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Actualizar `CLAUDE.md`**

En *Panel operativo*: `estados.js` en el listado de core y `node scripts/test-estados.js` + `npm run test:rules` en *How to Run*, con la nota de que el emulador es obligatorio antes de tocar reglas. En *Patrones del panel*: `Anulada` en la lista de estados, el candado por rol y estado, y una convención nueva de **borrado lógico** (qué campo por colección y la regla `d.activo !== false`). En *Seguridad*: el candado de cotizaciones y qué colecciones ya no permiten `delete`. En *Gotchas*: que `cuentaActiva` (comercial, `'Sí'`/`'No'`) y `activo` (archivado, booleano) son cosas distintas y no se deben mezclar; y que la lista blanca de ventas en las reglas se deriva de las escrituras reales del panel, con el `grep` para regenerarla. En *Cache busting*: las versiones nuevas.

- [ ] **Step 2: Correr todo**

Run: `npm run test:unit && npm run test:rules && python scripts/check_site.py`
Expected: todo OK. (`check_site.py` cubre el sitio público, que este lote no toca: sirve de control de que no se rompió nada por accidente.)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: convenciones de borrado logico y candado de cotizaciones del lote A"
```

- [ ] **Step 4: Resumen del lote para Carlos**

Un mensaje, no un archivo, que incluya: (a) los cambios de `firestore.rules` listados explícitamente, para revisarlos antes del deploy a producción; (b) los registros `PRUEBA-AUDITORIA` creados en el canal de preview —que escriben en la **Firestore de producción**— para que los anule o borre; (c) que el Apps Script de Task 9 necesita despliegue manual al editor; (d) el orden de deploy: **reglas primero, luego hosting**, porque las reglas nuevas son compatibles con el cliente viejo (solo deniegan lo que el cliente viejo nunca hacía: cambiar montos desde la consola) mientras que el hosting nuevo **sí** necesita las reglas nuevas para que Anular funcione.

---

## Orden y dependencias

```
Task 1 (arnés) ──> Task 2 (reglas A1) ──> Task 3 (BNKEstados) ──> Task 4 (UI A1)
                                   │
                                   ├──> Task 5 (Anulada)   ──> Task 8 (bitácora)
                                   ├──> Task 6 (archivar)  ──> Task 9 (updateMask)
                                   └──> Task 7 (finanzas)
                                                                 └──> Task 10 (docs)
```

Task 1 es bloqueante para todo. Tasks 5, 6 y 7 son independientes entre sí tras Task 2. Task 4 necesita Task 3. Task 8 necesita Task 5 (registra la anulación).

**Rama:** `panel/auditoria-a-integridad`, desde `main`. Un solo merge al cerrar el lote, tras el visto bueno de Carlos.
