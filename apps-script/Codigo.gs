/**
 * Aula STEAM — Script de correo (notificaciones al solicitante)
 * ============================================================
 * Se pega en https://script.google.com con la sesión de
 * Aula_steam_med@unal.edu.co. Su única función es recibir peticiones del
 * aplicativo web (doPost) y enviar los correos HTML de notificación de
 * cambio de estado a los solicitantes.
 *
 * (La notificación interna de "nueva solicitud recibida" se maneja por
 *  separado con tu propio flujo de Apps Script vinculado a la hoja de
 *  respuestas del formulario; este script NO la gestiona.)
 *
 * INSTALACIÓN (ver README.md del aplicativo para el paso a paso):
 *   a) script.google.com → Nuevo proyecto → pegar este código.
 *   b) Cambiar TOKEN_SECRETO por una clave larga propia (la misma que va en
 *      APPS_SCRIPT_TOKEN del .env.local del aplicativo).
 *   c) Implementar → Nueva implementación → Aplicación web →
 *      "Ejecutar como: yo" + "Acceso: cualquier usuario". Copiar la URL
 *      en APPS_SCRIPT_URL del .env.local.
 */

var TOKEN_SECRETO = 'CAMBIE_ESTE_TOKEN_POR_UNO_SECRETO';
var CORREO_AULA = 'Aula_steam_med@unal.edu.co';
var NOMBRE_REMITENTE = 'Aula STEAM Sonny Jiménez';

/** Recibe {token, to, subject, htmlBody} y envía el correo HTML. */
function doPost(e) {
  var salida;
  try {
    var datos = JSON.parse(e.postData.contents);
    if (datos.token !== TOKEN_SECRETO) {
      salida = { ok: false, error: 'Token inválido' };
    } else if (!datos.to || !datos.subject || !datos.htmlBody) {
      salida = { ok: false, error: 'Faltan campos (to, subject, htmlBody)' };
    } else {
      GmailApp.sendEmail(datos.to, datos.subject, 'Este correo requiere un cliente con soporte HTML.', {
        htmlBody: datos.htmlBody,
        name: NOMBRE_REMITENTE,
      });
      salida = { ok: true };
    }
  } catch (err) {
    salida = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

/** Función de prueba manual: Ejecutar → probarEnvio (envía un correo al aula). */
function probarEnvio() {
  GmailApp.sendEmail(CORREO_AULA, 'Prueba — Aplicativo Aula STEAM', 'Prueba de envío', {
    htmlBody: '<p>El script de correo del aplicativo funciona ✔</p>',
    name: NOMBRE_REMITENTE,
  });
}
