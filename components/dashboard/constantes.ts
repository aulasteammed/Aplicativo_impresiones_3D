// Paletas, catálogos y formateadores compartidos por las secciones del Dashboard.

export const PAL = ['#6366f1', '#a855f7', '#f59e0b', '#10b981', '#3b82f6', '#f43f5e', '#14b8a6', '#eab308'];
export const CEST: Record<string, string> = { 'Nueva': '#3b82f6', 'En Revisión': '#f59e0b', 'Aprobada': '#10b981', 'Rechazada': '#f43f5e', 'Atendida': '#94a3b8' };
export const MESES: Record<string, string> = { '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr', '05': 'may', '06': 'jun', '07': 'jul', '08': 'ago', '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic' };
export const MESES_LARGO: Record<string, string> = { '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre' };
export const DIMS: [string, string][] = [['mes', 'Mes'], ['rol', 'Rol'], ['programa', 'Programa'], ['motivo', 'Motivo'], ['servicio', 'Servicio']];

export const nf = (n: number) => Math.round(n).toLocaleString('es-CO');
// Mes agrupado por YYYY-MM (todo el mes). La etiqueta usa el nombre del mes y el
// año de 4 dígitos para que no se confunda con un día (ej. "Febrero 2026").
export const mesLbl = (m: string) => { const [y, mo] = m.split('-'); return `${MESES_LARGO[mo] || mo} ${y || ''}`.trim(); };
export const mesCorto = (m: string) => { const [y, mo] = m.split('-'); return { m: MESES[mo] || mo, y: y || '' }; };

/** Capitaliza la primera letra (usada por Mantenimiento y Costos de mantenimiento). */
export const capMant = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
