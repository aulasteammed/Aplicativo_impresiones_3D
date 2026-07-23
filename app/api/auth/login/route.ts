import { NextResponse } from 'next/server';
import { COOKIE_SESION, claveConfigurada, claveCorrecta, tokenSesionActual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** POST: verifica la clave de acceso y, si es correcta, deja una cookie de sesión. */
export async function POST(req: Request) {
  // Sin clave configurada no hay nada que proteger: acceso abierto.
  if (!claveConfigurada()) {
    return NextResponse.json({ ok: true, sinClave: true });
  }

  let clave = '';
  try {
    const body = await req.json();
    clave = typeof body?.clave === 'string' ? body.clave : '';
  } catch {
    clave = '';
  }

  if (!claveCorrecta(clave)) {
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESION, await tokenSesionActual(), {
    httpOnly: true, // no accesible desde JavaScript del navegador
    secure: process.env.NODE_ENV === 'production', // solo por HTTPS en producción
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
  return res;
}
