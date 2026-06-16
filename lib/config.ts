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

  // Google Form (creación de solicitudes desde la app)
  formUrl: process.env.FORM_URL ?? '', // https://docs.google.com/forms/d/e/XXXX/formResponse
  formEntries: {
    nombre: process.env.FORM_ENTRY_NOMBRE ?? '',
    contacto: process.env.FORM_ENTRY_CONTACTO ?? '',
    rol: process.env.FORM_ENTRY_ROL ?? '',
    programa: process.env.FORM_ENTRY_PROGRAMA ?? '',
    motivo: process.env.FORM_ENTRY_MOTIVO ?? '',
    servicio: process.env.FORM_ENTRY_SERVICIO ?? '',
    descripcion: process.env.FORM_ENTRY_DESCRIPCION ?? '',
    objetivo: process.env.FORM_ENTRY_OBJETIVO ?? '',
    fecha: process.env.FORM_ENTRY_FECHA ?? '', // los forms de fecha usan _year/_month/_day
  },

  // IA (Google Gemini)
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',

  // Correo vía Apps Script Web App
  appsScriptUrl: process.env.APPS_SCRIPT_URL ?? '',
  appsScriptToken: process.env.APPS_SCRIPT_TOKEN ?? '',

  correoAula: process.env.CORREO_AULA ?? 'Aula_steam_med@unal.edu.co',
};

/** true cuando faltan credenciales/IDs y la app debe usar datos demo en memoria */
export function esModoDemo(): boolean {
  const hayCredenciales = !!config.serviceAccountJson || !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return !(hayCredenciales && config.sheetSolicitudesId && config.sheetHistorialId && config.sheetInventarioId);
}
