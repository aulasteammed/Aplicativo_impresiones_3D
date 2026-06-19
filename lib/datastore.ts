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
} from './types';
import { num, parsearHoras, hoyISO, normalizarTexto, coincideAprox, distanciaLevenshtein } from './util';
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
 * Finaliza una cama de impresión:
 * 1. Actualiza Resultado / Desperdicio / Comentarios / Estado=Finalizada en
 *    TODAS las filas de la cama en el Sheets de Historial.
 * 2. Descuenta el inventario de filamento:
 *    - Exitoso  → gramos estimados por ítem + desperdicio reportado.
 *    - Fallido  → solo el desperdicio reportado (o los gramos estimados si no se reportó).
 * 3. Suma las horas de impresión a la impresora.
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

  // 1. Historial
  const filas = await b.finalizarProyectoEnHistorial(codigo, resultado, desperdicio ?? '', comentarios);

  // 2. Inventario
  const filamentos = await b.getFilamentos();
  const totalEstimado = filas.reduce((acc, r) => acc + num(r.gramos), 0);

  // El desperdicio se reparte proporcionalmente entre los rollos usados
  for (const r of filas) {
    const filamentoId = r.filamentoId;
    const gramosItem = num(r.gramos);
    const proporcion = totalEstimado > 0 ? gramosItem / totalEstimado : 1 / filas.length;
    const desperdicioItem = (desperdicio ?? 0) * proporcion;

    let aDescontar: number;
    if (resultado === 'Exitoso') {
      aDescontar = gramosItem + desperdicioItem;
    } else {
      aDescontar = desperdicio !== null ? desperdicioItem : gramosItem;
    }
    if (aDescontar <= 0) continue;

    const fil = filamentoId ? filamentos.find((f) => f.id === filamentoId) : undefined;
    if (!fil) {
      if (filamentoId) advertencias.push(`Rollo ${filamentoId} no encontrado en inventario; no se descontó.`);
      else advertencias.push(`El ítem de ${r.nombre} no tiene rollo asignado; no se descontó inventario.`);
      continue;
    }
    fil.gramosRestantes = Math.max(0, fil.gramosRestantes - aDescontar);
    fil.comenzado = true;
    await b.guardarFilamento(fil, false);
    await b.registrarMovimiento({
      fecha: hoyISO(),
      filamentoId: fil.id,
      proyectoCodigo: codigo,
      gramos: -Math.round(aDescontar * 100) / 100,
      motivo: resultado === 'Exitoso' ? 'impresión' : 'desperdicio',
    });
  }

  // 3. Horas de impresora
  const horas = filas.reduce((acc, r) => acc + parsearHoras(r.tiempoHoras), 0);
  if (horas > 0) {
    const impresoras = await b.getImpresoras();
    const imp = impresoras.find((i) => i.nombre === filas[0].impresora || i.id === filas[0].impresora);
    if (imp) {
      imp.horasAcumuladas = Math.round((imp.horasAcumuladas + horas) * 100) / 100;
      await b.guardarImpresora(imp, false);
    }
  }

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
  await backend().registrarMantenimiento(m);
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

export async function crearUmbral(u: Omit<UmbralAlerta, 'id'>): Promise<UmbralAlerta> {
  const b = backend();
  const existentes = await b.getUmbrales();
  let max = 0;
  for (const x of existentes) {
    const n = parseInt(x.id.replace('UMB-', ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  const nuevo: UmbralAlerta = { ...u, id: `UMB-${String(max + 1).padStart(3, '0')}` };
  await b.crearUmbral(nuevo);
  return nuevo;
}

export async function eliminarUmbral(id: string): Promise<void> {
  await backend().eliminarUmbral(id);
}

// --- Dashboard ---------------------------------------------------------------

export async function getDashboard(): Promise<DashboardData> {
  const [solicitudes, historial, filamentos, movimientos, umbrales] = await Promise.all([
    backend().getSolicitudes(),
    backend().getHistorial(),
    backend().getFilamentos(),
    backend().getMovimientos(),
    backend().getUmbrales(),
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
    alertasStock: calcularAlertas(filamentos, umbrales),
    proximasEntregas: pendientes.slice(-8).reverse().map((s) => ({
      nombre: s.nombre, pieza: s.descripcionPieza.slice(0, 80), fecha: s.fechaTentativa, estado: s.estado,
    })),
    esDemo: esModoDemo(),
  };
}
