import { NextRequest, NextResponse } from 'next/server';
import { actualizarFilamento, calcularAlertas, crearFilamento, getFilamentos, getUmbrales } from '@/lib/datastore';
import { Filamento } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [filamentos, umbrales] = await Promise.all([getFilamentos(), getUmbrales()]);
    return NextResponse.json({ filamentos, alertas: calcularAlertas(filamentos, umbrales) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { forzarNuevo, fusionarCon, ...datos } = (await req.json()) as
      Omit<Filamento, 'id'> & { forzarNuevo?: boolean; fusionarCon?: string };
    if (!datos.tipo?.trim() || !datos.color?.trim() || !datos.marca?.trim()) {
      return NextResponse.json({ error: 'Tipo, color y marca son obligatorios' }, { status: 400 });
    }
    // Rollo nuevo = 1 kg por rollo; comenzado = gramos aproximados indicados
    const gramos = datos.comenzado ? Number(datos.gramosRestantes) || 0 : (Number(datos.rollos) || 1) * 1000;
    const r = await crearFilamento({ ...datos, gramosRestantes: gramos }, { forzarNuevo, fusionarCon });
    if (r.tipo === 'sugerencia') {
      return NextResponse.json({ ok: true, requiereConfirmacion: true, candidato: r.candidato });
    }
    return NextResponse.json({ ok: true, filamento: r.filamento, fusionado: r.tipo === 'fusionado' });
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
