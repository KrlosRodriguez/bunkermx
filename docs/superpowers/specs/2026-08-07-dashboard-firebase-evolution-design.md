# Dashboard BUNKER — Evolución a plataforma operativa con Firebase

**Fecha:** 2026-08-07
**Enfoque:** Migración progresiva (Enfoque C)
**Estado:** Aprobado

## Contexto y problema

BUNKER Creatividad Empresarial opera la producción de eventos grandes (México, USA, Centroamérica). El dashboard actual (`cotizador-munet/dashboard.html`) funciona como CRUD de cotizaciones, clientes y proveedores sobre Google Sheets + Apps Script.

**Problemas operativos que resuelve este diseño:**

- Las cotizaciones se crean y se pierde el seguimiento — no hay pipeline
- No se sabe en qué estado está cada evento ni quién es responsable
- El equipo no tiene dónde ver qué les toca hacer
- No hay visibilidad de números reales (cotizado vs cerrado vs cobrado)
- Post-cierre, la coordinación se hace por WhatsApp sin proceso
- No hay roles de usuario — todos ven y editan todo
- No hay calendario de disponibilidad de venues

**Usuarios:** Todo el equipo de BUNKER (dirección, ventas/coordinadora, producción, invitados).

## Flujo operativo real

1. Coordinadora da recorrido por venues MUNET al cliente
2. Cliente da requerimientos
3. Se genera y envía cotización MNT (renta de espacios)
4. Se genera y envía cotización BNK (servicios/producción)
5. Seguimiento mixto (WhatsApp, llamadas, email) — aquí se pierde el hilo
6. Si cierra, se coordina producción por WhatsApp — sin proceso formal

---

## Sección 1: Arquitectura general

### Separación sitio público vs panel interno

El mismo repo, mismo proyecto Firebase `bunkermx-51834`. El dashboard se mueve a una carpeta `/panel/` independiente del sitio corporativo:

```
bunkermx.com (sitio público)          /panel/ (dashboard interno)
├── index.html                        ├── index.html (login)
├── esencia.html                      ├── dashboard.html (app principal)
├── servicios.html                    ├── js/
├── munet.html                        │   ├── firebase-config.js
├── cotizador-munet/                  │   ├── auth.js
│   ├── index.html (wizard público)   │   ├── firestore.js
│   └── js/cotizador-munet.js         │   ├── pages/dashboard.js
│                                     │   ├── pages/clientes.js
│                                     │   ├── pages/proveedores.js
│                                     │   └── pages/pipeline.js
│                                     └── css/
```

Un solo `firebase deploy`. Un solo repo. Un solo `git push`.

### Stack técnico

| Capa | Hoy | Propuesta |
|------|-----|-----------|
| Base de datos | Google Sheets | Firestore (Sheets se mantiene via doble escritura) |
| Auth | login-gate.js (contraseña fija) | Firebase Auth (email/password con roles en Firestore) |
| Backend | Google Apps Script | Apps Script (doble escritura) + Cloud Functions para lo nuevo |
| Frontend | HTML/CSS/JS vanilla inline | HTML/CSS/JS vanilla modular (archivos separados) |
| Hosting | Firebase Hosting | Firebase Hosting (mismo proyecto) |
| Deploy | `firebase deploy` + cPanel clone | Igual |

Sin frameworks. Se mantiene vanilla JS. Solo mejor organización.

### Flujo de datos (Fase 1)

```
Cliente llena wizard ──→ Apps Script ──→ Google Sheets
                                    └──→ Firestore (doble escritura)
                                              ↕
                              Dashboard ←── Firestore (real-time)
                              (Auth + Roles)
```

---

## Sección 2: Auth y roles de usuario

### Modelo de roles

| Rol | Quién | Permisos |
|-----|-------|----------|
| **admin** | Dirección | Todo. Reportes completos, gestión de usuarios |
| **ventas** | Coordinadora | CRUD cotizaciones, clientes, proveedores, catálogo de precios, pipeline |
| **produccion** | Equipo técnico | Ver eventos cerrados asignados, checklist, marcar avances |
| **lectura** | Invitados | Solo ver, no editar |

Admin y ventas tienen los mismos permisos operativos. La diferencia: admin gestiona usuarios y ve reportes completos.

### Estructura en Firestore

```
/usuarios/{uid}
  ├── nombre: "Ana López"
  ├── email: "ana@bunkermx.com"
  ├── rol: "ventas"
  └── activo: true
```

### Pantalla de login

Reemplaza `login-gate.js`. Pantalla con branding BUNKER: email + password + botón entrar. No hay registro público — solo admin crea usuarios.

### Matriz de acceso

| Sección | admin | ventas | produccion | lectura |
|---------|-------|--------|------------|---------|
| Cotizaciones — ver/crear/editar | Si | Si | Solo cerradas asignadas | Solo ver |
| Clientes — CRUD | Si | Si | No | Solo ver |
| Proveedores — CRUD | Si | Si | Solo ver | Solo ver |
| Catálogo precios — editar | Si | Si | No | No |
| Pipeline/seguimiento | Si | Si | Ver sus tareas | Solo ver |
| Reportes | Si | Basicos | No | No |
| Gestion usuarios | Si | No | No | No |

### Gestión de usuarios (admin)

Tab o sección donde admin puede: ver lista de usuarios, crear nuevo (nombre, email, rol, password temporal), desactivar/activar, cambiar rol. Tabla con modal, igual que clientes/proveedores.

---

## Sección 3: Pipeline de seguimiento

### Estados del pipeline

```
RECORRIDO → COTIZADA → NEGOCIACIÓN → CERRADA → EN PRODUCCIÓN → EJECUTADO
                                   → CANCELADA
                                   → PERDIDA
```

| Estado | Significa | Quién lo mueve |
|--------|-----------|----------------|
| Recorrido | Se dio recorrido, aún no hay cotización | ventas |
| Cotizada | Se envió cotización MNT y/o BNK | ventas |
| Negociación | Cliente respondió, hay ida y vuelta | ventas |
| Cerrada | Cliente aceptó, se va a producir | ventas/admin |
| En Producción | Se está montando/coordinando el evento | produccion |
| Ejecutado | Evento terminado | produccion |
| Cancelada | Cliente canceló | ventas |
| Perdida | Se fue con la competencia / no respondió | ventas |

### Registro de actividad

Cada cambio de estado crea una entrada:

```
/cotizaciones/{id}/actividad/{timestamp}
  ├── estado: "Negociación"
  ├── usuario: "Ana López"
  ├── fecha: 2026-08-07T14:30:00
  ├── nota: "Cliente pide bajar 10% en audio"
  └── tipo: "cambio_estado"
```

Genera un timeline visible en el detalle de la cotización.

### Vista pipeline (kanban simplificado)

Columnas por estado con tarjetas de cotización:

```
| RECORRIDO | COTIZADA  | NEGOCIACIÓN | CERRADA    | EN PRODUCCIÓN |
| Cliente X | Cliente Y | Cliente Z   | Cliente W  | Cliente V     |
| $0        | $480,000  | $1.2M       | $890,000   | $2.1M         |
|           | hace 2d   | hace 5d !!  | ayer       | 15/ago        |
```

- Cada tarjeta: cliente, evento, monto, tiempo en ese estado
- Alerta visual si lleva mas de X dias sin moverse
- Click abre detalle con timeline
- Cambio de estado desde la tarjeta

### Notas rápidas

Ventas puede agregar notas sin mover el estado:

```
"Llamé, dice que la próxima semana decide"
"Pidió incluir servicio de streaming"
"Mandé segunda versión de cotización por WhatsApp"
```

Cada nota queda en el timeline con fecha y autor.

### Alertas de seguimiento

- **Cotizaciones frías** — mas de 3 dias en "Cotizada" sin contacto
- **Negociaciones estancadas** — mas de 5 dias sin movimiento
- **Próximos eventos** — eventos cerrados cuya fecha se acerca

Aparecen como indicador en el header del dashboard y en los KPIs.

---

## Sección 4: Reportes y métricas

### KPIs mejorados (dashboard principal)

```
| PIPELINE     | COTIZADO     | CERRADO      | TASA CIERRE  | POR COBRAR   |
| 12 activas   | $4.8M        | $2.1M        | 43%          | $890,000     |
| 3 MNT + 9BNK| este mes     | este mes     | vs mes ant   | 2 eventos    |
```

### Reportes (admin completos, ventas básicos)

**Reporte 1: Funnel de ventas**
Cotizaciones por estado del pipeline y valor acumulado por estado. Responde: "Cuanto dinero tenemos en juego y donde se estan atorando?"

**Reporte 2: Actividad mensual**
Tabla comparativa mes a mes: enviadas, cerradas, canceladas, monto cerrado, ticket promedio. Responde: "Estamos creciendo o bajando?"

**Reporte 3: Top clientes**
Ranking por monto cotizado y cerrado. Responde: "Quienes son nuestros mejores clientes?"

**Reporte 4: Rendimiento de ventas**
Tiempo promedio de cierre, cotizaciones por semana, tasa de conversión por tipo (MNT vs BNK). Responde: "Que tan eficientes somos?"

### Implementación

Queries a Firestore con agregaciones simples. Renderizado con HTML/CSS (barras con divs, tablas normales). Sin librería de gráficas — vanilla, consistente con el estilo visual del dashboard. Se calculan al momento, no pre-computados. El volumen de datos de BUNKER (decenas/cientos, no miles) lo permite.

---

## Sección 5: Módulo de producción y calendario

### Ficha de evento

Se genera automáticamente al cerrar una cotización:

```
/eventos/{id}
  ├── folio: "EVT-260815-001"
  ├── folioMNT: "MNT-260804-3312"
  ├── foliosBNK: ["BNK-260805-3600"]
  ├── cliente: "Televisa Univisión"
  ├── evento: "UP-FRONT"
  ├── fechaEvento: 2026-08-20
  ├── espacios: ["LOBBY", "FORO", "BLACK BOX"]
  ├── responsable: "uid-del-usuario"
  ├── estado: "en_produccion"
  └── checklist: [...]
```

Jala automáticamente los datos de las cotizaciones MNT + BNK vinculadas.

### Checklist de producción

Lista de tareas por evento, generada desde plantilla:

- Cada tarea tiene: descripción, responsable (usuario del sistema), fecha límite opcional, estado (pendiente/completada)
- Admin o ventas personalizan por evento

### Plantillas de checklist

Admin crea plantillas reutilizables (ej. "Evento en Foro", "Evento con Catering"). Al cerrar una cotización, ventas selecciona plantilla(s) y asigna responsables.

### Vista para producción

El rol produccion ve:
- **Mis eventos** — Solo donde tiene tareas asignadas
- **Próximos** — Ordenados por fecha, el mas cercano primero
- **Mis tareas pendientes** — Lista plana cruzando todos los eventos
- **Progreso por evento** — Barra de avance (6/10 = 60%)

No ve cotizaciones, clientes ni montos.

### Calendario de eventos con estados de reserva

Vista mensual que muestra eventos por estado de reserva:

| Color | Estado | Significa |
|-------|--------|-----------|
| Amarillo/punteado | **Cotizado** | Hay cotización con esa fecha pero no cerrada |
| Verde/solido | **Confirmado** | Cotización cerrada, cliente confirmo |
| Rojo/tachado | **Bloqueado** | Fecha reservada por admin (mantenimiento, etc.) |

**Valor comercial:** La coordinadora en el recorrido abre el calendario, ve que hay otro cliente interesado en la misma fecha, genera urgencia: "quien confirme primero se lo queda".

**Filtro por espacio:** El calendario filtra por venue (Foro, Jardin Social, Auditorio, Black Box, Lobby). Una fecha puede tener el Foro cotizado y el Jardin libre.

```
FILTRO: [TODOS] [FORO] [JARDIN] [AUDITORIO] [BLACK BOX] [LOBBY]
```

Cotizaciones con fecha de evento pero sin cerrar aparecen como "Cotizado". Si dos compiten por la misma fecha/espacio, ventas prioriza seguimiento.

---

## Sección 6: Catálogo de precios y estructura Firestore

### Catálogo de precios editable

Nueva sección accesible para admin y ventas. Tabla con CRUD:
- Campos: categoría, concepto, unidad, precio, activo
- Se sincroniza con Firestore
- Alimenta el wizard de cotizaciones BNK (autocompletado de conceptos)

### Estructura completa Firestore

```
firestore/
├── usuarios/{uid}
│   ├── nombre, email, rol, activo
│
├── cotizaciones/{id}
│   ├── folio, fuente (MNT/BNK), folioMNT
│   ├── cliente, evento, fecha, espacios, total
│   ├── estado (pipeline), responsable
│   ├── conceptos[] (para BNK)
│   ├── linkPdf, timestamps
│   └── actividad/{timestamp}
│       ├── tipo, estado, usuario, nota, fecha
│
├── clientes/{id}
│   ├── (42 campos actuales)
│
├── proveedores/{id}
│   ├── (47 campos actuales)
│   └── servicios/{id}
│       ├── categoria, servicio, unidad, costo
│
├── eventos/{id}
│   ├── folio, folioMNT, foliosBNK[]
│   ├── cliente, fechaEvento, espacios[]
│   ├── responsable, estado, plantilla
│   └── tareas/{id}
│       ├── descripcion, responsable, fechaLimite
│       ├── completada, completadaPor, completadaEn
│
├── catalogo/{id}
│   ├── categoria, concepto, unidad, precio, activo
│
├── plantillas/{id}
│   ├── nombre, tareas[]
│
└── config/alertas
    ├── diasFria: 3
    ├── diasEstancada: 5
    └── diasAnticipacion: 7
```

### Doble escritura (transitoria)

En `google-apps-script-munet.js` se agrega al final de cada POST: una llamada HTTP a la REST API de Firestore para replicar el dato. No requiere SDK, es un POST estándar. Los datos existentes en Sheets se migran con un script de una sola vez.

### Que NO cambia

- El wizard público (`cotizador-munet/index.html`) sigue igual
- Los PDFs se siguen generando client-side con jsPDF
- El sitio corporativo no se toca
- El deploy sigue siendo `git push` + `firebase deploy`

---

## Fases de implementación

| Fase | Entregable | Dependencia |
|------|-----------|-------------|
| 1. Base | Firebase Auth + Firestore + doble escritura + login + roles | Ninguna |
| 2. Pipeline | Estados expandidos, timeline, notas, alertas, vista kanban | Fase 1 |
| 3. Reportes | KPIs mejorados, funnel, actividad mensual, top clientes | Fase 1 |
| 4. Producción | Ficha de evento, checklist, plantillas, calendario con reservas | Fase 2 |
| 5. Catálogo | Precios editables desde el dashboard | Fase 1 |
| 6. Migración | Wizard escribe a Firestore, eliminar Sheets | Fases 1-5 completas |

Cada fase entrega valor operativo inmediato. El equipo puede usar el pipeline desde Fase 2 sin esperar a que todo esté listo.
