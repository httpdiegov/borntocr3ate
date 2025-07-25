
'use server';

/**
 * @fileOverview A flow for transcribing video content using Genkit.
 * This flow now accepts a public URL to the video file.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the schema for the input: a public URL
const TranscribeVideoInputSchema = z.object({
  publicUrl: z.string().url().describe('The public HTTPS URL of the video file.'),
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
 * Transcribes a video from a public URL using the Gemini API.
 * @param input The video's public URL to transcribe.
 * @returns The transcription text.
 */
export async function transcribeVideo(input: TranscribeVideoInput): Promise<TranscribeVideoOutput> {
  console.log(`Starting video transcription from Public URL: ${input.publicUrl}`);
  
  const { output } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: [
        { media: { url: input.publicUrl, contentType: input.contentType } },
        { text: 'Transcribe the audio from the following video accurately. Provide only the text of the transcription.' },
      ],
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
