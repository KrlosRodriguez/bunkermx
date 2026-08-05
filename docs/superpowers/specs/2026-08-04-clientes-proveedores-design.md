# Spec: Módulo de Clientes y Proveedores para Dashboard BUNKER

**Fecha:** 2026-08-04
**Estado:** Aprobado

---

## Resumen

Agregar dos secciones nuevas al dashboard existente (`cotizador-munet/dashboard.html`): **Clientes** y **Proveedores**. Navegación por tabs (Cotizaciones | Clientes | Proveedores). Cada sección con tabla, filtros, KPIs, y modal de detalle/edición con múltiples tabs. Backend en Google Apps Script con Google Sheets como base de datos. Vinculación con cotizaciones BNK existentes.

---

## 1. Navegación por Tabs

Barra de sub-navegación debajo del header actual del dashboard:

```
[ Cotizaciones ]  [ Clientes ]  [ Proveedores ]
```

- Tab activo con borde inferior verde (tema neon)
- Click en tab oculta las demás secciones y muestra la correspondiente (sin recarga de página)
- KPIs e indicadores cambian según el tab activo:
  - **Cotizaciones**: los 4 KPIs actuales sin cambio
  - **Clientes**: Total Clientes, Activos, Inactivos, % Promedio Completitud
  - **Proveedores**: Total Proveedores, Pool, One Shot, % Promedio Completitud
- Filtros cambian según el tab:
  - **Cotizaciones**: filtros actuales sin cambio
  - **Clientes**: buscar por nombre/marca, filtro activo/inactivo
  - **Proveedores**: buscar por nombre/razón social, filtro tipo (Pool/One Shot), filtro activo/inactivo
- Botón "+ Nuevo" cambia según tab: "+ Nueva Cotización BNK" / "+ Nuevo Cliente" / "+ Nuevo Proveedor"

---

## 2. Tabla y Modal de Clientes

### 2.1 Tabla

| Columna | Descripción |
|---|---|
| No. Cliente | ID auto-generado (CLI-0001) |
| Status % | Badge con color: rojo <30%, amarillo 30-70%, verde >70% |
| Nombre/Empresa | Texto principal |
| Marcas | Marcas asociadas (comma-separated) |
| Cuenta activa | Indicador visual activo/inactivo |
| Acciones | Editar, Ver detalle, Eliminar |

- Botón **"+ Nuevo Cliente"** arriba de la tabla
- Paginación (50 registros por página)
- Buscador filtra por nombre, marca o ID

### 2.2 Modal de Cliente (4 tabs)

Estilo visual consistente con modal BNK existente (fondo oscuro, bordes neon). Header con nombre del cliente + círculo de % completado.

**Tab 1 — Datos Generales:**
- Condiciones de pago (días)
- Cuenta activa (Sí/No)
- Fecha de alta (auto)
- Fecha última edición (auto)
- Tipo de persona (Moral / Física / Extranjero)
- Marcas (texto libre, comma-separated)
- Observaciones

**Tab 2 — Datos de Contacto:**
- Persona de contacto
- Puesto / Descripción
- Correo de contacto
- Teléfono de contacto

**Tab 3 — Datos de Facturación:**
- Razón social
- RFC
- CURP (si persona física)
- Régimen fiscal (clave y descripción)
- Uso de CFDI
- Forma de pago
- Método de pago (PUE/PPD)
- Dirección: Calle, No. Ext, No. Int, Colonia, CP, Alcaldía/Municipio, Estado, País

**Tab 4 — Datos Bancarios:**
- **MXN**: Banco, Sucursal/Plaza, Titular cuenta, Cuenta corta, CLABE (18 dígitos), Tipo de cuenta
- **Moneda extranjera**: Banco (nombre y país), Divisa, Titular, Cuenta/IBAN, SWIFT/BIC, ABA/Routing, Banco intermediario, SWIFT intermediario

Todos los campos editables. Ninguno obligatorio excepto Empresa/Nombre para crear registro.

---

## 3. Tabla y Modal de Proveedores

### 3.1 Tabla

| Columna | Descripción |
|---|---|
| No. Proveedor | ID auto-generado (PRV-0001) |
| Status % | Badge con color |
| Razón Social | Nombre fiscal |
| Nombre Comercial | Nombre con el que operan |
| Tipo | Badge POOL (recurrente) o ONE SHOT (eventual) |
| Cuenta activa | Indicador visual |
| Fecha Alta | Fecha de registro |
| Acciones | Editar, Ver detalle, Eliminar |

- Botón **"+ Proveedor"** arriba de la tabla
- Filtros: Tipo (Todos/Pool/One Shot), Status (Activos/Inactivos/Todos)
- Paginación y buscador

### 3.2 Modal de Proveedor (5 tabs)

Mismo estilo visual. Header con nombre comercial + círculo % completado.

**Tab 1 — Datos Generales:**
- Actividad principal
- Cuenta activa (Sí/No)
- Fecha de alta (auto)
- Fecha última edición (auto)
- Fecha de constitución / inicio de operaciones
- Tipo de persona (Moral / Física / Extranjero)
- Tipo de proveedor (Pool / One Shot)
- Observaciones

**Tab 2 — Datos de Contacto:**
- Nombre del contacto / representante
- Puesto / Descripción
- Correo electrónico
- Teléfono(s)

**Tab 3 — Datos Fiscales y Facturación:**
- Razón social (como aparece en constancia fiscal)
- RFC
- CURP (si persona física)
- Régimen fiscal (clave y descripción)
- Uso de CFDI
- Forma de pago
- Método de pago (PUE/PPD)
- Días de crédito acordados
- Opinión 32-D (fecha y sentido)
- Fecha constancia de situación fiscal
- Dirección fiscal: Calle, Número, Colonia, CP, Alcaldía/Municipio, Entidad, País

**Tab 4 — Datos Bancarios:**
- **MXN**: Banco, Sucursal/Plaza, Titular de la cuenta, Cuenta corta, CLABE (18 dígitos), Tipo de cuenta (Cheques/Inversión)
- **Moneda extranjera**: Banco (nombre y país), Divisa (USD/EUR/Otra), Titular, Cuenta/IBAN, SWIFT/BIC, ABA/Routing, Dirección del banco, Banco intermediario, SWIFT intermediario, Gastos bancarios a cargo de (OUR/SHA/BEN)

**Tab 5 — Servicios y Costos:**
- Tabla editable dentro del tab con columnas: Categoría, Servicio, Unidad, Costo Unitario, Acciones (editar/eliminar)
- Botón **"+ Agregar Servicio"** para nuevas filas
- Datos en hoja aparte "ServiciosProveedor" vinculada por ProveedorID

---

## 4. Modelo de Datos (Google Sheets)

### 4.1 Hoja "Clientes" (40 columnas)

| Col | Campo |
|---|---|
| A | ID (CLI-0001) |
| B | Empresa/Nombre |
| C | Marcas |
| D | Cuenta Activa (Sí/No) |
| E | Tipo Persona (Moral/Física/Extranjero) |
| F | Condiciones Pago (días) |
| G | Observaciones |
| H | Persona Contacto |
| I | Puesto Contacto |
| J | Correo Contacto |
| K | Teléfono Contacto |
| L | Razón Social |
| M | RFC |
| N | CURP |
| O | Régimen Fiscal |
| P | Uso CFDI |
| Q | Forma Pago |
| R | Método Pago |
| S | Calle |
| T | No. Ext |
| U | No. Int |
| V | Colonia |
| W | CP |
| X | Alcaldía/Municipio |
| Y | Estado |
| Z | País |
| AA | Banco MXN |
| AB | Sucursal |
| AC | Titular Cuenta |
| AD | Cuenta Corta |
| AE | CLABE |
| AF | Tipo Cuenta |
| AG | Banco Extranjero |
| AH | Divisa |
| AI | Titular Extranjero |
| AJ | Cuenta/IBAN |
| AK | SWIFT/BIC |
| AL | ABA/Routing |
| AM | Banco Intermediario |
| AN | SWIFT Intermediario |
| AO | Fecha Alta (auto) |
| AP | Fecha Última Edición (auto) |

### 4.2 Hoja "Proveedores" (44 columnas)

| Col | Campo |
|---|---|
| A | ID (PRV-0001) |
| B | Razón Social |
| C | Nombre Comercial |
| D | Tipo Proveedor (Pool/One Shot) |
| E | Cuenta Activa (Sí/No) |
| F | Tipo Persona |
| G | Actividad Principal |
| H | Fecha Constitución |
| I | Observaciones |
| J | Nombre Contacto |
| K | Puesto Contacto |
| L | Correo Contacto |
| M | Teléfono Contacto |
| N | RFC |
| O | CURP |
| P | Régimen Fiscal |
| Q | Uso CFDI |
| R | Forma Pago |
| S | Método Pago |
| T | Días Crédito |
| U | Opinión 32-D |
| V | Fecha Constancia Fiscal |
| W | Calle |
| X | Número |
| Y | Colonia |
| Z | CP |
| AA | Alcaldía/Municipio |
| AB | Entidad |
| AC | País |
| AD | Banco MXN |
| AE | Sucursal/Plaza |
| AF | Titular Cuenta |
| AG | Cuenta Corta |
| AH | CLABE |
| AI | Tipo Cuenta |
| AJ | Banco Extranjero |
| AK | Divisa |
| AL | Titular Extranjero |
| AM | Cuenta/IBAN |
| AN | SWIFT/BIC |
| AO | ABA/Routing |
| AP | Dirección Banco |
| AQ | Banco Intermediario |
| AR | SWIFT Intermediario |
| AS | Gastos Bancarios |
| AT | Fecha Alta (auto) |
| AU | Fecha Última Edición (auto) |

### 4.3 Hoja "ServiciosProveedor" (7 columnas)

| Col | Campo |
|---|---|
| A | ID (SRV-0001) |
| B | Proveedor ID (PRV-0001) |
| C | Categoría |
| D | Servicio |
| E | Unidad |
| F | Costo Unitario |
| G | Activo (Sí/No) |

---

## 5. Endpoints (Google Apps Script)

### Clientes

| Endpoint | Método | Descripción |
|---|---|---|
| `listClientes` | GET | Retorna todos los clientes con todos los campos |
| `createCliente` | POST | Crea cliente nuevo, genera ID auto-incremental, retorna ID |
| `updateCliente` | POST | Actualiza cliente por ID, actualiza fecha última edición |
| `deleteCliente` | GET | Soft delete: Cuenta Activa → No |

### Proveedores

| Endpoint | Método | Descripción |
|---|---|---|
| `listProveedores` | GET | Retorna todos los proveedores |
| `createProveedor` | POST | Crea proveedor nuevo, genera ID (PRV-XXXX), retorna ID |
| `updateProveedor` | POST | Actualiza proveedor por ID |
| `deleteProveedor` | GET | Soft delete |

### Servicios de Proveedor

| Endpoint | Método | Descripción |
|---|---|---|
| `listServicios` | GET | Retorna servicios de un proveedor por ProveedorID |
| `createServicio` | POST | Agrega servicio a un proveedor |
| `updateServicio` | POST | Edita servicio existente |
| `deleteServicio` | GET | Desactiva servicio (Activo → No) |

### Flujo de datos

```
Dashboard (fetch JS) ←→ Google Apps Script (doGet/doPost) ←→ Google Sheets
```

- Las hojas se crean automáticamente con `getOrCreateSheet()` al primer uso
- % completado se calcula en frontend (campos no vacíos / total campos)
- Editable tanto desde dashboard como directamente en el Sheet

---

## 6. Vinculación con Cotizaciones BNK

### Al crear Cotización BNK

- **Cliente**: autocompletado mejorado. Al seleccionar un cliente del catálogo se auto-llenan Empresa, Contacto, Teléfono, Correo. Se guarda `clienteID` en la cotización.
- **Proveedor** (nuevo, opcional): campo con autocompletado. Al seleccionar un proveedor, sus servicios se cargan como opciones en el dropdown de conceptos con precio pre-llenado (ajustable). Se guarda `proveedorID` en la cotización.
- Si el cliente no existe, botón "Crear cliente" abre modal rápido con campos básicos.

### Vista desde modal de Cliente

- Resumen: "Cotizaciones vinculadas: N" con lista de folios clickeables que abren la cotización correspondiente.

### Vista desde modal de Proveedor

- Similar: "Cotizaciones donde participó: N" con lista de folios.

### Impacto en hojas existentes

- **CotizacionesBNK**: se agrega columna `ProveedorID` (opcional) después de la columna Estado.
- **Cotizaciones MNT**: sin cambios.

---

## 7. Archivos a modificar/crear

### Modificar

| Archivo | Cambios |
|---|---|
| `cotizador-munet/dashboard.html` | Agregar tabs de navegación, secciones HTML de Clientes y Proveedores, modales |
| `css/pages/dashboard.css` | Estilos para tabs, tablas nuevas, modales con tabs internos, badges, % completado |
| `cotizador-munet/google-apps-script-munet.js` | Nuevos endpoints CRUD para Clientes, Proveedores y Servicios |

### Crear

| Archivo | Descripción |
|---|---|
| `js/pages/clientes.js` | Lógica de la sección Clientes: fetch, render tabla, modal, CRUD, % completado |
| `js/pages/proveedores.js` | Lógica de la sección Proveedores: fetch, render tabla, modal, CRUD, servicios |

---

## 8. Fuera de alcance (segunda etapa)

- Tab "Documentos" en modales (carga de archivos PDF)
- Tab "Actualización de documentos" en proveedores
- Columnas de clave de acceso, envío de clave, mail actualización
- Exportar a Excel
- Reportes de proveedores
