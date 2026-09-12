// Comparación mes-actual-vs-mes-anterior para los KPI de la Sección 3 (Producción).
// Es INDEPENDIENTE de los filtros activos (mismo criterio que la Sección 1 "En
// vivo"): siempre compara los dos últimos meses con datos en el historial
// completo, y lo dice explícitamente en el texto para que no se confunda con
// una cifra "según los filtros".

export type Tono = 'good' | 'bad' | 'mut';
export type Delta = { texto: string; tono: Tono };

/** `direccion` indica qué sentido del cambio es "bueno" para ESTA métrica:
 *  'positivo' → subir es bueno (ej. tasa de éxito), 'negativo' → subir es malo
 *  (ej. desperdicio), 'neutro' → un volumen mayor no es ni bueno ni malo por sí
 *  solo (ej. gramos de material usado). */
export function deltaMensual(actual: number, previo: number, direccion: 'positivo' | 'negativo' | 'neutro'): Delta | null {
  if (previo === 0 && actual === 0) return null;
  if (previo === 0) return { texto: 'nuevo vs. mes anterior', tono: 'mut' };
  const cambio = Math.round(((actual - previo) / previo) * 100);
  if (cambio === 0) return { texto: '· sin cambio vs. mes anterior', tono: 'mut' };
  const flecha = cambio > 0 ? '▲' : '▼';
  const tono: Tono = direccion === 'neutro' ? 'mut' : (cambio > 0) === (direccion === 'positivo') ? 'good' : 'bad';
  return { texto: `${flecha} ${Math.abs(cambio)}% vs. mes anterior`, tono };
}
