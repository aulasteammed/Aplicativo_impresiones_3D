'use client';

// Ventana 3 — Camas de impresión: agrupan una o varias solicitudes aprobadas
// en una impresión. Incluye creación, edición (añadir solicitudes), análisis OCR
// de capturas del slicer y finalización (resultado + desperdicio + comentarios).

import { useEffect, useMemo, useState } from 'react';
import {
  AnalisisSlicerResultado, EstadoProyecto, Filamento, Impresora, ItemProyecto, Proyecto, Solicitud,
} from '@/lib/types';
import { AccionesFila, Aviso, BarraBusqueda, BotonRecargar, Chip, Combobox, Modal, ModalConfirmar, Paginacion, useDatos } from '@/components/ui';
import { generarCodigoProyecto, canonicalizarMaterial, esCamaEnCurso, MATERIALES_CANONICOS, FILAMENTO_PROPIO } from '@/lib/util';

export default function PaginaProyectos() {
  const { datos, cargando, error, recargar } = useDatos<{ proyectos: Proyecto[] }>('/api/proyectos');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [detalle, setDetalle] = useState<Proyecto | null>(null);
  const [modalCrear, setModalCrear] = useState(false);
  const [editar, setEditar] = useState<Proyecto | null>(null);
  const [finalizar, setFinalizar] = useState<Proyecto | null>(null);
  const [porEliminar, setPorEliminar] = useState<Proyecto | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error' | 'alerta'; texto: string } | null>(null);

  async function hacerEliminar(p: Proyecto) {
    setEliminando(true);
    try {
      const res = await fetch(`/api/proyectos/${encodeURIComponent(p.codigo)}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error eliminando la cama');
      setMensaje({ tipo: 'ok', texto: `Cama ${p.codigo} eliminada.` });
      setPorEliminar(null);
      recargar();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    } finally { setEliminando(false); }
  }

  const proyectos = datos?.proyectos ?? [];
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proyectos.filter((p) => {
      if (!esCamaEnCurso(p.estado)) return false; // las finalizadas viven en "Historial"
      if (filtroEstado && p.estado !== filtroEstado) return false;
      if (!q) return true;
      return [p.codigo, p.nombre, p.impresora, ...p.items.map((i) => i.nombre)]
        .some((c) => (c ?? '').toLowerCase().includes(q));
    });
  }, [proyectos, busqueda, filtroEstado]);

  // Paginación
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(20);
  useEffect(() => { setPagina(1); }, [busqueda, filtroEstado, tamano]);
  const paginaActual = Math.min(pagina, Math.max(1, Math.ceil(filtrados.length / tamano)));
  const paginados = filtrados.slice((paginaActual - 1) * tamano, paginaActual * tamano);

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

  /** Cambio de estado desde el chip. "Finalizada" abre el modal (necesita
   *  resultado/desperdicio y descuenta inventario); los demás son cambio directo. */
  function onEstadoChange(p: Proyecto, estado: EstadoProyecto) {
    if (estado === p.estado) return;
    if (estado === 'Finalizada') { setFinalizar(p); return; }
    cambiarEstado(p, estado);
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
            {['Activa', 'En pausa'].map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>

        {cargando && !datos ? (
          <p className="py-8 text-center text-slate-500">Cargando camas…</p>
        ) : (
        <>
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
              {paginados.map((p) => {
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
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-flex items-center rounded-full focus-within:ring-2 focus-within:ring-steam-400" title="Cambiar estado de la cama">
                        <Chip valor={p.estado} />
                        <span className="pointer-events-none ml-1 text-xs text-slate-400">▾</span>
                        <select
                          aria-label="Cambiar estado de la cama"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          value={p.estado}
                          onChange={(e) => onEstadoChange(p, e.target.value as EstadoProyecto)}
                        >
                          <option value="Activa">Activa</option>
                          <option value="En pausa">En pausa</option>
                          <option value="Finalizada">Finalizada</option>
                        </select>
                      </div>
                    </td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <AccionesFila onEditar={() => setEditar(p)} onEliminar={() => setPorEliminar(p)} />
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
        <Paginacion total={filtrados.length} pagina={paginaActual} tamano={tamano} onPagina={setPagina} onTamano={setTamano} />
        </>
        )}
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

      {porEliminar && (
        <ModalConfirmar
          abierto titulo="Eliminar cama" icono="🗑️" tono="danger"
          confirmarTexto="Eliminar" cancelarTexto="Cancelar" procesando={eliminando}
          onCancelar={() => setPorEliminar(null)}
          onConfirmar={() => hacerEliminar(porEliminar)}
        >
          ¿Eliminar la cama <b>{porEliminar.codigo}</b> ({porEliminar.impresora}, {porEliminar.items.length} solicitud{porEliminar.items.length === 1 ? '' : 'es'})? Se borrará del historial. Esta acción no se puede deshacer.
        </ModalConfirmar>
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

  const [codigo, setCodigo] = useState(proyectoExistente?.codigo ?? '');
  const [impresora, setImpresora] = useState(proyectoExistente?.impresora ?? '');
  const [items, setItems] = useState<ItemForm[]>(
    () => (proyectoExistente ? proyectoExistente.items.map((i) => ({ ...i, _key: i.solicitudId })) : []),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [analisis, setAnalisis] = useState<AnalisisSlicerResultado[] | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [mostrarResumen, setMostrarResumen] = useState(false);

  // Solicitudes en estado "Aprobada": se pueden añadir/quitar de la cama. Las que ya
  // están en la cama aparecen marcadas (desmarcar = quitar).
  const aprobadas = (dSol?.solicitudes ?? []).filter((s) => s.estado === 'Aprobada');
  const impresoras = dImp?.impresoras ?? [];
  // No se puede asignar una cama a una impresora en mantenimiento. En edición se
  // conserva la que ya tuviera la cama (marcada) para no perder la asignación.
  const opcionesImpresora = impresoras.filter((i) => i.estado !== 'Mantenimiento' || i.nombre === impresora);
  const filamentos = dFil?.filamentos ?? [];
  // Materiales que se ofrecen al crear la cama = tipos de filamento que tienen
  // stock en el inventario (así solo aparecen materiales imprimibles, incluidos
  // los filamentos recién creados; no una lista fija).
  const materialesInventario = Array.from(new Set(
    filamentos.filter((f) => f.gramosRestantes > 0).map((f) => canonicalizarMaterial(String(f.tipo))).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, 'es'));
  const codigosExistentes = (dProy?.proyectos ?? []).map((p) => p.codigo);

  // Al crear, sugiere un código automático (IMP-DDMMAA-NN) editable por el usuario.
  useEffect(() => {
    if (!esEdicion && !codigo && dProy) setCodigo(generarCodigoProyecto(codigosExistentes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dProy]);

  const codigoNorm = codigo.trim().toLowerCase();
  const propioNorm = (proyectoExistente?.codigo ?? '').trim().toLowerCase();
  // En edición, que el código coincida con el propio de la cama NO es duplicado.
  const codigoDuplicado = !!codigoNorm && codigosExistentes.some((c) => {
    const cn = c.trim().toLowerCase();
    return cn === codigoNorm && cn !== propioNorm;
  });

  function alternarSolicitud(s: Solicitud) {
    const existe = items.find((i) => i.solicitudId === s.id);
    if (existe) {
      setItems(items.filter((i) => i.solicitudId !== s.id));
      return;
    }
    // Al re-añadir una solicitud que ya era de la cama, se restauran sus valores originales.
    const orig = proyectoExistente?.items.find((i) => i.solicitudId === s.id);
    setItems([...items, orig
      ? { ...orig, _key: s.id }
      : {
        _key: s.id, solicitudId: s.id, nombre: s.nombre, correo: s.correo,
        descripcionPieza: s.descripcionPieza, tiempoHoras: 0, gramos: 0, material: '', filamentoId: undefined,
      }]);
  }

  function quitarItem(key: string) {
    setItems(items.filter((i) => i._key !== key));
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

  function construirPayload(): ItemProyecto[] {
    return items.map(({ _key, ...rest }) => {
      const material = canonicalizarMaterial(rest.material);
      // Red de seguridad: si el filamento asignado no concuerda con el material, desasignar.
      const fl = rest.filamentoId ? filamentos.find((f) => f.id === rest.filamentoId) : undefined;
      const filamentoId = fl && material.trim() && canonicalizarMaterial(String(fl.tipo)) !== material
        ? undefined : rest.filamentoId;
      return { ...rest, material, filamentoId };
    });
  }

  // --- Crear (POST) ---
  async function guardar() {
    if (!codigo.trim()) { setError('Ingrese un código para la cama.'); return; }
    if (codigoDuplicado) { setError(`Ya existe una cama con el código "${codigo.trim()}". Cambie el código para continuar.`); return; }
    if (!impresora) { setError('Seleccione una impresora.'); return; }
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/proyectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigo.trim(), impresora, items: construirPayload() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error guardando la cama');
      onGuardado(`Cama creada con código ${body.codigo}.`);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  // --- Editar (PATCH): revisar → confirmar en el resumen → aplicar ---
  function revisarCambios() {
    if (!codigo.trim()) { setError('Ingrese un código para la cama.'); return; }
    if (codigoDuplicado) { setError(`Ya existe otra cama con el código "${codigo.trim()}".`); return; }
    if (!impresora) { setError('Seleccione una impresora.'); return; }
    setError('');
    setMostrarResumen(true);
  }

  async function guardarEdicion() {
    setGuardando(true);
    setError('');
    try {
      const res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoExistente!.codigo)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editar: true, nuevoCodigo: codigo.trim(), impresora, items: construirPayload() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error guardando los cambios');
      onGuardado(`Cama ${body.codigo || codigo.trim()} actualizada.`);
      onCerrar();
    } catch (e) {
      setMostrarResumen(false);
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  const fmtHM = (h: number) => { const m = Math.round((h || 0) * 60); return `${Math.floor(m / 60)} h ${m % 60} min`; };

  /** Diferencias entre la cama original y la edición actual (para el resumen de confirmación). */
  function calcularCambios() {
    const orig = proyectoExistente!;
    const origPorId = new Map(orig.items.map((i) => [i.solicitudId, i]));
    const curPorId = new Map(items.map((i) => [i.solicitudId, i]));
    const agregadas = items.filter((i) => !origPorId.has(i.solicitudId)).map((i) => i.nombre);
    const eliminadas = orig.items.filter((i) => !curPorId.has(i.solicitudId)).map((i) => i.nombre);
    const modificadas: { nombre: string; cambios: string[] }[] = [];
    for (const cur of items) {
      const o = origPorId.get(cur.solicitudId);
      if (!o) continue;
      const ch: string[] = [];
      if (Math.round((o.tiempoHoras || 0) * 60) !== Math.round((cur.tiempoHoras || 0) * 60)) ch.push(`tiempo ${fmtHM(o.tiempoHoras)} → ${fmtHM(cur.tiempoHoras)}`);
      if (Math.round((o.gramos || 0) * 10) !== Math.round((cur.gramos || 0) * 10)) ch.push(`gramos ${Math.round(o.gramos)} → ${Math.round(cur.gramos)}`);
      if (canonicalizarMaterial(o.material) !== canonicalizarMaterial(cur.material)) ch.push(`material ${o.material || '—'} → ${canonicalizarMaterial(cur.material) || '—'}`);
      if ((o.filamentoId || '') !== (cur.filamentoId || '')) ch.push(`filamento ${o.filamentoId || 'sin asignar'} → ${cur.filamentoId || 'sin asignar'}`);
      if (ch.length) modificadas.push({ nombre: cur.nombre, cambios: ch });
    }
    const codigoCambio = codigo.trim() !== orig.codigo ? { de: orig.codigo, a: codigo.trim() } : null;
    const impresoraCambio = impresora !== orig.impresora ? { de: orig.impresora, a: impresora } : null;
    const hayCambios = !!codigoCambio || !!impresoraCambio || agregadas.length > 0 || eliminadas.length > 0 || modificadas.length > 0;
    return { codigoCambio, impresoraCambio, agregadas, eliminadas, modificadas, hayCambios };
  }

  return (
    <>
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={esEdicion ? `Editar cama ${proyectoExistente!.codigo}` : 'Nueva cama de impresión'}
      ancho="max-w-5xl"
    >
      <div className="space-y-5">
        {error && <Aviso tipo="error">{error}</Aviso>}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Código de la cama *</label>
            <input
              className={`input ${codigoDuplicado ? '!border-red-400 !ring-red-200' : ''}`}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="IMP-DDMMAA-NN"
            />
            {codigoDuplicado ? (
              <p className="mt-1 text-xs text-red-600">Ya existe otra cama con este código. Cámbielo para continuar.</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">{esEdicion ? 'Puede modificar el código de la cama. Debe ser único.' : 'Generado automáticamente; puede modificarlo. Debe ser único.'}</p>
            )}
          </div>
          <div>
            <label className="label">Impresora *</label>
            <select className="input" value={impresora} onChange={(e) => setImpresora(e.target.value)}>
              <option value="">Seleccione…</option>
              {opcionesImpresora.map((i) => (
                <option key={i.id} value={i.nombre}>{i.nombre} — {i.modelo}{i.estado === 'Mantenimiento' ? ' (en mantenimiento)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="label">Solicitudes aprobadas (marque para incluir en la cama) *</p>
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
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{it.nombre}</p>
                            <p className="truncate text-xs text-slate-500">{it.descripcionPieza}</p>
                          </div>
                          <button type="button" onClick={() => quitarItem(it._key)} className="shrink-0 text-sm text-rose-500 hover:text-rose-700" title="Quitar esta solicitud de la cama">✕</button>
                        </div>
                        <div>
                          <label className="label">Tiempo (h / min) *</label>
                          <div className="flex gap-1">
                            <input type="number" min="0" className="input" placeholder="h" value={horas || ''}
                              onChange={(e) => actualizarItem(it._key, { tiempoHoras: (parseInt(e.target.value) || 0) + minutos / 60 })} />
                            <input type="number" min="0" max="59" className="input" placeholder="min" value={minutos || ''}
                              onChange={(e) => actualizarItem(it._key, { tiempoHoras: horas + (parseInt(e.target.value) || 0) / 60 })} />
                          </div>
                        </div>
                        <div>
                          <label className="label">Gramos *</label>
                          <input type="number" min="0" step="0.1" className="input" value={it.gramos || ''}
                            onChange={(e) => actualizarItem(it._key, { gramos: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <label className="label">Material *</label>
                          <Combobox
                            valor={it.material}
                            onCambio={(v) => actualizarItem(it._key, { material: v })}
                            onBlur={(v) => actualizarItem(it._key, cambiosMaterial(it._key, v))}
                            opciones={it.filamentoId === FILAMENTO_PROPIO ? MATERIALES_CANONICOS : materialesInventario}
                            placeholder={it.filamentoId === FILAMENTO_PROPIO ? 'Escriba el material del filamento propio' : 'Elija un material del inventario'}
                          />
                        </div>
                        <div>
                          <label className="label">Filamento (inventario)</label>
                          <select
                            className={`input ${insuficiente ? '!border-amber-400 !ring-amber-200' : ''}`}
                            value={it.filamentoId ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === FILAMENTO_PROPIO) { actualizarItem(it._key, { filamentoId: FILAMENTO_PROPIO }); return; }
                              const id = v || undefined;
                              const fl = filamentos.find((f) => f.id === id);
                              actualizarItem(it._key, fl ? { filamentoId: id, material: canonicalizarMaterial(String(fl.tipo)) } : { filamentoId: id });
                            }}
                          >
                            <option value="">Sin asignar</option>
                            <option value={FILAMENTO_PROPIO}>Filamento propio (lo trae el solicitante)</option>
                            {opcionesFil.map((fl) => (
                              <option key={fl.id} value={fl.id}>{desc(fl)} — {Math.round(fl.gramosRestantes)} g disp.</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {it.filamentoId === FILAMENTO_PROPIO ? (
                        <p className="mt-2 text-xs text-amber-700">⚠ Filamento proporcionado por el usuario, no se descontará del inventario. Registre el <b>material</b> y los <b>gramos</b> para la trazabilidad de la impresión.</p>
                      ) : fil ? (
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
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={esEdicion ? revisarCambios : guardar}
            disabled={guardando || items.length === 0 || !codigo.trim() || codigoDuplicado || !impresora
              || items.some((it) => !(it.gramos > 0) || !(it.tiempoHoras > 0) || !it.material.trim())}
          >
            {guardando ? 'Guardando…' : esEdicion ? 'Revisar cambios' : 'Crear cama'}
          </button>
        </div>
      </div>
    </Modal>

      {/* Resumen de cambios (confirmación antes de aplicar la edición) */}
      {mostrarResumen && esEdicion && (() => {
        const c = calcularCambios();
        return (
          <Modal abierto onCerrar={() => setMostrarResumen(false)} titulo={`Confirmar cambios · ${proyectoExistente!.codigo}`} ancho="max-w-xl" centrado>
            <div className="space-y-4">
              {error && <Aviso tipo="error">{error}</Aviso>}
              {!c.hayCambios ? (
                <Aviso tipo="info">No se detectaron cambios respecto a la cama original.</Aviso>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-slate-600">Revisa los cambios antes de aplicarlos a la cama:</p>
                  {c.codigoCambio && (
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><b>Código:</b> <span className="font-mono">{c.codigoCambio.de}</span> → <span className="font-mono text-steam-700">{c.codigoCambio.a}</span></div>
                  )}
                  {c.impresoraCambio && (
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><b>Impresora:</b> {c.impresoraCambio.de} → <span className="text-steam-700">{c.impresoraCambio.a}</span></div>
                  )}
                  {c.agregadas.length > 0 && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <b className="text-emerald-800">Solicitudes añadidas ({c.agregadas.length}):</b>
                      <ul className="mt-1 list-disc pl-5 text-emerald-900">{c.agregadas.map((n, i) => <li key={i}>{n}</li>)}</ul>
                    </div>
                  )}
                  {c.eliminadas.length > 0 && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                      <b className="text-rose-800">Solicitudes eliminadas ({c.eliminadas.length}):</b>
                      <ul className="mt-1 list-disc pl-5 text-rose-900">{c.eliminadas.map((n, i) => <li key={i}>{n}</li>)}</ul>
                    </div>
                  )}
                  {c.modificadas.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <b className="text-amber-800">Solicitudes modificadas ({c.modificadas.length}):</b>
                      <ul className="mt-1 space-y-1 text-amber-900">
                        {c.modificadas.map((m, i) => <li key={i}><span className="font-medium">{m.nombre}</span>: {m.cambios.join(' · ')}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setMostrarResumen(false)} disabled={guardando}>Volver a editar</button>
                <button className="btn-primary" onClick={guardarEdicion} disabled={guardando || !c.hayCambios}>{guardando ? 'Guardando…' : 'Confirmar cambios'}</button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </>
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
  const [porPieza, setPorPieza] = useState(false);
  const [despPieza, setDespPieza] = useState<Record<string, string>>({});
  const [comentarios, setComentarios] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const multi = proyecto.items.length > 1;

  async function confirmar() {
    setEnviando(true);
    setError('');
    try {
      const cuerpo: { resultado: string; comentarios: string; desperdicio?: number | null; desperdicioPorPieza?: Record<string, number> } = { resultado, comentarios };
      if (multi && porPieza) {
        // Desperdicio detallado por pieza (una casilla por solicitud).
        const mapa: Record<string, number> = {};
        proyecto.items.forEach((it) => { mapa[it.solicitudId] = parseFloat(despPieza[it.solicitudId] || '') || 0; });
        cuerpo.desperdicioPorPieza = mapa;
      } else {
        // Total de la cama (se repartirá equitativamente entre las piezas en el backend).
        cuerpo.desperdicio = desperdicio.trim() === '' ? null : parseFloat(desperdicio);
      }
      const res = await fetch(`/api/proyectos/${encodeURIComponent(proyecto.codigo)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
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
        {multi && (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm">
            <input type="checkbox" className="accent-steam-600" checked={porPieza} onChange={(e) => setPorPieza(e.target.checked)} />
            <span>Ingresar el desperdicio <b>por pieza</b> (una casilla por solicitud)</span>
          </label>
        )}
        {multi && porPieza ? (
          <div className="space-y-2">
            <p className="label">Material desperdiciado por pieza en g (opcional)</p>
            {proyecto.items.map((it) => (
              <div key={it.solicitudId} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.nombre}</p>
                  <p className="truncate text-xs text-slate-500">{it.descripcionPieza}</p>
                </div>
                <input type="number" min="0" step="0.1" className="input w-28" placeholder="g" value={despPieza[it.solicitudId] ?? ''}
                  onChange={(e) => setDespPieza((p) => ({ ...p, [it.solicitudId]: e.target.value }))} />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <label className="label">Material desperdiciado en g (opcional)</label>
            <input type="number" min="0" step="0.1" className="input" value={desperdicio} onChange={(e) => setDesperdicio(e.target.value)} placeholder="Ej: 12" />
            {multi && <p className="mt-1 text-xs text-slate-500">Se repartirá equitativamente entre las {proyecto.items.length} piezas de la cama.</p>}
          </div>
        )}
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
