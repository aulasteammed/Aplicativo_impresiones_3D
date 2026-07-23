import { NextRequest, NextResponse } from 'next/server';
import { agregarItemsProyecto, cambiarEstadoProyecto, editarProyecto, eliminarProyecto, finalizarProyecto } from '@/lib/datastore';
import { EstadoProyecto, ItemProyecto, ResultadoImpresion } from '@/lib/types';

export const dynamic = 'force-dynamic';

function itemsValidos(items: ItemProyecto[]): string | null {
  for (const it of items) {
    if (!it.solicitudId || !it.material || !(it.gramos > 0) || !(it.tiempoHoras > 0)) {
      return 'Cada solicitud debe tener tiempo (h), gramos y tipo de material';
    }
  }
  return null;
}

/** PATCH: editar la cama completa, añadir solicitudes o cambiar estado (Activa/En pausa) */
export async function PATCH(req: NextRequest, { params }: { params: { codigo: string } }) {
  try {
    const codigo = decodeURIComponent(params.codigo);
    const body = (await req.json()) as {
      items?: ItemProyecto[]; estado?: EstadoProyecto; editar?: boolean; nuevoCodigo?: string; impresora?: string;
    };

    // Edición COMPLETA (reemplaza código, impresora e ítems)
    if (body.editar) {
      if (!body.nuevoCodigo?.trim()) return NextResponse.json({ error: 'Ingrese un código para la cama' }, { status: 400 });
      if (!body.impresora?.trim()) return NextResponse.json({ error: 'Seleccione una impresora' }, { status: 400 });
      if (!body.items?.length) return NextResponse.json({ error: 'La cama debe tener al menos una solicitud' }, { status: 400 });
      const err = itemsValidos(body.items);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      const codigoFinal = await editarProyecto(codigo, body.nuevoCodigo, body.impresora, body.items);
      return NextResponse.json({ ok: true, codigo: codigoFinal });
    }

    if (body.items?.length) {
      const err = itemsValidos(body.items);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
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
    const { resultado, desperdicio, desperdicioPorPieza, comentarios } = (await req.json()) as {
      resultado: ResultadoImpresion; desperdicio?: number | null; desperdicioPorPieza?: Record<string, number>; comentarios?: string;
    };
    if (!['Exitoso', 'Fallido'].includes(resultado)) {
      return NextResponse.json({ error: 'El resultado debe ser "Exitoso" o "Fallido"' }, { status: 400 });
    }
    const { advertencias } = await finalizarProyecto(
      codigo,
      resultado,
      desperdicio === undefined || desperdicio === null || isNaN(Number(desperdicio)) ? null : Number(desperdicio),
      comentarios ?? '',
      desperdicioPorPieza && typeof desperdicioPorPieza === 'object' ? desperdicioPorPieza : undefined,
    );
    return NextResponse.json({ ok: true, advertencias });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** DELETE: eliminar la cama (borra todas sus filas del historial) */
export async function DELETE(_req: NextRequest, { params }: { params: { codigo: string } }) {
  try {
    await eliminarProyecto(decodeURIComponent(params.codigo));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
