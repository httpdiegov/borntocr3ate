
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

// This function defines the logic for creating a video clip.
// NOTE: This flow requires `ffmpeg` to be installed on the system where it's executed.
// It will not work in a standard sandboxed cloud environment unless ffmpeg is included in the container.
async function createClip(input: CreateVideoClipInput): Promise<CreateVideoClipOutput> {
  const { videoUrl, startTime, endTime, speaker, clipTitle } = input;
  
  // Create temporary file path for the original download
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-download-'));
  const originalVideoPath = path.join(tempDir, 'original.mp4');

  // Define the output directory and ensure it exists
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

    // 2. Define ffmpeg crop parameters based on speaker position
    const duration = endTime - startTime;
    // For a 1920x1080 (16:9) video, we create a 9:16 vertical video.
    // The crop area width will be the original height times 9/16.
    // The crop area height will be the original height.
    // crop filter format is: crop=w:h:x:y
    let cropFilter: string;
    const cropWidth = "ih*9/16"; // output_width = input_height * (9/16)
    const cropHeight = "ih";      // output_height = input_height

    switch (speaker.position) {
      case 'izquierda':
        // x=0 to align to the left edge
        cropFilter = `crop=${cropWidth}:${cropHeight}:0:0`;
        break;
      case 'derecha':
        // x = iw - ow (input_width - output_width) to align to the right edge
        cropFilter = `crop=${cropWidth}:${cropHeight}:iw-${cropWidth}:0`;
        break;
      case 'centro':
      default:
        // x = (iw - ow) / 2 to center the crop
        cropFilter = `crop=${cropWidth}:${cropHeight}:(iw-${cropWidth})/2:0`;
        break;
    }

    // 3. Construct the ffmpeg command. It now includes audio.
    const ffmpegCommand = `ffmpeg -y -ss ${startTime} -i "${originalVideoPath}" -t ${duration} -vf "${cropFilter}" -c:a copy "${outputClipPath}"`;
    console.log(`Generated ffmpeg command: ${ffmpegCommand}`);

    // 4. Execute the ffmpeg command
    // THIS IS THE LINE THAT REQUIRES FFMPEG TO BE INSTALLED LOCALLY.
    // It is commented out by default to prevent errors in environments without ffmpeg.
    // To run locally: 1) Install ffmpeg on your system. 2) Uncomment the line below.
    
    execSync(ffmpegCommand);
    
    // --- MOCK RESPONSE (if execSync is commented out) ---
    // To allow the UI to be tested without ffmpeg, we'll simulate a successful response.
    // When you uncomment execSync, you should comment out or remove this block.
    // await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate processing time
    // if (!fs.existsSync(outputClipPath)) {
    //     // Create a placeholder file for demonstration if it doesn't exist
    //     fs.writeFileSync(outputClipPath, "mock video content"); 
    // }
    // --- END MOCK RESPONSE ---

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
    return { success: false, message: `Failed to create clip: ${error.message}`, ffmpegCommand: 'Error generating command.' };
  } finally {
    // Clean up temporary downloaded file
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
