
'use server';

/**
 * @fileOverview An AI flow to quickly identify the main speaker's position in a video.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/googleai';

// Define the schema for a speaker identified in the video
const SpeakerSchema = z.object({
  id: z.string().describe('A unique identifier for the speaker (e.g., "orador_1").'),
  description: z.string().describe('A brief description of the speaker (e.g., "man with glasses on the left").'),
  position: z.enum(['izquierda', 'derecha', 'centro', 'desconocido']).describe('The speaker\'s general position in the frame.'),
});
export type Speaker = z.infer<typeof SpeakerSchema>;

// Define the schema for the input of the flow
const GetSpeakerPositionInputSchema = z.object({
  gcsUri: z.string().describe('The GCS URI of the video file (e.g., "gs://bucket/file").'),
  contentType: z.string().describe('The MIME type of the video file (e.g., "video/mp4").'),
});
export type GetSpeakerPositionInput = z.infer<typeof GetSpeakerPositionInputSchema>;

// Define the schema for the output of the flow
const GetSpeakerPositionOutputSchema = z.object({
  speaker: SpeakerSchema.optional().describe('The primary speaker identified in the video.'),
});
export type GetSpeakerPositionOutput = z.infer<typeof GetSpeakerPositionOutputSchema>;


const speakerPositionPrompt = ai.definePrompt({
    name: 'speakerPositionPrompt',
    input: { schema: GetSpeakerPositionInputSchema },
    output: { schema: GetSpeakerPositionOutputSchema },
    model: googleAI.model('gemini-1.5-pro'),
    prompt: `Eres un experto en análisis de video. Tu única tarea es identificar a la persona principal en el siguiente video y determinar su posición en el cuadro.

Devuelve un solo objeto 'speaker' con un ID, una breve descripción y su posición ('izquierda', 'derecha', 'centro'). Si no hay una persona clara, devuelve un objeto vacío.

Video a analizar: {{media uri=gcsUri contentType=contentType}}
`,
});


const getSpeakerPositionFlow = ai.defineFlow(
  {
    name: 'getSpeakerPositionFlow',
    inputSchema: GetSpeakerPositionInputSchema,
    outputSchema: GetSpeakerPositionOutputSchema,
  },
  async (input) => {
    console.log("Analizando video para identificar posición del orador principal...");
    
    const { output } = await speakerPositionPrompt(input);

    if (!output) {
        console.error("La respuesta de la IA no fue válida:", output);
        throw new Error("La IA no pudo determinar la posición del orador.");
    }
    
    console.log(`Análisis de posición completo. Orador encontrado en: ${output.speaker?.position}`);
    return output;
  }
);


export async function getSpeakerPosition(input: GetSpeakerPositionInput): Promise<GetSpeakerPositionOutput> {
  return getSpeakerPositionFlow(input);
}
