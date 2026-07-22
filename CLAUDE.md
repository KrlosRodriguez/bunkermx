# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BUNKER Creatividad Empresarial corporate website — a single-page, Spanish-language marketing site for an entertainment and large-format event production company (Mexico, USA, Central America). This is **not** a Node/build-tool project; it is a vanilla HTML/CSS/JS static site with no build step, no package manager, and no test framework.

## How to Run

Open `index.html` directly in a browser, or serve it with any static file server (e.g. `npx serve .` or VS Code Live Server). There is no build, lint, or test command.

## Architecture

The entire site lives in three files:

- **`index.html`** (~914 lines) — all page content in semantic `<section>` blocks. Sections in order: Nav, Hero (`#inicio`), Ticker, Manifiesto/Esencia (`#manifiesto`), Servicios (`#servicios`), Numeros (`#numeros`), Equipo/Talento (`#talento`), Proyectos (`#proyectos`), MUNET (`#munet`), Hub Empresarial (`#hub`), Contacto (`#contacto`), Footer.
- **`css/styles.css`** (~1138 lines) — single stylesheet using CSS custom properties (design tokens in `:root`). Zero `!important` policy. Two breakpoints (tablet/mobile). Key color tokens: `--gold`, `--terra`, `--munet`, `--bg`, `--text`.
- **`js/main.js`** (~168 lines) — all JS in a single `DOMContentLoaded` handler. Features: custom cursor, nav scroll-spy via `IntersectionObserver`, hamburger menu, expand/collapse panels (BNK system buttons, MUNET/Pasatono cards, Espacios toggle), project category filters, scroll-reveal animations, hub platform tabs, contact form (currently simulated submit).

## Key Conventions

- **Language**: all user-facing text is in Spanish. Keep it that way.
- **No build tools**: no bundler, transpiler, or preprocessor. Edit the source files directly.
- **CSS cascade**: styles rely on specificity and cascade order — never use `!important`.
- **Design tokens**: all colors, spacing, and typography sizes are defined as CSS custom properties in `:root`. Use these tokens rather than hard-coded values.
- **Reveal animations**: elements with class `rev` get animated in by `IntersectionObserver` (adds class `vis`). Apply `rev` to new content blocks for consistent entrance animations.
- **Fonts**: Barlow Condensed (headings), Barlow (body), Space Mono (monospace accents) — loaded from Google Fonts.

## Other Files

- `bunker_v2.html` — previous/alternate version of the site (2778 lines, self-contained with inline CSS/JS). Kept as reference; the current version is `index.html` + external CSS/JS.
- `document_pdf*.pdf` — reference PDF documents (company materials).
- `img/` — all image assets (logos, section illustrations).
