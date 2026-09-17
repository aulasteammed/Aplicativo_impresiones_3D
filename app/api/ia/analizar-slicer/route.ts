import { NextRequest, NextResponse } from 'next/server';
import { analizarCapturas } from '@/lib/ocr';
import { AnalisisSlicerResultado } from '@/lib/types';

export const dynamic = 'force-dynamic';
// 60s: el máximo permitido por el plan gratuito (Hobby) de Vercel. Con varias
// capturas grandes (hasta MAX_ARCHIVOS, con hasta 3 pasadas de OCR cada una) el
// análisis puede acercarse a este límite; si se necesita más margen hay que
// subir a un plan de pago (Pro permite hasta 300s) o bajar MAX_ARCHIVOS.
export const maxDuration = 60;

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB por imagen
const MAX_ARCHIVOS = 6;

/** Recibe capturas del slicer (multipart/form-data, campo "imagenes") y
 *  devuelve los parámetros extraídos por OCR local (sin IA) de cada imagen. */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const archivos = form.getAll('imagenes').filter((f): f is File => f instanceof File);
    if (archivos.length === 0) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 });
    }
    if (archivos.length > MAX_ARCHIVOS) {
      return NextResponse.json({ error: `Máximo ${MAX_ARCHIVOS} capturas por análisis` }, { status: 400 });
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
