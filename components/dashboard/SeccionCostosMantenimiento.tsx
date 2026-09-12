'use client';

// Sección 5 · Costos de mantenimiento — con su propia barra de filtros (Año,
// Impresora, Tipo, Responsable) que recalcula KPIs y gráficos en el cliente.

import { useMemo, useState } from 'react';
import { formatCOP } from '@/lib/util';
import { Impresora, Mantenimiento } from '@/lib/types';
import { capMant, MESES } from './constantes';
import { useCerrarAlClicFuera } from './filtros';
import { FiltroMulti } from './filtros';
import { Barras, Columnas, Donut, Kpi } from './graficos';
import { Punto, PuntoMes } from './tipos';

type RegMant = { ano: string; impresora: string; naturaleza: string; categoria: string; responsable: string; desc: string; fecha: string; costo: number };
const DIMS_MANT: [string, string][] = [['ano', 'Año'], ['impresora', 'Impresora'], ['naturaleza', 'Naturaleza'], ['categoria', 'Categoría'], ['responsable', 'Responsable']];
const NAT_ORDEN = ['Preventivo', 'Correctivo'];
const NAT_COL: Record<string, string> = { 'Preventivo': '#6366f1', 'Correctivo': '#f43f5e' };
const CAT_ORDEN = ['Consumible', 'Repuesto', 'Servicio', 'Sin gasto'];
const CAT_COL: Record<string, string> = { 'Consumible': '#a855f7', 'Repuesto': '#f59e0b', 'Servicio': '#14b8a6', 'Sin gasto': '#94a3b8' };
const copCorto = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
const kCop = (n: number) => `$${Math.round(n / 1000)}k`;
const valDimMant = (r: RegMant, d: string) => (d === 'ano' ? r.ano : d === 'impresora' ? r.impresora : d === 'naturaleza' ? r.naturaleza : d === 'categoria' ? r.categoria : r.responsable);

export function SeccionCostosMantenimiento({ mantenimientos, impresoras }: { mantenimientos: Mantenimiento[]; impresoras: Impresora[] }) {
  const [filtros, setFiltros] = useState<Record<string, Set<string>>>({});
  const [abierto, setAbierto] = useState<string | null>(null);
  const barraRef = useCerrarAlClicFuera(setAbierto);

  const nombreImp = (id: string) => impresoras.find((i) => i.id === id)?.nombre || id || '(sin impresora)';

  const registros: RegMant[] = useMemo(() => mantenimientos.map((m) => ({
    ano: String(m.fecha || '').slice(0, 4) || '(sin fecha)',
    impresora: nombreImp(m.impresoraId),
    naturaleza: capMant(m.naturaleza || '(sin naturaleza)'),
    categoria: m.categoria ? capMant(m.categoria) : 'Sin gasto',
    responsable: m.responsable || '(sin responsable)',
    desc: m.descripcion || 'Mantenimiento',
    fecha: m.fecha || '',
    costo: Number(m.costo) || 0,
  })), [mantenimientos, impresoras]); // eslint-disable-line react-hooks/exhaustive-deps

  const opciones = useMemo(() => {
    const o: Record<string, string[]> = {};
    for (const [k] of DIMS_MANT) o[k] = Array.from(new Set(registros.map((r) => valDimMant(r, k)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    return o;
  }, [registros]);

  const setDim = (dim: string) => (next: Set<string> | null) =>
    setFiltros((prev) => { const c = { ...prev }; if (next == null) delete c[dim]; else c[dim] = next; return c; });

  const rows = useMemo(() => registros.filter((r) => {
    for (const d in filtros) { const s = filtros[d]; if (s && !s.has(valDimMant(r, d))) return false; }
    return true;
  }), [registros, filtros]);

  const total = rows.reduce((a, r) => a + r.costo, 0);
  const n = rows.length;
  const top = [...rows].sort((a, b) => b.costo - a.costo);
  const maxRec = top[0];

  const agrupa = (keyFn: (r: RegMant) => string): Punto[] => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(keyFn(r), (m.get(keyFn(r)) || 0) + r.costo));
    return Array.from(m.entries()).map(([l, v]) => ({ l, v }));
  };
  const porImp = agrupa((r) => r.impresora);
  const grupoOrdenado = (orden: string[], keyFn: (r: RegMant) => string): Punto[] => {
    const presentes = Array.from(new Set(rows.map(keyFn)));
    const ord = [...orden.filter((t) => presentes.includes(t)), ...presentes.filter((t) => !orden.includes(t))];
    return ord.map((t) => ({ l: t, v: rows.filter((r) => keyFn(r) === t).reduce((a, r) => a + r.costo, 0) }));
  };
  const porCategoria = grupoOrdenado(CAT_ORDEN, (r) => r.categoria);
  const porNaturaleza = grupoOrdenado(NAT_ORDEN, (r) => r.naturaleza);
  const porMesMap = new Map<string, number>();
  rows.forEach((r) => { const ym = String(r.fecha).slice(0, 7); if (ym.length === 7) porMesMap.set(ym, (porMesMap.get(ym) || 0) + r.costo); });
  const porMes: PuntoMes[] = Array.from(porMesMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, v]) => { const [y, mo] = ym.split('-'); return { m: MESES[mo] || mo, y, v }; });

  const hayFiltros = Object.keys(filtros).length > 0;
  const fechaCorta = (f: string) => { const p = String(f).split('-'); return p.length === 3 ? `${+p[2]} ${MESES[p[1]] || p[1]} ${p[0]}` : (f || '—'); };

  return (
    <>
      <div className="sec"><div className="sec-h"><h2>5 · Costos de mantenimiento</h2><span className="tag" style={{ background: '#eef0fe', color: '#4f46e5' }}>COP</span></div>
        <p className="sec-p">Cuánto cuesta mantener los equipos: gasto acumulado, por equipo, por categoría de gasto, por naturaleza y su evolución en el tiempo.</p></div>

      <div className="filtros" ref={barraRef}>
        <span className="flab">Filtros</span>
        {DIMS_MANT.map(([k, label]) => (
          <FiltroMulti key={k} dim={k} label={label} opciones={opciones[k] || []} sel={filtros[k]}
            abierto={abierto === k} onAbrir={() => setAbierto((a) => (a === k ? null : k))} onSet={setDim(k)} />
        ))}
        {hayFiltros && <button className="clr" onClick={() => { setFiltros({}); setAbierto(null); }}>Limpiar filtros</button>}
      </div>

      <div className="grid k4">
        <Kpi l="Costo total" v={formatCOP(total)} s="Valor acumulado de los mantenimientos registrados." cls="acc" />
        <Kpi l="N.º de mantenimientos" v={n} s="Cantidad total de mantenimientos registrados." />
        <Kpi l="Promedio por registro" v={n ? formatCOP(Math.round(total / n)) : '$ 0'} s="Costo promedio por mantenimiento registrado." />
        <Kpi l="Ticket más alto" v={maxRec ? formatCOP(maxRec.costo) : '$ 0'} s="Mayor costo registrado en un mantenimiento." />
      </div>

      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard">
          <div className="chart-h">Costo por impresora</div>
          <div className="chart-cap">Qué equipo concentra el gasto de mantenimiento.</div>
          <Barras data={porImp} color="linear-gradient(90deg,#6366f1,#a855f7)" fmt={formatCOP} wide />
        </div>
        <div className="dcard">
          <div className="chart-h">Costo por categoría de gasto</div>
          <div className="chart-cap">En qué se va el dinero: consumibles, repuestos, servicio.</div>
          <Donut data={porCategoria} colorMap={CAT_COL} fmt={formatCOP} centro={copCorto(total)} />
        </div>
      </div>

      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard">
          <div className="chart-h">Costo por naturaleza</div>
          <div className="chart-cap">Cuánto se gasta en prevención vs. en corregir fallas.</div>
          <Donut data={porNaturaleza} colorMap={NAT_COL} fmt={formatCOP} centro={copCorto(total)} />
        </div>
        <div className="dcard">
          <div className="chart-h">Costo por mes</div>
          <div className="chart-cap">Evolución del gasto de mantenimiento en los últimos meses.</div>
          <Columnas data={porMes} fmt={kCop} />
        </div>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        <div className="dcard">
          <div className="chart-h">Mantenimientos más costosos</div>
          <div className="chart-cap">Los registros individuales de mayor valor.</div>
          {top.length ? top.slice(0, 5).map((r, i) => (
            <div className="lrow" key={i}>
              <span className="rank">{i + 1}</span>
              <div className="ln"><b>{r.desc}</b><div className="lsub">{r.impresora} · {fechaCorta(r.fecha)}</div></div>
              <span className="lval num">{formatCOP(r.costo)}</span>
            </div>
          )) : <p className="empty">Sin registros de mantenimiento.</p>}
        </div>
      </div>
    </>
  );
}
