import { Alumno, Entrenador, Clase, Reserva, EvaluacionFisica, Pago } from '../types';

const generateUUID = () => crypto.randomUUID();

// Basic Reference Data
export const mockEntrenadores: Entrenador[] = [
  { id: generateUUID(), nombre: 'Ana García', email: 'ana@pilates.com', telefono: '+57 310 234 5678', especialidad: 'Reformer', fecha_registro: '2023-01-15T09:00:00Z' },
  { id: generateUUID(), nombre: 'Carlos López', email: 'carlos@pilates.com', telefono: '+57 320 876 5432', especialidad: 'Suelo y Accesorios', fecha_registro: '2023-02-20T09:00:00Z' },
  { id: generateUUID(), nombre: 'Elena Ruiz', email: 'elena@pilates.com', telefono: '+57 315 001 9988', especialidad: 'Rehabilitación', fecha_registro: '2023-03-10T09:00:00Z' },
];

export const mockAlumnos: Alumno[] = [
  { id: generateUUID(), nombre: 'María Rodríguez', email: 'maria@client.com', telefono: '+57 311 456 7890', patologia_principal: 'Lumbalgia', clases_disponibles: 8, fecha_registro: '2023-06-01T10:00:00Z' },
  { id: generateUUID(), nombre: 'Juan Pérez', email: 'juan@client.com', telefono: '+57 300 111 2233', patologia_principal: 'Ninguna', clases_disponibles: 2, fecha_registro: '2023-06-15T10:00:00Z' },
  { id: generateUUID(), nombre: 'Lucía Fernández', email: 'lucia@client.com', telefono: '+57 322 987 6543', patologia_principal: 'Escoliosis', clases_disponibles: 12, fecha_registro: '2023-07-01T10:00:00Z' },
  { id: generateUUID(), nombre: 'Roberto Diaz', email: 'roberto@client.com', telefono: '+57 318 765 4321', patologia_principal: 'Hernia Discal', clases_disponibles: 5, fecha_registro: '2023-08-01T10:00:00Z' },
];

export const mockClases: Clase[] = [
  { id: 1, titulo: 'Pilates Reformer Básico', id_entrenador: mockEntrenadores[0].id, fecha_hora: '2023-10-25T18:00:00Z', cupo_maximo: 6 },
  { id: 2, titulo: 'Pilates Mat Avanzado', id_entrenador: mockEntrenadores[1].id, fecha_hora: '2023-10-26T19:00:00Z', cupo_maximo: 8 },
];

// Data Generators for Historical Context
const generateHistoricalData = () => {
  const reservas: Reserva[] = [];
  const pagos: Pago[] = [];
  const startDate = new Date('2023-01-01');
  const endDate = new Date();
  
  let currentId = 1;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // 60% chance of classes on any given day
    if (Math.random() > 0.4) {
      // Create 1-3 classes worth of reservations per day
      const dailyReservations = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < dailyReservations; i++) {
        // Random student
        const student = mockAlumnos[Math.floor(Math.random() * mockAlumnos.length)];
        // Random class type
        const type = Math.random() > 0.5 ? 'Reformer' : 'Mat';
        
        reservas.push({
          id: currentId++,
          id_alumno: student.id,
          id_clase: Math.floor(Math.random() * 100),
          asistencia_confirmada: true,
          fecha_reserva: new Date(d).toISOString(),
          tipo_clase: type,
          asistio: Math.random() > 0.1 // 90% attendance rate
        });
      }
    }

    // Payments: Generate some payments randomly (approx every 3 days)
    if (Math.random() > 0.7) {
      const student = mockAlumnos[Math.floor(Math.random() * mockAlumnos.length)];
      pagos.push({
        id: generateUUID(),
        id_alumno: student.id,
        referencia_unica: `REF-${d.getTime()}`,
        monto_pesos: Math.random() > 0.5 ? 150000 : 50000,
        cantidad_clases: Math.random() > 0.5 ? 10 : 3,
        estado: 'Aprobado',
        id_transaccion_wompi: `WOM-${d.getTime()}`,
        created_at: new Date(d).toISOString()
      });
    }
  }

  return { reservas, pagos };
};

const historicalData = generateHistoricalData();
export const mockReservas: Reserva[] = historicalData.reservas;
export const mockPagos: Pago[] = historicalData.pagos;

// Generate a realistic coach schedule: 2 months back + 1 month forward
const generateCoachClases = (): Clase[] => {
  const clases: Clase[] = [];
  let id = 100;

  const classTitles: Record<string, string[]> = {
    'Reformer': ['Reformer Básico', 'Reformer Avanzado', 'Reformer para Espalda', 'Reformer Core'],
    'Suelo y Accesorios': ['Mat Pilates', 'Mat Avanzado', 'Pilates con Pelota', 'Pilates con Banda Elástica'],
    'Rehabilitación': ['Rehabilitación Postural', 'Pilates Terapéutico', 'Movilidad y Flexibilidad', 'Corrección Postural'],
  };

  const timeSlots = [9, 11, 14, 17, 19];

  const start = new Date();
  start.setMonth(start.getMonth() - 2);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  end.setDate(28);

  // Each coach has different working days
  const schedules: number[][] = [
    [1, 3, 5],   // Ana: Mon, Wed, Fri
    [2, 4, 6],   // Carlos: Tue, Thu, Sat
    [1, 2, 4],   // Elena: Mon, Tue, Thu
  ];

  mockEntrenadores.forEach((entrenador, coachIdx) => {
    const titles = classTitles[entrenador.especialidad] ?? ['Pilates General'];
    const workDays = schedules[coachIdx] ?? [1, 3, 5];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (!workDays.includes(d.getDay())) continue;

      const numClasses = Math.random() > 0.45 ? 2 : 1;
      const usedSlots: number[] = [];

      for (let i = 0; i < numClasses; i++) {
        let slot: number;
        do { slot = timeSlots[Math.floor(Math.random() * timeSlots.length)]; }
        while (usedSlots.includes(slot));
        usedSlots.push(slot);

        const classDate = new Date(d);
        classDate.setHours(slot, 0, 0, 0);

        clases.push({
          id: id++,
          titulo: titles[Math.floor(Math.random() * titles.length)],
          id_entrenador: entrenador.id,
          fecha_hora: classDate.toISOString(),
          cupo_maximo: Math.random() > 0.5 ? 6 : 8,
        });
      }
    }
  });

  return clases;
};

export const mockCoachClases: Clase[] = generateCoachClases();

export const mockEvaluaciones: EvaluacionFisica[] = [
  {
    id: 1,
    id_alumno: mockAlumnos[0].id,
    id_entrenador: mockEntrenadores[0].id,
    fecha_evaluacion: '2023-06-05',
    peso_kg: 68,
    estatura_cm: 165,
    porcentaje_grasa: 28,
    porcentaje_muscular: 30,
    perimetro_pecho: 95,
    perimetro_cintura: 78,
    perimetro_cadera: 102,
    perimetro_brazo: 28,
    perimetro_muslo: 58,
    comentarios_instructor: 'Inicial. Rigidez en zona lumbar.',
    imc: 24.9,
    indice_cintura_cadera: 0.76
  },
  {
    id: 2,
    id_alumno: mockAlumnos[0].id,
    id_entrenador: mockEntrenadores[0].id,
    fecha_evaluacion: '2023-09-05',
    peso_kg: 65,
    estatura_cm: 165,
    porcentaje_grasa: 25,
    porcentaje_muscular: 32,
    perimetro_pecho: 94,
    perimetro_cintura: 74,
    perimetro_cadera: 100,
    perimetro_brazo: 27,
    perimetro_muslo: 56,
    comentarios_instructor: 'Mejora notable en flexibilidad y fuerza de core.',
    imc: 23.8,
    indice_cintura_cadera: 0.74
  }
];