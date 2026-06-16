// Construcción del correo HTML (estilo Aula STEAM) y envío a través del
// Web App de Google Apps Script (cuenta Aula_steam_med@unal.edu.co).

import { config } from './config';
import { EstadoSolicitud } from './types';

export interface DatosCorreoEstado {
  destinatario: string;
  nombreSolicitante: string;
  pieza: string;
  estadoNuevo: EstadoSolicitud;
  comentarios: string;
  firmaNombre: string;
  firmaRol: string;
}

const MENSAJES_ESTADO: Record<string, { titulo: string; cuerpo: string; color: string }> = {
  'Aprobada': {
    titulo: '¡Tu solicitud fue aprobada!',
    cuerpo: 'Nos complace informarte que tu solicitud de impresión/modelado 3D ha sido <b>APROBADA</b>. Pronto será programada en un proyecto de impresión.',
    color: '#16a34a',
  },
  'Rechazada': {
    titulo: 'Tu solicitud fue rechazada',
    cuerpo: 'Lamentamos informarte que tu solicitud de impresión/modelado 3D ha sido <b>RECHAZADA</b>. En los comentarios encontrarás más información sobre el motivo.',
    color: '#dc2626',
  },
  'En Revisión': {
    titulo: 'Tu solicitud está en revisión',
    cuerpo: 'Tu solicitud de impresión/modelado 3D se encuentra <b>EN REVISIÓN</b> por el equipo del Aula STEAM. Te contactaremos cuando haya una decisión.',
    color: '#d97706',
  },
  'Atendida': {
    titulo: '¡Tu pieza está lista!',
    cuerpo: 'Tu solicitud de impresión/modelado 3D ha sido <b>ATENDIDA</b>. Tu pieza está disponible para ser recogida.',
    color: '#4f46e5',
  },
  'Nueva': {
    titulo: 'Hemos recibido tu solicitud',
    cuerpo: 'Tu solicitud de impresión/modelado 3D fue registrada y será revisada por el equipo del Aula STEAM.',
    color: '#4f46e5',
  },
};

export function construirAsunto(estado: EstadoSolicitud): string {
  return `Aula STEAM — Actualización de tu solicitud de impresión 3D: ${estado}`;
}

export function construirHtmlEstado(d: DatosCorreoEstado): string {
  const info = MENSAJES_ESTADO[d.estadoNuevo] ?? MENSAJES_ESTADO['Nueva'];
  const anio = new Date().getFullYear();
  const comentariosHtml = d.comentarios.trim()
    ? `<div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border-left:4px solid #4f46e5;border-radius:6px;">
         <p style="margin:0 0 6px;font-size:13px;color:#64748b;font-weight:bold;">Comentarios del equipo:</p>
         <p style="margin:0;font-size:14px;color:#334155;white-space:pre-line;">${escapeHtml(d.comentarios)}</p>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;">Aula STEAM</h1>
            <p style="margin:8px 0 0;color:#e0e7ff;font-size:15px;">Solicitudes de impresión y modelado 3D</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="font-size:15px;color:#334155;">Hola <b>${escapeHtml(d.nombreSolicitante)}</b>,</p>
            <p style="font-size:15px;color:#334155;">${info.cuerpo}</p>
            <div style="margin:22px 0;padding:16px 20px;background:#eef2ff;border-radius:10px;border-left:5px solid ${info.color};">
              <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Estado de la solicitud</p>
              <p style="margin:0;font-size:18px;font-weight:bold;color:${info.color};">${escapeHtml(d.estadoNuevo)}</p>
              ${d.pieza ? `<p style="margin:8px 0 0;font-size:13px;color:#64748b;">Pieza: ${escapeHtml(d.pieza)}</p>` : ''}
            </div>
            ${comentariosHtml}
            <p style="font-size:14px;color:#334155;margin-top:24px;">Para conocer más a detalle sobre su solicitud lo invitamos a acercarse al <b>aula STEAM Sonny Jiménez M3 119-120</b>.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 18px;">
            <p style="font-size:14px;color:#334155;margin:0;line-height:1.6;">
              <b>${escapeHtml(d.firmaNombre)}</b><br>
              ${escapeHtml(d.firmaRol)}<br>
              Aula STEAM Sonny Jiménez M3-119<br>
              Instituto de Educación en Ingeniería<br>
              Universidad Nacional de Colombia sede Medellín<br>
              ${anio}
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">© ${anio} Aula STEAM — Universidad Nacional de Colombia sede Medellín</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function correoConfigurado(): boolean {
  return !!config.appsScriptUrl && !!config.appsScriptToken;
}

/** Envía el correo a través del Web App de Apps Script. */
export async function enviarCorreo(to: string, subject: string, htmlBody: string): Promise<{ demo: boolean }> {
  if (!correoConfigurado()) {
    // Sin Apps Script configurado no se envía nada (modo demo / instalación parcial)
    return { demo: true };
  }
  const res = await fetch(config.appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: config.appsScriptToken, to, subject, htmlBody }),
    redirect: 'follow',
  });
  const texto = await res.text();
  let data: { ok?: boolean; error?: string } = {};
  try { data = JSON.parse(texto); } catch { /* Apps Script puede devolver HTML en errores */ }
  if (!res.ok || data.ok !== true) {
    throw new Error(data.error || `Apps Script respondió HTTP ${res.status}`);
  }
  return { demo: false };
}
