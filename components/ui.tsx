'use client';

// Componentes UI compartidos: modal, chips de estado, KPI, búsqueda, hook de datos.

import { useCallback, useEffect, useRef, useState } from 'react';

export function Modal({
  abierto, onCerrar, titulo, children, ancho = 'max-w-2xl', centrado = false,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
  ancho?: string;
  /** Centra el diálogo vertical y horizontalmente (por defecto se ancla arriba) */
  centrado?: boolean;
}) {
  if (!abierto) return null;
  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm ${centrado ? 'items-center' : 'items-start'}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className={`my-8 w-full ${ancho} rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between rounded-t-2xl bg-steam-gradient px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{titulo}</h2>
          <button onClick={onCerrar} className="rounded-full p-1 text-indigo-100 hover:bg-white/20 hover:text-white" aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/** Diálogo de confirmación centrado, con el mismo estilo y paleta del aplicativo. */
export function ModalConfirmar({
  abierto, titulo, icono, confirmarTexto = 'Aceptar', cancelarTexto = 'Cancelar',
  tono = 'primary', procesando = false, onConfirmar, onCancelar, children,
}: {
  abierto: boolean;
  titulo: string;
  icono?: React.ReactNode;
  confirmarTexto?: string;
  cancelarTexto?: string;
  tono?: 'primary' | 'danger';
  /** Deshabilita los botones mientras la acción está en curso (evita doble envío). */
  procesando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCancelar} titulo={titulo} ancho="max-w-md" centrado>
      <div className="space-y-6">
        <div className="flex gap-4">
          {icono != null && (
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-steam-gradient text-2xl text-white shadow-sm">
              {icono}
            </div>
          )}
          <div className="pt-0.5 text-sm leading-relaxed text-slate-600">{children}</div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancelar} disabled={procesando}>{cancelarTexto}</button>
          <button className={tono === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirmar} disabled={procesando} autoFocus>
            {procesando ? 'Procesando…' : confirmarTexto}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Cambios de un formulario de edición (para el resumen de confirmación). Devuelve
 *  solo los campos que cambiaron, ya formateados como texto. */
export function diffCampos(
  defs: { campo: string; de: unknown; a: unknown; fmt?: (v: any) => string }[],
): { campo: string; de: string; a: string }[] {
  const s = (v: unknown, f?: (v: any) => string) => (f ? f(v) : v == null || v === '' ? '' : String(v));
  return defs
    .filter((d) => s(d.de, d.fmt) !== s(d.a, d.fmt))
    .map((d) => ({ campo: d.campo, de: s(d.de, d.fmt), a: s(d.a, d.fmt) }));
}

/** Ventana de confirmación de EDICIÓN con el resumen de cambios (mismo estilo que
 *  ModalConfirmar). Se muestra siempre antes de aplicar una edición. */
export function ModalConfirmarCambios({
  abierto, titulo = 'Confirmar cambios', cambios, onConfirmar, onVolver, guardando, extra,
}: {
  abierto: boolean;
  titulo?: string;
  cambios: { campo: string; de: string; a: string }[];
  onConfirmar: () => void;
  onVolver: () => void;
  guardando?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onVolver} titulo={titulo} ancho="max-w-lg" centrado>
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-steam-gradient text-2xl text-white shadow-sm">✎</div>
          <div className="min-w-0 text-sm text-slate-600">
            {cambios.length === 0 ? (
              <p>No se detectaron cambios respecto a los valores actuales.</p>
            ) : (
              <>
                <p className="mb-2">Revisa los cambios antes de guardarlos:</p>
                <ul className="space-y-1.5">
                  {cambios.map((c, i) => (
                    <li key={i} className="rounded-lg bg-slate-50 px-3 py-1.5">
                      <span className="font-medium text-slate-700">{c.campo}:</span>{' '}
                      <span className="text-slate-500 line-through decoration-slate-300">{c.de || '—'}</span>{' '}
                      <span className="text-slate-400">→</span>{' '}
                      <span className="font-medium text-steam-700">{c.a || '—'}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {extra}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onVolver} disabled={guardando}>Volver a editar</button>
          <button className="btn-primary" onClick={onConfirmar} disabled={guardando || cambios.length === 0}>{guardando ? 'Guardando…' : 'Confirmar cambios'}</button>
        </div>
      </div>
    </Modal>
  );
}

/** Botones de acción uniformes (Editar / Eliminar) para la columna "Acciones". */
export function AccionesFila({ onEditar, onEliminar }: { onEditar?: () => void; onEliminar?: () => void }) {
  return (
    <div className="flex justify-end gap-1.5 whitespace-nowrap">
      {onEditar && <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={onEditar}>Editar</button>}
      {onEliminar && <button type="button" className="btn-secondary !px-2 !py-1 text-xs !text-rose-600" onClick={onEliminar}>Eliminar</button>}
    </div>
  );
}

/** Lista de números de página a mostrar (con "…" cuando hay muchas). */
function rangoPaginas(actual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const ini = Math.max(2, actual - 1);
  const fin = Math.min(total - 1, actual + 1);
  if (ini > 2) out.push('…');
  for (let p = ini; p <= fin; p++) out.push(p);
  if (fin < total - 1) out.push('…');
  out.push(total);
  return out;
}

/** Controles de paginación: tamaño de página (10/20/50/100), navegación
 *  (« ‹ › »), números de página e indicador "Mostrando X-Y de N elementos". */
export function Paginacion({
  total, pagina, tamano, onPagina, onTamano, tamanos = [10, 20, 50, 100],
}: {
  total: number;
  pagina: number;
  tamano: number;
  onPagina: (p: number) => void;
  onTamano: (t: number) => void;
  tamanos?: number[];
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  const p = Math.min(Math.max(1, pagina), totalPaginas);
  const desde = total === 0 ? 0 : (p - 1) * tamano + 1;
  const hasta = Math.min(total, p * tamano);
  const btn = 'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border border-slate-200 px-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-500">
        <span>Mostrando <b className="text-slate-700">{desde}-{hasta}</b> de <b className="text-slate-700">{total}</b> elemento{total === 1 ? '' : 's'}</span>
        <label className="flex items-center gap-1.5">
          <span className="hidden sm:inline">Mostrar</span>
          <select className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={tamano} onChange={(e) => onTamano(Number(e.target.value))}>
            {tamanos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="hidden sm:inline">por página</span>
        </label>
      </div>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-1">
          <button className={btn} onClick={() => onPagina(1)} disabled={p <= 1} title="Primera" aria-label="Primera página">«</button>
          <button className={btn} onClick={() => onPagina(p - 1)} disabled={p <= 1} title="Anterior" aria-label="Página anterior">‹</button>
          {rangoPaginas(p, totalPaginas).map((n, i) => (n === '…'
            ? <span key={`e${i}`} className="px-1 text-slate-400">…</span>
            : <button key={n} className={`${btn} ${n === p ? '!border-steam-600 !bg-steam-600 !text-white' : ''}`} onClick={() => onPagina(n)} aria-current={n === p ? 'page' : undefined}>{n}</button>
          ))}
          <button className={btn} onClick={() => onPagina(p + 1)} disabled={p >= totalPaginas} title="Siguiente" aria-label="Página siguiente">›</button>
          <button className={btn} onClick={() => onPagina(totalPaginas)} disabled={p >= totalPaginas} title="Última" aria-label="Última página">»</button>
        </div>
      )}
    </div>
  );
}

const COLORES_ESTADO: Record<string, string> = {
  'Nueva': 'bg-blue-100 text-blue-700 ring-blue-200',
  'En Revisión': 'bg-amber-100 text-amber-700 ring-amber-200',
  'Aprobada': 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'Rechazada': 'bg-rose-100 text-rose-700 ring-rose-200',
  'Atendida': 'bg-slate-200 text-slate-600 ring-slate-300',
  'Activa': 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'En pausa': 'bg-amber-100 text-amber-700 ring-amber-200',
  'Finalizada': 'bg-slate-200 text-slate-600 ring-slate-300',
  'Exitoso': 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'Fallido': 'bg-rose-100 text-rose-700 ring-rose-200',
  'Operativa': 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'Mantenimiento': 'bg-amber-100 text-amber-700 ring-amber-200',
  'Fuera de servicio': 'bg-rose-100 text-rose-700 ring-rose-200',
};

export function Chip({ valor }: { valor: string }) {
  const clases = COLORES_ESTADO[valor] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${clases}`}>
      {valor || '—'}
    </span>
  );
}

export function KpiCard({
  titulo, valor, sub, acento = false,
}: { titulo: string; valor: string | number; sub?: string; acento?: boolean }) {
  return (
    <div className={`card ${acento ? 'border-steam-300 bg-steam-50' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-2 text-3xl font-bold ${acento ? 'text-steam-700' : 'text-slate-800'}`}>{valor}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function BarraBusqueda({
  valor, onCambio, placeholder = 'Buscar…',
}: { valor: string; onCambio: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input className="input pl-9" value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: 'info' | 'ok' | 'error' | 'alerta'; children: React.ReactNode }) {
  const estilos = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    error: 'bg-rose-50 text-rose-800 border-rose-200',
    alerta: 'bg-amber-50 text-amber-800 border-amber-200',
  } as const;
  return <div className={`rounded-lg border px-4 py-3 text-sm ${estilos[tipo]}`}>{children}</div>;
}

/** Hook simple de datos con polling (la "actualización en vivo" del aplicativo) */
export function useDatos<T>(url: string, intervaloMs = 60_000) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const montado = useRef(true);

  const recargar = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error HTTP ${res.status}`);
      }
      const json = (await res.json()) as T;
      if (montado.current) { setDatos(json); setError(null); }
    } catch (e) {
      if (montado.current) setError((e as Error).message);
    } finally {
      if (montado.current) setCargando(false);
    }
  }, [url]);

  useEffect(() => {
    montado.current = true;
    recargar();
    // No refresca cuando la pestaña está oculta (reduce lecturas de Google Sheets,
    // que tiene cuota por minuto); al volver a la pestaña, refresca una vez.
    const t = setInterval(() => { if (!document.hidden) recargar(); }, intervaloMs);
    const alVolver = () => { if (!document.hidden) recargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      montado.current = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [recargar, intervaloMs]);

  return { datos, cargando, error, recargar };
}

export function BotonRecargar({ onClick, cargando }: { onClick: () => void; cargando?: boolean }) {
  return (
    <button onClick={onClick} className="btn-secondary" title="Actualizar datos">
      <span className={cargando ? 'animate-spin' : ''}>⟳</span> Actualizar
    </button>
  );
}
