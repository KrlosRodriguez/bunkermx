# Migración del Cotizador MNT+BNK al Panel Firebase — Design Spec

**Fecha:** 2026-08-12
**Estado:** Aprobado
**Autor:** HaDeZ + Claude

## Objetivo

Migrar la creación de cotizaciones MNT (venues) y BNK (servicios/producción) al panel operativo Firebase (`bunker-panel.web.app`), para que los vendedores puedan crear, gestionar y generar PDFs desde una sola plataforma autenticada. Incluye tarifas de venues editables desde el panel y dos estilos de PDF.

## Contexto

- **Simulador público** (`bunkermx.com/cotizador-munet/`) se queda como está — Apps Script + Sheets, independiente.
- **Panel** (`bunker-panel.web.app`) usa Firestore como base real.
- **Sin doble escritura** — la doble escritura del Apps Script está rota (proyecto viejo borrado, código no re-desplegado). Cada sistema vive en su propia base hasta que aprueben el panel.
- **Sin Firebase Storage** por ahora — Blaze pendiente de verificación bancaria.

## Arquitectura

### Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `panel/js/pages/cotizar-mnt.js` | Wizard MNT: 4 pasos, calendarios, cálculos de tarifas dinámicas, generación PDF (2 estilos) |
| `panel/js/pages/cotizar-bnk.js` | Formulario BNK: conceptos dinámicos, autocompletado, cálculos, generación PDF (2 estilos) |

### Cambios a archivos existentes

| Archivo | Cambio |
|---|---|
| `panel/dashboard.html` | 2 tabs nuevos (COTIZAR MNT, COTIZAR BNK), secciones HTML del wizard y formulario, carga de jsPDF CDN + `logo-data.js`, scripts de los nuevos módulos |
| `panel/css/panel.css` | Estilos del wizard (pasos, calendarios, cards de espacios, toggle neon/corporativa) y formulario BNK (conceptos, totales, condiciones) |
| `panel/js/pages/catalogo.js` | Campos `precioWeekend` y `precioMontaje` en el modal cuando categoría = "Venues" |

### Sin tocar

- `cotizador-munet/` — simulador público, independiente
- `panel/js/firestore.js` — `BNK_DB` ya tiene todos los métodos necesarios
- `panel/js/pages/cotizaciones.js` — ya lista cotizaciones, recibirá las nuevas automáticamente
- `cotizador-munet/google-apps-script-munet.js` — no se re-despliega, queda como está

### Flujo de datos

```
Vendedor crea cotización en panel
  → BNK_DB.cotizaciones.create() → Firestore
  → Genera PDF client-side (jsPDF) → descarga local
  → (Fase 2: sube PDF a Firebase Storage)
  → (Fase 2: envía email al cliente con Cloud Functions)
```

## Tab COTIZAR MNT — Wizard de venues

### 4 pasos

| Paso | Título | Campos |
|---|---|---|
| 1 | Datos de Contacto | Cliente (req, autocompletado desde `BNK_DB.clientes`), Agencia (opt), Evento (opt), Contacto (req), Teléfono + Correo (al menos uno req), Asistentes (opt) |
| 2 | Tipo de Evento | Toggle Privado/Público, Descripción (textarea, opt), Hora inicio/fin (opt) |
| 3 | Espacios y Fechas | 8 cards de venues (desde `BNK_DB.catalogo` categoría "Venues"), calendario por venue para seleccionar días individuales (regular Lun-Jue / weekend Vie-Sáb), stepper de días de montaje por venue |
| 4 | Resumen | Preview read-only con desglose por venue, subtotal, IVA 16%, total, selector de estilo PDF, botón GENERAR COTIZACIÓN |

### Tarifas dinámicas

Las tarifas se leen de Firestore (`BNK_DB.catalogo`) con categoría "Venues". Estructura del documento:

```
catalogo/{id}
  categoria: "Venues"
  concepto: "Foro"            // nombre del espacio
  unidad: "día"
  precio: 45000               // precio regular privado
  precioWeekend: 67500         // precio fin de semana
  precioMontaje: 15000         // precio por día de montaje
  activo: true
```

El admin edita estos precios desde el tab CATÁLOGO sin tocar código.

### Cálculo de costos (mismo que simulador actual)

- Renta por venue = `(díasRegular × precio) + (díasWeekend × precioWeekend)`
- Montaje por venue = `díasMontaje × precioMontaje`
- Subtotal = suma de todas las rentas + montajes
- IVA = subtotal × 0.16
- Total = subtotal + IVA
- Salas Capacitación no permiten días weekend

### Autocompletado de cliente

Al escribir en el campo Empresa/Cliente, se busca en `BNK_DB.clientes` y se prellenan los datos de contacto (persona, teléfono, correo). Si no existe, el vendedor escribe libre.

### Folio

Formato: `MNT-AAMMDD-XXXX` (4 dígitos aleatorios), generado client-side al momento de enviar.

### Guardado en Firestore

```javascript
BNK_DB.cotizaciones.create({
  fuente: 'MNT',
  folio: 'MNT-260812-1234',
  cliente: '...',
  agencia: '...',
  evento: '...',
  contacto: '...',
  telefono: '...',
  correo: '...',
  tipo: 'Privado',           // o 'Público'
  fechas: 'AGO 2026: 15, 17',
  desgloseVenues: '[]',      // JSON string
  diasTotal: 2,
  descripcion: '...',
  horario: '18:00 — 23:00',
  espacios: 'Foro, Jardín Social',
  rentaTotal: 90000,
  montajeTotal: 30000,
  subtotal: 120000,
  iva: 19200,
  total: 139200,
  linkPdf: '',                // vacío hasta fase 2 (Storage)
  estado: 'Nueva',
  creadoPor: 'uid-del-vendedor',
  creadoEn: serverTimestamp()
})
```

## Tab COTIZAR BNK — Servicios/Producción

### Formulario directo (sin wizard)

| Sección | Campos |
|---|---|
| Datos del cliente | Empresa (autocompletado `BNK_DB.clientes`), Contacto, Teléfono, Correo, Evento, Fecha Evento, Sede (default "MUNET"), Vincular a Folio MNT (opt) |
| Conceptos | Filas dinámicas: Categoría (select), Concepto (autocompletado `BNK_DB.catalogo`), Cantidad, Unidad, Precio Unitario, Subtotal. Botón + AGREGAR CONCEPTO |
| Totales | Subtotal, IVA 16%, Total — cálculo automático |
| Condiciones | Plantilla (Estándar / Estructura pesada / Evento especial) + textarea editable |
| Acciones | Selector de estilo PDF (Neon / Corporativa) + botón GENERAR COTIZACIÓN |

### Categorías de conceptos

Servicios Básicos, Mobiliario, A&B, Estructura, Contenido/Mapping, Suministros, Otro.

### Condiciones comerciales (plantillas)

- **Estándar:** Precios + IVA, vigencia 30 días, 60/40 anticipo, cancelación sin reembolso.
- **Estructura pesada:** Igual + 80/20 para estructura, seguro de responsabilidad civil.
- **Evento especial:** Ballpark, sin arte adicional, 1 mes mínimo, 50/50, entregables editables +40%.

### Folio

Formato: `BNK-AAMMDD-XXXX`, generado client-side.

### Guardado en Firestore

```javascript
BNK_DB.cotizaciones.create({
  fuente: 'BNK',
  folio: 'BNK-260812-5678',
  folioMNT: '',               // opcional, si se vincula
  empresa: '...',
  contacto: '...',
  telefono: '...',
  correo: '...',
  evento: '...',
  fechaEvento: '2026-09-15',
  sede: 'MUNET',
  conceptos: '[...]',          // JSON string de los conceptos
  condiciones: '...',
  subtotal: 250000,
  iva: 40000,
  total: 290000,
  linkPdf: '',
  estado: 'Nueva',
  creadoPor: 'uid-del-vendedor',
  creadoEn: serverTimestamp()
})
```

## Catálogo — Cambios

### Categoría "Venues" nueva

Agregar "Venues" a la lista de categorías del select en el modal de catálogo.

### Campos condicionales

Cuando categoría = "Venues", el modal muestra 2 campos extra:

| Campo | Label | Tipo |
|---|---|---|
| `precioWeekend` | PRECIO WEEKEND | number |
| `precioMontaje` | PRECIO MONTAJE | number |

Para cualquier otra categoría estos campos se ocultan.

### Datos iniciales de venues

8 documentos en la colección `catalogo`:

| Concepto | Precio Regular | Weekend | Montaje |
|---|---|---|---|
| Foro | $45,000 | $67,500 | $15,000 |
| Jardín Social | $45,000 | $67,500 | $15,000 |
| Auditorio | $25,000 | $37,500 | $8,000 |
| Black Box | $20,000 | $30,000 | $6,000 |
| Lobby | $15,000 | $22,500 | $5,000 |
| Explanada | $30,000 | $45,000 | $10,000 |
| Velaria | $20,000 | $30,000 | $6,000 |
| Salas Capacitación | $8,000 | — | $3,000 |

Estos se insertan una vez desde el panel (o script manual). El admin los modifica desde el tab CATÁLOGO.

## PDF — Dos estilos

### Selector

Toggle antes del botón GENERAR en ambos tabs:

```
[● NEON] [○ CORPORATIVA]     [GENERAR COTIZACIÓN]
```

### Estilo Neon

- Fondo oscuro `#050905`
- Acento verde `#00FF41`
- Tipografía monospace para datos
- Logo MUNET + BUNKER en header (MNT) / Logo BUNKER prominente arriba (BNK)
- Mismo look que el simulador actual

### Estilo Corporativa

- Fondo blanco `#FFFFFF`
- Texto oscuro `#333333`
- Acento dorado `#C6A350`
- Header con barra terra `#2C2419`
- Tipografía helvetica limpia
- Logo MUNET + BUNKER en header (MNT) / Logo BUNKER prominente arriba (BNK)
- Presentación sobria/profesional

### Logos en PDF

- **PDF BNK:** Logo BUNKER prominente arriba, es la marca principal
- **PDF MNT:** Logo MUNET + BUNKER en header (como el simulador actual)

### Contenido (mismo para ambos estilos)

**MNT:**
- Header con folio, evento, cliente
- Datos de contacto
- Tabla de espacios con desglose (días regular, weekend, montaje)
- Resumen general (subtotal, IVA, total)
- Condiciones comerciales fijas del cotizador

**BNK:**
- Header con folio, evento, cliente
- Datos de contacto
- Tabla de conceptos agrupados por categoría
- Resumen general por categoría + gran total
- Condiciones comerciales (plantilla seleccionada)

### Generación

Client-side con jsPDF 2.5.1 (CDN). Logo desde `logo-data.js` (copiado a `panel/js/`). Descarga automática al generar.

## Fuera de alcance (fases posteriores)

| Feature | Requiere | Fase |
|---|---|---|
| Upload de documentos (comprobantes, INE, constancias) | Blaze + Storage | 2 |
| Subir PDF generado a Firebase Storage | Blaze + Storage | 2 |
| Email automático al cliente con PDF | Blaze + Cloud Functions | 2 |
| Migración de datos Sheets → Firestore | Aprobación del panel | 3 |
| Conectar simulador público al panel | Aprobación del panel | 3 |

## Stack técnico

- HTML/CSS/JS vanilla — sin build tools, sin bundler
- jsPDF 2.5.1 (CDN)
- Firebase Auth + Firestore (compat mode, ya configurado)
- Módulos JS como IIFEs en `panel/js/pages/`
- CSS en `panel/css/panel.css`
