import { NextRequest, NextResponse } from 'next/server';
import { actualizarUmbral, crearUmbral, eliminarUmbral, getUmbrales } from '@/lib/datastore';
import { UmbralAlerta, VariableUmbral } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VARIABLES: VariableUmbral[] = ['color', 'marca', 'tipo'];

export async function GET() {
  try {
    return NextResponse.json({ umbrales: await getUmbrales() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { forzarNuevo, actualizarId, ...datos } = (await req.json()) as
      Omit<UmbralAlerta, 'id'> & { forzarNuevo?: boolean; actualizarId?: string };
    if (!VARIABLES.includes(datos.variable)) {
      return NextResponse.json({ error: 'Variable inválida (use color, marca o tipo)' }, { status: 400 });
    }
    const valor = (datos.valor ?? '').trim();
    const umbralGramos = Number(datos.umbralGramos);
    if (!valor) {
      return NextResponse.json({ error: 'Debe indicar el valor para el umbral' }, { status: 400 });
    }
    if (!(umbralGramos > 0)) {
      return NextResponse.json({ error: 'El umbral en gramos debe ser mayor que 0' }, { status: 400 });
    }
    const r = await crearUmbral({ variable: datos.variable, valor, umbralGramos }, { forzarNuevo, actualizarId });
    if (r.tipo === 'sugerencia') {
      return NextResponse.json({ ok: true, requiereConfirmacion: true, candidato: r.candidato });
    }
    return NextResponse.json({ ok: true, umbral: r.umbral, actualizado: r.tipo === 'actualizado' });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const u = (await req.json()) as UmbralAlerta;
    if (!u.id) return NextResponse.json({ error: 'Falta el ID del umbral' }, { status: 400 });
    if (!VARIABLES.includes(u.variable)) {
      return NextResponse.json({ error: 'Variable inválida (use color, marca o tipo)' }, { status: 400 });
    }
    if (!(u.valor ?? '').trim()) return NextResponse.json({ error: 'Debe indicar el valor para el umbral' }, { status: 400 });
    if (!(Number(u.umbralGramos) > 0)) return NextResponse.json({ error: 'El umbral en gramos debe ser mayor que 0' }, { status: 400 });
    await actualizarUmbral({ id: u.id, variable: u.variable, valor: u.valor.trim(), umbralGramos: Number(u.umbralGramos) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let id = new URL(req.url).searchParams.get('id') ?? '';
    if (!id) {
      try { id = ((await req.json()) as { id?: string }).id ?? ''; } catch { /* sin cuerpo */ }
    }
    if (!id) return NextResponse.json({ error: 'Falta el ID del umbral' }, { status: 400 });
    await eliminarUmbral(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
