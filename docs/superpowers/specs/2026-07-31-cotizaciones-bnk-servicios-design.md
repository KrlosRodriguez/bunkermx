# Cotizaciones de Servicios BNK — Spec de Diseno

**Fecha:** 2026-07-31
**Estado:** Aprobado
**Fase:** MVP

---

## Resumen

Sistema para crear cotizaciones de servicios/produccion integral (folio BNK) desde el dashboard de MUNET. Permite agregar servicios complementarios a cotizaciones de venue (MNT) existentes o crear cotizaciones independientes. Incluye catalogo de precios precargados, catalogo de clientes con autocompletado, y generacion de PDF estilo BUNKER (dorado/terra).

## Contexto

Actualmente el cotizador MUNET genera cotizaciones de renta de espacios (folio MNT). Pero para eventos de produccion integral, BUNKER necesita cotizar servicios adicionales: staff, mobiliario, A&B, estructura, mapping, suministros, etc. Hoy esto se hace manualmente. Este sistema lo integra al dashboard.

## Decisiones de Arquitectura

| Decision | Elegida | Razon |
|---|---|---|
| Almacenamiento | Google Sheets (hojas nuevas) | MVP rapido, consistente con stack actual. 1-2 operadores, volumen manejable. Firebase/Firestore queda para fase 2 cuando la operacion lo requiera |
| Estructura de cotizacion | Hibrida — conceptos libres de cualquier categoria, agrupables en una o varias cotizaciones | Maxima flexibilidad sin forzar estructura |
| Precios | Precargados editables + conceptos libres + opcion de guardar al catalogo | El operador puede usar sugeridos, editarlos, o crear nuevos. Guarda al catalogo solo si quiere |
| Folios | Prefijo BNK (ej: BNK-260731-0001) | Distingue de MNT (venues). Refleja que BUNKER produce, MUNET renta |
| PDF | Estilo BUNKER dorado/terra | Consistente con cotizaciones de produccion existentes (Blend, Rep. Dominicana) |
| Acceso | Boton "+" en fila MNT + boton global "Nueva Cotizacion BNK" | Cubre ambos escenarios: vinculada a venue o independiente |
| Clientes | Autocompletado al crear cotizacion (MVP). Vista dedicada en fase 2 | El catalogo se llena organicamente |
| Condiciones | Plantillas editables + texto libre | Rapido para lo comun, flexible para lo especial |

---

## 1. Arquitectura de Datos (Google Sheets)

3 hojas nuevas en el Sheet existente. La hoja "Cotizaciones" (MNT) no se modifica.

### Hoja: Clientes

| Columna | Campo | Tipo | Notas |
|---|---|---|---|
| A | ID | String | Auto-generado (CLI-0001, CLI-0002...) |
| B | Empresa | String | Nombre de la empresa |
| C | Contacto | String | Nombre del contacto principal |
| D | Telefono | String | |
| E | Correo | String | |
| F | Nota | String | Nota interna libre |
| G | Fecha Alta | String | dd/MM/yyyy |

### Hoja: CotizacionesBNK

| Columna | Campo | Tipo | Notas |
|---|---|---|---|
| A | Fecha | String | dd/MM/yyyy HH:mm |
| B | Folio BNK | String | BNK-AAMMDD-XXXX |
| C | Folio MNT | String | Vinculo opcional a cotizacion de venue |
| D | Cliente ID | String | Referencia a hoja Clientes |
| E | Empresa | String | Nombre (desnormalizado para busquedas) |
| F | Contacto | String | |
| G | Telefono | String | |
| H | Correo | String | |
| I | Evento | String | Nombre del evento |
| J | Fecha Evento | String | |
| K | Sede | String | MUNET u otra |
| L | Conceptos | String | JSON con array de conceptos |
| M | Condiciones | String | Texto de condiciones comerciales |
| N | Subtotal | Number | Sin IVA |
| O | IVA | Number | 16% |
| P | Total | Number | Con IVA |
| Q | Link PDF | String | URL de Google Drive |
| R | Estado | String | Nueva / Contactada / Cerrada / Cancelada |

### Hoja: CatalogoPrecio

| Columna | Campo | Tipo | Notas |
|---|---|---|---|
| A | ID | String | Auto-generado (CAT-0001...) |
| B | Categoria | String | Servicios Basicos, Mobiliario, A&B, Estructura, Contenido/Mapping, Suministros, Otro |
| C | Concepto | String | Nombre del servicio/producto |
| D | Unidad | String | turno, pieza, pax, dia, servicio, m2, etc. |
| E | Precio Sugerido | Number | Precio default (editable al cotizar) |
| F | Activo | Boolean | true/false para ocultar sin borrar |

### Estructura JSON de Conceptos (columna L de CotizacionesBNK)

```json
[
  {
    "categoria": "Servicios Basicos",
    "concepto": "Stage Manager (turno 8 hrs)",
    "cantidad": 1,
    "unidad": "turno",
    "precioUnit": 3500,
    "subtotal": 3500
  },
  {
    "categoria": "Otro",
    "concepto": "Drones (servicio especial)",
    "cantidad": 2,
    "unidad": "servicio",
    "precioUnit": 15000,
    "subtotal": 30000,
    "esLibre": true
  }
]
```

---

## 2. Catalogo de Precios Precargado

Datos iniciales basados en cotizaciones reales de Blend Producciones y Republica Dominicana:

### Servicios Basicos

| Concepto | Unidad | Precio Sugerido |
|---|---|---|
| Stage Manager (turno 8 hrs) | turno | $3,500 |
| Crew Chief (turno 8 hrs) | turno | $2,500 |
| Supervisor de Seguridad (turno 8 hrs) | turno | $1,500 |
| Elemento de Seguridad (turno 8 hrs) | turno | $1,450 |
| Supervisor de Seguridad (turno 12 hrs) | turno | $2,250 |
| Elemento de Seguridad (turno 12 hrs) | turno | $2,175 |
| Supervisor de Limpieza (turno 8 hrs) | turno | $1,500 |
| Elemento de Limpieza (turno 8 hrs) | turno | $1,250 |
| Ambulancia (turno 8 hrs) | turno | $6,000 |
| Ambulancia (turno 12 hrs) | turno | $9,000 |
| Paramedico (turno 8 hrs) | turno | $2,250 |
| Paramedico (turno 12 hrs) | turno | $2,250 |
| Stage Hands | turno | $1,100 |

### Mobiliario

| Concepto | Unidad | Precio Sugerido |
|---|---|---|
| Silla Bacara | pieza | $170 |
| Silla Ghost | pieza | $170 |
| Flete | servicio | $24,000 |
| Maniobras | servicio | $5,000 |
| Supervision de mobiliario | servicio | $4,000 |

### A&B (Alimentos y Bebidas)

| Concepto | Unidad | Precio Sugerido |
|---|---|---|
| Servicio de Canapes de Bienvenida | pax | $230 |
| Servicio de Barra Libre Diamante | pax | $1,380 |
| Servicio de Cena 3 Tiempos | pax | $1,150 |
| Coffee Break Staff | pax | $145.20 |
| Catering VIP | servicio | $2,420 |
| Box Lunch Cena | pieza | $181.50 |

### Estructura

| Concepto | Unidad | Precio Sugerido |
|---|---|---|
| Pabellon 50x100 (incluye cortinas, tarima, transporte) | servicio | $2,622,920 |
| Twin Pack 150 kW turbo (10 hrs/turno) | turno | $45,000 |
| Generador 150 kW (10 hrs/turno) | turno | $12,000 |
| Doble tiro de cableado | servicio | $19,500 |

### Contenido y Mapping

| Concepto | Unidad | Precio Sugerido |
|---|---|---|
| Servidor de video | servicio | $20,000 |
| Operacion y mappeo (por dia) | dia | $10,000 |
| Operador (dia de pruebas) | dia | $12,000 |
| Generacion de contenido (por minuto) | minuto | $45,000 |
| Adaptacion de contenido | servicio | $12,000 |
| Videoproyector laser 45K lumenes c/optica | pieza | $54,050 |
| Torre de proyeccion con proteccion lluvia | pieza | $11,500 |
| Creatividad y direccion de proyecto | servicio | $40,250 |
| Produccion general | servicio | $23,000 |
| Animacion de video mapping (por minuto) | minuto | $28,750 |
| Creacion de mascarilla de proyeccion | servicio | $28,750 |

### Suministros

| Concepto | Unidad | Precio Sugerido |
|---|---|---|
| Papel higienico junior 200m | caja | $461.95 |
| Toalla interdoblada 20/100 | caja | $271.17 |
| Jabon liquido de manos 5L | pieza | $251.27 |
| Tapete de mingitorio C/10 | paquete | $288.07 |

---

## 3. Folios BNK

Formato: `BNK-AAMMDD-XXXX`

- **BNK** — prefijo fijo (distingue de MNT)
- **AAMMDD** — fecha de creacion (2 digitos ano, 2 mes, 2 dia)
- **XXXX** — consecutivo aleatorio de 4 digitos

Ejemplo: `BNK-260731-3847`

---

## 4. Flujos del Operador

### 4.1 Crear cotizacion desde fila MNT (boton "+")

1. Operador da clic en "+" junto a una cotizacion MNT en la tabla
2. Se abre modal con datos prellenados: cliente, contacto, evento, sede, folio MNT vinculado
3. Agrega conceptos:
   - Selecciona categoria del dropdown
   - Autocompletado filtra conceptos de esa categoria
   - Al seleccionar, se llena precio sugerido (editable)
   - O escribe nombre libre + precio manual
   - Checkbox "Guardar en catalogo" para conceptos libres
4. Ajusta cantidades, precios unitarios — subtotales se calculan automatico
5. Selecciona plantilla de condiciones y edita si necesita
6. Vista previa de resumen (subtotal, IVA, total)
7. Clic "Generar Cotizacion" — genera PDF, sube a Drive, guarda en Sheet
8. Modal muestra link al PDF generado

### 4.2 Crear cotizacion global (boton "Nueva Cotizacion BNK")

1. Operador da clic en "NUEVA COTIZACION BNK" en la barra superior
2. Se abre el mismo modal pero sin datos prellenados
3. Campo "Cliente/Empresa" con autocompletado del catalogo de clientes
4. Si el cliente no existe: opcion "Crear nuevo cliente" (empresa, contacto, tel, correo, nota)
5. Campo opcional "Vincular a folio MNT" — dropdown con folios existentes o dejarlo vacio
6. Resto del flujo igual que 4.1

### 4.3 Autocompletado de clientes

- Al escribir en el campo "Cliente", se busca en la hoja Clientes
- Muestra sugerencias que coincidan (nombre de empresa)
- Al seleccionar, se prellenan contacto, telefono, correo
- Si no hay coincidencia, opcion de crear nuevo

---

## 5. Formulario de Conceptos

Cada linea de concepto en el modal:

```
[Categoria v] [Concepto (autocompletado/libre)] [Cant.] [Unidad] [Precio Unit.] [Subtotal] [x]
```

- Boton "+" al final para agregar nueva linea
- Boton "x" para eliminar linea
- Subtotales por categoria se muestran automaticamente
- Gran Total = suma de subtotales
- IVA = 16% del Gran Total
- Total con IVA = Gran Total + IVA

---

## 6. Condiciones Comerciales

3 plantillas iniciales, editables en textarea antes de generar:

### Plantilla: Estandar

```
1. Precios mas IVA.
2. Vigencia de la cotizacion: 30 dias.
3. 60% de anticipo para confirmacion y bloqueo de fecha.
4. 40% restante: 5 dias naturales previos al evento.
5. Servicios y/o equipos adicionales seran cotizados por separado.
6. Cancelaciones: una vez confirmado el servicio, el anticipo no sera reembolsado.
```

### Plantilla: Estructura Pesada

```
1. Precios mas IVA.
2. Vigencia de la cotizacion: 30 dias.
3. 60% de anticipo para confirmacion y bloqueo de fecha.
4. 40% restante: 5 dias naturales previos al evento.
5. La Estructura esta sujeta a condiciones de pago especificas: 80% de anticipo y 20% al inicio de montaje.
6. Servicios y/o equipos adicionales seran cotizados por separado.
7. Cancelaciones: una vez confirmado el servicio, el anticipo no sera reembolsado.
8. El precio del seguro de responsabilidad civil se calculara 30 dias antes del evento y debera ser liquidado por el cliente.
```

### Plantilla: Evento Especial

```
1. Presupuesto tipo ballpark previo a brief de cliente; si los requerimientos exceden lo cotizado, se hara un ajuste.
2. No incluye creacion de arte adicional a lo especificado; en caso de requerirla, se cotizara por separado.
3. Se requiere un minimo de 1 mes para la realizacion del proyecto.
4. Cambios en la informacion ya proporcionada pueden afectar los costos.
5. 50% de anticipo para iniciar el proyecto; liquidacion contraentrega.
6. Entregables editables: costo adicional del 40% del total.
7. Costo por cancelacion: 85%.
```

El operador puede seleccionar una plantilla como base y editar libremente el texto.

---

## 7. PDF Estilo BUNKER (Dorado/Terra)

Basado en los PDFs reales de Blend Producciones y Republica Dominicana.

### Estructura del PDF

1. **Header** (cada pagina)
   - Logo BUNKER (izquierda)
   - Titulo: "Cotizacion: [Nombre Evento] — [Descripcion]"
   - Subtitulo: "Atencion: [Contacto] ([Empresa]) | Fecha Evento: [fecha] | Sede: [sede]"
   - Logo MUNET (derecha, solo si sede es MUNET)

2. **Introduccion**
   - Parrafo: "En atencion a su solicitud, BUNKER presenta la siguiente propuesta..."

3. **Tablas por categoria**
   - Header de seccion con fondo dorado oscuro y texto blanco (ej: "SERVICIOS BASICOS")
   - Columnas: Descripcion | Cant. | Unidad/Turnos | Precio Unit. | Subtotal
   - Subtotal por categoria al final de cada tabla

4. **Resumen General**
   - Tabla: Concepto | Sin IVA | Con IVA (16%)
   - Una fila por categoria con subtotal
   - Fila Gran Total en negritas

5. **Condiciones Comerciales**
   - Lista numerada con el texto editado por el operador

6. **Footer** (cada pagina)
   - "Pag. X | BUNKER Creatividad Empresarial"

### Paleta de colores del PDF

- Header/footer fondo: `#2C2419` (oscuro cafe)
- Texto header: blanco
- Headers de seccion: `#C6A34E` (dorado) sobre fondo oscuro
- Subtotales: color dorado `#C6A34E`
- Texto general: `#333333`
- Lineas/bordes de tabla: `#E8DCC8` (beige claro)

---

## 8. Cambios en el Dashboard

### Barra superior (dash-nav)

Agregar boton "NUEVA COTIZACION BNK" junto a los botones existentes.

### Tabla

- Nueva columna "+" al inicio o final — boton para agregar cotizacion BNK vinculada
- Indicador en filas MNT que tienen cotizaciones BNK vinculadas (ej: badge "2 BNK")
- Ambos tipos de folio (MNT y BNK) se muestran en la misma tabla

### Filtros

- Nuevo dropdown "TIPO": Todos | MNT (Venues) | BNK (Servicios)
- Los filtros existentes (busqueda, estado, fechas) aplican a ambos tipos

### Indicadores (cards superiores)

- Suman tanto MNT como BNK
- El subtitulo puede desglosar: "X MNT + Y BNK"

---

## 9. Google Apps Script — Nuevos Endpoints

| Endpoint | Accion | Parametros |
|---|---|---|
| `?action=listBNK` | Listar cotizaciones BNK | (filtros opcionales) |
| `?action=createBNK` | Crear cotizacion BNK + subir PDF | JSON con datos completos |
| `?action=listClientes` | Listar catalogo de clientes | — |
| `?action=createCliente` | Crear nuevo cliente | empresa, contacto, tel, correo, nota |
| `?action=listCatalogo` | Listar catalogo de precios | (categoria opcional) |
| `?action=saveCatalogo` | Guardar concepto nuevo al catalogo | categoria, concepto, unidad, precio |
| `?action=updateStatusBNK` | Cambiar estado de cotizacion BNK | folio, estado |

El endpoint `?action=list` existente sigue funcionando igual para cotizaciones MNT.

---

## 10. Archivos a Crear/Modificar

| Archivo | Cambio |
|---|---|
| `cotizador-munet/dashboard.html` | Modal de nueva cotizacion BNK, formulario de conceptos, autocompletado clientes, botones, filtro tipo, columna "+", generacion PDF |
| `cotizador-munet/google-apps-script-munet.js` | Nuevos endpoints (listBNK, createBNK, listClientes, createCliente, listCatalogo, saveCatalogo, updateStatusBNK) |
| Google Sheet (manual) | Crear 3 hojas: Clientes, CotizacionesBNK, CatalogoPrecio con headers |

---

## 11. Fuera de Alcance (Fase 2)

- Vista dedicada de clientes con historial agrupado
- Migracion a Firebase/Firestore
- Multiples contactos por empresa
- Exportar/importar catalogo de precios
- Imagenes de referencia en el PDF (galeria)
- Editar cotizaciones BNK existentes (v1 solo crea nuevas)
- Duplicar cotizaciones como plantilla
