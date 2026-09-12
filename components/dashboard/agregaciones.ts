// Funciones puras de agregación sobre las filas crudas del Dashboard (solicitudes/historial).

import { canonCategoria, normalizarTexto } from '@/lib/util';
import { DatosDashboard } from '@/lib/types';
import { Fila, Punto } from './tipos';

export const countBy = (arr: Fila[], k: string): Punto[] => {
  const m: Record<string, number> = {};
  arr.forEach((r) => { const v = canonCategoria(k, r[k]); if (v == null) return; m[v] = (m[v] || 0) + 1; });
  return Object.entries(m).map(([l, v]) => ({ l, v }));
};

export const sumBy = (arr: Fila[], k: string, f: string): Punto[] => {
  const m: Record<string, number> = {};
  arr.forEach((r) => { const g = canonCategoria(k, r[k]); if (g == null) return; m[g] = (m[g] || 0) + (+r[f] || 0); });
  return Object.entries(m).map(([l, v]) => ({ l, v }));
};

export const uniqDim = (datos: DatosDashboard, k: string): string[] => {
  const m = new Map<string, string>();
  const add = (raw: any) => { const c = canonCategoria(k, raw); if (c != null) m.set(normalizarTexto(c), c); };
  datos.solicitudes.forEach((r) => add((r as Fila)[k]));
  datos.historial.forEach((r) => add((r as Fila)[k]));
  const a = Array.from(m.values());
  if (k === 'mes') return a.sort();
  // "No aplica" y "Otros" siempre al final; el resto alfabético (locale español).
  const alFinal = (v: string) => (v === 'Otros' ? 2 : v === 'No aplica' ? 1 : 0);
  return a.sort((x, y) => alFinal(x) - alFinal(y) || x.localeCompare(y, 'es'));
};
