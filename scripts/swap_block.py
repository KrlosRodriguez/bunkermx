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
