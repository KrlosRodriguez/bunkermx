# BUNKER MX

Sitio web institucional y panel operativo de **BUNKER Creatividad Empresarial**: producción de espectáculos, entretenimiento en gran formato, proyectos culturales, MUNET y servicios empresariales.

Todo es HTML, CSS y JavaScript puro. No hay framework, bundler ni paso de compilación.

## Subsistemas

| Subsistema | Ruta | Stack | Despliegue |
|---|---|---|---|
| **Sitio público** | raíz | HTML/CSS/JS estático | GitHub → cPanel (deploy manual desde cPanel, `.cpanel.yml`) |
| **Panel operativo** | `panel/` | Firebase Auth + Firestore + Storage | Firebase Hosting → `bunker-panel.web.app` |
| **Cotizador MNT legacy** | `cotizador-munet/` | HTML/JS + Google Apps Script + Sheets | GitHub → cPanel (junto al sitio público) |

### Sitio público

- `index.html` — página principal.
- `esencia.html` — filosofía, propósito, visión y método.
- `servicios.html` — producción, giras, venues, audiovisual y streaming.
- `talento.html` — directorio del equipo.
- `proyectos.html` — trayectoria y proyectos.
- `munet.html` — subsistema MUNET (enlaza al cotizador).
- `hub.html` — Hub Empresarial BUNKER.
- `css/`, `js/`, `img/` — estilos, scripts y assets.

Usa URLs limpias (`/esencia`, no `/esencia.html`), resueltas por `.htaccess` en Apache.

### Panel operativo (`panel/`)

App interna con 12 tabs: cotizaciones MNT/BNK, pipeline, clientes, proveedores, calendario, reportes, catálogo, eventos, finanzas y usuarios. Requiere cuenta en Firebase Auth.

### Cotizador MNT legacy (`cotizador-munet/`)

- `index.html` — wizard público de renta de espacios MUNET.
- `dashboard.html` — Panel de Ventas anterior, sobre Google Sheets. Lo reemplazó `panel/`, pero sigue desplegado por compatibilidad.
- Backend en Google Apps Script (`google-apps-script-munet.js`), que además replica cotizaciones, clientes y proveedores a Firestore.

| Tipo | Folio | Descripción |
|------|-------|-------------|
| **MNT** | `MNT-AAMMDD-XXXX` | Renta de espacios/venues del MUNET |
| **BNK** | `BNK-AAMMDD-XXXX` | Servicios y producción integral |

## Cómo verlo localmente

```bash
python -m http.server 5500
```

Abre `http://localhost:5500`. Este servidor no resuelve las URLs limpias: abre los `.html` directamente (`/esencia.html`).

## Despliegue

**Sitio público y cotizador legacy**: el push a `main` **no** publica. El dueño de la cuenta ejecuta el deploy del repo desde cPanel (Git Version Control → *Update from Remote* → *Deploy HEAD Commit*). No modificar ninguna otra configuración de cPanel.

**Panel operativo** (solo publica `panel/`):

```bash
firebase deploy --only hosting --project bunker-panel
```

Reglas de seguridad:

```bash
firebase deploy --only firestore:rules,storage --project bunker-panel
```

No uses `firebase deploy` sin `--only`: también desplegaría las Cloud Functions.

## Notas de desarrollo

- Todo el texto visible para usuarios va en español.
- Se editan directamente los archivos fuente; no hay build.
- En el panel, al modificar un JS o CSS hay que subir su `?v=N` en `panel/dashboard.html` para invalidar la caché.
- No subir capturas, logs ni material de trabajo local (`capturas/` está en `.gitignore`).
- La guía técnica detallada está en `CLAUDE.md`.
