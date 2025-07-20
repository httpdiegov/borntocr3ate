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

// Define the flow that will be called from the frontend
export const transcribeVideo = ai.defineFlow(
  {
    name: 'transcribeVideoFlow',
    inputSchema: TranscribeVideoInputSchema,
    outputSchema: TranscribeVideoOutputSchema,
  },
  async (input) => {
    console.log('Starting video transcription with Gemini 1.5 Flash...');
    
    // Use the core generate function for more direct control.
    // This avoids issues with prompt templating for complex media types.
    const { output } = await ai.generate({
        model: googleAI.model('gemini-1.5-flash'),
        prompt: {
            text: 'Transcribe the audio from the following video accurately. Provide only the text of the transcription.',
            media: [{
                url: input.videoDataUri,
                contentType: input.contentType,
            }],
        },
        output: {
            schema: TranscribeVideoOutputSchema
        }
    });
    
    if (!output?.transcription) {
        console.error("Transcription failed. AI did not return valid text.");
        throw new Error("La IA no pudo generar una transcripción.");
    }

    console.log('Transcription completed successfully.');
    return { transcription: output.transcription };
  }
);