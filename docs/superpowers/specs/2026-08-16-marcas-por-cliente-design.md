# Sistema de Marcas por Cliente

**Fecha**: 2026-08-16  
**Estado**: Implementado y desplegado

## Resumen

Se cambió el campo `marcas` de texto libre a un sistema de **chips/tags** que permite registrar múltiples marcas por cliente. Al crear una cotización (BNK o MNT), si el cliente tiene marcas registradas, aparece un dropdown para seleccionar para cuál marca es la cotización.

## Problema original

Un usuario registró "Televisa" dos veces en el dashboard anterior (Google Sheets) con marcas diferentes: "Up Front" y "La Rosa de Guadalupe". El panel no correlacionaba estos registros — eran dos clientes independientes sin relación.

## Solución implementada

### 1. Chips de marcas en Clientes

- **Archivo**: `panel/js/pages/clientes.js`
- El campo `marcas` ahora es un **array** en Firestore (ej: `["Up Front", "La Rosa de Guadalupe"]`)
- En el modal de cliente, se usa un sistema de chips: escribir marca → Enter → se agrega como chip con X para eliminar
- Backspace borra el último chip, coma también agrega
- Datos legacy (strings separados por coma) se parsean automáticamente a array
- `BNKClientes.parseMarcas()` expuesto públicamente para uso en cotizadores

### 2. Detección de duplicados

- Al salir del campo "Empresa" en el modal de cliente, se busca si ya existe otro cliente con el mismo nombre
- Si existe, muestra un warning amarillo clickeable: "Ya existe Televisa (CLI-XXX). Clic para abrir ese registro."
- Permite abrir el registro existente directamente para agregar la marca ahí

### 3. Selector de marca en cotizadores

- **Archivos**: `panel/js/pages/cotizar-bnk.js`, `panel/js/pages/cotizar-mnt.js`
- El autocomplete de empresa ahora muestra las marcas entre paréntesis: `Televisa (Up Front, La Rosa de Guadalupe)`
- Al seleccionar un cliente:
  - Si tiene >1 marca → aparece dropdown "MARCA" para elegir
  - Si tiene 1 marca → se auto-selecciona
  - Si tiene 0 marcas → el selector permanece oculto
- La marca seleccionada se guarda en el campo `marca` de la cotización en Firestore

### 4. Tabla de cotizaciones

- **Archivo**: `panel/js/pages/cotizaciones.js`
- Nueva columna "MARCA" en la tabla, sortable y buscable en filtros

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `panel/css/panel.css` | Estilos: `.bnk-chips-*`, `.bnk-marca-*`, `.bnk-dup-warn` |
| `panel/dashboard.html` | Chips container en modal clientes, selector marca en BNK y MNT, columna MARCA en tabla cotizaciones |
| `panel/js/pages/clientes.js` | Sistema de chips, detección duplicados, parseMarcas(), guardar como array |
| `panel/js/pages/cotizar-bnk.js` | Selector de marca, mostrar marcas en autocomplete, guardar marca en cotización |
| `panel/js/pages/cotizar-mnt.js` | Mismo patrón que BNK |
| `panel/js/pages/cotizaciones.js` | Columna marca en tabla, búsqueda incluye marca |

## Pendientes / mejoras futuras

- [ ] Mostrar marca en el PDF generado (actualmente se guarda en Firestore pero no se imprime en el PDF)
- [ ] Migrar datos existentes en Google Sheets que tengan marcas como texto a arrays (si se importan al panel)
- [ ] Considerar si el campo marca debería ser obligatorio al cotizar para clientes que tienen marcas registradas
