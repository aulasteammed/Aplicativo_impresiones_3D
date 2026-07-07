'use client';

// Ventana 4 — Historial de impresiones ejecutadas (solo lectura del Sheets de historial)

import { useEffect, useMemo, useState } from 'react';
import { RegistroHistorial } from '@/lib/types';
import { Aviso, BarraBusqueda, BotonRecargar, Chip, KpiCard, Modal, Paginacion, useDatos } from '@/components/ui';
import { num, esCamaEnCurso } from '@/lib/util';

export default function PaginaHistorial() {
  const { datos, cargando, error, recargar } = useDatos<{ registros: RegistroHistorial[] }>('/api/historial');
  const [busqueda, setBusqueda] = useState('');
  const [filtroResultado, setFiltroResultado] = useState('');
  const [filtroMaterial, setFiltroMaterial] = useState('');
  const [detalle, setDetalle] = useState<RegistroHistorial | null>(null);

  const registros = datos?.registros ?? [];
  // Solo impresiones finalizadas: las camas Activa/En pausa viven en "Camas de impresión".
  const historicos = useMemo(() => registros.filter((r) => !esCamaEnCurso(r.estado)), [registros]);
  const materiales = useMemo(() => Array.from(new Set(historicos.map((r) => r.material).filter(Boolean))), [historicos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return historicos.filter((r) => {
      if (filtroResultado && r.resultado !== filtroResultado) return false;
      if (filtroMaterial && r.material !== filtroMaterial) return false;
      if (!q) return true;
      return [r.codigo, r.nombre, r.correo, r.descripcionPieza, r.impresora, r.filamentoId]
        .some((c) => (c ?? '').toLowerCase().includes(q));
    });
  }, [historicos, busqueda, filtroResultado, filtroMaterial]);

  // Paginación
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(20);
  useEffect(() => { setPagina(1); }, [busqueda, filtroResultado, filtroMaterial, tamano]);
  const paginaActual = Math.min(pagina, Math.max(1, Math.ceil(filtrados.length / tamano)));
  const paginados = filtrados.slice((paginaActual - 1) * tamano, paginaActual * tamano);

  const finalizadas = historicos.filter((r) => r.resultado);
  const exitosas = finalizadas.filter((r) => r.resultado === 'Exitoso').length;
  const desperdicioTotal = Math.round(historicos.reduce((a, r) => a + num(r.desperdicio), 0));
  const materialTotal = Math.round(historicos.reduce((a, r) => a + num(r.gramos), 0));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Historial de impresiones</h1>
          <p className="text-sm text-slate-500">Impresiones finalizadas — las camas activas o en pausa están en &quot;Camas de impresión&quot;</p>
        </div>
        <BotonRecargar onClick={recargar} cargando={cargando} />
      </div>

      {error && <Aviso tipo="error">Error: {error}</Aviso>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard titulo="Registros" valor={historicos.length} />
        <KpiCard titulo="Tasa de éxito" valor={finalizadas.length ? `${Math.round((exitosas / finalizadas.length) * 100)}%` : '—'} sub={`${finalizadas.length} con resultado`} />
        <KpiCard titulo="Material impreso" valor={`${materialTotal} g`} />
        <KpiCard titulo="Desperdicio total" valor={`${desperdicioTotal} g`} />
      </div>

      <div className="card">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <BarraBusqueda valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por código, solicitante, pieza…" />
          <select className="input" value={filtroResultado} onChange={(e) => setFiltroResultado(e.target.value)}>
            <option value="">Todos los resultados</option>
            <option>Exitoso</option>
            <option>Fallido</option>
          </select>
          <select className="input" value={filtroMaterial} onChange={(e) => setFiltroMaterial(e.target.value)}>
            <option value="">Todos los materiales</option>
            {materiales.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>

        {cargando && !datos ? (
          <p className="py-8 text-center text-slate-500">Cargando historial…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Cama</th>
                  <th className="th">Solicitante</th>
                  <th className="th">Pieza</th>
                  <th className="th">Impresora</th>
                  <th className="th">Tiempo (h)</th>
                  <th className="th">Material</th>
                  <th className="th">Estado</th>
                  <th className="th">Resultado</th>
                  <th className="th">Desperdicio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginados.map((r, i) => (
                  <tr key={`${r.fila}-${i}`} className="cursor-pointer transition hover:bg-steam-50" onClick={() => setDetalle(r)}>
                    <td className="td whitespace-nowrap font-mono text-xs">{r.codigo || '—'}</td>
                    <td className="td font-medium">{r.nombre}</td>
                    <td className="td max-w-[240px] truncate" title={r.descripcionPieza}>{r.descripcionPieza}</td>
                    <td className="td">{r.impresora || '—'}</td>
                    <td className="td">{r.tiempoHoras || '—'}</td>
                    <td className="td">{r.gramos ? `${r.gramos} g · ` : ''}{r.material || '—'}</td>
                    <td className="td"><Chip valor={r.estado || '—'} /></td>
                    <td className="td">{r.resultado ? <Chip valor={r.resultado} /> : '—'}</td>
                    <td className="td">{r.desperdicio ? `${r.desperdicio} g` : '—'}</td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={9} className="td py-8 text-center text-slate-500">Sin registros que coincidan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {(!cargando || datos) && <Paginacion total={filtrados.length} pagina={paginaActual} tamano={tamano} onPagina={setPagina} onTamano={setTamano} />}
      </div>

      <Modal abierto={!!detalle} onCerrar={() => setDetalle(null)} titulo={`Registro — ${detalle?.codigo || 'sin código'}`} ancho="max-w-3xl">
        {detalle && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Campo etiqueta="Cama" valor={detalle.codigo || 'sin código'} />
            <Campo etiqueta="Filamento (inventario)" valor={detalle.filamentoId || '—'} />
            <Campo etiqueta="Marca temporal solicitud" valor={detalle.marcaTemporal} />
            <Campo etiqueta="Solicitante" valor={detalle.nombre} />
            <Campo etiqueta="Correo" valor={detalle.correo} />
            <Campo etiqueta="Rol / Programa" valor={`${detalle.rol || '—'} / ${detalle.programa || '—'}`} />
            <Campo etiqueta="Motivo" valor={detalle.motivo} />
            <div className="col-span-2"><Campo etiqueta="Pieza" valor={detalle.descripcionPieza} /></div>
            <div className="col-span-2"><Campo etiqueta="Objetivo" valor={detalle.objetivoPieza} /></div>
            <Campo etiqueta="Impresora" valor={detalle.impresora} />
            <Campo etiqueta="Tiempo / Material" valor={`${detalle.tiempoHoras || '—'} h · ${detalle.gramos || '—'} g · ${detalle.material || '—'}`} />
            <Campo etiqueta="Estado / Resultado" valor={`${detalle.estado || '—'} / ${detalle.resultado || '—'}`} />
            <Campo etiqueta="Desperdicio" valor={detalle.desperdicio ? `${detalle.desperdicio} g` : '—'} />
            <div className="col-span-2"><Campo etiqueta="Comentarios" valor={detalle.comentarios || '—'} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="label">{etiqueta}</p>
      <p className="whitespace-pre-line text-slate-700">{valor || '—'}</p>
    </div>
  );
}
