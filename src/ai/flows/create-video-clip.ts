'use server';

/**
 * @fileOverview A flow for creating a vertical video clip from a larger video using ffmpeg.
 * This version uses a robust, single-command `filter_complex` approach to ensure perfect sync.
 * It performs all mathematical calculations in TypeScript to avoid OS-specific command-line parsing issues.
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

// Define the schema for a speaker, now including their stable face coordinates
const SpeakerSchema = z.object({
  id: z.string().describe('A unique identifier for the speaker (e.g., "orador_1").'),
  description: z.string().describe('A brief description of the speaker (e.g., "man with glasses on the left").'),
  faceCoordinates: FaceCoordinatesSchema.describe("The single, most representative (stable) position of the speaker's face throughout the video."),
});

// Define the schema for a segment of the transcription, which no longer needs coordinates
const TranscriptionSegmentSchema = z.object({
    speakerId: z.string().describe('The ID of the speaker for this segment.'),
    text: z.string().describe('The transcribed text.'),
    startTime: z.number().describe('Start time in seconds.'),
    endTime: z.number().describe('End time in seconds.'),
});


const CreateVideoClipInputSchema = z.object({
  videoUrl: z.string().url().describe('The public URL of the original horizontal video.'),
  clipStartTime: z.number().describe('Start time of the clip in seconds.'),
  clipEndTime: z.number().describe('End time of the clip in seconds.'),
  clipTitle: z.string().describe('The title of the clip, used for the output filename.'),
  speakers: z.array(SpeakerSchema).describe('List of all speakers identified in the video, with their fixed face coordinates.'),
  transcription: z.array(TranscriptionSegmentSchema).describe('Transcription segments with speaker IDs and timings.'),
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
  const { videoUrl, clipStartTime, clipEndTime, clipTitle, transcription, speakers } = input;
  let ffmpegCommand = 'Error: Command not generated.';

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
    
    const speakerPositions = new Map(speakers.map(s => [s.id, s.faceCoordinates]));

    const ih = 1080;
    const iw = 1920;
    const cropWidth = Math.floor(ih * 9 / 16);

    // Default crop position (centers the frame)
    let lastCropX = (iw - cropWidth) / 2;
    if (relevantTranscription.length > 0) {
        const firstSpeakerId = relevantTranscription[0].speakerId;
        const firstSpeakerPos = speakerPositions.get(firstSpeakerId);
        if (firstSpeakerPos) {
            lastCropX = Math.max(0, Math.min(iw - cropWidth, Math.floor(firstSpeakerPos.x * iw - cropWidth / 2)));
        }
    }

    let cropXExpression = "";
    // Build the nested if expression from the last segment to the first
    for (let i = relevantTranscription.length - 1; i >= 0; i--) {
        const segment = relevantTranscription[i];
        const faceCoordinates = speakerPositions.get(segment.speakerId);
        if (!faceCoordinates) continue;

        const faceX_norm = faceCoordinates.x;
        const cropX = Math.max(0, Math.min(iw - cropWidth, Math.floor(faceX_norm * iw - cropWidth / 2)));
        
        // For the last segment, this becomes the final 'else'
        if (cropXExpression === "") {
            cropXExpression = `${cropX}`;
        } else {
            cropXExpression = `if(between(t,${segment.startTime},${segment.endTime}),${cropX},${cropXExpression})`;
        }
        lastCropX = cropX;
    }
    // The very first segment defines the initial state before any other condition is met
    cropXExpression = `if(between(t,${relevantTranscription[0].startTime},${relevantTranscription[0].endTime}),${lastCropX},${cropXExpression})`;

    const videoFilter = `trim=${clipStartTime}:${clipEndTime},setpts=PTS-STARTPTS,crop=w=${cropWidth}:h=${ih}:x='${cropXExpression}',scale=1080:1920,setsar=1`;
    const audioFilter = `atrim=${clipStartTime}:${clipEndTime},asetpts=PTS-STARTPTS`;

    const fullFilterComplex = `[0:v]${videoFilter}[outv];[0:a]${audioFilter}[outa]`;

    ffmpegCommand = `ffmpeg -y -i "${originalVideoPath}" -filter_complex "${fullFilterComplex}" -map "[outv]" -map "[outa]" -c:v libx264 -preset veryfast -c:a aac -shortest "${outputClipPath}"`;
    
    console.log('Processing video with a single robust command...');
    console.log('Generated ffmpeg command:', ffmpegCommand);
    execSync(ffmpegCommand, { stdio: 'inherit' });

    if (!fs.existsSync(outputClipPath)) {
        throw new Error("ffmpeg command did not produce an output file.");
    }
    
    console.log(`Successfully created clip and saved to: ${outputClipPath}`);
    return { 
        success: true, 
        message: `Clip created successfully! Saved to ${outputClipPath}`,
        filePath: outputClipPath,
        ffmpegCommand: ffmpegCommand
    };

  } catch (error: any) {
    console.error('Failed to create video clip:', error);
    const errorMessage = error.stderr ? error.stderr.toString() : error.message;
    return { success: false, message: `Failed to create clip: ${errorMessage}`, ffmpegCommand: ffmpegCommand };
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