# Rediseño del sitio público según minuta — Especificación

**Fecha**: 2026-10-07
**Fuente**: minuta de trabajo `requerimient_nuevos.txt` (cliente BUNKER)
**Alcance**: solo el sitio público (raíz del repo). No toca `/panel/` ni `/cotizador-munet/`.

---

## 1. Requerimientos de la minuta (transcritos)

### 1.1 Header (todas las páginas)
Orden y nombres del menú:
1. INICIO
2. ESENCIA → **ADN BUNKER**
3. SERVICIOS
4. EQUIPO → **NOSOTROS**
5. PROYECTOS
6. MUNET
7. CONTACTO → **INICIAR PROYECTO**

### 1.2 Inicio
- Cambiar `Entertainment · Gran Formato · Internacional` por `Entretenimiento · Experiencias · Espectáculos · Venues`.
- Después del logo, quitar el texto actual y poner: *"Estrategia, creatividad y producción para eventos, espectáculos y experiencias de alto impacto."*

### 1.3 ADN BUNKER (antes Esencia)
- Los cuadros de la derecha (atributos) se quedan, pero su texto debe verse **sin pasar el puntero**.
- La información de la izquierda se reemplaza por:
  - **Ecosistema** — *Conectamos marca, espacio y monetización en un solo frente.* Unimos propiedades intelectuales con arraigo cultural, recintos físicos estratégicos con alta capacidad de convocatoria y un modelo de operación multicanal. Esto nos permite diversificar las fuentes de ingreso y capturar valor en cada punto de contacto: taquilla, consumo in situ, patrocinios y datos de audiencia.
  - **Mecanismo** — *Convertimos la cultura en un sistema operativo.* Articulamos la atención masiva mediante procesos estructurados de captura y gestión de tráfico. En lugar de depender de eventos aislados, transformamos la efervescencia cultural en un flujo constante, predecible y optimizado de personas, interacciones y transacciones.
  - **Resultado** — *Transformamos la experiencia en un activo patrimonial.* Evolucionamos el entretenimiento efímero hacia una plataforma de negocio escalable. Al integrar infraestructura, datos y recurrencia, convertimos la experiencia del usuario en un activo financiero con permanencia en el tiempo y alto potencial de expansión.
- **Sistema BNK** se quita de aquí y pasa a NOSOTROS.
- **Método BNK** se queda.

### 1.4 Servicios
Agrupar los módulos técnicos en 4 categorías, con la información visible sin pasar el puntero:
- **01 — EVENTOS & EXPERIENCIAS**: Eventos corporativos · Activaciones · Lanzamientos · Conferencias · Experiencias de marca · Eventos institucionales
- **02 — ESPECTÁCULOS & GRAN FORMATO**: Conciertos · Shows · Giras · Producción técnica · Stage management · Site coordination
- **03 — PRODUCCIÓN & CONTENIDO**: Audiovisual · Streaming · Branded content · Producción musical · Cine / TV
- **04 — VENUES & OPERACIÓN**: Dirección de recintos · Producción in-house · Operación técnica · MUNET (enlace a la sección MUNET) · Gestión de espacios

### 1.5 NOSOTROS (antes Equipo)
- "Directorio de personal" → **EXPERIENCIA**.
- Lado derecho del encabezado: **+100 EXPERIENCIAS · +30 AÑOS · +30 VENUES**.
- Agregar aquí el **Sistema BNK** (Historia, Filosofía, etc.).

### 1.6 Proyectos
- "Archivo de proyectos" → **LO HEMOS HECHO ANTES**.
- Subtítulo: *"Más de tres décadas produciendo experiencias para algunos de los escenarios, artistas, marcas y proyectos más relevantes de México y el mundo."* (se quitó la coma después de "décadas").
- Mostrar de 5 a 10 proyectos destacados (un concierto, un corporativo, un social, etc.) en formato **revista** o más visual: **imagen grande · nombre · categoría**.
- Al final, un enlace **"Ver todos los proyectos"**.
- Nota de Carlos Rodríguez: dedicar tiempo a diseñar bien este cambio y no romper nada.

### 1.7 MUNET
Por espacio: **nombre · imagen · m² · capacidad · espacio ideal para…**, visible sin pasar el puntero.

---

## 2. Decisiones por defecto (confirmar con el cliente)

| # | Decisión | Default del plan | Por qué |
|---|---|---|---|
| D1 | ¿Cambian las URLs? | **No.** `/esencia` y `/talento` se quedan; solo cambian etiquetas y títulos. | No rompe enlaces compartidos, Google ni el sitemap. Se puede migrar a `/adn` y `/nosotros` con 301 después. |
| D2 | Ortografía de "ADN BÚNKER" | **"ADN BUNKER"**, sin acento. | La marca aparece sin acento en todo el sitio, el logo y los metadatos. |
| D3 | "Información de la izquierda" en ADN | Se reemplaza **solo la terminal** `MANIFIESTO.DAT`. Se conservan "Tres capas" y la fórmula. | La minuta no menciona esos bloques; quitarlos sería perder contenido sin instrucción. |
| D4 | Contenido del Sistema BNK en NOSOTROS | Se mueven las 4 declaraciones (Filosofía, Propósito, Visión, Misión), visibles sin hover. La **Historia** se agrega cuando el cliente entregue el texto. | No existe texto de "Historia" en el sitio. |
| D5 | Textos detallados de los 6 servicios actuales | Se reemplazan por las 4 categorías. El texto viejo queda en el historial de git. | Es lo que pide la minuta. |
| D6 | Proyectos destacados | Un solo grid revista de **6 a 10 proyectos**, al menos uno por rubro, cada uno con imagen, nombre y categoría. El archivo completo pasa a `/archivo`. | La minuta habla de "5 a 10" y "uno de cada rubro". |
| D7 | Rubros de proyectos | Concierto/Gira · Corporativo · Social · TV/Streaming · Experiencia/Exposición · Venue | Combina lo que pide la minuta con las categorías actuales. |

## 3. Contenido que debe entregar el cliente

| Etapa | Material | Formato |
|---|---|---|
| 3 (opcional) | Texto de **Historia** del Sistema BNK | 1–3 párrafos |
| 6 | **8 fotos** de espacios MUNET | JPG/PNG horizontales ≥1600 px de ancho |
| 6 | Capacidad de Explanada, Foro, Lobby y Salas; m² del Auditorio | Números |
| 7 | **Selección de 6–10 proyectos** destacados con su rubro | Lista |
| 7 | **1 foto por proyecto** destacado | JPG/PNG horizontales ≥1600 px |

## 4. Fuera de alcance (detectado al revisar)

- **El formulario de contacto es simulado** y no envía nada. Al renombrar el menú a "INICIAR PROYECTO", este botón va a llevar a ese formulario. Se recomienda conectarlo en un plan aparte, por ejemplo a Apps Script, como ya hace el cotizador.
- Las transiciones de página de `system.js` solo interceptan enlaces `*.html`, y el sitio usa URLs limpias.
