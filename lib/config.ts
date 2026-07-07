// Configuración central: lee variables de entorno y decide si la app corre
// en modo real (Google Sheets) o en modo demo (datos en memoria).

export const config = {
  sheetSolicitudesId: process.env.SHEET_ID_SOLICITUDES ?? '',
  sheetHistorialId: process.env.SHEET_ID_HISTORIAL ?? '',
  sheetInventarioId: process.env.SHEET_ID_INVENTARIO ?? '',

  // Nombres de las hojas (pestañas)
  tabSolicitudes: process.env.TAB_SOLICITUDES ?? 'Respuestas de formulario 1',
  tabHistorial: process.env.TAB_HISTORIAL ?? 'Historial',

  // Credenciales de la service account: JSON completo en una variable,
  // o ruta a archivo vía GOOGLE_APPLICATION_CREDENTIALS (la maneja googleapis).
  serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '',

  // Correo vía Apps Script Web App
  appsScriptUrl: process.env.APPS_SCRIPT_URL ?? '',
  appsScriptToken: process.env.APPS_SCRIPT_TOKEN ?? '',
};

/** true cuando faltan credenciales/IDs y la app debe usar datos demo en memoria */
export function esModoDemo(): boolean {
  const hayCredenciales = !!config.serviceAccountJson || !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return !(hayCredenciales && config.sheetSolicitudesId && config.sheetHistorialId && config.sheetInventarioId);
}
