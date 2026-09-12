'use client';

// Sección 4 · Mantenimiento y equipos — solo lo crítico: equipos que requieren
// atención, horas sin mantenimiento y stock por reponer.

import { formatCOP } from '@/lib/util';
import { Impresora, Mantenimiento } from '@/lib/types';
import { capMant } from './constantes';
import { Kpi } from './graficos';
import { SeccionColapsable } from './SeccionColapsable';
import { ImpresoraVista, StockFilamento } from './tipos';

const EST_PILL: Record<string, string> = { 'Operativa': 'p-ok', 'Mantenimiento': 'p-warn', 'Fuera de servicio': 'p-crit' };
const NAT_PILL: Record<string, string> = { 'preventivo': 'p-ok', 'correctivo': 'p-warn' };

export function SeccionMantenimiento({
  totalImpresoras, oper, noDisp, req, prox, rollosBajos, impVistas, stock, impresoras, mantenimientos,
}: {
  totalImpresoras: number;
  oper: number;
  noDisp: number;
  req: number;
  prox: number;
  rollosBajos: number;
  impVistas: ImpresoraVista[];
  stock: StockFilamento[];
  impresoras: Impresora[];
  mantenimientos: Mantenimiento[];
}) {
  const nombreImp = (id: string) => impresoras.find((i) => i.id === id)?.nombre || id;

  const resumen = `${oper}/${totalImpresoras} operativas · ${req} requieren mantenimiento`;

  return (
    <SeccionColapsable
      id="mantenimiento" numero={4} titulo="Mantenimiento y equipos"
      tag={<span className="tag tag-crit">Delicado</span>}
      descripcion="Solo lo crítico: equipos que requieren atención, horas sin mantenimiento y stock por reponer."
      resumen={resumen}
      abiertoPorDefecto
    >
      <div className="grid k4">
        <Kpi l="Impresoras operativas" v={`${oper}/${totalImpresoras}`} s="listas para imprimir" cls={oper === totalImpresoras ? 'good' : ''} />
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
          {mantenimientos.length ? mantenimientos.slice(0, 6).map((m, i) => (
            <div className="lrow" key={i}>
              <span className={`pill ${NAT_PILL[m.naturaleza] || 'p-mut'}`}>{m.naturaleza || '—'}</span>
              <div className="ln"><b>{nombreImp(m.impresoraId)}</b> — {m.descripcion}<div className="lsub">{m.categoria ? `${capMant(m.categoria)} · ` : ''}{m.responsable || '—'} · {m.costo ? formatCOP(m.costo) : '—'}</div></div>
              <span className="lval">{m.fecha}</span>
            </div>
          )) : <p className="empty">Sin mantenimientos registrados.</p>}
        </div>
      </div>
    </SeccionColapsable>
  );
}
