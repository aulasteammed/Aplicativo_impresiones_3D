import { NextRequest, NextResponse } from 'next/server';
import { analizarCaptura, geminiConfigurado } from '@/lib/gemini';
import { AnalisisSlicerResultado } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB por imagen

/** Recibe capturas del slicer (multipart/form-data, campo "imagenes")
 *  y devuelve los parámetros extraídos por Gemini por cada imagen. */
export async function POST(req: NextRequest) {
  try {
    if (!geminiConfigurado()) {
      return NextResponse.json(
        { error: 'El análisis con IA no está configurado: agregue GEMINI_API_KEY en .env.local (gratis en aistudio.google.com).' },
        { status: 503 },
      );
    }
    const form = await req.formData();
    const archivos = form.getAll('imagenes').filter((f): f is File => f instanceof File);
    if (archivos.length === 0) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 });
    }
    if (archivos.length > 6) {
      return NextResponse.json({ error: 'Máximo 6 capturas por análisis' }, { status: 400 });
    }

    const resultados: AnalisisSlicerResultado[] = await Promise.all(
      archivos.map(async (archivo) => {
        if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
          return {
            archivo: archivo.name, pesoGramos: null, tiempoHoras: null, tiempoTexto: null, material: null,
            camposNoIdentificados: ['peso_gramos', 'tiempo', 'material'],
            notas: `Formato no soportado (${archivo.type}). Use PNG o JPG.`,
          };
        }
        if (archivo.size > MAX_BYTES) {
          return {
            archivo: archivo.name, pesoGramos: null, tiempoHoras: null, tiempoTexto: null, material: null,
            camposNoIdentificados: ['peso_gramos', 'tiempo', 'material'],
            notas: 'La imagen supera 8 MB; redúzcala e intente de nuevo.',
          };
        }
        const base64 = Buffer.from(await archivo.arrayBuffer()).toString('base64');
        return analizarCaptura(archivo.name, archivo.type, base64);
      }),
    );

    return NextResponse.json({ resultados });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
