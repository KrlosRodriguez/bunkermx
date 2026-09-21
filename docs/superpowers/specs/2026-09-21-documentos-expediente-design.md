# Documentos de Expediente — Design Spec

**Fecha:** 2026-09-21
**Alcance:** Subida, gestión y versionado de documentos (PDF/JPG/PNG) en expedientes de clientes, proveedores y partners.
**Dependencia:** Firebase Storage (plan Blaze activo).

---

## 1. Infraestructura Firebase Storage

### Inicialización

Agregar `firebase.storage()` en `panel/js/firebase-config.js` y exponerlo como `BNK_FIREBASE.storage`.

### Estructura de archivos en Storage

```
documentos/{entidad}/{entityId}/{tipoDocumento}/{timestamp}_{nombreOriginal}
```

Ejemplo: `documentos/clientes/CLI-0012/rfc/1695312000000_constancia_rfc.pdf`

Cada tipo de documento es una "carpeta" y cada archivo dentro es una versión. El más reciente es el vigente.

### Metadata en Firestore

Subcollection `documentos` dentro de cada entidad:

```
clientes/{id}/documentos/{docId}
proveedores/{id}/documentos/{docId}
partners/{id}/documentos/{docId}
```

Schema de cada documento:

```js
{
  tipo: 'rfc',                                    // clave del tipo (o 'libre' para tipo libre)
  tipoNombre: 'Constancia de Situación Fiscal',   // display name
  nombreArchivo: 'constancia_rfc.pdf',
  contentType: 'application/pdf',
  tamano: 245000,                                 // bytes
  storagePath: 'documentos/clientes/CLI-0012/rfc/1695312000000_constancia_rfc.pdf',
  downloadURL: 'https://...',
  vigente: true,                                  // false para versiones anteriores
  subidoPor: 'admin@email.com',
  subidoEn: Timestamp
}
```

### Versionado

Al subir una nueva versión de un tipo:
1. El documento anterior se marca `vigente: false`
2. El nuevo se crea con `vigente: true`
3. El archivo anterior se conserva en Storage

### Security Rules — Storage

Archivo nuevo `storage.rules`:
- **Lectura:** cualquier usuario autenticado
- **Escritura:** cualquier usuario autenticado
- **Eliminación:** solo usuarios con rol admin (validado consultando `usuarios/{uid}` en Firestore)

### Security Rules — Firestore

Agregar en `firestore.rules` reglas para subcollections `documentos` en clientes, proveedores y partners:
- **Lectura:** cualquier usuario autenticado
- **Escritura (crear/actualizar):** cualquier usuario autenticado
- **Eliminación:** solo admin

---

## 2. Módulo `documentos.js`

**Archivo:** `panel/js/pages/documentos.js` — IIFE que expone `window.BNKDocumentos`.

### Catálogo de tipos de documento

```js
var TIPOS_DOCUMENTO = [
  { key: 'rfc',       nombre: 'Constancia de Situación Fiscal',  requerido: { clientes: true,  proveedores: true,  partners: true  } },
  { key: 'domicilio', nombre: 'Comprobante de Domicilio',        requerido: { clientes: false, proveedores: true,  partners: false } },
  { key: 'ine',       nombre: 'INE / Identificación Oficial',    requerido: { clientes: false, proveedores: true,  partners: true  } },
  { key: 'opinion32d',nombre: 'Opinión de Cumplimiento (32-D)',  requerido: { clientes: false, proveedores: true,  partners: false } },
  { key: 'caratula',  nombre: 'Carátula Bancaria',               requerido: { clientes: false, proveedores: true,  partners: true  } },
  { key: 'acta',      nombre: 'Acta Constitutiva',               requerido: { clientes: false, proveedores: true,  partners: false } },
  { key: 'poder',     nombre: 'Poder Notarial',                  requerido: { clientes: false, proveedores: false, partners: false } },
];
```

Los 7 tipos siempre visibles para las 3 entidades. Los marcados como `requerido` cuentan para el indicador de completitud de documentos. Documentos "libres" (tipo H) no cuentan como requeridos.

### API pública

```js
BNKDocumentos.render(container, { entidad: 'clientes', entityId: 'CLI-0012' })
// Renderiza toda la UI del tab dentro del contenedor DOM

BNKDocumentos.getIndicador(entidad, entityId)
// Retorna Promise<{ completados: 4, requeridos: 6, total: 9 }>

BNKDocumentos.destroy()
// Limpia listeners de Firestore al cerrar modal
```

### Flujo de upload

1. Usuario selecciona archivo (input file o drag & drop sobre el card)
2. Validar extensión: solo `.pdf`, `.jpg`, `.jpeg`, `.png`
3. Validar tamaño: ≤ 10 MB
4. Subir a Firebase Storage con path `documentos/{entidad}/{entityId}/{tipo}/{timestamp}_{nombre}`
5. Obtener `downloadURL` del archivo subido
6. Si ya hay un doc vigente de ese tipo → marcarlo `vigente: false` en Firestore
7. Crear documento en subcollection con `vigente: true`
8. Actualizar UI: mostrar archivo, actualizar indicador
9. Toast: `BNKToast.ok('Documento subido correctamente')`

### Flujo de eliminación (solo admin)

1. Confirmar acción con el usuario
2. Eliminar archivo de Storage
3. Eliminar documento de Firestore
4. Si había una versión anterior → la más reciente se marca `vigente: true` automáticamente (promoción)
5. Actualizar UI
6. Toast: `BNKToast.warn('Documento eliminado')`

### Flujo de historial

1. Click en "Historial (N)" en un card de tipo
2. Query Firestore: subcollection donde `tipo == X`, ordenado por `subidoEn desc`
3. Mostrar listado desplegable debajo del card: fecha, quién subió, botón descargar
4. Versiones no vigentes se muestran con opacidad reducida

---

## 3. UI del tab "Documentos"

### Posición del tab en cada modal

- **Clientes:** 5° tab → `General | Contacto | Facturación | Bancarios | Documentos`
- **Proveedores:** 6° tab → `General | Contacto | Fiscales | Bancarios | Servicios | Documentos`
- **Partners:** último tab en su modal dentro de finanzas

### Layout

```
┌─────────────────────────────────────────────────┐
│  📄 Documentos                    3/6 requeridos │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ Constancia de Situación Fiscal ──── REQ ──┐ │
│  │  📎 constancia_rfc_2026.pdf   800 KB        │ │
│  │  Subido: 15/Sep/2026 por admin@...          │ │
│  │  [Descargar]  [Reemplazar]  [Historial (2)] │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ Comprobante de Domicilio ─────────────────┐ │
│  │  Sin archivo                                │ │
│  │  [Subir archivo]                            │ │
│  │  Formatos: PDF, JPG, PNG · Máx 10 MB       │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ... (demás tipos predefinidos) ...              │
│                                                  │
│  ┌─ + Agregar documento libre ────────────────┐ │
│  │  Nombre: [________________]  [Subir]        │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ Carta poder (libre) ─────────────────────┐  │
│  │  📎 carta_poder.pdf   1.2 MB               │ │
│  │  [Descargar]  [Reemplazar]  [Eliminar]      │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Patrones UI

- Cada tipo es un card (`.ctz-card`) — consistente con el resto del panel
- Badge `REQ` en dorado (`var(--gold)`) para tipos requeridos de esa entidad
- Indicador `3/6 requeridos` arriba a la derecha, estilo separado del % completitud existente
- Botón "Subir archivo" abre file input nativo (`accept=".pdf,.jpg,.jpeg,.png"`)
- Drag & drop sobre el card vacío como alternativa (clase `.doc-dropzone`)
- Botón "Eliminar" solo visible para rol admin (check via `BNK_AUTH.currentUser()`)
- "Historial (N)" abre mini-listado desplegable debajo del card con versiones anteriores
- Documentos libres se listan después de los 7 tipos fijos
- Documentos libres tienen `[Eliminar]` que borra el tipo completo (solo admin)

### Feedback

- Upload exitoso: `BNKToast.ok('Documento subido correctamente')`
- Error formato/tamaño: `BNKToast.error('Formato no válido. Solo PDF, JPG o PNG hasta 10 MB')`
- Eliminación: `BNKToast.warn('Documento eliminado')`

---

## 4. Integración con módulos existentes

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `panel/js/firebase-config.js` | Agregar `BNK_FIREBASE.storage = firebase.storage()` |
| `panel/dashboard.html` | Tab-button + contenedor en modales de clientes, proveedores, partners. Script tag para `documentos.js` |
| `panel/js/pages/clientes.js` | Llamar `BNKDocumentos.render()` al abrir modal, `.destroy()` al cerrar |
| `panel/js/pages/proveedores.js` | Mismo patrón |
| `panel/js/pages/finanzas.js` | Mismo patrón en modal de partners |
| `panel/css/panel.css` | Estilos: `.doc-card`, `.doc-badge-req`, `.doc-indicador`, `.doc-historial`, `.doc-dropzone`, `.doc-libre-input` |
| `firestore.rules` | Reglas para subcollections `documentos` |

### Archivos nuevos

| Archivo | Contenido |
|---|---|
| `panel/js/pages/documentos.js` | Módulo IIFE `BNKDocumentos` |
| `storage.rules` | Security rules de Firebase Storage |

### Lo que NO se toca

- % de completitud existente en clientes/proveedores
- Lógica de tabs existentes (solo se agrega uno nuevo al final)
- Ningún otro módulo del panel
- Sitio público

---

## 5. Formatos y validaciones

- **Extensiones permitidas:** `.pdf`, `.jpg`, `.jpeg`, `.png`
- **Tamaño máximo:** 10 MB por archivo
- **MIME types aceptados:** `application/pdf`, `image/jpeg`, `image/png`
- Validación client-side antes de subir (extensión + tamaño)
- Content-type se establece en el metadata de Storage al subir

---

## 6. Permisos por rol

| Acción | admin | ventas | produccion | lectura |
|---|---|---|---|---|
| Ver documentos | ✅ | ✅ | ✅ | ✅ |
| Subir documentos | ✅ | ✅ | ✅ | ✅ |
| Reemplazar (nueva versión) | ✅ | ✅ | ✅ | ✅ |
| Descargar | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ❌ | ❌ | ❌ |

---

## 7. Documentos requeridos por entidad

| Documento | Clave | Cliente | Proveedor | Partner |
|---|---|---|---|---|
| Constancia de Situación Fiscal | `rfc` | ✅ Req | ✅ Req | ✅ Req |
| Comprobante de Domicilio | `domicilio` | Opc | ✅ Req | Opc |
| INE / Identificación Oficial | `ine` | Opc | ✅ Req | ✅ Req |
| Opinión de Cumplimiento (32-D) | `opinion32d` | Opc | ✅ Req | Opc |
| Carátula Bancaria | `caratula` | Opc | ✅ Req | ✅ Req |
| Acta Constitutiva | `acta` | Opc | ✅ Req | Opc |
| Poder Notarial | `poder` | Opc | Opc | Opc |

**Totales requeridos:** Clientes: 1, Proveedores: 6, Partners: 3.

Documentos libres (tipo H) nunca cuentan como requeridos.
