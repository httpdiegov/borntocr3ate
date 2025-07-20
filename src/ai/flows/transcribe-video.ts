'use server';

/**
 * @fileOverview A Genkit flow for transcribing video content.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/googleai';

// Define the schema for the input: a video file as a data URI and its content type
const TranscribeVideoInputSchema = z.object({
  videoDataUri: z
    .string()
    .describe(
      "A video file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  contentType: z.string().describe('The MIME type of the video file (e.g., "video/mp4").'),
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
// The key is to pass both url and contentType to the media helper.
const transcriptionPrompt = ai.definePrompt({
  name: 'transcriptionPrompt',
  input: { schema: TranscribeVideoInputSchema },
  output: { schema: TranscribeVideoOutputSchema },
  prompt: `Transcribe the audio from the following video accurately. Provide only the text of the transcription.
  
  Video: {{media url=videoDataUri contentType=contentType}}`,
  
  // Use a more robust model that supports video input like Gemini 1.5 Pro.
  // We reference the model directly from the plugin to ensure it's resolved correctly.
  model: googleAI.model('gemini-1.5-pro-preview-0514'), 
});

// Define the flow that will be called from the frontend
export const transcribeVideo = ai.defineFlow(
  {
    name: 'transcribeVideoFlow',
    inputSchema: TranscribeVideoInputSchema,
    outputSchema: TranscribeVideoOutputSchema,
  },
  async (input) => {
    console.log('Starting video transcription with Gemini 1.5 Pro...');
    
    // Pass the input directly to the prompt.
    // Genkit's prompt templating will handle the media object creation.
    const { output } = await transcriptionPrompt(input);
    
    if (!output?.transcription) {
        console.error("Transcription failed. AI did not return valid text.");
        throw new Error("La IA no pudo generar una transcripción.");
    }

    console.log('Transcription completed successfully.');
    return { transcription: output.transcription };
  }
);
