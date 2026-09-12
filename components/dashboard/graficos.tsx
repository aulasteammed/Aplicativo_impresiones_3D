'use client';

// Piezas visuales del Dashboard: KPI, barras horizontales, columnas y donut.
// Todas son puramente presentacionales — reciben datos ya agregados.

import { PAL } from './constantes';
import { Punto, PuntoMes } from './tipos';

export function Kpi({ l, v, s, cls }: { l: string; v: string | number; s?: string; cls?: string }) {
  return (
    <div className={`dcard kpi ${cls || ''}`}>
      <div className="kl">{l}</div>
      <div className="kv num">{v}</div>
      {s && <div className="ks">{s}</div>}
    </div>
  );
}

export function Barras({ data, color, fmt, wide }: { data: Punto[]; color?: string; fmt?: (v: number) => string; wide?: boolean }) {
  const top = [...data].sort((a, b) => b.v - a.v).slice(0, 8);
  const max = Math.max(1, ...top.map((d) => d.v));
  if (!top.length) return <p className="empty">Sin datos.</p>;
  return (
    <div className="bars">
      {top.map((d, i) => (
        <div className="bar-row" key={d.l} style={wide ? { gridTemplateColumns: '120px 1fr 92px' } : undefined}>
          <div className="bl" title={d.l}>{d.l}</div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(d.v / max) * 100}%`, background: color || PAL[i % PAL.length] }} /></div>
          <div className="bv num">{fmt ? fmt(d.v) : d.v}</div>
        </div>
      ))}
    </div>
  );
}

export function Columnas({ data, fmt }: { data: PuntoMes[]; fmt?: (v: number) => string }) {
  if (!data.length) return <p className="empty">Sin datos.</p>;
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="cols">
      {data.map((d) => (
        <div className="col" key={d.m + d.y}>
          <div className="cplot"><div className="cval num">{fmt ? fmt(d.v) : d.v}</div><div className="cbar" style={{ height: `${Math.max(3, Math.round((d.v / max) * 112))}px` }} /></div>
          <div className="cl">{d.m}<span className="cy">{d.y}</span></div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ data, colorMap, fmt, centro }: { data: Punto[]; colorMap?: Record<string, string>; fmt?: (v: number) => string; centro?: string }) {
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
        <text x="64" y="60" textAnchor="middle" fontSize={centro ? 13 : 22} fontWeight="800" fill="#1f2440">{centro ?? total}</text>
        <text x="64" y="76" textAnchor="middle" fontSize="10" fill="#9aa1b2">total</text>
      </svg>
      <div className="dlegend">
        {d.length ? d.map((x, i) => (
          <div className="dr" key={x.l}>
            <span className="dn"><i className="dot" style={{ background: (colorMap && colorMap[x.l]) || PAL[i % PAL.length] }} />{x.l}</span>
            <span className="dv num">{fmt ? fmt(x.v) : x.v}</span>
          </div>
        )) : <span className="empty">Sin datos.</span>}
      </div>
    </div>
  );
}
