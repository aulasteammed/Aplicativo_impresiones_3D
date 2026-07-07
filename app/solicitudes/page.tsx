'use client';

// Ventana 2 — Gestión de solicitudes: tabla conectada a la hoja de respuestas
// del Google Forms, con detalle, cambio de estado + notificación por correo,
// y creación de solicitudes nuevas (enviadas al Form real).

import { useEffect, useMemo, useState } from 'react';
import { EstadoSolicitud, Solicitud } from '@/lib/types';
import { AccionesFila, Aviso, BarraBusqueda, BotonRecargar, Chip, Modal, ModalConfirmar, ModalConfirmarCambios, Paginacion, diffCampos, useDatos } from '@/components/ui';

const ESTADOS: EstadoSolicitud[] = ['Nueva', 'En Revisión', 'Aprobada', 'Rechazada', 'Atendida'];

// Color de fondo representativo por estado (para el selector de estado de cada fila).
const COLOR_ESTADO: Record<string, string> = {
  'Nueva': 'bg-blue-100 text-blue-800 border-blue-300',
  'En Revisión': 'bg-amber-100 text-amber-800 border-amber-300',
  'Aprobada': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Rechazada': 'bg-rose-100 text-rose-800 border-rose-300',
  'Atendida': 'bg-slate-200 text-slate-700 border-slate-300',
};

export default function PaginaSolicitudes() {
  const { datos, cargando, error, recargar } = useDatos<{ solicitudes: Solicitud[]; esDemo: boolean }>('/api/solicitudes');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('');
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [flujoCorreo, setFlujoCorreo] = useState<{ solicitud: Solicitud; estadoNuevo: EstadoSolicitud } | null>(null);
  const [confirmarNotif, setConfirmarNotif] = useState<{ solicitud: Solicitud; estadoNuevo: EstadoSolicitud } | null>(null);
  const [modalNueva, setModalNueva] = useState(false);
  const [editarSol, setEditarSol] = useState<Solicitud | null>(null);
  const [porEliminar, setPorEliminar] = useState<Solicitud | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const solicitudes = datos?.solicitudes ?? [];
  const motivos = useMemo(() => Array.from(new Set(solicitudes.map((s) => s.motivo).filter(Boolean))), [solicitudes]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = solicitudes.filter((s) => {
      if (filtroEstado && s.estado !== filtroEstado) return false;
      if (filtroMotivo && s.motivo !== filtroMotivo) return false;
      if (!q) return true;
      return [s.nombre, s.correo, s.celular, s.motivo, s.descripcionPieza, s.programa, s.servicio]
        .some((c) => (c ?? '').toLowerCase().includes(q));
    });
    // Orden inicial por estado (Nueva → En Revisión → Aprobada → Rechazada → Atendida)
    // SOLO cuando no hay búsqueda ni filtros; con cualquier criterio activo se
    // mantiene el orden natural (más recientes primero) y no prevalece este orden.
    if (!q && !filtroEstado && !filtroMotivo) {
      return [...base].sort((a, b) => ESTADOS.indexOf(a.estado) - ESTADOS.indexOf(b.estado));
    }
    return base;
  }, [solicitudes, busqueda, filtroEstado, filtroMotivo]);

  // Paginación
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(20);
  useEffect(() => { setPagina(1); }, [busqueda, filtroEstado, filtroMotivo, tamano]);
  const paginaActual = Math.min(pagina, Math.max(1, Math.ceil(filtradas.length / tamano)));
  const paginadas = filtradas.slice((paginaActual - 1) * tamano, paginaActual * tamano);

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
      setConfirmarNotif({ solicitud: s, estadoNuevo: estado });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    }
  }

  async function hacerEliminar(s: Solicitud) {
    setEliminando(true);
    try {
      const res = await fetch(`/api/solicitudes?id=${encodeURIComponent(s.id)}&fila=${s.fila}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error eliminando la solicitud');
      setMensaje({ tipo: 'ok', texto: `Solicitud de ${s.nombre} eliminada.` });
      setPorEliminar(null);
      recargar();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message });
    } finally { setEliminando(false); }
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
                  <th className="th text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginadas.map((s) => (
                  <tr key={s.id} className="cursor-pointer transition hover:bg-steam-50" onClick={() => setDetalle(s)}>
                    <td className="td whitespace-nowrap text-xs text-slate-500">{s.marcaTemporal}</td>
                    <td className="td font-medium">{s.nombre}</td>
                    <td className="td">{s.motivo}</td>
                    <td className="td max-w-[280px] truncate" title={s.descripcionPieza}>{s.descripcionPieza}</td>
                    <td className="td whitespace-nowrap">{s.fechaTentativa}</td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`cursor-pointer rounded-lg border px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[s.estado] ?? 'bg-slate-100 text-slate-700 border-slate-300'}`}
                        value={s.estado}
                        onChange={(e) => onCambioEstado(s, e.target.value as EstadoSolicitud)}
                      >
                        {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <AccionesFila onEditar={() => setEditarSol(s)} onEliminar={() => setPorEliminar(s)} />
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr><td colSpan={7} className="td py-8 text-center text-slate-500">No hay solicitudes que coincidan con los filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {(!cargando || datos) && <Paginacion total={filtradas.length} pagina={paginaActual} tamano={tamano} onPagina={setPagina} onTamano={setTamano} />}
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

      {confirmarNotif && (
        <ModalConfirmar
          abierto
          titulo="Notificar al solicitante"
          icono="✉️"
          confirmarTexto="Sí, enviar correo"
          cancelarTexto="No, gracias"
          onCancelar={() => setConfirmarNotif(null)}
          onConfirmar={() => { setFlujoCorreo(confirmarNotif); setConfirmarNotif(null); }}
        >
          <p>
            El estado de <strong className="font-semibold text-slate-800">{confirmarNotif.solicitud.nombre}</strong> se actualizó a{' '}
            <Chip valor={confirmarNotif.estadoNuevo} />.
          </p>
          <p className="mt-3">¿Deseas enviar una notificación por correo del cambio de estado al solicitante?</p>
        </ModalConfirmar>
      )}

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

      {editarSol && (
        <ModalNuevaSolicitud
          editar={editarSol}
          onCerrar={() => setEditarSol(null)}
          onCreada={(texto) => { setMensaje({ tipo: 'ok', texto }); recargar(); }}
        />
      )}

      {porEliminar && (
        <ModalConfirmar
          abierto titulo="Eliminar solicitud" icono="🗑️" tono="danger"
          confirmarTexto="Eliminar" cancelarTexto="Cancelar" procesando={eliminando}
          onCancelar={() => setPorEliminar(null)}
          onConfirmar={() => hacerEliminar(porEliminar)}
        >
          ¿Eliminar la solicitud de <b>{porEliminar.nombre}</b> ({porEliminar.marcaTemporal})? Se borrará de la hoja de respuestas. Esta acción no se puede deshacer.
        </ModalConfirmar>
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
  const [destinatario, setDestinatario] = useState(solicitud.correo);
  const [comentarios, setComentarios] = useState('');
  const [firmaNombre, setFirmaNombre] = useState('');
  const [firmaRol, setFirmaRol] = useState('');
  const [vistaHtml, setVistaHtml] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const anio = new Date().getFullYear();

  // Uno o varios correos separados por coma (o ;); se normalizan a coma para Gmail.
  const correos = destinatario.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const correosValidos = correos.length > 0 && correos.every((c) => /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(c));

  const payload = {
    destinatario: correos.join(','),
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
          El mensaje se genera automáticamente para el estado <b>{estadoNuevo}</b>, con sus comentarios y la
          invitación al aula STEAM Sonny Jiménez M3 119-120. Revise el/los destinatario(s) antes de enviar.
        </Aviso>

        <div>
          <label className="label">Destinatario(s) *</label>
          <input
            className={`input ${destinatario.trim() && !correosValidos ? '!border-red-400 !ring-red-200' : ''}`}
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
            placeholder="correo@unal.edu.co, otro@correo.com"
          />
          <p className="mt-1 text-xs text-slate-500">
            Prellenado con el correo de la solicitud (columna C). Puede editarlo o añadir varios separados por comas.
            {destinatario.trim() && !correosValidos && <span className="text-red-600"> Hay un correo con formato inválido.</span>}
          </p>
        </div>

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
          <button className="btn-primary" onClick={enviar} disabled={enviando || !firmaNombre.trim() || !firmaRol.trim() || !correosValidos}>
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
const PROGRAMAS = [
  'Arquitectura', 'Artes plásticas', 'Construcción', 'Matemáticas', 'Estadística',
  'Ingeniería biológica', 'Ingeniería física', 'Ciencias de la computación',
  'Ingeniería agrícola', 'Ingeniería agronómica', 'Ingeniería forestal', 'Zootecnia',
  'Ciencias políticas', 'Historia', 'Economía', 'Ingeniería Civil', 'Ingeniería Administrativa',
  'Ingeniería Ambiental', 'Ingeniería de petróleos', 'Ingeniería Mecánica', 'Ingeniería Eléctrica',
  'Ingeniería de Control', 'Ingeniería Geológica', 'Ingeniería Química', 'Ingeniería Industrial',
  'Ingeniería de Minas y Metalurgia', 'Ingeniería de Sistemas e Informática',
];

function ModalNuevaSolicitud({ editar, onCerrar, onCreada }: { editar?: Solicitud | null; onCerrar: () => void; onCreada: (texto: string) => void }) {
  const esEdicion = !!editar;
  const [f, setF] = useState(() => (editar ? {
    nombre: editar.nombre, correo: editar.correo, celular: editar.celular,
    rol: editar.rol || ROLES[0], programa: editar.programa, motivo: editar.motivo || MOTIVOS[0],
    servicio: editar.servicio || SERVICIOS[0], descripcionPieza: editar.descripcionPieza,
    objetivoPieza: editar.objetivoPieza, fechaTentativa: editar.fechaTentativa,
  } : {
    nombre: '', correo: '', celular: '', rol: ROLES[0], programa: '', motivo: MOTIVOS[0],
    servicio: SERVICIOS[0], descripcionPieza: '', objetivoPieza: '', fechaTentativa: '',
  }));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState<{ campo: string; de: string; a: string }[] | null>(null);
  // En edición, mantiene seleccionable el valor actual aunque no esté en la lista.
  const conActual = (lista: string[], actual: string) => (actual && !lista.includes(actual) ? [actual, ...lista] : lista);

  const cambios = () => diffCampos([
    { campo: 'Nombre', de: editar?.nombre, a: f.nombre },
    { campo: 'Correo', de: editar?.correo, a: f.correo },
    { campo: 'Celular', de: editar?.celular, a: f.celular },
    { campo: 'Rol', de: editar?.rol, a: f.rol },
    { campo: 'Programa', de: editar?.programa, a: f.programa },
    { campo: 'Motivo', de: editar?.motivo, a: f.motivo },
    { campo: 'Servicio', de: editar?.servicio, a: f.servicio },
    { campo: 'Descripción de la pieza', de: editar?.descripcionPieza, a: f.descripcionPieza },
    { campo: 'Objetivo de la pieza', de: editar?.objetivoPieza, a: f.objetivoPieza },
    { campo: 'Fecha tentativa', de: editar?.fechaTentativa, a: f.fechaTentativa },
  ]);

  async function guardarEdicion() {
    setEnviando(true);
    setError('');
    try {
      const sol = { ...editar!, ...f, contacto: f.correo };
      const res = await fetch('/api/solicitudes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sol) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error guardando');
      onCreada(`Solicitud de ${f.nombre} actualizada.`);
      onCerrar();
    } catch (e) {
      setResumen(null);
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  // El programa académico solo aplica a estudiantes y egresados
  const programaHabilitado = f.rol === 'Estudiante' || f.rol === 'Egresado(a)';

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

  if (resumen) {
    return (
      <ModalConfirmarCambios
        abierto titulo={`Confirmar cambios · ${editar!.nombre}`} cambios={resumen} guardando={enviando}
        onVolver={() => setResumen(null)} onConfirmar={guardarEdicion}
      />
    );
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={esEdicion ? 'Editar solicitud' : 'Nueva solicitud de impresión / modelado 3D'} ancho="max-w-3xl">
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
            <select
              className="input"
              value={f.rol}
              onChange={(e) => {
                const rol = e.target.value;
                const habilita = rol === 'Estudiante' || rol === 'Egresado(a)';
                setF({ ...f, rol, programa: habilita ? f.programa : '' });
              }}
            >
              {conActual(ROLES, f.rol).map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Programa académico</label>
            <select
              className="input disabled:cursor-not-allowed disabled:opacity-60"
              value={f.programa}
              onChange={set('programa')}
              disabled={!programaHabilitado}
            >
              <option value="">{programaHabilitado ? 'Seleccione el programa…' : 'Solo aplica a Estudiante o Egresado(a)'}</option>
              {conActual(PROGRAMAS, f.programa).map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Motivo de la solicitud</label>
            <select className="input" value={f.motivo} onChange={set('motivo')}>{conActual(MOTIVOS, f.motivo).map((m) => <option key={m}>{m}</option>)}</select>
          </div>
          <div>
            <label className="label">Servicio</label>
            <select className="input" value={f.servicio} onChange={set('servicio')}>{conActual(SERVICIOS, f.servicio).map((s) => <option key={s}>{s}</option>)}</select>
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
          <button className="btn-primary" onClick={esEdicion ? () => setResumen(cambios()) : crear} disabled={enviando || !f.nombre.trim() || !f.correo.trim()}>
            {enviando ? 'Guardando…' : esEdicion ? 'Revisar cambios' : 'Crear solicitud'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
