'use server';

/**
 * @fileOverview Un flujo de IA para analizar el contenido de un video y extraer clips virales.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define el esquema para la entrada del flujo
const AnalyzeVideoInputSchema = z.object({
  transcription: z.string().describe('La transcripción completa del video.'),
});
export type AnalyzeVideoInput = z.infer<typeof AnalyzeVideoInputSchema>;

// Define el esquema para un único clip analizado
const AnalyzedClipSchema = z.object({
  id: z.string().describe('Un identificador único para el clip.'),
  title: z.string().describe('Un título corto y atractivo para el clip.'),
  summary: z.string().describe('Un resumen del contenido del clip.'),
  timestamp: z.string().describe('El rango de tiempo del clip en formato "MM:SS - MM:SS".'),
  viralityScore: z.number().min(1).max(10).describe('Una puntuación del 1 al 10 sobre el potencial viral del clip.'),
});
export type AnalyzedClip = z.infer<typeof AnalyzedClipSchema>;


// Define el esquema para la salida del flujo
const AnalyzeVideoOutputSchema = z.object({
  clips: z.array(AnalyzedClipSchema).describe('Una lista de los clips más interesantes encontrados en el video.'),
});
export type AnalyzeVideoOutput = z.infer<typeof AnalyzeVideoOutputSchema>;


// Define el prompt de IA que hará el trabajo pesado
const videoAnalysisPrompt = ai.definePrompt({
    name: 'videoAnalysisPrompt',
    input: { schema: AnalyzeVideoInputSchema },
    output: { schema: AnalyzeVideoOutputSchema },
    prompt: `Eres un experto en redes sociales y edición de video, especializado en identificar momentos virales en contenido largo.
    
    Tu tarea es analizar la siguiente transcripción de un video y extraer de 2 a 4 clips potenciales que sean perfectos para plataformas como TikTok, Instagram Reels o YouTube Shorts.
    
    Para cada clip, debes:
    1.  Crear un título corto y muy atractivo que genere curiosidad.
    2.  Escribir un resumen conciso de lo que trata el clip.
    3.  Estimar un timestamp de inicio y fin (simulado, ya que no tienes el video real).
    4.  Asignarle una "puntuación de viralidad" del 1 al 10, donde 10 es un éxito viral garantizado.
    5.  Asignar un ID único a cada clip.

    Prioriza momentos que contengan:
    - Preguntas provocadoras.
    - Declaraciones audaces o controvertidas.
    - Consejos prácticos y rápidos.
    - Momentos emocionales.
    - "Ganchos" que capturen la atención en los primeros 3 segundos.

    Aquí está la transcripción:
    ---
    {{{transcription}}}
    ---
    `,
});


// Define el flujo que orquesta la llamada al prompt y que será exportado
export const analyzeVideoContent = ai.defineFlow(
  {
    name: 'analyzeVideoContentFlow',
    inputSchema: AnalyzeVideoInputSchema,
    outputSchema: AnalyzeVideoOutputSchema,
  },
  async (input) => {
    console.log("Analizando transcripción para encontrar clips...");
    const { output } = await videoAnalysisPrompt(input);

    if (!output || !output.clips) {
        throw new Error("La IA no pudo generar ningún clip.");
    }
    
    // Ordenar los clips por puntuación de viralidad descendente
    output.clips.sort((a, b) => b.viralityScore - a.viralityScore);

    console.log(`Análisis completo. Se encontraron ${output.clips.length} clips.`);
    return output;
  }
);
