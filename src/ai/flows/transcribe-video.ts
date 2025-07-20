'use server';

/**
 * @fileOverview A flow for transcribing video content using Genkit.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the schema for the input: a video file as a data URI
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

/**
 * Transcribes a video using the Gemini API.
 * This function uses a direct ai.generate call to correctly handle multimodal input.
 * @param input The video data to transcribe.
 * @returns The transcription text.
 */
export async function transcribeVideo(input: TranscribeVideoInput): Promise<TranscribeVideoOutput> {
  console.log('Starting video transcription with direct ai.generate call...');
  
  const { output } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: 'Transcribe the audio from the following video accurately. Provide only the text of the transcription.',
      media: [{ url: input.videoDataUri, contentType: input.contentType }],
      output: {
        schema: TranscribeVideoOutputSchema,
      },
  });

  if (!output?.transcription) {
      console.error("Transcription failed. AI did not return valid text.");
      throw new Error("La IA no pudo generar una transcripción.");
  }
  
  console.log('Transcription completed successfully.');
  return output;
}
