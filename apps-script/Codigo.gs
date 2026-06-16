/**
 * Aula STEAM — Script de correo y notificaciones
 * ================================================
 * Este script se pega en https://script.google.com con la sesión de
 * Aula_steam_med@unal.edu.co y cumple DOS funciones:
 *
 * 1. doPost: recibe peticiones del aplicativo web y envía los correos HTML
 *    de notificación de cambio de estado a los solicitantes.
 * 2. alRecibirRespuesta: trigger "Al enviar el formulario" que avisa a
 *    Aula_steam_med@unal.edu.co cada vez que llega una solicitud nueva.
 *
 * INSTALACIÓN (ver README.md del aplicativo para el paso a paso):
 *   a) script.google.com → Nuevo proyecto → pegar este código.
 *   b) Cambiar TOKEN_SECRETO por una clave larga propia (la misma que va en
 *      APPS_SCRIPT_TOKEN del .env.local del aplicativo).
 *   c) Implementar → Nueva implementación → Aplicación web →
 *      "Ejecutar como: yo" + "Acceso: cualquier usuario". Copiar la URL
 *      en APPS_SCRIPT_URL del .env.local.
 *   d) Activadores (reloj ⏰) → Añadir activador → función alRecibirRespuesta →
 *      Fuente: "De hoja de cálculo" → Tipo: "Al enviar el formulario".
 *      (El proyecto de script debe estar vinculado a la hoja de respuestas:
 *      lo más fácil es crearlo desde la hoja: Extensiones → Apps Script.)
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

/** Trigger "Al enviar el formulario": notifica al aula la solicitud nueva. */
function alRecibirRespuesta(e) {
  try {
    var valores = e.namedValues || {};
    var nombre = primer(valores, ['Nombres y apellidos. En caso de ser un grupo estudiantil, digite el nombre de dicho grupo.']) || 'Solicitante sin nombre';
    var contacto = primer(valores, ['Correo electrónico y número de contacto']) || '';
    var motivo = primer(valores, ['¿Con qué motivo solicita la impresión?']) || '';
    var servicio = primer(valores, ['¿Qué tipo de asesoramiento/servicio necesita?']) || '';
    var fecha = primer(valores, ['¿Cuál es la fecha tentativa para la cuál necesita el modelo o la pieza impresa en 3D?']) || '';

    var html =
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;text-align:center;color:#fff;">' +
      '<h2 style="margin:0;">Nueva solicitud de impresión 3D</h2></div>' +
      '<div style="padding:24px;color:#334155;font-size:14px;">' +
      '<p>Se recibió una nueva respuesta en el formulario de solicitudes:</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
      fila('Solicitante', nombre) +
      fila('Contacto', contacto) +
      fila('Motivo', motivo) +
      fila('Servicio', servicio) +
      fila('Fecha tentativa', fecha) +
      '</table>' +
      '<p style="margin-top:16px;">Revísala y gestiónala desde el aplicativo del Aula STEAM (ventana <b>Solicitudes</b>).</p>' +
      '</div></div>';

    GmailApp.sendEmail(CORREO_AULA, '📥 Nueva solicitud de impresión 3D — ' + nombre, 'Nueva solicitud de ' + nombre, {
      htmlBody: html,
      name: NOMBRE_REMITENTE,
    });
  } catch (err) {
    console.error('Error notificando nueva solicitud: ' + err);
  }
}

function primer(valores, claves) {
  for (var i = 0; i < claves.length; i++) {
    var v = valores[claves[i]];
    if (v && v.length > 0 && v[0]) return v[0];
  }
  // Búsqueda tolerante: por inicio del texto de la pregunta
  var todas = Object.keys(valores);
  for (var j = 0; j < claves.length; j++) {
    var inicio = claves[j].substring(0, 25);
    for (var k = 0; k < todas.length; k++) {
      if (todas[k].indexOf(inicio) === 0 && valores[todas[k]][0]) return valores[todas[k]][0];
    }
  }
  return '';
}

function fila(etiqueta, valor) {
  return (
    '<tr><td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;color:#64748b;width:140px;">' + etiqueta + '</td>' +
    '<td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;"><b>' + valor + '</b></td></tr>'
  );
}

/** Función de prueba manual: Ejecutar → probarEnvio (envía un correo al aula). */
function probarEnvio() {
  GmailApp.sendEmail(CORREO_AULA, 'Prueba — Aplicativo Aula STEAM', 'Prueba de envío', {
    htmlBody: '<p>El script de correo del aplicativo funciona ✔</p>',
    name: NOMBRE_REMITENTE,
  });
}
