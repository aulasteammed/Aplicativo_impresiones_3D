import { NextResponse } from 'next/server';
import { getDatosDashboard } from '@/lib/datastore';

export const dynamic = 'force-dynamic';

// Datasets crudos que consume el Dashboard interactivo (el filtrado es en el cliente).
export async function GET() {
  try {
    return NextResponse.json(await getDatosDashboard());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
