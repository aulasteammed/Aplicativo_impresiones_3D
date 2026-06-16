// Análisis con IA (Google Gemini) de capturas de pantalla del slicer:
// extrae peso (g), tiempo de impresión y tipo de material, e informa
// explícitamente qué campos no pudo identificar.

import { GoogleGenAI } from '@google/genai';
import { config } from './config';
import { AnalisisSlicerResultado } from './types';
import { parsearHoras } from './util';

const PROMPT = `Eres un asistente del Aula STEAM que analiza capturas de pantalla de programas slicer de impresión 3D (Bambu Studio, Cura, PrusaSlicer, Orca, etc., en inglés o español).

De la imagen extrae ÚNICAMENTE estos datos si son visibles:
1. peso_gramos: el peso TOTAL de filamento a usar, en gramos (ej: "120.76 g"). Si hay varios valores, usa el total ("Total Filament").
2. tiempo_texto: el tiempo TOTAL de impresión tal como aparece (ej: "3h44m", "3h11m", "39:53"). Usa el "Total time" si existe.
3. material: el tipo de filamento (PLA, PETG, ABS, TPU, etc.).

Reglas:
- Si un dato NO es visible o no estás seguro, devuélvelo como null y añade su nombre a campos_no_identificados.
- NO inventes valores. Es mejor null que un dato incorrecto.
- En "notas" describe brevemente qué pantalla es (ej: "Resultado de slicing de Bambu Studio") y cualquier ambigüedad.`;

const SCHEMA = {
  type: 'object',
  properties: {
    peso_gramos: { type: 'number', nullable: true },
    tiempo_texto: { type: 'string', nullable: true },
    material: { type: 'string', nullable: true },
    campos_no_identificados: { type: 'array', items: { type: 'string' } },
    notas: { type: 'string' },
  },
  required: ['campos_no_identificados', 'notas'],
} as const;

export function geminiConfigurado(): boolean {
  return !!config.geminiApiKey;
}

export async function analizarCaptura(
  nombreArchivo: string,
  mimeType: string,
  base64: string,
): Promise<AnalisisSlicerResultado> {
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const res = await ai.models.generateContent({
    model: config.geminiModel,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: SCHEMA as unknown as Record<string, unknown>,
    },
  });

  let parsed: {
    peso_gramos?: number | null;
    tiempo_texto?: string | null;
    material?: string | null;
    campos_no_identificados?: string[];
    notas?: string;
  } = { campos_no_identificados: [], notas: '' };

  try {
    parsed = JSON.parse(res.text ?? '{}');
  } catch {
    return {
      archivo: nombreArchivo,
      pesoGramos: null,
      tiempoHoras: null,
      tiempoTexto: null,
      material: null,
      camposNoIdentificados: ['peso_gramos', 'tiempo_texto', 'material'],
      notas: 'La IA no devolvió una respuesta válida para esta imagen.',
    };
  }

  const tiempoTexto = parsed.tiempo_texto ?? null;
  const tiempoHoras = tiempoTexto ? Math.round(parsearHoras(tiempoTexto) * 100) / 100 : null;
  const faltantes = new Set(parsed.campos_no_identificados ?? []);
  if (parsed.peso_gramos == null) faltantes.add('peso_gramos');
  if (!tiempoTexto) faltantes.add('tiempo');
  if (!parsed.material) faltantes.add('material');

  return {
    archivo: nombreArchivo,
    pesoGramos: parsed.peso_gramos ?? null,
    tiempoHoras,
    tiempoTexto,
    material: parsed.material ?? null,
    camposNoIdentificados: Array.from(faltantes),
    notas: parsed.notas ?? '',
  };
}
