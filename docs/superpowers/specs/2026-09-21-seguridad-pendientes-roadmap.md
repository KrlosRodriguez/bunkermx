# Panel BUNKER — Roadmap de Seguridad y Mejoras Pendientes

**Fecha:** 2026-09-21
**Contexto:** Resultados de 3 auditorias (seguridad, UX/UI, penetration testing) ejecutadas sobre el panel operativo en `bunker-panel.web.app`. Los hallazgos CRITICAL y HIGH ya fueron reparados. Este documento lista lo que queda pendiente, priorizado y con pasos exactos para ejecutar en la siguiente sesion.

**Score actual post-fixes:** Seguridad 88/100 | UX 76/100 | Penetration 80/100

---

## Resumen de lo ya completado (2026-09-21)

| # | Fix | Severidad | Commit |
|---|---|---|---|
| 1 | XSS `documentos.js` — agregado `_esc()` | CRITICAL | `22596e9` |
| 2 | Reglas `/documentos/` restringidas por rol | CRITICAL | `22596e9` |
| 3 | Storage regex anclado `^(...)$` | CRITICAL | `22596e9` |
| 4 | `usuarios` solo legible por self + admin | HIGH | `22596e9` |
| 5 | `--tx2` definido + overlay bug arreglado | HIGH | `acb609a` |
| 6 | `lectura` removido del tab CLIENTES | HIGH | `acb609a` |
| 7 | Collection group rule de documentos eliminada | HIGH | `22596e9` |
| 8 | Storage rules con check de rol en uploads | MEDIUM | `e033278` |
| 9 | `cotizaciones/actividad` restringida a ventas+admin | MEDIUM | `e033278` |
| 10 | XSS `javascript:` en href — `_safeUrl()` agregado | MEDIUM | `448a33f` |
| 11 | CSP connect-src especificado sin wildcard | MEDIUM | `e033278` |
| 12 | CSV export con audit log a Firestore | MEDIUM | `448a33f` |

---

## Pendientes — Configuracion en Consola Firebase

### P1. Firebase App Check (Prioridad: ALTA)

**Que es:** Previene que scripts externos usen tu API key de Firebase para abusar de Firestore/Storage/Auth. Sin App Check, cualquiera puede copiar tu `apiKey` del codigo fuente y hacer llamadas desde su propia app.

**Impacto si no se hace:** Abuso de cuota (billing attack), spam de documentos, enumeracion de datos.

**Pasos exactos:**

1. Crear site key de reCAPTCHA v3:
   - Ir a https://www.google.com/recaptcha/admin
   - Tipo: reCAPTCHA v3
   - Dominio: `bunker-panel.web.app`
   - Copiar el **site key** generado

2. Configurar en Firebase:
   - Ir a https://console.firebase.google.com/project/bunker-panel/appcheck
   - Clic en "Get started"
   - Seleccionar la app web → proveedor: **reCAPTCHA v3**
   - Pegar el site key
   - Guardar

3. Agregar el SDK en el codigo (hacer en sesion):
   - Agregar script tag en `dashboard.html`:
     ```html
     <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check-compat.js"></script>
     ```
   - En `firebase-config.js`, despues de `firebase.initializeApp(firebaseConfig)`:
     ```js
     var appCheck = firebase.appCheck();
     appCheck.activate('TU_RECAPTCHA_SITE_KEY', true);
     ```

4. Monitorear 1 semana en modo "Monitor" (no "Enforce")
5. Despues de verificar que no bloquea trafico legitimo, activar "Enforce" en la consola para Firestore, Storage y Auth

**Tiempo estimado:** 15 min consola + 5 min codigo + 1 semana monitor

---

### P2. Password Policy (Prioridad: BAJA)

**Que es:** Firebase Auth permite passwords de 6 caracteres por default. Subir a 8 minimo.

**Pasos:**
1. Ir a https://console.firebase.google.com/project/bunker-panel/authentication/settings
2. Buscar "Password policy"
3. Activar: minimo 8 caracteres
4. Guardar

**Tiempo estimado:** 2 min

---

## Pendientes — Codigo (siguiente sesion)

### P3. Apps Script: Validacion y Rate Limiting (Prioridad: ALTA)

**Que es:** La URL del Google Apps Script (`AKfycbw5...`) esta expuesta en el codigo fuente del cotizador publico (`cotizador-munet/js/cotizador-munet.js` y `cotizador-munet/google-apps-script-munet.js`). Cualquiera puede llamarla directamente sin UI, sin validacion, sin limite.

**Riesgos:**
- Spam de cotizaciones falsas llenando la Google Sheet
- Agotamiento de cuota de `MailApp.sendEmail` (100/dia en Workspace)
- Datos basura en el sistema

**Solucion propuesta (editar en Google Apps Script editor):**

1. **Rate limiting con CacheService:**
   ```js
   function doPost(e) {
     var ip = e.parameter.ip || 'unknown';
     var cache = CacheService.getScriptCache();
     var key = 'rate_' + ip;
     var count = cache.get(key);
     if (count && parseInt(count) >= 5) {
       return ContentService.createTextOutput(JSON.stringify({
         status: 'error', message: 'Demasiadas solicitudes. Intenta en 10 minutos.'
       })).setMimeType(ContentService.MimeType.JSON);
     }
     cache.put(key, (parseInt(count || 0) + 1).toString(), 600); // 10 min TTL
     // ... resto del doPost
   }
   ```

2. **Validacion de campos en doPost:**
   - Verificar que campos obligatorios existan y no esten vacios
   - Limitar longitud de strings (nombre < 200 chars, email valido, telefono < 20 chars)
   - Rechazar si `tipoCotizacion` no es `'MNT'` ni `'BNK'`

3. **Honeypot field en el formulario publico:**
   - Agregar un campo oculto `<input type="text" name="website" style="display:none">` en el cotizador HTML
   - En Apps Script, rechazar si `website` tiene valor (bots lo llenan)

4. **Header de validacion:**
   - En el fetch del cotizador JS, agregar header: `'X-BNK-Source': 'cotizador-web'`
   - En Apps Script, verificar: `if (e.parameter.source !== 'cotizador-web') return error;`

**Donde editar:** Google Apps Script editor → proyecto del cotizador → `google-apps-script-munet.js`
**Deploy:** Nueva implementacion en Apps Script → actualizar URL si cambia

**Tiempo estimado:** 30 min

---

### P4. Datos Bancarios Visibles a Rol Ventas (Prioridad: MEDIA)

**Que es:** Un usuario con rol `ventas` puede ver CLABE, RFC, CURP, datos bancarios de todos los clientes y proveedores. Firestore no tiene seguridad a nivel campo — es todo-o-nada por documento.

**Opciones:**

**Opcion A — Subcollection fiscal (recomendada):**
- Mover campos sensibles (CLABE, banco, titular, SWIFT, IBAN, RFC, CURP) a subcollection `clientes/{id}/fiscal/{docId}` y `proveedores/{id}/fiscal/{docId}`
- Regla: `allow read, write: if isAdmin()`
- En la UI, el tab "Bancarios" solo carga datos si el usuario es admin
- Ventas ve los tabs General, Contacto, Facturacion pero no Bancarios

**Opcion B — Ocultar en UI solamente:**
- No mover datos en Firestore (ventas tecnicamente puede leerlos via consola)
- Solo ocultar el tab "Bancarios" para ventas en la UI
- Mas rapido pero menos seguro

**Recomendacion:** Opcion A si manejan datos de terceros (LFPDPPP aplica). Opcion B si el equipo de ventas es de confianza total y son pocos.

**Tiempo estimado:** Opcion A: 2-3 horas | Opcion B: 15 min

---

### P5. Mejoras UX de Alto Impacto (Prioridad: MEDIA)

#### P5a. URL Hash Routing para Tabs
**Que:** Que el tab activo se refleje en la URL (`#cotizaciones`, `#clientes`). Refresh conserva el tab. Links compartibles.
**Donde:** Inline script en `dashboard.html` (seccion de tab switching)
**Codigo:** ~10 lineas. `window.location.hash` on tab click + leer hash on load.
**Tiempo:** 15 min

#### P5b. Defer Scripts No Criticos
**Que:** Mover jsPDF, logo-data.js, y los 12 modulos de pagina a carga diferida (`defer`).
**Donde:** `panel/dashboard.html` — cambiar script tags
**Impacto:** Reduce Time-to-Interactive 30-50%, importante para conexiones lentas en Oaxaca.
**Tiempo:** 10 min

#### P5c. Toasts con role="alert" y Boton Retry
**Que:** Agregar `role="alert"` al contenedor de toasts para accesibilidad. Agregar boton "Reintentar" cuando falla la carga de datos.
**Donde:** Toast: funcion `BNKToast` (buscar en `dashboard.html` o JS). Retry: en cada modulo donde hay `.catch()` en load.
**Tiempo:** 20 min

---

### P6. LFPDPPP — Registro de Tratamiento de Datos (Prioridad: BAJA)

**Que es:** La Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares requiere un registro formal de que datos se recopilan, por quien, para que, y por cuanto tiempo.

**Datos que el panel maneja:**
- RFC, CURP (datos fiscales — sensibles)
- CLABE, datos bancarios (datos patrimoniales — proteccion especial)
- Correo, telefono (PII estandar)
- Documentos subidos (INE, comprobantes — datos de identificacion)

**Acciones pendientes:**
1. Crear documento interno de politica de privacidad
2. Definir periodos de retencion (cuanto tiempo se guardan documentos en Storage)
3. Implementar eliminacion automatica de documentos vencidos (Cloud Function con TTL)
4. Agregar aviso de privacidad en el cotizador publico

**Esto no es codigo — es un documento legal que debe redactarse con asesoria juridica.**

**Tiempo estimado:** Documento: 1-2 dias con abogado | Implementacion tecnica: 2-3 horas

---

### P7. Seguridad Firestore — Validacion de Campos (Prioridad: MEDIA)

**Origen:** Auditoria de seguridad + penetration testing

**Que es:** Las reglas de Firestore permiten escribir cualquier campo en cualquier documento. Un usuario autenticado podria inyectar campos arbitrarios (ej. `isAdmin: true`) en documentos de cotizaciones o clientes.

**Solucion:**
- Agregar `request.resource.data.keys().hasOnly([...])` en las reglas de escritura de cada coleccion
- Ejemplo para `cotizaciones`:
  ```
  allow create: if isAdminOrVentas()
    && request.resource.data.keys().hasOnly(['folio','cliente','estado','fecha','fechaEvento','conceptos','total','tipo','clienteId','clienteNombre','folioMNT','marca','desgloseVenues','condiciones','subtotal','iva','descuento','notas','createdAt']);
  ```
- Repetir para: clientes, proveedores, partners, catalogo, pagos, cotizacionPartners, cotizacionProveedores, cuentasCobrar

**Donde:** `firestore.rules`
**Tiempo estimado:** 30 min

---

### P8. Seguridad Firestore — Rate Limiting en Escrituras (Prioridad: MEDIA)

**Origen:** Auditoria de seguridad + penetration testing

**Que es:** No hay limite de escrituras por usuario. Un usuario autenticado podria hacer miles de writes por segundo agotando la cuota Blaze.

**Solucion:**
- Agregar validacion temporal en reglas:
  ```
  allow create: if isAdminOrVentas()
    && (!exists(/databases/$(database)/documents/rateLimits/$(request.auth.uid))
        || resource.data.lastWrite < request.time - duration.value(1, 's'));
  ```
- Alternativa mas simple: Cloud Function con throttle (requiere Blaze activo)
- Alternativa minima: confiar en que los usuarios son pocos y de confianza (documentar decision)

**Nota:** Firebase no tiene rate limiting nativo en rules. La solucion con `rateLimits` collection agrega una lectura extra por write. Evaluar costo/beneficio dado el equipo pequeno.

**Donde:** `firestore.rules` o Cloud Functions
**Tiempo estimado:** 45 min (rules) o 1 hr (Cloud Function)

---

### P9. Firebase SDK Update a v11.x (Prioridad: BAJA)

**Origen:** Auditoria de seguridad

**Que es:** El panel usa Firebase SDK 10.12.0 (compat mode). La version actual es 11.x con mejoras de seguridad y rendimiento.

**Riesgos de no actualizar:** Vulnerabilidades parcheadas en versiones posteriores, deprecacion futura del compat mode.

**Pasos:**
1. Revisar changelog de Firebase SDK 10.12 → 11.x para breaking changes
2. Actualizar todos los script tags en `dashboard.html` e `index.html` (panel)
3. Verificar que compat mode sigue funcionando en 11.x
4. Probar todos los flujos: auth, Firestore reads/writes, Storage uploads
5. Deploy y verificar en produccion

**Riesgo:** MEDIO — el compat mode puede tener diferencias sutiles. Hacer en sesion dedicada con tiempo para testing.

**Donde:** `panel/dashboard.html`, `panel/index.html` — script tags
**Tiempo estimado:** 30 min + testing

---

### P10. Storage — Proteccion contra Upload Spam (Prioridad: MEDIA)

**Origen:** Penetration testing

**Que es:** Un usuario autenticado con rol ventas podria subir archivos en loop hasta llenar el bucket de Storage (billing attack en plan Blaze).

**Solucion:**
- Opcion A: Cloud Function trigger `onFinalize` que cuenta archivos por usuario/entidad y bloquea si excede limite (ej. 50 archivos por entidad)
- Opcion B: Validacion client-side + regla de Storage que limite tamano total (Storage rules no soportan count, solo size por archivo)
- Opcion C: Monitoreo de cuota en Firebase Console con alertas de billing

**Recomendacion:** Opcion C como minimo inmediato (configurar alerta en $10 y $25). Opcion A si se activan Cloud Functions.

**Donde:** Firebase Console (alertas) + opcional Cloud Functions
**Tiempo estimado:** 5 min (alertas) + 1 hr (Cloud Function)

---

## Pendientes — UX/UI (siguiente sesion)

### P11. Agrupacion Visual de Tabs (Prioridad: MEDIA)

**Origen:** Auditoria UX/UI

**Que es:** El dashboard tiene 12 tabs en una sola fila sin agrupacion logica. En pantallas medianas se comprimen y es dificil encontrar el tab deseado.

**Solucion:**
- Agrupar visualmente con separadores o categorias:
  - **Ventas:** Cotizaciones | Pipeline | Cotizar MNT | Cotizar BNK
  - **Directorio:** Clientes | Proveedores
  - **Operaciones:** Calendario | Eventos | Reportes | Catalogo
  - **Admin:** Usuarios | Finanzas
- Implementar con CSS: `border-left` o `gap` mayor entre grupos, label sutil encima de cada grupo
- En movil: considerar dropdown o tabs colapsables por grupo

**Donde:** `panel/dashboard.html` (tab bar HTML) + `panel/css/panel.css`
**Tiempo estimado:** 20 min

---

### P12. Breadcrumbs en Wizards (Prioridad: BAJA)

**Origen:** Auditoria UX/UI

**Que es:** Los wizards MNT y BNK muestran pasos numerados pero no hay indicador claro de progreso ni forma de navegar hacia atras visualmente.

**Solucion:**
- Agregar barra de progreso visual con pasos clickeables (ej. `Contacto → Evento → Espacios → Resumen`)
- Cada paso completado cambia de color
- Click en paso anterior navega de regreso

**Donde:** `panel/js/pages/cotizar-mnt.js`, `panel/js/pages/cotizar-bnk.js`, `panel/css/panel.css`
**Tiempo estimado:** 25 min

---

### P13. Touch Targets y Responsive Movil (Prioridad: MEDIA)

**Origen:** Auditoria UX/UI

**Que es:** Varios elementos interactivos (botones de accion en tablas, tabs, links en popovers) tienen area tactil menor a 44x44px, el minimo recomendado por WCAG para dispositivos touch. Ademas, no hay breakpoint para pantallas de 360px (comunes en Mexico/Oaxaca).

**Solucion:**
1. **Touch targets:** Agregar `min-height: 44px; min-width: 44px` a:
   - Botones de accion en tablas (`.ctz-actions button`)
   - Tab buttons (`.bnk-tab`)
   - Links dentro de popovers
2. **Breakpoint 360px:** Agregar media query `@media (max-width: 374px)` con ajustes para:
   - Font sizes reducidos en tablas
   - Tabs en scroll horizontal
   - Modales full-width sin padding lateral
3. **Popover clipping:** En pantallas pequenas, los popovers se salen del viewport. Agregar logica de posicionamiento que detecte bordes y reposicione.

**Donde:** `panel/css/panel.css` (responsive section)
**Tiempo estimado:** 30 min

---

### P14. Accesibilidad — Emojis y ARIA (Prioridad: BAJA)

**Origen:** Auditoria UX/UI

**Que es:** El panel usa emojis como iconos funcionales (📋, 📦, 🔗, etc.) sin `aria-label`. Screen readers los leen como su nombre Unicode en vez de su funcion.

**Solucion:**
- Envolver emojis funcionales en `<span role="img" aria-label="descripcion">emoji</span>`
- Emojis decorativos: `<span role="img" aria-hidden="true">emoji</span>`
- Priorizar los que son botones o indicadores de accion

**Donde:** `panel/dashboard.html`, modulos JS que generan HTML con emojis
**Tiempo estimado:** 20 min

---

### P15. Consistencia Visual — Login y Formatos (Prioridad: BAJA)

**Origen:** Auditoria UX/UI

**Que es:** Dos problemas de consistencia visual:
1. `panel/css/login.css` usa `--gold` hardcodeado en vez del token `--accent` del sistema de diseno
2. Montos monetarios no tienen separador de miles (ej. `$15000` en vez de `$15,000`)
3. Input `type="date"` tiene renderizado inconsistente entre navegadores (Chrome vs Firefox vs Safari)

**Solucion:**
1. **Login tokens:** Reemplazar `--gold` por `var(--accent)` en `login.css` (~3 ocurrencias)
2. **Formato moneda:** Crear helper `_fmtMoney(n)` usando `Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'})` y usarlo en todos los modulos que muestran precios
3. **Date picker:** Agregar flatpickr o similar como date picker consistente, o documentar que se acepta la variacion nativa

**Donde:** `panel/css/login.css`, modulos JS con montos, `panel/dashboard.html`
**Tiempo estimado:** 25 min (tokens + moneda) + 30 min (date picker opcional)

---

### P16. Indicador Offline y Estado de Campos (Prioridad: BAJA)

**Origen:** Auditoria UX/UI

**Que es:** Dos mejoras de feedback al usuario:
1. No hay indicador cuando el usuario pierde conexion a internet (Firestore falla silenciosamente)
2. Los tabs de modales (General, Contacto, etc.) no muestran cuales tienen campos incompletos

**Solucion:**
1. **Offline indicator:**
   ```js
   window.addEventListener('offline', () => BNKToast.warn('Sin conexion a internet'));
   window.addEventListener('online', () => BNKToast.ok('Conexion restaurada'));
   ```
   Opcionalmente, mostrar banner persistente mientras este offline.

2. **Indicador de campos incompletos:** Agregar badge o dot rojo en tabs que tienen campos requeridos vacios. Actualizar al cambiar de tab o al modificar campos.

**Donde:** `panel/dashboard.html` (offline), modulos de clientes/proveedores (indicadores)
**Tiempo estimado:** 15 min (offline) + 30 min (indicadores tabs)

---

## Resumen Completo de Pendientes

### Por origen de auditoria

| Auditoria | Total hallazgos | Arreglados | Documentados | Cobertura |
|---|---|---|---|---|
| Seguridad | 16 | 12 | P1-P4, P7-P10 | 100% |
| Penetration Testing | 22 pruebas | 12 pasaron, 6 arreglados | P1, P3, P7-P8, P10 | 100% |
| UX/UI | 17 | 2 (--tx2, overlay) | P5a-c, P11-P16 | 100% |

### Por prioridad

| Prioridad | Items | Tiempo total estimado |
|---|---|---|
| ALTA | P1, P3 | 50 min |
| MEDIA | P4, P5a-c, P7-P8, P10-P11, P13 | 3-5.5 hrs |
| BAJA | P2, P6, P9, P12, P14-P16 | 2.5 hrs + abogado |

## Orden de Ejecucion Sugerido para Proxima Sesion

| Orden | Item | Tiempo | Prioridad |
|---|---|---|---|
| 1 | P1 — App Check (consola + codigo) | 20 min | ALTA |
| 2 | P2 — Password Policy (consola) | 2 min | BAJA |
| 3 | P3 — Apps Script hardening | 30 min | ALTA |
| 4 | P7 — Firestore field validation (hasOnly) | 30 min | MEDIA |
| 5 | P10 — Billing alerts en Firebase | 5 min | MEDIA |
| 6 | P5a — URL hash routing | 15 min | MEDIA |
| 7 | P5b — Defer scripts | 10 min | MEDIA |
| 8 | P5c — Toasts accesibles + retry | 20 min | MEDIA |
| 9 | P11 — Agrupacion visual de tabs | 20 min | MEDIA |
| 10 | P13 — Touch targets + responsive 360px | 30 min | MEDIA |
| 11 | P15 — Login tokens + formato moneda | 25 min | BAJA |
| 12 | P16 — Offline indicator | 15 min | BAJA |
| 13 | P14 — ARIA labels emojis | 20 min | BAJA |
| 14 | P12 — Breadcrumbs wizards | 25 min | BAJA |
| 15 | P8 — Rate limiting Firestore | 45 min | MEDIA |
| 16 | P4 — Datos bancarios (decidir A o B) | 15 min - 3 hrs | MEDIA |
| 17 | P9 — SDK update 11.x | 30 min | BAJA |
| 18 | P6 — LFPDPPP (requiere abogado) | N/A | BAJA |
| **Total minimo** | (sin P4-A, P8, P9, P6) | **~4.5 hrs** | |
| **Total completo** | (todo incluido) | **~9 hrs** | |

---

## Contexto Tecnico para la Proxima Sesion

- **Firebase project:** `bunker-panel` (cuenta: admin@vanguardiaysoluciones)
- **Plan:** Blaze (pay-as-you-go) — activo
- **Firebase Storage:** activo, rules desplegadas
- **SDK version:** 10.12.0 (compat mode)
- **Apps Script:** editor en Google Drive, proyecto vinculado a Sheet `1MrynkbdpsQOq2IuzalyiRfVesUhWcs_020BDl8S_1vk`
- **Deploy panel:** `firebase deploy --only hosting --project bunker-panel`
- **Deploy reglas:** `firebase deploy --only firestore:rules,storage --project bunker-panel`
