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
  tono = 'primary', onConfirmar, onCancelar, children,
}: {
  abierto: boolean;
  titulo: string;
  icono?: React.ReactNode;
  confirmarTexto?: string;
  cancelarTexto?: string;
  tono?: 'primary' | 'danger';
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
          <button className="btn-secondary" onClick={onCancelar}>{cancelarTexto}</button>
          <button className={tono === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirmar} autoFocus>{confirmarTexto}</button>
        </div>
      </div>
    </Modal>
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
    const t = setInterval(recargar, intervaloMs);
    return () => { montado.current = false; clearInterval(t); };
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
