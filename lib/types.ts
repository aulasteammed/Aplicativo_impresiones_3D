// Tipos compartidos de todo el aplicativo

export type EstadoSolicitud = 'Nueva' | 'En Revisión' | 'Aprobada' | 'Rechazada' | 'Atendida';
export type EstadoProyecto = 'Activa' | 'En pausa' | 'Finalizada';
export type ResultadoImpresion = 'Exitoso' | 'Fallido';
export type TipoMaterial = 'PLA' | 'PETG' | 'ABS' | 'TPU' | 'Resina' | 'Otro';

export interface Solicitud {
  /** Clave única: la marca temporal de la respuesta del formulario (ISO string) */
  id: string;
  /** Fila (1-based) en la hoja de respuestas, capturada al leer */
  fila: number;
  marcaTemporal: string;
  nombre: string;
  /** Texto de contacto crudo de la columna C (hoy contiene solo el correo) */
  contacto: string;
  /** Correo electrónico del solicitante (columna C) */
  correo: string;
  /** Número de celular de contacto (columna L) */
  celular: string;
  rol: string;
  programa: string;
  motivo: string;
  servicio: string;
  descripcionPieza: string;
  objetivoPieza: string;
  archivos: string;
  fechaTentativa: string;
  estado: EstadoSolicitud;
}

/** Datos de una solicitud nueva creada desde la app (se escriben directamente en
 *  la hoja de respuestas; columna C = correo, columna L = celular). */
export interface NuevaSolicitud {
  nombre: string;
  correo: string;   // "Correo electrónico" (columna C)
  celular: string;  // "Número de celular de contacto" (columna L)
  rol: string;
  programa: string;
  motivo: string;
  servicio: string;
  descripcionPieza: string;
  objetivoPieza: string;
  fechaTentativa: string; // YYYY-MM-DD
}

export interface ItemProyecto {
  /** Marca temporal de la solicitud original (vínculo con la hoja de respuestas) */
  solicitudId: string;
  nombre: string;
  correo: string;
  descripcionPieza: string;
  tiempoHoras: number;
  gramos: number;
  material: string;
  /** ID del rollo de filamento del inventario asignado (opcional) */
  filamentoId?: string;
}

export interface Proyecto {
  codigo: string;
  nombre: string;
  impresora: string;
  estado: EstadoProyecto;
  resultado?: ResultadoImpresion | '';
  desperdicio?: number;
  comentarios?: string;
  items: ItemProyecto[];
}

export interface RegistroHistorial {
  fila: number;
  marcaTemporal: string;
  codigo: string;
  nombre: string;
  correo: string;
  rol: string;
  programa: string;
  motivo: string;
  servicio: string;
  descripcionPieza: string;
  objetivoPieza: string;
  fechaTentativa: string;
  impresora: string;
  tiempoHoras: string;
  gramos: string;
  material: string;
  estado: string;
  resultado: string;
  desperdicio: string;
  comentarios: string;
  filamentoId: string;
}

export interface Filamento {
  id: string;
  tipo: TipoMaterial | string;
  color: string;
  marca: string;
  rollos: number;
  comenzado: boolean;
  gramosRestantes: number;
  umbralAlerta: number;
  fechaRegistro: string;
  notas: string;
}

export interface MovimientoInventario {
  fecha: string;
  filamentoId: string;
  proyectoCodigo: string;
  gramos: number; // positivo entra, negativo sale
  motivo: 'compra' | 'impresión' | 'desperdicio' | 'ajuste' | string;
}

export interface Impresora {
  id: string;
  nombre: string;
  modelo: string;
  estado: 'Operativa' | 'Mantenimiento' | 'Fuera de servicio' | string;
  horasAcumuladas: number;
  notas: string;
}

/** Cómo se programa el PRÓXIMO mantenimiento a partir de este registro */
export type ProgramacionMantenimiento = 'ninguna' | 'fecha' | 'horas';

/** Naturaleza de la intervención: por qué se hizo (independiente del gasto) */
export type NaturalezaMantenimiento = 'preventivo' | 'correctivo';
/** Categoría del gasto: en qué se gastó (independiente de la naturaleza) */
export type CategoriaGasto = 'consumible' | 'repuesto' | 'servicio' | '';

export interface Mantenimiento {
  fecha: string;
  impresoraId: string;
  /** Naturaleza: preventivo o correctivo (por qué se hizo). */
  naturaleza: NaturalezaMantenimiento | string;
  /** Categoría del gasto: consumible, repuesto, servicio o '' si no hubo compra. */
  categoria: CategoriaGasto | string;
  descripcion: string;
  /** Costo en pesos colombianos (COP). Siempre se maneja en COP. */
  costo?: number;
  responsable: string;
  /** Programación del próximo mantenimiento: sin programar, una fecha, o cada N horas de uso */
  programacion?: ProgramacionMantenimiento;
  /** Fecha programada (YYYY-MM-DD) cuando programacion === 'fecha' */
  proximaFecha?: string;
  /** Intervalo en horas acumuladas de la impresora cuando programacion === 'horas' */
  cadaHoras?: number;
  /** Horas acumuladas de la impresora al registrar (punto de partida del intervalo 'horas').
   *  Se fija automáticamente al crear y NO se edita después. */
  horasBase?: number;
  /** Identificador de fila/índice en el backend, para editar o eliminar el registro.
   *  No se persiste como columna; lo asigna `getMantenimientos` al leer. */
  fila?: number;
}

/** Alerta de mantenimiento pendiente de una impresora (para el apartado 4 del dashboard) */
export interface AlertaMantenimiento {
  impresoraId: string;
  nombre: string;
  motivo: 'horas' | 'fecha';
  estado: 'vencido' | 'proximo';
  horasAcumuladas: number;
  /** Horas transcurridas desde el último mantenimiento (motivo 'horas') */
  horasDesde?: number;
  cadaHoras?: number;
  proximaFecha?: string;
}

export interface AlertaStock {
  tipo: string;
  color: string;
  filamentoId: string;
  gramosRestantes: number;
  umbral: number;
}

/** Variable sobre la que se define un umbral de alerta de stock */
export type VariableUmbral = 'color' | 'marca' | 'tipo';

/** Regla de umbral de alerta: cuando un rollo cuyo {variable} = {valor} cae por
 *  debajo de {umbralGramos}, se marca como stock bajo. */
export interface UmbralAlerta {
  id: string;
  variable: VariableUmbral;
  valor: string;
  umbralGramos: number;
}

/** Alerta AGREGADA por regla: total de filamento del inventario que coincide con
 *  la regla (sin importar las otras características) frente a su umbral. */
export interface AlertaUmbral {
  variable: VariableUmbral;
  valor: string;
  total: number;       // gramos totales en inventario que coinciden con la regla
  umbralGramos: number;
  rollos: number;      // cuántos filamentos contribuyen
  estado: 'debajo' | 'cerca';
}

// --- Datos crudos con forma para el Dashboard interactivo (filtrable) ----------

export interface SolicitudDash {
  mes: string;        // "YYYY-MM" derivado de la marca temporal
  fechaTent: string;
  nombre: string;
  correo: string;
  rol: string;
  programa: string;
  motivo: string;
  servicio: string;
  estado: string;
  vencida: boolean;   // fecha tentativa ya pasó y sigue pendiente
}

export interface HistorialDash {
  mes: string;
  codigo: string;     // código de la cama (para agrupar piezas de una misma cama)
  nombre: string;
  correo: string;
  rol: string;
  programa: string;
  motivo: string;
  servicio: string;
  impresora: string;
  material: string;
  estado: string;
  resultado: string;  // Exitoso | Fallido | (en curso)
  gramos: number;
  horas: number;
  desperdicio: number;
}

export interface FilamentoDash {
  id: string;
  tipo: string;
  color: string;
  marca: string;
  gramos: number;
  umbral: number;     // umbral efectivo (según las reglas de la pestaña Umbrales)
}

export interface DatosDashboard {
  generado: string;   // fecha (YYYY-MM-DD) en que se leyeron los datos
  esDemo: boolean;
  solicitudes: SolicitudDash[];
  historial: HistorialDash[];
  filamentos: FilamentoDash[];
  impresoras: Impresora[];
  mantenimientos: Mantenimiento[];
}

export interface AnalisisSlicerResultado {
  archivo: string;
  pesoGramos: number | null;
  tiempoHoras: number | null;
  tiempoTexto: string | null;
  material: string | null;
  camposNoIdentificados: string[];
  notas: string;
}
