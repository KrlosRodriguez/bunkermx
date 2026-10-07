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
