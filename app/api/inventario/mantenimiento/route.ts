import { NextRequest, NextResponse } from 'next/server';
import { crearMantenimiento, getMantenimientos, actualizarMantenimiento, eliminarMantenimiento } from '@/lib/datastore';
import { Mantenimiento } from '@/lib/types';
import { hoyISO } from '@/lib/util';

/** Valida los campos de programación comunes a crear y editar. */
function validarProgramacion(datos: Mantenimiento): string | null {
  if (datos.programacion === 'fecha' && !datos.proximaFecha) {
    return 'Indica la fecha del próximo mantenimiento';
  }
  if (datos.programacion === 'horas' && !(datos.cadaHoras && datos.cadaHoras > 0)) {
    return 'Indica cada cuántas horas de uso se repite el mantenimiento';
  }
  return null;
}

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
    const err = validarProgramacion(datos);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    await crearMantenimiento({ ...datos, fecha: datos.fecha || hoyISO() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const datos = (await req.json()) as Mantenimiento;
    if (datos.fila == null) {
      return NextResponse.json({ error: 'No se identificó el registro a editar' }, { status: 400 });
    }
    if (!datos.impresoraId || !datos.descripcion) {
      return NextResponse.json({ error: 'Impresora y descripción son obligatorias' }, { status: 400 });
    }
    const err = validarProgramacion(datos);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    await actualizarMantenimiento({ ...datos, fecha: datos.fecha || hoyISO() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let fila: string | number | null = new URL(req.url).searchParams.get('fila');
    if (fila == null) {
      try { fila = (await req.json()).fila; } catch { /* sin cuerpo */ }
    }
    if (fila == null || fila === '') {
      return NextResponse.json({ error: 'No se identificó el registro a eliminar' }, { status: 400 });
    }
    await eliminarMantenimiento(Number(fila));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
