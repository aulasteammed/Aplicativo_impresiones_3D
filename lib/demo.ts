// Modo DEMO: almacén en memoria con datos de ejemplo (réplica de la estructura
// real de los Google Sheets). Se activa cuando faltan credenciales en .env.local.
// Permite explorar y probar todo el aplicativo sin configurar nada.

import {
  Solicitud, RegistroHistorial, Filamento, MovimientoInventario,
  Impresora, Mantenimiento, EstadoSolicitud, EstadoProyecto, ItemProyecto, UmbralAlerta,
} from './types';
import { extraerCorreo, hoyISO } from './util';

interface DemoStore {
  solicitudes: Solicitud[];
  historial: RegistroHistorial[];
  filamentos: Filamento[];
  movimientos: MovimientoInventario[];
  impresoras: Impresora[];
  mantenimientos: Mantenimiento[];
  umbrales: UmbralAlerta[];
}

function seed(): DemoStore {
  // Columnas: A marca · B nombre · C correo · D rol · E programa · F motivo ·
  // G servicio · H descripción · I objetivo · J fecha · K celular · L estado
  const solicitudesBase = [
    ['23/02/2026 10:30:51', 'Víctor Manuel Posada', 'vicmanuelph@gmail.com', 'Estudiante', 'Ingeniería Mecánica', 'Asignaturas de proyectos en ingeniería', 'Impresión 3D', 'Piñón', 'Transmitir potencia en banco de pruebas', '26/02/2026', '300 123 4567', 'Aprobada'],
    ['17/03/2026 10:45:09', 'Maria Camila Cantero Hernandez', 'mcanteroh@unal.edu.co', 'Estudiante', 'Ingeniería Civil', 'Investigación', 'Impresión 3D', 'Base de 22cm x 22cm con orificios para acople de agujas', 'Simulador de lluvias para tesis de maestría', '01/04/2026', '301 234 5678', 'Atendida'],
    ['28/04/2026 10:06:11', 'Jhorlan Daniel Ortega', 'jhortegad@unal.edu.co', 'Estudiante', 'Ingeniería de Sistemas e Informática', 'Asignaturas de proyectos en ingeniería', 'Impresión 3D', 'Módulo de jardín vertical (2 módulos + sistema de riego capilar)', 'Jardín vertical para fachadas — mitigar isla de calor urbana', '29/04/2026', '302 345 6789', 'Aprobada'],
    ['02/06/2026 09:15:00', 'Juan Pablo Gonzalez Ortiz', 'jpgonzalezo@unal.edu.co', 'Estudiante', 'Ingeniería Mecánica', 'Proyecto académico', 'Impresión 3D', 'Soporte en L con orificios de anclaje', 'Soporte para sensor en banco de pruebas', '15/06/2026', '311 456 7890', 'Aprobada'],
    ['08/06/2026 14:22:30', 'Laura Restrepo', 'lrestrepo@unal.edu.co', 'Profesor(a)', 'Ingeniería Química', 'Investigación', 'Modelado 3D e Impresión 3D', 'Carcasa para prototipo de sensor de pH', 'Protección de electrónica en ambiente húmedo', '20/06/2026', '312 567 8901', 'En Revisión'],
    ['10/06/2026 08:05:12', 'Simón Pedro Yarce Giraldo', 'syarce@unal.edu.co', 'Estudiante', 'Ingeniería Eléctrica', 'Proyecto personal', 'Impresión 3D', 'Cono con base de fijación', 'Pieza de señalización para dron', '18/06/2026', '313 678 9012', ''],
    ['10/06/2026 16:40:45', 'Toma Hack', 'vposada@unal.edu.co', 'Contratista', '', 'Curso académico', 'Modelado 3D', 'Hack', 'Material didáctico', '24/06/2026', '', ''],
  ];

  const solicitudes: Solicitud[] = solicitudesBase.map((s, i) => ({
    id: s[0],
    fila: i + 2,
    marcaTemporal: s[0],
    nombre: s[1],
    contacto: s[2],
    correo: extraerCorreo(s[2]),
    rol: s[3],
    programa: s[4],
    motivo: s[5],
    servicio: s[6],
    descripcionPieza: s[7],
    objetivoPieza: s[8],
    archivos: '',
    fechaTentativa: s[9],
    celular: s[10],
    estado: (s[11] || 'Nueva') as EstadoSolicitud,
  }));

  const historial: RegistroHistorial[] = [
    {
      fila: 2, marcaTemporal: '17/03/2026 10:45:09', codigo: 'IMP-260520-01',
      nombre: 'Maria Camila Cantero Hernandez', correo: 'mcanteroh@unal.edu.co',
      rol: 'Estudiante', programa: 'Ingeniería Civil', motivo: 'Investigación', servicio: 'Impresión 3D',
      descripcionPieza: 'Base de 22cm x 22cm con orificios para acople de agujas', objetivoPieza: 'Simulador de lluvias',
      fechaTentativa: '01/04/2026', impresora: 'Sonny', tiempoHoras: '3.73', gramos: '120.76', material: 'PETG',
      estado: 'Finalizada', resultado: 'Exitoso', desperdicio: '4', comentarios: 'Buena adhesión, sin warping',
      filamentoId: 'FIL-001',
    },
    {
      fila: 3, marcaTemporal: '28/04/2026 10:06:11', codigo: 'IMP-260601-01',
      nombre: 'Jhorlan Daniel Ortega', correo: 'jhortegad@unal.edu.co',
      rol: 'Estudiante', programa: 'Ingeniería de Sistemas e Informática', motivo: 'Asignaturas de proyectos en ingeniería',
      servicio: 'Impresión 3D', descripcionPieza: 'Módulo 1 jardín vertical', objetivoPieza: 'Jardín vertical para fachadas',
      fechaTentativa: '29/04/2026', impresora: 'Sonny', tiempoHoras: '3.18', gramos: '120.97', material: 'PETG',
      estado: 'Activa', resultado: '', desperdicio: '', comentarios: '',
      filamentoId: 'FIL-001',
    },
  ];

  const filamentos: Filamento[] = [
    { id: 'FIL-001', tipo: 'PETG', color: 'Amarillo', marca: 'Bambu', rollos: 1, comenzado: true, gramosRestantes: 480, umbralAlerta: 200, fechaRegistro: '2026-04-01', notas: 'Rollo del AMS ranura A4' },
    { id: 'FIL-002', tipo: 'PLA', color: 'Blanco', marca: 'Bambu', rollos: 2, comenzado: false, gramosRestantes: 2000, umbralAlerta: 300, fechaRegistro: '2026-05-12', notas: '' },
    { id: 'FIL-003', tipo: 'PLA', color: 'Negro', marca: 'eSun', rollos: 1, comenzado: true, gramosRestantes: 150, umbralAlerta: 200, fechaRegistro: '2026-03-20', notas: 'Queda poco — priorizar piezas pequeñas' },
    { id: 'FIL-004', tipo: 'TPU', color: 'Rojo', marca: 'Sunlu', rollos: 1, comenzado: false, gramosRestantes: 1000, umbralAlerta: 150, fechaRegistro: '2026-05-30', notas: '' },
  ];

  const impresoras: Impresora[] = [
    { id: 'IMP-01', nombre: 'Sonny', modelo: 'Bambu Lab X1 Carbon', estado: 'Operativa', horasAcumuladas: 132.5, notas: 'Plato PEI' },
  ];

  const movimientos: MovimientoInventario[] = [
    { fecha: '2026-05-20', filamentoId: 'FIL-001', proyectoCodigo: 'IMP-260520-01', gramos: -124.76, motivo: 'impresión' },
  ];

  const mantenimientos: Mantenimiento[] = [
    { fecha: '2026-05-02', impresoraId: 'IMP-01', tipo: 'preventivo', descripcion: 'Limpieza de extrusor y lubricación de rieles', responsable: 'Monitor Aula STEAM' },
  ];

  const umbrales: UmbralAlerta[] = [
    { id: 'UMB-001', variable: 'tipo', valor: 'PLA', umbralGramos: 200 },
  ];

  return { solicitudes, historial, filamentos, movimientos, impresoras, mantenimientos, umbrales };
}

// Persiste entre hot-reloads del dev server
const g = globalThis as unknown as { __demoStore?: DemoStore };
export function store(): DemoStore {
  if (!g.__demoStore) g.__demoStore = seed();
  return g.__demoStore;
}

// --- Operaciones equivalentes a lib/google/sheets.ts -----------------------

export async function getSolicitudes(): Promise<Solicitud[]> {
  return store().solicitudes;
}

export async function actualizarEstadoSolicitud(id: string, _fila: number, estado: EstadoSolicitud): Promise<void> {
  const s = store().solicitudes.find((x) => x.id === id);
  if (!s) throw new Error(`No se encontró la solicitud "${id}"`);
  s.estado = estado;
}

export async function crearSolicitudDemo(datos: Partial<Solicitud>): Promise<void> {
  const st = store();
  const ahora = new Date();
  const marca = `${String(ahora.getDate()).padStart(2, '0')}/${String(ahora.getMonth() + 1).padStart(2, '0')}/${ahora.getFullYear()} ${ahora.toTimeString().slice(0, 8)}`;
  st.solicitudes.push({
    id: marca,
    fila: st.solicitudes.length + 2,
    marcaTemporal: marca,
    nombre: datos.nombre ?? '',
    contacto: datos.correo ?? '',
    correo: extraerCorreo(datos.correo ?? ''),
    celular: datos.celular ?? '',
    rol: datos.rol ?? '',
    programa: datos.programa ?? '',
    motivo: datos.motivo ?? '',
    servicio: datos.servicio ?? '',
    descripcionPieza: datos.descripcionPieza ?? '',
    objetivoPieza: datos.objetivoPieza ?? '',
    archivos: '',
    fechaTentativa: datos.fechaTentativa ?? '',
    estado: 'Nueva',
  });
}

export async function getHistorial(): Promise<RegistroHistorial[]> {
  return store().historial;
}

export async function crearProyecto(
  codigo: string, impresora: string, items: ItemProyecto[], solicitudes: Solicitud[],
): Promise<string> {
  const st = store();
  const codigoLimpio = codigo.trim();
  const existe = st.historial.some((r) => (r.codigo ?? '').trim().toLowerCase() === codigoLimpio.toLowerCase());
  if (existe) throw new Error(`Ya existe una cama con el código "${codigoLimpio}". Use otro código.`);
  const porId = new Map(solicitudes.map((s) => [s.id, s]));
  for (const it of items) {
    const sol = porId.get(it.solicitudId);
    st.historial.push({
      fila: st.historial.length + 2,
      marcaTemporal: it.solicitudId,
      codigo: codigoLimpio,
      nombre: sol?.nombre ?? it.nombre,
      correo: sol?.correo ?? it.correo,
      rol: sol?.rol ?? '',
      programa: sol?.programa ?? '',
      motivo: sol?.motivo ?? '',
      servicio: sol?.servicio ?? '',
      descripcionPieza: sol?.descripcionPieza ?? it.descripcionPieza,
      objetivoPieza: sol?.objetivoPieza ?? '',
      fechaTentativa: sol?.fechaTentativa ?? '',
      impresora,
      tiempoHoras: String(it.tiempoHoras),
      gramos: String(it.gramos),
      material: it.material,
      estado: 'Activa',
      resultado: '',
      desperdicio: '',
      comentarios: '',
      filamentoId: it.filamentoId ?? '',
    });
  }
  return codigoLimpio;
}

export async function agregarItemsProyecto(
  codigo: string, items: ItemProyecto[], solicitudes: Solicitud[],
): Promise<void> {
  const st = store();
  const ref = st.historial.find((r) => r.codigo === codigo);
  if (!ref) throw new Error(`Cama ${codigo} no encontrada`);
  const porId = new Map(solicitudes.map((s) => [s.id, s]));
  for (const it of items) {
    const sol = porId.get(it.solicitudId);
    st.historial.push({
      ...ref,
      fila: st.historial.length + 2,
      marcaTemporal: it.solicitudId,
      nombre: sol?.nombre ?? it.nombre,
      correo: sol?.correo ?? it.correo,
      rol: sol?.rol ?? '',
      programa: sol?.programa ?? '',
      motivo: sol?.motivo ?? '',
      servicio: sol?.servicio ?? '',
      descripcionPieza: sol?.descripcionPieza ?? it.descripcionPieza,
      objetivoPieza: sol?.objetivoPieza ?? '',
      fechaTentativa: sol?.fechaTentativa ?? '',
      tiempoHoras: String(it.tiempoHoras),
      gramos: String(it.gramos),
      material: it.material,
      filamentoId: it.filamentoId ?? '',
    });
  }
}

export async function actualizarEstadoProyecto(codigo: string, estado: EstadoProyecto): Promise<void> {
  for (const r of store().historial) {
    if (r.codigo === codigo) r.estado = estado;
  }
}

export async function finalizarProyectoEnHistorial(
  codigo: string, resultado: string, desperdicio: number | '', comentarios: string,
): Promise<RegistroHistorial[]> {
  const filas = store().historial.filter((r) => r.codigo === codigo);
  if (filas.length === 0) throw new Error(`Cama ${codigo} no encontrada`);
  for (const r of filas) {
    r.estado = 'Finalizada';
    r.resultado = resultado;
    r.desperdicio = desperdicio === '' ? '' : String(desperdicio);
    r.comentarios = comentarios;
  }
  return filas;
}

export async function getFilamentos(): Promise<Filamento[]> {
  return store().filamentos;
}

export async function guardarFilamento(fil: Filamento, esNuevo: boolean): Promise<void> {
  const st = store();
  if (esNuevo) {
    st.filamentos.push(fil);
    return;
  }
  const idx = st.filamentos.findIndex((f) => f.id === fil.id);
  if (idx === -1) throw new Error(`Filamento ${fil.id} no encontrado`);
  st.filamentos[idx] = fil;
}

export async function eliminarFilamento(id: string): Promise<void> {
  const st = store();
  const idx = st.filamentos.findIndex((f) => f.id === id);
  if (idx === -1) throw new Error(`Filamento ${id} no encontrado`);
  st.filamentos.splice(idx, 1);
}

export async function getMovimientos(): Promise<MovimientoInventario[]> {
  return [...store().movimientos].reverse();
}

export async function registrarMovimiento(mov: MovimientoInventario): Promise<void> {
  store().movimientos.push(mov);
}

export async function getImpresoras(): Promise<Impresora[]> {
  return store().impresoras;
}

export async function guardarImpresora(imp: Impresora, esNueva: boolean): Promise<void> {
  const st = store();
  if (esNueva) {
    st.impresoras.push(imp);
    return;
  }
  const idx = st.impresoras.findIndex((i) => i.id === imp.id);
  if (idx === -1) throw new Error(`Impresora ${imp.id} no encontrada`);
  st.impresoras[idx] = imp;
}

export async function getMantenimientos(): Promise<Mantenimiento[]> {
  return [...store().mantenimientos].reverse();
}

export async function registrarMantenimiento(m: Mantenimiento): Promise<void> {
  store().mantenimientos.push(m);
}

export async function getUmbrales(): Promise<UmbralAlerta[]> {
  return store().umbrales;
}

export async function crearUmbral(u: UmbralAlerta): Promise<void> {
  store().umbrales.push(u);
}

export async function actualizarUmbral(u: UmbralAlerta): Promise<void> {
  const st = store();
  const idx = st.umbrales.findIndex((x) => x.id === u.id);
  if (idx === -1) throw new Error(`Umbral ${u.id} no encontrado`);
  st.umbrales[idx] = u;
}

export async function eliminarUmbral(id: string): Promise<void> {
  const st = store();
  const idx = st.umbrales.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error(`Umbral ${id} no encontrado`);
  st.umbrales.splice(idx, 1);
}
