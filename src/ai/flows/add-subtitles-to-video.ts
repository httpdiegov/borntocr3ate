
'use server';

/**
 * @fileOverview A flow for adding dynamic, word-by-word subtitles to a video using Remotion.
 * This flow takes a video and a transcription file, and renders a new video with subtitles.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { transcriptionSchema } from '../../remotion/schemas';


const AddSubtitlesInputSchema = z.object({
  videoUrl: z.string().url().describe('Public URL of the vertical video file (MP4).'),
  transcription: transcriptionSchema.describe('The transcription data, including word-level timestamps.'),
  outputFilename: z.string().describe('The desired filename for the output video.'),
});
export type AddSubtitlesInput = z.infer<typeof AddSubtitlesInputSchema>;

const AddSubtitlesOutputSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    outputPath: z.string().optional().describe("The local path where the final video was saved."),
});
export type AddSubtitlesOutput = z.infer<typeof AddSubtitlesOutputSchema>;

async function addSubtitles(input: AddSubtitlesInput): Promise<AddSubtitlesOutput> {
  const { videoUrl, transcription, outputFilename } = input;

  const videosDir = path.join(process.cwd(), 'videos');
  fs.mkdirSync(videosDir, { recursive: true });
  const outputPath = path.join(videosDir, outputFilename);

  try {
    console.log(`Starting subtitle render for ${videoUrl}`);
    
    // Set a long duration and let Remotion stop when the video ends.
    const durationInFrames = 54000; // 30 minutes at 30 FPS, a safe upper limit.

    // Prepare props for Remotion, passing data directly
    const inputProps = {
      videoUrl: videoUrl,
      transcription: transcription,
    };
    
    // Escape the JSON string for the shell
    const propsString = JSON.stringify(JSON.stringify(inputProps));

    // Command to render the video using Remotion CLI
    const entryPoint = 'src/remotion/index.ts';
    
    const command = `npx remotion render ${entryPoint} SubtitledClip "${outputPath}" --props=${propsString} --duration-in-frames=${durationInFrames} --chromium-sandbox=false --headless`;

    console.log('Executing Remotion command...');
    execSync(command, { stdio: 'inherit' });

    if (!fs.existsSync(outputPath)) {
        throw new Error("Remotion render did not produce an output file.");
    }
    
    console.log(`Successfully rendered video with subtitles to: ${outputPath}`);
    return { 
        success: true, 
        message: `Video rendered successfully!`,
        outputPath: outputPath,
    };

  } catch (error: any) {
    console.error('Failed to render video with Remotion:', error);
    const errorMessage = error.stderr ? error.stderr.toString() : error.message;
    return { success: false, message: `Render failed: ${errorMessage}` };
  }
}

export const addSubtitlesToVideo = ai.defineFlow(
    {
        name: 'addSubtitlesToVideoFlow',
        inputSchema: AddSubtitlesInputSchema,
        outputSchema: AddSubtitlesOutputSchema,
    },
    addSubtitles
);
