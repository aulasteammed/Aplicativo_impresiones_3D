import { NextRequest, NextResponse } from 'next/server';
import { crearMantenimiento, getMantenimientos } from '@/lib/datastore';
import { Mantenimiento } from '@/lib/types';
import { hoyISO } from '@/lib/util';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ mantenimientos: await getMantenimientos() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const datos = (await req.json()) as Mantenimiento;
    if (!datos.impresoraId || !datos.descripcion) {
      return NextResponse.json({ error: 'Impresora y descripción son obligatorias' }, { status: 400 });
    }
    await crearMantenimiento({ ...datos, fecha: datos.fecha || hoyISO() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
