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
- `cotizador-munet/`: sistema de cotizaciones con dos modulos:
  - **Cotizador MNT** (`index.html`): wizard para renta de espacios MUNET con calendario, tarifas automaticas y PDF neon.
  - **Panel de Ventas** (`dashboard.html`): dashboard combinado MNT+BNK con indicadores, filtros, modal para cotizaciones de servicios/produccion integral, PDF estilo dorado, catalogo de precios y autocompletado de clientes.
- `css/`: estilos globales, sistema visual y estilos por pagina.
- `js/`: interacciones, navegacion, animaciones y logica por pagina.
- `img/`: logos e imagenes del sitio.

## Sistema de Cotizaciones

El sistema maneja dos tipos de cotizaciones:

| Tipo | Folio | Descripcion |
|------|-------|-------------|
| **MNT** | `MNT-AAMMDD-XXXX` | Renta de espacios/venues del MUNET (wizard publico) |
| **BNK** | `BNK-AAMMDD-XXXX` | Servicios y produccion integral (modal en dashboard) |

**Backend**: Google Apps Script con Google Sheets como base de datos y Google Drive para PDFs.
**Hojas**: Cotizaciones (MNT), CotizacionesBNK, Clientes, CatalogoPrecio (37 conceptos precargados).

Las cotizaciones BNK pueden vincularse a un folio MNT existente (boton "+" en la tabla del dashboard).

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
- `/cotizador-munet/dashboard.html` (Panel de Ventas)

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
