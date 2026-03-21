import { GoogleGenAI } from "@google/genai";
import { Alumno, EvaluacionFisica, Reserva } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeStudentProgress = async (
  student: Alumno,
  evaluations: EvaluacionFisica[],
  reservations: Reserva[]
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Error: API Key no configurada. Por favor, configure la variable de entorno.";
  }

  const prompt = `
    Actúa como un entrenador experto de Pilates.
    Analiza los siguientes datos de un alumno y genera un reporte breve (máximo 100 palabras) en español.
    
    Alumno: ${student.nombre}
    Patología: ${student.patologia_principal}
    
    Historial de Evaluaciones Físicas (Orden cronológico):
    ${evaluations.map(e => `- Fecha: ${e.fecha_evaluacion}, Peso: ${e.peso_kg}kg, Grasa: ${e.porcentaje_grasa}%, Músculo: ${e.porcentaje_muscular}%, Comentarios: ${e.comentarios_instructor}`).join('\n')}
    
    Asistencia a clases: ${reservations.filter(r => r.asistio).length} clases asistidas.
    
    Enfócate en el progreso físico, la adherencia al programa y recomendaciones futuras. Sé motivador pero profesional.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No se pudo generar el análisis.";
  } catch (error) {
    console.error("Error generating analysis:", error);
    return "Ocurrió un error al analizar los datos del alumno.";
  }
};