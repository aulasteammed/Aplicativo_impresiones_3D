import { NextRequest, NextResponse } from 'next/server';
import { construirAsunto, construirHtmlEstado, correoConfigurado, DatosCorreoEstado, enviarCorreo } from '@/lib/email';

export const dynamic = 'force-dynamic';

/** Envía la notificación de cambio de estado al solicitante.
 *  Con { soloVista: true } devuelve el HTML sin enviar (vista previa). */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DatosCorreoEstado & { soloVista?: boolean };
    if (!body.destinatario && !body.soloVista) {
      return NextResponse.json({ error: 'La solicitud no tiene un correo electrónico asociado' }, { status: 400 });
    }
    if (!body.firmaNombre?.trim() || !body.firmaRol?.trim()) {
      return NextResponse.json({ error: 'Debe ingresar su nombre y rol para la firma del correo' }, { status: 400 });
    }
    const html = construirHtmlEstado(body);
    if (body.soloVista) {
      return NextResponse.json({ ok: true, html });
    }
    const { demo } = await enviarCorreo(body.destinatario, construirAsunto(body.estadoNuevo), html);
    return NextResponse.json({
      ok: true,
      demo,
      mensaje: demo
        ? 'Correo NO enviado: falta configurar APPS_SCRIPT_URL y APPS_SCRIPT_TOKEN en .env.local. El cambio de estado sí se aplicó.'
        : `Correo enviado a ${body.destinatario}.`,
      configurado: correoConfigurado(),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
