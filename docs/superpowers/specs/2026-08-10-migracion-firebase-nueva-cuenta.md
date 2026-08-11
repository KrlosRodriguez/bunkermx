# Migración Firebase — Nueva Cuenta admin@vanguardiaysoluciones

> Migrar el proyecto Firebase de `bunkermx-51834` (jc@bijbani.mx) a un proyecto nuevo `bunker-panel-3a352` en admin@vanguardiaysoluciones. Firebase Hosting sirve exclusivamente el panel — el sitio público sigue en cPanel sin tocarse.

**Fecha:** 2026-08-10

---

## Contexto

- El proyecto `bunkermx-51834` solo servía para preview del sitio al cliente. Se puede borrar sin consecuencias.
- El sitio de producción vive en cPanel y se actualiza por GitHub — **no se toca el cPanel nunca** (tocar cPanel rompió los correos la última vez).
- Todo el código del panel ya existe en `/panel/`, `/functions/`, `firestore.rules`.
- Plan Blaze activado desde el inicio por instrucción del cliente.

## Decisiones de diseño

### Separación cPanel / Firebase

- **cPanel** → sitio público (index, esencia, servicios, talento, proyectos, munet, hub, cotizador) — no se toca
- **Firebase Hosting** → sirve solo el panel (`/panel/`) — accesible en `bunker-panel-3a352.web.app`
- **Firebase backend** → Auth + Firestore + Cloud Functions

Esta separación garantiza que nunca se toca cPanel para nada del panel, y nunca se toca Firebase para nada del sitio público.

### Firebase Hosting — solo archivos del panel

`firebase.json` configura hosting con `public: "panel"` para que solo se desplieguen los archivos de `/panel/`. No se sube el sitio corporativo ni el cotizador.

```json
{
  "hosting": {
    "public": "panel",
    "ignore": ["**/node_modules/**"],
    "rewrites": [
      { "source": "/dashboard", "destination": "/dashboard.html" },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

El panel se accede en:
- `bunker-panel-3a352.web.app` → login (`panel/index.html`)
- `bunker-panel-3a352.web.app/dashboard` → dashboard (`panel/dashboard.html`)

Opcionalmente después se puede configurar un dominio custom (ej. `panel.bunker.mx`) desde Firebase sin tocar cPanel.

### Deploy commands

```bash
# Solo reglas Firestore
firebase deploy --only firestore:rules --project bunker-panel-3a352

# Solo Cloud Functions
firebase deploy --only functions --project bunker-panel-3a352

# Solo el panel (hosting)
firebase deploy --only hosting --project bunker-panel-3a352

# Todo junto
firebase deploy --project bunker-panel-3a352
```

## Configuración del proyecto nuevo

| Atributo | Valor |
|----------|-------|
| Project ID | `bunker-panel-3a352` |
| Cuenta Google | admin@vanguardiaysoluciones |
| Plan | Blaze (pay-as-you-go) |
| Auth provider | Email/Password |
| Firestore region | us-central1 |
| Firestore mode | Production |
| Admin inicial | krloro92@gmail.com (temporal) |
| URL panel | `bunker-panel-3a352.web.app` |

## Archivos a modificar

### `panel/js/firebase-config.js`
Actualizar `firebaseConfig` con las credenciales del proyecto `bunker-panel-3a352` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

### `firebase.json`
Reescribir para apuntar hosting solo a `/panel/`:
```json
{
  "firestore": { "rules": "firestore.rules" },
  "functions": { "source": "functions" },
  "hosting": {
    "public": "panel",
    "ignore": ["**/node_modules/**"],
    "rewrites": [
      { "source": "/dashboard", "destination": "/dashboard.html" },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**/*.{css,js}",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=604800" }
        ]
      }
    ]
  }
}
```

### `.firebaserc`
Apuntar al proyecto nuevo:
```json
{
  "projects": {
    "default": "bunker-panel-3a352"
  }
}
```

## Plan de ejecución

### Ya completados (HaDeZ manual)
- [x] Crear proyecto `bunker-panel-3a352` en Firebase Console
- [x] Activar plan Blaze
- [x] Habilitar Authentication (Email/Password)

### Pendientes manuales (HaDeZ)
- [ ] Crear Firestore Database (Production mode, us-central1) — si no se hizo ya
- [ ] Registrar web app en el proyecto y obtener `firebaseConfig`
- [ ] Crear usuario admin en Auth (krloro92@gmail.com)
- [ ] Crear documento en Firestore `usuarios/{uid}` con campos: nombre="HaDeZ", email="krloro92@gmail.com", rol="admin", activo=true

### Cambios en código (Claude)
- [ ] Actualizar `panel/js/firebase-config.js` con credenciales nuevas
- [ ] Reescribir `firebase.json` (hosting apunta solo a panel)
- [ ] Crear/actualizar `.firebaserc` con project ID `bunker-panel-3a352`

### Deploy (CLI)
- [ ] `npm install` en `functions/`
- [ ] `firebase deploy --only firestore:rules --project bunker-panel-3a352`
- [ ] `firebase deploy --only functions --project bunker-panel-3a352`
- [ ] `firebase deploy --only hosting --project bunker-panel-3a352`

### Migración de datos
- [ ] Ejecutar migración Sheets → Firestore (script de una sola vez)
- [ ] Re-deploy Apps Script con doble escritura activada

### Verificación
- [ ] Abrir `bunker-panel-3a352.web.app` → login con krloro92@gmail.com
- [ ] Verificar tabs: Cotizaciones, Pipeline, Clientes, Proveedores, Calendario, Reportes, Catálogo, Usuarios
- [ ] Verificar que wizard público en cPanel sigue funcionando
- [ ] Verificar que datos nuevos del wizard llegan a Firestore (doble escritura)

## Limpieza

- Borrar proyecto `bunkermx-51834` desde Firebase Console (cuenta jc@bijbani.mx)
- No hay datos que rescatar — todo vive en Google Sheets
