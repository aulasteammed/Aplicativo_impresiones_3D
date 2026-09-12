'use client';

// Sección 2 · Análisis de la demanda — volumen en el tiempo, quién solicita y para qué.

import { Barras, Columnas, Donut } from './graficos';
import { SeccionColapsable } from './SeccionColapsable';
import { Punto, PuntoMes } from './tipos';

// Colores propios (en vez de la paleta categórica genérica) para que estos dos
// donuts combinen con el resto de la sección — cubren los valores del catálogo
// cerrado de cada dimensión (ver CATALOGOS_DASHBOARD en lib/util.ts); cualquier
// valor fuera de catálogo ("Otros", etc.) cae de vuelta a la paleta genérica.
const ROL_COL: Record<string, string> = {
  'Estudiante': '#1b1472',
  'Profesor(a)': '#f49600',
  'Egresado(a)': '#6e64e4',
  'Contratista': '#ffb43c',
  'Empleado(a)': '#94a3b8',
  'Público externo': '#3427d9',
};
const SERVICIO_COL: Record<string, string> = {
  'Impresión 3D': '#1b1472',
  'Modelado 3D': '#f49600',
  'Modelado 3D e Impresión 3D': '#6e64e4',
};

export function SeccionDemanda({ totalSolicitudes, porMesSol, porRol, porMotivo, porPrograma, porServicio, top }: {
  totalSolicitudes: number;
  porMesSol: PuntoMes[];
  porRol: Punto[];
  porMotivo: Punto[];
  porPrograma: Punto[];
  porServicio: Punto[];
  top: [string, number][];
}) {
  return (
    <SeccionColapsable
      id="demanda" numero={2} titulo="Análisis de la demanda"
      descripcion="Volumen en el tiempo, quién solicita y para qué."
      resumen={`${totalSolicitudes} solicitudes con los filtros actuales`}
    >
      <div className="grid c2">
        <div className="dcard"><div className="chart-h">Solicitudes por mes</div><div className="chart-cap">Tendencia de demanda para anticipar meses pico.</div><Columnas data={porMesSol} color="#f49600" /></div>
        <div className="dcard"><div className="chart-h">Por rol del solicitante</div><div className="chart-cap">A quién sirve el aula.</div><Donut data={porRol} colorMap={ROL_COL} /></div>
      </div>
      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard"><div className="chart-h">Por motivo de la solicitud</div><div className="chart-cap">Para qué se usa la impresión.</div><Barras data={porMotivo} color="#1b1472" /></div>
        <div className="dcard"><div className="chart-h">Por programa académico</div><div className="chart-cap">Qué carreras concentran la demanda (top 8).</div><Barras data={porPrograma} color="#6e64e4" /></div>
      </div>
      <div className="grid c2" style={{ marginTop: 14 }}>
        <div className="dcard"><div className="chart-h">Por tipo de servicio</div><div className="chart-cap">Impresión vs. modelado.</div><Donut data={porServicio} colorMap={SERVICIO_COL} /></div>
        <div className="dcard"><div className="chart-h">Top solicitantes recurrentes</div><div className="chart-cap">Quiénes vuelven más — respeta los filtros activos.</div>
          {top.length ? top.map((t, i) => (
            <div className="trow" key={t[0]}><span className="rank">{i + 1}</span><div className="tn">{t[0]}<div className="ts">{t[1]} solicitud{t[1] > 1 ? 'es' : ''}</div></div><span className="tv num">{t[1]}</span></div>
          )) : <p className="empty">Sin registros con estos filtros.</p>}
        </div>
      </div>
    </SeccionColapsable>
  );
}
