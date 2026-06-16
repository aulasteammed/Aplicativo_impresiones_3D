import { NextResponse } from 'next/server';
import { getHistorial } from '@/lib/datastore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const registros = await getHistorial();
    return NextResponse.json({ registros: [...registros].reverse() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
