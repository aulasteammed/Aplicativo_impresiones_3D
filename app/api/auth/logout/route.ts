import { NextResponse } from 'next/server';
import { COOKIE_SESION } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** POST: cierra la sesión borrando la cookie. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESION, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
