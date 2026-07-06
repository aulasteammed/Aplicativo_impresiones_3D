// Fachada única de acceso a datos: decide entre Google Sheets (modo real)
// y el almacén en memoria (modo demo), y contiene los flujos de negocio
// compuestos (finalización de proyectos, descuento de inventario, dashboard).

import { esModoDemo } from './config';
import * as sheets from './google/sheets';
import * as demo from './demo';
import {
  Solicitud, Proyecto, RegistroHistorial, EstadoSolicitud, EstadoProyecto,
  Filamento, MovimientoInventario, Impresora, Mantenimiento,
  ItemProyecto, DashboardData, AlertaStock, ResultadoImpresion, UmbralAlerta,
  DatosDashboard, SolicitudDash, HistorialDash, FilamentoDash,
} from './types';
import { num, parsearHoras, hoyISO, normalizarTexto, coincideAprox, distanciaLevenshtein, calcularAlertasAgregadas, calcularAlertasMantenimiento } from './util';
import { agruparProyectos } from './google/sheets';

function backend() {
  return esModoDemo() ? demo : sheets;
}

// --- Solicitudes ------------------------------------------------------------

export async function getSolicitudes(): Promise<Solicitud[]> {
  const lista = await backend().getSolicitudes();
  return [...lista].reverse(); // más recientes primero
}

export async function cambiarEstadoSolicitud(id: string, fila: number, estado: EstadoSolicitud): Promise<void> {
  await backend().actualizarEstadoSolicitud(id, fila, estado);
}

// --- Proyectos / Historial ---------------------------------------------------

export async function getHistorial(): Promise<RegistroHistorial[]> {
  return backend().getHistorial();
}

export async function getProyectos(): Promise<Proyecto[]> {
  return agruparProyectos(await backend().getHistorial());
}

export async function crearProyecto(codigo: string, impresora: string, items: ItemProyecto[]): Promise<string> {
  const solicitudes = await backend().getSolicitudes();
  return backend().crearProyecto(codigo, impresora, items, solicitudes);
}

export async function agregarItemsProyecto(codigo: string, items: ItemProyecto[]): Promise<void> {
  const solicitudes = await backend().getSolicitudes();
  await backend().agregarItemsProyecto(codigo, items, solicitudes);
}

export async function cambiarEstadoProyecto(codigo: string, estado: EstadoProyecto): Promise<void> {
  await backend().actualizarEstadoProyecto(codigo, estado);
}

/**
 * Finaliza una cama de impresión de forma **transaccional** (best-effort sobre
 * Google Sheets, que no soporta transacciones ACID):
 *
 * - FASE 1 · PREFLIGHT: solo lecturas y cálculo. Se leen historial, filamentos,
 *   impresoras y movimientos, y se calcula TODO el descuento (agregado por rollo)
 *   y las horas antes de escribir nada, para detectar problemas por adelantado.
 * - FASE 2 · COMMIT: se aplican los descuentos de inventario y las horas, y SOLO
 *   al final se marca el historial como Finalizada. Si una escritura de inventario
 *   falla, la cama queda sin finalizar y puede reintentarse.
 *
 * Idempotencia: si la cama ya está finalizada o ya tiene movimientos de descuento
 * registrados (reintento o doble clic), NO se vuelve a descontar inventario ni a
 * sumar horas —evita el doble gasto—. Ante un fallo parcial se prefiere el
 * sub-descuento (visible y corregible) al doble descuento.
 *
 * Descuento por resultado:
 *  - Exitoso → gramos estimados por ítem + desperdicio reportado.
 *  - Fallido → solo el desperdicio reportado (o los gramos estimados si no se reportó).
 *
 * NOTA: NO modifica el estado de las solicitudes vinculadas; permanecen como
 * estaban (p. ej. "Aprobada"). El paso a "Atendida" lo realiza manualmente el
 * usuario desde la ventana de Solicitudes.
 */
export async function finalizarProyecto(
  codigo: string,
  resultado: ResultadoImpresion,
  desperdicio: number | null,
  comentarios: string,
): Promise<{ advertencias: string[] }> {
  const b = backend();
  const advertencias: string[] = [];

  // ── FASE 1 · PREFLIGHT (solo lecturas y cálculo; NO se escribe nada) ────────
  const [historial, filamentos, impresoras, movimientos] = await Promise.all([
    b.getHistorial(), b.getFilamentos(), b.getImpresoras(), b.getMovimientos(),
  ]);

  const filas = historial.filter((r) => r.codigo === codigo);
  if (filas.length === 0) throw new Error(`No se encontró la cama ${codigo} en el historial.`);

  // Idempotencia: ¿el inventario ya se descontó en un intento anterior?
  const yaFinalizada = filas.some((r) => (r.estado || '').toLowerCase() === 'finalizada');
  const yaDescontado = movimientos.some(
    (m) => m.proyectoCodigo === codigo && (m.motivo === 'impresión' || m.motivo === 'desperdicio'),
  );
  const inventarioYaAplicado = yaFinalizada || yaDescontado;

  // Descuento AGREGADO por rollo (un solo ajuste por filamento aunque varias piezas
  // usen el mismo): menos escrituras y sin lecturas/escrituras repetidas del rollo.
  const totalEstimado = filas.reduce((acc, r) => acc + num(r.gramos), 0);
  const descuentoPorRollo = new Map<string, number>();
  for (const r of filas) {
    const gramosItem = num(r.gramos);
    const proporcion = totalEstimado > 0 ? gramosItem / totalEstimado : 1 / filas.length;
    const desperdicioItem = (desperdicio ?? 0) * proporcion;

    const aDescontar = resultado === 'Exitoso'
      ? gramosItem + desperdicioItem
      : (desperdicio !== null ? desperdicioItem : gramosItem);
    if (aDescontar <= 0) continue;

    if (!r.filamentoId) {
      advertencias.push(`El ítem de ${r.nombre} no tiene rollo asignado; no se descontó inventario.`);
      continue;
    }
    if (!filamentos.some((f) => f.id === r.filamentoId)) {
      advertencias.push(`Rollo ${r.filamentoId} no encontrado en inventario; no se descontó.`);
      continue;
    }
    descuentoPorRollo.set(r.filamentoId, (descuentoPorRollo.get(r.filamentoId) ?? 0) + aDescontar);
  }

  // Horas de impresión a acumular en la impresora de la cama (todas comparten impresora).
  const horas = filas.reduce((acc, r) => acc + parsearHoras(r.tiempoHoras), 0);
  const nombreImpresora = filas[0].impresora;
  const impresora = horas > 0
    ? impresoras.find((i) => i.nombre === nombreImpresora || i.id === nombreImpresora)
    : undefined;
  if (horas > 0 && !impresora) {
    advertencias.push(`Impresora "${nombreImpresora}" no encontrada; no se acumularon horas.`);
  }

  // ── FASE 2 · COMMIT (escrituras) ────────────────────────────────────────────
  // Inventario y horas primero; el historial se marca "Finalizada" al final para
  // que un fallo de escritura de inventario deje la cama reintentable sin doble gasto.
  if (inventarioYaAplicado) {
    advertencias.push('La cama ya tenía registrado el descuento de inventario; no se volvió a descontar ni a sumar horas.');
  } else {
    for (const [filamentoId, aDescontar] of Array.from(descuentoPorRollo.entries())) {
      const fil = filamentos.find((f) => f.id === filamentoId)!;
      fil.gramosRestantes = Math.max(0, fil.gramosRestantes - aDescontar);
      fil.comenzado = true;
      await b.guardarFilamento(fil, false);
      await b.registrarMovimiento({
        fecha: hoyISO(),
        filamentoId,
        proyectoCodigo: codigo,
        gramos: -Math.round(aDescontar * 100) / 100,
        motivo: resultado === 'Exitoso' ? 'impresión' : 'desperdicio',
      });
    }

    if (impresora) {
      impresora.horasAcumuladas = Math.round((impresora.horasAcumuladas + horas) * 100) / 100;
      await b.guardarImpresora(impresora, false);
    }
  }

  // Marca de finalización (última escritura): Estado=Finalizada + resultado/desperdicio/comentarios.
  await b.finalizarProyectoEnHistorial(codigo, resultado, desperdicio ?? '', comentarios);

  return { advertencias };
}

// --- Inventario ---------------------------------------------------------------

export async function getFilamentos(): Promise<Filamento[]> {
  return backend().getFilamentos();
}

export interface ResultadoCrearFilamento {
  tipo: 'creado' | 'fusionado' | 'sugerencia';
  filamento?: Filamento;
  candidato?: Filamento;
}

/** Fusiona un ingreso de filamento dentro de un rollo existente: suma rollos y
 *  gramos, registra el movimiento de compra y conserva la identidad existente. */
async function fusionarFilamento(objetivo: Filamento, ingreso: Omit<Filamento, 'id'>): Promise<Filamento> {
  const b = backend();
  const fusionado: Filamento = {
    ...objetivo,
    rollos: objetivo.rollos + (Number(ingreso.rollos) || 0),
    gramosRestantes: objetivo.gramosRestantes + (Number(ingreso.gramosRestantes) || 0),
    comenzado: objetivo.comenzado || ingreso.comenzado,
  };
  await b.guardarFilamento(fusionado, false);
  if ((Number(ingreso.gramosRestantes) || 0) > 0) {
    await b.registrarMovimiento({
      fecha: hoyISO(), filamentoId: fusionado.id, proyectoCodigo: '', gramos: ingreso.gramosRestantes, motivo: 'compra',
    });
  }
  return fusionado;
}

/** Añade un filamento al inventario. Si (tipo, color, marca) coincide EXACTO
 *  (normalizando mayúsculas/acentos/espacios) con uno existente, fusiona; si la
 *  coincidencia es solo aproximada (typo), devuelve una sugerencia para que el
 *  usuario confirme; si no hay coincidencia, crea uno nuevo. */
export async function crearFilamento(
  fil: Omit<Filamento, 'id'>,
  opts: { forzarNuevo?: boolean; fusionarCon?: string } = {},
): Promise<ResultadoCrearFilamento> {
  const b = backend();
  const existentes = await b.getFilamentos();

  // Fusión confirmada por el usuario hacia un id concreto
  if (opts.fusionarCon) {
    const objetivo = existentes.find((f) => f.id === opts.fusionarCon);
    if (objetivo) return { tipo: 'fusionado', filamento: await fusionarFilamento(objetivo, fil) };
    // si el id ya no existe, continúa y crea uno nuevo
  }

  if (!opts.forzarNuevo && !opts.fusionarCon) {
    // 1) Coincidencia EXACTA normalizada (tipo+color+marca) → fusiona automáticamente
    const exacto = existentes.find((f) =>
      normalizarTexto(f.tipo) === normalizarTexto(fil.tipo)
      && normalizarTexto(f.color) === normalizarTexto(fil.color)
      && normalizarTexto(f.marca) === normalizarTexto(fil.marca));
    if (exacto) return { tipo: 'fusionado', filamento: await fusionarFilamento(exacto, fil) };

    // 2) Coincidencia APROXIMADA en las 3 características (tolera typos/transposiciones,
    //    incl. en el tipo, p. ej. "pteg"→"PETG") → sugiere confirmar
    const aproximados = existentes
      .filter((f) =>
        coincideAprox(f.tipo, fil.tipo)
        && coincideAprox(f.color, fil.color)
        && coincideAprox(f.marca, fil.marca))
      .map((f) => ({
        f,
        dist: distanciaLevenshtein(normalizarTexto(f.tipo), normalizarTexto(fil.tipo))
            + distanciaLevenshtein(normalizarTexto(f.color), normalizarTexto(fil.color))
            + distanciaLevenshtein(normalizarTexto(f.marca), normalizarTexto(fil.marca)),
      }))
      .sort((a, z) => a.dist - z.dist);
    if (aproximados.length > 0) return { tipo: 'sugerencia', candidato: aproximados[0].f };
  }

  // 3) Crear nuevo
  let max = 0;
  for (const f of existentes) {
    const n = parseInt(f.id.replace('FIL-', ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  const nuevo: Filamento = { ...fil, id: `FIL-${String(max + 1).padStart(3, '0')}` };
  await b.guardarFilamento(nuevo, true);
  if (nuevo.gramosRestantes > 0) {
    await b.registrarMovimiento({
      fecha: hoyISO(), filamentoId: nuevo.id, proyectoCodigo: '', gramos: nuevo.gramosRestantes, motivo: 'compra',
    });
  }
  return { tipo: 'creado', filamento: nuevo };
}

export async function actualizarFilamento(fil: Filamento): Promise<void> {
  const b = backend();
  const actual = (await b.getFilamentos()).find((f) => f.id === fil.id);
  await b.guardarFilamento(fil, false);
  if (actual && actual.gramosRestantes !== fil.gramosRestantes) {
    await b.registrarMovimiento({
      fecha: hoyISO(), filamentoId: fil.id, proyectoCodigo: '',
      gramos: fil.gramosRestantes - actual.gramosRestantes, motivo: 'ajuste',
    });
  }
}

export async function eliminarFilamento(id: string): Promise<void> {
  await backend().eliminarFilamento(id);
}

export async function getMovimientos(): Promise<MovimientoInventario[]> {
  return backend().getMovimientos();
}

export async function getImpresoras(): Promise<Impresora[]> {
  return backend().getImpresoras();
}

export async function crearImpresora(imp: Omit<Impresora, 'id'>): Promise<Impresora> {
  const b = backend();
  const existentes = await b.getImpresoras();
  let max = 0;
  for (const i of existentes) {
    const n = parseInt(i.id.replace('IMP-', ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  const nueva: Impresora = { ...imp, id: `IMP-${String(max + 1).padStart(2, '0')}` };
  await b.guardarImpresora(nueva, true);
  return nueva;
}

export async function actualizarImpresora(imp: Impresora): Promise<void> {
  await backend().guardarImpresora(imp, false);
}

export async function getMantenimientos(): Promise<Mantenimiento[]> {
  return backend().getMantenimientos();
}

export async function crearMantenimiento(m: Mantenimiento): Promise<void> {
  const b = backend();
  const mant: Mantenimiento = { ...m };
  // Normaliza según el tipo de programación del próximo mantenimiento.
  if (mant.programacion === 'horas') {
    mant.proximaFecha = '';
    // Captura las horas actuales de la impresora como punto de partida del intervalo.
    if (mant.horasBase == null) {
      const imp = (await b.getImpresoras()).find((i) => i.id === mant.impresoraId);
      mant.horasBase = imp ? imp.horasAcumuladas : 0;
    }
  } else if (mant.programacion === 'fecha') {
    mant.cadaHoras = undefined;
    mant.horasBase = undefined;
  } else {
    mant.programacion = 'ninguna';
    mant.proximaFecha = '';
    mant.cadaHoras = undefined;
    mant.horasBase = undefined;
  }
  await b.registrarMantenimiento(mant);
}

/** Edita un mantenimiento existente. NO modifica la "Horas base": el backend
 *  preserva la del registro original (no se puede editar ni agregar desde aquí). */
export async function actualizarMantenimiento(m: Mantenimiento): Promise<void> {
  const mant: Mantenimiento = { ...m };
  if (mant.programacion === 'horas') {
    mant.proximaFecha = '';
  } else if (mant.programacion === 'fecha') {
    mant.cadaHoras = undefined;
  } else {
    mant.programacion = 'ninguna';
    mant.proximaFecha = '';
    mant.cadaHoras = undefined;
  }
  await backend().actualizarMantenimiento(mant);
}

export async function eliminarMantenimiento(fila: number): Promise<void> {
  await backend().eliminarMantenimiento(fila);
}

/** Valor del filamento para la variable de una regla de umbral */
function valorParaVariable(f: Filamento, variable: UmbralAlerta['variable']): string {
  if (variable === 'color') return f.color;
  if (variable === 'marca') return f.marca;
  return String(f.tipo);
}

/** Alertas de stock bajo según las reglas de umbral (por color/marca/tipo).
 *  Un rollo alerta cuando coincide con alguna regla y su stock cae por debajo
 *  del umbral; si rompe varias reglas, se reporta el umbral mayor. */
export function calcularAlertas(filamentos: Filamento[], umbrales: UmbralAlerta[]): AlertaStock[] {
  const alertas: AlertaStock[] = [];
  for (const f of filamentos) {
    const rotas = umbrales.filter(
      (u) => normalizarTexto(valorParaVariable(f, u.variable)) === normalizarTexto(u.valor)
        && f.gramosRestantes <= u.umbralGramos,
    );
    if (rotas.length === 0) continue;
    const umbral = Math.max(...rotas.map((u) => u.umbralGramos));
    alertas.push({ tipo: f.tipo, color: f.color, filamentoId: f.id, gramosRestantes: f.gramosRestantes, umbral });
  }
  return alertas;
}

// --- Umbrales de alerta ------------------------------------------------------

export async function getUmbrales(): Promise<UmbralAlerta[]> {
  return backend().getUmbrales();
}

export interface ResultadoCrearUmbral {
  tipo: 'creado' | 'actualizado' | 'sugerencia';
  umbral?: UmbralAlerta;
  candidato?: UmbralAlerta;
}

/** Crea un umbral evitando reglas repetidas para la misma variable: si el valor
 *  coincide EXACTO (normalizado) con uno existente, actualiza su gramaje; si la
 *  coincidencia es solo aproximada (typo), devuelve una sugerencia para que el
 *  usuario confirme; si no hay coincidencia, crea uno nuevo. */
export async function crearUmbral(
  u: Omit<UmbralAlerta, 'id'>,
  opts: { forzarNuevo?: boolean; actualizarId?: string } = {},
): Promise<ResultadoCrearUmbral> {
  const b = backend();
  const existentes = await b.getUmbrales();

  // Actualización confirmada por el usuario
  if (opts.actualizarId) {
    const obj = existentes.find((x) => x.id === opts.actualizarId);
    if (obj) {
      const actualizado: UmbralAlerta = { ...obj, umbralGramos: u.umbralGramos };
      await b.actualizarUmbral(actualizado);
      return { tipo: 'actualizado', umbral: actualizado };
    }
  }

  if (!opts.forzarNuevo && !opts.actualizarId) {
    const mismaVariable = existentes.filter((x) => x.variable === u.variable);
    // 1) Valor EXACTO (normalizado) → actualiza el gramaje del umbral existente
    const exacto = mismaVariable.find((x) => normalizarTexto(x.valor) === normalizarTexto(u.valor));
    if (exacto) {
      const actualizado: UmbralAlerta = { ...exacto, umbralGramos: u.umbralGramos };
      await b.actualizarUmbral(actualizado);
      return { tipo: 'actualizado', umbral: actualizado };
    }
    // 2) Valor APROXIMADO (typo/transposición/acentos) → sugiere confirmar
    const aproximados = mismaVariable
      .filter((x) => coincideAprox(x.valor, u.valor))
      .map((x) => ({ x, dist: distanciaLevenshtein(normalizarTexto(x.valor), normalizarTexto(u.valor)) }))
      .sort((a, z) => a.dist - z.dist);
    if (aproximados.length > 0) return { tipo: 'sugerencia', candidato: aproximados[0].x };
  }

  // 3) Crear nuevo
  let max = 0;
  for (const x of existentes) {
    const n = parseInt(x.id.replace('UMB-', ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  const nuevo: UmbralAlerta = { ...u, id: `UMB-${String(max + 1).padStart(3, '0')}` };
  await b.crearUmbral(nuevo);
  return { tipo: 'creado', umbral: nuevo };
}

export async function eliminarUmbral(id: string): Promise<void> {
  await backend().eliminarUmbral(id);
}

// --- Dashboard ---------------------------------------------------------------

export async function getDashboard(): Promise<DashboardData> {
  const [solicitudes, historial, filamentos, movimientos, umbrales, impresoras, mantenimientos] = await Promise.all([
    backend().getSolicitudes(),
    backend().getHistorial(),
    backend().getFilamentos(),
    backend().getMovimientos(),
    backend().getUmbrales(),
    backend().getImpresoras(),
    backend().getMantenimientos(),
  ]);
  const proyectos = agruparProyectos(historial);

  const finalizadas = historial.filter((r) => (r.estado || '').toLowerCase() === 'finalizada' && r.resultado);
  const exitosas = finalizadas.filter((r) => r.resultado === 'Exitoso').length;

  const tiempoPorImpresoraMap = new Map<string, number>();
  for (const r of historial) {
    if (!r.impresora) continue;
    const h = parsearHoras(r.tiempoHoras);
    if (h <= 0) continue;
    tiempoPorImpresoraMap.set(r.impresora, (tiempoPorImpresoraMap.get(r.impresora) ?? 0) + h);
  }

  const mesActual = hoyISO().slice(0, 7);
  const materialConsumidoMes = movimientos
    .filter((m) => m.gramos < 0 && String(m.fecha).startsWith(mesActual))
    .reduce((acc, m) => acc + Math.abs(m.gramos), 0);

  const pendientes = solicitudes.filter((s) => s.estado === 'Nueva' || s.estado === 'En Revisión' || s.estado === 'Aprobada');

  return {
    solicitudesNuevas: solicitudes.filter((s) => s.estado === 'Nueva').length,
    solicitudesTotal: solicitudes.length,
    solicitudesEnRevision: solicitudes.filter((s) => s.estado === 'En Revisión').length,
    proyectosActivos: proyectos.filter((p) => p.estado !== 'Finalizada'),
    tasaExito: finalizadas.length > 0 ? Math.round((exitosas / finalizadas.length) * 100) : null,
    totalFinalizadas: finalizadas.length,
    desperdicioTotal: historial.reduce((acc, r) => acc + num(r.desperdicio), 0),
    materialConsumidoMes: Math.round(materialConsumidoMes),
    tiempoPorImpresora: Array.from(tiempoPorImpresoraMap.entries()).map(([impresora, horas]) => ({
      impresora, horas: Math.round(horas * 10) / 10,
    })),
    alertasUmbral: calcularAlertasAgregadas(filamentos, umbrales),
    alertasMantenimiento: calcularAlertasMantenimiento(impresoras, mantenimientos, hoyISO()),
    proximasEntregas: pendientes.slice(-8).reverse().map((s) => ({
      nombre: s.nombre, pieza: s.descripcionPieza.slice(0, 80), fecha: s.fechaTentativa, estado: s.estado,
    })),
    esDemo: esModoDemo(),
  };
}

// --- Datos crudos para el Dashboard interactivo (filtrable en el cliente) -----

/** "DD/MM/YYYY …" o "YYYY-MM-…" → "YYYY-MM" (vacío si no se reconoce) */
function mesDeFecha(fecha: string): string {
  const s = String(fecha ?? '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return '';
}

/** "DD/MM/YYYY" o "YYYY-MM-DD" → "YYYY-MM-DD" (vacío si no se reconoce) */
function fechaAISO(fecha: string): string {
  const s = String(fecha ?? '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}

/** Umbral efectivo de un rollo = el mayor umbral de las reglas que le aplican */
function umbralDeFilamento(f: Filamento, umbrales: UmbralAlerta[]): number {
  const valorVar = (v: UmbralAlerta['variable']) => (v === 'color' ? f.color : v === 'marca' ? f.marca : String(f.tipo));
  const aplican = umbrales.filter((u) => normalizarTexto(valorVar(u.variable)) === normalizarTexto(u.valor));
  return aplican.length ? Math.max(...aplican.map((u) => u.umbralGramos)) : 0;
}

/** Datasets crudos (solicitudes, historial, filamentos, impresoras, mantenimientos)
 *  con la forma que consume el Dashboard interactivo; el filtrado se hace en el cliente. */
export async function getDatosDashboard(): Promise<DatosDashboard> {
  const b = backend();
  const [solicitudes, historial, filamentos, umbrales, impresoras, mantenimientos] = await Promise.all([
    b.getSolicitudes(), b.getHistorial(), b.getFilamentos(), b.getUmbrales(), b.getImpresoras(), b.getMantenimientos(),
  ]);
  const hoy = hoyISO();
  const pendiente = (e: string) => e === 'Nueva' || e === 'En Revisión' || e === 'Aprobada';

  const sol: SolicitudDash[] = solicitudes.map((s) => {
    const iso = fechaAISO(s.fechaTentativa);
    return {
      mes: mesDeFecha(s.marcaTemporal),
      fechaTent: s.fechaTentativa || '',
      nombre: s.nombre || '', correo: s.correo || '',
      rol: s.rol || '(sin dato)',
      programa: s.programa || '(sin programa)',
      motivo: s.motivo || '(sin dato)',
      servicio: s.servicio || '(sin dato)',
      estado: s.estado,
      vencida: !!iso && iso < hoy && pendiente(s.estado),
    };
  });

  const hist: HistorialDash[] = historial.map((r) => ({
    mes: mesDeFecha(r.marcaTemporal),
    nombre: r.nombre || '', correo: r.correo || '',
    rol: r.rol || '(sin dato)',
    programa: r.programa || '(sin programa)',
    motivo: r.motivo || '(sin dato)',
    servicio: r.servicio || '(sin dato)',
    impresora: r.impresora || '(sin dato)',
    material: r.material || '(sin dato)',
    estado: r.estado || '(sin dato)',
    resultado: r.resultado || '(en curso)',
    gramos: num(r.gramos),
    horas: parsearHoras(r.tiempoHoras),
    desperdicio: num(r.desperdicio),
  }));

  const fil: FilamentoDash[] = filamentos.map((f) => ({
    id: f.id, tipo: String(f.tipo), color: f.color, marca: f.marca,
    gramos: f.gramosRestantes, umbral: umbralDeFilamento(f, umbrales),
  }));

  return {
    generado: hoy, esDemo: esModoDemo(),
    solicitudes: sol, historial: hist, filamentos: fil,
    impresoras, mantenimientos,
  };
}
