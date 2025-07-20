'use server';

/**
 * @fileOverview A Genkit flow for transcribing video content.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { media } from 'genkit';

// Define the schema for the input: a video file as a data URI and its content type
const TranscribeVideoInputSchema = z.object({
  videoDataUri: z
    .string()
    .describe(
      "A video file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
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

// Define the schema for the prompt's input, which now includes a structured media object
const PromptInputSchema = z.object({
    video: z.any().describe("The video content to be transcribed")
});


// Define the prompt that instructs the AI to transcribe the video.
const transcriptionPrompt = ai.definePrompt({
  name: 'transcriptionPrompt',
  input: { schema: PromptInputSchema },
  output: { schema: TranscribeVideoOutputSchema },
  prompt: `Transcribe the audio from the following video accurately. Provide only the text of the transcription.
  
  Video: {{{video}}}`,
  
  // Use a model that supports video input like Gemini 1.5 Pro or Flash.
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
    
    // Manually create the MediaPart object. This is the correct way.
    const videoPart = media({
        url: input.videoDataUri,
        contentType: input.contentType,
    });

    // Pass the structured object to the prompt.
    const { output } = await transcriptionPrompt({ video: videoPart });
    
    if (!output?.transcription) {
        console.error("Transcription failed. AI did not return valid text.");
        throw new Error("La IA no pudo generar una transcripción.");
    }

    console.log('Transcription completed successfully.');
    return { transcription: output.transcription };
  }
);
