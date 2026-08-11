# Migración Firebase a nueva cuenta — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el proyecto Firebase de `bunkermx-51834` (jc@bijbani.mx) a `bunker-panel` (admin@vanguardiaysoluciones), con Firebase Hosting sirviendo exclusivamente el panel.

**Architecture:** Firebase Hosting sirve solo `/panel/` como app independiente. El sitio público sigue en cPanel (no se toca). Firebase provee Auth + Firestore + Cloud Functions como backend del panel. La doble escritura desde Apps Script se actualiza para apuntar al proyecto nuevo.

**Tech Stack:** Firebase Hosting, Firebase Auth (Email/Password), Cloud Firestore, Cloud Functions (Node.js 18), Google Apps Script (doble escritura).

## Global Constraints

- Todo texto de UI en español
- Sin frameworks JS — vanilla ES5/ES6
- Firebase project ID: `bunker-panel` (display name: bunker-panel)
- Cuenta Firebase: admin@vanguardiaysoluciones
- CLI logueada con: admin@vanguardiaysoluciones
- Plan actual: Spark (Blaze pendiente por verificación bancaria de Google)
- Firestore region: `us-central1`
- NUNCA tocar cPanel — el sitio público se actualiza solo por GitHub
- Google Sheet ID: `1MrynkbdpsQOq2IuzalyiRfVesUhWcs_020BDl8S_1vk`
- Las reglas de Firestore se publican MANUALMENTE en la consola (no por CLI)
- Deploy de hosting: `firebase deploy --only hosting --project bunker-panel`

---

## ESTADO ACTUAL (2026-08-10)

### Task 1: Pasos manuales en Firebase Console — COMPLETADA

- [x] Proyecto `bunker-panel` creado en admin@vanguardiaysoluciones
- [x] Authentication (Email/Password) habilitado
- [x] Firestore Database creado (us-central1, production mode)
- [x] Web app registrada por CLI (`firebase apps:create web "Panel BUNKER" --project bunker-panel`)
- [x] firebaseConfig obtenido:
  ```
  apiKey: "AIzaSyB5l2OPtDIo2tiaUqeVWsUady_OyIAHPVY"
  authDomain: "bunker-panel.firebaseapp.com"
  projectId: "bunker-panel"
  storageBucket: "bunker-panel.firebasestorage.app"
  messagingSenderId: "503014259933"
  appId: "1:503014259933:web:5fb4866112bcce0fa4af34"
  ```

---

### Task 2: Actualizar configuración Firebase en el código — COMPLETADA

- [x] `panel/js/firebase-config.js` actualizado con credenciales de `bunker-panel`
- [x] `firebase.json` reescrito (hosting apunta solo a `panel/`)
- [x] `.firebaserc` apunta a `bunker-panel`
- [x] Verificado: no quedan referencias a `bunkermx-51834` en código (solo en Apps Script, que es Task 5)

---

### Task 3: Copiar logo al panel para Firebase Hosting — COMPLETADA

- [x] Logo copiado a `panel/img/logo-bunker.webp`
- [x] Rutas actualizadas en `panel/index.html` (de `../img/` a `img/`)
- [x] Rutas actualizadas en `panel/dashboard.html` (de `../img/` a `img/`)
- [x] Verificado: cero referencias `../` en el panel

---

### Task 4: Crear usuario admin y deploy — PARCIALMENTE COMPLETADA

- [x] Usuario admin creado en Auth: krloro92@gmail.com (UID: `UtC6n5oQGWe814jiURLVe13PGVg2`)
- [x] Documento admin creado en Firestore: `usuarios/UtC6n5oQGWe814jiURLVe13PGVg2` (nombre=HaDeZ, rol=admin, activo=true)
- [x] `npm install` en `functions/`
- [x] Reglas Firestore publicadas manualmente en consola
- [ ] ~~Deploy Cloud Functions~~ — **BLOQUEADO: requiere Blaze, verificación bancaria pendiente**
- [x] Deploy Hosting exitoso: https://bunker-panel.web.app

#### BUG RESUELTO: Login error 400

**Causa:** La CLI estaba logueada con krloro92@gmail.com, deployando al proyecto equivocado. Se resolvió haciendo login con admin@vanguardiaysoluciones.com.mx y deployando al proyecto correcto `bunker-panel`.

**Login confirmado:** krloro92@gmail.com funciona correctamente (2026-08-10).

---

### Task 5: Actualizar doble escritura en Apps Script — PENDIENTE

**Files:**
- Modify: `cotizador-munet/google-apps-script-munet.js:67` (FIREBASE_PROJECT)
- Modify: `scripts/migrate-sheets-to-firestore.js:8` (comentario)

- [ ] **Step 1: Actualizar FIREBASE_PROJECT en Apps Script**

En `cotizador-munet/google-apps-script-munet.js`, línea 67:

```javascript
// ANTES:
var FIREBASE_PROJECT = 'bunkermx-51834';

// DESPUÉS:
var FIREBASE_PROJECT = 'bunker-panel';
```

- [ ] **Step 2: Actualizar comentario en script de migración**

En `scripts/migrate-sheets-to-firestore.js`, línea 8:

```javascript
// ANTES:
 * - Firebase y Firestore habilitados en bunkermx-51834

// DESPUÉS:
 * - Firebase y Firestore habilitados en bunker-panel
```

- [ ] **Step 3: Commit**

```bash
git add cotizador-munet/google-apps-script-munet.js scripts/migrate-sheets-to-firestore.js
git commit -m "chore: apuntar doble escritura Apps Script a bunker-panel"
```

- [ ] **Step 4: Re-deploy Apps Script (manual)**

1. Abrir el editor de Apps Script del proyecto existente
2. Copiar todo el contenido actualizado de `cotizador-munet/google-apps-script-munet.js`
3. Pegarlo reemplazando el código anterior
4. Deploy → **New deployment** → Web app → Execute as: Me → Who has access: Anyone
5. Si la URL cambia, actualizar `APPS_SCRIPT_URL` en:
   - `cotizador-munet/js/cotizador-munet.js` (buscar `APPS_SCRIPT_URL`)
   - `panel/dashboard.html` (buscar `APPS_SCRIPT_URL`)

---

### Task 6: Migración de datos Sheets → Firestore — PENDIENTE

- [ ] **Step 1: Copiar script de migración al editor de Apps Script**

Abrir el editor de Apps Script. Agregar temporalmente el contenido de `scripts/migrate-sheets-to-firestore.js` al final del código existente (la función `writeToFirestore()` ya debe estar ahí tras Task 5).

- [ ] **Step 2: Ejecutar migración**

En el editor de Apps Script → seleccionar función `migrateAllToFirestore` → Run.

Revisar el log de ejecución. Debe mostrar:
```
Migrada: Cotizaciones → cotizaciones (N docs)
Migrada: CotizacionesBNK → cotizaciones (N docs)
Migrada: Clientes → clientes (N docs)
Migrada: Proveedores → proveedores (N docs)
Migrada: CatalogoPrecio → catalogo (N docs)
Migración completa
```

- [ ] **Step 3: Verificar datos en Firebase Console**

Ir a https://console.firebase.google.com/project/bunker-panel/firestore

Verificar que existen las colecciones con documentos:
- `cotizaciones` — documentos con folios MNT-* y BNK-*
- `clientes` — documentos con IDs CLI-*
- `proveedores` — documentos con IDs PRV-*
- `catalogo` — documentos con ítems del catálogo de precios

- [ ] **Step 4: Eliminar función de migración**

En el editor de Apps Script, borrar la función `migrateAllToFirestore` y `_migrateSheet` que se agregaron temporalmente. Guardar.

---

### Task 7: Verificación completa y limpieza — PENDIENTE

- [ ] **Step 1: Verificar panel en Firebase Hosting**

Abrir `https://bunker-panel.web.app`:
1. Login con krloro92@gmail.com → debe redirigir a dashboard
2. Tab Cotizaciones → debe listar cotizaciones MNT y BNK migradas
3. Tab Clientes → debe mostrar clientes migrados
4. Tab Proveedores → debe mostrar proveedores migrados
5. Tab Catálogo → debe mostrar ítems de catálogo
6. Tab Usuarios → debe mostrar el usuario admin

- [ ] **Step 2: Verificar wizard público en cPanel**

Abrir el cotizador público (en el dominio de cPanel):
1. Completar el wizard y generar una cotización de prueba
2. En Firebase Console → Firestore → colección `cotizaciones`, verificar que el documento nuevo apareció
3. Confirmar que la doble escritura funciona (Sheet + Firestore)

- [ ] **Step 3: Crear usuario de prueba con rol "ventas"**

Por ahora, se crean manualmente en la consola (Cloud Functions bloqueada por Spark):
1. Firebase Console → Authentication → Add user
2. Firestore → `usuarios/{uid}` con rol="ventas", activo=true
3. En incógnito, login con ese usuario
4. Verificar que solo ve las tabs permitidas para su rol

- [ ] **Step 4: Borrar proyecto viejo**

En Firebase Console → cambiar a la cuenta `jc@bijbani.mx`:
1. Seleccionar proyecto `bunkermx-51834`
2. Project Settings → Delete project

---

## Orden de ejecución restante

```
[RESOLVER BUG] Login error 400 → verificar Authorized domains
  ↓
Task 5 (código + manual: Apps Script → bunker-panel)
  ↓
Task 6 (manual: migración datos Sheets → Firestore)
  ↓
Task 7 (manual: verificación + limpieza)

[CUANDO BLAZE SE ACTIVE]
  → Deploy Cloud Functions: firebase deploy --only functions --project bunker-panel
  → Ya no se crean usuarios manualmente — se usa el panel
```
