import { NextRequest, NextResponse } from 'next/server';
import { actualizarImpresora, crearImpresora, eliminarImpresora, getImpresoras } from '@/lib/datastore';
import { Impresora } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ impresoras: await getImpresoras() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const datos = (await req.json()) as Omit<Impresora, 'id'>;
    if (!datos.nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    const nueva = await crearImpresora({ ...datos, horasAcumuladas: Number(datos.horasAcumuladas) || 0 });
    return NextResponse.json({ ok: true, impresora: nueva });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const datos = (await req.json()) as Impresora;
    if (!datos.id) return NextResponse.json({ error: 'Falta el ID de la impresora' }, { status: 400 });
    await actualizarImpresora(datos);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let id: string | null = new URL(req.url).searchParams.get('id');
    if (id == null) { try { id = (await req.json()).id; } catch { /* sin cuerpo */ } }
    if (!id) return NextResponse.json({ error: 'Falta el ID de la impresora' }, { status: 400 });
    await eliminarImpresora(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
