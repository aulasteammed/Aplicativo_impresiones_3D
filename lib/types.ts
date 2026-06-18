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
  nombreProyecto: string;
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

export interface Mantenimiento {
  fecha: string;
  impresoraId: string;
  tipo: 'preventivo' | 'correctivo' | 'consumible' | 'repuesto' | string;
  descripcion: string;
  costo?: number;
  responsable: string;
}

export interface AlertaStock {
  tipo: string;
  color: string;
  filamentoId: string;
  gramosRestantes: number;
  umbral: number;
}

export interface DashboardData {
  solicitudesNuevas: number;
  solicitudesTotal: number;
  solicitudesEnRevision: number;
  proyectosActivos: Proyecto[];
  tasaExito: number | null; // % de impresiones exitosas (null si no hay datos)
  totalFinalizadas: number;
  desperdicioTotal: number;
  materialConsumidoMes: number;
  tiempoPorImpresora: { impresora: string; horas: number }[];
  alertasStock: AlertaStock[];
  proximasEntregas: { nombre: string; pieza: string; fecha: string; estado: string }[];
  esDemo: boolean;
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
