import { supabase } from './supabaseClient';
import { Alumno, Entrenador, Clase, Reserva, Pago, EvaluacionFisica } from '../types';

// --- Helpers ---
// The DB stores the phone field as "celular"; we expose it as "telefono" in our types.
const mapAlumno = (row: any): Alumno => ({ ...row, telefono: row.celular ?? undefined });
const mapEntrenador = (row: any): Entrenador => ({ ...row, telefono: row.celular ?? undefined });

// --- Alumnos ---
export const fetchAlumnos = async (): Promise<Alumno[]> => {
  const { data, error } = await supabase
    .from('alumnos')
    .select('*')
    .order('fecha_registro', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAlumno);
};

export const updateAlumno = async (
  id: string,
  updates: { nombre: string; email: string; telefono: string; patologia_principal: string }
): Promise<void> => {
  const { error } = await supabase
    .from('alumnos')
    .update({ nombre: updates.nombre, email: updates.email, celular: updates.telefono, patologia_principal: updates.patologia_principal })
    .eq('id', id);
  if (error) throw error;
};

export const deleteAlumno = async (id: string): Promise<void> => {
  const { error } = await supabase.from('alumnos').delete().eq('id', id);
  if (error) throw error;
};

// --- Entrenadores ---
export const fetchEntrenadores = async (): Promise<Entrenador[]> => {
  const { data, error } = await supabase
    .from('entrenadores')
    .select('*')
    .order('fecha_registro', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapEntrenador);
};

export const updateEntrenador = async (
  id: string,
  updates: { nombre: string; email: string; telefono: string; especialidad: string }
): Promise<void> => {
  const { error } = await supabase
    .from('entrenadores')
    .update({ nombre: updates.nombre, email: updates.email, celular: updates.telefono || null, especialidad: updates.especialidad })
    .eq('id', id);
  if (error) throw error;
};

export const deleteEntrenador = async (id: string): Promise<void> => {
  const { error } = await supabase.from('entrenadores').delete().eq('id', id);
  if (error) throw error;
};

export const createEntrenador = async (
  data: { nombre: string; email: string; password: string; telefono: string; especialidad: string }
): Promise<Entrenador> => {
  const { data: result, error } = await supabase.functions.invoke('create-entrenador', {
    body: data,
  });
  if (error) throw error;
  return mapEntrenador(result);
};

// --- Clases ---
export const fetchClases = async (): Promise<Clase[]> => {
  const { data, error } = await supabase
    .from('clases')
    .select('*')
    .order('fecha_hora', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const createClase = async (clase: Omit<Clase, 'id'>): Promise<Clase> => {
  const { data, error } = await supabase
    .from('clases')
    .insert(clase)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateClase = async (id: number, updates: Omit<Clase, 'id'>): Promise<void> => {
  const { error } = await supabase.from('clases').update(updates).eq('id', id);
  if (error) throw error;
};

export const deleteClase = async (id: number): Promise<void> => {
  const { error } = await supabase.from('clases').delete().eq('id', id);
  if (error) throw error;
};

// --- Reservas ---
export const fetchReservas = async (): Promise<Reserva[]> => {
  const { data, error } = await supabase
    .from('reservas')
    .select('*')
    .order('fecha_reserva', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

// --- Pagos ---
export const fetchPagos = async (): Promise<Pago[]> => {
  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

// --- Evaluaciones Físicas ---
export const fetchEvaluaciones = async (): Promise<EvaluacionFisica[]> => {
  const { data, error } = await supabase
    .from('evaluaciones_fisicas')
    .select('*')
    .order('fecha_evaluacion', { ascending: true });
  if (error) throw error;
  return data ?? [];
};
