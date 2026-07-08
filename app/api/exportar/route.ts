import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getSolicitudes, getProyectos, getHistorial, getFilamentos, getMantenimientos } from '@/lib/datastore';
import { esCamaEnCurso, fechaISO, fechaDeCodigoCama, hoyISO } from '@/lib/util';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Seleccion = {
  solicitudes?: boolean; camas?: boolean; historial?: boolean; filamentos?: boolean; mantenimiento?: boolean;
  /** Rango de fechas opcional (YYYY-MM-DD). Vacío = sin límite. */
  desde?: string; hasta?: string;
};

/** Genera un .xlsx con una hoja por cada conjunto de datos seleccionado. */
export async function POST(req: NextRequest) {
  try {
    const sel = (await req.json()) as Seleccion;
    if (!sel.solicitudes && !sel.camas && !sel.historial && !sel.filamentos && !sel.mantenimiento) {
      return NextResponse.json({ error: 'Selecciona al menos un conjunto de datos para exportar' }, { status: 400 });
    }

    const desde = fechaISO(sel.desde);
    const hasta = fechaISO(sel.hasta);
    if (desde && hasta && desde > hasta) {
      return NextResponse.json({ error: 'La fecha inicial no puede ser posterior a la final' }, { status: 400 });
    }
    // Una fila entra si su fecha cae dentro del rango. Si no hay fecha interpretable,
    // solo entra cuando no se definió ningún límite (exportar todo).
    const enRango = (valor: string): boolean => {
      const d = fechaISO(valor);
      if (!d) return !desde && !hasta;
      return (!desde || d >= desde) && (!hasta || d <= hasta);
    };

    // Convierte a número REAL los valores numéricos (así Excel no los marca como
    // "número almacenado como texto"). Tolera la coma decimal y los separadores de
    // miles del formato colombiano (p. ej. "267,18" → 267.18). Deja '' en los vacíos
    // y conserva el texto no numérico. No se aplica al celular, que debe ser texto.
    const numero = (v: unknown): number | string => {
      if (v === '' || v == null) return '';
      if (typeof v === 'number') return v;
      const s = String(v).trim();
      if (s === '') return '';
      const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
      const n = parseFloat(norm);
      return Number.isFinite(n) ? n : s;
    };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Aula STEAM · Impresión 3D';

    const hoja = (nombre: string, columnas: string[], filas: (string | number)[][]) => {
      const ws = wb.addWorksheet(nombre);
      ws.addRow(columnas);
      const cab = ws.getRow(1);
      cab.font = { bold: true };
      cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
      filas.forEach((f) => ws.addRow(f));
      columnas.forEach((c, i) => { ws.getColumn(i + 1).width = Math.min(48, Math.max(12, c.length + 2)); });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    };

    if (sel.solicitudes) {
      const s = (await getSolicitudes()).filter((x) => enRango(x.marcaTemporal));
      hoja('Solicitudes',
        ['Marca temporal', 'Nombre', 'Correo', 'Celular', 'Rol', 'Programa', 'Motivo', 'Servicio', 'Descripción', 'Objetivo', 'Fecha tentativa', 'Estado'],
        s.map((x) => [x.marcaTemporal, x.nombre, x.correo, x.celular, x.rol, x.programa, x.motivo, x.servicio, x.descripcionPieza, x.objetivoPieza, x.fechaTentativa, x.estado]));
    }
    if (sel.camas) {
      const camas = (await getProyectos()).filter((c) => esCamaEnCurso(c.estado) && enRango(fechaDeCodigoCama(c.codigo)));
      const filas: (string | number)[][] = [];
      camas.forEach((c) => c.items.forEach((it) => filas.push(
        [c.codigo, c.impresora, c.estado, it.nombre, it.correo, it.descripcionPieza, numero(it.tiempoHoras), numero(it.gramos), it.material, it.filamentoId ?? ''],
      )));
      hoja('Camas de impresión',
        ['Código', 'Impresora', 'Estado', 'Solicitante', 'Correo', 'Pieza', 'Tiempo (h)', 'Gramos', 'Material', 'Filamento ID'], filas);
    }
    if (sel.historial) {
      // Filtra por la fecha de CREACIÓN de la cama (codificada en el código
      // IMP-DDMMAA-NN), que refleja cuándo se imprimió, no la marca temporal de la
      // solicitud original.
      const h = (await getHistorial()).filter((r) => !esCamaEnCurso(r.estado) && enRango(fechaDeCodigoCama(r.codigo)));
      hoja('Historial',
        ['Código', 'Marca temporal', 'Solicitante', 'Correo', 'Impresora', 'Tiempo (h)', 'Gramos', 'Material', 'Estado', 'Resultado', 'Desperdicio', 'Filamento ID'],
        h.map((x) => [x.codigo, x.marcaTemporal, x.nombre, x.correo, x.impresora, numero(x.tiempoHoras), numero(x.gramos), x.material, x.estado, x.resultado, numero(x.desperdicio), x.filamentoId]));
    }
    if (sel.filamentos) {
      const f = (await getFilamentos()).filter((x) => enRango(x.fechaRegistro));
      hoja('Filamentos',
        ['ID', 'Tipo', 'Color', 'Marca', 'Rollos', 'Comenzado', 'Gramos restantes', 'Fecha registro', 'Notas'],
        f.map((x) => [x.id, String(x.tipo), x.color, x.marca, numero(x.rollos), x.comenzado ? 'Sí' : 'No', numero(x.gramosRestantes), x.fechaRegistro, x.notas]));
    }
    if (sel.mantenimiento) {
      const m = (await getMantenimientos()).filter((x) => enRango(x.fecha));
      hoja('Mantenimiento',
        ['Fecha', 'Impresora ID', 'Tipo', 'Descripción', 'Costo (COP)', 'Responsable', 'Programación', 'Próxima fecha', 'Cada N horas', 'Horas base'],
        m.map((x) => [x.fecha, x.impresoraId, x.tipo, x.descripcion, numero(x.costo), x.responsable, x.programacion ?? '', x.proximaFecha ?? '', numero(x.cadaHoras), numero(x.horasBase)]));
    }

    const periodo = desde || hasta ? `-${desde || 'inicio'}_a_${hasta || hoyISO()}` : `-${hoyISO()}`;
    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Aula-STEAM-datos${periodo}.xlsx"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
