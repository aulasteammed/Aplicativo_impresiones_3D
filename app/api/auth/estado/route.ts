import { NextResponse } from 'next/server';
import { claveConfigurada } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET: indica si la app está protegida por clave (para mostrar u ocultar "Cerrar sesión"). */
export async function GET() {
  return NextResponse.json({ protegido: claveConfigurada() });
}
