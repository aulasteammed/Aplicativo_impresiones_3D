'use client';

// Ventana 1 — Dashboard interactivo: filtra por mes/rol/programa/motivo/servicio
// y todo el tablero se recalcula. Datos en vivo de /api/dashboard/datos.
// Cada sección numerada vive en components/dashboard/Seccion*.tsx; este archivo
// trae los datos, mantiene el estado de filtros y calcula las agregaciones
// compartidas entre secciones (ver `derivado`).

import { useMemo, useState } from 'react';
import { Aviso, BotonRecargar, useDatos } from '@/components/ui';
import { canonCategoria, calcularAlertasMantenimiento, horasAlUltimoMantenimiento } from '@/lib/util';
import { DatosDashboard, Impresora, Mantenimiento } from '@/lib/types';
import { countBy, sumBy, uniqDim } from '@/components/dashboard/agregaciones';
import { deltaMensual } from '@/components/dashboard/comparacion';
import { DIMS, mesCorto } from '@/components/dashboard/constantes';
import { FiltroMes, FiltroMulti, useCerrarAlClicFuera } from '@/components/dashboard/filtros';
import { ModalExportar } from '@/components/dashboard/ModalExportar';
import { IconoDescarga } from '@/components/Iconos';
import { SeccionEstadoActual } from '@/components/dashboard/SeccionEstadoActual';
import { SeccionDemanda } from '@/components/dashboard/SeccionDemanda';
import { SeccionProduccion } from '@/components/dashboard/SeccionProduccion';
import { SeccionMantenimiento } from '@/components/dashboard/SeccionMantenimiento';
import { SeccionCostosMantenimiento } from '@/components/dashboard/SeccionCostosMantenimiento';
import { Cama, Fila, ImpresoraVista, StockFilamento } from '@/components/dashboard/tipos';

export default function Dashboard() {
  const { datos, cargando, error, recargar } = useDatos<DatosDashboard>('/api/dashboard/datos');
  const [filtros, setFiltros] = useState<Record<string, Set<string>>>({});
  const [abierto, setAbierto] = useState<string | null>(null);
  const [exportar, setExportar] = useState(false);
  const barraRef = useCerrarAlClicFuera(setAbierto);

  const setDim = (dim: string) => (next: Set<string> | null) =>
    setFiltros((prev) => { const c = { ...prev }; if (next == null) delete c[dim]; else c[dim] = next; return c; });

  const pasa = (r: Fila) => {
    // Un conjunto vacío (todo desmarcado / "Ninguno") NO muestra nada de esa
    // categoría — lo que se ve marcado es lo que se muestra. Solo la ausencia de
    // filtro (dimensión no presente) equivale a "todos".
    for (const d in filtros) { const s = filtros[d]; if (s && !s.has(canonCategoria(d, r[d]) as string)) return false; }
    return true;
  };

  const opciones = useMemo(() => {
    const o: Record<string, string[]> = {};
    if (datos) for (const [k] of DIMS) o[k] = uniqDim(datos, k);
    return o;
  }, [datos]);

  const sol = useMemo(() => (datos?.solicitudes ?? []).filter(pasa), [datos, filtros]);
  const hist = useMemo(() => (datos?.historial ?? []).filter(pasa), [datos, filtros]);

  // TODA la agregación del tablero, memoizada con clave [datos, filtros] (vía
  // sol/hist): abrir/cerrar un popover o el modal de exportar ya no la recalcula;
  // solo un dato nuevo o un cambio de filtros lo hace.
  const derivado = useMemo(() => {
    if (!datos) return null;

    // ── Sección 1 · Estado actual — datos SIN filtrar. Es una foto "en vivo" del
    // presente (igual que la sección 4): una cama que imprime AHORA debe verse
    // aunque el filtro de mes apunte a otro mes (el mes de una cama es el de su
    // creación, no el de su actividad).
    const solTodo: Fila[] = datos.solicitudes;
    const histTodo: Fila[] = datos.historial;
    const estVivo: Record<string, number> = {};
    ['Nueva', 'En Revisión', 'Aprobada', 'Rechazada', 'Atendida'].forEach((e) => {
      estVivo[e] = solTodo.filter((s) => s.estado === e).length;
    });
    const vencidas = solTodo.filter((s) => s.vencida).length;
    const aprob = estVivo['Aprobada'] + estVivo['Atendida'];
    const resueltas = aprob + estVivo['Rechazada'];

    // Camas en curso AGRUPADAS por código: una cama con N piezas produce N filas con el
    // mismo estado e impresora, así que se cuentan camas distintas (no filas); los
    // gramos/horas suman las piezas de cada cama.
    const camasMap = new Map<string, Cama>();
    histTodo.forEach((h) => {
      if (!h.codigo) return; // filas sin código no forman una cama (igual que la ventana Camas)
      // La ventana Camas (agruparProyectos) trata un estado vacío como 'Activa'; se
      // replica aquí para que los conteos del tablero coincidan exactamente con ella.
      const estado = h.estado === '(sin dato)' ? 'Activa' : h.estado;
      if (estado !== 'Activa' && estado !== 'En pausa') return; // Finalizada u otro: no es cama en curso
      const cod = h.codigo;
      const c = camasMap.get(cod) ?? { codigo: cod, estado, impresora: h.impresora, materiales: new Set<string>(), gramos: 0, horas: 0, piezas: 0 };
      c.gramos += +h.gramos || 0;
      c.horas += +h.horas || 0;
      c.piezas += 1;
      if (h.material && h.material !== '(sin dato)') c.materiales.add(h.material);
      camasMap.set(cod, c);
    });
    const camas = Array.from(camasMap.values());
    const nActivas = camas.filter((c) => c.estado === 'Activa').length;
    const nPausa = camas.filter((c) => c.estado === 'En pausa').length;
    const gCurso = camas.reduce((a, c) => a + c.gramos, 0);
    const hCurso = camas.reduce((a, c) => a + c.horas, 0);
    const camLista = [...camas].sort((a, b) => b.horas - a.horas).slice(0, 8);

    // ── Secciones 2 y 3 — responden a los filtros (sol/hist filtrados) ──
    const meses = opciones.mes ?? [];
    const porMes = (arr: Fila[]) => meses.map((mm) => ({ ...mesCorto(mm), v: arr.filter((r) => r.mes === mm).length }));
    const porMesSol = porMes(sol);
    const porMesHist = porMes(hist);

    const fin = hist.filter((h) => h.resultado === 'Exitoso' || h.resultado === 'Fallido');
    const exito = fin.length ? `${Math.round((fin.filter((h) => h.resultado === 'Exitoso').length / fin.length) * 100)}%` : '—';
    // Los KPIs de producción suman SOLO impresiones finalizadas ("total impreso" /
    // "acumuladas"): lo montado en camas en curso vive en la sección 1 ("en curso").
    const matUsado = fin.reduce((a, h) => a + h.gramos, 0);
    const horasImpresion = fin.reduce((a, h) => a + h.horas, 0);
    const desperdicioTotal = fin.reduce((a, h) => a + h.desperdicio, 0);

    // Delta de la Sección 3 (mes actual vs. mes anterior): SIEMPRE sobre el
    // historial completo sin filtrar (igual criterio "en vivo" que la Sección 1),
    // para que la comparación no dependa de qué mes(es) tenga marcado el filtro.
    const mesesConHistorial = Array.from(new Set(histTodo.map((h) => h.mes))).filter(Boolean).sort();
    const mesUlt = mesesConHistorial[mesesConHistorial.length - 1];
    const mesAnt = mesesConHistorial[mesesConHistorial.length - 2];
    const finalizadasDelMes = (mm: string | undefined) =>
      mm ? histTodo.filter((h) => h.mes === mm && (h.resultado === 'Exitoso' || h.resultado === 'Fallido')) : [];
    const finUlt = finalizadasDelMes(mesUlt);
    const finAnt = finalizadasDelMes(mesAnt);
    const exitoPct = (arr: Fila[]) => (arr.length ? (arr.filter((h) => h.resultado === 'Exitoso').length / arr.length) * 100 : 0);
    const sumaDe = (arr: Fila[], campo: string) => arr.reduce((a: number, h: Fila) => a + (+h[campo] || 0), 0);
    const deltaExito = mesAnt ? deltaMensual(exitoPct(finUlt), exitoPct(finAnt), 'positivo') : null;
    const deltaMatUsado = mesAnt ? deltaMensual(sumaDe(finUlt, 'gramos'), sumaDe(finAnt, 'gramos'), 'neutro') : null;
    const deltaHorasImpresion = mesAnt ? deltaMensual(sumaDe(finUlt, 'horas'), sumaDe(finAnt, 'horas'), 'neutro') : null;
    const deltaDesperdicio = mesAnt ? deltaMensual(sumaDe(finUlt, 'desperdicio'), sumaDe(finAnt, 'desperdicio'), 'negativo') : null;

    // Top solicitantes
    const pp: Record<string, number> = {};
    sol.forEach((s) => { pp[s.nombre] = (pp[s.nombre] || 0) + 1; });
    const top = Object.entries(pp).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const porRol = countBy(sol, 'rol');
    const porMotivo = countBy(sol, 'motivo');
    const porPrograma = countBy(sol, 'programa');
    const porServicio = countBy(sol, 'servicio');
    const horasPorImpresora = sumBy(hist, 'impresora', 'horas');
    const materialPorTipo = sumBy(hist, 'material', 'gramos');
    const porResultado = countBy(hist, 'resultado');

    // ── Sección 4 — mantenimiento (independiente de filtros: estado de los equipos) ──
    const alertasMant = calcularAlertasMantenimiento(datos.impresoras, datos.mantenimientos, datos.generado);
    const planDe = (id: string): Mantenimiento | null =>
      datos.mantenimientos.filter((m) => m.impresoraId === id && m.programacion && m.programacion !== 'ninguna')
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0] || null;
    const vistaImp = (imp: Impresora): ImpresoraVista => {
      const al = alertasMant.find((a) => a.impresoraId === imp.id);
      const p = planDe(imp.id);
      let valor = '—', sub = 'sin mantenimiento programado', ratio = 0;
      if (p && p.programacion === 'horas' && p.cadaHoras) {
        // Se cuenta desde el último mantenimiento de cualquier tipo (no solo el programado).
        const desde = Math.max(0, Math.round((imp.horasAcumuladas - horasAlUltimoMantenimiento(imp.id, datos.mantenimientos)) * 10) / 10);
        ratio = desde / p.cadaHoras; valor = `${desde} / ${p.cadaHoras} h`; sub = `cada ${p.cadaHoras} h de uso`;
      } else if (p && p.programacion === 'fecha' && p.proximaFecha) {
        valor = p.proximaFecha; sub = al ? (al.estado === 'vencido' ? 'vencido' : 'próximo') : 'programado';
        ratio = al ? (al.estado === 'vencido' ? 1 : 0.9) : 0.5;
      }
      return { imp, al, valor, sub, ratio };
    };
    const impVistas = datos.impresoras.map(vistaImp).sort((a, b) => b.ratio - a.ratio);
    const oper = datos.impresoras.filter((i) => i.estado === 'Operativa').length;
    const noDisp = datos.impresoras.length - oper;
    const req = alertasMant.filter((a) => a.estado === 'vencido').length;
    const prox = alertasMant.filter((a) => a.estado === 'proximo').length;
    const rollosBajos = datos.filamentos.filter((f) => f.umbral > 0 && f.gramos <= f.umbral).length;
    const stock: StockFilamento[] = datos.filamentos.filter((f) => f.umbral > 0 && f.gramos <= f.umbral * 1.2)
      .map((f) => ({ ...f, ratio: f.gramos / f.umbral })).sort((a, b) => a.ratio - b.ratio).slice(0, 8);

    return {
      estVivo, vencidas, aprob, resueltas, camas, nActivas, nPausa, gCurso, hCurso, camLista,
      porMesSol, porMesHist, fin, exito, matUsado, horasImpresion, desperdicioTotal, top,
      deltaExito, deltaMatUsado, deltaHorasImpresion, deltaDesperdicio,
      porRol, porMotivo, porPrograma, porServicio, horasPorImpresora, materialPorTipo, porResultado,
      impVistas, oper, noDisp, req, prox, rollosBajos, stock,
    };
  }, [datos, sol, hist, opciones]);

  if (error) return <Aviso tipo="error">Error cargando el dashboard: {error}</Aviso>;
  if (!datos || !derivado) return <p className="text-sm text-slate-500">Cargando dashboard…</p>;

  const {
    estVivo, vencidas, aprob, resueltas, camas, nActivas, nPausa, gCurso, hCurso, camLista,
    porMesSol, porMesHist, fin, exito, matUsado, horasImpresion, desperdicioTotal, top,
    deltaExito, deltaMatUsado, deltaHorasImpresion, deltaDesperdicio,
    porRol, porMotivo, porPrograma, porServicio, horasPorImpresora, materialPorTipo, porResultado,
    impVistas, oper, noDisp, req, prox, rollosBajos, stock,
  } = derivado;

  const hayFiltros = Object.keys(filtros).length > 0;

  return (
    <div className="dash">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">Filtra por fecha, rol, motivo… y todo el tablero se recalcula al instante</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{datos.solicitudes.length} solicitudes · {datos.historial.length} impresiones</span>
          <button className="btn-secondary inline-flex items-center gap-1.5" onClick={() => setExportar(true)} title="Exportar datos a Excel (.xlsx)">
            <IconoDescarga /> Exportar
          </button>
          <BotonRecargar onClick={recargar} cargando={cargando} />
        </div>
      </div>

      {exportar && <ModalExportar onCerrar={() => setExportar(false)} />}

      {datos.esDemo && (
        <div className="mt-4"><Aviso tipo="info">Modo demo: datos de ejemplo en memoria (sin conexión a Google Sheets).</Aviso></div>
      )}

      {/* Filtros */}
      <div className="filtros mt-4" ref={barraRef}>
        <span className="flab">Filtros</span>
        {DIMS.map(([k, l]) => (
          k === 'mes' ? (
            <FiltroMes
              key={k} opciones={opciones[k] ?? []}
              sel={filtros[k]} abierto={abierto === k}
              onAbrir={() => setAbierto(abierto === k ? null : k)}
              onSet={setDim(k)}
            />
          ) : (
            <FiltroMulti
              key={k} dim={k} label={l} opciones={opciones[k] ?? []}
              sel={filtros[k]} abierto={abierto === k}
              onAbrir={() => setAbierto(abierto === k ? null : k)}
              onSet={setDim(k)}
            />
          )
        ))}
        {hayFiltros && <button className="clr" onClick={() => setFiltros({})}>✕ Limpiar filtros</button>}
      </div>

      <SeccionEstadoActual
        estVivo={estVivo} vencidas={vencidas} aprob={aprob} resueltas={resueltas}
        nActivas={nActivas} nPausa={nPausa} gCurso={gCurso} hCurso={hCurso}
        totalCamas={camas.length} camLista={camLista}
      />

      <SeccionDemanda
        totalSolicitudes={sol.length}
        porMesSol={porMesSol} porRol={porRol} porMotivo={porMotivo}
        porPrograma={porPrograma} porServicio={porServicio} top={top}
      />

      <SeccionProduccion
        finCount={fin.length} exito={exito} matUsado={matUsado} horasImpresion={horasImpresion}
        desperdicioTotal={desperdicioTotal} horasPorImpresora={horasPorImpresora}
        materialPorTipo={materialPorTipo} porResultado={porResultado} porMesHist={porMesHist}
        deltaExito={deltaExito} deltaMatUsado={deltaMatUsado}
        deltaHorasImpresion={deltaHorasImpresion} deltaDesperdicio={deltaDesperdicio}
      />

      <SeccionMantenimiento
        totalImpresoras={datos.impresoras.length} oper={oper} noDisp={noDisp} req={req} prox={prox}
        rollosBajos={rollosBajos} impVistas={impVistas} stock={stock}
        impresoras={datos.impresoras} mantenimientos={datos.mantenimientos}
      />

      <SeccionCostosMantenimiento mantenimientos={datos.mantenimientos} impresoras={datos.impresoras} />
    </div>
  );
}
