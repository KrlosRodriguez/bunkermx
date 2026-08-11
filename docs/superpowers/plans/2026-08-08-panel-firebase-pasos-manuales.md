# Panel Firebase — Pasos Manuales Post-Implementación

> Estos pasos no se pueden automatizar con código. Se ejecutan una sola vez para activar el panel.

**Proyecto Firebase:** `bunkermx-51834`
**Fecha de implementación:** 2026-08-08

---

## Paso 1: Registrar web app y obtener config Firebase

```bash
# Si no tienes web app registrada:
firebase apps:create web "Panel BUNKER" --project bunkermx-51834

# Obtener la config:
firebase apps:sdkconfig web --project bunkermx-51834
```

Copiar el objeto `firebaseConfig` resultante (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) y pegarlo en:

**Archivo:** `panel/js/firebase-config.js` — reemplazar los valores placeholder.

---

## Paso 2: Habilitar servicios en consola Firebase

Ir a https://console.firebase.google.com/project/bunkermx-51834

1. **Authentication** → Get Started → habilitar proveedor **"Email/Password"**
2. **Firestore Database** → Create Database → **Production mode** → location **us-central1**

---

## Paso 3: Crear primer usuario admin

### 3a. En Firebase Console → Authentication → Users → Add user
- Email: tu correo admin (ej. krloro92@gmail.com)
- Password: una temporal (la cambias después)

### 3b. En Firebase Console → Firestore → crear documento manualmente
- Collection: `usuarios`
- Document ID: **el UID del usuario recién creado** (lo ves en Authentication → Users)
- Campos:
  - `nombre` (string): `"HaDeZ"`
  - `email` (string): `"krloro92@gmail.com"` (el que usaste)
  - `rol` (string): `"admin"`
  - `activo` (boolean): `true`

---

## Paso 4: Instalar dependencias de Cloud Functions

```bash
cd functions
npm install
cd ..
```

---

## Paso 5: Desplegar reglas de Firestore

```bash
firebase deploy --only firestore:rules --project bunkermx-51834
```

---

## Paso 6: Desplegar Cloud Function

```bash
firebase deploy --only functions --project bunkermx-51834
```

> Nota: Requiere plan Blaze (pay-as-you-go) en Firebase para Cloud Functions. Si no lo tienes, puedes activarlo en la consola sin costo inicial — solo pagas por uso real.

---

## Paso 7: Ejecutar migración de datos (UNA SOLA VEZ)

Esto copia los datos existentes de Google Sheets a Firestore.

1. Abrir el editor de Apps Script del proyecto existente
2. Copiar la función `writeToFirestore()` que ya está en `google-apps-script-munet.js` (líneas 68-107)
3. Copiar el contenido de `scripts/migrate-sheets-to-firestore.js` al mismo proyecto
4. Ejecutar `migrateAllToFirestore()` desde el editor
5. Verificar en Firebase Console → Firestore que las colecciones tengan datos:
   - `cotizaciones` (MNT + BNK)
   - `clientes`
   - `proveedores`
   - `catalogo`
6. **Eliminar** la función `migrateAllToFirestore` del editor (es de una sola vez)

---

## Paso 8: Re-desplegar Apps Script (doble escritura)

El archivo `cotizador-munet/google-apps-script-munet.js` fue modificado para incluir doble escritura a Firestore. Para activarla:

1. Copiar todo el contenido actualizado de `google-apps-script-munet.js` al editor de Apps Script
2. Deploy → **New deployment** → Web app
3. Si la URL cambia, actualizar `APPS_SCRIPT_URL` en:
   - `cotizador-munet/dashboard.html`
   - `cotizador-munet/js/cotizador-munet.js`

---

## Paso 9: Deploy completo

```bash
firebase deploy --project bunkermx-51834
```

---

## Paso 10: Probar flujo completo

1. Abrir `https://bunkermx-51834.web.app/panel` (o tu dominio)
2. Login con credenciales admin → debe redirigir a dashboard
3. Verificar tabs: Cotizaciones, Pipeline, Clientes, Proveedores, Calendario, Reportes, Catálogo, Usuarios
4. Crear usuario de prueba con rol "ventas" desde tab Usuarios
5. En incógnito, login con ese usuario → verificar que solo ve tabs permitidos
6. Probar CRUD en cada módulo
7. Verificar que el wizard público sigue funcionando y las cotizaciones nuevas aparecen en Firestore

---

## Paso 11: Crear plantillas de checklist (opcional, para Fase 4)

En Firebase Console → Firestore → crear documentos en colección `plantillas`:

### Plantilla: Evento en Foro
```
nombre: "Evento en Foro"
tareas: [
  { descripcion: "Confirmar fechas de montaje", orden: 1 },
  { descripcion: "Reservar espacios en calendario", orden: 2 },
  { descripcion: "Rider técnico recibido", orden: 3 },
  { descripcion: "Proveedores confirmados", orden: 4 },
  { descripcion: "Audio e iluminación", orden: 5 },
  { descripcion: "Montaje escenografía", orden: 6 },
  { descripcion: "Ensayo general", orden: 7 },
  { descripcion: "Evento", orden: 8 },
  { descripcion: "Desmontaje", orden: 9 }
]
```

### Plantilla: Producción de Gira
```
nombre: "Producción de Gira"
tareas: [
  { descripcion: "Confirmar itinerario de fechas", orden: 1 },
  { descripcion: "Contratar logística de transporte", orden: 2 },
  { descripcion: "Rider técnico por plaza", orden: 3 },
  { descripcion: "Proveedores locales confirmados", orden: 4 },
  { descripcion: "Hospedaje y viáticos", orden: 5 },
  { descripcion: "Ensayo pre-gira", orden: 6 },
  { descripcion: "Primera plaza", orden: 7 },
  { descripcion: "Cierre de gira", orden: 8 }
]
```

---

## Orden recomendado de ejecución

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

Los pasos 5 y 6 pueden hacerse en paralelo. El paso 7 debe hacerse ANTES del paso 8 (para que los datos ya estén en Firestore cuando se active la doble escritura).
