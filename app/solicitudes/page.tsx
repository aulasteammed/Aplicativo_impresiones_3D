'use client';

// Ventana 2 — Gestión de solicitudes: tabla conectada a la hoja de respuestas
// del Google Forms, con detalle, cambio de estado + notificación por correo,
// y creación de solicitudes nuevas (enviadas al Form real).

import { useMemo, useState } from 'react';
import { EstadoSolicitud, Solicitud } from '@/lib/types';
import { Aviso, BarraBusqueda, BotonRecargar, Chip, Modal, useDatos } from '@/components/ui';

const ESTADOS: EstadoSolicitud[] = ['Nueva', 'En Revisión', 'Aprobada', 'Rechazada', 'Atendida'];

export default function PaginaSolicitudes() {
  const { datos, cargando, error, recargar } = useDatos<{ solicitudes: Solicitud[]; esDemo: boolean }>('/api/solicitudes');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('');
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [flujoCorreo, setFlujoCorreo] = useState<{ solicitud: Solicitud; estadoNuevo: EstadoSolicitud } | null>(null);
  const [modalNueva, setModalNueva] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const solicitudes = datos?.solicitudes ?? [];
  const motivos = useMemo(() => Array.from(new Set(solicitudes.map((s) => s.motivo).filter(Boolean))), [solicitudes]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return solicitudes.filter((s) => {
      if (filtroEstado && s.estado !== filtroEstado) return false;
      if (filtroMotivo && s.motivo !== filtroMotivo) return false;
      if (!q) return true;
      return [s.nombre, s.correo, s.celular, s.motivo, s.descripcionPieza, s.programa, s.servicio]
        .some((c) => (c ?? '').toLowerCase().includes(q));
    });
  }, [solicitudes, busqueda, filtroEstado, filtroMotivo]);

  async function aplicarEstado(s: Solicitud, estado: EstadoSolicitud) {
    const res = await fetch('/api/solicitudes/estado', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, fila: s.fila, estado }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Error actualizando el estado');
  }

  /** Cambio de estado: aplica el cambio y luego pregunta si se notifica */
  async function onCambioEstado(s: Solicitud, estado: EstadoSolicitud) {
    if (estado === s.estado) return;
    try {
      await aplicarEstado(s, estado);
      setMensaje({ tipo: 'ok', texto: `Estado de ${s.nombre} actualizado a "${estado}".` });
      recargar();
      const notificar = window.confirm(
        `Estado actualizado a "${estado}".\n\n¿Desea enviar una notificación del cambio del estado de solicitud al solicitante?`,
      );
      if (notificar) setFlujoCorreo({ solicitud: s, estadoNuevo: estado });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes</h1>
          <p className="text-sm text-slate-500">Respuestas del Google Forms de solicitud de impresión y modelado 3D</p>
        </div>
        <div className="flex gap-2">
          <BotonRecargar onClick={recargar} cargando={cargando} />
          <button className="btn-primary" onClick={() => setModalNueva(true)}>+ Nueva solicitud</button>
        </div>
      </div>

      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
      {error && <Aviso tipo="error">Error: {error}</Aviso>}

      <div className="card">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <BarraBusqueda valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre, pieza, correo…" />
          <select className="input" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select className="input" value={filtroMotivo} onChange={(e) => setFiltroMotivo(e.target.value)}>
            <option value="">Todos los motivos</option>
            {motivos.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {cargando && !datos ? (
          <p className="py-8 text-center text-slate-500">Cargando solicitudes…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Marca temporal</th>
                  <th className="th">Solicitante</th>
                  <th className="th">Motivo</th>
                  <th className="th">Pieza a imprimir</th>
                  <th className="th">Fecha tentativa</th>
                  <th className="th">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.map((s) => (
                  <tr key={s.id} className="cursor-pointer transition hover:bg-steam-50" onClick={() => setDetalle(s)}>
                    <td className="td whitespace-nowrap text-xs text-slate-500">{s.marcaTemporal}</td>
                    <td className="td font-medium">{s.nombre}</td>
                    <td className="td">{s.motivo}</td>
                    <td className="td max-w-[280px] truncate" title={s.descripcionPieza}>{s.descripcionPieza}</td>
                    <td className="td whitespace-nowrap">{s.fechaTentativa}</td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <select
                        className="rounded-lg border border-slate-200 bg-transparent px-1 py-0.5 text-xs"
                        value={s.estado}
                        onChange={(e) => onCambioEstado(s, e.target.value as EstadoSolicitud)}
                      >
                        {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr><td colSpan={6} className="td py-8 text-center text-slate-500">No hay solicitudes que coincidan con los filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detalle de la solicitud */}
      <Modal abierto={!!detalle} onCerrar={() => setDetalle(null)} titulo="Detalle de la solicitud" ancho="max-w-3xl">
        {detalle && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Chip valor={detalle.estado} />
              <span className="text-xs text-slate-500">{detalle.marcaTemporal}</span>
            </div>
            <CampoDetalle etiqueta="Nombres y apellidos / grupo" valor={detalle.nombre} />
            <div className="grid grid-cols-2 gap-3">
              <CampoDetalle etiqueta="Correo electrónico" valor={detalle.correo || '—'} />
              <CampoDetalle etiqueta="Celular de contacto" valor={detalle.celular || '—'} />
              <CampoDetalle etiqueta="Rol" valor={detalle.rol} />
              <CampoDetalle etiqueta="Programa académico" valor={detalle.programa} />
              <CampoDetalle etiqueta="Motivo" valor={detalle.motivo} />
              <CampoDetalle etiqueta="Servicio solicitado" valor={detalle.servicio} />
            </div>
            <CampoDetalle etiqueta="Descripción de la pieza" valor={detalle.descripcionPieza} multilinea />
            <CampoDetalle etiqueta="Objetivo de la pieza" valor={detalle.objetivoPieza} multilinea />
            <CampoDetalle etiqueta="Archivos adjuntos" valor={detalle.archivos || '—'} />
            <CampoDetalle etiqueta="Fecha tentativa de entrega" valor={detalle.fechaTentativa} />
          </div>
        )}
      </Modal>

      {flujoCorreo && (
        <ModalCorreo
          solicitud={flujoCorreo.solicitud}
          estadoNuevo={flujoCorreo.estadoNuevo}
          onCerrar={() => setFlujoCorreo(null)}
          onResultado={(tipo, texto) => setMensaje({ tipo, texto })}
        />
      )}

      {modalNueva && (
        <ModalNuevaSolicitud
          onCerrar={() => setModalNueva(false)}
          onCreada={(texto) => { setMensaje({ tipo: 'ok', texto }); recargar(); }}
        />
      )}
    </div>
  );
}

function CampoDetalle({ etiqueta, valor, multilinea = false }: { etiqueta: string; valor: string; multilinea?: boolean }) {
  return (
    <div>
      <p className="label">{etiqueta}</p>
      <p className={`text-sm text-slate-700 ${multilinea ? 'whitespace-pre-line' : ''}`}>{valor || '—'}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de notificación por correo al cambiar el estado
// ---------------------------------------------------------------------------

function ModalCorreo({
  solicitud, estadoNuevo, onCerrar, onResultado,
}: {
  solicitud: Solicitud;
  estadoNuevo: EstadoSolicitud;
  onCerrar: () => void;
  onResultado: (tipo: 'ok' | 'error', texto: string) => void;
}) {
  const [comentarios, setComentarios] = useState('');
  const [firmaNombre, setFirmaNombre] = useState('');
  const [firmaRol, setFirmaRol] = useState('');
  const [vistaHtml, setVistaHtml] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const anio = new Date().getFullYear();

  const payload = {
    destinatario: solicitud.correo,
    nombreSolicitante: solicitud.nombre,
    pieza: solicitud.descripcionPieza.slice(0, 120),
    estadoNuevo,
    comentarios,
    firmaNombre,
    firmaRol,
  };

  async function verVistaPrevia() {
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, soloVista: true, firmaNombre: firmaNombre || 'Nombre', firmaRol: firmaRol || 'Rol' }),
    });
    const body = await res.json();
    if (res.ok) setVistaHtml(body.html);
  }

  async function enviar() {
    setEnviando(true);
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error enviando el correo');
      onResultado(body.demo ? 'error' : 'ok', body.mensaje);
      onCerrar();
    } catch (e) {
      onResultado('error', (e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Notificar cambio de estado → ${estadoNuevo}`} ancho="max-w-3xl">
      <div className="space-y-4">
        <Aviso tipo="info">
          Se enviará un correo a <b>{solicitud.correo || '(sin correo identificado)'}</b> con el mensaje generado
          automáticamente para el estado <b>{estadoNuevo}</b>, sus comentarios y la invitación al aula STEAM Sonny Jiménez M3 119-120.
        </Aviso>

        <div>
          <label className="label">Comentarios sobre el cambio de estado (se anexan al correo)</label>
          <textarea className="input min-h-[90px]" value={comentarios} onChange={(e) => setComentarios(e.target.value)}
            placeholder="Ej: La pieza supera el volumen de impresión; recomendamos dividirla en dos partes…" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Su nombre (para la firma)</label>
            <input className="input" value={firmaNombre} onChange={(e) => setFirmaNombre(e.target.value)} placeholder="Nombre de quien notifica" />
          </div>
          <div>
            <label className="label">Su rol</label>
            <input className="input" value={firmaRol} onChange={(e) => setFirmaRol(e.target.value)} placeholder="Ej: Monitor Aula STEAM" />
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <b>Firma que se añadirá:</b><br />
          {firmaNombre || '«Nombre usuario»'}<br />
          {firmaRol || '«Rol»'}<br />
          Aula STEAM Sonny Jiménez M3-119<br />
          Instituto de Educación en Ingeniería<br />
          Universidad Nacional de Colombia sede Medellín<br />
          {anio}
        </div>

        {vistaHtml && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">Vista previa del correo</p>
            <iframe srcDoc={vistaHtml} className="h-96 w-full" title="Vista previa del correo" />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={verVistaPrevia}>Vista previa</button>
          <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary" onClick={enviar} disabled={enviando || !firmaNombre.trim() || !firmaRol.trim() || !solicitud.correo}>
            {enviando ? 'Enviando…' : 'Enviar correo'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modal de creación de solicitudes (POST al Google Form real)
// ---------------------------------------------------------------------------

const MOTIVOS = ['Investigación', 'Asignaturas de proyectos en ingeniería', 'Proyecto académico', 'Curso académico', 'Proyecto personal'];
const SERVICIOS = ['Impresión 3D', 'Modelado 3D', 'Modelado 3D e Impresión 3D'];
const ROLES = ['Estudiante', 'Profesor(a)', 'Contratista', 'Administrativo', 'Egresado(a)'];

function ModalNuevaSolicitud({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: (texto: string) => void }) {
  const [f, setF] = useState({
    nombre: '', correo: '', celular: '', rol: ROLES[0], programa: '', motivo: MOTIVOS[0],
    servicio: SERVICIOS[0], descripcionPieza: '', objetivoPieza: '', fechaTentativa: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function crear() {
    setEnviando(true);
    setError('');
    try {
      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error creando la solicitud');
      onCreada(body.mensaje);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Nueva solicitud de impresión / modelado 3D" ancho="max-w-3xl">
      <div className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Nombres y apellidos / grupo *</label>
            <input className="input" value={f.nombre} onChange={set('nombre')} />
          </div>
          <div>
            <label className="label">Correo electrónico *</label>
            <input className="input" value={f.correo} onChange={set('correo')} placeholder="correo@unal.edu.co" />
          </div>
          <div>
            <label className="label">Número de celular de contacto</label>
            <input className="input" value={f.celular} onChange={set('celular')} placeholder="300 000 0000" />
          </div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={f.rol} onChange={set('rol')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
          </div>
          <div>
            <label className="label">Programa académico</label>
            <input className="input" value={f.programa} onChange={set('programa')} />
          </div>
          <div>
            <label className="label">Motivo de la solicitud</label>
            <select className="input" value={f.motivo} onChange={set('motivo')}>{MOTIVOS.map((m) => <option key={m}>{m}</option>)}</select>
          </div>
          <div>
            <label className="label">Servicio</label>
            <select className="input" value={f.servicio} onChange={set('servicio')}>{SERVICIOS.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Descripción de la pieza</label>
            <textarea className="input min-h-[70px]" value={f.descripcionPieza} onChange={set('descripcionPieza')} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Objetivo de la pieza</label>
            <textarea className="input min-h-[70px]" value={f.objetivoPieza} onChange={set('objetivoPieza')} />
          </div>
          <div>
            <label className="label">Fecha tentativa de entrega</label>
            <input type="date" className="input" value={f.fechaTentativa} onChange={set('fechaTentativa')} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary" onClick={crear} disabled={enviando || !f.nombre.trim() || !f.correo.trim()}>
            {enviando ? 'Enviando…' : 'Crear solicitud'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
