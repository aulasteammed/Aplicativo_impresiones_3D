'use client';

// Sección 1 · Estado actual de la operación — foto "en vivo", no depende de los filtros.

import { CEST, nf } from './constantes';
import { Kpi } from './graficos';
import { Cama } from './tipos';

const CAMA_PILL: Record<string, string> = { 'Activa': 'p-ok', 'En pausa': 'p-warn' };
const ETAPAS_EMBUDO = ['Nueva', 'En Revisión', 'Aprobada', 'Atendida', 'Rechazada'];

export function SeccionEstadoActual({
  estVivo, vencidas, aprob, resueltas, nActivas, nPausa, gCurso, hCurso, totalCamas, camLista,
}: {
  estVivo: Record<string, number>;
  vencidas: number;
  aprob: number;
  resueltas: number;
  nActivas: number;
  nPausa: number;
  gCurso: number;
  hCurso: number;
  totalCamas: number;
  camLista: Cama[];
}) {
  return (
    <>
      <div className="sec"><div className="sec-h"><h2>1 · Estado actual de la operación</h2><span className="tag tag-live">En vivo</span></div>
        <p className="sec-p">Lo que necesita atención — la primera lectura al abrir la app. Refleja el estado presente y no depende de los filtros.</p></div>

      <div className="subhdr">Solicitudes de servicio</div>
      <div className="grid k4">
        <Kpi l="Nuevas sin responder" v={estVivo['Nueva']} s="estado «Nueva»" cls="acc" />
        <Kpi l="Pendientes vencidas" v={vencidas} s="fecha tentativa ya pasó" cls="crit" />
        <Kpi l="En revisión" v={estVivo['En Revisión']} s="esperando decisión" cls="warnb" />
        <Kpi l="Tasa de aprobación" v={resueltas ? `${Math.round((aprob / resueltas) * 100)}%` : '—'} s={`${aprob} de ${resueltas} resueltas`} />
      </div>
      <div className="grid" style={{ marginTop: 14 }}>
        <div className="dcard">
          <div className="chart-h">Embudo de solicitudes</div>
          <div className="chart-cap">Dónde se acumulan las solicitudes en el proceso.</div>
          <div className="pipe">
            {ETAPAS_EMBUDO.map((e, i, arr) => (
              <div className="stage" key={e} style={e === 'Rechazada' ? { background: '#fff5f6', borderColor: '#ffdbe0' } : undefined}>
                <div className="sn" style={{ color: CEST[e] }}>{e}</div>
                <div className="sv num">{estVivo[e]}</div>
                {i < arr.length - 1 && <span className="arrow">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="subhdr">Camas de impresión</div>
      <div className="grid k4">
        <Kpi l="Camas activas" v={nActivas} s="imprimiendo ahora" cls="acc" />
        <Kpi l="En pausa" v={nPausa} s="requieren decisión" cls={nPausa ? 'warnb' : ''} />
        <Kpi l="Material en curso" v={`${nf(gCurso)} g`} s={`${totalCamas} camas sin finalizar`} />
        <Kpi l="Horas en curso" v={`${(Math.round(hCurso * 10) / 10).toLocaleString('es-CO')} h`} s="carga activa estimada" />
      </div>
      <div className="grid" style={{ marginTop: 14 }}>
        <div className="dcard">
          <div className="chart-h">Camas en curso ahora</div>
          <div className="chart-cap">Lo que está montado en las camas en este momento — activas y en pausa.</div>
          {camLista.length ? camLista.map((c) => (
            <div className="lrow" key={c.codigo}>
              <span className={`pill ${CAMA_PILL[c.estado] || 'p-mut'}`}>{c.estado}</span>
              <div className="ln"><b>{c.codigo}</b><div className="lsub">{c.impresora === '(sin dato)' ? 'Impresora sin asignar' : c.impresora} · {c.piezas} pieza{c.piezas === 1 ? '' : 's'}{c.materiales.size ? ` · ${Array.from(c.materiales).join(', ')}` : ''}</div></div>
              <span className="lval">{c.gramos ? `${nf(c.gramos)} g` : '—'}{c.horas ? ` · ${Math.round(c.horas * 10) / 10} h` : ''}</span>
            </div>
          )) : <p className="empty">Sin camas activas o en pausa en este momento.</p>}
        </div>
      </div>
    </>
  );
}
