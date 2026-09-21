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

## Orden de Ejecucion Sugerido para Proxima Sesion

| Orden | Item | Tiempo | Prioridad |
|---|---|---|---|
| 1 | P1 — App Check (consola + codigo) | 20 min | ALTA |
| 2 | P2 — Password Policy (consola) | 2 min | BAJA |
| 3 | P3 — Apps Script hardening | 30 min | ALTA |
| 4 | P5a — URL hash routing | 15 min | MEDIA |
| 5 | P5b — Defer scripts | 10 min | MEDIA |
| 6 | P5c — Toasts accesibles + retry | 20 min | MEDIA |
| 7 | P4 — Datos bancarios (decidir A o B) | 15 min - 3 hrs | MEDIA |
| **Total minimo** | (sin P4 opcion A) | **~1.5 hrs** | |
| **Total completo** | (con P4 opcion A) | **~4 hrs** | |

---

## Contexto Tecnico para la Proxima Sesion

- **Firebase project:** `bunker-panel` (cuenta: admin@vanguardiaysoluciones)
- **Plan:** Blaze (pay-as-you-go) — activo
- **Firebase Storage:** activo, rules desplegadas
- **SDK version:** 10.12.0 (compat mode)
- **Apps Script:** editor en Google Drive, proyecto vinculado a Sheet `1MrynkbdpsQOq2IuzalyiRfVesUhWcs_020BDl8S_1vk`
- **Deploy panel:** `firebase deploy --only hosting --project bunker-panel`
- **Deploy reglas:** `firebase deploy --only firestore:rules,storage --project bunker-panel`
