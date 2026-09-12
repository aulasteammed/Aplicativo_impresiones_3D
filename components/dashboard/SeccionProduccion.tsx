'use client';

// Sección 3 · Producción e impresión — resultados, material, tiempo y equipos.

import { nf } from './constantes';
import { Barras, Columnas, Donut, Kpi } from './graficos';
import { Punto, PuntoMes } from './tipos';

const COLOR_RESULTADO: Record<string, string> = { 'Exitoso': '#10b981', 'Fallido': '#f43f5e', '(en curso)': '#94a3b8' };

export function SeccionProduccion({
  finCount, exito, matUsado, horasImpresion, desperdicioTotal, horasPorImpresora, materialPorTipo, porResultado, porMesHist,
}: {
  finCount: number;
  exito: string;
  matUsado: number;
  horasImpresion: number;
  desperdicioTotal: number;
  horasPorImpresora: Punto[];
  materialPorTipo: Punto[];
  porResultado: Punto[];
  porMesHist: PuntoMes[];
}) {
  return (
    <>
      <div className="sec"><div className="sec-h"><h2>3 · Producción e impresión</h2><span className="tag tag-live">En vivo</span></div>
        <p className="sec-p">Cómo se ha venido imprimiendo: resultados, material, tiempo y equipos.</p></div>
      <div className="grid k4">
        <Kpi l="Tasa de éxito" v={exito} s={`${finCount} finalizadas`} cls="good" />
        <Kpi l="Material usado" v={`${nf(matUsado)} g`} s="total impreso (finalizadas)" />
        <Kpi l="Horas de impresión" v={`${(Math.round(horasImpresion * 10) / 10).toLocaleString('es-CO')} h`} s="acumuladas (finalizadas)" />
        <Kpi l="Desperdicio" v={`${nf(desperdicioTotal)} g`} s="material perdido" />
      </div>
      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard"><div className="chart-h">Horas de impresión por impresora</div><div className="chart-cap">Carga de trabajo de cada equipo.</div><Barras data={horasPorImpresora} color="#a855f7" fmt={(v) => `${Math.round(v * 10) / 10} h`} /></div>
        <div className="dcard"><div className="chart-h">Material consumido por tipo</div><div className="chart-cap">Gramos usados por material — insumo para compras.</div><Barras data={materialPorTipo} color="#10b981" fmt={(v) => `${nf(v)} g`} /></div>
      </div>
      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard"><div className="chart-h">Resultado de las impresiones</div><div className="chart-cap">Éxitos vs. fallos vs. en curso.</div><Donut data={porResultado} colorMap={COLOR_RESULTADO} /></div>
        <div className="dcard"><div className="chart-h">Impresiones por mes</div><div className="chart-cap">Volumen de producción en el tiempo.</div><Columnas data={porMesHist} /></div>
      </div>
    </>
  );
}
