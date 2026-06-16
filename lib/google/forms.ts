// Envío de solicitudes nuevas al Google Form real (endpoint formResponse).
// Así la solicitud queda como una respuesta auténtica del formulario y la hoja
// de respuestas nunca se desincroniza.

import { config } from '../config';

export interface NuevaSolicitud {
  nombre: string;
  contacto: string;
  rol: string;
  programa: string;
  motivo: string;
  servicio: string;
  descripcionPieza: string;
  objetivoPieza: string;
  fechaTentativa: string; // YYYY-MM-DD
}

export function formConfigurado(): boolean {
  return !!config.formUrl && !!config.formEntries.nombre;
}

export async function enviarAlForm(datos: NuevaSolicitud): Promise<void> {
  if (!formConfigurado()) {
    throw new Error('El Google Form no está configurado (FORM_URL / FORM_ENTRY_* en .env.local)');
  }
  const params = new URLSearchParams();
  const e = config.formEntries;
  const set = (entry: string, valor: string) => {
    if (entry && valor) params.set(entry, valor);
  };
  set(e.nombre, datos.nombre);
  set(e.contacto, datos.contacto);
  set(e.rol, datos.rol);
  set(e.programa, datos.programa);
  set(e.motivo, datos.motivo);
  set(e.servicio, datos.servicio);
  set(e.descripcion, datos.descripcionPieza);
  set(e.objetivo, datos.objetivoPieza);
  // Los campos de fecha de Google Forms se envían en tres partes
  if (e.fecha && datos.fechaTentativa) {
    const [y, m, d] = datos.fechaTentativa.split('-');
    params.set(`${e.fecha}_year`, y);
    params.set(`${e.fecha}_month`, String(parseInt(m, 10)));
    params.set(`${e.fecha}_day`, String(parseInt(d, 10)));
  }

  const res = await fetch(config.formUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    redirect: 'follow',
  });
  // Google responde 200 con la página de confirmación; 4xx indica entries inválidos
  if (res.status >= 400) {
    throw new Error(`El formulario rechazó el envío (HTTP ${res.status}). Verifique los FORM_ENTRY_* en .env.local`);
  }
}
