'use client';

// Ventana 3 — Camas de impresión: agrupan una o varias solicitudes aprobadas
// en una impresión. Incluye creación, edición (añadir solicitudes), análisis OCR
// de capturas del slicer y finalización (resultado + desperdicio + comentarios).

import { useEffect, useMemo, useState } from 'react';
import {
  AnalisisSlicerResultado, EstadoProyecto, Filamento, Impresora, ItemProyecto, Proyecto, Solicitud,
} from '@/lib/types';
import { Aviso, BarraBusqueda, BotonRecargar, Chip, Modal, useDatos } from '@/components/ui';
import { generarCodigoProyecto, canonicalizarMaterial, MATERIALES_CANONICOS } from '@/lib/util';

export default function PaginaProyectos() {
  const { datos, cargando, error, recargar } = useDatos<{ proyectos: Proyecto[] }>('/api/proyectos');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [detalle, setDetalle] = useState<Proyecto | null>(null);
  const [modalCrear, setModalCrear] = useState(false);
  const [editar, setEditar] = useState<Proyecto | null>(null);
  const [finalizar, setFinalizar] = useState<Proyecto | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error' | 'alerta'; texto: string } | null>(null);

  const proyectos = datos?.proyectos ?? [];
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proyectos.filter((p) => {
      if (filtroEstado && p.estado !== filtroEstado) return false;
      if (!q) return true;
      return [p.codigo, p.nombre, p.impresora, ...p.items.map((i) => i.nombre)]
        .some((c) => (c ?? '').toLowerCase().includes(q));
    });
  }, [proyectos, busqueda, filtroEstado]);

  async function cambiarEstado(p: Proyecto, estado: EstadoProyecto) {
    const res = await fetch(`/api/proyectos/${encodeURIComponent(p.codigo)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    const body = await res.json();
    if (!res.ok) setMensaje({ tipo: 'error', texto: body.error });
    else recargar();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Camas de impresión</h1>
          <p className="text-sm text-slate-500">Cada cama agrupa una o varias solicitudes aprobadas en una impresión</p>
        </div>
        <div className="flex gap-2">
          <BotonRecargar onClick={recargar} cargando={cargando} />
          <button className="btn-primary" onClick={() => setModalCrear(true)}>+ Nueva cama</button>
        </div>
      </div>

      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
      {error && <Aviso tipo="error">Error: {error}</Aviso>}

      <div className="card">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <BarraBusqueda valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por código, nombre, impresora…" />
          <select className="input" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {['Activa', 'En pausa', 'Finalizada'].map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Código</th>
                <th className="th">Cama</th>
                <th className="th">Impresora</th>
                <th className="th">Solicitudes</th>
                <th className="th">Material</th>
                <th className="th">Tiempo (h)</th>
                <th className="th">Estado</th>
                <th className="th">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((p) => {
                const gramos = Math.round(p.items.reduce((a, i) => a + i.gramos, 0));
                const horas = Math.round(p.items.reduce((a, i) => a + i.tiempoHoras, 0) * 10) / 10;
                const materiales = Array.from(new Set(p.items.map((i) => i.material))).join(', ');
                return (
                  <tr key={p.codigo} className="cursor-pointer transition hover:bg-steam-50" onClick={() => setDetalle(p)}>
                    <td className="td whitespace-nowrap font-mono text-xs">{p.codigo}</td>
                    <td className="td font-medium">{p.nombre}</td>
                    <td className="td">{p.impresora}</td>
                    <td className="td">{p.items.length}</td>
                    <td className="td">{gramos} g · {materiales}</td>
                    <td className="td">{horas}</td>
                    <td className="td"><Chip valor={p.estado} /></td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      {p.estado !== 'Finalizada' && (
                        <div className="flex gap-1.5">
                          <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setEditar(p)}>Editar</button>
                          <button
                            className="btn-secondary !px-2 !py-1 text-xs"
                            onClick={() => cambiarEstado(p, p.estado === 'En pausa' ? 'Activa' : 'En pausa')}
                          >
                            {p.estado === 'En pausa' ? 'Reanudar' : 'Pausar'}
                          </button>
                          <button className="btn-primary !px-2 !py-1 text-xs" onClick={() => setFinalizar(p)}>Finalizar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={8} className="td py-8 text-center text-slate-500">No hay camas. Cree la primera con &quot;+ Nueva cama&quot;.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle */}
      <Modal abierto={!!detalle} onCerrar={() => setDetalle(null)} titulo={`Cama ${detalle?.codigo ?? ''}`} ancho="max-w-3xl">
        {detalle && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Chip valor={detalle.estado} />
              {detalle.resultado && <Chip valor={detalle.resultado} />}
              <span className="text-sm text-slate-500">Impresora: <b className="text-slate-700">{detalle.impresora}</b></span>
            </div>
            <p className="text-lg font-semibold">{detalle.nombre}</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr><th className="th">Solicitante</th><th className="th">Pieza</th><th className="th">Tiempo (h)</th><th className="th">Material</th><th className="th">Rollo</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detalle.items.map((it, i) => (
                    <tr key={i}>
                      <td className="td">{it.nombre}</td>
                      <td className="td max-w-[220px] truncate" title={it.descripcionPieza}>{it.descripcionPieza}</td>
                      <td className="td">{it.tiempoHoras}</td>
                      <td className="td">{it.gramos} g · {it.material}</td>
                      <td className="td font-mono text-xs">{it.filamentoId ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detalle.estado === 'Finalizada' && (
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="label">Resultado</p><p>{detalle.resultado || '—'}</p></div>
                <div><p className="label">Desperdicio</p><p>{detalle.desperdicio ?? 0} g</p></div>
                <div><p className="label">Comentarios</p><p>{detalle.comentarios || '—'}</p></div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {(modalCrear || editar) && (
        <ModalProyecto
          proyectoExistente={editar}
          onCerrar={() => { setModalCrear(false); setEditar(null); }}
          onGuardado={(texto) => { setMensaje({ tipo: 'ok', texto }); recargar(); }}
        />
      )}

      {finalizar && (
        <ModalFinalizar
          proyecto={finalizar}
          onCerrar={() => setFinalizar(null)}
          onFinalizado={(texto, adv) => {
            setMensaje(adv.length > 0 ? { tipo: 'alerta', texto: `${texto} Advertencias: ${adv.join(' | ')}` } : { tipo: 'ok', texto });
            recargar();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de creación / edición de proyecto (incluye Análisis OCR)
// ---------------------------------------------------------------------------

interface ItemForm extends ItemProyecto { _key: string }

function ModalProyecto({
  proyectoExistente, onCerrar, onGuardado,
}: {
  proyectoExistente: Proyecto | null;
  onCerrar: () => void;
  onGuardado: (texto: string) => void;
}) {
  const esEdicion = !!proyectoExistente;
  const { datos: dSol } = useDatos<{ solicitudes: Solicitud[] }>('/api/solicitudes', 5 * 60_000);
  const { datos: dImp } = useDatos<{ impresoras: Impresora[] }>('/api/inventario/impresoras', 5 * 60_000);
  const { datos: dFil } = useDatos<{ filamentos: Filamento[] }>('/api/inventario/filamentos', 5 * 60_000);
  const { datos: dProy } = useDatos<{ proyectos: Proyecto[] }>('/api/proyectos', 5 * 60_000);

  const [codigo, setCodigo] = useState('');
  const [impresora, setImpresora] = useState(proyectoExistente?.impresora ?? '');
  const [items, setItems] = useState<ItemForm[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [analisis, setAnalisis] = useState<AnalisisSlicerResultado[] | null>(null);
  const [analizando, setAnalizando] = useState(false);

  // Solo solicitudes aprobadas (y que no estén ya en el proyecto en edición)
  const yaIncluidas = new Set(proyectoExistente?.items.map((i) => i.solicitudId) ?? []);
  const aprobadas = (dSol?.solicitudes ?? []).filter((s) => s.estado === 'Aprobada' && !yaIncluidas.has(s.id));
  const impresoras = dImp?.impresoras ?? [];
  const filamentos = dFil?.filamentos ?? [];
  const codigosExistentes = (dProy?.proyectos ?? []).map((p) => p.codigo);

  // Al crear, sugiere un código automático (IMP-AAMMDD-NN) editable por el usuario.
  useEffect(() => {
    if (!esEdicion && !codigo && dProy) setCodigo(generarCodigoProyecto(codigosExistentes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dProy]);

  const codigoNorm = codigo.trim().toLowerCase();
  const codigoDuplicado = !!codigoNorm && codigosExistentes.some((c) => c.trim().toLowerCase() === codigoNorm);

  function alternarSolicitud(s: Solicitud) {
    const existe = items.find((i) => i.solicitudId === s.id);
    if (existe) {
      setItems(items.filter((i) => i.solicitudId !== s.id));
    } else {
      setItems([...items, {
        _key: s.id, solicitudId: s.id, nombre: s.nombre, correo: s.correo,
        descripcionPieza: s.descripcionPieza, tiempoHoras: 0, gramos: 0, material: 'PLA', filamentoId: undefined,
      }]);
    }
  }

  function actualizarItem(key: string, cambios: Partial<ItemProyecto>) {
    setItems(items.map((i) => (i._key === key ? { ...i, ...cambios } : i)));
  }

  /** Cambios al ESTABLECER un material (canonicalizado). Si el filamento ya
   *  asignado es de otro tipo, lo desasigna automáticamente para mantener
   *  la concordancia entre Material y Filamento (inventario). */
  function cambiosMaterial(key: string, valorCrudo: string): Partial<ItemProyecto> {
    const material = canonicalizarMaterial(valorCrudo);
    const item = items.find((i) => i._key === key);
    const fl = item?.filamentoId ? filamentos.find((f) => f.id === item.filamentoId) : undefined;
    if (fl && material.trim() && canonicalizarMaterial(String(fl.tipo)) !== material) {
      return { material, filamentoId: undefined };
    }
    return { material };
  }

  async function analizarCapturas(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAnalizando(true);
    setError('');
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('imagenes', f));
      const res = await fetch('/api/ia/analizar-slicer', { method: 'POST', body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error analizando las capturas');
      setAnalisis(body.resultados);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalizando(false);
    }
  }

  function aplicarAnalisis(r: AnalisisSlicerResultado, key: string) {
    const cambios: Partial<ItemProyecto> = {};
    if (r.pesoGramos != null) cambios.gramos = r.pesoGramos;
    if (r.tiempoHoras != null) cambios.tiempoHoras = r.tiempoHoras;
    if (r.material) Object.assign(cambios, cambiosMaterial(key, r.material));
    actualizarItem(key, cambios);
  }

  async function guardar() {
    if (!esEdicion) {
      if (!codigo.trim()) { setError('Ingrese un código para la cama.'); return; }
      if (codigoDuplicado) { setError(`Ya existe una cama con el código "${codigo.trim()}". Cambie el código para continuar.`); return; }
    }
    setGuardando(true);
    setError('');
    try {
      const payload = items.map(({ _key, ...rest }) => {
        const material = canonicalizarMaterial(rest.material);
        // Red de seguridad: si el filamento asignado no concuerda con el material, desasignar.
        const fl = rest.filamentoId ? filamentos.find((f) => f.id === rest.filamentoId) : undefined;
        const filamentoId = fl && material.trim() && canonicalizarMaterial(String(fl.tipo)) !== material
          ? undefined : rest.filamentoId;
        return { ...rest, material, filamentoId };
      });
      let res: Response;
      if (esEdicion) {
        res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoExistente!.codigo)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: payload }),
        });
      } else {
        res = await fetch('/api/proyectos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: codigo.trim(), impresora, items: payload }),
        });
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error guardando la cama');
      onGuardado(esEdicion
        ? `Solicitudes añadidas a la cama ${proyectoExistente!.codigo}.`
        : `Cama creada con código ${body.codigo}.`);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={esEdicion ? `Añadir solicitudes a ${proyectoExistente!.codigo}` : 'Nueva cama de impresión'}
      ancho="max-w-5xl"
    >
      <div className="space-y-5">
        {error && <Aviso tipo="error">{error}</Aviso>}

        {!esEdicion && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Código de la cama *</label>
              <input
                className={`input ${codigoDuplicado ? '!border-red-400 !ring-red-200' : ''}`}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="IMP-AAMMDD-NN"
              />
              {codigoDuplicado ? (
                <p className="mt-1 text-xs text-red-600">Ya existe una cama con este código. Cámbielo para continuar.</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Generado automáticamente; puede modificarlo. Debe ser único.</p>
              )}
            </div>
            <div>
              <label className="label">Impresora *</label>
              <select className="input" value={impresora} onChange={(e) => setImpresora(e.target.value)}>
                <option value="">Seleccione…</option>
                {impresoras.map((i) => <option key={i.id} value={i.nombre}>{i.nombre} — {i.modelo}</option>)}
              </select>
            </div>
          </div>
        )}

        <div>
          <p className="label">Solicitudes aprobadas disponibles (seleccione una o varias) *</p>
          {aprobadas.length === 0 ? (
            <Aviso tipo="info">No hay solicitudes en estado &quot;Aprobada&quot; disponibles.</Aviso>
          ) : (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {aprobadas.map((s) => {
                const sel = !!items.find((i) => i.solicitudId === s.id);
                return (
                  <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${sel ? 'bg-steam-50 ring-1 ring-steam-300' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={sel} onChange={() => alternarSolicitud(s)} className="accent-steam-600" />
                    <span className="font-medium">{s.nombre}</span>
                    <span className="truncate text-slate-500">{s.descripcionPieza}</span>
                    <span className="ml-auto shrink-0 text-xs text-slate-400">{s.fechaTentativa}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <>
            {/* Análisis OCR (visión artificial local, sin IA) */}
            <div className="rounded-xl border border-dashed border-steam-300 bg-steam-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-steam-700">🔍 Análisis OCR (capturas del slicer)</p>
                  <p className="text-xs text-slate-500">Suba capturas de Bambu Studio / Cura / Prusa y el OCR extraerá gramos, tiempo y material localmente (sin IA).</p>
                </div>
                <label className="btn-secondary cursor-pointer">
                  {analizando ? 'Analizando…' : 'Subir capturas'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" multiple hidden disabled={analizando}
                    onChange={(e) => { analizarCapturas(e.target.files); e.target.value = ''; }} />
                </label>
              </div>

              {analisis && (
                <div className="mt-3 space-y-2">
                  {analisis.map((r, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{r.archivo}</span>
                        <span className="font-medium">{r.pesoGramos != null ? `${r.pesoGramos} g` : '⚠ peso no identificado'}</span>
                        <span>·</span>
                        <span className="font-medium">{r.tiempoTexto ? `${r.tiempoTexto} (${r.tiempoHoras} h)` : '⚠ tiempo no identificado'}</span>
                        <span>·</span>
                        <span className="font-medium">{r.material ?? '⚠ material no identificado'}</span>
                        <select
                          className="input ml-auto !w-auto text-xs"
                          defaultValue=""
                          onChange={(e) => { if (e.target.value) aplicarAnalisis(r, e.target.value); }}
                        >
                          <option value="">Asignar a solicitud…</option>
                          {items.map((i) => <option key={i._key} value={i._key}>{i.nombre}</option>)}
                        </select>
                      </div>
                      {r.camposNoIdentificados.length > 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          No se pudo identificar: {r.camposNoIdentificados.join(', ')}. Complete esos datos manualmente.
                        </p>
                      )}
                      {r.notas && <p className="mt-1 text-xs text-slate-500">{r.notas}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Datos por solicitud */}
            <div>
              <p className="label">Datos de impresión por solicitud *</p>
              <div className="space-y-2">
                {items.map((it) => {
                  const fil = filamentos.find((f) => f.id === it.filamentoId);
                  const insuficiente = !!fil && it.gramos > 0 && it.gramos > fil.gramosRestantes;
                  const desc = (f: Filamento) => `${f.tipo} ${f.color}${f.marca ? ` ${f.marca}` : ''}`;
                  // El tiempo se guarda internamente en horas decimales (tiempoHoras);
                  // aquí se reparte en horas + minutos para mostrarlo/editarlo.
                  const totalMin = Math.round((it.tiempoHoras || 0) * 60);
                  const horas = Math.floor(totalMin / 60);
                  const minutos = totalMin % 60;
                  // Filtra los filamentos por el Material indicado (con tolerancia),
                  // mostrando solo los del mismo tipo con stock (más el ya asignado).
                  const matCanon = canonicalizarMaterial(it.material);
                  const coincideMaterial = (f: Filamento) =>
                    !it.material.trim() || canonicalizarMaterial(String(f.tipo)) === matCanon;
                  const opcionesFil = filamentos.filter(
                    (f) => (f.gramosRestantes > 0 && coincideMaterial(f)) || f.id === it.filamentoId);
                  const sinCompatibles = !!it.material.trim()
                    && !filamentos.some((f) => f.gramosRestantes > 0 && coincideMaterial(f));
                  return (
                    <div key={it._key} className="rounded-lg border border-slate-200 p-3">
                      <div className="grid items-center gap-2 md:grid-cols-[1fr_150px_100px_120px_200px]">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{it.nombre}</p>
                          <p className="truncate text-xs text-slate-500">{it.descripcionPieza}</p>
                        </div>
                        <div>
                          <label className="label">Tiempo (h / min)</label>
                          <div className="flex gap-1">
                            <input type="number" min="0" className="input" placeholder="h" value={horas || ''}
                              onChange={(e) => actualizarItem(it._key, { tiempoHoras: (parseInt(e.target.value) || 0) + minutos / 60 })} />
                            <input type="number" min="0" max="59" className="input" placeholder="min" value={minutos || ''}
                              onChange={(e) => actualizarItem(it._key, { tiempoHoras: horas + (parseInt(e.target.value) || 0) / 60 })} />
                          </div>
                        </div>
                        <div>
                          <label className="label">Gramos</label>
                          <input type="number" min="0" step="0.1" className="input" value={it.gramos || ''}
                            onChange={(e) => actualizarItem(it._key, { gramos: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <label className="label">Material</label>
                          <input
                            className="input"
                            list="cama-materiales"
                            value={it.material}
                            onChange={(e) => actualizarItem(it._key, { material: e.target.value })}
                            onBlur={(e) => actualizarItem(it._key, cambiosMaterial(it._key, e.target.value))}
                            placeholder="Escriba el material"
                          />
                        </div>
                        <div>
                          <label className="label">Filamento (inventario)</label>
                          <select
                            className={`input ${insuficiente ? '!border-amber-400 !ring-amber-200' : ''}`}
                            value={it.filamentoId ?? ''}
                            onChange={(e) => {
                              const id = e.target.value || undefined;
                              const fl = filamentos.find((f) => f.id === id);
                              actualizarItem(it._key, fl ? { filamentoId: id, material: canonicalizarMaterial(String(fl.tipo)) } : { filamentoId: id });
                            }}
                          >
                            <option value="">Sin asignar</option>
                            {opcionesFil.map((fl) => (
                              <option key={fl.id} value={fl.id}>{desc(fl)} — {Math.round(fl.gramosRestantes)} g disp.</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {fil ? (
                        <p className={`mt-2 text-xs ${insuficiente ? 'text-amber-700' : 'text-slate-500'}`}>
                          {insuficiente
                            ? `⚠ Requiere ${Math.round(it.gramos)} g y solo hay ${Math.round(fil.gramosRestantes)} g de ${desc(fil)}. Se descontará igual al finalizar (puede quedar en 0).`
                            : `Disponible: ${Math.round(fil.gramosRestantes)} g de ${desc(fil)}. Se descontarán los gramos de esta pieza al finalizar la cama.`}
                        </p>
                      ) : sinCompatibles ? (
                        <p className="mt-2 text-xs text-amber-700">No hay filamentos de <b>{canonicalizarMaterial(it.material)}</b> con stock en el inventario. Registre uno o cambie el material.</p>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400">Sin filamento asignado: no se descontará inventario al finalizar.</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <datalist id="cama-materiales">
                {MATERIALES_CANONICOS.map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={guardar}
            disabled={guardando || items.length === 0 || (!esEdicion && (!codigo.trim() || codigoDuplicado || !impresora))}
          >
            {guardando ? 'Guardando…' : esEdicion ? 'Añadir a la cama' : 'Crear cama'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modal de finalización
// ---------------------------------------------------------------------------

function ModalFinalizar({
  proyecto, onCerrar, onFinalizado,
}: {
  proyecto: Proyecto;
  onCerrar: () => void;
  onFinalizado: (texto: string, advertencias: string[]) => void;
}) {
  const [resultado, setResultado] = useState<'Exitoso' | 'Fallido'>('Exitoso');
  const [desperdicio, setDesperdicio] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function confirmar() {
    setEnviando(true);
    setError('');
    try {
      const res = await fetch(`/api/proyectos/${encodeURIComponent(proyecto.codigo)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultado,
          desperdicio: desperdicio.trim() === '' ? null : parseFloat(desperdicio),
          comentarios,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error finalizando la cama');
      onFinalizado(`Cama ${proyecto.codigo} finalizada (${resultado}). Inventario actualizado. Recuerde marcar las solicitudes como "Atendida" desde la ventana de Solicitudes.`, body.advertencias ?? []);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Finalizar cama ${proyecto.codigo}`}>
      <div className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Aviso tipo="info">
          Al confirmar: se actualizarán las {proyecto.items.length} solicitud(es) de la cama en el Sheets de historial
          y se descontará el filamento del inventario. El estado de las solicitudes <b>no cambia</b>: para marcarlas
          como <b>Atendida</b>, hágalo manualmente desde la ventana de Solicitudes.
        </Aviso>
        <div>
          <label className="label">Resultado de impresión *</label>
          <select className="input" value={resultado} onChange={(e) => setResultado(e.target.value as 'Exitoso' | 'Fallido')}>
            <option>Exitoso</option>
            <option>Fallido</option>
          </select>
        </div>
        <div>
          <label className="label">Material desperdiciado en g (opcional)</label>
          <input type="number" min="0" step="0.1" className="input" value={desperdicio} onChange={(e) => setDesperdicio(e.target.value)} placeholder="Ej: 12" />
        </div>
        <div>
          <label className="label">Comentarios (opcional)</label>
          <textarea className="input min-h-[80px]" value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary" onClick={confirmar} disabled={enviando}>
            {enviando ? 'Finalizando…' : 'Confirmar finalización'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
