'use server';

/**
 * @fileOverview A flow for transcribing video content using Genkit.
 * This flow now accepts a Google Cloud Storage URI instead of a data URI.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the schema for the input: a GCS URI
const TranscribeVideoInputSchema = z.object({
  gcsUri: z.string().describe('The Google Cloud Storage URI of the video file (e.g., "gs://bucket-name/video.mp4").'),
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
 * Transcribes a video from a GCS URI using the Gemini API.
 * @param input The video GCS URI to transcribe.
 * @returns The transcription text.
 */
export async function transcribeVideo(input: TranscribeVideoInput): Promise<TranscribeVideoOutput> {
  console.log(`Starting video transcription from GCS URI: ${input.gcsUri}`);
  
  const { output } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: [
        { media: { url: input.gcsUri, contentType: input.contentType } },
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
