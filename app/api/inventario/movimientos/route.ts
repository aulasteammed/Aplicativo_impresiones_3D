import { NextResponse } from 'next/server';
import { getMovimientos } from '@/lib/datastore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ movimientos: await getMovimientos() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
