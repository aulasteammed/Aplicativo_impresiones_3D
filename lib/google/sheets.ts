// Cliente de Google Sheets (service account) + acceso a las tres hojas.
// Solo se usa cuando la app NO está en modo demo.

import { google, sheets_v4 } from 'googleapis';
import { config } from '../config';
import {
  Solicitud, RegistroHistorial, Proyecto, ItemProyecto, EstadoSolicitud,
  Filamento, MovimientoInventario, Impresora, Mantenimiento, EstadoProyecto, UmbralAlerta,
  NuevaSolicitud,
} from '../types';
import { normalizarEstado, extraerCorreo, num, marcaTemporalColombia } from '../util';

// Estado COMPARTIDO vía globalThis: sobrevive al hot-reload del dev server y, sobre
// todo, se comparte entre todas las rutas del servidor (Next empaqueta cada ruta por
// separado; con variables de módulo normales cada ruta tendría su propia caché y su
// propia inicialización, y la caché no serviría al cambiar de ventana). Igual patrón
// que lib/demo.ts.
const G = globalThis as unknown as {
  __sheets?: sheets_v4.Sheets;
  __sheetsCache?: Map<string, { t: number; datos: string[][] }>;
  __invInit?: boolean;
  __invInitPromise?: Promise<void>;
};

function cliente(): sheets_v4.Sheets {
  if (G.__sheets) return G.__sheets;
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  let auth;
  if (config.serviceAccountJson) {
    const credentials = JSON.parse(config.serviceAccountJson);
    auth = new google.auth.GoogleAuth({ credentials, scopes });
  } else {
    // usa GOOGLE_APPLICATION_CREDENTIALS (ruta a archivo JSON)
    auth = new google.auth.GoogleAuth({ scopes });
  }
  G.__sheets = google.sheets({ version: 'v4', auth });
  // Fail-fast: que una lectura nunca cuelgue el servidor. Timeout por petición y NO
  // reintentar los 429 (cuota) —reintentarlos no ayuda dentro del mismo minuto y
  // colgaría toda la app—; los errores 5xx sí se reintentan un par de veces.
  google.options({ timeout: 15_000, retryConfig: { retry: 2, statusCodesToRetry: [[500, 599]] } });
  return G.__sheets;
}

// Caché de lecturas con TTL corto. La API de Sheets limita a ~60 lecturas por
// minuto por usuario (la service account). Al cambiar de ventana o con el refresco
// automático se repiten muchas lecturas de los mismos rangos; la caché las colapsa
// para no exceder la cuota. Cualquier escritura/alta/baja invalida toda la caché.
const TTL_LECTURA_MS = 12_000;
G.__sheetsCache ??= new Map();
const cacheLecturas = G.__sheetsCache;

function invalidarCacheLecturas(): void {
  cacheLecturas.clear();
}

async function leerRango(spreadsheetId: string, range: string): Promise<string[][]> {
  const clave = `${spreadsheetId}::${range}`;
  const c = cacheLecturas.get(clave);
  if (c && Date.now() - c.t < TTL_LECTURA_MS) return c.datos;
  const res = await cliente().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const datos = (res.data.values ?? []) as string[][];
  cacheLecturas.set(clave, { t: Date.now(), datos });
  return datos;
}

async function escribirRango(spreadsheetId: string, range: string, values: (string | number)[][]) {
  await cliente().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
  invalidarCacheLecturas();
}

async function anexarFilas(spreadsheetId: string, range: string, values: (string | number)[][]) {
  await cliente().spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  invalidarCacheLecturas();
}

/** batchUpdate + invalida la caché de lecturas (altas/bajas de filas, crear pestañas). */
async function batchUpdateCliente(spreadsheetId: string, requests: sheets_v4.Schema$Request[]): Promise<void> {
  await cliente().spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  invalidarCacheLecturas();
}

/** Lee VARIOS rangos del mismo spreadsheet en UNA sola petición (cuenta como 1
 *  lectura). Alimenta la caché por rango y devuelve un mapa rango → valores. */
async function leerVariosRangos(spreadsheetId: string, ranges: string[]): Promise<Record<string, string[][]>> {
  // Devuelve de caché los que estén vigentes; solo pide a la API los que falten.
  const faltantes = ranges.filter((r) => {
    const c = cacheLecturas.get(`${spreadsheetId}::${r}`);
    return !(c && Date.now() - c.t < TTL_LECTURA_MS);
  });
  if (faltantes.length > 0) {
    const res = await cliente().spreadsheets.values.batchGet({ spreadsheetId, ranges: faltantes, valueRenderOption: 'FORMATTED_VALUE' });
    (res.data.valueRanges ?? []).forEach((vr, i) => {
      cacheLecturas.set(`${spreadsheetId}::${faltantes[i]}`, { t: Date.now(), datos: (vr.values ?? []) as string[][] });
    });
  }
  const out: Record<string, string[][]> = {};
  for (const r of ranges) out[r] = cacheLecturas.get(`${spreadsheetId}::${r}`)?.datos ?? [];
  return out;
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

/** Crea una solicitud nueva anexándola directamente a la hoja de respuestas.
 *  Se usa en lugar del Google Form porque los formularios con pregunta de subida
 *  de archivos obligan a iniciar sesión y rechazan el POST anónimo de la app
 *  (HTTP 401). La fila queda igual que una respuesta del Form: columna J (archivos)
 *  y M (estado) vacías → la app la muestra como estado "Nueva". Devuelve la marca
 *  temporal generada, que funciona como identificador de la solicitud. */
export async function crearSolicitudEnHoja(datos: NuevaSolicitud): Promise<string> {
  const marca = marcaTemporalColombia();
  const fila: (string | number)[] = [
    marca,                  // A marca temporal (id de la solicitud)
    datos.nombre,           // B nombre
    datos.correo,           // C correo
    datos.rol,              // D rol
    datos.programa,         // E programa
    datos.motivo,           // F motivo
    datos.servicio,         // G servicio
    datos.descripcionPieza, // H descripción
    datos.objetivoPieza,    // I objetivo
    '',                     // J archivos (la app no adjunta archivos)
    datos.fechaTentativa,   // K fecha tentativa
    datos.celular,          // L celular
    '',                     // M estado (vacío = "Nueva")
  ];
  await anexarFilas(config.sheetSolicitudesId, `'${config.tabSolicitudes}'!A1`, [fila]);
  return marca;
}

/** Actualiza la columna M (estado) verificando que la fila siga correspondiendo
 *  a la marca temporal; si la fila se movió, la vuelve a buscar. */
export async function actualizarEstadoSolicitud(id: string, fila: number, estado: EstadoSolicitud): Promise<void> {
  const filaReal = await filaRealSolicitud(id, fila);
  await escribirRango(config.sheetSolicitudesId, `'${config.tabSolicitudes}'!M${filaReal}`, [[estado]]);
}

/** sheetId (gid) de una pestaña dentro de un spreadsheet dado (para borrar filas). */
async function sheetIdEn(spreadsheetId: string, titulo: string): Promise<number> {
  const meta = await cliente().spreadsheets.get({ spreadsheetId });
  const hoja = (meta.data.sheets ?? []).find((s) => s.properties?.title === titulo);
  const id = hoja?.properties?.sheetId;
  if (id == null) throw new Error(`Pestaña "${titulo}" no encontrada`);
  return id;
}

/** Ubica la fila real de una solicitud por su marca temporal (id), re-buscándola si se movió. */
async function filaRealSolicitud(id: string, fila: number): Promise<number> {
  const tab = config.tabSolicitudes;
  // La lectura puntual solo es válida para filas de datos (>= 2). Si no se conoce
  // la fila (0/1), se busca directamente por marca temporal en toda la columna A.
  if (fila >= 2) {
    const verif = await leerRango(config.sheetSolicitudesId, `'${tab}'!A${fila}:A${fila}`);
    if ((verif[0]?.[0] ?? '') === id) return fila;
  }
  const todas = await leerRango(config.sheetSolicitudesId, `'${tab}'!A2:A`);
  const idx = todas.findIndex((r) => (r[0] ?? '') === id);
  if (idx === -1) throw new Error(`No se encontró la solicitud con marca temporal "${id}"`);
  return idx + 2;
}

/** Edita las columnas B..L de una solicitud (no toca A marca temporal ni M estado). */
export async function actualizarSolicitud(sol: Solicitud): Promise<void> {
  const filaReal = await filaRealSolicitud(sol.id, sol.fila);
  await escribirRango(config.sheetSolicitudesId, `'${config.tabSolicitudes}'!B${filaReal}:L${filaReal}`, [[
    sol.nombre, sol.correo, sol.rol, sol.programa, sol.motivo, sol.servicio,
    sol.descripcionPieza, sol.objetivoPieza, sol.archivos ?? '', sol.fechaTentativa, sol.celular,
  ]]);
}

export async function eliminarSolicitud(id: string, fila: number): Promise<void> {
  const filaReal = await filaRealSolicitud(id, fila);
  const sheetId = await sheetIdEn(config.sheetSolicitudesId, config.tabSolicitudes);
  await batchUpdateCliente(config.sheetSolicitudesId, [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: filaReal - 1, endIndex: filaReal } } }]);
}

// ---------------------------------------------------------------------------
// HISTORIAL — columnas A..S existentes + T (Filamento ID)
// ---------------------------------------------------------------------------

const HIST_RANGO = (tab: string) => `'${tab}'!A2:T`;

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
    filamentoId: f[19] ?? '', // T (antes nombre del proyecto)
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
        nombre: r.codigo,
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

/** Garantiza el encabezado de la columna extra T (Filamento ID) */
async function asegurarColumnasExtra(): Promise<void> {
  const tab = config.tabHistorial;
  const fila1 = await leerRango(config.sheetHistorialId, `'${tab}'!T1:T1`);
  if ((fila1[0]?.[0] ?? '') !== 'Filamento ID') {
    await escribirRango(config.sheetHistorialId, `'${tab}'!T1`, [['Filamento ID']]);
  }
}

function itemAFilaHistorial(
  codigo: string, impresora: string, estado: string,
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
    item.filamentoId ?? '',                 // T filamento ID (antes en U)
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
  const filas = items.map((it) => itemAFilaHistorial(codigoLimpio, impresora, 'Activa', it, porId.get(it.solicitudId)));
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
    itemAFilaHistorial(codigo, ref.impresora, ref.estado || 'Activa', it, porId.get(it.solicitudId)),
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

/** sheetId (gid) de la pestaña de Historial (para borrar filas) */
async function sheetIdHistorial(): Promise<number> {
  const meta = await cliente().spreadsheets.get({ spreadsheetId: config.sheetHistorialId });
  const hoja = (meta.data.sheets ?? []).find((s) => s.properties?.title === config.tabHistorial);
  const id = hoja?.properties?.sheetId;
  if (id == null) throw new Error(`Pestaña "${config.tabHistorial}" no encontrada`);
  return id;
}

/**
 * Edición COMPLETA de una cama: reemplaza su código, impresora y el conjunto de
 * ítems (añadir / quitar / modificar). Conserva el estado (Activa/En pausa).
 * Estrategia segura: primero se AÑADEN las filas nuevas y luego se BORRAN las
 * viejas — si el borrado fallara, quedarían duplicados (recuperable) en vez de
 * perder la cama. Devuelve el código final.
 */
export async function editarProyecto(
  codigoOriginal: string, nuevoCodigo: string, impresora: string,
  items: ItemProyecto[], solicitudes: Solicitud[],
): Promise<string> {
  await asegurarColumnasExtra();
  const registros = await getHistorial();
  const filasCama = registros.filter((r) => r.codigo === codigoOriginal);
  if (filasCama.length === 0) throw new Error(`Cama ${codigoOriginal} no encontrada`);
  if (items.length === 0) throw new Error('La cama debe tener al menos una solicitud.');
  const estado = filasCama[0].estado || 'Activa';
  const codigoLimpio = nuevoCodigo.trim();

  // Si cambió el código, validar que no choque con OTRA cama
  if (codigoLimpio.toLowerCase() !== codigoOriginal.trim().toLowerCase()) {
    const otros = new Set(registros
      .filter((r) => r.codigo && r.codigo !== codigoOriginal)
      .map((r) => (r.codigo ?? '').trim().toLowerCase()));
    if (otros.has(codigoLimpio.toLowerCase())) {
      throw new Error(`Ya existe una cama con el código "${codigoLimpio}". Use otro código.`);
    }
  }

  // 1) Añadir las filas nuevas (al final)
  const porId = new Map(solicitudes.map((s) => [s.id, s]));
  const nuevas = items.map((it) => itemAFilaHistorial(codigoLimpio, impresora, estado, it, porId.get(it.solicitudId)));
  await anexarFilas(config.sheetHistorialId, `'${config.tabHistorial}'!A1`, nuevas);

  // 2) Borrar las filas viejas (índices descendentes para no desplazar los que faltan)
  const sheetId = await sheetIdHistorial();
  const requests = filasCama
    .map((r) => r.fila)
    .sort((a, b) => b - a)
    .map((fila) => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS' as const, startIndex: fila - 1, endIndex: fila } } }));
  await batchUpdateCliente(config.sheetHistorialId, requests);

  return codigoLimpio;
}

/** Elimina una cama: borra TODAS sus filas del historial. */
export async function eliminarProyecto(codigo: string): Promise<void> {
  const registros = await getHistorial();
  const filas = registros.filter((r) => r.codigo === codigo);
  if (filas.length === 0) throw new Error(`Cama ${codigo} no encontrada`);
  const sheetId = await sheetIdHistorial();
  const requests = filas.map((r) => r.fila).sort((a, b) => b - a)
    .map((fila) => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS' as const, startIndex: fila - 1, endIndex: fila } } }));
  await batchUpdateCliente(config.sheetHistorialId, requests);
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
  Mantenimiento: ['Fecha', 'Impresora ID', 'Tipo', 'Descripción', 'Costo (COP)', 'Responsable', 'Programación', 'Próxima fecha', 'Cada N horas', 'Horas base'],
  Umbrales: ['ID', 'Variable', 'Valor', 'Umbral (g)'],
};


// Memoiza la PROMESA (single-flight): si varias lecturas de inventario corren en
// paralelo (p. ej. el Promise.all del dashboard), TODAS esperan la misma
// inicialización en vez de ejecutarla varias veces a la vez.
export async function asegurarInventario(): Promise<void> {
  if (G.__invInit) return;
  if (!G.__invInitPromise) {
    G.__invInitPromise = inicializarInventario().finally(() => { G.__invInitPromise = undefined; });
  }
  return G.__invInitPromise;
}

async function inicializarInventario(): Promise<void> {
  const meta = await cliente().spreadsheets.get({ spreadsheetId: config.sheetInventarioId });
  const existentes = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ''));
  const requests: sheets_v4.Schema$Request[] = [];
  for (const tab of Object.keys(TABS_INVENTARIO)) {
    if (!existentes.has(tab)) requests.push({ addSheet: { properties: { title: tab } } });
  }
  if (requests.length > 0) {
    await batchUpdateCliente(config.sheetInventarioId, requests);
  }
  // Encabezados de las 5 pestañas en UNA sola petición (batchGet).
  const tabs = Object.keys(TABS_INVENTARIO);
  const cabeceras = await leerVariosRangos(config.sheetInventarioId, tabs.map((t) => `'${t}'!A1:Z1`));
  for (const [tab, headers] of Object.entries(TABS_INVENTARIO)) {
    const actual = cabeceras[`'${tab}'!A1:Z1`]?.[0] ?? [];
    // Reescribe la fila de encabezados si falta o si el esquema cambió/creció
    // (p. ej. columnas nuevas de programación de mantenimiento). Solo toca la fila 1.
    if (headers.some((h, i) => (actual[i] ?? '') !== h)) {
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
  G.__invInit = true;
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
  await batchUpdateCliente(config.sheetInventarioId, [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }]);
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

export async function eliminarImpresora(id: string): Promise<void> {
  await asegurarInventario();
  const filas = await leerRango(config.sheetInventarioId, `'Impresoras'!A2:A`);
  const idx = filas.findIndex((f) => f[0] === id);
  if (idx === -1) throw new Error(`Impresora ${id} no encontrada`);
  const sheetId = await sheetIdPorTitulo('Impresoras');
  await batchUpdateCliente(config.sheetInventarioId, [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }]);
}

export async function getMantenimientos(): Promise<Mantenimiento[]> {
  await asegurarInventario();
  const filas = await leerRango(config.sheetInventarioId, `'Mantenimiento'!A2:J`);
  return filas
    .map((f, i) => ({
      fila: i + 2, // fila real en la hoja (para editar/eliminar)
      fecha: f[0], impresoraId: f[1] ?? '', tipo: f[2] ?? '', descripcion: f[3] ?? '',
      costo: f[4] ? num(f[4]) : undefined, responsable: f[5] ?? '',
      programacion: (f[6] as Mantenimiento['programacion']) || 'ninguna',
      proximaFecha: f[7] ?? '',
      cadaHoras: f[8] ? num(f[8]) : undefined,
      horasBase: f[9] !== undefined && f[9] !== '' ? num(f[9]) : undefined,
    }))
    .filter((m) => m.fecha)
    .reverse();
}

export async function registrarMantenimiento(m: Mantenimiento): Promise<void> {
  await asegurarInventario();
  await anexarFilas(config.sheetInventarioId, `'Mantenimiento'!A1`, [
    [m.fecha, m.impresoraId, m.tipo, m.descripcion, m.costo ?? '', m.responsable,
     m.programacion ?? 'ninguna', m.proximaFecha ?? '', m.cadaHoras ?? '', m.horasBase ?? ''],
  ]);
}

export async function actualizarMantenimiento(m: Mantenimiento): Promise<void> {
  await asegurarInventario();
  const fila = m.fila;
  if (!fila || fila < 2) throw new Error('Registro de mantenimiento no identificado; actualiza la vista.');
  const existente = await leerRango(config.sheetInventarioId, `'Mantenimiento'!A${fila}:J${fila}`);
  if (!existente[0] || !existente[0][0]) throw new Error('El registro de mantenimiento cambió; actualiza la vista.');
  // La "Horas base" (columna J) del registro original se PRESERVA: no se edita ni se agrega.
  const horasBase = existente[0][9] ?? '';
  await escribirRango(config.sheetInventarioId, `'Mantenimiento'!A${fila}:J${fila}`, [
    [m.fecha, m.impresoraId, m.tipo, m.descripcion, m.costo ?? '', m.responsable,
     m.programacion ?? 'ninguna', m.proximaFecha ?? '', m.cadaHoras ?? '', horasBase],
  ]);
}

export async function eliminarMantenimiento(fila: number): Promise<void> {
  await asegurarInventario();
  if (!fila || fila < 2) throw new Error('Registro de mantenimiento no identificado; actualiza la vista.');
  const sheetId = await sheetIdPorTitulo('Mantenimiento');
  await batchUpdateCliente(config.sheetInventarioId, [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: fila - 1, endIndex: fila } } }]);
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
  await batchUpdateCliente(config.sheetInventarioId, [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }]);
}
