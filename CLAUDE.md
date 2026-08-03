# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BUNKER Creatividad Empresarial corporate website — a multi-page, Spanish-language marketing site for an entertainment and large-format event production company (Mexico, USA, Central America). This is **not** a Node/build-tool project; it is a vanilla HTML/CSS/JS static site with no build step, no package manager, and no test framework. Deployed via **Firebase Hosting**.

## How to Run

Open `index.html` directly in a browser, or serve it with any static file server (e.g. `python -m http.server 5500` or VS Code Live Server). There is no build, lint, or test command. Deploy with `firebase deploy`.

## Architecture

Multi-page site with shared core (system.css + system.js) and per-page CSS/JS modules.

### Pages (HTML)

- **`index.html`** (~408 lines) — landing/dashboard: Hero, Ticker, Números, Contacto, Footer.
- **`esencia.html`** — Manifiesto, filosofía y propósito.
- **`servicios.html`** — Producción, giras, venues, audiovisual, streaming.
- **`talento.html`** — Directorio del equipo BUNKER.
- **`proyectos.html`** — Archivo de trayectoria y proyectos.
- **`munet.html`** — Subsistema MUNET (espacios, Pasatono).
- **`hub.html`** — Hub Empresarial BUNKER.
- **`cotizador-munet/index.html`** — Cotizador wizard para renta de espacios MUNET.
- **`cotizador-munet/dashboard.html`** — Dashboard administrativo del cotizador.

### CSS

- **`css/system.css`** (~937 lines) — estilos compartidos: layout, nav, cursor, grid, tipografía, animaciones, responsive. Design tokens en `:root`.
- **`css/styles.css`** (~776 lines) — estilos legacy del index original (se conserva).
- **`css/pages/*.css`** — estilos específicos por página: dashboard, esencia, hub, munet, proyectos, servicios, talento.
- **`cotizador-munet/css/cotizador-munet.css`** (~659 lines) — estilos del cotizador.

### JavaScript

- **`js/system.js`** (~537 lines) — JS core compartido: cursor, nav, typing, counters, glitch, reveal, page transitions.
- **`js/main.js`** (~88 lines) — JS legacy del index original (se conserva).
- **`js/login-gate.js`** (~82 lines) — gate de autenticación.
- **`js/pages/*.js`** — lógica por página: dashboard.js, esencia.js, proyectos.js.
- **`cotizador-munet/js/cotizador-munet.js`** (~1244 lines) — lógica del wizard cotizador (pasos, tarifas, PDF, envío a Google Sheets).
- **`cotizador-munet/google-apps-script-munet.js`** — código Apps Script para el backend del cotizador.

### Deployment

- **`firebase.json`** — configuración de Firebase Hosting con rewrites para rutas limpias (`/esencia`, `/servicios`, `/talento`, `/proyectos`, `/munet`, `/hub`, `/cotizador-munet`).

## Key Conventions

- **Language**: all user-facing text is in Spanish. Keep it that way.
- **No build tools**: no bundler, transpiler, or preprocessor. Edit the source files directly.
- **CSS cascade**: styles rely on specificity and cascade order — never use `!important`.
- **Design tokens**: all colors, spacing, and typography sizes are defined as CSS custom properties in `:root` (inside `system.css`). Use these tokens rather than hard-coded values.
- **Modular structure**: shared code goes in `system.css`/`system.js`; page-specific code goes in `css/pages/` and `js/pages/`.
- **Reveal animations**: elements with class `rev` get animated in by `IntersectionObserver` (adds class `vis`). Apply `rev` to new content blocks for consistent entrance animations.
- **Fonts**: Barlow Condensed (headings), Barlow (body), Space Mono (monospace accents) — loaded from Google Fonts.

## Other Files

- `bunker_v2.html` — previous single-page version of the site. Kept as reference.
- `document_pdf*.pdf` — reference PDF documents (company materials).
- `img/` — all image assets (logos, section illustrations).
