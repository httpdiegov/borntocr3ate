
'use server';

/**
 * @fileOverview A flow for creating a vertical video clip from a larger video using ffmpeg.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Define the schema for a speaker identified in the video
const SpeakerSchema = z.object({
  id: z.string().describe('A unique identifier for the speaker (e.g., "orador_1").'),
  description: z.string().describe('A brief description of the speaker (e.g., "man with glasses on the left").'),
  position: z.enum(['izquierda', 'derecha', 'centro', 'desconocido']).describe('The speaker\'s general position in the frame.'),
});

const CreateVideoClipInputSchema = z.object({
  videoUrl: z.string().url().describe('The public URL of the original horizontal video.'),
  startTime: z.number().describe('Start time of the clip in seconds.'),
  endTime: z.number().describe('End time of the clip in seconds.'),
  speaker: SpeakerSchema.describe('The speaker to focus on for the clip.'),
  clipTitle: z.string().describe('The title of the clip, used for the output filename.')
});
export type CreateVideoClipInput = z.infer<typeof CreateVideoClipInputSchema>;

const CreateVideoClipOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    filePath: z.string().optional().describe("The local path where the video was saved."),
    ffmpegCommand: z.string().describe("The ffmpeg command that was generated.")
});
export type CreateVideoClipOutput = z.infer<typeof CreateVideoClipOutputSchema>;


async function createClip(input: CreateVideoClipInput): Promise<CreateVideoClipOutput> {
  const { videoUrl, startTime, endTime, clipTitle, speaker } = input;
  let ffmpegCommand = 'Error: Command not generated.';

  // Create a unique temporary directory for this operation
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-processing-'));
  const originalVideoPath = path.join(tempDir, 'original.mp4');
  
  // Define the final output directory and path
  const videosDir = path.join(process.cwd(), 'videos');
  fs.mkdirSync(videosDir, { recursive: true });
  const safeClipTitle = clipTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const outputClipPath = path.join(videosDir, `${safeClipTitle}.mp4`);
  
  try {
    // 1. Download the original video file
    console.log(`Downloading video from ${videoUrl}`);
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
    const videoBuffer = await response.arrayBuffer();
    fs.writeFileSync(originalVideoPath, Buffer.from(videoBuffer));
    console.log(`Video downloaded to ${originalVideoPath}`);

    // 2. Construct the ffmpeg command with improved static cropping
    const duration = endTime - startTime;
    // Crop to 9:16 aspect ratio based on speaker position
    let cropFilter: string;
    switch (speaker.position) {
      case 'izquierda':
        // Crop the left 56.25% of the video (9/16)
        cropFilter = 'crop=ih*9/16:ih:0:0';
        break;
      case 'derecha':
        // Crop the right 56.25% of the video
        cropFilter = 'crop=ih*9/16:ih:iw-ih*9/16:0';
        break;
      case 'centro':
      default:
        // Crop the center
        cropFilter = 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0';
        break;
    }
    
    // Command to cut the clip, apply the crop, and scale to 1080x1920
    ffmpegCommand = `ffmpeg -y -ss ${startTime} -i "${originalVideoPath}" -t ${duration} -vf "${cropFilter},scale=1080:1920" -c:a copy "${outputClipPath}"`;
    console.log(`Generated ffmpeg command: ${ffmpegCommand}`);

    // 3. Execute the ffmpeg command
    execSync(ffmpegCommand);

    if (!fs.existsSync(outputClipPath)) {
        throw new Error("ffmpeg command did not produce an output file.");
    }
    
    console.log(`Successfully created clip and saved to: ${outputClipPath}`);
    return { 
        success: true, 
        message: `Clip created successfully! Saved to ${outputClipPath}`,
        filePath: outputClipPath,
        ffmpegCommand
    };

  } catch (error: any) {
    console.error('Failed to create video clip:', error);
    return { success: false, message: `Failed to create clip: ${error.message}`, ffmpegCommand };
  } finally {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export const createVideoClip = ai.defineFlow(
    {
        name: 'createVideoClipFlow',
        inputSchema: CreateVideoClipInputSchema,
        outputSchema: CreateVideoClipOutputSchema,
    },
    createClip
);
