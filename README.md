# BUNKER MX

Sitio web institucional de **BUNKER Creatividad Empresarial**, enfocado en produccion de espectaculos, entretenimiento en gran formato, proyectos culturales, MUNET y servicios empresariales.

El proyecto esta construido como un sitio estatico con HTML, CSS y JavaScript puro. No usa framework, bundler, Node.js ni paso de compilacion.

## Contenido

- `index.html`: pagina principal del sistema BUNKER.
- `esencia.html`: filosofia, proposito, vision y metodo de trabajo.
- `servicios.html`: servicios de produccion, giras, venues, audiovisual y streaming.
- `talento.html`: directorio del equipo BUNKER.
- `proyectos.html`: archivo de trayectoria y proyectos.
- `munet.html`: subsistema MUNET.
- `hub.html`: Hub Empresarial BUNKER.
- `cotizador-munet/`: simulador de costos para renta de espacios MUNET.
- `css/`: estilos globales, sistema visual y estilos por pagina.
- `js/`: interacciones, navegacion, animaciones y logica por pagina.
- `img/`: logos e imagenes del sitio.

## Como verlo localmente

Puedes abrir `index.html` directamente en el navegador.

Para probarlo con rutas limpias de forma local, tambien puedes levantar un servidor estatico:

```bash
python -m http.server 5500
```

Luego abre:

```text
http://localhost:5500
```

## Despliegue

El sitio esta preparado para Firebase Hosting. La configuracion vive en `firebase.json` y publica la raiz del repositorio.

Rutas configuradas:

- `/esencia`
- `/servicios`
- `/talento`
- `/proyectos`
- `/munet`
- `/hub`
- `/cotizador-munet`

Para desplegar:

```bash
firebase deploy
```

## Notas de desarrollo

- Mantener el texto visible para usuarios en espanol.
- Editar directamente los archivos fuente; no hay build.
- Usar los estilos existentes en `css/system.css` y `css/pages/`.
- Evitar subir archivos temporales, capturas, logs o material de trabajo local.
- `bunker_v2.html` se conserva como version previa o referencia.

## Repositorio

Este `README.md` esta en la raiz del proyecto para que GitHub lo muestre automaticamente en la pagina principal del repositorio.
