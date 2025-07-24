
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
import { getAudioDurationInSeconds } from 'remotion';


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

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remotion-render-'));
  const tempVideoFile = path.join(tempDir, 'input.mp4');
  
  const videosDir = path.join(process.cwd(), 'videos');
  fs.mkdirSync(videosDir, { recursive: true });
  const outputPath = path.join(videosDir, outputFilename);

  try {
    console.log(`Starting subtitle render for ${videoUrl}`);
    
    // Download the video file to a temporary location
    console.log(`Downloading video from ${videoUrl} to ${tempVideoFile}`);
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
    // @ts-ignore
    const videoBuffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempVideoFile, videoBuffer);
    console.log('Video downloaded successfully.');

    // Get the actual duration of the downloaded video file using Remotion's prober
    const videoDurationInSeconds = await getAudioDurationInSeconds(tempVideoFile);
    if (isNaN(videoDurationInSeconds) || videoDurationInSeconds <= 0) {
        throw new Error("Could not determine video duration from file.");
    }

    const durationInFrames = Math.ceil(videoDurationInSeconds * 30); // Assuming 30 FPS

    const inputProps = {
      // Pass the local video file path to Remotion component
      videoPath: tempVideoFile,
      transcription: transcription, // Pass transcription object directly
    };
    
    const propsString = JSON.stringify(inputProps).replace(/'/g, "'\\''");

    // Command to render the video using Remotion CLI
    const remotionRoot = path.join(process.cwd(), 'src', 'remotion', 'Root.tsx');
    
    const command = `npx remotion render ${remotionRoot} SubtitledClip ${outputPath} --props='${propsString}' --duration-in-frames=${durationInFrames} --gl=angle`;

    console.log('Executing Remotion command:', command);
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
  } finally {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
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
