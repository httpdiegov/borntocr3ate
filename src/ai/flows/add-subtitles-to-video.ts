
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
import { transcriptionSchema } from '@/lib/schemas';


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
  const tempTranscriptionFile = path.join(tempDir, 'transcription.json');

  const videosDir = path.join(process.cwd(), 'videos');
  fs.mkdirSync(videosDir, { recursive: true });
  const outputPath = path.join(videosDir, outputFilename);

  try {
    console.log(`Starting subtitle render for ${videoUrl}`);
    
    // 1. Download video and write transcription JSON to temp files
    console.log(`Downloading video from ${videoUrl} to ${tempVideoFile}`);
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
    // @ts-ignore
    const videoBuffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempVideoFile, videoBuffer);
    console.log('Video downloaded successfully.');

    fs.writeFileSync(tempTranscriptionFile, JSON.stringify(transcription));
    console.log(`Transcription file written to ${tempTranscriptionFile}`);

    // 2. Set a long duration and let Remotion stop when the video ends.
    // This avoids calling getAudioDurationInSeconds in a server environment.
    const durationInFrames = 54000; // 30 minutes at 30 FPS, a safe upper limit.

    // 3. Prepare props for Remotion, passing file paths instead of raw data
    const inputProps = {
      videoPath: tempVideoFile,
      transcriptionPath: tempTranscriptionFile,
    };
    
    // Replace backslashes with forward slashes for cross-platform compatibility in the command
    const propsString = JSON.stringify(inputProps).replace(/\\/g, '/');

    // 4. Command to render the video using Remotion CLI
    const entryPoint = 'src/remotion/index.ts';
    
    const command = `npx remotion render ${entryPoint} SubtitledClip "${outputPath}" --props='${propsString}' --duration-in-frames=${durationInFrames} --chromium-sandbox=false --headless`;

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
    // 5. Clean up temporary directory
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
