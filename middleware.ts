import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_SESION, claveConfigurada, tokenValido } from '@/lib/auth';

// "Portero" de la app: revisa cada petición y exige la clave de acceso.
//
// - Si NO se configuró CLAVE_ACCESO, la protección está desactivada y deja pasar todo
//   (así el modo local/demo funciona sin fricción). Al publicar, basta con definir la
//   clave para que quede protegido.
// - Páginas sin cookie válida -> redirige a /login (recordando a dónde iba).
// - Rutas /api sin cookie válida -> responde 401 (no HTML), para que un curl externo
//   no pueda leer ni modificar datos.

// Rutas siempre accesibles (si no, habría un bucle: /login no podría cargar).
const PUBLICAS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/estado'];

function esPublica(pathname: string): boolean {
  return PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(req: NextRequest) {
  // Protección desactivada mientras no exista la clave.
  if (!claveConfigurada()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (esPublica(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_SESION)?.value;
  if (await tokenValido(token)) return NextResponse.next();

  // No autenticado:
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Corre en todo, excepto los recursos estáticos de Next y archivos con extensión
  // (imágenes, fuentes, etc.), que no necesitan protección.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)'],
};
