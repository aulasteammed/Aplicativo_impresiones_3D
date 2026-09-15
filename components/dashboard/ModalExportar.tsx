'use client';

// Modal de exportación: el usuario elige qué conjuntos de datos incluir y se
// descarga un .xlsx (una hoja por conjunto) generado por /api/exportar.

import { useState } from 'react';
import { Aviso, Modal } from '@/components/ui';
import { IconoDescarga, IconoGrafico } from '@/components/Iconos';

const OPCIONES_EXPORT: [string, string, string][] = [
  ['solicitudes', 'Solicitudes', 'Todas las solicitudes del formulario'],
  ['camas', 'Camas de impresión', 'Camas activas y en pausa (una fila por pieza)'],
  ['historial', 'Historial', 'Impresiones finalizadas'],
  ['filamentos', 'Inventario · Filamentos', 'Rollos de filamento del inventario'],
  ['mantenimiento', 'Inventario · Mantenimiento', 'Registros y programación de mantenimiento'],
];

export function ModalExportar({ onCerrar }: { onCerrar: () => void }) {
  const [sel, setSel] = useState<Record<string, boolean>>({ solicitudes: true, camas: true, historial: true, filamentos: true, mantenimiento: true });
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const alguno = Object.values(sel).some(Boolean);
  const rangoInvalido = !!desde && !!hasta && desde > hasta;
  // El calendario nativo muestra la fecha según el idioma del navegador; mostramos
  // además la fecha elegida en formato DD/MM/AAAA para que siempre quede claro.
  const ddmmaaaa = (iso: string) => { const p = iso.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''; };
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
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-steam-600 text-2xl text-white shadow-sm"><IconoGrafico /></div>
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
                  <span className="text-xs text-slate-400">Desde (DD/MM/AAAA)</span>
                  <input type="date" lang="es-CO" className="input mt-0.5" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
                  {desde && <span className="mt-0.5 block text-[11px] font-medium text-slate-500">{ddmmaaaa(desde)}</span>}
                </label>
                <label className="block">
                  <span className="text-xs text-slate-400">Hasta (DD/MM/AAAA)</span>
                  <input type="date" lang="es-CO" className="input mt-0.5" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
                  {hasta && <span className="mt-0.5 block text-[11px] font-medium text-slate-500">{ddmmaaaa(hasta)}</span>}
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
            {generando ? 'Generando…' : <span className="inline-flex items-center gap-1.5"><IconoDescarga /> Descargar .xlsx</span>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
