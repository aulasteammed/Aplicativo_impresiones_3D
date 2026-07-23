import { EstadoSolicitud, Filamento, UmbralAlerta, AlertaUmbral, Impresora, Mantenimiento, AlertaMantenimiento } from './types';

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

/** ¿La cama está en curso (Activa o En pausa)? Estas van a la ventana "Camas de
 *  impresión"; una vez Finalizada, deja de mostrarse ahí y pasa a "Historial". */
export function esCamaEnCurso(estado: string | null | undefined): boolean {
  const e = (estado ?? '').trim().toLowerCase();
  return e === 'activa' || e === 'en pausa';
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

// Colombia usa UTC-5 todo el año (no tiene horario de verano). Se centraliza aquí
// para que el "día" del sistema cambie a la medianoche de Colombia y no a la del
// servidor (que en producción —p. ej. Vercel— suele ser UTC). Así los códigos de
// cama, las fechas de movimientos y el corte mensual del dashboard no se desfasan
// un día cuando la operación ocurre entre la medianoche local y la de UTC.
const OFFSET_COLOMBIA_MS = 5 * 60 * 60 * 1000; // UTC-5

/** Instante actual desplazado a la hora de pared de Colombia (UTC-5). Léelo con los
 *  getters UTC (getUTCFullYear/getUTCMonth/getUTCDate) o con toISOString(). */
function ahoraColombia(): Date {
  return new Date(Date.now() - OFFSET_COLOMBIA_MS);
}

/** Fecha de hoy (YYYY-MM-DD) según la hora de Colombia (UTC-5) */
export function hoyISO(): string {
  return ahoraColombia().toISOString().slice(0, 10);
}

/** Marca temporal "DD/MM/YYYY HH:mm:ss" en hora de Colombia (UTC-5), con el mismo
 *  formato que genera Google Forms. Se usa como id y fecha de las solicitudes
 *  creadas desde la app, para que el mes al que se atribuyen no se desfase en un
 *  servidor UTC (p. ej. Vercel). */
export function marcaTemporalColombia(): string {
  const d = ahoraColombia();
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

/** Normaliza una fecha en cualquiera de los formatos usados en el aplicativo a
 *  'YYYY-MM-DD'. Acepta ISO (2026-04-01[THH:mm...]) y formato Colombia del
 *  formulario (DD/MM/YYYY[ HH:mm:ss]). Devuelve '' si no logra interpretarla. */
export function fechaISO(valor: string | null | undefined): string {
  const s = String(valor ?? '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const col = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (col) return `${col[3]}-${col[2].padStart(2, '0')}-${col[1].padStart(2, '0')}`;
  return '';
}

/** Extrae la fecha de creación (YYYY-MM-DD) codificada en un código de cama
 *  'IMP-DDMMAA-NN'. Devuelve '' si el código no tiene ese formato. */
export function fechaDeCodigoCama(codigo: string | null | undefined): string {
  const m = String(codigo ?? '').match(/^IMP-(\d{2})(\d{2})(\d{2})-/);
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : '';
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

/** Marcador de "filamento propio" (lo trae el solicitante): se guarda como
 *  filamentoId de la pieza pero NO se descuenta del inventario al finalizar. */
export const FILAMENTO_PROPIO = 'PROPIO';

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

// Catálogos de las categorías CERRADAS del dashboard (vocabulario controlado).
// Sirven para que ningún valor de otra categoría se cuele en un filtro o gráfico,
// para colapsar duplicados por mayúsculas/tildes, y para agrupar en "Otros"
// cualquier valor que no esté en el catálogo (ver canonCategoria).
export const CATALOGOS_DASHBOARD: Record<string, string[]> = {
  rol: ['Estudiante', 'Profesor(a)', 'Egresado(a)', 'Contratista', 'Empleado(a)', 'Público externo'],
  programa: [
    'Arquitectura', 'Artes plásticas', 'Construcción', 'Matemáticas', 'Estadística',
    'Ingeniería biológica', 'Ingeniería física', 'Ciencias de la computación', 'Ingeniería agrícola',
    'Ingeniería agronómica', 'Ingeniería forestal', 'Zootecnia', 'Ciencias políticas', 'Historia',
    'Economía', 'Ingeniería Civil', 'Ingeniería Administrativa', 'Ingeniería Ambiental',
    'Ingeniería de petróleos', 'Ingeniería Mecánica', 'Ingeniería Eléctrica', 'Ingeniería de Control',
    'Ingeniería Geológica', 'Ingeniería Química', 'Ingeniería Industrial', 'Ingeniería de Minas y Metalurgia',
    'Ingeniería de Sistemas e Informática',
  ],
  motivo: ['Asignaturas de proyectos en ingeniería', 'Investigación', 'Proyecto académico', 'Proyecto personal', 'Curso académico'],
  servicio: ['Impresión 3D', 'Modelado 3D', 'Modelado 3D e Impresión 3D'],
};

// Reconoce los grupos "meta" que se conservan como bucket propio (no van a "Otros"
// ni se descartan): los "(sin dato)" entre paréntesis y el "No aplica" del programa.
const esPlaceholderCat = (v: string) => /^\(.*\)$/.test(v.trim()) || normalizarTexto(v) === 'no aplica';

/** Valor canónico de `valor` para la categoría `dim`, o null si no corresponde a
 *  esa categoría (colapsa mayúsculas/tildes y descarta valores de otra categoría).
 *  En una categoría cerrada, un valor propio que no esté en el catálogo se agrupa
 *  como "Otros" (no se descarta); solo se descartan los valores que pertenecen a
 *  OTRA categoría (datos mal ubicados). */
export function canonCategoria(dim: string, valor: string | null | undefined): string | null {
  if (valor == null || valor === '') return null;
  const v = String(valor);
  if (esPlaceholderCat(v)) return v.trim();
  const propio = CATALOGOS_DASHBOARD[dim];
  if (propio) {
    const hit = propio.find((c) => normalizarTexto(c) === normalizarTexto(v));
    if (hit) return hit; // dentro de su catálogo → forma canónica
  }
  for (const otra in CATALOGOS_DASHBOARD) {
    if (otra !== dim && CATALOGOS_DASHBOARD[otra].some((c) => normalizarTexto(c) === normalizarTexto(v))) return null;
  }
  return propio ? 'Otros' : v.trim(); // cerrada sin match → "Otros"; abierta (mes) → conserva
}

/** Formatea un monto en pesos colombianos (COP), sin decimales: "$ 85.000". */
export function formatCOP(valor: number | null | undefined): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num(valor));
}

/** Diferencia en días enteros entre dos fechas YYYY-MM-DD (b - a). */
function diasEntre(aISO: string, bISO: string): number {
  const a = new Date(aISO + 'T00:00:00Z').getTime();
  const b = new Date(bISO + 'T00:00:00Z').getTime();
  if (isNaN(a) || isNaN(b)) return NaN;
  return Math.round((b - a) / 86400000);
}

/** Días de antelación con que se avisa un mantenimiento programado por fecha. */
export const DIAS_AVISO_MANTENIMIENTO = 7;

/** Horas acumuladas de la impresora en su ÚLTIMO mantenimiento (de cualquier tipo).
 *  Como las horas solo aumentan, es el mayor `horasBase` registrado. Es el punto
 *  desde el que se cuenta el tiempo hasta el próximo mantenimiento, de modo que
 *  registrar CUALQUIER mantenimiento reinicia ese contador. */
export function horasAlUltimoMantenimiento(impresoraId: string, mantenimientos: Mantenimiento[]): number {
  const bases = mantenimientos.filter((m) => m.impresoraId === impresoraId).map((m) => Number(m.horasBase) || 0);
  return bases.length ? Math.max(0, ...bases) : 0;
}

/** Alertas de mantenimiento por impresora, derivadas de la PROGRAMACIÓN del último
 *  mantenimiento de cada equipo (una fecha específica o cada N horas acumuladas).
 *  - 'horas': avisa cuando las horas desde el último mantenimiento (de cualquier tipo)
 *    alcanzan el intervalo (vencido) o están dentro del 10% (próximo).
 *  - 'fecha': avisa cuando la fecha programada ya pasó (vencido) o falta poco (próximo). */
export function calcularAlertasMantenimiento(
  impresoras: Impresora[], mantenimientos: Mantenimiento[], hoyStr: string,
): AlertaMantenimiento[] {
  const out: AlertaMantenimiento[] = [];
  for (const imp of impresoras) {
    // Último mantenimiento de esta impresora con una programación activa.
    const ult = mantenimientos
      .filter((m) => m.impresoraId === imp.id && m.programacion && m.programacion !== 'ninguna')
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
    if (!ult) continue;

    if (ult.programacion === 'horas' && ult.cadaHoras && ult.cadaHoras > 0) {
      // El contador se mide desde el último mantenimiento de CUALQUIER tipo, así que
      // hacer un mantenimiento (aunque no reprograme) reinicia las horas.
      const base = horasAlUltimoMantenimiento(imp.id, mantenimientos);
      const desde = Math.max(0, Math.round((imp.horasAcumuladas - base) * 10) / 10);
      if (desde >= ult.cadaHoras) {
        out.push({ impresoraId: imp.id, nombre: imp.nombre, motivo: 'horas', estado: 'vencido', horasAcumuladas: imp.horasAcumuladas, horasDesde: desde, cadaHoras: ult.cadaHoras });
      } else if (desde >= ult.cadaHoras * (1 - MARGEN_PROXIMIDAD_UMBRAL)) {
        out.push({ impresoraId: imp.id, nombre: imp.nombre, motivo: 'horas', estado: 'proximo', horasAcumuladas: imp.horasAcumuladas, horasDesde: desde, cadaHoras: ult.cadaHoras });
      }
    } else if (ult.programacion === 'fecha' && ult.proximaFecha) {
      const dias = diasEntre(hoyStr, ult.proximaFecha);
      if (!isNaN(dias)) {
        if (dias <= 0) {
          out.push({ impresoraId: imp.id, nombre: imp.nombre, motivo: 'fecha', estado: 'vencido', horasAcumuladas: imp.horasAcumuladas, proximaFecha: ult.proximaFecha });
        } else if (dias <= DIAS_AVISO_MANTENIMIENTO) {
          out.push({ impresoraId: imp.id, nombre: imp.nombre, motivo: 'fecha', estado: 'proximo', horasAcumuladas: imp.horasAcumuladas, proximaFecha: ult.proximaFecha });
        }
      }
    }
  }
  return out;
}

/** Genera el código de proyecto IMP-DDMMAA-NN a partir de los códigos existentes.
 *  La fecha DDMMAA se toma en hora de Colombia (UTC-5), no en la del servidor, para
 *  que el consecutivo del día no se reinicie ni se adelante cerca de la medianoche. */
export function generarCodigoProyecto(codigosExistentes: string[]): string {
  const d = ahoraColombia();
  // Fecha en formato DDMMAA (día, mes, año de 2 dígitos).
  const fecha = `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCFullYear()).slice(2)}`;
  const prefijo = `IMP-${fecha}-`;
  const delDia = codigosExistentes.filter((c) => c.startsWith(prefijo));
  let max = 0;
  for (const c of delDia) {
    const n = parseInt(c.slice(prefijo.length), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `${prefijo}${String(max + 1).padStart(2, '0')}`;
}
