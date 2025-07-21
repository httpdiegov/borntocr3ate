
'use server';

/**
 * @fileOverview A flow for creating a vertical video clip from a larger video using ffmpeg.
 * This version uses a robust "cut, concatenate, and re-add audio" method to ensure stability and sync.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Define schema for face coordinates
const FaceCoordinatesSchema = z.object({
  x: z.number().describe("Normalized horizontal coordinate of the face center."),
  y: z.number().describe("Normalized vertical coordinate of the face center."),
});

// Define the schema for a speaker identified in the video
const SpeakerSchema = z.object({
  id: z.string().describe('A unique identifier for the speaker (e.g., "orador_1").'),
  description: z.string().describe('A brief description of the speaker (e.g., "man with glasses on the left").'),
});

// Define the schema for a segment of the transcription, now with face coordinates
const TranscriptionSegmentSchema = z.object({
    speakerId: z.string().describe('The ID of the speaker for this segment.'),
    text: z.string().describe('The transcribed text.'),
    startTime: z.number().describe('Start time in seconds.'),
    endTime: z.number().describe('End time in seconds.'),
    faceCoordinates: FaceCoordinatesSchema,
});


const CreateVideoClipInputSchema = z.object({
  videoUrl: z.string().url().describe('The public URL of the original horizontal video.'),
  clipStartTime: z.number().describe('Start time of the clip in seconds.'),
  clipEndTime: z.number().describe('End time of the clip in seconds.'),
  clipTitle: z.string().describe('The title of the clip, used for the output filename.'),
  speakers: z.array(SpeakerSchema).describe('List of all speakers identified in the video.'),
  transcription: z.array(TranscriptionSegmentSchema).describe('Transcription segments with speaker IDs, timings, and face coordinates.'),
});
export type CreateVideoClipInput = z.infer<typeof CreateVideoClipInputSchema>;

const CreateVideoClipOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    filePath: z.string().optional().describe("The local path where the video was saved."),
    ffmpegCommand: z.string().describe("A summary of the ffmpeg commands that were generated.")
});
export type CreateVideoClipOutput = z.infer<typeof CreateVideoClipOutputSchema>;

async function createClip(input: CreateVideoClipInput): Promise<CreateVideoClipOutput> {
  const { videoUrl, clipStartTime, clipEndTime, clipTitle, transcription } = input;
  let allFfmpegCommands = 'Error: Command not generated.';

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-processing-'));
  const originalVideoPath = path.join(tempDir, 'original.mp4');
  
  const videosDir = path.join(process.cwd(), 'videos');
  fs.mkdirSync(videosDir, { recursive: true });
  const safeClipTitle = clipTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const outputClipPath = path.join(videosDir, `${safeClipTitle}.mp4`);
  
  try {
    console.log(`Downloading video from ${videoUrl}`);
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
    const videoBuffer = await response.arrayBuffer();
    fs.writeFileSync(originalVideoPath, Buffer.from(videoBuffer));
    console.log(`Video downloaded to ${originalVideoPath}`);
    
    const relevantTranscription = transcription.filter(
        (seg) => seg.startTime < clipEndTime && seg.endTime > clipStartTime
    ).sort((a, b) => a.startTime - b.startTime);
    
    if (relevantTranscription.length === 0) {
      throw new Error("No transcription segments found in the specified time range to create a clip.");
    }
    
    const segmentFilePaths: string[] = [];
    allFfmpegCommands = "";

    // Step 1: Create a cropped video part for each transcription segment (no audio)
    for (const [index, segment] of relevantTranscription.entries()) {
        const segmentStart = Math.max(segment.startTime, clipStartTime);
        const segmentEnd = Math.min(segment.endTime, clipEndTime);
        const duration = segmentEnd - segmentStart;
        if (duration <= 0) continue;

        const faceX_norm = segment.faceCoordinates.x;
        // Perform calculations in TypeScript to get a final numeric value for cropX
        // This logic is designed for split-screen videos where speakers are in the left or right panels.
        // It maps the faceX coordinate (0 to 1) to the active area of the screen.
        // For a typical 16:9 video, the two 9:16 panels would be in the middle half.
        const cropX_expr = `(iw/4) + (iw/2)*${faceX_norm} - (ih*9/32)`;
        
        const partPath = path.join(tempDir, `part_${index}.mp4`);
        segmentFilePaths.push(partPath);

        // Use a simple, clean ffmpeg command with the calculated numeric value for crop
        const cropCommand = `ffmpeg -y -ss ${segmentStart} -i "${originalVideoPath}" -t ${duration} -vf "crop=ih*9/16:ih:${cropX_expr}:0,scale=1080:1920,setsar=1" -c:v libx264 -preset veryfast -an "${partPath}"`;
        
        console.log(`Creating segment ${index} (${segmentStart.toFixed(2)}s -> ${segmentEnd.toFixed(2)}s)`);
        allFfmpegCommands += cropCommand + "\n\n";
        execSync(cropCommand, { stdio: 'inherit' });
    }
    
    if (segmentFilePaths.length === 0) {
      throw new Error("No video segments could be created from the transcription.");
    }

    // Step 2: Concatenate all video parts
    const concatListPath = path.join(tempDir, 'concat-list.txt');
    const fileListContent = segmentFilePaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, fileListContent);

    const tempVideoPath = path.join(tempDir, 'temp_video.mp4');
    const concatCommand = `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${tempVideoPath}"`;
    console.log('Concatenating video segments...');
    allFfmpegCommands += concatCommand + "\n\n";
    execSync(concatCommand, { stdio: 'inherit' });

    // Step 3: Extract the original audio for the full clip duration and add it to the concatenated video
    const clipDuration = clipEndTime - clipStartTime;
    const finalCommand = `ffmpeg -y -i "${tempVideoPath}" -ss ${clipStartTime} -t ${clipDuration} -i "${originalVideoPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 "${outputClipPath}"`;
    console.log('Adding original audio to the final clip...');
    allFfmpegCommands += finalCommand;
    execSync(finalCommand, { stdio: 'inherit' });


    if (!fs.existsSync(outputClipPath)) {
        throw new Error("ffmpeg command did not produce an output file.");
    }
    
    console.log(`Successfully created clip and saved to: ${outputClipPath}`);
    return { 
        success: true, 
        message: `Clip created successfully! Saved to ${outputClipPath}`,
        filePath: outputClipPath,
        ffmpegCommand: allFfmpegCommands
    };

  } catch (error: any) {
    console.error('Failed to create video clip:', error);
    const errorMessage = error.stderr ? error.stderr.toString() : error.message;
    return { success: false, message: `Failed to create clip: ${errorMessage}`, ffmpegCommand: allFfmpegCommands };
  } finally {
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
