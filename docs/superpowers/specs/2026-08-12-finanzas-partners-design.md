# Módulo FINANZAS + Partners — Design Spec

## Objetivo

Agregar un tab **FINANZAS** al panel operativo BUNKER con tres sub-tabs: Cuentas por Pagar (pagos a proveedores y partners), Partners (CRUD de co-productores), y Dispersiones (rastreo de pagos a partners vinculados a cotizaciones liquidadas). Persiste en Firestore.

## Arquitectura

Tab nuevo `FINANZAS` visible para todos los roles autenticados. Solo admin puede escribir (registrar pagos, CRUD partners, asignar partners). Ventas, producción y lectura son solo lectura.

Tres colecciones nuevas en Firestore (`partners`, `pagos`, `cotizacionPartners`) consultadas desde un único módulo `finanzas.js` siguiendo el patrón IIFE existente.

## Colecciones Firestore

### `partners`

Perfil del co-productor. Folio: `PTR-XXXX`.

| Campo | Tipo | Descripción |
|---|---|---|
| `folio` | string | `PTR-XXXX` autogenerado |
| `nombre` | string | Nombre o razón social |
| `nombreComercial` | string | Nombre comercial (opcional) |
| `tipoPersona` | string | `Física` o `Moral` |
| `cuentaActiva` | string | `Sí` o `No` |
| `contacto` | string | Persona de contacto |
| `puesto` | string | Puesto del contacto |
| `correo` | string | Correo electrónico |
| `telefono` | string | Teléfono |
| `observaciones` | string | Notas libres |
| `rfc` | string | RFC |
| `curp` | string | CURP |
| `regimenFiscal` | string | Régimen fiscal |
| `banco` | string | Banco MXN |
| `clabe` | string | CLABE interbancaria |
| `titular` | string | Titular de la cuenta |
| `tipoCuenta` | string | Tipo de cuenta bancaria |
| `bancoExtranjero` | string | Banco extranjero (opcional) |
| `cuentaIBAN` | string | Cuenta IBAN (opcional) |
| `swift` | string | SWIFT/BIC (opcional) |
| `divisa` | string | Divisa extranjera (opcional) |
| `createdAt` | timestamp | Fecha de creación |
| `updatedAt` | timestamp | Última actualización |

### `pagos`

Cada pago individual realizado a un proveedor o partner. Sin folio — se identifica por doc ID.

| Campo | Tipo | Descripción |
|---|---|---|
| `tipo` | string | `proveedor` o `partner` |
| `destinatarioId` | string | Doc ID del proveedor o partner |
| `destinatarioNombre` | string | Nombre denormalizado para tabla |
| `cotizacionId` | string | Doc ID de la cotización vinculada |
| `cotizacionFolio` | string | Folio denormalizado (ej: `BNK-260812-1234`) |
| `monto` | number | Monto del pago en MXN |
| `fechaPago` | string | Fecha del pago (`YYYY-MM-DD`) |
| `metodoPago` | string | `Transferencia`, `Cheque`, `Efectivo` |
| `referencia` | string | Número de referencia o comprobante |
| `notas` | string | Notas del pago |
| `registradoPor` | string | UID del admin que registró |
| `createdAt` | timestamp | Fecha de creación |

### `cotizacionPartners`

Relación cotización ↔ partner. No tiene monto — solo registra participación.

| Campo | Tipo | Descripción |
|---|---|---|
| `cotizacionId` | string | Doc ID de la cotización |
| `cotizacionFolio` | string | Folio denormalizado |
| `partnerId` | string | Doc ID del partner |
| `partnerNombre` | string | Nombre denormalizado |
| `cerrada` | boolean | `true` cuando el admin marca la dispersión como completada |
| `createdAt` | timestamp | Fecha de asignación |

Se usan colecciones de nivel superior (no subcollections) para permitir consultas cruzadas: todos los pagos de un partner, todos los partners de una cotización, etc.

## Sub-tabs

### Sub-tab 1: CUENTAS POR PAGAR

**KPIs** (4 cards):
- **TOTAL PAGADO** — suma de todos los `pagos` del período
- **PENDIENTE PROVEEDORES** — cuentas de proveedores no cerradas
- **PENDIENTE PARTNERS** — cuentas de partners no cerradas (dispersiones activas)
- **PAGOS DEL MES** — cantidad de pagos registrados en el mes actual

Los KPIs de "pendiente" cuentan registros abiertos, no montos (porque no hay monto acordado previo).

**Filtros:**
- Búsqueda (folio, destinatario)
- Tipo: Todos / Proveedor / Partner
- Estado: Todos / Pendiente / Parcial / Cerrada
- Rango de fechas

**Tabla principal:**
| FOLIO COT. | TIPO | DESTINATARIO | PAGADO | ÚLTIMO PAGO | ESTADO | ACCIONES |
|---|---|---|---|---|---|---|
| BNK-260812-1234 | Proveedor | Sonido Pro SA | $90,000 | 2026-08-10 | Parcial | + Pago / Ver |

- Columna PAGADO = suma de pagos registrados para esa combinación cotización + destinatario
- Columna ESTADO = "Pendiente" (0 pagos), "Parcial" (>0 pagos, no cerrada), "Cerrada" (admin la marcó)
- Esta tabla se construye agrupando la colección `pagos` por `cotizacionId` + `destinatarioId`, combinada con `cotizacionPartners` para partners sin pagos aún
- Un mismo proveedor/partner aparece en múltiples filas si tiene pagos en distintas cotizaciones (una fila por combinación cotización + destinatario)

**Botón "+ REGISTRAR PAGO"** (solo admin): abre modal con:
- Select cotización (búsqueda por folio, autocomplete desde `cotizaciones`)
- Select tipo: Proveedor / Partner
- Select destinatario (filtra proveedores o partners según tipo seleccionado)
- Monto
- Fecha de pago
- Método de pago (Transferencia / Cheque / Efectivo)
- Referencia / comprobante
- Notas

**Click en fila → modal detalle:**
- Info de la cotización (folio, cliente, evento, total)
- Info del destinatario (nombre, banco, CLABE)
- Tabla de parcialidades: fecha, monto, método, referencia, quién lo registró
- Botón "MARCAR COMO CERRADA" (toggle, solo admin) — indica que la cuenta está saldada
- Botón "+ AGREGAR PAGO" (solo admin)

### Sub-tab 2: PARTNERS

**Tabla principal:**
| ID | NOMBRE | CONTACTO | CORREO | TELÉFONO | COTIZACIONES | ESTADO |
|---|---|---|---|---|---|---|
| PTR-0001 | 14DS Producción | Juan Pérez | juan@14ds.com | 55-1234-5678 | 3 | Activo |

- Columna COTIZACIONES = count de `cotizacionPartners` donde `partnerId` = este partner
- Columna ESTADO = `cuentaActiva`
- Filtro por búsqueda

**Botón "+ NUEVO PARTNER"** (solo admin): abre modal con 3 tabs:

**Tab General:**
- Nombre / Razón social
- Nombre comercial
- Tipo persona (Física / Moral)
- Cuenta activa (Sí / No)
- Observaciones

**Tab Contacto:**
- Persona contacto
- Puesto
- Correo
- Teléfono

**Tab Bancarios:**
- Sección MXN: Banco, CLABE, Titular, Tipo cuenta
- Sección Extranjera: Banco, Cuenta/IBAN, SWIFT, Divisa

**En la parte inferior del modal** (fuera de las tabs): lista de cotizaciones vinculadas a este partner con estado de dispersión y pagos recibidos. Solo lectura.

### Sub-tab 3: DISPERSIONES

Vista enfocada en cotizaciones que tienen partners asignados.

**Tabla:**
| FOLIO | CLIENTE | EVENTO | ESTADO COT. | PARTNERS | ESTADO DISPERSIÓN |
|---|---|---|---|---|---|
| BNK-260815-5678 | Televisa | Evento X | Ejecutado | 14DS, Otro Prod | Por dispersar |
| BNK-260820-9012 | Netflix | Evento Y | Cotizada | 14DS | Pendiente |

- Solo muestra cotizaciones que tienen al menos un registro en `cotizacionPartners`
- **ESTADO DISPERSIÓN** se calcula:
  - `Pendiente` — cotización NO está en estado "Cerrada" ni "Ejecutado"
  - `Por dispersar` — cotización está en "Cerrada" o "Ejecutado" Y al menos un partner no tiene `cerrada: true` en `cotizacionPartners`
  - `Dispersado` — todos los partners de esa cotización tienen `cerrada: true`
- Badge colores: Pendiente = gris, Por dispersar = amarillo (atención), Dispersado = verde

**Botón "ASIGNAR PARTNER"** (solo admin): en cada fila o como acción global:
- Modal con select de cotización (si es global) y multi-select de partners
- Crea registros en `cotizacionPartners`

**Click en fila → modal detalle:**
- Info de la cotización
- Lista de partners asignados, cada uno con:
  - Nombre, pagos realizados, estado (Pendiente / Parcial / Cerrada)
  - Botón para ir a registrar pago (lleva a Cuentas por Pagar prefiltrado)
- Botón "ASIGNAR PARTNER" para agregar más
- Botón "QUITAR PARTNER" (solo si no tiene pagos)

## Flujos de Negocio

### Pago a proveedor
1. Admin va a FINANZAS → Cuentas por Pagar → "+ REGISTRAR PAGO"
2. Selecciona cotización, tipo "Proveedor", selecciona proveedor
3. Ingresa monto, fecha, método, referencia
4. Se crea doc en `pagos`
5. La tabla se actualiza mostrando el pago
6. Cuando la cuenta está saldada, admin hace click en "MARCAR COMO CERRADA"

### Asignación de partner a cotización
1. Admin va a FINANZAS → Dispersiones → selecciona cotización → "ASIGNAR PARTNER"
2. Selecciona partner(s) del listado
3. Se crean docs en `cotizacionPartners`
4. La cotización aparece en la tabla de Dispersiones con estado "Pendiente"

### Dispersión tras liquidación
1. Cotización cambia a estado "Cerrada" o "Ejecutado" (desde tab COTIZACIONES, flujo existente)
2. En Dispersiones, el estado cambia automáticamente a "Por dispersar" (visual amarillo)
3. Admin registra pagos a cada partner desde Cuentas por Pagar
4. Cuando todos los partners están pagados, admin marca cada `cotizacionPartners` como `cerrada: true`
5. Estado dispersión cambia a "Dispersado" (visual verde)

## Permisos

| Acción | Admin | Ventas | Producción | Lectura |
|---|---|---|---|---|
| Ver tab FINANZAS | Sí | Sí | Sí | Sí |
| Registrar pago | Sí | No | No | No |
| CRUD partners | Sí | No | No | No |
| Asignar partner a cotización | Sí | No | No | No |
| Marcar cuenta como cerrada | Sí | No | No | No |

## Reglas Firestore

```
match /partners/{docId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAdmin();
}

match /pagos/{docId} {
  allow read: if isAuthenticated();
  allow create: if isAdmin();
  allow update, delete: if isAdmin();
}

match /cotizacionPartners/{docId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAdmin();
}
```

## Archivos

### Nuevos
- `panel/js/pages/finanzas.js` (~700-800 lines) — módulo IIFE con lógica de las 3 sub-tabs
- `panel/css/finanzas.css` — estilos específicos: KPIs financieros, badges de dispersión, tabla parcialidades

### Modificados
- `panel/dashboard.html` — tab FINANZAS en nav, sección `sec-finanzas` con sub-tabs y HTML
- `panel/js/firestore.js` — agregar `BNK_DB.partners`, `BNK_DB.pagos`, `BNK_DB.cotizacionPartners`
- `panel/css/panel.css` — badges: `.estado-Parcial`, `.estado-PorDispersar`, `.estado-Dispersado`, `.estado-Cerrada` (si no existe ya)
- `firestore.rules` — reglas para las 3 colecciones nuevas

### No se tocan
- `panel/js/pages/proveedores.js` — queda intacto
- `panel/js/pages/cotizaciones.js` — queda intacto
- `panel/js/pages/cotizar-bnk.js` — queda intacto

## Badges de estado

| Estado | Color | Aplicación |
|---|---|---|
| Pendiente | Gris (`var(--tx)`) | Cuenta sin pagos / cotización no liquidada |
| Parcial | Amarillo (`var(--ylw)`) | Cuenta con pagos pero no cerrada |
| Cerrada | Verde (`var(--g)`) | Cuenta saldada por admin |
| Por dispersar | Amarillo (`var(--ylw)`) | Cotización liquidada, partners sin pagar |
| Dispersado | Verde (`var(--g)`) | Todos los partners pagados |

## UX

- Seguir los patrones UX existentes del panel: `.ctz-card` para secciones, `.bnk-form-grid` para formularios, `.bnk-overlay` + `.bnk-modal` para modales
- Sub-tabs dentro de FINANZAS usan el patrón `.modal-tabs` / `.modal-tab` ya existente (adaptado a nivel de sección)
- KPIs usan `.dash-card` existente
- Tabla usa `.dash-table` existente
- Botones solo visibles para admin via check de `BNK_AUTH.currentUser()` rol
- Toast para confirmaciones (`BNKToast.ok/warn/error`)
