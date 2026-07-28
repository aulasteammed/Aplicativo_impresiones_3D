import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_SESION, claveConfigurada, tokenValido } from '@/lib/auth';
import { limitar } from '@/lib/rateLimit';

// "Portero" de la app: revisa cada petición, la limita en frecuencia y exige la clave.
//
// - Rate-limit: topa cuántas peticiones por minuto admite una misma IP en /api/* (frena
//   bucles/floods que agotarían la cuota de Sheets o la memoria del OCR). Se aplica SIEMPRE,
//   con o sin clave configurada.
// - Clave de acceso: si NO se configuró CLAVE_ACCESO, la protección está desactivada y deja
//   pasar todo (así el modo local/demo funciona sin fricción). Al publicar, basta con definir
//   la clave. Páginas sin cookie válida -> /login; rutas /api sin cookie válida -> 401.

// Rutas siempre accesibles (si no, habría un bucle: /login no podría cargar).
const PUBLICAS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/estado'];

function esPublica(pathname: string): boolean {
  return PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

// Límite de peticiones por IP y por minuto. Generoso para no molestar el uso normal (varias
// personas del aula pueden compartir la misma IP), pero suficiente para frenar un flood. Las
// rutas pesadas tienen un tope más bajo: cada exportación lee TODAS las hojas y cada análisis
// OCR consume mucha CPU/memoria.
const VENTANA_MS = 60_000;
function limiteDeRuta(pathname: string): { cubo: string; maximo: number } {
  if (pathname.startsWith('/api/exportar')) return { cubo: 'export', maximo: 30 };
  if (pathname.startsWith('/api/ia/')) return { cubo: 'ocr', maximo: 40 };
  return { cubo: 'api', maximo: 240 };
}

function ipDe(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.ip ?? 'local';
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Rate-limit de la API (independiente de la clave de acceso).
  if (pathname.startsWith('/api/')) {
    const { cubo, maximo } = limiteDeRuta(pathname);
    const r = limitar(`${ipDe(req)}:${cubo}`, maximo, VENTANA_MS);
    if (!r.ok) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' },
        { status: 429, headers: { 'Retry-After': String(r.retrasoSeg) } },
      );
    }
  }

  // 2) Protección por clave: desactivada mientras no exista la clave.
  if (!claveConfigurada()) return NextResponse.next();
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
