// Fachada única de acceso a datos: decide entre Google Sheets (modo real)
// y el almacén en memoria (modo demo), y contiene los flujos de negocio
// compuestos (finalización de proyectos, descuento de inventario, dashboard).

import { esModoDemo } from './config';
import * as sheets from './google/sheets';
import * as demo from './demo';
import {
  Solicitud, Proyecto, RegistroHistorial, EstadoSolicitud, EstadoProyecto,
  Filamento, MovimientoInventario, Impresora, Mantenimiento,
  ItemProyecto, DashboardData, AlertaStock, ResultadoImpresion,
} from './types';
import { num, parsearHoras, hoyISO } from './util';
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

export async function crearProyecto(nombre: string, impresora: string, items: ItemProyecto[]): Promise<string> {
  const solicitudes = await backend().getSolicitudes();
  return backend().crearProyecto(nombre, impresora, items, solicitudes);
}

export async function agregarItemsProyecto(codigo: string, items: ItemProyecto[]): Promise<void> {
  const solicitudes = await backend().getSolicitudes();
  await backend().agregarItemsProyecto(codigo, items, solicitudes);
}

export async function cambiarEstadoProyecto(codigo: string, estado: EstadoProyecto): Promise<void> {
  await backend().actualizarEstadoProyecto(codigo, estado);
}

/**
 * Finaliza un proyecto de impresión:
 * 1. Actualiza Resultado / Desperdicio / Comentarios / Estado=Finalizada en
 *    TODAS las filas del proyecto en el Sheets de Historial.
 * 2. Marca las solicitudes asociadas como "Atendida" en la hoja de respuestas.
 * 3. Descuenta el inventario de filamento:
 *    - Exitoso  → gramos estimados por ítem + desperdicio reportado.
 *    - Fallido  → solo el desperdicio reportado (o los gramos estimados si no se reportó).
 * 4. Suma las horas de impresión a la impresora.
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

  // 2. Solicitudes → Atendida
  const solicitudes = await b.getSolicitudes();
  for (const r of filas) {
    const sol = solicitudes.find((s) => s.id === r.marcaTemporal);
    if (sol) {
      try {
        await b.actualizarEstadoSolicitud(sol.id, sol.fila, 'Atendida');
      } catch (e) {
        advertencias.push(`No se pudo marcar como Atendida la solicitud de ${sol.nombre}: ${(e as Error).message}`);
      }
    } else if (r.marcaTemporal) {
      advertencias.push(`La solicitud con marca temporal "${r.marcaTemporal}" no se encontró en la hoja de respuestas.`);
    }
  }

  // 3. Inventario
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

  // 4. Horas de impresora
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

export async function crearFilamento(fil: Omit<Filamento, 'id'>): Promise<Filamento> {
  const b = backend();
  const existentes = await b.getFilamentos();
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
  return nuevo;
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

/** Alertas de stock bajo: agregado por tipo+color contra el umbral por rollo */
export function calcularAlertas(filamentos: Filamento[]): AlertaStock[] {
  return filamentos
    .filter((f) => f.umbralAlerta > 0 && f.gramosRestantes <= f.umbralAlerta)
    .map((f) => ({
      tipo: f.tipo, color: f.color, filamentoId: f.id,
      gramosRestantes: f.gramosRestantes, umbral: f.umbralAlerta,
    }));
}

// --- Dashboard ---------------------------------------------------------------

export async function getDashboard(): Promise<DashboardData> {
  const [solicitudes, historial, filamentos, movimientos] = await Promise.all([
    backend().getSolicitudes(),
    backend().getHistorial(),
    backend().getFilamentos(),
    backend().getMovimientos(),
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
    alertasStock: calcularAlertas(filamentos),
    proximasEntregas: pendientes.slice(-8).reverse().map((s) => ({
      nombre: s.nombre, pieza: s.descripcionPieza.slice(0, 80), fecha: s.fechaTentativa, estado: s.estado,
    })),
    esDemo: esModoDemo(),
  };
}
