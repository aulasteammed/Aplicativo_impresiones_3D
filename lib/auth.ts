// Autenticación por CLAVE COMPARTIDA (una sola clave para todo el personal del aula).
//
// Este archivo lo usan tanto el middleware (que corre en el runtime Edge) como las
// rutas /api/auth/* (que corren en Node), por eso SOLO usa Web Crypto
// (globalThis.crypto.subtle), disponible en ambos entornos. No importar aquí nada
// de Node ni de datastore/google: rompería el Edge runtime del middleware.

/** Nombre de la cookie de sesión (httpOnly) que marca a un navegador como autorizado. */
export const COOKIE_SESION = 'aula_sesion';

/** Lee la clave de acceso configurada en el entorno (recortada). '' si no hay. */
function claveEntorno(): string {
  return (process.env.CLAVE_ACCESO ?? '').trim();
}

/**
 * ¿Está configurada la clave de acceso?
 * Si NO lo está, la protección queda DESACTIVADA (útil en local/demo): el middleware
 * deja pasar todo. Para proteger la app —sobre todo al publicarla— basta con darle
 * un valor a CLAVE_ACCESO.
 */
export function claveConfigurada(): boolean {
  return claveEntorno().length > 0;
}

/**
 * Token determinístico derivado de la clave (SHA-256). Es lo que se guarda en la
 * cookie: así la clave en texto plano nunca viaja en la cookie, y si la clave cambia,
 * el token esperado cambia y todas las sesiones viejas quedan inválidas al instante.
 */
export async function tokenDeClave(clave: string): Promise<string> {
  const datos = new TextEncoder().encode(`aula-steam:${clave}`);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Genera el token de sesión para la clave actualmente configurada. */
export async function tokenSesionActual(): Promise<string> {
  return tokenDeClave(claveEntorno());
}

/** true si el token de la cookie corresponde a la clave configurada. */
export async function tokenValido(token: string | undefined | null): Promise<boolean> {
  if (!token || !claveConfigurada()) return false;
  return token === (await tokenSesionActual());
}

/** Compara la clave que ingresó el usuario con la configurada. */
export function claveCorrecta(clave: string): boolean {
  const esperada = claveEntorno();
  return esperada.length > 0 && clave === esperada;
}
