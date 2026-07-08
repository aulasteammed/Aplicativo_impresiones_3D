# Aula STEAM — Aplicativo de Gestión de Impresión 3D

Aplicativo web para gestionar las **solicitudes**, **camas de impresión**, **historial** e **inventario** de impresión y diseño 3D del **Aula STEAM Sonny Jiménez** (Universidad Nacional de Colombia, sede Medellín).

Usa **Google Sheets como base de datos** (la hoja de respuestas del Google Forms + una hoja de historial + una hoja de inventario), envía **correos HTML** de notificación al solicitante vía **Google Apps Script**, y extrae parámetros de impresión de **capturas del slicer mediante OCR local** (Tesseract.js, sin IA ni servicios externos).

- **Stack**: Next.js 14 (App Router) · React 18 · TypeScript · Tailwind (gráficos del dashboard en CSS/SVG propios).
- **Google**: `googleapis` (service account) para leer/escribir los Sheets.
- **OCR**: `tesseract.js` + `jimp` (corre en el servidor, local).
- **Exportación**: `exceljs` para generar el archivo `.xlsx` de descarga.

---

## Índice

1. [Las 5 ventanas](#las-5-ventanas)
2. [Requisitos previos](#requisitos-previos)
3. [Inicio rápido (modo demo)](#inicio-rápido-modo-demo)
4. [Conectar los servicios de Google (modo real)](#conectar-los-servicios-de-google-modo-real)
5. [Variables de entorno (`.env.local`)](#variables-de-entorno-envlocal)
6. [Estructura de los Google Sheets (columnas)](#estructura-de-los-google-sheets-columnas)
7. [Lógica de negocio importante](#lógica-de-negocio-importante)
8. [Despliegue](#despliegue)
9. [Estructura del proyecto](#estructura-del-proyecto)

---

## Las 5 ventanas

| Ventana | Ruta | Función |
|---|---|---|
| 1. Dashboard | `/` | Tablero **interactivo con filtros** (mes, rol, programa, motivo, servicio): KPIs de solicitudes, producción, camas y mantenimiento; **alertas de stock** y de mantenimiento; botón **Exportar a Excel** (`.xlsx`) con filtro por rango de fechas |
| 2. Solicitudes | `/solicitudes` | Tabla conectada a la hoja de respuestas del Form: filtros, orden inicial por estado, detalle, cambio de estado con **notificación por correo**, creación/edición/eliminación de solicitudes, **paginación** |
| 3. Camas de impresión | `/proyectos` | Crea/edita **camas** sobre solicitudes aprobadas, **análisis OCR** de capturas del slicer, asignación de filamento del inventario, cambio de estado, finalización con resultado/desperdicio/comentarios, **paginación** |
| 4. Historial | `/historial` | Registro de impresiones finalizadas (solo lectura) con filtros, KPIs y **paginación** |
| 5. Inventario | `/inventario` | Filamentos (con **umbrales de alerta** por color/marca/tipo y movimientos), impresoras y mantenimiento (con **programación** de próximos mantenimientos). Editar/eliminar en todas las tablas |

---

## Requisitos previos

- **[Node.js LTS](https://nodejs.org)** (v18 o superior) y `npm`.
- Para el **modo real** necesitas acceso a:
  - Una **cuenta de Google Cloud** (para crear la *service account*).
  - Las **3 hojas de cálculo** de Google (ver más abajo). Pueden existir ya o crearse vacías.
  - El **Google Form** de solicitudes y su **hoja de respuestas**.
  - La cuenta **`Aula_steam_med@unal.edu.co`** (o la que uses como remitente) para el correo.

> La app funciona **sin nada de esto** en modo demo. Todo lo de Google es solo para el modo real.

---

## Inicio rápido (modo demo)

Sin configurar nada, la app corre con **datos de ejemplo en memoria** (no toca ningún Google Sheets):

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Verás un aviso de **"Modo demo"** en el Dashboard. Puedes explorar y probar todo (crear camas, inventario, umbrales, OCR de capturas, etc.); los cambios viven en memoria y se pierden al reiniciar el servidor.

---

## Conectar los servicios de Google (modo real)

La app pasa a **modo real** automáticamente cuando en `.env.local` están presentes: las **credenciales** de la service account **y** los **3 IDs** de spreadsheet. Copia primero la plantilla:

```bash
cp .env.local.example .env.local
```

### Paso 1 — Crear la *service account* (Google Cloud)

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) → crea un proyecto (ej. `aula-steam-3d`).
2. **APIs y servicios → Biblioteca** → busca **Google Sheets API** → **Habilitar**.
3. **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**. Nombre: `aplicativo-3d` (sin roles adicionales).
4. Abre la cuenta de servicio → pestaña **Claves → Agregar clave → Crear clave nueva → JSON**. Se descarga un archivo `.json`.
5. Pega el **contenido completo del JSON en una sola línea** en `GOOGLE_SERVICE_ACCOUNT_JSON` del `.env.local`.
   - *Alternativa*: guarda el `.json` en tu equipo y pon su ruta en `GOOGLE_APPLICATION_CREDENTIALS` (deja `GOOGLE_SERVICE_ACCOUNT_JSON` vacío).

### Paso 2 — Preparar las 3 hojas y compartirlas

Necesitas **3 spreadsheets** (archivos de Google Sheets):

| Spreadsheet | Qué es | ¿Crear? |
|---|---|---|
| **Solicitudes** | La **hoja de respuestas** de tu Google Form | Ya existe (la genera el Form) |
| **Historial** | Registro de impresiones ("Historial de impresión 3D FDM") | Ya existe, o créalo con los encabezados A–S (ver [columnas](#estructura-de-los-google-sheets-columnas)) |
| **Inventario** | Filamentos, impresoras, etc. | **Crea uno nuevo y vacío** — la app arma sola sus 5 pestañas |

Luego:

1. Copia el correo de la service account (`...@...iam.gserviceaccount.com`, está dentro del JSON como `client_email`).
2. En **cada uno de los 3 spreadsheets** → botón **Compartir** → agrega ese correo con permiso **Editor**.
3. Copia el **ID** de cada spreadsheet (lo que está entre `/d/` y `/edit` en su URL) a `.env.local`:
   - `SHEET_ID_SOLICITUDES`
   - `SHEET_ID_HISTORIAL`
   - `SHEET_ID_INVENTARIO`

> **Nombres de las pestañas**: por defecto la app espera la pestaña de solicitudes llamada `Respuestas de formulario 1` y la de historial `Historial`. Si las tuyas se llaman distinto, define `TAB_SOLICITUDES` / `TAB_HISTORIAL` en `.env.local`. Las 5 pestañas del inventario las crea la app automáticamente con sus nombres fijos.

> **Crear solicitudes desde la app**: no requiere configuración extra. La app escribe la solicitud **directamente en la hoja de respuestas** (columnas A–M), sin pasar por el Google Form. Por eso **la app lee y escribe la hoja por posición de columna**: el **correo debe estar en la columna C**, el **celular en la columna L** y la columna **M** queda reservada para el **estado**. No insertes ni muevas columnas dentro de ese rango. Ver [columnas](#estructura-de-los-google-sheets-columnas).

### Paso 3 — Análisis de capturas del slicer (OCR local)

**No requiere configuración ni claves de API.** Al crear una cama puedes **subir capturas** del slicer (Bambu Studio, Cura, PrusaSlicer) y la app extrae **gramos, tiempo y material** con OCR (Tesseract.js) que corre localmente en el servidor —sin enviar nada afuera—.

- La **primera vez** que se usa el OCR, descarga el modelo en inglés (~5 MB) y lo deja en caché (`*.traineddata`, ya ignorado por git).
- Para mejores resultados, sube la captura **nítida y completa** del panel de resumen (p. ej. *Slicing Result* de Bambu o *Save to Disk* de Cura).

### Paso 4 — Correo de notificación (Google Apps Script)

La app **no** manda correo directamente: delega en un **Apps Script publicado como Web App** que corre con la sesión de la cuenta del aula y envía con `GmailApp` (así el correo sale desde el Gmail real del aula, sin exponer contraseñas). Este script **solo** envía la **notificación de cambio de estado al solicitante**.

> El aviso interno de *"nueva solicitud recibida"* **no** lo maneja este aplicativo; se gestiona con tu propio flujo de Apps Script vinculado a la hoja de respuestas.

1. Con la sesión de **`Aula_steam_med@unal.edu.co`**, abre la **hoja de respuestas del formulario** → menú **Extensiones → Apps Script**.
2. Borra el contenido y pega el archivo [`apps-script/Codigo.gs`](apps-script/Codigo.gs) de este proyecto.
3. Cambia `TOKEN_SECRETO` por una **clave larga inventada** (será la contraseña compartida app↔script).
4. **Implementar → Nueva implementación → ⚙ Aplicación web**:
   - *Ejecutar como*: **Yo**
   - *Quién tiene acceso*: **Cualquier usuario**
   - Autoriza los permisos de Gmail cuando lo pida.
   - Copia la **URL de la aplicación web** en `APPS_SCRIPT_URL` y el mismo token en `APPS_SCRIPT_TOKEN` del `.env.local`.
5. (Opcional) Ejecuta la función `probarEnvio` desde el editor para verificar el envío.

> Si editas `Codigo.gs` después, debes **volver a implementar** (nueva versión) para que tome los cambios. Sin `APPS_SCRIPT_URL`/`APPS_SCRIPT_TOKEN`, el cambio de estado **sí se aplica** pero el correo **no se envía** (la app te avisa).

---

## Variables de entorno (`.env.local`)

```bash
# --- 1. Google Sheets (service account) ---
GOOGLE_SERVICE_ACCOUNT_JSON=      # JSON completo en una sola línea
# GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\credenciales.json   # alternativa
SHEET_ID_SOLICITUDES=
SHEET_ID_HISTORIAL=
SHEET_ID_INVENTARIO=
# TAB_SOLICITUDES=Respuestas de formulario 1   # solo si tu pestaña se llama distinto
# TAB_HISTORIAL=Historial

# --- 2. OCR: sin configuración (local) ---

# --- 3. Correo (Apps Script Web App) ---
APPS_SCRIPT_URL=
APPS_SCRIPT_TOKEN=                # el mismo TOKEN_SECRETO de Codigo.gs
```

**Modo demo vs real**: la app usa modo real solo si hay credenciales (`GOOGLE_SERVICE_ACCOUNT_JSON` o `GOOGLE_APPLICATION_CREDENTIALS`) **y** los 3 `SHEET_ID_*`. Si falta cualquiera, corre en demo. El correo es opcional: sin `APPS_SCRIPT_*` el cambio de estado se aplica igual, solo que no se envía la notificación. **Crear solicitudes no necesita configuración extra**: se escriben directamente en la hoja de respuestas.

---

## Estructura de los Google Sheets (columnas)

La app lee/escribe **por posición de columna** (la fila 1 son encabezados; los datos empiezan en la fila 2). **No insertes ni muevas columnas** dentro de los rangos indicados.

### Solicitudes (hoja de respuestas del Form) — rango `A2:M`

| Col | Contenido |
|---|---|
| A | Marca temporal (automática del Form) |
| B | Nombre del solicitante |
| C | **Correo electrónico** (solo el correo) |
| D | Rol |
| E | Programa académico |
| F | Motivo |
| G | Servicio |
| H | Descripción de la pieza |
| I | Objetivo de la pieza |
| J | Archivos adjuntos (subida del Form) |
| K | Fecha tentativa |
| L | **Número de celular** |
| M | **Estado** (lo gestiona la app: `Nueva`/`En Revisión`/`Aprobada`/`Rechazada`/`Atendida`) |

### Historial — rango `A2:T`

Columnas **A–S** son las preexistentes; la app añade/gestiona **solo la T**.

| Col | Contenido | Se escribe |
|---|---|---|
| A | Marca temporal de la solicitud (vínculo) | al crear cama |
| B | Código de la cama (`IMP-DDMMAA-NN`) | al crear |
| C–K | Nombre, correo, rol, programa, motivo, servicio, descripción, objetivo, fecha | al crear |
| L | Impresora | al crear |
| M | Tiempo de impresión (**horas decimales**, p. ej. `3.73`) | al crear |
| N | Gramos | al crear |
| O | Material | al crear |
| P | Estado de la cama (`Activa`/`En pausa`/`Finalizada`) | al crear (`Activa`); se actualiza al pausar/finalizar |
| Q | Resultado (`Exitoso`/`Fallido`) | al **finalizar** |
| R | Desperdicio (g) | al finalizar |
| S | Comentarios | al finalizar |
| **T** | **Filamento ID** (rollo de inventario asignado, ej. `FIL-003`). Encabezado que gestiona la app: `Filamento ID` | al crear |

> Una **fila = una pieza/solicitud** dentro de una cama. Varias filas con el **mismo código (B)** forman una sola cama.

### Inventario — 5 pestañas (las crea y encabeza la app sola)

| Pestaña | Columnas |
|---|---|
| **Filamentos** | A ID · B Tipo · C Color · D Marca · E Rollos · F Comenzado · G Gramos restantes · H Umbral alerta (g) *(en desuso)* · I Fecha registro · J Notas |
| **Movimientos** | A Fecha · B Filamento ID · C Proyecto · D Gramos (− sale / + entra) · E Motivo |
| **Impresoras** | A ID · B Nombre · C Modelo · D Estado · E Horas acumuladas · F Notas |
| **Mantenimiento** | A Fecha · B Impresora ID · C Tipo · D Descripción · E **Costo (COP)** · F Responsable · G Programación (`ninguna`/`fecha`/`horas`) · H Próxima fecha · I Cada N horas · J Horas base (horas de la impresora al registrar) |
| **Umbrales** | A ID · B Variable (`color`/`marca`/`tipo`) · C Valor · D Umbral (g) |

> La columna **H de Filamentos** ("Umbral alerta (g)") quedó **en desuso**: desde que las alertas se definen en la pestaña **Umbrales**, los filamentos nuevos escriben `0` ahí. Se conserva solo por compatibilidad de posición.

> **Costo de mantenimiento**: siempre se maneja en **pesos colombianos (COP)**. **Programación del próximo mantenimiento** (columnas G–J): al registrar una actividad se puede programar el siguiente para una **fecha** específica (H) o de forma **periódica cada N horas** de uso (I), tomando las horas acumuladas de la impresora al momento del registro como punto de partida (J). Esa programación es la que alimenta las **alertas de mantenimiento** del Dashboard (apartado de mantenimiento). La app **añade sola** las columnas nuevas a la hoja existente en el próximo arranque en modo real (solo reescribe la fila de encabezados; no toca los datos).

---

## Lógica de negocio importante

- **Creación de solicitudes**: las solicitudes creadas desde la app se **escriben directamente en la hoja de respuestas** (columnas A–M), con marca temporal en **hora de Colombia (UTC-5)**. No se usa el `formResponse` del Google Form (su pregunta de subida de archivos rechaza el envío anónimo). El Google Form sigue existiendo para quien lo llene por fuera; ambas vías caen en la misma hoja.
- **Estados de solicitud**: `Nueva` (celda vacía en la hoja), `En Revisión`, `Aprobada`, `Rechazada`, `Atendida`. El histórico "Aceptada" se interpreta como `Aprobada`. Solo las solicitudes **Aprobada** son elegibles para una cama. **Finalizar una cama NO cambia el estado** de sus solicitudes; el paso a `Atendida` lo hace el usuario manualmente en Solicitudes.
- **Correo de notificación**: al cambiar el estado, la app pregunta si notificar. El destinatario viene de la **columna C** (correo), es **editable** y admite **varios correos** separados por comas.
- **Paginación**: las tablas de Solicitudes, Camas e Historial se paginan (10/20/50/100 por página) y vuelven a la página 1 al cambiar filtros o búsqueda.
- **Camas de impresión**: el **código** (`IMP-DDMMAA-NN`) es el identificador; se genera automático pero es **editable y único** al crear. El **tiempo** se ingresa/edita en **horas y minutos** (internamente se guarda en horas decimales). Se puede **asignar un filamento** del inventario por solicitud.
- **Inventario — filamentos con tolerancia**: al añadir un filamento, si (tipo, color, marca) coincide con uno existente —tolerando mayúsculas, acentos y pequeños typos (distancia Damerau-Levenshtein)— la app **fusiona** (suma rollos/gramos) o **pregunta** si la coincidencia es solo aproximada. El total de un filamento nuevo = `rollos × 1000 g` + (opcional) gramos de rollos comenzados.
- **Materiales canónicos**: el material escrito (o detectado por OCR) se normaliza a su forma canónica con la misma tolerancia (`petg`, `pteg` → `PETG`), para evitar duplicados en estadísticas.
- **Umbrales de alerta (stock)**: se definen por **color / marca / tipo** + gramos. La tabla **"Alertas de stock"** y el Dashboard suman el **total del inventario** que coincide con cada regla y avisan si está **por debajo** o **muy cerca** (dentro del 10%) del umbral. (El chip "Stock bajo" de cada fila de filamentos es por rollo).
- **Descuento de inventario al finalizar una cama**:
  - **Exitoso** → descuenta los gramos estimados de cada pieza + el desperdicio reportado (repartido proporcionalmente entre los rollos usados).
  - **Fallido** → descuenta solo el desperdicio reportado (o los gramos estimados si no se reportó).
  - Cada descuento queda en la pestaña `Movimientos` y suma horas a la impresora.
  - El desperdicio se reporta **una sola vez por cama** (aunque se guarde en cada fila de la cama); el Dashboard lo cuenta una sola vez para no inflar el total.
- **Exportar a Excel**: desde el Dashboard, el botón **Exportar** genera un `.xlsx` (una hoja por conjunto: solicitudes, camas, historial, filamentos, mantenimiento) y permite acotar por **rango de fechas**.
- **Actualización "en vivo"**: cada tabla se refresca automáticamente (~60 s, en pausa cuando la pestaña no está visible) y con el botón **Actualizar**.

---

## Novedades (limpieza y correcciones — cierre de la v1.0)

- **Correcciones de lógica**:
  - El **desperdicio** ya no se multiplicaba por el número de piezas de una cama en el total del Dashboard.
  - La **marca temporal** de las solicitudes creadas desde la app usa hora de Colombia (UTC-5), no la del servidor (evita que en producción una solicitud caiga en el mes equivocado).
  - `finalizarProyecto` registra el **movimiento de inventario antes** de descontar el rollo, de modo que un fallo parcial deja la operación reintentable sin doble descuento.
  - Robustez al editar/eliminar solicitudes cuando no se conoce la fila exacta; los diálogos de eliminación evitan el **doble envío**.
- **Código y dependencias eliminados por no usarse**: envío al Google Form (`lib/google/forms.ts`) y sus variables `FORM_URL`/`FORM_ENTRY_*`; endpoint y función `getDashboard` (`/api/dashboard`) superados por el dashboard interactivo; dependencia `recharts`; variable `CORREO_AULA`. Ninguna funcionalidad del aplicativo se ve afectada.

## Despliegue

### Local en modo producción

```bash
npm run build
npm start        # http://localhost:3000
```

### Vercel

1. Sube el proyecto a un repositorio de GitHub (el `.gitignore` ya excluye `.env.local` y `*.traineddata`).
2. En [vercel.com](https://vercel.com) → **New Project** → importa el repositorio (detecta Next.js automáticamente).
3. En **Settings → Environment Variables** agrega las mismas variables del `.env.local`.
4. **Deploy**. La app queda en una URL pública.

> Notas: el OCR corre en el runtime de Node (ya configurado con `serverComponentsExternalPackages` para `tesseract.js`, `jimp` y `googleapis` en `next.config.mjs`). La primera petición de OCR descarga el modelo (~5 MB), por lo que puede tardar un poco en un arranque en frío.

---

## Estructura del proyecto

```
app/               Páginas (las 5 ventanas) y API routes (app/api/**)
lib/
  config.ts        Lee variables de entorno; decide modo demo vs real
  datastore.ts     Fachada de datos + reglas de negocio (camas, inventario, dashboard)
  demo.ts          Almacén en memoria (modo demo)
  ocr.ts           Análisis OCR local de capturas (Tesseract.js + Jimp)
  email.ts         Construcción del correo HTML + envío vía Apps Script
  util.ts          Utilidades: normalización, tolerancia difusa, materiales, alertas
  google/
    sheets.ts      Cliente de Google Sheets (lectura/escritura de las 3 hojas)
  types.ts         Tipos compartidos
components/         Sidebar y componentes UI compartidos
apps-script/
  Codigo.gs        Web App de correo (pegar en script.google.com)
```
