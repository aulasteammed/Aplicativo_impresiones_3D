'use client';

// Ventana 1 — Dashboard: indicadores clave del aplicativo

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DashboardData } from '@/lib/types';
import { Aviso, BotonRecargar, Chip, KpiCard, useDatos } from '@/components/ui';

export default function Dashboard() {
  const { datos, cargando, error, recargar } = useDatos<DashboardData>('/api/dashboard');

  if (error) return <Aviso tipo="error">Error cargando el dashboard: {error}</Aviso>;
  if (cargando || !datos) return <p className="text-slate-500">Cargando dashboard…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">Resumen general del Aula STEAM — Impresión 3D</p>
        </div>
        <BotonRecargar onClick={recargar} cargando={cargando} />
      </div>

      {datos.esDemo && (
        <Aviso tipo="info">
          <b>Modo demo:</b> la app está mostrando datos de ejemplo. Configure las credenciales de Google en{' '}
          <code className="rounded bg-blue-100 px-1">.env.local</code> (ver README.md) para conectar los Google Sheets reales.
        </Aviso>
      )}

      {datos.alertasStock.length > 0 && (
        <Aviso tipo="alerta">
          <b>⚠ Stock bajo de filamento:</b>{' '}
          {datos.alertasStock.map((a) => `${a.tipo} ${a.color} (${a.filamentoId}: ${a.gramosRestantes} g, umbral ${a.umbral} g)`).join(' · ')}
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard titulo="Solicitudes nuevas sin responder" valor={datos.solicitudesNuevas} sub="estado: Nueva" acento={datos.solicitudesNuevas > 0} />
        <KpiCard titulo="Solicitudes totales" valor={datos.solicitudesTotal} sub={`${datos.solicitudesEnRevision} en revisión`} />
        <KpiCard
          titulo="Tasa de éxito"
          valor={datos.tasaExito === null ? '—' : `${datos.tasaExito}%`}
          sub={`${datos.totalFinalizadas} impresiones finalizadas · ${datos.desperdicioTotal} g desperdiciados`}
        />
        <KpiCard titulo="Material consumido (mes)" valor={`${datos.materialConsumidoMes} g`} sub="según movimientos de inventario" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-semibold">Tiempo total de impresión por impresora (h)</h2>
          {datos.tiempoPorImpresora.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay tiempos registrados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={datos.tiempoPorImpresora}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="impresora" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v} h`, 'Tiempo']} />
                <Bar dataKey="horas" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 font-semibold">Próximas fechas tentativas de entrega</h2>
          {datos.proximasEntregas.length === 0 ? (
            <p className="text-sm text-slate-500">Sin solicitudes pendientes.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {datos.proximasEntregas.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.nombre}</p>
                    <p className="truncate text-xs text-slate-500">{e.pieza}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-slate-500">{e.fecha}</span>
                    <Chip valor={e.estado} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Proyectos de impresión activos</h2>
        {datos.proyectosActivos.length === 0 ? (
          <p className="text-sm text-slate-500">No hay proyectos activos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Código</th>
                  <th className="th">Proyecto</th>
                  <th className="th">Impresora</th>
                  <th className="th">Solicitudes</th>
                  <th className="th">Material (g)</th>
                  <th className="th">Tiempo (h)</th>
                  <th className="th">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datos.proyectosActivos.map((p) => (
                  <tr key={p.codigo}>
                    <td className="td font-mono text-xs">{p.codigo}</td>
                    <td className="td font-medium">{p.nombre}</td>
                    <td className="td">{p.impresora}</td>
                    <td className="td">{p.items.length}</td>
                    <td className="td">{Math.round(p.items.reduce((a, i) => a + i.gramos, 0))}</td>
                    <td className="td">{Math.round(p.items.reduce((a, i) => a + i.tiempoHoras, 0) * 10) / 10}</td>
                    <td className="td"><Chip valor={p.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
