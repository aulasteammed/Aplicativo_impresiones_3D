import { EstadoSolicitud } from './types';

/** Normaliza el estado leído del Sheets al estándar de la app.
 *  La hoja histórica usa "Aceptada"; el estándar es "Aprobada". Vacío = "Nueva". */
export function normalizarEstado(valor: string | undefined | null): EstadoSolicitud {
  const v = (valor ?? '').trim().toLowerCase();
  if (!v || v === 'nueva') return 'Nueva';
  if (v === 'aceptada' || v === 'aprobada') return 'Aprobada';
  if (v === 'rechazada') return 'Rechazada';
  if (v === 'en revisión' || v === 'en revision') return 'En Revisión';
  if (v === 'atendida' || v === 'finalizada' || v === 'entregada') return 'Atendida';
  return 'Nueva';
}

/** Extrae la primera dirección de correo de un texto libre ("correo y número de contacto") */
export function extraerCorreo(texto: string): string {
  const m = (texto ?? '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : '';
}

/** "3h44m", "3.73", "225 min" → horas decimales */
export function parsearHoras(texto: string | number | null | undefined): number {
  if (texto === null || texto === undefined || texto === '') return 0;
  if (typeof texto === 'number') return texto;
  const t = texto.trim().toLowerCase().replace(',', '.');
  const hm = t.match(/(\d+)\s*h(?:\s*(\d+)\s*m)?/);
  if (hm) return parseInt(hm[1], 10) + (hm[2] ? parseInt(hm[2], 10) / 60 : 0);
  const min = t.match(/(\d+(?:\.\d+)?)\s*min/);
  if (min) return parseFloat(min[1]) / 60;
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Genera el código de proyecto IMP-AAMMDD-NN a partir de los códigos existentes */
export function generarCodigoProyecto(codigosExistentes: string[]): string {
  const d = new Date();
  const fecha = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefijo = `IMP-${fecha}-`;
  const delDia = codigosExistentes.filter((c) => c.startsWith(prefijo));
  let max = 0;
  for (const c of delDia) {
    const n = parseInt(c.slice(prefijo.length), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `${prefijo}${String(max + 1).padStart(2, '0')}`;
}
