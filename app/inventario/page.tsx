'use client';

// Ventana 5 — Inventario: filamentos (con alertas de stock bajo y movimientos),
// impresoras y su mantenimiento/consumibles/repuestos.

import { useMemo, useState } from 'react';
import { AlertaStock, Filamento, Impresora, Mantenimiento, MovimientoInventario } from '@/lib/types';
import { Aviso, BarraBusqueda, BotonRecargar, Chip, Modal, useDatos } from '@/components/ui';

type Pestania = 'filamentos' | 'impresoras' | 'mantenimiento';

export default function PaginaInventario() {
  const [pestania, setPestania] = useState<Pestania>('filamentos');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Inventario</h1>
        <p className="text-sm text-slate-500">Filamentos, impresoras y mantenimiento del Aula STEAM</p>
      </div>

      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}

      <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
        {([['filamentos', '🧵 Filamentos'], ['impresoras', '🖨️ Impresoras'], ['mantenimiento', '🔧 Mantenimiento']] as [Pestania, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPestania(id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${pestania === id ? 'bg-white shadow text-steam-700' : 'text-slate-600 hover:text-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {pestania === 'filamentos' && <TabFilamentos onMensaje={setMensaje} />}
      {pestania === 'impresoras' && <TabImpresoras onMensaje={setMensaje} />}
      {pestania === 'mantenimiento' && <TabMantenimiento onMensaje={setMensaje} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filamentos
// ---------------------------------------------------------------------------

const TIPOS = ['PLA', 'PETG', 'ABS', 'TPU', 'Resina', 'Otro'];

function TabFilamentos({ onMensaje }: { onMensaje: (m: { tipo: 'ok' | 'error'; texto: string }) => void }) {
  const { datos, cargando, error, recargar } = useDatos<{ filamentos: Filamento[]; alertas: AlertaStock[] }>('/api/inventario/filamentos');
  const { datos: dMov, recargar: recargarMov } = useDatos<{ movimientos: MovimientoInventario[] }>('/api/inventario/movimientos');
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Filamento | 'nuevo' | null>(null);
  const [verMovimientos, setVerMovimientos] = useState(false);

  const filamentos = datos?.filamentos ?? [];
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filamentos;
    return filamentos.filter((f) => [f.id, f.tipo, f.color, f.marca, f.notas].some((c) => (c ?? '').toLowerCase().includes(q)));
  }, [filamentos, busqueda]);

  return (
    <div className="space-y-4">
      {error && <Aviso tipo="error">Error: {error}</Aviso>}
      {(datos?.alertas?.length ?? 0) > 0 && (
        <Aviso tipo="alerta">
          <b>⚠ Stock bajo:</b>{' '}
          {datos!.alertas.map((a) => `${a.tipo} ${a.color} (${a.filamentoId}: ${a.gramosRestantes} g ≤ ${a.umbral} g)`).join(' · ')}
        </Aviso>
      )}

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="w-72"><BarraBusqueda valor={busqueda} onCambio={setBusqueda} placeholder="Buscar filamento…" /></div>
          <div className="flex gap-2">
            <BotonRecargar onClick={() => { recargar(); recargarMov(); }} cargando={cargando} />
            <button className="btn-secondary" onClick={() => setVerMovimientos(true)}>Movimientos</button>
            <button className="btn-primary" onClick={() => setEditando('nuevo')}>+ Añadir filamento</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">ID</th><th className="th">Tipo</th><th className="th">Color</th><th className="th">Marca</th>
                <th className="th">Rollos</th><th className="th">Comenzado</th><th className="th">Restante</th><th className="th">Estado</th><th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((f) => {
                const bajo = f.umbralAlerta > 0 && f.gramosRestantes <= f.umbralAlerta;
                return (
                  <tr key={f.id}>
                    <td className="td font-mono text-xs">{f.id}</td>
                    <td className="td font-medium">{f.tipo}</td>
                    <td className="td">{f.color}</td>
                    <td className="td">{f.marca || '—'}</td>
                    <td className="td">{f.rollos}</td>
                    <td className="td">{f.comenzado ? 'Sí' : 'No'}</td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
                          <div className={`h-full ${bajo ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (f.gramosRestantes / (f.rollos * 1000 || 1000)) * 100)}%` }} />
                        </div>
                        <span className="text-xs">{Math.round(f.gramosRestantes)} g</span>
                      </div>
                    </td>
                    <td className="td">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${bajo ? 'bg-rose-100 text-rose-700 ring-rose-200' : 'bg-emerald-100 text-emerald-700 ring-emerald-200'}`}>
                        {bajo ? 'Stock bajo' : 'OK'}
                      </span>
                    </td>
                    <td className="td"><button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setEditando(f)}>Editar</button></td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && <tr><td colSpan={9} className="td py-8 text-center text-slate-500">Sin filamentos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <ModalFilamento
          filamento={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={(t) => { onMensaje({ tipo: 'ok', texto: t }); recargar(); recargarMov(); }}
        />
      )}

      <Modal abierto={verMovimientos} onCerrar={() => setVerMovimientos(false)} titulo="Movimientos de inventario" ancho="max-w-3xl">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr><th className="th">Fecha</th><th className="th">Filamento</th><th className="th">Proyecto</th><th className="th">Gramos</th><th className="th">Motivo</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(dMov?.movimientos ?? []).map((m, i) => (
                <tr key={i}>
                  <td className="td whitespace-nowrap text-xs">{m.fecha}</td>
                  <td className="td font-mono text-xs">{m.filamentoId}</td>
                  <td className="td font-mono text-xs">{m.proyectoCodigo || '—'}</td>
                  <td className={`td font-semibold ${m.gramos < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{m.gramos > 0 ? '+' : ''}{m.gramos} g</td>
                  <td className="td">{m.motivo}</td>
                </tr>
              ))}
              {(dMov?.movimientos ?? []).length === 0 && <tr><td colSpan={5} className="td py-6 text-center text-slate-500">Sin movimientos.</td></tr>}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}

function ModalFilamento({
  filamento, onCerrar, onGuardado,
}: { filamento: Filamento | null; onCerrar: () => void; onGuardado: (texto: string) => void }) {
  const esNuevo = !filamento;
  const [f, setF] = useState({
    tipo: filamento?.tipo ?? 'PLA',
    color: filamento?.color ?? '',
    marca: filamento?.marca ?? '',
    rollos: filamento?.rollos ?? 1,
    comenzado: filamento?.comenzado ?? false,
    gramosRestantes: filamento?.gramosRestantes ?? 1000,
    umbralAlerta: filamento?.umbralAlerta ?? 200,
    notas: filamento?.notas ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      const payload = esNuevo
        ? { ...f, fechaRegistro: new Date().toISOString().slice(0, 10) }
        : { ...filamento!, ...f };
      const res = await fetch('/api/inventario/filamentos', {
        method: esNuevo ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error guardando');
      onGuardado(esNuevo ? `Filamento ${body.filamento.id} añadido al inventario.` : `Filamento ${filamento!.id} actualizado.`);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={esNuevo ? 'Añadir filamento' : `Editar ${filamento!.id}`}>
      <div className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo de material *</label>
            <select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Color *</label>
            <input className="input" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
          </div>
          <div>
            <label className="label">Marca</label>
            <input className="input" value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} />
          </div>
          <div>
            <label className="label">Número de rollos</label>
            <input type="number" min="1" className="input" value={f.rollos} onChange={(e) => setF({ ...f, rollos: parseInt(e.target.value) || 1 })} />
          </div>
          <div className="col-span-2 flex items-center gap-2 rounded-lg bg-slate-50 p-3">
            <input id="comenzado" type="checkbox" className="accent-steam-600" checked={f.comenzado} onChange={(e) => setF({ ...f, comenzado: e.target.checked })} />
            <label htmlFor="comenzado" className="text-sm">¿Rollo comenzado? {esNuevo && <span className="text-xs text-slate-500">(si está nuevo se registra 1 kg por rollo)</span>}</label>
          </div>
          {(f.comenzado || !esNuevo) && (
            <div>
              <label className="label">Gramos restantes (aprox.)</label>
              <input type="number" min="0" className="input" value={f.gramosRestantes} onChange={(e) => setF({ ...f, gramosRestantes: parseFloat(e.target.value) || 0 })} />
            </div>
          )}
          <div>
            <label className="label">Umbral de alerta (g)</label>
            <input type="number" min="0" className="input" value={f.umbralAlerta} onChange={(e) => setF({ ...f, umbralAlerta: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="col-span-2">
            <label className="label">Notas</label>
            <input className="input" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary" onClick={guardar} disabled={guardando || !f.color.trim()}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Impresoras
// ---------------------------------------------------------------------------

function TabImpresoras({ onMensaje }: { onMensaje: (m: { tipo: 'ok' | 'error'; texto: string }) => void }) {
  const { datos, cargando, error, recargar } = useDatos<{ impresoras: Impresora[] }>('/api/inventario/impresoras');
  const [editando, setEditando] = useState<Impresora | 'nueva' | null>(null);

  return (
    <div className="card space-y-4">
      {error && <Aviso tipo="error">Error: {error}</Aviso>}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Impresoras del aula</h2>
        <div className="flex gap-2">
          <BotonRecargar onClick={recargar} cargando={cargando} />
          <button className="btn-primary" onClick={() => setEditando('nueva')}>+ Añadir impresora</button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(datos?.impresoras ?? []).map((imp) => (
          <div key={imp.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{imp.nombre} <span className="font-mono text-xs text-slate-400">{imp.id}</span></p>
                <p className="text-sm text-slate-500">{imp.modelo}</p>
              </div>
              <Chip valor={imp.estado} />
            </div>
            <p className="mt-3 text-sm">⏱ <b>{imp.horasAcumuladas}</b> h de impresión acumuladas</p>
            {imp.notas && <p className="mt-1 text-xs text-slate-500">{imp.notas}</p>}
            <button className="btn-secondary mt-3 !px-2 !py-1 text-xs" onClick={() => setEditando(imp)}>Editar</button>
          </div>
        ))}
        {(datos?.impresoras ?? []).length === 0 && <p className="text-sm text-slate-500">Sin impresoras registradas.</p>}
      </div>

      {editando && (
        <ModalImpresora
          impresora={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={(t) => { onMensaje({ tipo: 'ok', texto: t }); recargar(); }}
        />
      )}
    </div>
  );
}

function ModalImpresora({
  impresora, onCerrar, onGuardado,
}: { impresora: Impresora | null; onCerrar: () => void; onGuardado: (texto: string) => void }) {
  const esNueva = !impresora;
  const [f, setF] = useState({
    nombre: impresora?.nombre ?? '',
    modelo: impresora?.modelo ?? '',
    estado: impresora?.estado ?? 'Operativa',
    horasAcumuladas: impresora?.horasAcumuladas ?? 0,
    notas: impresora?.notas ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/inventario/impresoras', {
        method: esNueva ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(esNueva ? f : { ...impresora!, ...f }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error guardando');
      onGuardado(esNueva ? `Impresora "${f.nombre}" registrada.` : `Impresora ${impresora!.id} actualizada.`);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={esNueva ? 'Añadir impresora' : `Editar ${impresora!.nombre}`}>
      <div className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Nombre *</label><input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
          <div><label className="label">Modelo</label><input className="input" value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} /></div>
          <div>
            <label className="label">Estado</label>
            <select className="input" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
              <option>Operativa</option><option>Mantenimiento</option><option>Fuera de servicio</option>
            </select>
          </div>
          <div><label className="label">Horas acumuladas</label><input type="number" min="0" className="input" value={f.horasAcumuladas} onChange={(e) => setF({ ...f, horasAcumuladas: parseFloat(e.target.value) || 0 })} /></div>
          <div className="col-span-2"><label className="label">Notas</label><input className="input" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary" onClick={guardar} disabled={guardando || !f.nombre.trim()}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Mantenimiento
// ---------------------------------------------------------------------------

function TabMantenimiento({ onMensaje }: { onMensaje: (m: { tipo: 'ok' | 'error'; texto: string }) => void }) {
  const { datos, cargando, error, recargar } = useDatos<{ mantenimientos: Mantenimiento[] }>('/api/inventario/mantenimiento');
  const { datos: dImp } = useDatos<{ impresoras: Impresora[] }>('/api/inventario/impresoras', 5 * 60_000);
  const [modal, setModal] = useState(false);

  return (
    <div className="card space-y-4">
      {error && <Aviso tipo="error">Error: {error}</Aviso>}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Mantenimientos, consumibles y repuestos</h2>
        <div className="flex gap-2">
          <BotonRecargar onClick={recargar} cargando={cargando} />
          <button className="btn-primary" onClick={() => setModal(true)}>+ Registrar</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr><th className="th">Fecha</th><th className="th">Impresora</th><th className="th">Tipo</th><th className="th">Descripción</th><th className="th">Costo</th><th className="th">Responsable</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(datos?.mantenimientos ?? []).map((m, i) => (
              <tr key={i}>
                <td className="td whitespace-nowrap text-xs">{m.fecha}</td>
                <td className="td font-mono text-xs">{m.impresoraId}</td>
                <td className="td capitalize">{m.tipo}</td>
                <td className="td">{m.descripcion}</td>
                <td className="td">{m.costo ? `$${m.costo.toLocaleString('es-CO')}` : '—'}</td>
                <td className="td">{m.responsable || '—'}</td>
              </tr>
            ))}
            {(datos?.mantenimientos ?? []).length === 0 && <tr><td colSpan={6} className="td py-8 text-center text-slate-500">Sin registros de mantenimiento.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <ModalMantenimiento
          impresoras={dImp?.impresoras ?? []}
          onCerrar={() => setModal(false)}
          onGuardado={(t) => { onMensaje({ tipo: 'ok', texto: t }); recargar(); }}
        />
      )}
    </div>
  );
}

function ModalMantenimiento({
  impresoras, onCerrar, onGuardado,
}: { impresoras: Impresora[]; onCerrar: () => void; onGuardado: (texto: string) => void }) {
  const [f, setF] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    impresoraId: impresoras[0]?.id ?? '',
    tipo: 'preventivo',
    descripcion: '',
    costo: '',
    responsable: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/inventario/mantenimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, costo: f.costo ? parseFloat(f.costo) : undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error guardando');
      onGuardado('Registro de mantenimiento guardado.');
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Registrar mantenimiento / consumible / repuesto">
      <div className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Fecha</label><input type="date" className="input" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></div>
          <div>
            <label className="label">Impresora *</label>
            <select className="input" value={f.impresoraId} onChange={(e) => setF({ ...f, impresoraId: e.target.value })}>
              {impresoras.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.id})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              <option value="preventivo">Preventivo</option>
              <option value="correctivo">Correctivo</option>
              <option value="consumible">Consumible</option>
              <option value="repuesto">Repuesto</option>
            </select>
          </div>
          <div><label className="label">Costo (COP, opcional)</label><input type="number" min="0" className="input" value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} /></div>
          <div className="col-span-2"><label className="label">Descripción *</label><textarea className="input min-h-[70px]" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></div>
          <div className="col-span-2"><label className="label">Responsable</label><input className="input" value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary" onClick={guardar} disabled={guardando || !f.descripcion.trim() || !f.impresoraId}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Modal>
  );
}
