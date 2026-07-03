import { NextRequest, NextResponse } from 'next/server';
import { getSolicitudes } from '@/lib/datastore';
import { NuevaSolicitud } from '@/lib/google/forms';
import { crearSolicitudEnHoja } from '@/lib/google/sheets';
import { esModoDemo } from '@/lib/config';
import { crearSolicitudDemo } from '@/lib/demo';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ solicitudes: await getSolicitudes(), esDemo: esModoDemo() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Crea una solicitud nueva escribiéndola directamente en la hoja de respuestas
 *  (o en el almacén demo). No se usa el Google Form porque su pregunta de subida
 *  de archivos obliga a iniciar sesión y rechaza el envío anónimo (HTTP 401). */
export async function POST(req: NextRequest) {
  try {
    const datos = (await req.json()) as NuevaSolicitud;
    if (!datos.nombre?.trim() || !datos.correo?.trim()) {
      return NextResponse.json({ error: 'Nombre y correo electrónico son obligatorios' }, { status: 400 });
    }
    if (esModoDemo()) {
      await crearSolicitudDemo({ ...datos });
      return NextResponse.json({ ok: true, demo: true, mensaje: 'Solicitud creada en modo demo (configure las credenciales y los SHEET_ID_* para guardarla en la hoja real).' });
    }
    await crearSolicitudEnHoja(datos);
    return NextResponse.json({ ok: true, demo: false, mensaje: 'Solicitud registrada en la hoja. Aparecerá en la tabla en unos segundos.' });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
