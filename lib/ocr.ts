// Análisis OCR (visión artificial pura) de capturas de pantalla del slicer.
//
// NO realiza ninguna consulta a IA externa: usa Tesseract.js localmente para
// reconocer el texto de la imagen y luego extrae con expresiones regulares el
// peso (g), el tiempo de impresión y el tipo de material. Así se evita consumir
// cuotas/recursos de servicios de IA.
//
// Formatos cubiertos (ver capturas de ejemplo del repo): Bambu Studio (panel
// "Slicing Result", diálogos "Send print job" y "Printing Progress"),
// Cura (diálogo "Save to Disk" y "Time/Material estimation") y PrusaSlicer.
//
// El OCR sobre fuentes de UI pequeñas pierde a veces el punto decimal o lee mal
// la unidad "g". Por eso la extracción es CONSERVADORA: prioriza las líneas de
// resumen fiables y, ante ambigüedad, prefiere devolver null (campo "no
// identificado" para completar a mano) antes que un dato incorrecto.

import { createWorker, PSM } from 'tesseract.js';
import Jimp from 'jimp';
import { AnalisisSlicerResultado } from './types';

// Materiales conocidos. Los compuestos van primero para que, por ejemplo,
// "PLA-CF" se reconozca antes que "PLA".
const MATERIALES_CONOCIDOS = [
  'PETG-CF', 'PLA-CF', 'PA-CF', 'PET-CF', 'PLA+',
  'PETG', 'PET-G', 'ABS', 'ASA', 'TPU', 'PVA', 'HIPS',
  'NYLON', 'PA', 'PC', 'PP', 'PLA', 'RESINA', 'RESIN',
];

// Peso máximo plausible (g) para una sola impresión. Por encima de esto el valor
// casi siempre es ruido de OCR por pérdida del punto decimal (p. ej. "12076").
const PESO_MAX_PLAUSIBLE = 2000;

/** Normaliza el material reconocido a una etiqueta limpia */
function normalizarMaterial(token: string): string {
  const t = token.toUpperCase().replace(/\s+/g, '');
  if (t === 'RESIN' || t === 'RESINA') return 'Resina';
  if (t === 'PET-G') return 'PETG';
  if (t === 'NYLON') return 'Nylon';
  return t;
}

function extraerMaterial(texto: string): string | null {
  for (const m of MATERIALES_CONOCIDOS) {
    const escapado = m.replace('+', '\\+');
    // Delimitado para no capturar coincidencias dentro de otra palabra
    const re = new RegExp(`(?<![A-Z0-9])${escapado}(?![A-Z])`, 'i');
    if (re.test(texto)) return normalizarMaterial(m);
  }
  return null;
}

// Patrones de duración usados tanto para leer el tiempo como para "borrarlo" de
// la línea de resumen y dejar a la vista el número del peso.
const PATRONES_TIEMPO: RegExp[] = [
  /(\d+)\s*h\s*(\d+)\s*m(?:in)?\s*(\d+)\s*s/gi, // 3h44min9s
  /(\d+)\s*h\s*(\d+)\s*m(?:in)?/gi,             // 3h44m / 3h44min
  /(\d+)\s*h(?![a-z0-9])/gi,                    // 3h
  /(\d+)\s*(?:hour|hora)s?(?:\s*(\d+)\s*(?:min|minute|minuto)s?)?/gi, // 1 hour 6 minutes
  /(\d+)\s*(?:min|minute|minuto)s?/gi,          // 45 min
];

/** Normaliza un número crudo leído por OCR a un valor en gramos plausible,
 *  recuperando el punto decimal que el OCR pierde con fuentes pequeñas:
 *   - "120.769" (la "g" se leyó como dígito) → 120.76 (se descarta el 3.º decimal)
 *   - "12076" (sin decimal, valor enorme)    → 120.76 (se reinserta el decimal)
 *   - "11"                                    → 11   (entero pequeño, se respeta) */
function normalizarGramos(raw: string): number | null {
  const limpio = raw.replace(',', '.').replace(/[^\d.]/g, '');
  if (!limpio || limpio === '.') return null;

  let v: number;
  if (limpio.includes('.')) {
    const [ent, dec = ''] = limpio.split('.');
    const decFix = dec.length >= 3 ? dec.slice(0, 2) : dec; // los slicers usan 2 decimales
    v = parseFloat(`${ent || '0'}.${decFix || '0'}`);
  } else {
    v = parseInt(limpio, 10);
    // Un entero enorme (≥4 dígitos) casi siempre es un decimal perdido: "12076" → 120.76
    if (v > PESO_MAX_PLAUSIBLE && limpio.length >= 4) v = v / 100;
  }
  if (isNaN(v) || v <= 0 || v > PESO_MAX_PLAUSIBLE) return null;
  return Math.round(v * 100) / 100;
}

/** Dada una lista de tokens numéricos de una línea, devuelve el que mejor
 *  representa el peso: prefiere los DECIMALES (el más a la derecha, que es donde
 *  va el peso tras los metros); si no hay decimales, recupera un entero largo. */
function pesoDeTokens(tokens: string[]): number | null {
  const decimales = tokens.filter((t) => /[.,]/.test(t));
  if (decimales.length > 0) {
    return normalizarGramos(decimales[decimales.length - 1]);
  }
  const enteros = tokens.filter((t) => t.replace(/\D/g, '').length >= 4);
  if (enteros.length > 0) {
    return normalizarGramos(enteros[enteros.length - 1]);
  }
  return null;
}

const RE_NUMERO = /\d+(?:[.,]\d+)?/g;

/** Extrae el valor en gramos de UNA línea que contiene una "g" explícita
 *  (formato de Cura: "PLA 3.82m 11.4g" / "11g · 3.82m"), tolerando lecturas
 *  erróneas de la unidad ("¢g") y el decimal-como-espacio ("11 4g"). */
function gramoDeLinea(linea: string): number | null {
  const norm = linea.replace(/(\d+)\s+(\d{1,2})\s*g\b/gi, '$1.$2g');
  const re = /(\d+(?:[.,]\d+)?)\s*[¢qG]?\s*g\b/gi;
  const valores: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    const v = normalizarGramos(m[1]);
    if (v != null) valores.push(v);
  }
  return valores.length > 0 ? Math.max(...valores) : null;
}

/** Devuelve el peso total de filamento priorizando las líneas más fiables. */
function extraerPeso(texto: string): number | null {
  const lineas = texto.split('\n');

  // 1) Bambu: línea "Total Filament" / "Model Filament" (la fuente más fiable).
  //    El peso es el número de más a la derecha (tras la longitud en metros).
  for (const l of lineas) {
    if (/(total|model)\s*filament/i.test(l)) {
      const g = pesoDeTokens(l.match(RE_NUMERO) ?? []);
      if (g != null) return g;
    }
  }
  // 2) Diálogos de resumen (Bambu "Send print job"/"Printing Progress"): el peso
  //    va en la misma línea que el tiempo. Se "borra" el tiempo y los números de
  //    capa/fecha pequeños quedan descartados por pesoDeTokens.
  for (const l of lineas) {
    if (!tieneTiempo(l)) continue;
    let sinTiempo = l;
    for (const re of PATRONES_TIEMPO) sinTiempo = sinTiempo.replace(re, ' ');
    const g = pesoDeTokens(sinTiempo.match(RE_NUMERO) ?? []);
    if (g != null) return g;
  }
  // 3) Cura: línea con metros y gramos ("PLA 3.82m 11.4g" / "11g · 3.82m").
  for (const l of lineas) {
    if (/\d\s*m\b/i.test(l)) {
      const g = gramoDeLinea(l);
      if (g != null) return g;
    }
  }
  return null;
}

/** ¿La línea contiene una duración con horas/minutos al estilo del slicer? */
function tieneTiempo(linea: string): boolean {
  return /(\d+\s*h\s*\d+\s*m)|(\d+\s*h(?![a-z0-9]))|(\d+\s*(?:hour|hora))/i.test(linea);
}

/** Reconoce duraciones en los formatos del slicer y devuelve la mayor (el
 *  tiempo total siempre es ≥ que cualquier sub-tiempo o tiempo restante). */
function extraerTiempo(texto: string): { texto: string; horas: number } | null {
  const cands: { texto: string; horas: number }[] = [];
  const push = (txt: string, h: number, min = 0, s = 0) =>
    cands.push({ texto: txt.trim(), horas: h + min / 60 + s / 3600 });

  let m: RegExpExecArray | null;

  // 3h44min9s / 3h44m9s
  const re1 = /(\d+)\s*h\s*(\d+)\s*m(?:in)?\s*(\d+)\s*s/gi;
  while ((m = re1.exec(texto)) !== null) push(m[0], +m[1], +m[2], +m[3]);

  // 3h44m / 3h44min  (sin segundos a continuación)
  const re2 = /(\d+)\s*h\s*(\d+)\s*m(?:in)?(?!\s*\d*\s*s)/gi;
  while ((m = re2.exec(texto)) !== null) push(m[0], +m[1], +m[2]);

  // 3h (solo horas)
  const re3 = /(\d+)\s*h(?![a-z0-9])/gi;
  while ((m = re3.exec(texto)) !== null) push(m[0], +m[1]);

  // "1 hour 6 minutes" / "1 hora 6 minutos"
  const re4 = /(\d+)\s*(?:hour|hora)s?(?:\s*(\d+)\s*(?:min|minute|minuto)s?)?/gi;
  while ((m = re4.exec(texto)) !== null) push(m[0], +m[1], m[2] ? +m[2] : 0);

  // "45 min" / "45 minutes" (sin horas previas)
  const re5 = /(?<![h\d])(\d+)\s*(?:min|minute|minuto)s?\b/gi;
  while ((m = re5.exec(texto)) !== null) push(m[0], 0, +m[1]);

  if (cands.length === 0) return null;
  const mejor = cands.reduce((a, b) => (b.horas > a.horas ? b : a));
  return { texto: mejor.texto, horas: Math.round(mejor.horas * 100) / 100 };
}

/** Invierte la imagen si el fondo es oscuro (tema oscuro de Bambu) para dejar
 *  texto oscuro sobre fondo claro, que es lo que mejor lee el OCR. */
function invertirSiOscuro(img: Jimp): void {
  const d = img.bitmap.data;
  let suma = 0;
  for (let i = 0; i < d.length; i += 4) suma += d[i];
  if (suma / (d.length / 4) < 128) img.invert();
}

// Distintos paneles del slicer rinden mejor con distinto preprocesado: los
// paneles densos de tema oscuro (Bambu "Slicing Result") prefieren un escalado
// suave; los diálogos claros de fuente pequeña ("Send print job", Cura) un
// escalado mayor con más contraste. Se hace OCR con AMBAS variantes y se
// combinan los textos, lo que cubre todos los formatos de ejemplo.

/** Variante suave: x2, gris, inversión condicional, contraste leve. */
async function preprocesarSuave(buffer: Buffer): Promise<Buffer> {
  try {
    const img = await Jimp.read(buffer);
    img.scale(2).greyscale();
    invertirSiOscuro(img);
    img.contrast(0.3).normalize();
    return await img.getBufferAsync(Jimp.MIME_PNG);
  } catch {
    return buffer;
  }
}

/** Variante fuerte: amplía hasta ~2000px (la UI usa fuentes pequeñas), gris,
 *  inversión condicional, normaliza y realza el contraste. */
async function preprocesarFuerte(buffer: Buffer): Promise<Buffer> {
  try {
    const img = await Jimp.read(buffer);
    const factor = Math.min(4, Math.max(2, Math.ceil(2000 / img.bitmap.width)));
    img.scale(factor).greyscale();
    invertirSiOscuro(img);
    img.normalize().contrast(0.5);
    return await img.getBufferAsync(Jimp.MIME_PNG);
  } catch {
    return buffer;
  }
}

function construirResultado(
  archivo: string,
  pesoGramos: number | null,
  tiempo: { texto: string; horas: number } | null,
  material: string | null,
): AnalisisSlicerResultado {
  const faltantes: string[] = [];
  if (pesoGramos == null) faltantes.push('peso_gramos');
  if (!tiempo) faltantes.push('tiempo');
  if (!material) faltantes.push('material');

  return {
    archivo,
    pesoGramos,
    tiempoHoras: tiempo ? tiempo.horas : null,
    tiempoTexto: tiempo ? tiempo.texto : null,
    material,
    camposNoIdentificados: faltantes,
    notas: faltantes.length === 0
      ? 'Datos extraídos por OCR (sin IA).'
      : 'OCR completado; complete manualmente los campos no identificados. Suba una captura nítida y completa del panel del slicer.',
  };
}

/** Analiza una o varias capturas. El worker principal (modo AUTO) se reutiliza
 *  entre imágenes para no reinicializar el motor. La pasada de "texto disperso"
 *  para el material usa un worker APARTE creado bajo demanda: alternar el PSM en
 *  el worker principal degrada el OCR de las imágenes siguientes del lote. */
export async function analizarCapturas(
  archivos: { nombre: string; buffer: Buffer }[],
): Promise<AnalisisSlicerResultado[]> {
  const worker = await createWorker('eng');
  let workerDisperso: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    const resultados: AnalisisSlicerResultado[] = [];
    for (const a of archivos) {
      try {
        const imgSuave = await preprocesarSuave(a.buffer);
        const imgFuerte = await preprocesarFuerte(a.buffer);

        const textoSuave = (await worker.recognize(imgSuave)).data.text ?? '';
        const textoFuerte = (await worker.recognize(imgFuerte)).data.text ?? '';
        const texto = `${textoSuave}\n${textoFuerte}`;

        const pesoGramos = extraerPeso(texto);
        const tiempo = extraerTiempo(texto);
        let material = extraerMaterial(texto);

        // Si el material no se vio, una pasada en modo "texto disperso" lee mejor
        // etiquetas sueltas dentro de cuadros de color (p. ej. "PETG").
        if (!material) {
          if (!workerDisperso) {
            workerDisperso = await createWorker('eng');
            await workerDisperso.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
          }
          const textoDisperso = (await workerDisperso.recognize(imgFuerte)).data.text ?? '';
          material = extraerMaterial(textoDisperso);
        }

        resultados.push(construirResultado(a.nombre, pesoGramos, tiempo, material));
      } catch {
        resultados.push({
          archivo: a.nombre,
          pesoGramos: null, tiempoHoras: null, tiempoTexto: null, material: null,
          camposNoIdentificados: ['peso_gramos', 'tiempo', 'material'],
          notas: 'No se pudo procesar esta imagen con OCR. Verifique que sea una captura válida.',
        });
      }
    }
    return resultados;
  } finally {
    await worker.terminate();
    if (workerDisperso) await workerDisperso.terminate();
  }
}
