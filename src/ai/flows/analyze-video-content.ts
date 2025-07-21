'use server';

/**
 * @fileOverview An AI flow to analyze video content, identify speakers and their locations, and extract viral clips
 * with detailed transcriptions for dynamic editing.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';


// Define the schema for a speaker identified in the video, now with a stable position
const SpeakerSchema = z.object({
  id: z.string().describe('A unique identifier for the speaker (e.g., "orador_1").'),
  description: z.string().describe('A brief description of the speaker (e.g., "man with glasses on the left").'),
  faceCoordinates: z.object({ x: z.number(), y: z.number() }).describe("The single, most representative (stable) position of the speaker's face throughout the video."),
});
export type Speaker = z.infer<typeof SpeakerSchema>;

// Define the schema for a segment of the transcription, now simplified
const TranscriptionSegmentSchema = z.object({
  speakerId: z.string().describe('The ID of the speaker for this segment.'),
  text: z.string().describe('The transcribed text.'),
  startTime: z.number().describe('Start time of the segment in seconds with high precision.'),
  endTime: z.number().describe('End time of the segment in seconds with high precision.'),
});
export type TranscriptionSegment = z.infer<typeof TranscriptionSegmentSchema>;


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
  transcription: z.array(TranscriptionSegmentSchema).describe('The full transcription, broken down by speaker and time for each logical sentence or phrase.'),
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
    
    if (!input || !input.publicUrl || !input.publicUrl.startsWith("https://")) {
      throw new Error(`Invalid or empty input.publicUrl. Must be a valid HTTPS URL. Received: ${input?.publicUrl}`);
    }
    if (!input.contentType || typeof input.contentType !== 'string') {
      throw new Error(`Invalid or empty input.contentType. Must be a valid MIME type string. Received: ${input?.contentType}`);
    }

    const { output } = await ai.generate({
        model: 'googleai/gemini-2.5-pro',
        output: { schema: AnalyzeVideoOutputSchema },
        prompt: [
            { text: `Eres un experto editor de video para redes sociales. Tu tarea es analizar el siguiente video para preparar la creación de clips verticales.\n\n**Instrucciones Clave:**\n\n1.  **Identificar Oradores y su Posición Estable**: \n    *   Identifica a cada persona que habla en el video. Asigna un ID único (ej: "orador_1") y una descripción para cada uno.\n    *   Para cada orador, determina la posición facial **más común y representativa** a lo largo del video. Esta será su \`faceCoordinates\` fija. Esto es clave para un encuadre estable.\n\n2.  **Transcripción y Atribución Inteligente**: \n    *   Transcribe el audio completo.\n    *   Para cada frase, atribúyela al orador correcto (\`speakerId\`). Usa una combinación de la evidencia visual (quién parece estar hablando) y el contexto del audio para tomar una decisión segura.\n    *   **Regla Importante**: No cambies de orador en medio de una oración o frase coherente. Mantén la atribución al mismo orador hasta que haya una pausa clara o un cambio de turno evidente en la conversación.\n\n3.  **Extracción de Clips Virales**:\n    *   Basado en la transcripción, identifica de 2 a 4 momentos de alto impacto.\n    *   Define el \`title\`, \`summary\`, \`startTime\`, \`endTime\`, \`mainSpeakerId\` y \`viralityScore\` para cada uno.\n\nEl objetivo es un análisis preciso que permita una edición de video lógica y de alta calidad. Proporciona la salida en el formato JSON solicitado.`},
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
        output.clips = [];
    }
    
    output.clips.sort((a: AnalyzedClip, b: AnalyzedClip) => b.viralityScore - a.viralityScore);

    console.log(`Análisis completo. Se encontraron ${output.clips.length} clips, ${output.speakers.length} oradores y ${output.transcription.length} segmentos de transcripción.`);
    return output;
  }
);