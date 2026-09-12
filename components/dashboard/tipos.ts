// Tipos compartidos entre los sub-componentes del Dashboard interactivo.

import { AlertaMantenimiento, FilamentoDash, Impresora } from '@/lib/types';

export type Fila = Record<string, any>;
export type Punto = { l: string; v: number };
/** Punto de una serie mensual ya formateado para <Columnas> (mes corto + año). */
export type PuntoMes = { m: string; y: string; v: number };

/** Una cama de impresión en curso, agrupando las piezas (filas de Historial) que comparten código. */
export type Cama = {
  codigo: string;
  estado: string;
  impresora: string;
  materiales: Set<string>;
  gramos: number;
  horas: number;
  piezas: number;
};

/** Vista de una impresora para la sección de mantenimiento: su alerta (si tiene) y
 *  el progreso hacia el próximo mantenimiento programado. */
export type ImpresoraVista = {
  imp: Impresora;
  al: AlertaMantenimiento | undefined;
  valor: string;
  sub: string;
  ratio: number;
};

/** Rollo de filamento en o cerca de su umbral de reposición, con el ratio ya calculado. */
export type StockFilamento = FilamentoDash & { ratio: number };
