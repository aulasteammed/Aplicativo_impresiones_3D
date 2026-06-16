import { NextRequest, NextResponse } from 'next/server';
import { crearProyecto, getProyectos } from '@/lib/datastore';
import { ItemProyecto } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ proyectos: await getProyectos() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, impresora, items } = (await req.json()) as {
      nombre: string; impresora: string; items: ItemProyecto[];
    };
    if (!nombre?.trim() || !impresora?.trim() || !items?.length) {
      return NextResponse.json({ error: 'Nombre, impresora y al menos una solicitud son obligatorios' }, { status: 400 });
    }
    for (const it of items) {
      if (!it.solicitudId || !it.material || !(it.gramos > 0) || !(it.tiempoHoras > 0)) {
        return NextResponse.json(
          { error: 'Cada solicitud del proyecto debe tener tiempo (h), gramos y tipo de material' },
          { status: 400 },
        );
      }
    }
    const codigo = await crearProyecto(nombre.trim(), impresora.trim(), items);
    return NextResponse.json({ ok: true, codigo });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
