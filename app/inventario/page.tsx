'use client';

// Ventana 5 — Inventario: filamentos (con alertas de stock bajo y movimientos),
// impresoras y su mantenimiento/consumibles/repuestos.

import { useMemo, useState } from 'react';
import { AlertaStock, Filamento, Impresora, Mantenimiento, MovimientoInventario, UmbralAlerta, VariableUmbral } from '@/lib/types';
import { AccionesFila, Aviso, BarraBusqueda, BotonRecargar, Chip, Modal, ModalConfirmar, ModalConfirmarCambios, diffCampos, useDatos } from '@/components/ui';
import { normalizarTexto, calcularAlertasAgregadas, formatCOP } from '@/lib/util';

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

function etiquetaVariable(v: VariableUmbral): string {
  return v === 'color' ? 'Color' : v === 'marca' ? 'Marca' : 'Tipo de material';
}

/** Reglas de umbral que un filamento "rompe" (mismo criterio que el servidor):
 *  coincide el valor (normalizado) en su variable y el stock está por debajo. */
function reglasRotas(f: Filamento, umbrales: UmbralAlerta[]): UmbralAlerta[] {
  return umbrales.filter((u) => {
    const valor = u.variable === 'color' ? f.color : u.variable === 'marca' ? f.marca : f.tipo;
    return normalizarTexto(String(valor)) === normalizarTexto(u.valor) && f.gramosRestantes <= u.umbralGramos;
  });
}

function TabFilamentos({ onMensaje }: { onMensaje: (m: { tipo: 'ok' | 'error'; texto: string }) => void }) {
  const { datos, cargando, error, recargar } = useDatos<{ filamentos: Filamento[]; alertas: AlertaStock[] }>('/api/inventario/filamentos');
  const { datos: dMov, recargar: recargarMov } = useDatos<{ movimientos: MovimientoInventario[] }>('/api/inventario/movimientos');
  const { datos: dUmb, recargar: recargarUmb } = useDatos<{ umbrales: UmbralAlerta[] }>('/api/inventario/umbrales');
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Filamento | 'nuevo' | null>(null);
  const [verMovimientos, setVerMovimientos] = useState(false);
  const [editUmbral, setEditUmbral] = useState<UmbralAlerta | 'nuevo' | null>(null);
  const [porEliminar, setPorEliminar] = useState<Filamento | null>(null);
  const [umbralEliminar, setUmbralEliminar] = useState<UmbralAlerta | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const filamentos = datos?.filamentos ?? [];
  const umbrales = dUmb?.umbrales ?? [];
  const idsBajo = useMemo(() => new Set((datos?.alertas ?? []).map((a) => a.filamentoId)), [datos]);
  const alertasUmbral = useMemo(() => calcularAlertasAgregadas(filamentos, umbrales), [filamentos, umbrales]);
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filamentos;
    return filamentos.filter((f) => [f.id, f.tipo, f.color, f.marca, f.notas].some((c) => (c ?? '').toLowerCase().includes(q)));
  }, [filamentos, busqueda]);

  function refrescar() { recargar(); recargarMov(); recargarUmb(); }

  async function hacerEliminarUmbral(u: UmbralAlerta) {
    setEliminando(true);
    try {
      const res = await fetch(`/api/inventario/umbrales?id=${encodeURIComponent(u.id)}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error eliminando el umbral');
      onMensaje({ tipo: 'ok', texto: 'Umbral de alerta eliminado.' });
      setUmbralEliminar(null);
      recargarUmb(); recargar();
    } catch (e) {
      onMensaje({ tipo: 'error', texto: (e as Error).message });
    } finally { setEliminando(false); }
  }

  async function hacerEliminarFilamento(f: Filamento) {
    setEliminando(true);
    try {
      const res = await fetch(`/api/inventario/filamentos?id=${encodeURIComponent(f.id)}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error eliminando el filamento');
      onMensaje({ tipo: 'ok', texto: `Filamento ${f.id} eliminado.` });
      setPorEliminar(null);
      refrescar();
    } catch (e) {
      onMensaje({ tipo: 'error', texto: (e as Error).message });
    } finally { setEliminando(false); }
  }

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
          <div className="flex flex-wrap gap-2">
            <BotonRecargar onClick={refrescar} cargando={cargando} />
            <button className="btn-secondary" onClick={() => setVerMovimientos(true)}>Movimientos</button>
            <button className="btn-primary" onClick={() => setEditando('nuevo')}>+ Añadir filamento</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">ID</th><th className="th">Tipo</th><th className="th">Color</th><th className="th">Marca</th>
                <th className="th">Rollos</th><th className="th">Comenzado</th><th className="th">Restante</th><th className="th">Estado</th><th className="th text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((f) => {
                const bajo = idsBajo.has(f.id);
                const rotas = bajo ? reglasRotas(f, umbrales) : [];
                const tooltipBajo = rotas.length > 0
                  ? 'Stock bajo por:\n' + rotas.map((u) =>
                      `• Por ${etiquetaVariable(u.variable).toLowerCase()} "${u.valor}": ${Math.round(f.gramosRestantes)} g ≤ ${u.umbralGramos} g (${Math.max(0, Math.round(u.umbralGramos - f.gramosRestantes))} g por debajo)`,
                    ).join('\n')
                  : '';
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
                      <span
                        title={tooltipBajo || undefined}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${bajo ? 'cursor-help bg-rose-100 text-rose-700 ring-rose-200 underline decoration-dotted underline-offset-2' : 'bg-emerald-100 text-emerald-700 ring-emerald-200'}`}
                      >
                        {bajo ? 'Stock bajo' : 'OK'}
                      </span>
                    </td>
                    <td className="td"><AccionesFila onEditar={() => setEditando(f)} onEliminar={() => setPorEliminar(f)} /></td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && <tr><td colSpan={9} className="td py-8 text-center text-slate-500">Sin filamentos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Umbrales de alerta de stock */}
      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Umbrales de alerta de stock</h2>
            <p className="text-xs text-slate-500">Un rollo se marca como “Stock bajo” cuando su color/marca/tipo coincide con una regla y su gramaje cae por debajo del umbral.</p>
          </div>
          <button className="btn-secondary" onClick={() => setEditUmbral('nuevo')}>Crear umbral de alerta</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr><th className="th">Variable</th><th className="th">Valor</th><th className="th">Umbral (g)</th><th className="th text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {umbrales.map((u) => (
                <tr key={u.id}>
                  <td className="td">{etiquetaVariable(u.variable)}</td>
                  <td className="td font-medium">{u.valor}</td>
                  <td className="td">{u.umbralGramos} g</td>
                  <td className="td"><AccionesFila onEditar={() => setEditUmbral(u)} onEliminar={() => setUmbralEliminar(u)} /></td>
                </tr>
              ))}
              {umbrales.length === 0 && <tr><td colSpan={4} className="td py-8 text-center text-slate-500">Sin umbrales definidos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alertas de stock agregadas por umbral */}
      <div className="card">
        <div className="mb-4">
          <h2 className="font-semibold">Alertas de stock</h2>
          <p className="text-xs text-slate-500">Suma el total de filamento del inventario que coincide con cada umbral (sin importar las otras características) y avisa si está por debajo o muy cerca del límite.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr><th className="th">Variable</th><th className="th">Valor</th><th className="th">Total en inventario</th><th className="th">Umbral</th><th className="th">Alerta</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alertasUmbral.map((a) => (
                <tr key={`${a.variable}-${a.valor}`}>
                  <td className="td">{etiquetaVariable(a.variable)}</td>
                  <td className="td font-medium">{a.valor}</td>
                  <td className="td">{Math.round(a.total)} g <span className="text-xs text-slate-400">({a.rollos} rollo{a.rollos === 1 ? '' : 's'})</span></td>
                  <td className="td">{a.umbralGramos} g</td>
                  <td className="td">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${a.estado === 'debajo' ? 'bg-rose-100 text-rose-700 ring-rose-200' : 'bg-amber-100 text-amber-700 ring-amber-200'}`}>
                      {a.estado === 'debajo'
                        ? `⚠ Por debajo del umbral (faltan ${Math.max(0, Math.round(a.umbralGramos - a.total))} g)`
                        : `Cerca del umbral (solo ${Math.round(a.total - a.umbralGramos)} g de margen)`}
                    </span>
                  </td>
                </tr>
              ))}
              {alertasUmbral.length === 0 && (
                <tr><td colSpan={5} className="td py-8 text-center text-slate-500">
                  {umbrales.length === 0 ? 'Defina umbrales de alerta para ver alertas de stock aquí.' : 'Sin alertas: el stock total de cada umbral está por encima del límite.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <ModalFilamento
          filamento={editando === 'nuevo' ? null : editando}
          filamentos={filamentos}
          onCerrar={() => setEditando(null)}
          onGuardado={(t) => { onMensaje({ tipo: 'ok', texto: t }); refrescar(); }}
        />
      )}

      {editUmbral && (
        <ModalUmbral
          umbral={editUmbral === 'nuevo' ? null : editUmbral}
          filamentos={filamentos}
          onCerrar={() => setEditUmbral(null)}
          onGuardado={(t) => { onMensaje({ tipo: 'ok', texto: t }); recargarUmb(); recargar(); }}
        />
      )}

      {porEliminar && (
        <ModalConfirmar
          abierto titulo="Eliminar filamento" icono="🗑️" tono="danger"
          confirmarTexto="Eliminar" cancelarTexto="Cancelar"
          onCancelar={() => setPorEliminar(null)}
          onConfirmar={() => hacerEliminarFilamento(porEliminar)}
        >
          ¿Eliminar el filamento <b>{porEliminar.id}</b> ({porEliminar.tipo} {porEliminar.color}{porEliminar.marca ? ` ${porEliminar.marca}` : ''})? Esta acción no se puede deshacer.
        </ModalConfirmar>
      )}

      {umbralEliminar && (
        <ModalConfirmar
          abierto titulo="Eliminar umbral" icono="🗑️" tono="danger"
          confirmarTexto="Eliminar" cancelarTexto="Cancelar"
          onCancelar={() => setUmbralEliminar(null)}
          onConfirmar={() => hacerEliminarUmbral(umbralEliminar)}
        >
          ¿Eliminar el umbral <b>{etiquetaVariable(umbralEliminar.variable)} = {umbralEliminar.valor}</b> (≤ {umbralEliminar.umbralGramos} g)? Esta acción no se puede deshacer.
        </ModalConfirmar>
      )}

      <Modal abierto={verMovimientos} onCerrar={() => setVerMovimientos(false)} titulo="Movimientos de inventario" ancho="max-w-3xl">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr><th className="th">Fecha</th><th className="th">Filamento</th><th className="th">Cama</th><th className="th">Gramos</th><th className="th">Motivo</th></tr>
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
  filamento, filamentos, onCerrar, onGuardado,
}: { filamento: Filamento | null; filamentos: Filamento[]; onCerrar: () => void; onGuardado: (texto: string) => void }) {
  const esNuevo = !filamento;
  const [f, setF] = useState({
    tipo: filamento?.tipo ?? '',
    color: filamento?.color ?? '',
    marca: filamento?.marca ?? '',
    rollos: filamento?.rollos ?? 1,
    comenzado: filamento?.comenzado ?? false,
    // Para un filamento NUEVO este campo es "gramos de los rollos comenzados"
    // (parte de 0); al EDITAR es el gramaje restante real existente.
    gramosRestantes: filamento?.gramosRestantes ?? 0,
    notas: filamento?.notas ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmacion, setConfirmacion] = useState<Filamento | null>(null);
  const [resumen, setResumen] = useState<{ campo: string; de: string; a: string }[] | null>(null);

  const cambios = () => diffCampos([
    { campo: 'Tipo', de: filamento?.tipo, a: f.tipo },
    { campo: 'Color', de: filamento?.color, a: f.color },
    { campo: 'Marca', de: filamento?.marca, a: f.marca },
    { campo: 'Rollos', de: filamento?.rollos, a: f.rollos },
    { campo: 'Comenzado', de: filamento?.comenzado, a: f.comenzado, fmt: (v) => (v ? 'Sí' : 'No') },
    { campo: 'Gramos restantes', de: filamento?.gramosRestantes, a: f.gramosRestantes, fmt: (v) => `${Math.round(Number(v) || 0)} g` },
    { campo: 'Notas', de: filamento?.notas, a: f.notas },
  ]);

  // Sugerencias (no restringen la escritura): valores ya presentes en el inventario.
  const distintos = (sel: (x: Filamento) => string, base: string[] = []) =>
    Array.from(new Set([...base, ...filamentos.map((x) => (sel(x) ?? '').trim())].filter(Boolean)));
  const tiposSugeridos = distintos((x) => String(x.tipo), TIPOS);
  const coloresSugeridos = distintos((x) => x.color);
  const marcasSugeridas = distintos((x) => x.marca);

  // Total que se añadirá al inventario al crear: rollos nuevos × 1000 g + los
  // gramos de los rollos comenzados (si se marcó la casilla).
  const totalNuevo = (Number(f.rollos) || 0) * 1000 + (f.comenzado ? (Number(f.gramosRestantes) || 0) : 0);

  async function enviar(opts: { forzarNuevo?: boolean; fusionarCon?: string } = {}) {
    setGuardando(true);
    setError('');
    try {
      const payload = esNuevo
        ? { ...f, umbralAlerta: 0, fechaRegistro: new Date().toISOString().slice(0, 10), ...opts }
        : { ...filamento!, ...f };
      const res = await fetch('/api/inventario/filamentos', {
        method: esNuevo ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error guardando');
      if (body.requiereConfirmacion) { setConfirmacion(body.candidato as Filamento); return; }
      let msg: string;
      if (!esNuevo) msg = `Filamento ${filamento!.id} actualizado.`;
      else if (body.fusionado) {
        const c = body.filamento as Filamento;
        msg = `Se sumó al filamento existente ${c.id} (${c.tipo} ${c.color}${c.marca ? ' ' + c.marca : ''}).`;
      } else msg = `Filamento ${body.filamento.id} añadido al inventario.`;
      onGuardado(msg);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  // Sub-vista: el ingreso se parece (con tolerancia) a un filamento existente
  if (confirmacion) {
    const c = confirmacion;
    return (
      <Modal abierto onCerrar={onCerrar} titulo="¿Es el mismo filamento?">
        <div className="space-y-4">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Aviso tipo="info">
            El filamento que intenta añadir (<b>{f.tipo} {f.color}{f.marca ? ` ${f.marca}` : ''}</b>) se parece a uno ya
            registrado: <b>{c.id} — {c.tipo} {c.color}{c.marca ? ` ${c.marca}` : ''}</b>. ¿Desea sumarlo a ese filamento
            o crear uno nuevo?
          </Aviso>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" onClick={() => setConfirmacion(null)} disabled={guardando}>Volver</button>
            <button className="btn-secondary" onClick={() => enviar({ forzarNuevo: true })} disabled={guardando}>Crear nuevo</button>
            <button className="btn-primary" onClick={() => enviar({ fusionarCon: c.id })} disabled={guardando}>
              {guardando ? 'Guardando…' : `Sumar a ${c.id}`}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (resumen) {
    return (
      <ModalConfirmarCambios
        abierto titulo={`Confirmar cambios · ${filamento!.id}`} cambios={resumen} guardando={guardando}
        onVolver={() => setResumen(null)} onConfirmar={() => enviar()}
      />
    );
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={esNuevo ? 'Añadir filamento' : `Editar ${filamento!.id}`}>
      <div className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo de material *</label>
            <input className="input" list="fil-tipos" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}
              placeholder="Escriba un tipo (o elija uno existente)" />
            <datalist id="fil-tipos">{tiposSugeridos.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div>
            <label className="label">Color *</label>
            <input className="input" list="fil-colores" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })}
              placeholder="Escriba un color (o elija uno existente)" />
            <datalist id="fil-colores">{coloresSugeridos.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="label">Marca *</label>
            <input className="input" list="fil-marcas" value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })}
              placeholder="Escriba una marca (o elija una existente)" />
            <datalist id="fil-marcas">{marcasSugeridas.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
          <div>
            <label className="label">Número de rollos {esNuevo && <span className="text-xs text-slate-400">(nuevos · 1 kg c/u)</span>}</label>
            <input type="number" min="0" className="input" value={f.rollos} onChange={(e) => setF({ ...f, rollos: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="col-span-2 flex items-center gap-2 rounded-lg bg-slate-50 p-3">
            <input id="comenzado" type="checkbox" className="accent-steam-600" checked={f.comenzado} onChange={(e) => setF({ ...f, comenzado: e.target.checked })} />
            <label htmlFor="comenzado" className="text-sm">¿Rollo(s) comenzado(s)? {esNuevo && <span className="text-xs text-slate-500">(sus gramos se suman, además de los rollos nuevos × 1 kg)</span>}</label>
          </div>
          {(f.comenzado || !esNuevo) && (
            <div>
              <label className="label">{esNuevo ? 'Total de gramos del/los rollo(s) comenzado(s)' : 'Gramos restantes (aprox.)'}</label>
              <input type="number" min="0" className="input" value={f.gramosRestantes} onChange={(e) => setF({ ...f, gramosRestantes: parseFloat(e.target.value) || 0 })} />
            </div>
          )}
          {esNuevo && (
            <div className="col-span-2 rounded-lg bg-steam-50/60 px-3 py-2 text-xs text-slate-600">
              Se añadirán al inventario: <b>{totalNuevo} g</b>{' '}
              ({Number(f.rollos) || 0} × 1000 g{f.comenzado ? ` + ${Number(f.gramosRestantes) || 0} g comenzados` : ''}).
            </div>
          )}
          <div className="col-span-2">
            <label className="label">Notas</label>
            <input className="input" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary" onClick={esNuevo ? () => enviar() : () => setResumen(cambios())} disabled={guardando || !f.tipo.trim() || !f.color.trim() || !f.marca.trim() || (esNuevo && totalNuevo <= 0)}>
            {guardando ? 'Guardando…' : esNuevo ? 'Guardar' : 'Revisar cambios'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModalUmbral({
  umbral, filamentos, onCerrar, onGuardado,
}: { umbral: UmbralAlerta | null; filamentos: Filamento[]; onCerrar: () => void; onGuardado: (texto: string) => void }) {
  const esEdicion = !!umbral;
  const [variable, setVariable] = useState<VariableUmbral>(umbral?.variable ?? 'tipo');
  const [valor, setValor] = useState(umbral?.valor ?? '');
  const [umbralGramos, setUmbralGramos] = useState(umbral?.umbralGramos ?? 200);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmacion, setConfirmacion] = useState<UmbralAlerta | null>(null);
  const [resumen, setResumen] = useState<{ campo: string; de: string; a: string }[] | null>(null);

  const cambios = () => diffCampos([
    { campo: 'Variable', de: umbral?.variable, a: variable, fmt: (v) => etiquetaVariable(v as VariableUmbral) },
    { campo: 'Valor', de: umbral?.valor, a: valor },
    { campo: 'Umbral (g)', de: umbral?.umbralGramos, a: umbralGramos, fmt: (v) => `${Number(v) || 0} g` },
  ]);

  async function guardarEdicion() {
    setGuardando(true); setError('');
    try {
      const res = await fetch('/api/inventario/umbrales', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: umbral!.id, variable, valor, umbralGramos }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error guardando');
      onGuardado(`Umbral de ${etiquetaVariable(variable)} = ${valor} actualizado (≤ ${umbralGramos} g).`);
      onCerrar();
    } catch (e) { setResumen(null); setError((e as Error).message); }
    finally { setGuardando(false); }
  }

  // Valores ya presentes en el inventario: solo sirven como SUGERENCIAS; el
  // usuario puede escribir uno nuevo (color/marca/tipo aún no registrado).
  const opcionesDe = (v: VariableUmbral): string[] =>
    Array.from(new Set([
      ...(v === 'tipo' ? TIPOS : []),
      ...filamentos.map((f) => (v === 'color' ? f.color : v === 'marca' ? f.marca : f.tipo) ?? '').map((s) => String(s).trim()),
    ].filter(Boolean)));
  const opciones = opcionesDe(variable);

  function cambiarVariable(v: VariableUmbral) {
    setVariable(v);
    setValor('');
  }

  async function guardar(opts: { forzarNuevo?: boolean; actualizarId?: string } = {}) {
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/inventario/umbrales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variable, valor, umbralGramos, ...opts }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error creando el umbral');
      if (body.requiereConfirmacion) { setConfirmacion(body.candidato as UmbralAlerta); return; }
      onGuardado(body.actualizado
        ? `Umbral de ${etiquetaVariable(variable)} = ${body.umbral.valor} actualizado a ≤ ${umbralGramos} g.`
        : `Umbral de alerta creado para ${etiquetaVariable(variable)} = ${valor} (≤ ${umbralGramos} g).`);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  // Sub-vista: el valor se parece (con tolerancia) a un umbral ya existente
  if (confirmacion) {
    const c = confirmacion;
    return (
      <Modal abierto onCerrar={onCerrar} titulo="¿Es el mismo umbral?">
        <div className="space-y-4">
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Aviso tipo="info">
            Ya existe un umbral parecido: <b>{etiquetaVariable(c.variable)} = {c.valor}</b> (≤ {c.umbralGramos} g).
            El valor que escribiste fue <b>{valor}</b>. ¿Quieres actualizar ese umbral a <b>≤ {umbralGramos} g</b> o
            crear uno nuevo?
          </Aviso>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" onClick={() => setConfirmacion(null)} disabled={guardando}>Volver</button>
            <button className="btn-secondary" onClick={() => guardar({ forzarNuevo: true })} disabled={guardando}>Crear de todos modos</button>
            <button className="btn-primary" onClick={() => guardar({ actualizarId: c.id })} disabled={guardando}>
              {guardando ? 'Guardando…' : `Actualizar a ≤ ${umbralGramos} g`}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (resumen) {
    return (
      <ModalConfirmarCambios
        abierto titulo={`Confirmar cambios · ${umbral!.id}`} cambios={resumen} guardando={guardando}
        onVolver={() => setResumen(null)} onConfirmar={guardarEdicion}
      />
    );
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={esEdicion ? 'Editar umbral de alerta' : 'Crear umbral de alerta'}>
      <div className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div>
          <label className="label">¿Por cuál variable desea crear el nuevo umbral de alerta? *</label>
          <select className="input" value={variable} onChange={(e) => cambiarVariable(e.target.value as VariableUmbral)}>
            <option value="color">Por color</option>
            <option value="marca">Por marca</option>
            <option value="tipo">Por tipo de material</option>
          </select>
        </div>
        <div>
          <label className="label">Valor ({etiquetaVariable(variable).toLowerCase()}) *</label>
          <input
            className="input"
            list="umbral-valores"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Escriba un valor (o elija uno existente)"
          />
          <datalist id="umbral-valores">
            {opciones.map((o) => <option key={o} value={o} />)}
          </datalist>
          <p className="mt-1 text-xs text-slate-500">Puede escribir un color/marca/tipo nuevo; las coincidencias ignoran mayúsculas y acentos.</p>
        </div>
        <div>
          <label className="label">Umbral de riesgo (g) *</label>
          <input type="number" min="1" className="input" value={umbralGramos}
            onChange={(e) => setUmbralGramos(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary" onClick={esEdicion ? () => setResumen(cambios()) : () => guardar()} disabled={guardando || !valor.trim() || !(umbralGramos > 0)}>
            {guardando ? 'Guardando…' : esEdicion ? 'Revisar cambios' : 'Guardar'}
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
  const [porEliminar, setPorEliminar] = useState<Impresora | null>(null);

  async function hacerEliminar(imp: Impresora) {
    try {
      const res = await fetch(`/api/inventario/impresoras?id=${encodeURIComponent(imp.id)}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error eliminando la impresora');
      onMensaje({ tipo: 'ok', texto: `Impresora ${imp.nombre} eliminada.` });
      setPorEliminar(null);
      recargar();
    } catch (e) { onMensaje({ tipo: 'error', texto: (e as Error).message }); }
  }

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
            <div className="mt-3"><AccionesFila onEditar={() => setEditando(imp)} onEliminar={() => setPorEliminar(imp)} /></div>
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

      {porEliminar && (
        <ModalConfirmar
          abierto titulo="Eliminar impresora" icono="🗑️" tono="danger"
          confirmarTexto="Eliminar" cancelarTexto="Cancelar"
          onCancelar={() => setPorEliminar(null)}
          onConfirmar={() => hacerEliminar(porEliminar)}
        >
          ¿Eliminar la impresora <b>{porEliminar.nombre}</b> ({porEliminar.id})? Esta acción no se puede deshacer.
        </ModalConfirmar>
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
  const [resumen, setResumen] = useState<{ campo: string; de: string; a: string }[] | null>(null);

  const cambios = () => diffCampos([
    { campo: 'Nombre', de: impresora?.nombre, a: f.nombre },
    { campo: 'Modelo', de: impresora?.modelo, a: f.modelo },
    { campo: 'Estado', de: impresora?.estado, a: f.estado },
    { campo: 'Horas acumuladas', de: impresora?.horasAcumuladas, a: f.horasAcumuladas, fmt: (v) => `${Number(v) || 0} h` },
    { campo: 'Notas', de: impresora?.notas, a: f.notas },
  ]);

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

  if (resumen) {
    return (
      <ModalConfirmarCambios
        abierto titulo={`Confirmar cambios · ${impresora!.nombre}`} cambios={resumen} guardando={guardando}
        onVolver={() => setResumen(null)} onConfirmar={guardar}
      />
    );
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
          <button className="btn-primary" onClick={esNueva ? guardar : () => setResumen(cambios())} disabled={guardando || !f.nombre.trim()}>{guardando ? 'Guardando…' : esNueva ? 'Guardar' : 'Revisar cambios'}</button>
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
  const [modal, setModal] = useState<Mantenimiento | 'nuevo' | null>(null);
  const [porEliminar, setPorEliminar] = useState<Mantenimiento | null>(null);

  async function hacerEliminar(m: Mantenimiento) {
    try {
      const res = await fetch(`/api/inventario/mantenimiento?fila=${m.fila}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error eliminando');
      onMensaje({ tipo: 'ok', texto: 'Registro de mantenimiento eliminado.' });
      setPorEliminar(null);
      recargar();
    } catch (e) {
      onMensaje({ tipo: 'error', texto: (e as Error).message });
    }
  }

  return (
    <div className="card space-y-4">
      {error && <Aviso tipo="error">Error: {error}</Aviso>}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Mantenimientos, consumibles y repuestos</h2>
        <div className="flex gap-2">
          <BotonRecargar onClick={recargar} cargando={cargando} />
          <button className="btn-primary" onClick={() => setModal('nuevo')}>+ Registrar</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr><th className="th">Fecha</th><th className="th">Impresora</th><th className="th">Tipo</th><th className="th">Descripción</th><th className="th">Costo (COP)</th><th className="th">Responsable</th><th className="th">Próximo mant.</th><th className="th text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(datos?.mantenimientos ?? []).map((m, i) => (
              <tr key={i}>
                <td className="td whitespace-nowrap text-xs">{m.fecha}</td>
                <td className="td font-mono text-xs">{m.impresoraId}</td>
                <td className="td capitalize">{m.tipo}</td>
                <td className="td">{m.descripcion}</td>
                <td className="td whitespace-nowrap">{m.costo ? formatCOP(m.costo) : '—'}</td>
                <td className="td">{m.responsable || '—'}</td>
                <td className="td text-xs whitespace-nowrap">{m.programacion === 'fecha' ? `📅 ${m.proximaFecha}` : m.programacion === 'horas' ? `⏱ cada ${m.cadaHoras} h` : '—'}</td>
                <td className="td"><AccionesFila onEditar={() => setModal(m)} onEliminar={() => setPorEliminar(m)} /></td>
              </tr>
            ))}
            {(datos?.mantenimientos ?? []).length === 0 && <tr><td colSpan={8} className="td py-8 text-center text-slate-500">Sin registros de mantenimiento.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <ModalMantenimiento
          impresoras={dImp?.impresoras ?? []}
          editar={modal === 'nuevo' ? null : modal}
          onCerrar={() => setModal(null)}
          onGuardado={(t) => { onMensaje({ tipo: 'ok', texto: t }); recargar(); }}
        />
      )}

      {porEliminar && (
        <ModalConfirmar
          abierto titulo="Eliminar mantenimiento" icono="🗑️" tono="danger"
          confirmarTexto="Eliminar" cancelarTexto="Cancelar"
          onCancelar={() => setPorEliminar(null)}
          onConfirmar={() => hacerEliminar(porEliminar)}
        >
          ¿Eliminar el registro de mantenimiento de <b>{porEliminar.fecha}</b> ({porEliminar.tipo} — {porEliminar.descripcion})? Esta acción no se puede deshacer.
        </ModalConfirmar>
      )}
    </div>
  );
}

function ModalMantenimiento({
  impresoras, editar, onCerrar, onGuardado,
}: { impresoras: Impresora[]; editar?: Mantenimiento | null; onCerrar: () => void; onGuardado: (texto: string) => void }) {
  const [f, setF] = useState({
    fecha: editar?.fecha || new Date().toISOString().slice(0, 10),
    impresoraId: editar?.impresoraId || impresoras[0]?.id || '',
    tipo: editar?.tipo || 'preventivo',
    descripcion: editar?.descripcion || '',
    costo: editar?.costo != null ? String(editar.costo) : '',
    responsable: editar?.responsable || '',
    programacion: String(editar?.programacion || 'ninguna'),
    proximaFecha: editar?.proximaFecha || '',
    cadaHoras: editar?.cadaHoras != null ? String(editar.cadaHoras) : '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState<{ campo: string; de: string; a: string }[] | null>(null);

  const cambios = () => diffCampos([
    { campo: 'Fecha', de: editar?.fecha, a: f.fecha },
    { campo: 'Impresora', de: editar?.impresoraId, a: f.impresoraId },
    { campo: 'Tipo', de: editar?.tipo, a: f.tipo },
    { campo: 'Descripción', de: editar?.descripcion, a: f.descripcion },
    { campo: 'Costo (COP)', de: editar?.costo ?? 0, a: f.costo ? parseFloat(f.costo) : 0, fmt: (v) => (Number(v) ? formatCOP(Number(v)) : '—') },
    { campo: 'Responsable', de: editar?.responsable, a: f.responsable },
    { campo: 'Programación', de: editar?.programacion || 'ninguna', a: f.programacion },
    { campo: 'Próxima fecha', de: editar?.proximaFecha, a: f.programacion === 'fecha' ? f.proximaFecha : '' },
    { campo: 'Cada N horas', de: editar?.cadaHoras ?? '', a: f.programacion === 'horas' && f.cadaHoras ? parseFloat(f.cadaHoras) : '' },
  ]);

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/inventario/mantenimiento', {
        method: editar ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          fila: editar?.fila,
          costo: f.costo ? parseFloat(f.costo) : undefined,
          proximaFecha: f.programacion === 'fecha' ? f.proximaFecha : undefined,
          cadaHoras: f.programacion === 'horas' && f.cadaHoras ? parseFloat(f.cadaHoras) : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error guardando');
      onGuardado(editar ? 'Mantenimiento actualizado.' : 'Registro de mantenimiento guardado.');
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  if (resumen) {
    return (
      <ModalConfirmarCambios
        abierto titulo="Confirmar cambios · mantenimiento" cambios={resumen} guardando={guardando}
        onVolver={() => setResumen(null)} onConfirmar={guardar}
      />
    );
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={editar ? 'Editar mantenimiento' : 'Registrar mantenimiento / consumible / repuesto'}>
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
          <div className="col-span-2 border-t border-slate-100 pt-3">
            <label className="label">Programar el próximo mantenimiento</label>
            <select className="input" value={f.programacion} onChange={(e) => setF({ ...f, programacion: e.target.value })}>
              <option value="ninguna">Sin programar</option>
              <option value="fecha">Para una fecha específica</option>
              <option value="horas">Periódico — cada N horas de uso</option>
            </select>
          </div>
          {f.programacion === 'fecha' && (
            <div className="col-span-2"><label className="label">Fecha del próximo mantenimiento *</label><input type="date" className="input" value={f.proximaFecha} onChange={(e) => setF({ ...f, proximaFecha: e.target.value })} /></div>
          )}
          {f.programacion === 'horas' && (
            <div className="col-span-2">
              <label className="label">Repetir cada (horas de uso) *</label>
              <input type="number" min="1" className="input" value={f.cadaHoras} onChange={(e) => setF({ ...f, cadaHoras: e.target.value })} />
              <p className="text-xs text-slate-500 mt-1">{editar ? `La hora base del registro (${editar.horasBase != null ? `${editar.horasBase} h` : 'sin registrar'}) se conserva; no se modifica al editar.` : 'Se tomarán las horas acumuladas actuales de la impresora como punto de partida del intervalo.'}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary" onClick={editar ? () => setResumen(cambios()) : guardar} disabled={guardando || !f.descripcion.trim() || !f.impresoraId || (f.programacion === 'fecha' && !f.proximaFecha) || (f.programacion === 'horas' && !f.cadaHoras)}>{guardando ? 'Guardando…' : editar ? 'Revisar cambios' : 'Guardar'}</button>
        </div>
      </div>
    </Modal>
  );
}
