# Aula STEAM — Aplicativo de Gestión de Impresión 3D

Aplicativo web para gestionar las solicitudes, proyectos de impresión, historial e inventario de impresión y diseño 3D del **Aula STEAM Sonny Jiménez** (Universidad Nacional de Colombia, sede Medellín).

Usa los **Google Sheets existentes como base de datos** (la hoja de respuestas del Google Forms y el historial de impresiones), envía **correos HTML** de notificación vía Google Apps Script y analiza **capturas del slicer con IA (Gemini)** para extraer parámetros de impresión.

## Las 5 ventanas

| Ventana | Ruta | Función |
|---|---|---|
| 1. Dashboard | `/` | KPIs: solicitudes nuevas, tasa de éxito/fallo, tiempo por impresora, alertas de stock bajo, proyectos activos, próximas entregas |
| 2. Solicitudes | `/solicitudes` | Tabla conectada a la hoja de respuestas del Form: filtros, detalle, cambio de estado con notificación por correo, creación de solicitudes |
| 3. Proyectos | `/proyectos` | Creación/edición de proyectos de impresión sobre solicitudes aprobadas, análisis con IA de capturas del slicer, finalización con resultado/desperdicio/comentarios |
| 4. Historial | `/historial` | Registro completo de impresiones (solo lectura) con filtros y KPIs |
| 5. Inventario | `/inventario` | Filamentos (alertas de stock bajo, movimientos), impresoras y mantenimiento |

## Inicio rápido (modo demo)

Requiere [Node.js LTS](https://nodejs.org). Sin configurar nada, la app corre con **datos de ejemplo en memoria**:

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Verá un aviso de "Modo demo" en el Dashboard.

## Conectar los datos reales — paso a paso

Copie `.env.local.example` como `.env.local` y complete las 4 secciones:

### 1. Google Sheets (service account)

1. Entre a [console.cloud.google.com](https://console.cloud.google.com) → cree un proyecto (ej. `aula-steam-3d`).
2. **APIs y servicios → Biblioteca** → busque **Google Sheets API** → Habilitar.
3. **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**. Nombre: `aplicativo-3d`. (Sin roles adicionales.)
4. Abra la cuenta de servicio → pestaña **Claves → Agregar clave → JSON**. Se descarga un archivo `.json`.
5. Pegue el **contenido completo del JSON en una sola línea** en `GOOGLE_SERVICE_ACCOUNT_JSON` del `.env.local`.
6. Copie el correo de la cuenta de servicio (`...@...iam.gserviceaccount.com`) y **comparta los 3 spreadsheets con ese correo como Editor**:
   - "Solicitud de impresión y modelado 3D – Aula STEAM (respuestas)"
   - "Historial de impresión 3D FDM"
   - Un **spreadsheet nuevo vacío** que usted cree para el inventario (la app crea sola las pestañas `Filamentos`, `Movimientos`, `Impresoras` y `Mantenimiento` en el primer uso).
7. Copie el ID de cada spreadsheet (lo que está entre `/d/` y `/edit` en la URL) en `SHEET_ID_SOLICITUDES`, `SHEET_ID_HISTORIAL` y `SHEET_ID_INVENTARIO`.

> La app añade dos columnas nuevas al final del Historial: **T = "Nombre del proyecto"** y **U = "Filamento ID"**. No las elimine ni mueva.

### 2. Google Form (crear solicitudes desde la app)

Para que las solicitudes creadas en la app queden como **respuestas reales del formulario**:

1. Abra el formulario en modo edición → botón **Enviar** → copie el enlace público.
2. Abra ese enlace en el navegador → clic derecho → **Ver código fuente** → busque `entry.` — cada pregunta tiene un ID como `entry.123456789`.
   (Alternativa más fácil: en el formulario → ⋮ → **Obtener enlace previamente rellenado**, llene todos los campos, genere el enlace y copie los `entry.XXXX=` de la URL resultante.)
3. En `.env.local`:
   - `FORM_URL`: el enlace público cambiando el final `/viewform` por `/formResponse`.
   - `FORM_ENTRY_NOMBRE`, `FORM_ENTRY_CONTACTO`, etc.: cada `entry.XXXXXXX` según la pregunta.

### 3. Análisis de capturas del slicer (OCR local, sin IA)

No requiere configuración ni claves de API. Al crear un proyecto puede **subir capturas** del slicer (Bambu Studio, Cura, PrusaSlicer) y el aplicativo extrae **gramos, tiempo y material** mediante OCR (Tesseract.js) que corre localmente en el servidor —sin enviar nada a servicios de IA externos—. La primera ejecución descarga el modelo de OCR en inglés (~5 MB) y lo deja en caché.

Para mejores resultados, suba la captura **nítida y completa** del panel con el resumen del corte (p. ej. el panel *Slicing Result* de Bambu o el diálogo *Save to Disk* de Cura).

### 4. Correo — Apps Script (cuenta Aula_steam_med@unal.edu.co)

1. Con la sesión de **Aula_steam_med@unal.edu.co**, abra la **hoja de respuestas del formulario** → menú **Extensiones → Apps Script**.
2. Borre el contenido y pegue el archivo [`apps-script/Codigo.gs`](apps-script/Codigo.gs) de este proyecto.
3. Cambie `TOKEN_SECRETO` por una clave larga inventada por usted.
4. **Implementar → Nueva implementación → ⚙ Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - Copie la **URL de la aplicación web** en `APPS_SCRIPT_URL` y el token en `APPS_SCRIPT_TOKEN` del `.env.local`.
5. En el editor de Apps Script → **Activadores** (icono ⏰) → **Añadir activador**:
   - Función: `alRecibirRespuesta`
   - Fuente del evento: **De hoja de cálculo**
   - Tipo de evento: **Al enviar el formulario**
   - Esto envía un correo a `Aula_steam_med@unal.edu.co` con cada solicitud nueva, esté o no abierto el aplicativo.
6. (Opcional) Pruebe ejecutando la función `probarEnvio` desde el editor.

## Lógica de negocio importante

- **Estados de solicitud**: `Nueva` (celda vacía en la hoja), `En Revisión`, `Aprobada`, `Rechazada` y `Atendida`. El valor histórico "Aceptada" se interpreta como `Aprobada`. Al finalizar un proyecto, sus solicitudes pasan automáticamente a `Atendida` (así no vuelven a aparecer como seleccionables).
- **Código de proyecto**: `IMP-AAMMDD-NN` (fecha + consecutivo del día), generado automáticamente.
- **Descuento de inventario al finalizar**:
  - Resultado **Exitoso** → se descuentan los gramos estimados de cada solicitud + el desperdicio reportado (repartido proporcionalmente entre los rollos usados).
  - Resultado **Fallido** → se descuenta solo el desperdicio reportado (o los gramos estimados si no se reportó).
  - Cada descuento queda registrado en la pestaña `Movimientos` del inventario y suma horas a la impresora.
- **Actualización "en vivo"**: cada tabla se refresca automáticamente cada 60 s y con el botón **Actualizar**.

## Despliegue en la web (Vercel)

1. Suba el proyecto a un repositorio de GitHub (el `.gitignore` ya excluye `.env.local`).
2. En [vercel.com](https://vercel.com) → **New Project** → importe el repositorio (detecta Next.js automáticamente).
3. En **Settings → Environment Variables** agregue las mismas variables del `.env.local`.
4. Deploy. La app quedará disponible en una URL pública.

## Estructura del proyecto

```
app/            Páginas (las 5 ventanas) y API routes
lib/            Capa de datos: Google Sheets, modo demo, Gemini, correo, reglas de negocio
components/     Sidebar y componentes UI compartidos
apps-script/    Código para pegar en script.google.com (correos + trigger del Form)
```
