import { NextRequest, NextResponse } from 'next/server';
import { actualizarFilamento, calcularAlertas, crearFilamento, getFilamentos } from '@/lib/datastore';
import { Filamento } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filamentos = await getFilamentos();
    return NextResponse.json({ filamentos, alertas: calcularAlertas(filamentos) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const datos = (await req.json()) as Omit<Filamento, 'id'>;
    if (!datos.tipo || !datos.color) {
      return NextResponse.json({ error: 'Tipo y color son obligatorios' }, { status: 400 });
    }
    // Rollo nuevo = 1 kg por rollo; comenzado = gramos aproximados indicados
    const gramos = datos.comenzado ? Number(datos.gramosRestantes) || 0 : (Number(datos.rollos) || 1) * 1000;
    const nuevo = await crearFilamento({ ...datos, gramosRestantes: gramos });
    return NextResponse.json({ ok: true, filamento: nuevo });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const datos = (await req.json()) as Filamento;
    if (!datos.id) return NextResponse.json({ error: 'Falta el ID del filamento' }, { status: 400 });
    await actualizarFilamento(datos);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
