# Rediseño del sitio público según minuta — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar los cambios de la minuta al sitio público de BUNKER en 9 etapas (Task 0 a Task 8, más la 3b opcional). Cada etapa se publica sola y ninguna rompe lo que ya funciona.

**Orden y dependencias:** 0 → 1 → 2 → 3 → 4 → 5 → 7 → 8, y la 6 en cuanto lleguen las fotos de MUNET. La 3 va **antes** que la 4. La 8 necesita la 7 publicada, el diseño aprobado y las fotos de proyectos. Las tareas 0–5 y 7 no dependen de contenido del cliente.

**Architecture:** El sitio es HTML/CSS/JS estático sin build. Se publica en cPanel automáticamente con cada push a `main`. Por eso **cada etapa vive en su propia rama** y solo se fusiona a `main` cuando pasa la verificación automática (`scripts/check_site.py`) y la revisión en navegador. Las URLs no cambian; se cambian textos, marcado y CSS por página. El contenido que se mueve (Sistema BNK) primero se agrega en su nuevo lugar y después se quita del viejo.

**Tech Stack:** HTML5, CSS con tokens de `css/system.css`, `js/system.js` (ES6), Python 3 stdlib (verificación), Apache `.htaccess` (URLs limpias), cPanel vía `.cpanel.yml`.

**Spec:** `docs/superpowers/specs/2026-10-07-rediseno-sitio-minuta-design.md`. Lee primero la sección 2 (decisiones D1–D7) y la sección 3 (contenido que entrega el cliente).

## Global Constraints

- Todo texto visible en español. Las marcas van como **BUNKER** (sin acento) y **MUNET**.
- **No cambiar URLs**: `/esencia`, `/talento`, `/servicios`, `/proyectos`, `/munet` siguen igual (D1). Solo se agrega `/archivo` en la Etapa 7.
- Sin build tools, sin frameworks, sin dependencias nuevas.
- CSS: nunca `!important`; colores, tipografía y espaciado con los tokens de `:root` en `css/system.css` (`--gold`, `--gold-dim`, `--munet`, `--munet-dim`, `--border`, `--border-gold`, `--border-munet`, `--bg-panel`, `--bg-elevated`, `--text`, `--text-mid`, `--text-dim`, `--fs-xs`…`--fs-xl`, `--gap-card`, `--ease-out`, `--dur-fast`).
- Fuentes: Barlow Condensed (títulos), Barlow (cuerpo), Space Mono (etiquetas mono).
- Bloques nuevos de contenido llevan clase `rev` (animación de entrada de `system.js`).
- **Nada visible depende de hover** en los bloques que pide la minuta: la información se ve "a primera vista".
- Imágenes nuevas: `.webp`, horizontales, con `width`, `height`, `alt` y `loading="lazy"`; **≤ 300 KB** cada una.
- Al tocar un CSS o JS, subir su `?v=N` en los `<link>`/`<script>` de las páginas que lo cargan (cPanel/navegadores cachean).
- **Nunca tocar cPanel** desde su panel de control. El despliegue es solo `git push origin main`.
- Cada commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` si lo hace un agente.

## Flujo obligatorio de cada etapa

> **Corrección 2026-10-07 — el push NO publica.** Producción seguía sirviendo el sitio del 10-ago-2026: el deploy a cPanel es **manual** y lo ejecuta el dueño de la cuenta. Por eso las etapas **no se fusionan a `main`**. Todas se integran en la rama **`web/rediseno`**, y `main` queda limpio y desplegable para otras correcciones. Cuando el cliente apruebe, se fusiona `web/rediseno` (o etapa por etapa) a `main` y se ejecuta el deploy manual. En cada tarea, los pasos de "publicar" se leen como "integrar en `web/rediseno`", y la verificación de "Producción" se hace después de ese deploy.

Todas las tareas siguen estos pasos. Abajo solo se repite lo específico.

```bash
git switch web/rediseno
git switch -c web/etapa-N-nombre
```

1. **Agregar la comprobación** de la etapa a `scripts/check_site.py` y correr `python scripts/check_site.py`. Debe **fallar** en la comprobación nueva y pasar en todas las demás.
2. Implementar.
3. `python scripts/check_site.py` → **todas OK** (exit 0).
4. Revisión en navegador local: `python -m http.server 5500` desde la raíz y abrir `http://localhost:5500/<pagina>.html`. Las URLs limpias no funcionan con este servidor; se usa `.html`. Revisar a **1440 px, 1025 px y 375 px** de ancho. La consola debe quedar sin errores. Pegar en consola el snippet de la tarea; todas las respuestas deben ser `true`.
5. Commit en la rama.
6. Integrar:

```bash
git switch web/rediseno
git merge --no-ff web/etapa-N-nombre
python scripts/check_site.py
git push origin web/rediseno
```

7. **Verificar producción** (después del deploy manual): `curl -s https://bunkermx.com/<pagina> | grep -c "<texto nuevo>"` debe dar ≥ 1. Abrir la página con recarga forzada (Ctrl+Shift+R).
8. **Si algo se ve roto en producción:** `git revert -m 1 <merge>` en `main`, push y nuevo deploy manual. Esto deshace solo esa etapa. Luego investigar en la rama.

## Review Focus

1. **Menú a 1025–1280 px**: con "ADN BUNKER", "NOSOTROS" e "INICIAR PROYECTO", el menú de escritorio no debe partirse en dos líneas ni desbordarse. El menú hamburguesa entra a ≤1024 px. Lo cubre el snippet de la Task 1.
2. **Scroll horizontal en móvil (375 px)** en los grids nuevos (servicios, espacios, revista de proyectos): `document.documentElement.scrollWidth <= innerWidth`. Está en el snippet de las Tasks 5, 6 y 8.
3. **Hueco del Sistema BNK**: si se publica la Etapa 4 (quitar de ADN) antes que la 3 (agregar a NOSOTROS), el contenido desaparece del sitio. La comprobación de la Task 4 falla si `talento.html` no lo tiene.
4. **Lógica hover vieja de `system.js` sobre marcado nuevo**: `system.js` engancha hover y clic a `.svc-panel`, `.munet-svc-panel` y `[data-expand]`. El marcado nuevo **no usa esas clases ni ese atributo**; las comprobaciones de las Tasks 5 y 6 lo verifican.
5. **Imágenes faltantes o pesadas**: una tarjeta sin foto o con una foto de 3 MB arruina la revista y los espacios. `check_internal_refs` detecta archivos faltantes y `check_image_weights` (Task 6) los que pasan de 300 KB.

---

### Task 0: Red de seguridad — verificación automática, herramienta de bloques, skip-link y versiones de CSS

Rama: `web/etapa-0-red-seguridad`. **No cambia nada visible.**

**Files:**
- Create: `scripts/check_site.py`
- Create: `scripts/swap_block.py`
- Modify: `esencia.html`, `servicios.html`, `talento.html`, `proyectos.html`, `munet.html`, `hub.html` (encabezado `<header class="page-header">` y `<link rel="stylesheet">`)
- Modify: `index.html` (`<link rel="stylesheet">`)
- Modify: `CLAUDE.md` (sección "Rediseño por etapas")

**Interfaces:**
- Produces: `scripts/check_site.py` con `load(name) -> Page`, `Page.by_class(cls)`, `Page.by_id(id)`, `Page.inside(el, tag=None, cls=None)`, `Page.text_of(el) -> str`, listas `PAGES`, `BASE_CHECKS`, `STAGE_CHECKS`. Cada comprobación es `def check_x(pages: dict[str, Page]) -> list[str]` (lista vacía = OK).
- Produces: `scripts/swap_block.py ARCHIVO INICIO FIN NUEVO` y `scripts/swap_block.py --insert-before ARCHIVO MARCADOR NUEVO`.

- [ ] **Step 1: Crear `scripts/check_site.py`**

```python
#!/usr/bin/env python3
"""Verificación estática del sitio público BUNKER (sin dependencias).

Uso:  python scripts/check_site.py
Sale con código 0 si todo pasa, 1 si algo falla. No modifica nada.

Cada etapa del plan de rediseño agrega sus propias comprobaciones a STAGE_CHECKS
antes de implementar el cambio (primero falla, luego pasa).
"""
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ['index.html', 'esencia.html', 'servicios.html', 'talento.html',
         'proyectos.html', 'munet.html', 'hub.html']


class Page(HTMLParser):
    """Guarda elementos con sus atributos y el texto plano de cada uno."""

    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'source', 'track', 'wbr'}

    def __init__(self, name):
        super().__init__(convert_charrefs=True)
        self.name = name
        self.elements = []   # dicts: tag, attrs, text, classes, parent
        self._stack = []

    def handle_starttag(self, tag, attrs):
        el = {'tag': tag, 'attrs': dict(attrs), 'text': '',
              'parent': self._stack[-1] if self._stack else None}
        el['classes'] = set((el['attrs'].get('class') or '').split())
        self.elements.append(el)
        if tag not in self.VOID:
            self._stack.append(el)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID and self._stack:
            self._stack.pop()

    def handle_endtag(self, tag):
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i]['tag'] == tag:
                del self._stack[i:]
                break

    def handle_data(self, data):
        for el in self._stack:
            el['text'] += data

    # helpers
    def by_class(self, cls):
        return [e for e in self.elements if cls in e['classes']]

    def by_id(self, id_):
        return [e for e in self.elements if e['attrs'].get('id') == id_]

    def inside(self, el, tag=None, cls=None):
        """Descendientes de el, filtrados por tag y/o clase."""
        out = []
        for e in self.elements:
            if (tag and e['tag'] != tag) or (cls and cls not in e['classes']):
                continue
            a = e['parent']
            while a is not None and a is not el:
                a = a['parent']
            if a is el:
                out.append(e)
        return out

    def text_of(self, el):
        return re.sub(r'\s+', ' ', el['text']).strip()


def load(name):
    p = Page(name)
    with open(os.path.join(ROOT, name), encoding='utf-8') as f:
        p.feed(f.read())
    return p


def read_text(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def resolve_internal(href, page_name):
    """Devuelve la ruta de archivo local de un href interno, o None si es externo/ancla."""
    href = href.split('#')[0].split('?')[0]
    if not href or re.match(r'^(https?:|mailto:|tel:|data:|javascript:)', href):
        return None
    if href.startswith('/'):
        rel = href.lstrip('/')
        if rel == '':
            return 'index.html'
        if os.path.isdir(os.path.join(ROOT, rel)):
            return os.path.join(rel, 'index.html')
        if os.path.splitext(rel)[1] == '':
            return rel + '.html'      # URL limpia → .html (lo resuelve .htaccess)
        return rel
    base = os.path.dirname(page_name)
    rel = os.path.normpath(os.path.join(base, href))
    if os.path.isdir(os.path.join(ROOT, rel)):
        return os.path.join(rel, 'index.html')
    return rel


# ── Comprobaciones base (deben pasar siempre) ──

def check_internal_refs(pages):
    errs = []
    for p in pages.values():
        for el in p.elements:
            for attr in ('href', 'src'):
                v = el['attrs'].get(attr)
                if not v or el['tag'] in ('meta',):
                    continue
                if el['tag'] == 'link' and el['attrs'].get('rel') in ('canonical', 'preconnect', 'dns-prefetch'):
                    continue
                target = resolve_internal(v, p.name)
                if target and not os.path.exists(os.path.join(ROOT, target)):
                    errs.append('%s: %s="%s" no existe (%s)' % (p.name, attr, v, target))
    return errs


def check_anchor_targets(pages):
    errs = []
    for p in pages.values():
        for el in p.elements:
            v = el['attrs'].get('href') or ''
            m = re.match(r'^(/?)#([\w-]+)$', v)
            if not m:
                continue
            target_page = pages['index.html'] if m.group(1) == '/' else p
            if not target_page.by_id(m.group(2)):
                errs.append('%s: ancla "%s" sin destino en %s' % (p.name, v, target_page.name))
    return errs


def check_unique_ids(pages):
    errs = []
    for p in pages.values():
        seen = {}
        for el in p.elements:
            i = el['attrs'].get('id')
            if i:
                seen[i] = seen.get(i, 0) + 1
        errs += ['%s: id duplicado "%s" (x%d)' % (p.name, i, n) for i, n in seen.items() if n > 1]
    return errs


def check_core_shell(pages):
    errs = []
    for p in pages.values():
        if not p.by_id('page-transition'):
            errs.append('%s: falta #page-transition' % p.name)
        if not any('system.js' in (e['attrs'].get('src') or '') for e in p.elements if e['tag'] == 'script'):
            errs.append('%s: no carga js/system.js' % p.name)
        if len(p.by_class('nav-link')) == 0 or len(p.by_class('mob-link')) == 0:
            errs.append('%s: falta nav de escritorio o móvil' % p.name)
    return errs


def check_expand_pairs(pages):
    """Cada data-expand debe apuntar a un panel que exista (system.js lo asume)."""
    errs = []
    for p in pages.values():
        for el in p.elements:
            t = el['attrs'].get('data-expand')
            if t and not p.by_id(t):
                errs.append('%s: data-expand="%s" sin panel' % (p.name, t))
    return errs


def check_css_versioned(pages):
    """Los CSS propios llevan ?v=N para invalidar caché en cada etapa."""
    errs = []
    for p in pages.values():
        for el in p.elements:
            href = el['attrs'].get('href') or ''
            if el['tag'] == 'link' and el['attrs'].get('rel') == 'stylesheet' and href.startswith('css/'):
                if '?v=' not in href:
                    errs.append('%s: %s sin ?v=N' % (p.name, href))
    return errs


BASE_CHECKS = [check_internal_refs, check_anchor_targets, check_unique_ids,
               check_core_shell, check_expand_pairs, check_css_versioned]

# ── Comprobaciones por etapa (cada tarea agrega las suyas aquí arriba de STAGE_CHECKS) ──

STAGE_CHECKS = []


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')  # consola de Windows
    missing = [n for n in PAGES if not os.path.exists(os.path.join(ROOT, n))]
    if missing:
        print('[FAIL] faltan páginas: ' + ', '.join(missing))
        return 1
    pages = {n: load(n) for n in PAGES}
    failed = 0
    for check in BASE_CHECKS + STAGE_CHECKS:
        errs = check(pages)
        status = 'OK  ' if not errs else 'FAIL'
        print('[%s] %s' % (status, check.__name__))
        for e in errs:
            print('       - ' + e)
        failed += bool(errs)
    print('\n%d comprobaciones, %d fallaron' % (len(BASE_CHECKS + STAGE_CHECKS), failed))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 2: Correr y confirmar las fallas conocidas**

Run: `python scripts/check_site.py`
Expected: FAIL en dos comprobaciones; las demás OK:
- `check_anchor_targets`: 6 líneas `ancla "#main-content" sin destino` (esencia, servicios, talento, proyectos, munet, hub). Es un **bug real que ya existe**: el enlace "Saltar al contenido principal" de las páginas interiores no lleva a ningún lado.
- `check_css_versioned`: los `<link>` a `css/...` sin `?v=`.

- [ ] **Step 3: Crear `scripts/swap_block.py`**

```python
#!/usr/bin/env python3
"""Reemplaza o inserta un bloque de texto en un archivo usando marcadores exactos.

  python scripts/swap_block.py ARCHIVO INICIO FIN NUEVO
      Reemplaza desde INICIO (incluido) hasta FIN (excluido) por el contenido de NUEVO.
  python scripts/swap_block.py --insert-before ARCHIVO MARCADOR NUEVO
      Inserta el contenido de NUEVO justo antes de MARCADOR.

NUEVO es la ruta de un archivo con el contenido nuevo ('-' = vacío).
Cada marcador debe aparecer exactamente una vez; si no, aborta sin tocar nada.
Respeta los finales de línea (CRLF/LF) del archivo original.
"""
import io
import sys


def read(path):
    raw = io.open(path, 'rb').read()
    return raw.decode('utf-8').replace('\r\n', '\n'), b'\r\n' in raw


def main(argv):
    insert = argv[:1] == ['--insert-before']
    if insert:
        argv = argv[1:]
    if len(argv) != (3 if insert else 4):
        print(__doc__)
        return 2
    path, new_path = argv[0], argv[-1]
    markers = argv[1:-1]
    text, crlf = read(path)
    new = '' if new_path == '-' else read(new_path)[0]
    for m in markers:
        n = text.count(m)
        if n != 1:
            print('ERROR: el marcador aparece %d veces en %s: %r' % (n, path, m))
            return 1
    i = text.index(markers[0])
    if insert:
        text = text[:i] + new + text[i:]
    else:
        j = text.index(markers[1])
        if j <= i:
            print('ERROR: FIN aparece antes que INICIO')
            return 1
        text = text[:i] + new + text[j:]
    if crlf:
        text = text.replace('\n', '\r\n')
    io.open(path, 'wb').write(text.encode('utf-8'))
    print('OK: %s actualizado' % path)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
```

Prueba rápida (no debe tocar nada porque `<div` no es único):

Run: `python scripts/swap_block.py servicios.html '<div' '<!-- CTA -->' -`
Expected: `ERROR: el marcador aparece N veces ...` y `git status` sin cambios.

- [ ] **Step 4: Arreglar el skip-link en las 6 páginas interiores**

```bash
sed -i 's#^<header class="page-header">$#<header class="page-header" id="main-content" tabindex="-1">#' esencia.html servicios.html talento.html proyectos.html munet.html hub.html
grep -c 'id="main-content"' esencia.html servicios.html talento.html proyectos.html munet.html hub.html
```

Expected: `1` en cada archivo. `system.js` solo usa `#main-content` para revelar el contenido del index (`.loaded`), y en páginas interiores esa clase no tiene estilos. No hay efecto visual.

- [ ] **Step 5: Versionar los CSS de las 7 páginas**

```bash
sed -i -E 's#href="(css/[^"?]+\.css)"#href="\1?v=1"#g' index.html esencia.html servicios.html talento.html proyectos.html munet.html hub.html
grep -ho 'href="css/[^"]*"' index.html esencia.html servicios.html talento.html proyectos.html munet.html hub.html | sort | uniq -c
```

Expected: todos los `css/...` terminan en `?v=1`.

- [ ] **Step 6: Correr la verificación**

Run: `python scripts/check_site.py`
Expected: `6 comprobaciones, 0 fallaron`.

- [ ] **Step 7: Revisión en navegador**

Abrir `http://localhost:5500/esencia.html`, presionar **Tab** una vez y luego **Enter** sobre "Saltar al contenido principal". El foco debe quedar en el encabezado. En consola:

```js
[document.activeElement.id === 'main-content',
 [...document.styleSheets].filter(s => s.href && s.href.includes('/css/')).every(s => s.href.includes('?v=1') && s.cssRules.length > 0)]
```

Expected: `[true, true]`, es decir, foco en el encabezado y todos los CSS cargados con `?v=1`. Abrir también `index.html` y `servicios.html`: deben verse idénticas a producción.

- [ ] **Step 8: Documentar el flujo en `CLAUDE.md`**

Agregar al final de la sección "Sitio público (raíz)":

```markdown
### Rediseño por etapas (minuta 2026-10)

Plan: `docs/superpowers/plans/2026-10-07-rediseno-sitio-minuta.md`. Cada etapa va en una rama `web/etapa-N-*` y solo se fusiona a `main` (lo que publica en cPanel) cuando `python scripts/check_site.py` pasa y se revisó en navegador a 1440/1025/375 px.

- `scripts/check_site.py` — verificación estática sin dependencias (enlaces internos, anclas, ids únicos, CSS versionados y comprobaciones por etapa). Correr antes de cada push.
- `scripts/swap_block.py` — reemplaza/inserta bloques HTML entre marcadores exactos; aborta si un marcador no es único.
- Los CSS de las páginas llevan `?v=N`: subirlo al modificar el archivo.
```

- [ ] **Step 9: Commit y publicar** (flujo pasos 5–7)

```bash
git add scripts/check_site.py scripts/swap_block.py *.html CLAUDE.md
git commit -m "chore(sitio): verificación automática, skip-link funcional y CSS versionados"
```

Verificación en producción: `curl -s https://bunkermx.com/esencia | grep -c 'id="main-content"'` → `1`.

---

### Task 1: Menú — ADN BUNKER, NOSOTROS, INICIAR PROYECTO

Rama: `web/etapa-1-menu`.

**Files:**
- Modify: los 7 HTML (nav de escritorio, drawer móvil, footer y breadcrumbs JSON-LD)
- Modify: `scripts/check_site.py`

**Interfaces:**
- Consumes: `Page.by_class`, `Page.text_of`, `STAGE_CHECKS` (Task 0)
- Produces: constante `NAV_EXPECTED` en `check_site.py` (la reutiliza la Task 7 al crear `archivo.html`)

- [ ] **Step 1: Agregar la comprobación**

En `scripts/check_site.py`, arriba de `STAGE_CHECKS = []`:

```python
NAV_EXPECTED = [('/', 'INICIO'), ('/esencia', 'ADN BUNKER'), ('/servicios', 'SERVICIOS'),
                ('/talento', 'NOSOTROS'), ('/proyectos', 'PROYECTOS'), ('/munet', 'MUNET'),
                ('/#contacto', 'INICIAR PROYECTO')]


def check_nav_labels(pages):
    errs = []
    for p in pages.values():
        for cls in ('nav-link', 'mob-link'):
            got = []
            for e in p.by_class(cls):
                href = e['attrs'].get('href')
                got.append(('/#contacto' if href == '#contacto' else href, p.text_of(e)))
            if got != NAV_EXPECTED:
                errs.append('%s .%s = %r' % (p.name, cls, got))
        old = [p.text_of(e) for e in p.by_class('foot-link') if p.text_of(e) in ('Equipo', 'Contacto', 'Esencia')]
        if old:
            errs.append('%s footer con etiquetas viejas: %r' % (p.name, old))
    return errs
```

Y cambiar la lista: `STAGE_CHECKS = [check_nav_labels]`.

- [ ] **Step 2: Correr la verificación**

Run: `python scripts/check_site.py`
Expected: FAIL solo en `check_nav_labels`, con 14 líneas (7 páginas × 2 menús) más las de footer.

- [ ] **Step 3: Cambiar etiquetas de menú, footer y breadcrumbs**

```bash
sed -i -E \
  -e 's#(class="(nav|mob)-link[^"]*">)ESENCIA<#\1ADN BUNKER<#' \
  -e 's#(class="(nav|mob)-link[^"]*">)EQUIPO<#\1NOSOTROS<#' \
  -e 's#(class="(nav|mob)-link[^"]*">)CONTACTO<#\1INICIAR PROYECTO<#' \
  -e 's#(class="foot-link">)Equipo<#\1Nosotros<#' \
  -e 's#(class="foot-link">)Esencia<#\1ADN BUNKER<#' \
  -e 's#(class="foot-link">)Contacto<#\1Iniciar proyecto<#' \
  -e 's#"name": "Esencia"#"name": "ADN BUNKER"#' \
  -e 's#"name": "Talento"#"name": "Nosotros"#' \
  index.html esencia.html servicios.html talento.html proyectos.html munet.html hub.html
git diff --stat
```

Expected: los 7 HTML modificados. Revisar `git diff` y confirmar que solo cambiaron textos dentro de `<a>` y los dos `"name"` de JSON-LD.

- [ ] **Step 4: Correr la verificación**

Run: `python scripts/check_site.py`
Expected: `7 comprobaciones, 0 fallaron`.

- [ ] **Step 5: Revisión en navegador (Review Focus 1)**

Con la ventana a **1025 px** de ancho, abrir `index.html`, `esencia.html` y `munet.html`. En consola:

```js
const n = document.querySelector('.nav-links');
const links = [...n.querySelectorAll('.nav-link')];
[n.scrollWidth <= n.clientWidth,
 new Set(links.map(a => Math.round(a.getBoundingClientRect().top))).size === 1,
 links.length === 7]
```

Expected: `[true, true, true]`, es decir, sin desborde y todo en una sola línea. **Si el primero o el segundo da `false`**, agregar al final de `css/system.css`, sin tocar otras reglas:

```css
@media(min-width:1025px) and (max-width:1280px){
  .nav-links{gap:clamp(10px,1.4vw,20px)}
  .nav-link{letter-spacing:1px}
}
```

Luego subir `css/system.css?v=1` → `?v=2` en los 7 HTML y repetir el snippet. A **375 px**, abrir el menú hamburguesa y confirmar que se ven los 7 enlaces. A **1440 px**, confirmar que el enlace de la página actual sigue marcado como activo.

- [ ] **Step 6: Commit y publicar**

```bash
git add *.html css/system.css scripts/check_site.py
git commit -m "feat(sitio): menú ADN BUNKER / NOSOTROS / INICIAR PROYECTO"
```

Producción: `curl -s https://bunkermx.com/ | grep -c 'INICIAR PROYECTO'` → `2` o más (nav y drawer).

---

### Task 2: Inicio — nueva línea superior y frase bajo el logo

Rama: `web/etapa-2-inicio`.

**Files:**
- Modify: `index.html` (`.hero-eyebrow`, `.hero-claim`, metadatos de descripción y título social)
- Modify: `scripts/check_site.py`

**Interfaces:**
- Consumes: `Page.by_class`, `Page.text_of`

- [ ] **Step 1: Agregar la comprobación**

Arriba de `STAGE_CHECKS`:

```python
HOME_EYEBROW = 'Entretenimiento · Experiencias · Espectáculos · Venues'
HOME_CLAIM = 'Estrategia, creatividad y producción para eventos, espectáculos y experiencias de alto impacto.'


def check_home_copy(pages):
    p = pages['index.html']
    errs = []
    ey = [p.text_of(e) for e in p.by_class('hero-eyebrow')]
    if ey != [HOME_EYEBROW]:
        errs.append('hero-eyebrow = %r' % ey)
    cl = [p.text_of(e) for e in p.by_class('hero-claim')]
    if cl != [HOME_CLAIM]:
        errs.append('hero-claim = %r' % cl)
    metas = [e['attrs'].get('content', '') for e in p.elements if e['tag'] == 'meta']
    if any('Entertainment' in m for m in metas):
        errs.append('metadatos todavía dicen "Entertainment"')
    return errs
```

`STAGE_CHECKS = [check_nav_labels, check_home_copy]`

- [ ] **Step 2: Correr la verificación**

Run: `python scripts/check_site.py`
Expected: FAIL solo en `check_home_copy`, con 3 líneas.

- [ ] **Step 3: Cambiar el hero**

En `index.html`, reemplazar la línea:

```html
        <div class="hero-eyebrow rev">Entertainment &middot; Gran Formato &middot; Internacional</div>
```

por:

```html
        <div class="hero-eyebrow rev">Entretenimiento &middot; Experiencias &middot; Espectáculos &middot; Venues</div>
```

Y el bloque:

```html
        <p class="hero-claim rev">
          Producimos los espectáculos más grandes del continente.<br>
          <em>Donde el arte y la estrategia crean momentos que no se olvidan.</em>
        </p>
```

por:

```html
        <p class="hero-claim rev">Estrategia, creatividad y producción para eventos, espectáculos y experiencias de alto impacto.</p>
```

- [ ] **Step 4: Alinear metadatos**

En `index.html`:
- `<meta name="description" content="...">` → `content="BUNKER Creatividad Empresarial — Estrategia, creatividad y producción para eventos, espectáculos y experiencias de alto impacto. 30+ años de experiencia. México, USA, Centroamérica."`
- `og:title` y `twitter:title` → `content="BUNKER — Entretenimiento · Experiencias · Espectáculos · Venues"`
- JSON-LD `"description"` → `"Estrategia, creatividad y producción para eventos, espectáculos y experiencias de alto impacto. 30+ años de experiencia."`
- Botón del hero `<span>VER EQUIPO</span>` → `<span>NOSOTROS</span>`, para que coincida con el menú.

- [ ] **Step 5: Correr la verificación**

Run: `python scripts/check_site.py`
Expected: `8 comprobaciones, 0 fallaron`.

- [ ] **Step 6: Revisión en navegador**

`http://localhost:5500/index.html`. Esperar a que termine la secuencia de arranque y luego:

```js
const c = document.querySelector('.hero-claim');
[document.getElementById('main-content').classList.contains('loaded'),
 c.offsetHeight > 0 && c.offsetHeight < 200,
 document.documentElement.scrollWidth <= innerWidth]
```

Expected: `[true, true, true]` a 1440 y 375 px. Comparar visualmente con producción: el espaciado entre logo, frase y botones debe verse equilibrado. La frase nueva es una sola oración; si a 375 px queda pegada a los botones, revisar `.hero-claim` en `css/pages/dashboard.css` (no cambiar otras reglas).

- [ ] **Step 7: Commit y publicar**

```bash
git add index.html scripts/check_site.py
git commit -m "feat(inicio): nueva línea de posicionamiento y frase bajo el logo"
```

Producción: `curl -s https://bunkermx.com/ | grep -c 'Estrategia, creatividad y producción'` → ≥ 1.

---

### Task 3: NOSOTROS — EXPERIENCIA, cifras y Sistema BNK (agregar antes de quitar de ADN)

Rama: `web/etapa-3-nosotros`. **Esta etapa debe publicarse antes que la Task 4.**

**Files:**
- Modify: `talento.html` (`<title>`, metas, encabezado, nueva sección `#sistema-bnk`)
- Modify: `css/pages/talento.css` (estilos de cifras y del Sistema BNK, visible sin hover)
- Modify: `index.html` (módulo "TALENTO" del grid de módulos)
- Modify: `scripts/check_site.py`

**Interfaces:**
- Consumes: `Page.inside`, `read_text` (Task 0)
- Produces: sección `<section id="sistema-bnk">` en `talento.html` con 4 `.bnk-decl-card`. La Task 4 comprueba que exista antes de quitarla de `esencia.html`.

- [ ] **Step 1: Agregar la comprobación**

```python
def check_nosotros(pages):
    p = pages['talento.html']
    errs = []
    h1 = [p.text_of(e) for e in p.elements if e['tag'] == 'h1']
    if h1 != ['EXPERIENCIA']:
        errs.append('h1 = %r' % h1)
    meta = ' '.join(p.text_of(e) for e in p.by_class('page-header-meta'))
    for s in ('+100 EXPERIENCIAS', '+30 AÑOS', '+30 VENUES'):
        if s not in meta:
            errs.append('falta "%s" en el encabezado' % s)
    sec = p.by_id('sistema-bnk')
    if not sec:
        errs.append('falta <section id="sistema-bnk">')
    else:
        names = [p.text_of(e) for e in p.inside(sec[0], cls='bnk-decl-name')]
        if names != ['FILOSOFÍA', 'PROPÓSITO', 'VISIÓN', 'MISIÓN']:
            errs.append('Sistema BNK = %r' % names)
        if p.inside(sec[0], cls='bnk-decl-hint'):
            errs.append('quedó el "+" de hover en las tarjetas')
    if re.search(r'\.bnk-decl-quote\{[^}]*max-height:0', read_text('css/pages/talento.css')):
        errs.append('talento.css oculta .bnk-decl-quote')
    labels = [p_.text_of(e) for p_ in [pages['index.html']] for e in p_.by_class('mod-label')]
    if 'NOSOTROS' not in labels:
        errs.append('index: módulo NOSOTROS no encontrado (%r)' % labels)
    return errs
```

`STAGE_CHECKS = [check_nav_labels, check_home_copy, check_nosotros]`

- [ ] **Step 2: Correr la verificación**

Run: `python scripts/check_site.py`
Expected: FAIL solo en `check_nosotros`.

- [ ] **Step 3: Encabezado de la página**

En `talento.html`:
- `<title>DIRECTORIO DE PERSONAL | BUNKER SYSTEM V2.0</title>` → `<title>NOSOTROS | BUNKER SYSTEM V2.0</title>`
- `og:title` y `twitter:title` `"Nuestro Equipo | BUNKER"` → `"Nosotros | BUNKER"`
- Reemplazar:

```html
        <h1 class="page-header-title">DIRECTORIO DE <span style="color:var(--gold)">PERSONAL</span></h1>
```

por:

```html
        <h1 class="page-header-title"><span style="color:var(--gold)">EXPERIENCIA</span></h1>
```

- Reemplazar el bloque `page-header-meta`:

```html
      <div class="page-header-meta">
        PERSONNEL: 3 SOCIOS + TEAM<br>
        EXPERIENCE: 30+ YEARS<br>
        STATUS: OPERATIONAL
      </div>
```

por:

```html
      <div class="page-header-meta page-header-meta--stats">
        <div><strong>+100</strong> EXPERIENCIAS</div>
        <div><strong>+30</strong> AÑOS</div>
        <div><strong>+30</strong> VENUES</div>
      </div>
```

- [ ] **Step 4: Insertar la sección Sistema BNK**

Crear `/tmp/sistema-bnk.html` con el contenido de abajo. Las 4 frases se copian **textualmente** de `esencia.html` y no se reescriben:

```html
<!-- SISTEMA BNK (movido desde ADN BUNKER) -->
<section class="sys-section bnk-sistema" id="sistema-bnk">
  <div class="sys-inner">
    <div class="hud-divider">
      <span class="hud-divider-text">// SISTEMA BNK //</span>
    </div>
    <div class="bnk-decl-grid">
      <div class="bnk-decl-card bnk-decl-card--accent rev">
        <div class="bnk-decl-num">01</div>
        <div class="bnk-decl-name">FILOSOFÍA</div>
        <p class="bnk-decl-quote">Cuando se comprenda la importancia del arte y la creatividad en los negocios, el sector empresarial y del emprendimiento será imparable.</p>
      </div>
      <div class="bnk-decl-card rev">
        <div class="bnk-decl-num">02</div>
        <div class="bnk-decl-name">PROPÓSITO</div>
        <p class="bnk-decl-quote">Demostrar que la creatividad no es un lujo decorativo, es el motor más eficiente de transformación empresarial. Es nuestra única moneda de intercambio.</p>
      </div>
      <div class="bnk-decl-card rev">
        <div class="bnk-decl-num">03</div>
        <div class="bnk-decl-name">VISIÓN</div>
        <p class="bnk-decl-quote">Ser la referencia iberoamericana que prueba que creatividad y rigor empresarial son la misma cosa: ver lo que otros no ven y construir lo que otros no se atreven.</p>
      </div>
      <div class="bnk-decl-card rev">
        <div class="bnk-decl-num">04</div>
        <div class="bnk-decl-name">MISIÓN</div>
        <p class="bnk-decl-quote">Detectar, proponer y construir soluciones creativas que generan ventaja competitiva real, resignificando conceptos con criterio estratégico.</p>
      </div>
    </div>
  </div>
</section>

```

Run: `python scripts/swap_block.py --insert-before talento.html '<!-- CTA -->' /tmp/sistema-bnk.html`
Expected: `OK: talento.html actualizado`.

Antes de seguir, comparar las 4 frases contra `esencia.html` con `grep -c "Cuando se comprenda la importancia" esencia.html talento.html`. Debe dar `1` en cada uno.

- [ ] **Step 5: Estilos en `css/pages/talento.css`**

Agregar al final del archivo. Las reglas se copian de `esencia.css` **sin** el ocultamiento por hover:

```css
/* ── Cifras del encabezado (NOSOTROS) ── */
.page-header-meta--stats{line-height:1.5}
.page-header-meta--stats div{white-space:nowrap}
.page-header-meta--stats strong{
  font-family:'Barlow Condensed',sans-serif;font-size:var(--fs-lg);
  font-weight:700;color:var(--gold);margin-right:6px;letter-spacing:0;
}

/* ── Sistema BNK (movido desde ADN BUNKER) — siempre visible ── */
.bnk-sistema{border-top:1px solid var(--border)}
.bnk-sistema .hud-divider{margin-bottom:clamp(28px,4vw,48px)}
.bnk-decl-grid{
  display:grid;grid-template-columns:repeat(4,1fr);
  gap:var(--gap-card);
}
.bnk-decl-card{
  background:var(--bg-elevated);border:1px solid var(--border);
  padding:clamp(24px,2.5vw,36px);
  display:flex;flex-direction:column;gap:12px;
  transition:border-color .3s, box-shadow .3s;
}
.bnk-decl-card:hover{border-color:var(--border-gold);box-shadow:var(--glow-gold)}
.bnk-decl-card--accent{border-color:var(--gold-dim);background:linear-gradient(160deg,var(--bg-elevated) 40%,rgba(198,163,80,.06))}
.bnk-decl-num{
  font-family:'Barlow Condensed',sans-serif;font-size:36px;
  font-weight:800;color:rgba(198,163,80,.18);line-height:1;
}
.bnk-decl-name{
  font-family:'Space Mono',monospace;font-size:var(--fs-xs);
  letter-spacing:3px;text-transform:uppercase;color:var(--gold);
}
.bnk-decl-quote{
  font-family:'Barlow',sans-serif;font-size:var(--fs-sm);
  font-weight:400;color:var(--text-mid);line-height:1.7;margin:0;
}
@media(max-width:1024px){.bnk-decl-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){
  .bnk-decl-grid{grid-template-columns:1fr}
  .page-header-meta--stats{text-align:left}
}
```

Subir `css/pages/talento.css?v=1` → `?v=2` en `talento.html`.

- [ ] **Step 6: Módulo en el index**

En `index.html`, dentro del módulo `<span class="mod-label">TALENTO</span>`:
- `TALENTO` → `NOSOTROS`
- `<div class="mod-title">Directorio<br>de Personal</div>` → `<div class="mod-title">Experiencia<br>& Sistema BNK</div>`
- `<div class="mod-meta">3 SOCIOS + EQUIPO TÉCNICO</div>` → `<div class="mod-meta">+100 EXPERIENCIAS // +30 AÑOS // +30 VENUES</div>`

- [ ] **Step 7: Correr la verificación**

Run: `python scripts/check_site.py`
Expected: `9 comprobaciones, 0 fallaron`.

- [ ] **Step 8: Revisión en navegador**

`http://localhost:5500/talento.html`, **sin mover el mouse sobre las tarjetas**:

```js
const q = [...document.querySelectorAll('#sistema-bnk .bnk-decl-quote')];
[q.length === 4,
 q.every(e => getComputedStyle(e).opacity === '1' && e.offsetHeight > 20),
 document.documentElement.scrollWidth <= innerWidth]
```

Expected: `[true, true, true]` a 1440, 1025 y 375 px. Las tarjetas del equipo (`.id-card`) se siguen expandiendo al tocarlas en móvil, igual que antes.

- [ ] **Step 9: Commit y publicar**

```bash
git add talento.html index.html css/pages/talento.css scripts/check_site.py
git commit -m "feat(nosotros): título EXPERIENCIA, cifras +100/+30/+30 y Sistema BNK visible"
```

Producción: `curl -s https://bunkermx.com/talento | grep -c 'id="sistema-bnk"'` → `1`.

---

### Task 3b (opcional, cuando llegue el texto): Historia en el Sistema BNK

Hazla solo cuando el cliente entregue el texto de "Historia" (spec §3). Rama: `web/etapa-3b-historia`.

**Files:**
- Modify: `talento.html`, `css/pages/talento.css`, `scripts/check_site.py`

- [ ] **Step 1: Agregar la comprobación**

```python
def check_historia(pages):
    p = pages['talento.html']
    sec = p.by_id('sistema-bnk')
    h = p.inside(sec[0], cls='bnk-historia') if sec else []
    if len(h) != 1:
        return ['falta .bnk-historia dentro de #sistema-bnk']
    if len(p.text_of(h[0])) < 120:
        return ['el texto de Historia parece incompleto']
    return []
```

Agregarla a `STAGE_CHECKS`. Run: `python scripts/check_site.py` → FAIL en `check_historia`.

- [ ] **Step 2: Insertar el bloque** dentro de `#sistema-bnk`, entre el `hud-divider` y `.bnk-decl-grid`. Cada párrafo del cliente va en su propio `<p>`, con el texto tal cual se entregó:

```html
    <div class="bnk-historia rev">
      <div class="bnk-decl-name">HISTORIA</div>
      <p>PÁRRAFO 1 DEL CLIENTE</p>
      <p>PÁRRAFO 2 DEL CLIENTE</p>
    </div>
```

Reemplazar `PÁRRAFO n DEL CLIENTE` por el texto real. Si queda ese texto, la comprobación de longitud debe fallar.

- [ ] **Step 3: CSS** al final de `css/pages/talento.css`, y subir `?v=`:

```css
.bnk-historia{max-width:820px;margin-bottom:clamp(32px,4vw,56px)}
.bnk-historia p{color:var(--text-mid);line-height:1.8;margin:12px 0 0}
```

- [ ] **Step 4:** `python scripts/check_site.py` → todo OK. Revisión a 1440/375 px, commit `feat(nosotros): historia del Sistema BNK` y publicar.

---

### Task 4: ADN BUNKER — Ecosistema / Mecanismo / Resultado, atributos visibles y sin Sistema BNK

Rama: `web/etapa-4-adn`. **Requisito:** la Task 3 ya está en `main` y publicada.

**Files:**
- Modify: `esencia.html` (`<title>`, metas, encabezado, terminal izquierda, atributos, se quita el Sistema BNK)
- Modify: `css/pages/esencia.css` (atributos visibles, estilo de los 3 pilares, se quitan reglas del Sistema BNK)
- Modify: `index.html` (módulo ESENCIA)
- Modify: `scripts/check_site.py`

**Interfaces:**
- Consumes: `#sistema-bnk` en `talento.html` (Task 3)

- [ ] **Step 1: Agregar la comprobación**

```python
ADN_PILARES = ['// ── ECOSISTEMA ──', '// ── MECANISMO ──', '// ── RESULTADO ──']


def check_adn(pages):
    p = pages['esencia.html']
    errs = []
    h1 = [p.text_of(e) for e in p.elements if e['tag'] == 'h1']
    if h1 != ['ADN BUNKER']:
        errs.append('h1 = %r' % h1)
    seps = [p.text_of(e) for e in p.by_class('mf-term-sep')]
    if seps != ADN_PILARES:
        errs.append('pilares = %r' % seps)
    if len(p.by_class('mf-pillar-claim')) != 3:
        errs.append('faltan las 3 frases .mf-pillar-claim')
    if p.by_class('bnk-decl-card'):
        errs.append('el Sistema BNK sigue en esencia.html')
    if not pages['talento.html'].by_id('sistema-bnk'):
        errs.append('talento.html no tiene #sistema-bnk: publica la Etapa 3 antes')
    if not p.by_class('bnk-metodo'):
        errs.append('desapareció el Método BNK')
    if len(p.by_class('mf-atrib')) != 4 or p.by_class('mf-atrib-hint'):
        errs.append('atributos: deben ser 4 y sin el "+" de hover')
    css = read_text('css/pages/esencia.css')
    if re.search(r'\.mf-atrib-desc\{[^}]*max-height:0', css):
        errs.append('esencia.css sigue ocultando .mf-atrib-desc')
    if 'ADN BUNKER' not in [pages['index.html'].text_of(e) for e in pages['index.html'].by_class('mod-label')]:
        errs.append('index: módulo ADN BUNKER no encontrado')
    return errs
```

`STAGE_CHECKS = [check_nav_labels, check_home_copy, check_nosotros, check_adn]` (más `check_historia` si ya existe).

- [ ] **Step 2: Correr la verificación**

Run: `python scripts/check_site.py`
Expected: FAIL solo en `check_adn`.

- [ ] **Step 3: Encabezado y metadatos**

En `esencia.html`:
- `<title>NUESTRA ESENCIA | BUNKER SYSTEM V2.0</title>` → `<title>ADN BUNKER | BUNKER SYSTEM V2.0</title>`
- `og:title` y `twitter:title` → `"ADN BUNKER | BUNKER"`
- `description` y `og:description` → `"Ecosistema, mecanismo y resultado: cómo BUNKER convierte la cultura en un sistema y la experiencia en un activo patrimonial. Método BNK."`
- `<h1 class="page-header-title">NUESTRA <span style="color:var(--gold)">ESENCIA</span></h1>` → `<h1 class="page-header-title">ADN <span style="color:var(--gold)">BUNKER</span></h1>`
- En `page-header-meta`, cambiar `SISTEMA: BNK ACTIVE` por `MÉTODO: BNK ACTIVE`.

- [ ] **Step 4: Reemplazar la terminal de la izquierda**

Crear `/tmp/adn-terminal.html`:

```html
        <div class="mf-terminal rev">
          <div class="mf-term-bar">
            <span class="mf-term-title">CORE_DATA // ADN.DAT</span>
            <span class="mf-term-dots"><span></span><span></span><span></span></span>
          </div>
          <div class="mf-term-body">
            <div class="mf-term-line">> LOADING CORE_DATA...</div>
            <div class="mf-pillar">
              <div class="mf-term-sep">// ── ECOSISTEMA ──</div>
              <h3 class="mf-pillar-claim">Conectamos marca, espacio y monetización en un solo frente.</h3>
              <p class="mf-body-p">Unimos propiedades intelectuales con arraigo cultural, recintos físicos estratégicos con alta capacidad de convocatoria y un modelo de operación multicanal. Esto nos permite diversificar las fuentes de ingreso y capturar valor en cada punto de contacto: taquilla, consumo in situ, patrocinios y datos de audiencia.</p>
            </div>
            <div class="mf-pillar">
              <div class="mf-term-sep">// ── MECANISMO ──</div>
              <h3 class="mf-pillar-claim">Convertimos la cultura en un sistema operativo.</h3>
              <p class="mf-body-p">Articulamos la atención masiva mediante procesos estructurados de captura y gestión de tráfico. En lugar de depender de eventos aislados, transformamos la efervescencia cultural en un flujo constante, predecible y optimizado de personas, interacciones y transacciones.</p>
            </div>
            <div class="mf-pillar">
              <div class="mf-term-sep">// ── RESULTADO ──</div>
              <h3 class="mf-pillar-claim">Transformamos la experiencia en un activo patrimonial.</h3>
              <p class="mf-body-p">Evolucionamos el entretenimiento efímero hacia una plataforma de negocio escalable. Al integrar infraestructura, datos y recurrencia, convertimos la experiencia del usuario en un activo financiero con permanencia en el tiempo y alto potencial de expansión.</p>
            </div>
          </div>
        </div>

```

Run: `python scripts/swap_block.py esencia.html '        <div class="mf-terminal rev">' '        <!-- Tres capas -->' /tmp/adn-terminal.html`
Expected: `OK: esencia.html actualizado`. "Tres capas" y la fórmula se quedan (decisión D3).

- [ ] **Step 5: Quitar el "+" de hover de los atributos**

```bash
sed -i '/<span class="mf-atrib-hint">+<\/span>/d' esencia.html
grep -c 'mf-atrib-hint' esencia.html
```

Expected: `0`. `js/pages/esencia.js` sigue alternando `.open` al hacer clic; ahora solo afecta el brillo del borde y no hay que tocarlo.

- [ ] **Step 6: Quitar el Sistema BNK de esta página**

```bash
python scripts/swap_block.py esencia.html '      <!-- Declaraciones -->' '      <!-- Metodo BNK -->' -
sed -i 's#<span class="hud-divider-text">// SISTEMA BNK //</span>#<span class="hud-divider-text">// MÉTODO //</span>#' esencia.html
grep -c 'bnk-decl-card' esencia.html
```

Expected: `OK: esencia.html actualizado` y `0`. El bloque `<!-- Metodo BNK -->` queda intacto.

- [ ] **Step 7: CSS de `esencia.css`**

a) Reemplazar las reglas de la descripción del atributo, que hoy está oculta hasta el hover:

```css
.mf-atrib-desc{
  font-size:var(--fs-sm);color:var(--text-mid);line-height:1.6;
  max-height:0;opacity:0;overflow:hidden;
  margin-top:0;
  transition:max-height .4s var(--ease-out), opacity .3s .05s, margin-top .4s var(--ease-out);
}
.mf-atrib:hover .mf-atrib-desc,
.mf-atrib.open .mf-atrib-desc{
  max-height:120px;opacity:1;margin-top:14px;
}
```

por:

```css
.mf-atrib-desc{
  font-size:var(--fs-sm);color:var(--text-mid);line-height:1.6;
  margin:14px 0 0;
}
```

b) Agregar después de `.mf-highlight{...}`:

```css
/* Pilares ADN: Ecosistema / Mecanismo / Resultado */
.mf-pillar + .mf-pillar{margin-top:20px;padding-top:20px;border-top:1px solid var(--border)}
.mf-pillar-claim{
  font-family:'Barlow Condensed',sans-serif;font-size:var(--fs-lg);
  font-weight:700;color:var(--gold);line-height:1.25;
  margin:0 0 10px;
}
```

c) Borrar todo el bloque que va desde `/* Declaraciones grid — 4 cards */` hasta antes de `/* Metodo BNK */`, porque ya no se usa en esta página. Borrar también la línea `.bnk-decl-grid{...}` dentro de los `@media(max-width:1024px)` y `@media(max-width:640px)` del final.

```bash
python scripts/swap_block.py css/pages/esencia.css '/* Declaraciones grid — 4 cards */' '/* Metodo BNK */' -
sed -i '/^  \.bnk-decl-grid{grid-template-columns/d' css/pages/esencia.css
grep -c 'bnk-decl' css/pages/esencia.css
```

Expected: `0`.

Subir `css/pages/esencia.css?v=1` → `?v=2` en `esencia.html`.

- [ ] **Step 8: Módulo en el index**

En `index.html`, módulo `<span class="mod-label">ESENCIA</span>`:
- `ESENCIA` → `ADN BUNKER`
- `<div class="mod-title">Manifiesto<br>& Sistema BNK</div>` → `<div class="mod-title">Ecosistema<br>& Método BNK</div>`
- `mod-desc` → `Cómo conectamos marca, espacio y monetización, y el método con el que lo ejecutamos.`
- `mod-meta` → `ECOSISTEMA // MECANISMO // RESULTADO // MÉTODO`

- [ ] **Step 9: Correr la verificación**

Run: `python scripts/check_site.py`
Expected: todas OK.

- [ ] **Step 10: Revisión en navegador**

`http://localhost:5500/esencia.html`, **sin pasar el mouse por los atributos**:

```js
const d = [...document.querySelectorAll('.mf-atrib-desc')];
[d.length === 4,
 d.every(e => getComputedStyle(e).opacity === '1' && e.offsetHeight > 20),
 document.querySelectorAll('.mf-pillar').length === 3,
 !!document.querySelector('.bnk-metodo'),
 document.documentElement.scrollWidth <= innerWidth]
```

Expected: `[true, true, true, true, true]` a 1440, 1025 y 375 px. Revisar visualmente que la columna izquierda (terminal + capas + fórmula) no quede mucho más alta que la derecha a 1440 px. Si la diferencia es grande, es un tema de diseño a consultar, no un bug.

- [ ] **Step 11: Commit y publicar**

```bash
git add esencia.html index.html css/pages/esencia.css scripts/check_site.py
git commit -m "feat(adn): ecosistema/mecanismo/resultado, atributos visibles, Sistema BNK pasa a Nosotros"
```

Producción: `curl -s https://bunkermx.com/esencia | grep -c 'mf-pillar-claim'` → `3`.

---

### Task 5: Servicios — 4 categorías visibles

Rama: `web/etapa-5-servicios`.

**Files:**
- Modify: `servicios.html` (se reemplaza el grid de 6 módulos)
- Modify: `css/pages/servicios.css` (estilos `.svc-cat*` nuevos al final; **no borrar** reglas `.svc-*` viejas porque `munet.html` y otras páginas reutilizan `.svc-term-body` y `.svc-exp-list`)
- Modify: `index.html` (módulo SERVICIOS)
- Modify: `scripts/check_site.py`

**Interfaces:**
- Consumes: `Page.inside`

- [ ] **Step 1: Agregar la comprobación**

```python
SVC_EXPECTED = [
    ('EVENTOS & EXPERIENCIAS', ['Eventos corporativos', 'Activaciones', 'Lanzamientos', 'Conferencias',
                                'Experiencias de marca', 'Eventos institucionales']),
    ('ESPECTÁCULOS & GRAN FORMATO', ['Conciertos', 'Shows', 'Giras', 'Producción técnica',
                                     'Stage management', 'Site coordination']),
    ('PRODUCCIÓN & CONTENIDO', ['Audiovisual', 'Streaming', 'Branded content', 'Producción musical', 'Cine / TV']),
    ('VENUES & OPERACIÓN', ['Dirección de recintos', 'Producción in-house', 'Operación técnica',
                            'MUNET →', 'Gestión de espacios']),
]


def check_servicios(pages):
    p = pages['servicios.html']
    errs = []
    got = []
    for card in p.by_class('svc-cat'):
        name = [p.text_of(e) for e in p.inside(card, cls='svc-cat-name')]
        items = [p.text_of(e) for e in p.inside(card, tag='li')]
        got.append((name[0] if name else None, items))
    if got != SVC_EXPECTED:
        errs.append('categorías = %r' % got)
    munet = [e for e in p.elements if e['tag'] == 'a' and e['attrs'].get('href') == '/munet'
             and 'svc-cat-link' in e['classes']]
    if len(munet) != 1:
        errs.append('falta el enlace MUNET dentro de la categoría 04')
    if p.by_class('svc-panel') or any('data-expand' in e['attrs'] for e in p.elements):
        errs.append('quedan paneles viejos .svc-panel/data-expand (system.js les pone hover)')
    idx = pages['index.html']
    if not any('4 CATEGORÍAS' in idx.text_of(e) for e in idx.by_class('mod-meta')):
        errs.append('index: el módulo SERVICIOS debe decir 4 CATEGORÍAS')
    return errs
```

Agregar `check_servicios` a `STAGE_CHECKS`. Run: `python scripts/check_site.py` → FAIL solo en `check_servicios`.

- [ ] **Step 2: Reemplazar el grid**

Crear `/tmp/servicios-grid.html`:

```html
    <div class="svc-cat-grid">

      <article class="svc-cat rev" id="cat-eventos">
        <header class="svc-cat-head">
          <span class="svc-cat-num">01</span>
          <h2 class="svc-cat-name">EVENTOS &amp; EXPERIENCIAS</h2>
        </header>
        <ul class="svc-cat-list">
          <li>Eventos corporativos</li>
          <li>Activaciones</li>
          <li>Lanzamientos</li>
          <li>Conferencias</li>
          <li>Experiencias de marca</li>
          <li>Eventos institucionales</li>
        </ul>
      </article>

      <article class="svc-cat rev" id="cat-espectaculos">
        <header class="svc-cat-head">
          <span class="svc-cat-num">02</span>
          <h2 class="svc-cat-name">ESPECTÁCULOS &amp; GRAN FORMATO</h2>
        </header>
        <ul class="svc-cat-list">
          <li>Conciertos</li>
          <li>Shows</li>
          <li>Giras</li>
          <li>Producción técnica</li>
          <li>Stage management</li>
          <li>Site coordination</li>
        </ul>
      </article>

      <article class="svc-cat rev" id="cat-produccion">
        <header class="svc-cat-head">
          <span class="svc-cat-num">03</span>
          <h2 class="svc-cat-name">PRODUCCIÓN &amp; CONTENIDO</h2>
        </header>
        <ul class="svc-cat-list">
          <li>Audiovisual</li>
          <li>Streaming</li>
          <li>Branded content</li>
          <li>Producción musical</li>
          <li>Cine / TV</li>
        </ul>
      </article>

      <article class="svc-cat svc-cat--venues rev" id="cat-venues">
        <header class="svc-cat-head">
          <span class="svc-cat-num">04</span>
          <h2 class="svc-cat-name">VENUES &amp; OPERACIÓN</h2>
        </header>
        <ul class="svc-cat-list">
          <li>Dirección de recintos</li>
          <li>Producción in-house</li>
          <li>Operación técnica</li>
          <li><a href="/munet" class="svc-cat-link">MUNET <span aria-hidden="true">&rarr;</span></a></li>
          <li>Gestión de espacios</li>
        </ul>
      </article>

    </div>
  </div>
</section>

```

Run: `python scripts/swap_block.py servicios.html '    <div class="svc-grid">' '<!-- CTA -->' /tmp/servicios-grid.html`
Expected: `OK: servicios.html actualizado`.

- [ ] **Step 3: CSS** al final de `css/pages/servicios.css`:

```css
/* ── Servicios por categoría (rediseño 2026-10) — sin hover para ver contenido ── */
.svc-cat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.svc-cat{
  position:relative;background:var(--bg-panel);border:1px solid var(--border);
  clip-path:polygon(0 0,calc(100% - var(--clip-md)) 0,100% var(--clip-md),100% 100%,var(--clip-md) 100%,0 calc(100% - var(--clip-md)));
  padding:28px 28px 32px;transition:border-color var(--dur-fast);
}
.svc-cat::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,var(--gold),var(--gold-dim),transparent);
}
.svc-cat:hover{border-color:var(--border-gold)}
.svc-cat--venues::before{background:linear-gradient(90deg,var(--munet),var(--munet-dim),transparent)}
.svc-cat-head{display:flex;align-items:baseline;gap:16px;margin-bottom:20px}
.svc-cat-num{font-family:'Space Mono',monospace;font-size:var(--fs-sm);color:var(--gold-dim);letter-spacing:2px}
.svc-cat-name{
  font-family:'Barlow Condensed',sans-serif;font-size:var(--fs-xl);font-weight:700;
  text-transform:uppercase;letter-spacing:1px;line-height:1.1;margin:0;
}
.svc-cat-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:10px 24px}
.svc-cat-list li{position:relative;padding-left:18px;color:var(--text-mid);line-height:1.5}
.svc-cat-list li::before{
  content:'>';position:absolute;left:0;top:.15em;
  font-family:'Space Mono',monospace;font-size:var(--fs-xs);color:var(--gold);
}
.svc-cat-link{color:var(--munet);text-decoration:none;border-bottom:1px solid var(--border-munet)}
.svc-cat-link:hover,.svc-cat-link:focus-visible{color:var(--munet-light);border-bottom-color:var(--munet)}
@media(max-width:768px){.svc-cat-grid{grid-template-columns:1fr}}
@media(max-width:480px){
  .svc-cat{padding:22px 20px 24px}
  .svc-cat-list{grid-template-columns:1fr}
}
```

Subir `css/pages/servicios.css?v=` **en las 6 páginas interiores**, porque todas cargan `servicios.css`:

```bash
sed -i 's#css/pages/servicios.css?v=1#css/pages/servicios.css?v=2#' esencia.html servicios.html talento.html proyectos.html munet.html hub.html
```

Si ya estaba en otra versión, subir al siguiente número.

- [ ] **Step 4: Metadatos y encabezado de `servicios.html`**

- `page-header-meta`: `MODULES: 6 ACTIVE` → `CATEGORÍAS: 4`
- `description` y `og:description` → `"Servicios BUNKER: eventos y experiencias, espectáculos y gran formato, producción y contenido, venues y operación."`

- [ ] **Step 5: Módulo en el index**

En el módulo `<span class="mod-label">SERVICIOS</span>` de `index.html`:
- `mod-desc` → `Eventos y experiencias, espectáculos y gran formato, producción y contenido, venues y operación.`
- `mod-meta` → `4 CATEGORÍAS DE SERVICIO`

- [ ] **Step 6: Correr la verificación**

Run: `python scripts/check_site.py` → todas OK.

- [ ] **Step 7: Revisión en navegador (Review Focus 2 y 4)**

`http://localhost:5500/servicios.html`, sin pasar el mouse:

```js
const cats = [...document.querySelectorAll('.svc-cat')];
[cats.length === 4,
 cats.every(c => c.querySelectorAll('li').length >= 5 && c.offsetHeight > 120),
 cats.every(c => getComputedStyle(c).opacity === '1' && [...c.querySelectorAll('li')].every(li => li.offsetHeight > 0)),
 document.documentElement.scrollWidth <= innerWidth]
```

Expected: `[true, true, true, true]` a 1440, 1025 y 375 px. Hay que hacer scroll hasta el final antes del snippet para que las animaciones `.rev` terminen. Hacer clic en "MUNET →": debe ir a `munet.html`. Revisar también `munet.html`, `esencia.html` y `talento.html`: se deben ver igual que antes, porque comparten `servicios.css`.

- [ ] **Step 8: Commit y publicar**

```bash
git add servicios.html index.html esencia.html talento.html proyectos.html munet.html hub.html css/pages/servicios.css scripts/check_site.py
git commit -m "feat(servicios): 4 categorías visibles con enlace a MUNET"
```

Producción: `curl -s https://bunkermx.com/servicios | grep -c 'class="svc-cat '` → `4`.

---

### Task 6: MUNET — tarjetas de espacio con imagen, m², capacidad e "ideal para"

Rama: `web/etapa-6-munet`. **Requiere** las 8 fotos y los datos faltantes del cliente (spec §3). Sin fotos, esta etapa **no se fusiona**: la comprobación de imágenes lo bloquea.

**Files:**
- Create: `img/munet/explanada.webp`, `foro.webp`, `lobby.webp`, `auditorio.webp`, `jardin-social.webp`, `sala-exposiciones.webp`, `velaria.webp`, `salas-capacitacion.webp`
- Modify: `munet.html` (se reemplaza `.espacios-grid` y sus paneles hover)
- Modify: `css/pages/munet.css` (estilos `.esp-*` nuevos al final)
- Modify: `scripts/check_site.py`

**Interfaces:**
- Consumes: `Page.inside`, `check_internal_refs`
- Produces: `check_image_weights` (lo reutiliza la Task 8)

- [ ] **Step 1: Preparar las fotos**

Cada foto: horizontal, recortada a **3:2**, **1200×800 px**, `.webp` calidad ~80, **≤ 300 KB**. Con `cwebp` instalado:

```bash
mkdir -p img/munet
cwebp -q 80 -resize 1200 800 ORIGINAL_EXPLANADA.jpg -o img/munet/explanada.webp
```

Si no hay `cwebp`, usar https://squoosh.app (WebP, 1200×800, calidad 80). Repetir para los 8 nombres de la lista de archivos. Revisar los pesos con `ls -l img/munet`.

- [ ] **Step 2: Agregar las comprobaciones**

```python
ESPACIOS = ['Explanada', 'Foro', 'Lobby', 'Auditorio', 'Jardín Social',
            'Sala Exposiciones', 'Velaria', 'Salas Capacitación']
MAX_IMG_BYTES = 300 * 1024


def check_munet_espacios(pages):
    p = pages['munet.html']
    errs = []
    cards = p.by_class('esp-card')
    names = [p.text_of(e) for e in p.by_class('esp-card-name')]
    if names != ESPACIOS:
        errs.append('espacios = %r' % names)
    for c in cards:
        nm = (p.inside(c, cls='esp-card-name') or [{'text': '?'}])[0]['text'].strip()
        imgs = p.inside(c, tag='img')
        if len(imgs) != 1 or not imgs[0]['attrs'].get('alt'):
            errs.append('%s: necesita exactamente 1 imagen con alt' % nm)
        if not p.inside(c, tag='dd'):
            errs.append('%s: sin m² ni capacidad' % nm)
        if len(p.inside(c, tag='li')) < 2:
            errs.append('%s: "ideal para" con menos de 2 usos' % nm)
    if p.by_class('esp-compact'):
        errs.append('quedan tarjetas .esp-compact viejas')
    exp_ids = [e['attrs'].get('id') for e in p.by_class('munet-svc-exp-panel')]
    if exp_ids != ['munet-alianza-exp']:
        errs.append('paneles hover sobrantes (solo debe quedar el de la alianza): %r' % exp_ids)
    grid = p.by_class('esp-grid')
    if grid and p.inside(grid[0], cls='munet-svc-panel'):
        errs.append('.munet-svc-panel dentro de .esp-grid (system.js le pondría hover)')
    if not any(e['attrs'].get('href') == 'cotizador-munet/' for e in p.elements):
        errs.append('se perdió el enlace al cotizador')
    return errs


def check_image_weights(pages):
    errs = []
    for p in pages.values():
        for e in p.elements:
            src = e['attrs'].get('src') or ''
            if e['tag'] == 'img' and (src.startswith('img/munet/') or src.startswith('img/proyectos/')):
                path = os.path.join(ROOT, src)
                if os.path.exists(path) and os.path.getsize(path) > MAX_IMG_BYTES:
                    errs.append('%s: %s pesa %d KB (máx 300)' % (p.name, src, os.path.getsize(path) // 1024))
    return errs
```

El panel de la alianza (`#munet-alianza` + `#munet-alianza-exp`) **no se toca** en esta etapa. Es el único panel hover que debe quedar en `munet.html`.

Agregar `check_munet_espacios, check_image_weights` a `STAGE_CHECKS`. Run: `python scripts/check_site.py` → FAIL en `check_munet_espacios`.

- [ ] **Step 3: Reemplazar el grid de espacios**

Llenar los datos pendientes con lo que entregue el cliente. **Si un dato no llega, se borra su `<div>` completo dentro de `<dl>`**; no se pone "—" ni "por definir". Crear `/tmp/munet-espacios.html`:

```html
      <div class="esp-grid">

        <article class="esp-card rev" id="espacio-explanada">
          <div class="esp-card-media"><img src="img/munet/explanada.webp" alt="Explanada del MUNET" width="1200" height="800" loading="lazy"></div>
          <div class="esp-card-body">
            <div class="esp-card-num">ESP_01</div>
            <h3 class="esp-card-name">Explanada</h3>
            <dl class="esp-card-data">
              <div><dt>SUPERFICIE</dt><dd>10,000 m²</dd></div>
              <div><dt>CAPACIDAD</dt><dd>CAPACIDAD_EXPLANADA personas</dd></div>
            </dl>
            <div class="esp-card-ideal-label">IDEAL PARA</div>
            <ul class="esp-card-ideal"><li>Conciertos y festivales</li><li>Ferias y exposiciones masivas</li><li>Activaciones de marca</li><li>Experiencias inmersivas</li></ul>
          </div>
        </article>

        <article class="esp-card rev" id="espacio-foro">
          <div class="esp-card-media"><img src="img/munet/foro.webp" alt="Foro del MUNET" width="1200" height="800" loading="lazy"></div>
          <div class="esp-card-body">
            <div class="esp-card-num">ESP_02</div>
            <h3 class="esp-card-name">Foro</h3>
            <dl class="esp-card-data">
              <div><dt>SUPERFICIE</dt><dd>1,400 m² + 400 m² de oficinas</dd></div>
              <div><dt>CAPACIDAD</dt><dd>CAPACIDAD_FORO personas</dd></div>
            </dl>
            <div class="esp-card-ideal-label">IDEAL PARA</div>
            <ul class="esp-card-ideal"><li>Eventos corporativos</li><li>Foros especializados</li><li>Montajes integrales</li><li>Producciones audiovisuales</li></ul>
          </div>
        </article>

        <article class="esp-card rev" id="espacio-lobby">
          <div class="esp-card-media"><img src="img/munet/lobby.webp" alt="Lobby del MUNET" width="1200" height="800" loading="lazy"></div>
          <div class="esp-card-body">
            <div class="esp-card-num">ESP_03</div>
            <h3 class="esp-card-name">Lobby</h3>
            <dl class="esp-card-data">
              <div><dt>SUPERFICIE</dt><dd>1,200 m²</dd></div>
              <div><dt>CAPACIDAD</dt><dd>CAPACIDAD_LOBBY personas</dd></div>
            </dl>
            <div class="esp-card-ideal-label">IDEAL PARA</div>
            <ul class="esp-card-ideal"><li>Recepciones y cócteles</li><li>Registros y check-in</li><li>Exhibiciones</li><li>Encuentros institucionales</li></ul>
          </div>
        </article>

        <article class="esp-card rev" id="espacio-auditorio">
          <div class="esp-card-media"><img src="img/munet/auditorio.webp" alt="Auditorio del MUNET" width="1200" height="800" loading="lazy"></div>
          <div class="esp-card-body">
            <div class="esp-card-num">ESP_04</div>
            <h3 class="esp-card-name">Auditorio</h3>
            <dl class="esp-card-data">
              <div><dt>SUPERFICIE</dt><dd>M2_AUDITORIO m²</dd></div>
              <div><dt>CAPACIDAD</dt><dd>246 personas</dd></div>
            </dl>
            <div class="esp-card-ideal-label">IDEAL PARA</div>
            <ul class="esp-card-ideal"><li>Conferencias</li><li>Presentaciones y lanzamientos</li><li>Charlas y paneles</li><li>Contenidos escénicos</li></ul>
          </div>
        </article>

        <article class="esp-card rev" id="espacio-jardin">
          <div class="esp-card-media"><img src="img/munet/jardin-social.webp" alt="Jardín Social del MUNET" width="1200" height="800" loading="lazy"></div>
          <div class="esp-card-body">
            <div class="esp-card-num">ESP_05</div>
            <h3 class="esp-card-name">Jardín Social</h3>
            <dl class="esp-card-data">
              <div><dt>SUPERFICIE</dt><dd>2,576 m² al aire libre</dd></div>
              <div><dt>CAPACIDAD</dt><dd>400 personas</dd></div>
            </dl>
            <div class="esp-card-ideal-label">IDEAL PARA</div>
            <ul class="esp-card-ideal"><li>Eventos sociales</li><li>Experiencias al aire libre</li><li>Encuentros de marca</li><li>Activaciones outdoor</li></ul>
          </div>
        </article>

        <article class="esp-card rev" id="espacio-exposiciones">
          <div class="esp-card-media"><img src="img/munet/sala-exposiciones.webp" alt="Sala de Exposiciones del MUNET" width="1200" height="800" loading="lazy"></div>
          <div class="esp-card-body">
            <div class="esp-card-num">ESP_06</div>
            <h3 class="esp-card-name">Sala Exposiciones</h3>
            <dl class="esp-card-data">
              <div><dt>SUPERFICIE</dt><dd>812 m²</dd></div>
              <div><dt>CAPACIDAD</dt><dd>200 personas</dd></div>
            </dl>
            <div class="esp-card-ideal-label">IDEAL PARA</div>
            <ul class="esp-card-ideal"><li>Exposiciones</li><li>Instalaciones artísticas</li><li>Showcases</li><li>Eventos curatoriales</li></ul>
          </div>
        </article>

        <article class="esp-card rev" id="espacio-velaria">
          <div class="esp-card-media"><img src="img/munet/velaria.webp" alt="Velaria del MUNET" width="1200" height="800" loading="lazy"></div>
          <div class="esp-card-body">
            <div class="esp-card-num">ESP_07</div>
            <h3 class="esp-card-name">Velaria</h3>
            <dl class="esp-card-data">
              <div><dt>SUPERFICIE</dt><dd>350 m² techado semi-abierto</dd></div>
              <div><dt>CAPACIDAD</dt><dd>300 personas</dd></div>
            </dl>
            <div class="esp-card-ideal-label">IDEAL PARA</div>
            <ul class="esp-card-ideal"><li>Activaciones</li><li>Presentaciones</li><li>Reuniones especiales</li><li>Eventos semi-abiertos</li></ul>
          </div>
        </article>

        <article class="esp-card rev" id="espacio-salas">
          <div class="esp-card-media"><img src="img/munet/salas-capacitacion.webp" alt="Salas de Capacitación del MUNET" width="1200" height="800" loading="lazy"></div>
          <div class="esp-card-body">
            <div class="esp-card-num">ESP_08</div>
            <h3 class="esp-card-name">Salas Capacitación</h3>
            <dl class="esp-card-data">
              <div><dt>SUPERFICIE</dt><dd>4 salas: 78 · 66 · 66 · 60 m²</dd></div>
              <div><dt>CAPACIDAD</dt><dd>CAPACIDAD_SALAS personas</dd></div>
            </dl>
            <div class="esp-card-ideal-label">IDEAL PARA</div>
            <ul class="esp-card-ideal"><li>Talleres y workshops</li><li>Reuniones ejecutivas</li><li>Capacitaciones</li><li>Actividades de trabajo</li></ul>
          </div>
        </article>

      </div>
    </div>

```

Antes de aplicar: `grep -n 'CAPACIDAD_\|M2_' /tmp/munet-espacios.html`. Debe dar **0 resultados**: cada marcador ya se reemplazó por el dato real o se borró su `<div>`.

Run: `python scripts/swap_block.py munet.html '      <div class="espacios-grid">' '    <!-- CTA -->' /tmp/munet-espacios.html`
Expected: `OK: munet.html actualizado`.

- [ ] **Step 4: CSS** al final de `css/pages/munet.css`, y subir su `?v=` en `munet.html`:

```css
/* ── Espacios MUNET (rediseño 2026-10) — información visible sin hover ── */
.esp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--gap-card)}
.esp-card{
  display:flex;flex-direction:column;overflow:hidden;
  background:var(--bg-panel);border:1px solid var(--border);
  transition:border-color var(--dur-fast);
}
.esp-card:hover{border-color:var(--border-munet)}
.esp-card-media{aspect-ratio:3/2;overflow:hidden;background:linear-gradient(135deg,var(--munet-dim),var(--bg-elevated))}
.esp-card-media img{width:100%;height:100%;object-fit:cover;display:block}
.esp-card-body{display:flex;flex-direction:column;gap:10px;flex:1;padding:18px 18px 22px}
.esp-card-num{font-family:'Space Mono',monospace;font-size:var(--fs-xs);color:var(--munet);letter-spacing:2px}
.esp-card-name{
  font-family:'Barlow Condensed',sans-serif;font-size:var(--fs-lg);font-weight:700;
  text-transform:uppercase;line-height:1.1;margin:0;
}
.esp-card-data{display:flex;flex-wrap:wrap;gap:6px 20px;margin:0}
.esp-card-data dt{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;color:var(--text-dim)}
.esp-card-data dd{margin:0;color:var(--text);font-weight:600}
.esp-card-ideal-label{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;color:var(--text-dim);margin-top:4px}
.esp-card-ideal{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.esp-card-ideal li{font-size:var(--fs-xs);color:var(--text-mid);padding:3px 8px;border:1px solid var(--border)}
@media(max-width:1024px){.esp-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.esp-grid{grid-template-columns:1fr}}
```

Las reglas viejas `.espacios-grid`, `.esp-compact` y `.munet-svc-exp-panel` **no se borran** en esta etapa (el panel de la alianza las usa). La limpieza de CSS muerto se hace después, si se quiere.

- [ ] **Step 5: Encabezado**

En `munet.html`, `page-header-meta`: `ESPACIOS: 8 ACTIVOS` se queda igual. No hay otros cambios de texto.

- [ ] **Step 6: Correr la verificación**

Run: `python scripts/check_site.py` → todas OK.

- [ ] **Step 7: Revisión en navegador**

`http://localhost:5500/munet.html`, hacer scroll hasta el final y luego:

```js
const c = [...document.querySelectorAll('.esp-card')];
[c.length === 8,
 c.every(x => x.querySelector('img').complete && x.querySelector('img').naturalWidth > 0),
 c.every(x => x.querySelector('.esp-card-ideal').offsetHeight > 0),
 document.querySelectorAll('.espacios-grid, .esp-compact').length === 0,
 document.documentElement.scrollWidth <= innerWidth]
```

Expected: todos `true` a 1440, 1025 y 375 px. El panel de la alianza (MNT_01) se sigue abriendo como antes, y los dos botones "COTIZA TU EVENTO" llevan al cotizador.

- [ ] **Step 8: Commit y publicar**

```bash
git add munet.html css/pages/munet.css img/munet scripts/check_site.py
git commit -m "feat(munet): tarjetas de espacio con foto, m², capacidad e ideal para"
```

Producción: `curl -s https://bunkermx.com/munet | grep -c 'class="esp-card '` → `8`, y `curl -sI https://bunkermx.com/img/munet/foro.webp | head -1` → `200`.

---

### Task 7: Proyectos (parte 1) — diseño aprobado y archivo completo en `/archivo`

Rama: `web/etapa-7-archivo`. Esta tarea **no cambia** lo que se ve en `/proyectos`; solo crea `/archivo` con el archivo actual intacto, para que la Task 8 pueda enlazarlo.

**Files:**
- Create: `archivo.html` (copia de `proyectos.html` con título, metadatos y regreso ajustados)
- Modify: `sitemap.xml`, `scripts/check_site.py`

**Interfaces:**
- Consumes: `NAV_EXPECTED` (Task 1)
- Produces: página `archivo.html` en `/archivo`, que la Task 8 enlaza con "Ver todos los proyectos"

- [ ] **Step 1: Aprobar el diseño (gate, sin código en `main`)**

Antes de tocar `proyectos.html`, Carlos Rodríguez y el cliente aprueban el diseño revista de la Task 8. Mostrar la Task 8 Step 3 (marcado) y Step 4 (CSS) aplicados **en una rama aparte** (`web/etapa-8-proyectos-borrador`) con 6 fotos de prueba, abierta en `http://localhost:5500/proyectos.html` a 1440 y 375 px. Registrar en el PR o en esta tarea:
- la lista final de 6–10 proyectos, con nombre y categoría (decisión D6/D7);
- qué proyecto va como tarjeta grande (`mag-card--lead`);
- si el diseño se aprueba tal cual o con ajustes. Los ajustes se escriben en la Task 8 antes de ejecutarla.

**No seguir con la Task 8 sin esta aprobación.** La Task 7 (archivo) sí puede avanzar.

- [ ] **Step 2: Agregar la comprobación**

En `scripts/check_site.py`:
- `PAGES`: agregar `'archivo.html'` al final.
- Arriba de `STAGE_CHECKS`:

```python
def check_archivo(pages):
    p = pages['archivo.html']
    errs = []
    if len(p.by_class('proj-card')) < 44:
        errs.append('archivo con %d proyectos (esperado ≥44)' % len(p.by_class('proj-card')))
    if len(p.by_class('f-btn')) != 7 or not p.by_id('projGrid'):
        errs.append('faltan filtros o #projGrid (proyectos.js los necesita)')
    if not any('proyectos.js' in (e['attrs'].get('src') or '') for e in p.elements):
        errs.append('archivo.html no carga js/pages/proyectos.js')
    canon = [e['attrs'].get('href') for e in p.elements if e['tag'] == 'link' and e['attrs'].get('rel') == 'canonical']
    if canon != ['https://bunkermx.com/archivo']:
        errs.append('canonical = %r' % canon)
    if 'https://bunkermx.com/archivo' not in read_text('sitemap.xml'):
        errs.append('sitemap.xml sin /archivo')
    return errs
```

Agregarla a `STAGE_CHECKS`. Run: `python scripts/check_site.py` → `[FAIL] faltan páginas: archivo.html`.

- [ ] **Step 3: Crear `archivo.html`**

```bash
cp proyectos.html archivo.html
sed -i \
  -e 's#<title>[^<]*</title>#<title>TODOS LOS PROYECTOS | BUNKER SYSTEM V2.0</title>#' \
  -e 's#https://bunkermx.com/proyectos"#https://bunkermx.com/archivo"#g' \
  -e 's#content="Archivo de Proyectos | BUNKER"#content="Todos los proyectos | BUNKER"#g' \
  -e 's#<h1 class="page-header-title">[^<]*<span#<h1 class="page-header-title">TODOS LOS <span#' \
  archivo.html
grep -n '<title>\|canonical\|og:url\|page-header-title\|page-header-back\|"position"' archivo.html
```

Revisar a mano lo que muestra el `grep`:
- La `<h1>` debe quedar `TODOS LOS <span ...>PROYECTOS</span>`.
- El enlace `page-header-back` debe ir a `/proyectos` con el texto `LO HEMOS HECHO ANTES`: `<a href="/proyectos" class="page-header-back">LO HEMOS HECHO ANTES</a>`.
- En el JSON-LD `BreadcrumbList`, agregar un tercer nivel: `{ "@type": "ListItem", "position": 3, "name": "Todos los proyectos" }`. El nivel 2 ("Proyectos") debe llevar `"item": "https://bunkermx.com/proyectos"`.
- El menú sigue marcando PROYECTOS como activo; eso está bien.

Agregar a `sitemap.xml`, después del bloque de `/proyectos` y con el mismo formato que las otras entradas:

```xml
  <url>
    <loc>https://bunkermx.com/archivo</loc>
  </url>
```

Si las otras entradas tienen `<lastmod>`, `<changefreq>` o `<priority>`, copiarlos igual que en `/proyectos`.

- [ ] **Step 4: Correr la verificación**

Run: `python scripts/check_site.py` → todas OK. `check_nav_labels` también valida el menú de `archivo.html`.

- [ ] **Step 5: Revisión en navegador**

`http://localhost:5500/archivo.html`:

```js
const h = document.querySelectorAll('.yr-head');
h[0].click();
const f = [...document.querySelectorAll('.f-btn')].find(b => b.dataset.f === 'tv');
f.click();
await new Promise(r => setTimeout(r, 400));
[h.length > 10, document.getElementById('projCount').textContent === '11',
 document.documentElement.scrollWidth <= innerWidth]
```

Expected: `[true, true, true]`. Es el mismo comportamiento que `/proyectos` hoy.

- [ ] **Step 6: Commit y publicar**

```bash
git add archivo.html sitemap.xml scripts/check_site.py
git commit -m "feat(proyectos): archivo completo en /archivo"
```

Producción: `curl -s -o /dev/null -w '%{http_code}' https://bunkermx.com/archivo` → `200`.

---

### Task 8: Proyectos (parte 2) — "LO HEMOS HECHO ANTES" en formato revista

Rama: `web/etapa-8-proyectos`. **Requiere:** la Task 7 publicada, el diseño aprobado (Task 7 Step 1), la lista final de proyectos y sus fotos.

**Files:**
- Create: `css/pages/proyectos-revista.css`
- Create: `img/proyectos/<slug>.webp` (una por proyecto destacado, 1600×1000 px, ≤ 300 KB)
- Modify: `proyectos.html` (se reemplaza el cuerpo; el archivo viejo vive en `archivo.html`)
- Modify: `index.html` (módulo PROYECTOS)
- Modify: `scripts/check_site.py`

**Interfaces:**
- Consumes: `/archivo` (Task 7), `check_image_weights` (Task 6)

- [ ] **Step 1: Agregar la comprobación**

```python
PROY_SUB = ('Más de tres décadas produciendo experiencias para algunos de los escenarios, '
            'artistas, marcas y proyectos más relevantes de México y el mundo.')


def check_proyectos_revista(pages):
    p = pages['proyectos.html']
    errs = []
    h1 = [p.text_of(e) for e in p.elements if e['tag'] == 'h1']
    if h1 != ['LO HEMOS HECHO ANTES']:
        errs.append('h1 = %r' % h1)
    if [p.text_of(e) for e in p.by_class('page-header-sub')] != [PROY_SUB]:
        errs.append('subtítulo distinto al de la minuta')
    cards = p.by_class('mag-card')
    if not 5 <= len(cards) <= 10:
        errs.append('%d proyectos destacados (deben ser 5–10)' % len(cards))
    for c in cards:
        imgs = p.inside(c, tag='img')
        name = [p.text_of(e) for e in p.inside(c, cls='mag-card-name')]
        cat = [p.text_of(e) for e in p.inside(c, cls='mag-card-cat')]
        if len(imgs) != 1 or not imgs[0]['attrs'].get('alt') or not name or not name[0] or not cat or not cat[0]:
            errs.append('tarjeta incompleta: %r' % (name or '?'))
    if len(p.by_class('mag-card--lead')) != 1:
        errs.append('debe haber exactamente 1 tarjeta grande (.mag-card--lead)')
    if not any(e['tag'] == 'a' and e['attrs'].get('href') == '/archivo' for e in p.elements):
        errs.append('falta "Ver todos los proyectos" → /archivo')
    if p.by_class('yr-head') or any('proyectos.js' in (e['attrs'].get('src') or '') for e in p.elements):
        errs.append('proyectos.html todavía tiene el archivo viejo o carga proyectos.js')
    return errs
```

Agregarla a `STAGE_CHECKS`. Run → FAIL en `check_proyectos_revista`.

- [ ] **Step 2: Fotos**

Para cada proyecto aprobado: foto horizontal recortada a **16:10**, **1600×1000 px**, `.webp` calidad ~80, ≤ 300 KB, en `img/proyectos/<slug>.webp`. El slug va en minúsculas, sin acentos y con guiones, por ejemplo `catarsis.webp` o `la-academia-2024.webp`.

```bash
mkdir -p img/proyectos
cwebp -q 80 -resize 1600 1000 ORIGINAL.jpg -o img/proyectos/catarsis.webp
```

- [ ] **Step 3: Reemplazar el cuerpo de `proyectos.html`**

a) Encabezado:
- `<title>` → `LO HEMOS HECHO ANTES | BUNKER SYSTEM V2.0`
- `og:title` y `twitter:title` → `"Lo hemos hecho antes | BUNKER"`
- `description` y `og:description` → `"Más de tres décadas produciendo experiencias para algunos de los escenarios, artistas, marcas y proyectos más relevantes de México y el mundo."`
- Reemplazar `<h1 class="page-header-title">ARCHIVO DE <span style="color:var(--gold)">PROYECTOS</span></h1>` por:

```html
        <h1 class="page-header-title">LO HEMOS <span style="color:var(--gold)">HECHO ANTES</span></h1>
        <p class="page-header-sub">Más de tres décadas produciendo experiencias para algunos de los escenarios, artistas, marcas y proyectos más relevantes de México y el mundo.</p>
```

- `page-header-meta` → `TRAYECTORIA: 1991 — 2025<br>ARCHIVO: 44 REGISTROS<br>DESTACADOS: N`, donde N es el número de tarjetas.

b) Cuerpo. Crear `/tmp/proyectos-revista.html` con **una tarjeta por proyecto aprobado**. La primera lleva `mag-card--lead`. Ejemplo con 6 proyectos; sustituir nombre, categoría, imagen y `alt` por los aprobados en la Task 7 Step 1:

```html
<!-- PROYECTOS DESTACADOS (revista) -->
<section class="sys-section mag-section">
  <div class="sys-inner">
    <div class="mag-grid">

      <article class="mag-card mag-card--lead rev">
        <div class="mag-card-media"><img src="img/proyectos/catarsis.webp" alt="Catarsis, espectáculo producido por BUNKER" width="1600" height="1000" loading="lazy"></div>
        <div class="mag-card-info"><span class="mag-card-cat">Espectáculo</span><h2 class="mag-card-name">Catarsis</h2></div>
      </article>

      <article class="mag-card rev">
        <div class="mag-card-media"><img src="img/proyectos/temerarios-hasta-siempre.webp" alt="Temerarios, gira Hasta Siempre" width="1600" height="1000" loading="lazy"></div>
        <div class="mag-card-info"><span class="mag-card-cat">Concierto / Gira</span><h2 class="mag-card-name">Temerarios — Gira Hasta Siempre</h2></div>
      </article>

      <article class="mag-card rev">
        <div class="mag-card-media"><img src="img/proyectos/la-academia-2024.webp" alt="La Academia 2024, TV Azteca" width="1600" height="1000" loading="lazy"></div>
        <div class="mag-card-info"><span class="mag-card-cat">TV / Streaming</span><h2 class="mag-card-name">La Academia 2024</h2></div>
      </article>

      <article class="mag-card rev">
        <div class="mag-card-media"><img src="img/proyectos/frida-kahlo-experiencia.webp" alt="Museo Frida Kahlo, experiencia sensorial" width="1600" height="1000" loading="lazy"></div>
        <div class="mag-card-info"><span class="mag-card-cat">Experiencia</span><h2 class="mag-card-name">Museo Frida Kahlo — Experiencia Sensorial</h2></div>
      </article>

      <article class="mag-card rev">
        <div class="mag-card-media"><img src="img/proyectos/CORPORATIVO-SLUG.webp" alt="DESCRIPCIÓN DEL EVENTO CORPORATIVO" width="1600" height="1000" loading="lazy"></div>
        <div class="mag-card-info"><span class="mag-card-cat">Corporativo</span><h2 class="mag-card-name">NOMBRE DEL EVENTO CORPORATIVO</h2></div>
      </article>

      <article class="mag-card rev">
        <div class="mag-card-media"><img src="img/proyectos/SOCIAL-SLUG.webp" alt="DESCRIPCIÓN DEL EVENTO SOCIAL" width="1600" height="1000" loading="lazy"></div>
        <div class="mag-card-info"><span class="mag-card-cat">Social</span><h2 class="mag-card-name">NOMBRE DEL EVENTO SOCIAL</h2></div>
      </article>

    </div>

    <div class="mag-all rev">
      <a href="/archivo" class="hud-btn hud-btn--primary">
        <span>VER TODOS LOS PROYECTOS</span><span class="hud-btn-arrow">&rarr;</span>
      </a>
    </div>
  </div>
</section>

```

Los textos en MAYÚSCULAS con `SLUG` o `NOMBRE`/`DESCRIPCIÓN` son los que se llenan con la lista aprobada. Antes de aplicar, `grep -n 'SLUG\|NOMBRE DEL\|DESCRIPCIÓN DEL' /tmp/proyectos-revista.html` debe dar **0 resultados**. Si quedara alguno, `check_internal_refs` fallaría por la imagen inexistente.

Run: `python scripts/swap_block.py proyectos.html '<!-- PROYECTOS -->' '<!-- FOOTER -->' /tmp/proyectos-revista.html`
Expected: `OK: proyectos.html actualizado`. Si `<!-- PROYECTOS -->` o `<!-- FOOTER -->` no son únicos, el script aborta: revisar con `grep -n '<!-- PROYECTOS -->\|<!-- FOOTER -->' proyectos.html` y usar marcadores únicos.

c) Quitar el script del archivo viejo y cambiar el CSS:

```bash
sed -i '/js\/pages\/proyectos.js/d' proyectos.html
sed -i 's#css/pages/proyectos.css?v=[0-9]*#css/pages/proyectos-revista.css?v=1#' proyectos.html
grep -n 'proyectos' proyectos.html | grep -i 'css\|js'
```

Expected: solo aparece `proyectos-revista.css?v=1`. `proyectos.css` y `proyectos.js` siguen en uso por `archivo.html`.

- [ ] **Step 4: Crear `css/pages/proyectos-revista.css`**

```css
/* ============================================================
   PROYECTOS — "Lo hemos hecho antes" (formato revista)
   El archivo completo usa proyectos.css en /archivo.
   ============================================================ */
.page-header-sub{
  font-size:var(--fs-md);color:var(--text-mid);
  line-height:1.6;max-width:720px;margin:16px 0 0;
}
.mag-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--gap-card)}
.mag-card{
  position:relative;overflow:hidden;margin:0;
  background:var(--bg-elevated);border:1px solid var(--border);
  transition:border-color var(--dur-fast);
}
.mag-card:hover{border-color:var(--border-gold)}
.mag-card--lead{grid-column:span 2;grid-row:span 2}
.mag-card-media{aspect-ratio:16/10;overflow:hidden}
.mag-card--lead .mag-card-media{aspect-ratio:auto;height:100%}
.mag-card-media img{
  width:100%;height:100%;object-fit:cover;display:block;
  transition:transform .6s var(--ease-out);
}
.mag-card:hover .mag-card-media img{transform:scale(1.04)}
/* Nombre y categoría siempre visibles sobre la imagen */
.mag-card-info{
  position:absolute;left:0;right:0;bottom:0;
  padding:48px 20px 18px;
  background:linear-gradient(transparent,rgba(13,13,13,.92));
}
.mag-card-cat{
  font-family:'Space Mono',monospace;font-size:var(--fs-xs);
  letter-spacing:2px;text-transform:uppercase;color:var(--gold);
}
.mag-card-name{
  font-family:'Barlow Condensed',sans-serif;font-size:var(--fs-lg);font-weight:700;
  text-transform:uppercase;line-height:1.1;margin:4px 0 0;color:var(--text);
}
.mag-card--lead .mag-card-name{font-size:var(--fs-xl)}
.mag-all{display:flex;justify-content:center;margin-top:clamp(32px,4vw,56px)}
@media(max-width:1024px){.mag-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){
  .mag-grid{grid-template-columns:1fr}
  .mag-card--lead{grid-column:auto;grid-row:auto}
  .mag-card--lead .mag-card-media{aspect-ratio:16/10;height:auto}
}
```

- [ ] **Step 5: Módulo en el index**

En el módulo `<span class="mod-label">PROYECTOS</span>` de `index.html`:
- `<div class="mod-title">Archivo de<br>Proyectos</div>` → `<div class="mod-title">Lo hemos<br>hecho antes</div>`
- `mod-meta` → `PROYECTOS DESTACADOS // ARCHIVO 1991—2025`

- [ ] **Step 6: Correr la verificación**

Run: `python scripts/check_site.py` → todas OK, incluida `check_image_weights`.

- [ ] **Step 7: Revisión en navegador**

`http://localhost:5500/proyectos.html`, hacer scroll hasta el final y luego:

```js
const c = [...document.querySelectorAll('.mag-card')];
[c.length >= 5 && c.length <= 10,
 c.every(x => x.querySelector('img').naturalWidth > 0),
 c.every(x => getComputedStyle(x.querySelector('.mag-card-info')).opacity !== '0' && x.querySelector('.mag-card-name').offsetHeight > 0),
 !!document.querySelector('a[href="/archivo"]'),
 document.documentElement.scrollWidth <= innerWidth]
```

Expected: todos `true` a 1440, 1025 y 375 px. A 1440 px, la tarjeta grande ocupa 2×2 y no quedan huecos raros en el grid. Si quedan, ajustar el orden de las tarjetas, no el CSS. Hacer clic en "VER TODOS LOS PROYECTOS": en local va a `/archivo`, que el servidor de Python no resuelve; probar con `archivo.html` directo. En producción debe resolver.

- [ ] **Step 7b: Hacer indexable /archivo**

Quitar el `<meta name="robots" content="noindex, follow">` de `archivo.html`, volver a agregar la entrada `<url>` de `/archivo` en `sitemap.xml` (misma forma que `/proyectos`) y, en `check_archivo` de `scripts/check_site.py`, invertir las dos aserciones (noindex debe estar ausente; el sitemap debe listar `/archivo`). Agregar `archivo.html` y `sitemap.xml` al `git add` del Step 8.

- [ ] **Step 8: Commit y publicar**

```bash
git add proyectos.html index.html css/pages/proyectos-revista.css img/proyectos scripts/check_site.py
git commit -m "feat(proyectos): Lo hemos hecho antes, formato revista con enlace al archivo"
```

Producción: `curl -s https://bunkermx.com/proyectos | grep -c 'class="mag-card'` → entre 5 y 10. Abrir `https://bunkermx.com/proyectos` y hacer clic en "VER TODOS LOS PROYECTOS": debe cargar `/archivo` con los filtros funcionando.

- [ ] **Step 9: Cierre de documentación**

Actualizar `CLAUDE.md`, sección "Sitio público":
- Lista de páginas: `proyectos.html` = revista "Lo hemos hecho antes"; nuevo `archivo.html` = archivo completo con filtros (`proyectos.css` + `proyectos.js`).
- Menú: ADN BUNKER (`/esencia`), NOSOTROS (`/talento`), INICIAR PROYECTO (`/#contacto`). Las URLs no cambiaron.
- `css/pages/proyectos-revista.css`; tarjetas `.svc-cat` (servicios), `.esp-card` (MUNET) y `.mag-card` (proyectos) se ven sin hover.

Commit `docs: CLAUDE.md con el sitio rediseñado` y push.
