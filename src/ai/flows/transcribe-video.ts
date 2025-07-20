'use server';

/**
 * @fileOverview A flow for transcribing video content using a direct API call.
 */

import { z } from 'zod';
import { getApiKey } from '../tools/get-api-key';

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

export async function transcribeVideo(input: TranscribeVideoInput): Promise<TranscribeVideoOutput> {
    console.log('Starting video transcription with direct API call...');
    
    const apiKey = await getApiKey({ service: 'GEMINI_API_KEY' });
    if (!apiKey) {
      throw new Error('Gemini API key not found in Secret Manager.');
    }

    const [header, base64Data] = input.videoDataUri.split(',');
    if (!header || !base64Data) {
      throw new Error('Invalid data URI format.');
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: "Transcribe the audio from the following video accurately. Provide only the text of the transcription." },
            {
              inline_data: {
                mime_type: input.contentType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Google AI API Error Response:", errorBody);
            throw new Error(`Google AI API request failed with status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.candidates || !data.candidates[0].content || !data.candidates[0].content.parts[0].text) {
             console.error("Transcription failed. Invalid response structure from API:", data);
             throw new Error("La IA no pudo generar una transcripción. Respuesta inesperada.");
        }

        const transcription = data.candidates[0].content.parts[0].text;
        
        console.log('Transcription completed successfully.');
        return { transcription };

    } catch (error) {
        console.error("Error during video transcription fetch:", error);
        throw error;
    }
}
