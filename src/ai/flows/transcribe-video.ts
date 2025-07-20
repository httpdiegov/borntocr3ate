'use server';

/**
 * @fileOverview A Genkit flow for transcribing video content.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the schema for the input: a video file as a data URI
const TranscribeVideoInputSchema = z.object({
  videoDataUri: z
    .string()
    .describe(
      "A video file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscribeVideoInput = z.infer<typeof TranscribeVideoInputSchema>;

// Define the schema for the output: the transcription text
const TranscribeVideoOutputSchema = z.object({
  transcription: z.string().describe('The full transcription of the video.'),
});
export type TranscribeVideoOutput = z.infer<
  typeof TranscribeVideoOutputSchema
>;

// Define the prompt that instructs the AI to transcribe the video.
// We use a powerful model capable of video input.
const transcriptionPrompt = ai.definePrompt({
  name: 'transcriptionPrompt',
  input: { schema: TranscribeVideoInputSchema },
  output: { schema: TranscribeVideoOutputSchema },
  prompt: `Transcribe the audio from the following video accurately. Provide only the text of the transcription.
  
  Video: {{media url=videoDataUri}}`,
  
  // Use a model that supports video input like Gemini 1.5 Pro or Flash.
  // Note: Video processing can take longer and be more expensive.
  model: 'googleai/gemini-1.5-flash', 
});

// Define the flow that will be called from the frontend
export const transcribeVideo = ai.defineFlow(
  {
    name: 'transcribeVideoFlow',
    inputSchema: TranscribeVideoInputSchema,
    outputSchema: TranscribeVideoOutputSchema,
  },
  async (input) => {
    console.log('Starting video transcription...');
    const { output } = await transcriptionPrompt(input);
    
    if (!output?.transcription) {
        console.error("Transcription failed. AI did not return valid text.");
        throw new Error("La IA no pudo generar una transcripción.");
    }

    console.log('Transcription completed successfully.');
    return { transcription: output.transcription };
  }
);
