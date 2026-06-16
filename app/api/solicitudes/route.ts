import { NextRequest, NextResponse } from 'next/server';
import { getSolicitudes } from '@/lib/datastore';
import { enviarAlForm, formConfigurado, NuevaSolicitud } from '@/lib/google/forms';
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

/** Crea una solicitud nueva enviándola al Google Form real (o al almacén demo). */
export async function POST(req: NextRequest) {
  try {
    const datos = (await req.json()) as NuevaSolicitud;
    if (!datos.nombre?.trim() || !datos.contacto?.trim()) {
      return NextResponse.json({ error: 'Nombre y correo/contacto son obligatorios' }, { status: 400 });
    }
    if (esModoDemo() || !formConfigurado()) {
      await crearSolicitudDemo({ ...datos, descripcionPieza: datos.descripcionPieza });
      return NextResponse.json({ ok: true, demo: true, mensaje: 'Solicitud creada en modo demo (configure FORM_URL para enviarla al Google Form real).' });
    }
    await enviarAlForm(datos);
    return NextResponse.json({ ok: true, demo: false, mensaje: 'Solicitud enviada al formulario. Aparecerá en la tabla al actualizarse la hoja (unos segundos).' });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
