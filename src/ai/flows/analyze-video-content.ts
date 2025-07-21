
'use server';

/**
 * @fileOverview An AI flow to analyze video content, identify speakers and their locations, and extract viral clips.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';


// Define the schema for a speaker identified in the video
const SpeakerSchema = z.object({
  id: z.string().describe('A unique identifier for the speaker (e.g., "orador_1").'),
  description: z.string().describe('A brief description of the speaker (e.g., "man with glasses on the left").'),
  position: z.enum(['izquierda', 'derecha', 'centro', 'desconocido']).describe('The speaker\'s general position in the frame.'),
});
export type Speaker = z.infer<typeof SpeakerSchema>;

// Define the schema for a segment of the transcription
const TranscriptionSegmentSchema = z.object({
  speakerId: z.string().describe('The ID of the speaker for this segment.'),
  text: z.string().describe('The transcribed text for this segment.'),
  startTime: z.number().describe('Start time of the segment in seconds.'),
  endTime: z.number().describe('End time of the segment in seconds.'),
});

// Define the schema for the input of the flow
const AnalyzeVideoInputSchema = z.object({
  publicUrl: z.string().url().describe('The public HTTPS URL of the video file.'),
  contentType: z.string().describe('The MIME type of the video file (e.g., "video/mp4").'),
});
export type AnalyzeVideoInput = z.infer<typeof AnalyzeVideoInputSchema>;

// Define the schema for a single analyzed clip
const AnalyzedClipSchema = z.object({
  id: z.string().describe('A unique identifier for the clip.'),
  title: z.string().describe('A short, catchy title for the clip.'),
  summary: z.string().describe('A summary of the clip content.'),
  startTime: z.number().describe('Start time of the clip in seconds.'),
  endTime: z.number().describe('End time of the clip in seconds.'),
  mainSpeakerId: z.string().describe('The ID of the main speaker in this clip.'),
  viralityScore: z.number().min(1).max(10).describe('A score from 1-10 on the clip\'s viral potential.'),
});
export type AnalyzedClip = z.infer<typeof AnalyzedClipSchema>;


// Define the schema for the output of the flow
const AnalyzeVideoOutputSchema = z.object({
  speakers: z.array(SpeakerSchema).describe('A list of the speakers identified in the video.'),
  transcription: z.array(TranscriptionSegmentSchema).describe('The full transcription, broken down by speaker and time.'),
  clips: z.array(AnalyzedClipSchema).describe('A list of the most interesting clips found in the video.'),
});
export type AnalyzeVideoOutput = z.infer<typeof AnalyzeVideoOutputSchema>;

// Exported wrapper function to be called from the component
export async function analyzeVideoContent(input: AnalyzeVideoInput): Promise<AnalyzeVideoOutput> {
    return analyzeVideoContentFlow(input);
}

const analyzeVideoContentFlow = ai.defineFlow(
  {
    name: 'analyzeVideoContentFlow',
    inputSchema: AnalyzeVideoInputSchema,
    outputSchema: AnalyzeVideoOutputSchema,
  },
  async (input) => {
    console.log("Analizando video para identificar oradores, transcribir y encontrar clips...");
    
    // Validation to prevent the error
    if (!input || !input.publicUrl || !input.publicUrl.startsWith("https://")) {
      throw new Error(`Invalid or empty input.publicUrl. Must be a valid HTTPS URL. Received: ${input?.publicUrl}`);
    }
    if (!input.contentType || typeof input.contentType !== 'string') {
      throw new Error(`Invalid or empty input.contentType. Must be a valid MIME type string. Received: ${input?.contentType}`);
    }

    const { output } = await ai.generate({
        model: 'googleai/gemini-1.5-pro',
        output: { schema: AnalyzeVideoOutputSchema },
        prompt: [
            { text: `Eres un experto en producción de video para redes sociales. Tu tarea es analizar el siguiente video para preparar la creación de clips verticales.

Por favor, realiza las siguientes tareas en orden:

1.  **Identifica a los Oradores**: Observa a las personas en el video. Identifica a cada orador único. Para cada uno, crea un ID único (ej: "orador_1"), describe su apariencia y determina su posición en el cuadro (izquierda, derecha, centro).

2.  **Transcripción por Orador**: Transcribe todo el video. Divide la transcripción en segmentos, asignando a cada uno el ID del orador correspondiente y los tiempos de inicio y fin en segundos.

3.  **Extracción de Clips Virales**: Basándote en la transcripción, identifica de 2 a 4 momentos con alto potencial viral (ganchos, declaraciones fuertes, consejos útiles). Para cada clip potencial:
    *   Crea un título corto y atractivo.
    *   Escribe un resumen conciso.
    *   Indica los tiempos de inicio y fin exactos en segundos.
    *   Identifica al orador principal del clip.
    *   Asígnale una puntuación de viralidad de 1 a 10.

Devuelve toda esta información en el formato JSON solicitado.`},
        ],
        media: [
            {
                uri: input.publicUrl,
                contentType: input.contentType,
            }
        ],
    });

    if (!output) {
        throw new Error("La IA no devolvió una respuesta válida.");
    }
    
    if (!Array.isArray(output.clips)) {
        console.error("La respuesta de la IA no fue válida o no contenía clips:", output);
        // Provide a default empty array for clips to prevent downstream errors.
        output.clips = [];
    }
    
    // Sort clips by virality score descending
    output.clips.sort((a: AnalyzedClip, b: AnalyzedClip) => b.viralityScore - a.viralityScore);

    console.log(`Análisis completo. Se encontraron ${output.clips.length} clips y ${output.speakers.length} oradores.`);
    return output;
  }
);
