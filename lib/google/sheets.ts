// Cliente de Google Sheets (service account) + acceso a las tres hojas.
// Solo se usa cuando la app NO está en modo demo.

import { google, sheets_v4 } from 'googleapis';
import { config } from '../config';
import {
  Solicitud, RegistroHistorial, Proyecto, ItemProyecto, EstadoSolicitud,
  Filamento, MovimientoInventario, Impresora, Mantenimiento, EstadoProyecto, UmbralAlerta,
} from '../types';
import { normalizarEstado, extraerCorreo, num } from '../util';

let _sheets: sheets_v4.Sheets | null = null;

function cliente(): sheets_v4.Sheets {
  if (_sheets) return _sheets;
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  let auth;
  if (config.serviceAccountJson) {
    const credentials = JSON.parse(config.serviceAccountJson);
    auth = new google.auth.GoogleAuth({ credentials, scopes });
  } else {
    // usa GOOGLE_APPLICATION_CREDENTIALS (ruta a archivo JSON)
    auth = new google.auth.GoogleAuth({ scopes });
  }
  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

async function leerRango(spreadsheetId: string, range: string): Promise<string[][]> {
  const res = await cliente().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return (res.data.values ?? []) as string[][];
}

async function escribirRango(spreadsheetId: string, range: string, values: (string | number)[][]) {
  await cliente().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

async function anexarFilas(spreadsheetId: string, range: string, values: (string | number)[][]) {
  await cliente().spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

// ---------------------------------------------------------------------------
// SOLICITUDES (hoja de respuestas del Form) — columnas A..M
//   A marca temporal · B nombre · C correo · D rol · E programa · F motivo ·
//   G servicio · H descripción · I objetivo · J archivos · K fecha tentativa ·
//   L celular (pregunta nueva) · M estado (gestionado por la app)
// ---------------------------------------------------------------------------

export async function getSolicitudes(): Promise<Solicitud[]> {
  const filas = await leerRango(config.sheetSolicitudesId, `'${config.tabSolicitudes}'!A2:M`);
  return filas
    .map((f, i) => filaASolicitud(f, i + 2))
    .filter((s) => !!s.marcaTemporal);
}

function filaASolicitud(f: string[], fila: number): Solicitud {
  const correoCol = f[2] ?? ''; // C: ahora se pide exclusivamente el correo
  return {
    id: f[0] ?? '',
    fila,
    marcaTemporal: f[0] ?? '',
    nombre: f[1] ?? '',
    contacto: correoCol,
    correo: extraerCorreo(correoCol),
    rol: f[3] ?? '',
    programa: f[4] ?? '',
    motivo: f[5] ?? '',
    servicio: f[6] ?? '',
    descripcionPieza: f[7] ?? '',
    objetivoPieza: f[8] ?? '',
    archivos: f[9] ?? '',
    fechaTentativa: f[10] ?? '',
    celular: f[11] ?? '',            // L: "Número de celular de contacto"
    estado: normalizarEstado(f[12]), // M: estado de la solicitud
  };
}

/** Actualiza la columna M (estado) verificando que la fila siga correspondiendo
 *  a la marca temporal; si la fila se movió, la vuelve a buscar. */
export async function actualizarEstadoSolicitud(id: string, fila: number, estado: EstadoSolicitud): Promise<void> {
  const tab = config.tabSolicitudes;
  const verif = await leerRango(config.sheetSolicitudesId, `'${tab}'!A${fila}:A${fila}`);
  let filaReal = fila;
  if ((verif[0]?.[0] ?? '') !== id) {
    const todas = await leerRango(config.sheetSolicitudesId, `'${tab}'!A2:A`);
    const idx = todas.findIndex((r) => (r[0] ?? '') === id);
    if (idx === -1) throw new Error(`No se encontró la solicitud con marca temporal "${id}"`);
    filaReal = idx + 2;
  }
  await escribirRango(config.sheetSolicitudesId, `'${tab}'!M${filaReal}`, [[estado]]);
}

// ---------------------------------------------------------------------------
// HISTORIAL — columnas A..S existentes + T (Nombre proyecto) + U (Filamento ID)
// ---------------------------------------------------------------------------

const HIST_RANGO = (tab: string) => `'${tab}'!A2:U`;

export async function getHistorial(): Promise<RegistroHistorial[]> {
  const filas = await leerRango(config.sheetHistorialId, HIST_RANGO(config.tabHistorial));
  return filas
    .map((f, i) => filaAHistorial(f, i + 2))
    .filter((r) => !!r.marcaTemporal || !!r.codigo);
}

function filaAHistorial(f: string[], fila: number): RegistroHistorial {
  return {
    fila,
    marcaTemporal: f[0] ?? '',
    codigo: f[1] ?? '',
    nombre: f[2] ?? '',
    correo: f[3] ?? '',
    rol: f[4] ?? '',
    programa: f[5] ?? '',
    motivo: f[6] ?? '',
    servicio: f[7] ?? '',
    descripcionPieza: f[8] ?? '',
    objetivoPieza: f[9] ?? '',
    fechaTentativa: f[10] ?? '',
    impresora: f[11] ?? '',
    tiempoHoras: f[12] ?? '',
    gramos: f[13] ?? '',
    material: f[14] ?? '',
    estado: f[15] ?? '',
    resultado: f[16] ?? '',
    desperdicio: f[17] ?? '',
    comentarios: f[18] ?? '',
    nombreProyecto: f[19] ?? '',
    filamentoId: f[20] ?? '',
  };
}

/** Agrupa las filas del historial con código en proyectos */
export function agruparProyectos(registros: RegistroHistorial[]): Proyecto[] {
  const mapa = new Map<string, Proyecto>();
  for (const r of registros) {
    if (!r.codigo) continue; // filas legadas sin código no forman proyecto
    let p = mapa.get(r.codigo);
    if (!p) {
      p = {
        codigo: r.codigo,
        nombre: r.nombreProyecto || r.codigo,
        impresora: r.impresora,
        estado: (r.estado || 'Activa') as EstadoProyecto,
        resultado: (r.resultado as Proyecto['resultado']) || '',
        desperdicio: num(r.desperdicio),
        comentarios: r.comentarios,
        items: [],
      };
      mapa.set(r.codigo, p);
    }
    p.items.push({
      solicitudId: r.marcaTemporal,
      nombre: r.nombre,
      correo: r.correo,
      descripcionPieza: r.descripcionPieza,
      tiempoHoras: num(r.tiempoHoras),
      gramos: num(r.gramos),
      material: r.material,
      filamentoId: r.filamentoId || undefined,
    });
  }
  return Array.from(mapa.values()).reverse(); // más recientes primero
}

export async function getProyectos(): Promise<Proyecto[]> {
  return agruparProyectos(await getHistorial());
}

/** Garantiza los encabezados de las columnas extra T y U */
async function asegurarColumnasExtra(): Promise<void> {
  const tab = config.tabHistorial;
  const fila1 = await leerRango(config.sheetHistorialId, `'${tab}'!T1:U1`);
  const t = fila1[0]?.[0] ?? '';
  const u = fila1[0]?.[1] ?? '';
  if (t !== 'Nombre del proyecto' || u !== 'Filamento ID') {
    await escribirRango(config.sheetHistorialId, `'${tab}'!T1:U1`, [['Nombre del proyecto', 'Filamento ID']]);
  }
}

function itemAFilaHistorial(
  codigo: string, nombreProyecto: string, impresora: string, estado: string,
  item: ItemProyecto, solicitud: Solicitud | undefined,
): (string | number)[] {
  return [
    item.solicitudId,                       // A marca temporal (de la solicitud)
    codigo,                                 // B código de proyecto
    solicitud?.nombre ?? item.nombre,       // C
    solicitud?.correo ?? item.correo,       // D
    solicitud?.rol ?? '',                   // E
    solicitud?.programa ?? '',              // F
    solicitud?.motivo ?? '',                // G
    solicitud?.servicio ?? '',              // H
    solicitud?.descripcionPieza ?? item.descripcionPieza, // I
    solicitud?.objetivoPieza ?? '',         // J
    solicitud?.fechaTentativa ?? '',        // K
    impresora,                              // L
    item.tiempoHoras,                       // M
    item.gramos,                            // N
    item.material,                          // O
    estado,                                 // P estado del proyecto
    '',                                     // Q resultado
    '',                                     // R desperdicio
    '',                                     // S comentarios
    nombreProyecto,                         // T
    item.filamentoId ?? '',                 // U
  ];
}

export async function crearProyecto(
  codigo: string, impresora: string, items: ItemProyecto[], solicitudes: Solicitud[],
): Promise<string> {
  await asegurarColumnasExtra();
  const registros = await getHistorial();
  const codigoLimpio = codigo.trim();
  const existentes = new Set(registros.map((r) => (r.codigo ?? '').trim().toLowerCase()).filter(Boolean));
  if (existentes.has(codigoLimpio.toLowerCase())) {
    throw new Error(`Ya existe una cama con el código "${codigoLimpio}". Use otro código.`);
  }
  const porId = new Map(solicitudes.map((s) => [s.id, s]));
  // El código es también el nombre/identificador visible de la cama (columna T).
  const filas = items.map((it) => itemAFilaHistorial(codigoLimpio, codigoLimpio, impresora, 'Activa', it, porId.get(it.solicitudId)));
  await anexarFilas(config.sheetHistorialId, `'${config.tabHistorial}'!A1`, filas);
  return codigoLimpio;
}

export async function agregarItemsProyecto(
  codigo: string, items: ItemProyecto[], solicitudes: Solicitud[],
): Promise<void> {
  await asegurarColumnasExtra();
  const registros = await getHistorial();
  const existentes = registros.filter((r) => r.codigo === codigo);
  if (existentes.length === 0) throw new Error(`Cama ${codigo} no encontrada`);
  const ref = existentes[0];
  const porId = new Map(solicitudes.map((s) => [s.id, s]));
  const filas = items.map((it) =>
    itemAFilaHistorial(codigo, ref.nombreProyecto || codigo, ref.impresora, ref.estado || 'Activa', it, porId.get(it.solicitudId)),
  );
  await anexarFilas(config.sheetHistorialId, `'${config.tabHistorial}'!A1`, filas);
}

export async function actualizarEstadoProyecto(codigo: string, estado: EstadoProyecto): Promise<void> {
  const registros = await getHistorial();
  const filas = registros.filter((r) => r.codigo === codigo);
  if (filas.length === 0) throw new Error(`Cama ${codigo} no encontrada`);
  for (const r of filas) {
    await escribirRango(config.sheetHistorialId, `'${config.tabHistorial}'!P${r.fila}`, [[estado]]);
  }
}

export async function finalizarProyectoEnHistorial(
  codigo: string, resultado: string, desperdicio: number | '', comentarios: string,
): Promise<RegistroHistorial[]> {
  const registros = await getHistorial();
  const filas = registros.filter((r) => r.codigo === codigo);
  if (filas.length === 0) throw new Error(`Cama ${codigo} no encontrada`);
  for (const r of filas) {
    await escribirRango(
      config.sheetHistorialId,
      `'${config.tabHistorial}'!P${r.fila}:S${r.fila}`,
      [['Finalizada', resultado, desperdicio === '' ? '' : desperdicio, comentarios]],
    );
  }
  return filas;
}

// ---------------------------------------------------------------------------
// INVENTARIO — spreadsheet propio con 4 pestañas (se crean si no existen)
// ---------------------------------------------------------------------------

const TABS_INVENTARIO: Record<string, string[]> = {
  Filamentos: ['ID', 'Tipo', 'Color', 'Marca', 'Rollos', 'Comenzado', 'Gramos restantes', 'Umbral alerta (g)', 'Fecha registro', 'Notas'],
  Movimientos: ['Fecha', 'Filamento ID', 'Proyecto', 'Gramos', 'Motivo'],
  Impresoras: ['ID', 'Nombre', 'Modelo', 'Estado', 'Horas acumuladas', 'Notas'],
  Mantenimiento: ['Fecha', 'Impresora ID', 'Tipo', 'Descripción', 'Costo', 'Responsable'],
  Umbrales: ['ID', 'Variable', 'Valor', 'Umbral (g)'],
};

let inventarioInicializado = false;

export async function asegurarInventario(): Promise<void> {
  if (inventarioInicializado) return;
  const meta = await cliente().spreadsheets.get({ spreadsheetId: config.sheetInventarioId });
  const existentes = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ''));
  const requests: sheets_v4.Schema$Request[] = [];
  for (const tab of Object.keys(TABS_INVENTARIO)) {
    if (!existentes.has(tab)) requests.push({ addSheet: { properties: { title: tab } } });
  }
  if (requests.length > 0) {
    await cliente().spreadsheets.batchUpdate({
      spreadsheetId: config.sheetInventarioId,
      requestBody: { requests },
    });
  }
  for (const [tab, headers] of Object.entries(TABS_INVENTARIO)) {
    const fila1 = await leerRango(config.sheetInventarioId, `'${tab}'!A1:Z1`);
    if (!fila1[0] || fila1[0][0] !== headers[0]) {
      await escribirRango(config.sheetInventarioId, `'${tab}'!A1`, [headers]);
    }
  }
  // Seed: impresora Sonny si la pestaña quedó vacía
  const imps = await leerRango(config.sheetInventarioId, `'Impresoras'!A2:F`);
  if (imps.length === 0) {
    await anexarFilas(config.sheetInventarioId, `'Impresoras'!A1`, [
      ['IMP-01', 'Sonny', 'Bambu Lab X1 Carbon', 'Operativa', 0, ''],
    ]);
  }
  inventarioInicializado = true;
}

export async function getFilamentos(): Promise<Filamento[]> {
  await asegurarInventario();
  const filas = await leerRango(config.sheetInventarioId, `'Filamentos'!A2:J`);
  return filas.filter((f) => f[0]).map((f) => ({
    id: f[0],
    tipo: f[1] ?? '',
    color: f[2] ?? '',
    marca: f[3] ?? '',
    rollos: num(f[4]),
    comenzado: (f[5] ?? '').toLowerCase().startsWith('s'),
    gramosRestantes: num(f[6]),
    umbralAlerta: num(f[7]),
    fechaRegistro: f[8] ?? '',
    notas: f[9] ?? '',
  }));
}

export async function guardarFilamento(fil: Filamento, esNuevo: boolean): Promise<void> {
  await asegurarInventario();
  const valores = [
    fil.id, fil.tipo, fil.color, fil.marca, fil.rollos,
    fil.comenzado ? 'Sí' : 'No', fil.gramosRestantes, fil.umbralAlerta, fil.fechaRegistro, fil.notas,
  ];
  if (esNuevo) {
    await anexarFilas(config.sheetInventarioId, `'Filamentos'!A1`, [valores]);
    return;
  }
  const filas = await leerRango(config.sheetInventarioId, `'Filamentos'!A2:A`);
  const idx = filas.findIndex((f) => f[0] === fil.id);
  if (idx === -1) throw new Error(`Filamento ${fil.id} no encontrado`);
  await escribirRango(config.sheetInventarioId, `'Filamentos'!A${idx + 2}:J${idx + 2}`, [valores]);
}

export async function eliminarFilamento(id: string): Promise<void> {
  await asegurarInventario();
  const filas = await leerRango(config.sheetInventarioId, `'Filamentos'!A2:A`);
  const idx = filas.findIndex((f) => f[0] === id);
  if (idx === -1) throw new Error(`Filamento ${id} no encontrado`);
  const sheetId = await sheetIdPorTitulo('Filamentos');
  await cliente().spreadsheets.batchUpdate({
    spreadsheetId: config.sheetInventarioId,
    requestBody: {
      requests: [{
        deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } },
      }],
    },
  });
}

export async function getMovimientos(): Promise<MovimientoInventario[]> {
  await asegurarInventario();
  const filas = await leerRango(config.sheetInventarioId, `'Movimientos'!A2:E`);
  return filas.filter((f) => f[0]).map((f) => ({
    fecha: f[0], filamentoId: f[1] ?? '', proyectoCodigo: f[2] ?? '', gramos: num(f[3]), motivo: f[4] ?? '',
  })).reverse();
}

export async function registrarMovimiento(mov: MovimientoInventario): Promise<void> {
  await asegurarInventario();
  await anexarFilas(config.sheetInventarioId, `'Movimientos'!A1`, [
    [mov.fecha, mov.filamentoId, mov.proyectoCodigo, mov.gramos, mov.motivo],
  ]);
}

export async function getImpresoras(): Promise<Impresora[]> {
  await asegurarInventario();
  const filas = await leerRango(config.sheetInventarioId, `'Impresoras'!A2:F`);
  return filas.filter((f) => f[0]).map((f) => ({
    id: f[0], nombre: f[1] ?? '', modelo: f[2] ?? '', estado: f[3] ?? 'Operativa',
    horasAcumuladas: num(f[4]), notas: f[5] ?? '',
  }));
}

export async function guardarImpresora(imp: Impresora, esNueva: boolean): Promise<void> {
  await asegurarInventario();
  const valores = [imp.id, imp.nombre, imp.modelo, imp.estado, imp.horasAcumuladas, imp.notas];
  if (esNueva) {
    await anexarFilas(config.sheetInventarioId, `'Impresoras'!A1`, [valores]);
    return;
  }
  const filas = await leerRango(config.sheetInventarioId, `'Impresoras'!A2:A`);
  const idx = filas.findIndex((f) => f[0] === imp.id);
  if (idx === -1) throw new Error(`Impresora ${imp.id} no encontrada`);
  await escribirRango(config.sheetInventarioId, `'Impresoras'!A${idx + 2}:F${idx + 2}`, [valores]);
}

export async function getMantenimientos(): Promise<Mantenimiento[]> {
  await asegurarInventario();
  const filas = await leerRango(config.sheetInventarioId, `'Mantenimiento'!A2:F`);
  return filas.filter((f) => f[0]).map((f) => ({
    fecha: f[0], impresoraId: f[1] ?? '', tipo: f[2] ?? '', descripcion: f[3] ?? '',
    costo: f[4] ? num(f[4]) : undefined, responsable: f[5] ?? '',
  })).reverse();
}

export async function registrarMantenimiento(m: Mantenimiento): Promise<void> {
  await asegurarInventario();
  await anexarFilas(config.sheetInventarioId, `'Mantenimiento'!A1`, [
    [m.fecha, m.impresoraId, m.tipo, m.descripcion, m.costo ?? '', m.responsable],
  ]);
}

// --- Umbrales de alerta (pestaña "Umbrales") -------------------------------

/** Devuelve el sheetId (gid) de una pestaña por su título. */
async function sheetIdPorTitulo(titulo: string): Promise<number> {
  const meta = await cliente().spreadsheets.get({ spreadsheetId: config.sheetInventarioId });
  const hoja = (meta.data.sheets ?? []).find((s) => s.properties?.title === titulo);
  const sheetId = hoja?.properties?.sheetId;
  if (sheetId == null) throw new Error(`Pestaña "${titulo}" no encontrada`);
  return sheetId;
}

export async function getUmbrales(): Promise<UmbralAlerta[]> {
  await asegurarInventario();
  const filas = await leerRango(config.sheetInventarioId, `'Umbrales'!A2:D`);
  return filas.filter((f) => f[0]).map((f) => ({
    id: f[0],
    variable: (f[1] ?? 'tipo') as UmbralAlerta['variable'],
    valor: f[2] ?? '',
    umbralGramos: num(f[3]),
  }));
}

export async function crearUmbral(u: UmbralAlerta): Promise<void> {
  await asegurarInventario();
  await anexarFilas(config.sheetInventarioId, `'Umbrales'!A1`, [
    [u.id, u.variable, u.valor, u.umbralGramos],
  ]);
}

export async function actualizarUmbral(u: UmbralAlerta): Promise<void> {
  await asegurarInventario();
  const filas = await leerRango(config.sheetInventarioId, `'Umbrales'!A2:A`);
  const idx = filas.findIndex((f) => f[0] === u.id);
  if (idx === -1) throw new Error(`Umbral ${u.id} no encontrado`);
  await escribirRango(config.sheetInventarioId, `'Umbrales'!A${idx + 2}:D${idx + 2}`, [
    [u.id, u.variable, u.valor, u.umbralGramos],
  ]);
}

export async function eliminarUmbral(id: string): Promise<void> {
  await asegurarInventario();
  const filas = await leerRango(config.sheetInventarioId, `'Umbrales'!A2:A`);
  const idx = filas.findIndex((f) => f[0] === id);
  if (idx === -1) throw new Error(`Umbral ${id} no encontrado`);
  const sheetId = await sheetIdPorTitulo('Umbrales');
  await cliente().spreadsheets.batchUpdate({
    spreadsheetId: config.sheetInventarioId,
    requestBody: {
      requests: [{
        deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } },
      }],
    },
  });
}
