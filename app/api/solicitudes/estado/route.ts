import { NextRequest, NextResponse } from 'next/server';
import { cambiarEstadoSolicitud } from '@/lib/datastore';
import { EstadoSolicitud } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ESTADOS_VALIDOS: EstadoSolicitud[] = ['Nueva', 'En Revisión', 'Aprobada', 'Rechazada', 'Atendida'];

export async function PATCH(req: NextRequest) {
  try {
    const { id, fila, estado } = (await req.json()) as { id: string; fila: number; estado: EstadoSolicitud };
    if (!id || !ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    await cambiarEstadoSolicitud(id, fila, estado);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
