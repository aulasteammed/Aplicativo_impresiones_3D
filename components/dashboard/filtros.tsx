'use client';

// Barra de filtros del Dashboard: multiselección genérica y el selector jerárquico de Mes.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { mesLbl, MESES_LARGO } from './constantes';

/** Cierra un popover abierto cuando se hace clic fuera del contenedor devuelto.
 *  `setAbierto` es el setState de un useState — su identidad es estable entre
 *  renders, así que el listener se registra una sola vez (igual que `deps: []`). */
export function useCerrarAlClicFuera(setAbierto: Dispatch<SetStateAction<string | null>>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const alClic = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(null); };
    document.addEventListener('mousedown', alClic);
    return () => document.removeEventListener('mousedown', alClic);
  }, [setAbierto]);
  return ref;
}

export function FiltroMulti({ dim, label, opciones, sel, abierto, onAbrir, onSet }: {
  dim: string; label: string; opciones: string[];
  sel: Set<string> | undefined; abierto: boolean;
  onAbrir: () => void; onSet: (next: Set<string> | null) => void;
}) {
  // Un conjunto VACÍO ("Ninguno") también es un filtro activo (oculta todo lo de esa
  // categoría): el chip se resalta con contador 0 para que se vea qué causa el vacío.
  const activo = !!sel;
  const toggle = (v: string) => {
    const base = sel ? new Set(sel) : new Set(opciones);
    base.has(v) ? base.delete(v) : base.add(v);
    onSet(base.size === opciones.length ? null : base);
  };
  return (
    <div className="md">
      <button className={`md-btn ${activo ? 'act' : ''}`} onClick={onAbrir}>
        {label}{activo ? <span className="cnt">{sel!.size}</span> : <span style={{ opacity: .5 }}>▾</span>}
      </button>
      {abierto && (
        <div className="md-pop">
          <div className="md-mini">
            <button onClick={() => onSet(null)}>Todos</button>
            <button onClick={() => onSet(new Set())}>Ninguno</button>
          </div>
          {opciones.map((v) => (
            <label className="md-opt" key={v}>
              <input type="checkbox" checked={sel ? sel.has(v) : true} onChange={() => toggle(v)} />
              <span>{dim === 'mes' ? mesLbl(v) : v}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Filtro de "Mes" jerárquico: primero el AÑO (lista corta que no crece con los
// meses) y, al abrir un año, sus MESES. Produce el mismo conjunto de valores
// "YYYY-MM" que el filtro plano, así el resto del tablero no cambia.
export function FiltroMes({ opciones, sel, abierto, onAbrir, onSet }: {
  opciones: string[]; sel: Set<string> | undefined; abierto: boolean;
  onAbrir: () => void; onSet: (next: Set<string> | null) => void;
}) {
  const [expandido, setExpandido] = useState<string | null>(null);
  // Igual que en FiltroMulti: el conjunto vacío ("Ninguno") cuenta como filtro activo.
  const activo = !!sel;
  const porAnio = useMemo(() => {
    const m: Record<string, string[]> = {};
    [...opciones].sort().forEach((ym) => { const a = ym.slice(0, 4); (m[a] ??= []).push(ym); });
    return m;
  }, [opciones]);
  const anios = Object.keys(porAnio).sort();
  // Año abierto por defecto = el más reciente; '' = ninguno abierto.
  const anioAbierto = expandido === '' ? null : (expandido || anios[anios.length - 1] || null);

  const marcado = (ym: string) => (sel ? sel.has(ym) : true);
  const emitir = (base: Set<string>) => onSet(base.size === opciones.length ? null : base);
  const toggle = (ym: string) => {
    const base = sel ? new Set(sel) : new Set(opciones);
    base.has(ym) ? base.delete(ym) : base.add(ym);
    emitir(base);
  };
  const toggleAnio = (a: string) => {
    const base = sel ? new Set(sel) : new Set(opciones);
    const todos = porAnio[a].every((ym) => base.has(ym));
    porAnio[a].forEach((ym) => (todos ? base.delete(ym) : base.add(ym)));
    emitir(base);
  };
  const nSel = (a: string) => porAnio[a].filter(marcado).length;

  return (
    <div className="md">
      <button className={`md-btn ${activo ? 'act' : ''}`} onClick={onAbrir}>
        Mes{activo ? <span className="cnt">{sel!.size}</span> : <span style={{ opacity: .5 }}>▾</span>}
      </button>
      {abierto && (
        <div className="md-pop">
          <div className="md-mini">
            <button onClick={() => onSet(null)}>Todos</button>
            <button onClick={() => onSet(new Set())}>Ninguno</button>
          </div>
          {anios.length === 0 && <div className="md-opt" style={{ color: '#9aa1b2' }}>Sin datos</div>}
          {anios.map((a) => {
            const sc = nSel(a), total = porAnio[a].length, exp = anioAbierto === a;
            return (
              <div key={a}>
                <div className="md-opt" style={{ fontWeight: 700, color: '#3c435a' }}>
                  <input type="checkbox"
                    checked={total > 0 && sc === total}
                    ref={(el) => { if (el) el.indeterminate = sc > 0 && sc < total; }}
                    onChange={() => toggleAnio(a)} />
                  <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandido(exp ? '' : a)}>
                    {a}{sc > 0 && sc < total ? ` · ${sc}` : ''}
                  </span>
                  <span style={{ color: '#9aa1b2', cursor: 'pointer', width: 14, textAlign: 'center' }}
                    onClick={() => setExpandido(exp ? '' : a)}>{exp ? '▾' : '▸'}</span>
                </div>
                {exp && porAnio[a].map((ym) => (
                  <label className="md-opt" key={ym} style={{ paddingLeft: 24 }}>
                    <input type="checkbox" checked={marcado(ym)} onChange={() => toggle(ym)} />
                    <span>{MESES_LARGO[ym.slice(5, 7)] || ym}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
