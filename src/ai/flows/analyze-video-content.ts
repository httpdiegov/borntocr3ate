'use server';

/**
 * @fileOverview An AI flow to analyze video content and extract viral clips.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';


// Define the schema for the input of the flow
const AnalyzeVideoInputSchema = z.object({
  transcription: z.string().describe('The full transcription of the video.'),
});
export type AnalyzeVideoInput = z.infer<typeof AnalyzeVideoInputSchema>;

// Define the schema for a single analyzed clip
const AnalyzedClipSchema = z.object({
  id: z.string().describe('A unique identifier for the clip.'),
  title: z.string().describe('A short, catchy title for the clip.'),
  summary: z.string().describe('A summary of the clip content.'),
  timestamp: z.string().describe('The time range of the clip in "MM:SS - MM:SS" format.'),
  viralityScore: z.number().min(1).max(10).describe('A score from 1-10 on the clip\'s viral potential.'),
});
export type AnalyzedClip = z.infer<typeof AnalyzedClipSchema>;


// Define the schema for the output of the flow
const AnalyzeVideoOutputSchema = z.object({
  clips: z.array(AnalyzedClipSchema).describe('A list of the most interesting clips found in the video.'),
});
export type AnalyzeVideoOutput = z.infer<typeof AnalyzeVideoOutputSchema>;


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
  `
});


const analyzeVideoContentFlow = ai.defineFlow(
  {
    name: 'analyzeVideoContentFlow',
    inputSchema: AnalyzeVideoInputSchema,
    outputSchema: AnalyzeVideoOutputSchema,
  },
  async (input) => {
    console.log("Analizando transcripción para encontrar clips...");
    
    const { output } = await videoAnalysisPrompt(input);

    if (!output || !Array.isArray(output.clips)) {
        console.error("La respuesta de la IA no fue válida o no contenía clips:", output);
        throw new Error("La IA no pudo generar ningún clip con el formato esperado.");
    }
    
    // Sort clips by virality score descending
    output.clips.sort((a: AnalyzedClip, b: AnalyzedClip) => b.viralityScore - a.viralityScore);

    console.log(`Análisis completo. Se encontraron ${output.clips.length} clips.`);
    return output;
  }
);


export async function analyzeVideoContent(input: AnalyzeVideoInput): Promise<AnalyzeVideoOutput> {
  return analyzeVideoContentFlow(input);
}