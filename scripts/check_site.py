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


STAGE_CHECKS = [check_nav_labels, check_home_copy, check_nosotros, check_adn, check_servicios]


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
