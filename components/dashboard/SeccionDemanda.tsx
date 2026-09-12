'use client';

// Sección 2 · Análisis de la demanda — volumen en el tiempo, quién solicita y para qué.

import { Barras, Columnas, Donut } from './graficos';
import { Punto, PuntoMes } from './tipos';

export function SeccionDemanda({ porMesSol, porRol, porMotivo, porPrograma, porServicio, top }: {
  porMesSol: PuntoMes[];
  porRol: Punto[];
  porMotivo: Punto[];
  porPrograma: Punto[];
  porServicio: Punto[];
  top: [string, number][];
}) {
  return (
    <>
      <div className="sec"><div className="sec-h"><h2>2 · Análisis de la demanda</h2></div>
        <p className="sec-p">Volumen en el tiempo, quién solicita y para qué.</p></div>
      <div className="grid c2">
        <div className="dcard"><div className="chart-h">Solicitudes por mes</div><div className="chart-cap">Tendencia de demanda para anticipar meses pico.</div><Columnas data={porMesSol} /></div>
        <div className="dcard"><div className="chart-h">Por rol del solicitante</div><div className="chart-cap">A quién sirve el aula.</div><Donut data={porRol} /></div>
      </div>
      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard"><div className="chart-h">Por motivo de la solicitud</div><div className="chart-cap">Para qué se usa la impresión.</div><Barras data={porMotivo} color="#6366f1" /></div>
        <div className="dcard"><div className="chart-h">Por programa académico</div><div className="chart-cap">Qué carreras concentran la demanda (top 8).</div><Barras data={porPrograma} color="#5b53e0" /></div>
      </div>
      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard"><div className="chart-h">Por tipo de servicio</div><div className="chart-cap">Impresión vs. modelado.</div><Donut data={porServicio} /></div>
        <div className="dcard"><div className="chart-h">Top solicitantes recurrentes</div><div className="chart-cap">Quiénes vuelven más — respeta los filtros activos.</div>
          {top.length ? top.map((t, i) => (
            <div className="trow" key={t[0]}><span className="rank">{i + 1}</span><div className="tn">{t[0]}<div className="ts">{t[1]} solicitud{t[1] > 1 ? 'es' : ''}</div></div><span className="tv num">{t[1]}</span></div>
          )) : <p className="empty">Sin registros con estos filtros.</p>}
        </div>
      </div>
    </>
  );
}
