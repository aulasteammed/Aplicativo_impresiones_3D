import { EstadoSolicitud, Filamento, UmbralAlerta, AlertaUmbral } from './types';

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

/** Normaliza texto para comparaciones tolerantes: sin acentos, en minúsculas,
 *  sin espacios extremos y con espacios internos colapsados. */
export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos (acentos, diéresis)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Distancia de edición (Damerau-Levenshtein / alineación óptima de cadenas):
 *  cuenta inserción, borrado, sustitución y TRANSPOSICIÓN de caracteres
 *  adyacentes como 1 error (así "pteg"→"petg" o "balnco"→"blanco" = 1). */
export function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposición adyacente
      }
    }
  }
  return d[m][n];
}

/** ¿Dos textos coinciden de forma aproximada? Tolera mayúsculas/acentos/espacios
 *  y pequeños typos (distancia de edición según la longitud). */
export function coincideAprox(a: string, b: string): boolean {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (na === nb) return true; // incluye vacío ↔ vacío
  const max = Math.max(na.length, nb.length);
  const umbral = max <= 4 ? 1 : max <= 8 ? 2 : 3;
  return distanciaLevenshtein(na, nb) <= umbral;
}

// Materiales conocidos (forma canónica). Si el usuario escribe uno con otra
// capitalización o un pequeño error, se mapea a esta forma para evitar duplicados.
export const MATERIALES_CANONICOS = [
  'PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'Nylon', 'PC', 'PVA', 'HIPS', 'PP', 'PA',
  'Resina', 'PLA+', 'PLA-CF', 'PETG-CF', 'PA-CF', 'PC-CF',
];

/** Normaliza el material escrito por el usuario a su forma canónica con tolerancia
 *  a mayúsculas/acentos y a pequeños errores de tecleo (p. ej. "petg" y "pteg" →
 *  "PETG"). Si no se parece a ninguno conocido, conserva lo escrito (material nuevo). */
export function canonicalizarMaterial(input: string): string {
  const limpio = (input ?? '').trim();
  if (!limpio) return '';
  const objetivo = normalizarTexto(limpio);

  // 1) Coincidencia EXACTA normalizada → respeta el material conocido tal cual
  //    (protege códigos cortos legítimos: "pa" se queda PA, no se mapea a PLA).
  for (const m of MATERIALES_CANONICOS) {
    if (normalizarTexto(m) === objetivo) return m;
  }
  if (objetivo === 'resin') return 'Resina';

  // 2) Coincidencia APROXIMADA (typo/transposición) → el conocido más cercano
  let mejor: string | null = null;
  let mejorDist = Infinity;
  for (const m of MATERIALES_CANONICOS) {
    if (!coincideAprox(m, limpio)) continue;
    const d = distanciaLevenshtein(normalizarTexto(m), objetivo);
    if (d < mejorDist) { mejorDist = d; mejor = m; }
  }
  if (mejor) return mejor;

  // 3) No reconocido → se conserva lo escrito (material nuevo)
  return limpio;
}

// Un total dentro de este % por encima del umbral se considera "cerca del límite".
export const MARGEN_PROXIMIDAD_UMBRAL = 0.10;

/** Alertas AGREGADAS por umbral: para cada regla suma el total de filamento del
 *  inventario que coincide con su variable+valor (sin importar las otras dos
 *  características) e incluye solo las que están por debajo o muy cerca del umbral. */
export function calcularAlertasAgregadas(filamentos: Filamento[], umbrales: UmbralAlerta[]): AlertaUmbral[] {
  const out: AlertaUmbral[] = [];
  for (const u of umbrales) {
    const coincidentes = filamentos.filter((f) =>
      normalizarTexto(u.variable === 'color' ? f.color : u.variable === 'marca' ? f.marca : String(f.tipo))
        === normalizarTexto(u.valor));
    const total = coincidentes.reduce((acc, f) => acc + f.gramosRestantes, 0);
    if (total <= u.umbralGramos) {
      out.push({ variable: u.variable, valor: u.valor, total, umbralGramos: u.umbralGramos, rollos: coincidentes.length, estado: 'debajo' });
    } else if (total <= u.umbralGramos * (1 + MARGEN_PROXIMIDAD_UMBRAL)) {
      out.push({ variable: u.variable, valor: u.valor, total, umbralGramos: u.umbralGramos, rollos: coincidentes.length, estado: 'cerca' });
    }
  }
  return out;
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
