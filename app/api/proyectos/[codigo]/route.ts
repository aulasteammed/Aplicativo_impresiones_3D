import { NextRequest, NextResponse } from 'next/server';
import { agregarItemsProyecto, cambiarEstadoProyecto, finalizarProyecto } from '@/lib/datastore';
import { EstadoProyecto, ItemProyecto, ResultadoImpresion } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** PATCH: editar proyecto — añadir solicitudes o cambiar estado (Activa/En pausa) */
export async function PATCH(req: NextRequest, { params }: { params: { codigo: string } }) {
  try {
    const codigo = decodeURIComponent(params.codigo);
    const body = (await req.json()) as { items?: ItemProyecto[]; estado?: EstadoProyecto };
    if (body.items?.length) {
      for (const it of body.items) {
        if (!it.solicitudId || !it.material || !(it.gramos > 0) || !(it.tiempoHoras > 0)) {
          return NextResponse.json(
            { error: 'Cada solicitud añadida debe tener tiempo (h), gramos y tipo de material' },
            { status: 400 },
          );
        }
      }
      await agregarItemsProyecto(codigo, body.items);
    }
    if (body.estado && ['Activa', 'En pausa'].includes(body.estado)) {
      await cambiarEstadoProyecto(codigo, body.estado);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** POST: finalizar el proyecto */
export async function POST(req: NextRequest, { params }: { params: { codigo: string } }) {
  try {
    const codigo = decodeURIComponent(params.codigo);
    const { resultado, desperdicio, comentarios } = (await req.json()) as {
      resultado: ResultadoImpresion; desperdicio?: number | null; comentarios?: string;
    };
    if (!['Exitoso', 'Fallido'].includes(resultado)) {
      return NextResponse.json({ error: 'El resultado debe ser "Exitoso" o "Fallido"' }, { status: 400 });
    }
    const { advertencias } = await finalizarProyecto(
      codigo,
      resultado,
      desperdicio === undefined || desperdicio === null || isNaN(Number(desperdicio)) ? null : Number(desperdicio),
      comentarios ?? '',
    );
    return NextResponse.json({ ok: true, advertencias });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
