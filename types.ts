export interface Alumno {
  id: string; // uuid
  nombre: string;
  email: string;
  telefono?: string; // mapped from DB field "celular"
  patologia_principal: string;
  clases_disponibles: number;
  fecha_registro: string; // timestamptz
  fecha_vencimiento?: string | null;
}

export interface Entrenador {
  id: string; // uuid
  nombre: string;
  email: string;
  telefono?: string; // mapped from DB field "celular"
  especialidad: string;
  fecha_registro: string; // timestamptz
}

export interface Clase {
  id: number;
  titulo: string;
  id_entrenador: string; // uuid
  fecha_hora: string; // timestamptz
  cupo_maximo: number;
}

export interface Reserva {
  id: number;
  id_alumno: string; // uuid
  id_clase: number;
  asistencia_confirmada: boolean;
  fecha_reserva: string; // timestamptz
  tipo_clase: string;
  asistio: boolean;
}

export interface EvaluacionFisica {
  id: number;
  id_alumno: string; // uuid
  peso_kg: number;
  estatura_cm: number;
  porcentaje_grasa: number;
  porcentaje_muscular: number;
  perimetro_pecho: number;
  perimetro_cintura: number;
  perimetro_cadera: number;
  perimetro_brazo: number;
  perimetro_muslo: number;
  comentarios_instructor: string;
  fecha_evaluacion: string; // date
  id_entrenador: string; // uuid
  imc: number;
  indice_cintura_cadera: number;
}

export interface Pago {
  id: string; // uuid
  id_alumno: string; // uuid
  referencia_unica: string;
  monto_pesos: number;
  cantidad_clases: number;
  estado: string; // 'PENDING' | 'APPROVED' | 'REJECTED' etc.
  id_transaccion_wompi: string | null;
  created_at: string; // timestamptz
  vigencia_dias?: number;
}

export interface VideoApoyo {
  id: number;
  titulo: string;
  descripcion: string;
  url_video: string;
  patologia_objetivo: string;
  fecha_subida: string;
  duracion_minutos: number;
}