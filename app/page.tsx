'use client';

// Ventana 1 — Dashboard interactivo: filtra por mes/rol/programa/motivo/servicio
// y todo el tablero se recalcula. Datos en vivo de /api/dashboard/datos.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Aviso, BotonRecargar, Modal, useDatos } from '@/components/ui';
import { canonCategoria, formatCOP, calcularAlertasMantenimiento, normalizarTexto } from '@/lib/util';
import { DatosDashboard, Impresora, Mantenimiento } from '@/lib/types';

const PAL = ['#6366f1', '#a855f7', '#f59e0b', '#10b981', '#3b82f6', '#f43f5e', '#14b8a6', '#eab308'];
const CEST: Record<string, string> = { 'Nueva': '#3b82f6', 'En Revisión': '#f59e0b', 'Aprobada': '#10b981', 'Rechazada': '#f43f5e', 'Atendida': '#94a3b8' };
const MESES: Record<string, string> = { '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr', '05': 'may', '06': 'jun', '07': 'jul', '08': 'ago', '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic' };
const MESES_LARGO: Record<string, string> = { '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre' };
const DIMS: [string, string][] = [['mes', 'Mes'], ['rol', 'Rol'], ['programa', 'Programa'], ['motivo', 'Motivo'], ['servicio', 'Servicio']];

const nf = (n: number) => Math.round(n).toLocaleString('es-CO');
// Mes agrupado por YYYY-MM (todo el mes). La etiqueta usa el nombre del mes y el
// año de 4 dígitos para que no se confunda con un día (ej. "Febrero 2026").
const mesLbl = (m: string) => { const [y, mo] = m.split('-'); return `${MESES_LARGO[mo] || mo} ${y || ''}`.trim(); };
const mesCorto = (m: string) => { const [y, mo] = m.split('-'); return { m: MESES[mo] || mo, y: y || '' }; };

type Fila = Record<string, any>;
const countBy = (arr: Fila[], k: string) => {
  const m: Record<string, number> = {};
  arr.forEach((r) => { const v = canonCategoria(k, r[k]); if (v == null) return; m[v] = (m[v] || 0) + 1; });
  return Object.entries(m).map(([l, v]) => ({ l, v }));
};
const sumBy = (arr: Fila[], k: string, f: string) => {
  const m: Record<string, number> = {};
  arr.forEach((r) => { const g = canonCategoria(k, r[k]); if (g == null) return; m[g] = (m[g] || 0) + (+r[f] || 0); });
  return Object.entries(m).map(([l, v]) => ({ l, v }));
};
const uniqDim = (datos: DatosDashboard, k: string) => {
  const m = new Map<string, string>();
  const add = (raw: any) => { const c = canonCategoria(k, raw); if (c != null) m.set(normalizarTexto(c), c); };
  datos.solicitudes.forEach((r) => add((r as Fila)[k]));
  datos.historial.forEach((r) => add((r as Fila)[k]));
  const a = Array.from(m.values());
  return k === 'mes' ? a.sort() : a.sort((x, y) => x.localeCompare(y, 'es'));
};

// ---------------------------------------------------------------------------
// Piezas visuales
// ---------------------------------------------------------------------------
type Punto = { l: string; v: number };

function Kpi({ l, v, s, cls }: { l: string; v: string | number; s?: string; cls?: string }) {
  return (
    <div className={`dcard kpi ${cls || ''}`}>
      <div className="kl">{l}</div>
      <div className="kv num">{v}</div>
      {s && <div className="ks">{s}</div>}
    </div>
  );
}

function Barras({ data, color, fmt }: { data: Punto[]; color?: string; fmt?: (v: number) => string }) {
  const top = [...data].sort((a, b) => b.v - a.v).slice(0, 8);
  const max = Math.max(1, ...top.map((d) => d.v));
  if (!top.length) return <p className="empty">Sin datos.</p>;
  return (
    <div className="bars">
      {top.map((d, i) => (
        <div className="bar-row" key={d.l}>
          <div className="bl" title={d.l}>{d.l}</div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(d.v / max) * 100}%`, background: color || PAL[i % PAL.length] }} /></div>
          <div className="bv num">{fmt ? fmt(d.v) : d.v}</div>
        </div>
      ))}
    </div>
  );
}

function Columnas({ data }: { data: { m: string; y: string; v: number }[] }) {
  if (!data.length) return <p className="empty">Sin datos.</p>;
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="cols">
      {data.map((d) => (
        <div className="col" key={d.m + d.y}>
          <div className="cplot"><div className="cval num">{d.v}</div><div className="cbar" style={{ height: `${Math.max(3, Math.round((d.v / max) * 112))}px` }} /></div>
          <div className="cl">{d.m}<span className="cy">{d.y}</span></div>
        </div>
      ))}
    </div>
  );
}

function Donut({ data, colorMap }: { data: Punto[]; colorMap?: Record<string, string> }) {
  const d = data.filter((x) => x.v > 0);
  const total = d.reduce((a, x) => a + x.v, 0);
  const r = 52, circ = 2 * Math.PI * r;
  let off = 0;
  const segs = d.map((x, i) => { const len = total ? (x.v / total) * circ : 0; const s = { len, col: (colorMap && colorMap[x.l]) || PAL[i % PAL.length], off }; off += len; return s; });
  return (
    <div className="donut-wrap">
      <svg width="128" height="128" viewBox="0 0 128 128">
        {!total && <circle cx="64" cy="64" r="52" fill="none" stroke="#eef0f7" strokeWidth="20" />}
        {segs.map((s, i) => (
          <circle key={i} cx="64" cy="64" r="52" fill="none" stroke={s.col} strokeWidth="20" strokeDasharray={`${s.len} ${circ - s.len}`} strokeDashoffset={-s.off} transform="rotate(-90 64 64)" />
        ))}
        <text x="64" y="60" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1f2440">{total}</text>
        <text x="64" y="76" textAnchor="middle" fontSize="10" fill="#9aa1b2">total</text>
      </svg>
      <div className="dlegend">
        {d.length ? d.map((x, i) => (
          <div className="dr" key={x.l}>
            <span className="dn"><i className="dot" style={{ background: (colorMap && colorMap[x.l]) || PAL[i % PAL.length] }} />{x.l}</span>
            <span className="dv num">{x.v}</span>
          </div>
        )) : <span className="empty">Sin datos.</span>}
      </div>
    </div>
  );
}

function FiltroMulti({ dim, label, opciones, sel, abierto, onAbrir, onSet }: {
  dim: string; label: string; opciones: string[];
  sel: Set<string> | undefined; abierto: boolean;
  onAbrir: () => void; onSet: (next: Set<string> | null) => void;
}) {
  const activo = !!sel && sel.size > 0;
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

// ---------------------------------------------------------------------------
// Modal de exportación: el usuario elige qué conjuntos de datos incluir y se
// descarga un .xlsx (una hoja por conjunto) generado por /api/exportar.
const OPCIONES_EXPORT: [string, string, string][] = [
  ['solicitudes', 'Solicitudes', 'Todas las solicitudes del formulario'],
  ['camas', 'Camas de impresión', 'Camas activas y en pausa (una fila por pieza)'],
  ['historial', 'Historial', 'Impresiones finalizadas'],
  ['filamentos', 'Inventario · Filamentos', 'Rollos de filamento del inventario'],
  ['mantenimiento', 'Inventario · Mantenimiento', 'Registros y programación de mantenimiento'],
];

function ModalExportar({ onCerrar }: { onCerrar: () => void }) {
  const [sel, setSel] = useState<Record<string, boolean>>({ solicitudes: true, camas: true, historial: true, filamentos: true, mantenimiento: true });
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const alguno = Object.values(sel).some(Boolean);
  const rangoInvalido = !!desde && !!hasta && desde > hasta;
  const toggle = (k: string) => setSel((p) => ({ ...p, [k]: !p[k] }));
  const todos = (v: boolean) => setSel({ solicitudes: v, camas: v, historial: v, filamentos: v, mantenimiento: v });

  async function descargar() {
    setGenerando(true);
    setError('');
    try {
      const res = await fetch('/api/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sel, desde, hasta }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || `No se pudo generar el archivo (error ${res.status})`);
      }
      const blob = await res.blob();
      const nombre = res.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1] || 'Aula-STEAM-datos.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Exportar datos a Excel" ancho="max-w-lg" centrado>
      <div className="space-y-5">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="flex gap-4">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-steam-gradient text-2xl text-white shadow-sm">📊</div>
          <div className="min-w-0 flex-1 text-sm text-slate-600">
            <p>Elige qué información incluir. Se genera un archivo <b>.xlsx</b> con una hoja por cada conjunto seleccionado.</p>
            <div className="mt-3 flex gap-3 text-xs">
              <button type="button" className="text-steam-700 hover:underline" onClick={() => todos(true)}>Seleccionar todo</button>
              <span className="text-slate-300">·</span>
              <button type="button" className="text-steam-700 hover:underline" onClick={() => todos(false)}>Ninguno</button>
            </div>
            <div className="mt-2 space-y-1.5">
              {OPCIONES_EXPORT.map(([k, l, d]) => (
                <label key={k} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none accent-steam-600" checked={!!sel[k]} onChange={() => toggle(k)} />
                  <span>
                    <span className="font-medium text-slate-700">{l}</span>
                    <br />
                    <span className="text-xs text-slate-400">{d}</span>
                  </span>
                </label>
              ))}
            </div>

            {/* Rango de fechas (opcional) */}
            <div className="mt-4 rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo (opcional)</span>
                {(desde || hasta) && (
                  <button type="button" className="text-xs text-steam-700 hover:underline" onClick={() => { setDesde(''); setHasta(''); }}>Limpiar</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-slate-400">Desde</span>
                  <input type="date" className="input mt-0.5" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-400">Hasta</span>
                  <input type="date" className="input mt-0.5" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
                </label>
              </div>
              {rangoInvalido ? (
                <p className="mt-1.5 text-xs text-rose-600">La fecha inicial no puede ser posterior a la final.</p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-400">Vacío = sin límite. Filtra por fecha de solicitud, creación de la cama, finalización, y registro de filamento o mantenimiento.</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar} disabled={generando}>Cancelar</button>
          <button className="btn-primary" onClick={descargar} disabled={generando || !alguno || rangoInvalido}>
            {generando ? 'Generando…' : '⬇ Descargar .xlsx'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Dashboard() {
  const { datos, cargando, error, recargar } = useDatos<DatosDashboard>('/api/dashboard/datos');
  const [filtros, setFiltros] = useState<Record<string, Set<string>>>({});
  const [abierto, setAbierto] = useState<string | null>(null);
  const [exportar, setExportar] = useState(false);
  const barraRef = useRef<HTMLDivElement>(null);

  // Cierra el popover SOLO si el clic fue fuera de la barra de filtros; así, marcar/
  // desmarcar valores dentro de una lista no cierra el popover ni pierde el clic.
  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      if (barraRef.current && !barraRef.current.contains(e.target as Node)) setAbierto(null);
    };
    document.addEventListener('mousedown', alClic);
    return () => document.removeEventListener('mousedown', alClic);
  }, []);

  const setDim = (dim: string) => (next: Set<string> | null) =>
    setFiltros((prev) => { const c = { ...prev }; if (next == null) delete c[dim]; else c[dim] = next; return c; });

  const pasa = (r: Fila) => {
    for (const d in filtros) { const s = filtros[d]; if (s && s.size && !s.has(canonCategoria(d, r[d]) as string)) return false; }
    return true;
  };

  const opciones = useMemo(() => {
    const o: Record<string, string[]> = {};
    if (datos) for (const [k] of DIMS) o[k] = uniqDim(datos, k);
    return o;
  }, [datos]);

  const sol = useMemo(() => (datos?.solicitudes ?? []).filter(pasa), [datos, filtros]);
  const hist = useMemo(() => (datos?.historial ?? []).filter(pasa), [datos, filtros]);

  if (error) return <Aviso tipo="error">Error cargando el dashboard: {error}</Aviso>;
  if (!datos) return <p className="text-sm text-slate-500">Cargando dashboard…</p>;

  const est = (e: string) => sol.filter((s) => s.estado === e).length;
  const aprob = est('Aprobada') + est('Atendida'), rech = est('Rechazada');
  const resueltas = aprob + rech;
  const meses = opciones.mes ?? [];
  const porMes = (arr: Fila[]) => meses.map((mm) => ({ ...mesCorto(mm), v: arr.filter((r) => r.mes === mm).length }));

  // Camas
  const camActivas = hist.filter((h) => h.estado === 'Activa');
  const camPausa = hist.filter((h) => h.estado === 'En pausa');
  const camCurso = camActivas.concat(camPausa);
  const gCurso = camCurso.reduce((a, h) => a + (+h.gramos || 0), 0);
  const hCurso = camCurso.reduce((a, h) => a + (+h.horas || 0), 0);
  const CAMA_PILL: Record<string, string> = { 'Activa': 'p-ok', 'En pausa': 'p-warn' };
  const camLista = [...camCurso].sort((a, b) => (+b.horas || 0) - (+a.horas || 0)).slice(0, 8);

  // Producción
  const fin = hist.filter((h) => h.resultado === 'Exitoso' || h.resultado === 'Fallido');
  const exito = fin.length ? `${Math.round((fin.filter((h) => h.resultado === 'Exitoso').length / fin.length) * 100)}%` : '—';

  // Top solicitantes
  const pp: Record<string, number> = {};
  sol.forEach((s) => { pp[s.nombre] = (pp[s.nombre] || 0) + 1; });
  const top = Object.entries(pp).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Sección 4 — mantenimiento (independiente de filtros: estado de los equipos)
  const alertasMant = calcularAlertasMantenimiento(datos.impresoras, datos.mantenimientos, datos.generado);
  const nombreImp = (id: string) => datos.impresoras.find((i) => i.id === id)?.nombre || id;
  const planDe = (id: string): Mantenimiento | null =>
    datos.mantenimientos.filter((m) => m.impresoraId === id && m.programacion && m.programacion !== 'ninguna')
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0] || null;
  const vistaImp = (imp: Impresora) => {
    const al = alertasMant.find((a) => a.impresoraId === imp.id);
    const p = planDe(imp.id);
    let valor = '—', sub = 'sin mantenimiento programado', ratio = 0;
    if (p && p.programacion === 'horas' && p.cadaHoras) {
      const desde = Math.max(0, Math.round((imp.horasAcumuladas - (p.horasBase || 0)) * 10) / 10);
      ratio = desde / p.cadaHoras; valor = `${desde} / ${p.cadaHoras} h`; sub = `cada ${p.cadaHoras} h de uso`;
    } else if (p && p.programacion === 'fecha' && p.proximaFecha) {
      valor = p.proximaFecha; sub = al ? (al.estado === 'vencido' ? 'vencido' : 'próximo') : 'programado';
      ratio = al ? (al.estado === 'vencido' ? 1 : 0.9) : 0.5;
    }
    return { imp, al, valor, sub, ratio };
  };
  const EST_PILL: Record<string, string> = { 'Operativa': 'p-ok', 'Mantenimiento': 'p-warn', 'Fuera de servicio': 'p-crit' };
  const impVistas = datos.impresoras.map(vistaImp).sort((a, b) => b.ratio - a.ratio);
  const oper = datos.impresoras.filter((i) => i.estado === 'Operativa').length;
  const noDisp = datos.impresoras.length - oper;
  const req = alertasMant.filter((a) => a.estado === 'vencido').length;
  const prox = alertasMant.filter((a) => a.estado === 'proximo').length;
  const rollosBajos = datos.filamentos.filter((f) => f.umbral > 0 && f.gramos <= f.umbral).length;
  const stock = datos.filamentos.filter((f) => f.umbral > 0 && f.gramos <= f.umbral * 1.2)
    .map((f) => ({ ...f, ratio: f.gramos / f.umbral })).sort((a, b) => a.ratio - b.ratio).slice(0, 8);
  const TIPO_PILL: Record<string, string> = { 'preventivo': 'p-ok', 'correctivo': 'p-warn', 'consumible': 'p-mut', 'repuesto': 'p-mut' };

  const hayFiltros = Object.keys(filtros).length > 0;

  return (
    <div className="dash">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">Filtra por fecha, rol, motivo… y todo el tablero se recalcula al instante</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{datos.solicitudes.length} solicitudes · {datos.historial.length} impresiones</span>
          <button className="btn-secondary" onClick={() => setExportar(true)} title="Exportar datos a Excel (.xlsx)">
            ⬇ Exportar
          </button>
          <BotonRecargar onClick={recargar} cargando={cargando} />
        </div>
      </div>

      {exportar && <ModalExportar onCerrar={() => setExportar(false)} />}

      {datos.esDemo && (
        <div className="mt-4"><Aviso tipo="info">Modo demo: datos de ejemplo en memoria (sin conexión a Google Sheets).</Aviso></div>
      )}

      {/* Filtros */}
      <div className="filtros mt-4" ref={barraRef}>
        <span className="flab">Filtros</span>
        {DIMS.map(([k, l]) => (
          <FiltroMulti
            key={k} dim={k} label={l} opciones={opciones[k] ?? []}
            sel={filtros[k]} abierto={abierto === k}
            onAbrir={() => setAbierto(abierto === k ? null : k)}
            onSet={setDim(k)}
          />
        ))}
        {hayFiltros && <button className="clr" onClick={() => setFiltros({})}>✕ Limpiar filtros</button>}
      </div>

      {/* 1 · ESTADO ACTUAL */}
      <div className="sec"><div className="sec-h"><h2>1 · Estado actual de la operación</h2><span className="tag tag-live">En vivo</span></div>
        <p className="sec-p">Lo que necesita atención — la primera lectura al abrir la app.</p></div>

      <div className="subhdr">Solicitudes de servicio</div>
      <div className="grid k4">
        <Kpi l="Nuevas sin responder" v={est('Nueva')} s="estado «Nueva»" cls="acc" />
        <Kpi l="Pendientes vencidas" v={sol.filter((s) => s.vencida).length} s="fecha tentativa ya pasó" cls="crit" />
        <Kpi l="En revisión" v={est('En Revisión')} s="esperando decisión" cls="warnb" />
        <Kpi l="Tasa de aprobación" v={resueltas ? `${Math.round((aprob / resueltas) * 100)}%` : '—'} s={`${aprob} de ${resueltas} resueltas`} />
      </div>
      <div className="grid" style={{ marginTop: 14 }}>
        <div className="dcard">
          <div className="chart-h">Embudo de solicitudes</div>
          <div className="chart-cap">Dónde se acumulan las solicitudes en el proceso.</div>
          <div className="pipe">
            {['Nueva', 'En Revisión', 'Aprobada', 'Atendida', 'Rechazada'].map((e, i, arr) => (
              <div className="stage" key={e} style={e === 'Rechazada' ? { background: '#fff5f6', borderColor: '#ffdbe0' } : undefined}>
                <div className="sn" style={{ color: CEST[e] }}>{e}</div>
                <div className="sv num">{est(e)}</div>
                {i < arr.length - 1 && <span className="arrow">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="subhdr">Camas de impresión</div>
      <div className="grid k4">
        <Kpi l="Camas activas" v={camActivas.length} s="imprimiendo ahora" cls="acc" />
        <Kpi l="En pausa" v={camPausa.length} s="requieren decisión" cls={camPausa.length ? 'warnb' : ''} />
        <Kpi l="Material en curso" v={`${nf(gCurso)} g`} s={`${camCurso.length} camas sin finalizar`} />
        <Kpi l="Horas en curso" v={`${(Math.round(hCurso * 10) / 10).toLocaleString('es-CO')} h`} s="carga activa estimada" />
      </div>
      <div className="grid" style={{ marginTop: 14 }}>
        <div className="dcard">
          <div className="chart-h">Camas en curso ahora</div>
          <div className="chart-cap">Lo que está montado en las camas en este momento — activas y en pausa.</div>
          {camLista.length ? camLista.map((h, i) => (
            <div className="lrow" key={i}>
              <span className={`pill ${CAMA_PILL[h.estado] || 'p-mut'}`}>{h.estado}</span>
              <div className="ln"><b>{h.nombre}</b><div className="lsub">{h.impresora === '(sin dato)' ? 'Impresora sin asignar' : h.impresora} · {h.material === '(sin dato)' ? 'material sin dato' : h.material}</div></div>
              <span className="lval">{h.gramos ? `${nf(h.gramos)} g` : '—'}{h.horas ? ` · ${Math.round(h.horas * 10) / 10} h` : ''}</span>
            </div>
          )) : <p className="empty">Sin camas activas o en pausa con estos filtros.</p>}
        </div>
      </div>

      {/* 2 · DEMANDA */}
      <div className="sec"><div className="sec-h"><h2>2 · Análisis de la demanda</h2></div>
        <p className="sec-p">Volumen en el tiempo, quién solicita y para qué.</p></div>
      <div className="grid c2">
        <div className="dcard"><div className="chart-h">Solicitudes por mes</div><div className="chart-cap">Tendencia de demanda para anticipar meses pico.</div><Columnas data={porMes(sol)} /></div>
        <div className="dcard"><div className="chart-h">Por rol del solicitante</div><div className="chart-cap">A quién sirve el aula.</div><Donut data={countBy(sol, 'rol')} /></div>
      </div>
      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard"><div className="chart-h">Por motivo de la solicitud</div><div className="chart-cap">Para qué se usa la impresión.</div><Barras data={countBy(sol, 'motivo')} color="#6366f1" /></div>
        <div className="dcard"><div className="chart-h">Por programa académico</div><div className="chart-cap">Qué carreras concentran la demanda (top 8).</div><Barras data={countBy(sol, 'programa')} color="#5b53e0" /></div>
      </div>
      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard"><div className="chart-h">Por tipo de servicio</div><div className="chart-cap">Impresión vs. modelado.</div><Donut data={countBy(sol, 'servicio')} /></div>
        <div className="dcard"><div className="chart-h">Top solicitantes recurrentes</div><div className="chart-cap">Quiénes vuelven más — respeta los filtros activos.</div>
          {top.length ? top.map((t, i) => (
            <div className="trow" key={t[0]}><span className="rank">{i + 1}</span><div className="tn">{t[0]}<div className="ts">{t[1]} solicitud{t[1] > 1 ? 'es' : ''}</div></div><span className="tv num">{t[1]}</span></div>
          )) : <p className="empty">Sin registros con estos filtros.</p>}
        </div>
      </div>

      {/* 3 · PRODUCCIÓN */}
      <div className="sec"><div className="sec-h"><h2>3 · Producción e impresión</h2><span className="tag tag-live">En vivo</span></div>
        <p className="sec-p">Cómo se ha venido imprimiendo: resultados, material, tiempo y equipos.</p></div>
      <div className="grid k4">
        <Kpi l="Tasa de éxito" v={exito} s={`${fin.length} finalizadas`} cls="good" />
        <Kpi l="Material usado" v={`${nf(hist.reduce((a, h) => a + h.gramos, 0))} g`} s="total impreso" />
        <Kpi l="Horas de impresión" v={`${(Math.round(hist.reduce((a, h) => a + h.horas, 0) * 10) / 10).toLocaleString('es-CO')} h`} s="acumuladas" />
        <Kpi l="Desperdicio" v={`${nf(hist.reduce((a, h) => a + h.desperdicio, 0))} g`} s="material perdido" />
      </div>
      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard"><div className="chart-h">Horas de impresión por impresora</div><div className="chart-cap">Carga de trabajo de cada equipo.</div><Barras data={sumBy(hist, 'impresora', 'horas')} color="#a855f7" fmt={(v) => `${Math.round(v * 10) / 10} h`} /></div>
        <div className="dcard"><div className="chart-h">Material consumido por tipo</div><div className="chart-cap">Gramos usados por material — insumo para compras.</div><Barras data={sumBy(hist, 'material', 'gramos')} color="#10b981" fmt={(v) => `${nf(v)} g`} /></div>
      </div>
      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard"><div className="chart-h">Resultado de las impresiones</div><div className="chart-cap">Éxitos vs. fallos vs. en curso.</div><Donut data={countBy(hist, 'resultado')} colorMap={{ 'Exitoso': '#10b981', 'Fallido': '#f43f5e', '(en curso)': '#94a3b8' }} /></div>
        <div className="dcard"><div className="chart-h">Impresiones por mes</div><div className="chart-cap">Volumen de producción en el tiempo.</div><Columnas data={porMes(hist)} /></div>
      </div>

      {/* 4 · MANTENIMIENTO */}
      <div className="sec"><div className="sec-h"><h2>4 · Mantenimiento y equipos</h2><span className="tag tag-crit">Delicado</span></div>
        <p className="sec-p">Solo lo crítico: equipos que requieren atención, horas sin mantenimiento y stock por reponer.</p></div>
      <div className="grid k4">
        <Kpi l="Impresoras operativas" v={`${oper}/${datos.impresoras.length}`} s="listas para imprimir" cls={oper === datos.impresoras.length ? 'good' : ''} />
        <Kpi l="No disponibles" v={noDisp} s="en mant. o fuera de servicio" cls={noDisp ? 'warnb' : ''} />
        <Kpi l="Requieren mantenimiento" v={req} s={prox ? `+${prox} próximo(s)` : 'según lo programado'} cls={req ? 'crit' : 'good'} />
        <Kpi l="Rollos en umbral" v={rollosBajos} s="stock por reponer" cls={rollosBajos ? 'crit' : 'good'} />
      </div>
      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard">
          <div className="chart-h">Impresoras · estado y horas sin mantenimiento</div>
          <div className="chart-cap">Horas desde el último mantenimiento frente a su umbral.</div>
          {impVistas.map((e) => {
            const pct = Math.min(100, Math.round(e.ratio * 100));
            const col = e.al?.estado === 'vencido' ? '#f43f5e' : e.al?.estado === 'proximo' ? '#f59e0b' : '#10b981';
            return (
              <div className="lrow" key={e.imp.id}>
                <div className="ln">
                  <b>{e.imp.nombre}</b> <span className={`pill ${EST_PILL[e.imp.estado] || 'p-mut'}`}>{e.imp.estado}</span>
                  {e.al?.estado === 'vencido' && <span className="pill p-crit"> ⚠ Requiere mant.</span>}
                  {e.al?.estado === 'proximo' && <span className="pill p-warn"> ⏰ Próximo</span>}
                  <div className="lsub">{e.imp.modelo} · {e.imp.horasAcumuladas} h acum · {e.sub}</div>
                  <div className="mini-bar"><i style={{ width: `${pct}%`, background: col }} /></div>
                </div>
                <span className="lval">{e.valor}</span>
              </div>
            );
          })}
        </div>
        <div className="dcard">
          <div className="chart-h">Stock crítico de filamento</div>
          <div className="chart-cap">Rollos en o bajo su umbral de reposición.</div>
          {stock.length ? stock.map((f) => {
            const crit = f.gramos <= f.umbral;
            return (
              <div className="lrow" key={f.id}>
                <div className="ln"><b>{f.id} · {f.tipo} {f.color}</b><div className="lsub">{f.marca} · umbral {f.umbral} g</div></div>
                <span className={`pill ${crit ? 'p-crit' : 'p-warn'}`}>{crit ? 'En umbral' : 'Por vigilar'}</span>
                <span className="lval">{Math.round(f.gramos)} g</span>
              </div>
            );
          }) : <p className="empty">✓ Sin rollos por debajo del umbral.</p>}
        </div>
      </div>
      <div className="grid" style={{ marginTop: 14 }}>
        <div className="dcard">
          <div className="chart-h">Últimos mantenimientos</div>
          <div className="chart-cap">Historial reciente de intervenciones en los equipos.</div>
          {datos.mantenimientos.length ? datos.mantenimientos.slice(0, 6).map((m, i) => (
            <div className="lrow" key={i}>
              <span className={`pill ${TIPO_PILL[m.tipo] || 'p-mut'}`}>{m.tipo}</span>
              <div className="ln"><b>{nombreImp(m.impresoraId)}</b> — {m.descripcion}<div className="lsub">{m.responsable || '—'} · {m.costo ? formatCOP(m.costo) : '—'}</div></div>
              <span className="lval">{m.fecha}</span>
            </div>
          )) : <p className="empty">Sin mantenimientos registrados.</p>}
        </div>
      </div>
    </div>
  );
}
