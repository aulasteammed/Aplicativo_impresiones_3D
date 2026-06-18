import { NextRequest, NextResponse } from 'next/server';
import { analizarCapturas } from '@/lib/ocr';
import { AnalisisSlicerResultado } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // OCR local: hasta 3 pasadas por imagen

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB por imagen

/** Recibe capturas del slicer (multipart/form-data, campo "imagenes") y
 *  devuelve los parámetros extraídos por OCR local (sin IA) de cada imagen. */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const archivos = form.getAll('imagenes').filter((f): f is File => f instanceof File);
    if (archivos.length === 0) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 });
    }
    if (archivos.length > 6) {
      return NextResponse.json({ error: 'Máximo 6 capturas por análisis' }, { status: 400 });
    }

    const invalidos: AnalisisSlicerResultado[] = [];
    const validos: { nombre: string; buffer: Buffer }[] = [];

    for (const archivo of archivos) {
      if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
        invalidos.push({
          archivo: archivo.name, pesoGramos: null, tiempoHoras: null, tiempoTexto: null, material: null,
          camposNoIdentificados: ['peso_gramos', 'tiempo', 'material'],
          notas: `Formato no soportado (${archivo.type}). Use PNG o JPG.`,
        });
        continue;
      }
      if (archivo.size > MAX_BYTES) {
        invalidos.push({
          archivo: archivo.name, pesoGramos: null, tiempoHoras: null, tiempoTexto: null, material: null,
          camposNoIdentificados: ['peso_gramos', 'tiempo', 'material'],
          notas: 'La imagen supera 8 MB; redúzcala e intente de nuevo.',
        });
        continue;
      }
      validos.push({ nombre: archivo.name, buffer: Buffer.from(await archivo.arrayBuffer()) });
    }

    const analizados = validos.length > 0 ? await analizarCapturas(validos) : [];
    return NextResponse.json({ resultados: [...analizados, ...invalidos] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
