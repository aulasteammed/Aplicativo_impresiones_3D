// Limitador de tasa en memoria (ventana fija). Defensa sencilla contra ráfagas/DoS:
// topa cuántas peticiones admite una misma clave (IP) dentro de una ventana de tiempo.
//
// Es "best-effort": el estado vive en la memoria del proceso, así que si el proceso se
// reinicia (o hay varias instancias en Vercel) el conteo se reinicia — por diseño falla
// hacia lo PERMISIVO (perder el estado nunca bloquea de más a un usuario legítimo). No
// reemplaza a un WAF, pero frena bucles y floods que agotarían la cuota de Google Sheets
// o la memoria del OCR. Solo usa Map + Date.now, así que corre igual en Edge y en Node.

type Entrada = { conteo: number; expira: number };

const cubos = new Map<string, Entrada>();
const MAX_CLAVES = 5000; // cota de memoria: si crece de más, se barren las vencidas

export interface ResultadoLimite {
  ok: boolean;
  /** Segundos sugeridos para reintentar (cabecera Retry-After) cuando ok=false. */
  retrasoSeg: number;
}

/** Registra una petición de `clave` y dice si está dentro del límite. */
export function limitar(clave: string, maximo: number, ventanaMs: number): ResultadoLimite {
  const ahora = Date.now();
  let e = cubos.get(clave);
  if (!e || ahora >= e.expira) {
    e = { conteo: 0, expira: ahora + ventanaMs };
    cubos.set(clave, e);
  }
  e.conteo++;
  if (cubos.size > MAX_CLAVES) barrer(ahora);
  if (e.conteo > maximo) {
    return { ok: false, retrasoSeg: Math.max(1, Math.ceil((e.expira - ahora) / 1000)) };
  }
  return { ok: true, retrasoSeg: 0 };
}

/** Elimina las entradas ya vencidas para acotar la memoria. */
function barrer(ahora: number): void {
  cubos.forEach((v, k) => {
    if (ahora >= v.expira) cubos.delete(k);
  });
}
