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
    
    const speakerPositions = new Map(input.speakers.map(s => [s.id, s.faceCoordinates]));

    const ih = 1080;
    const iw = 1920;
    const cropWidth = Math.floor(ih * 9 / 16);
    const panDuration = 1.0; // Pan duration in seconds
    const panHalf = panDuration / 2;

    // Create a list of unique camera positions (keyframes) based on speaker changes.
    const keyframes: { time: number; cropX: number }[] = [];
    if (relevantTranscription.length > 0) {
        for (const segment of relevantTranscription) {
            const speakerPos = speakerPositions.get(segment.speakerId);
            if (!speakerPos) continue; // Skip if speaker has no defined position

            const cropX = Math.max(0, Math.min(iw - cropWidth, Math.floor(speakerPos.x * iw - cropWidth / 2)));
            // Add keyframe if it's the first one or the position has changed significantly.
            if (keyframes.length === 0 || Math.abs(cropX - keyframes[keyframes.length - 1].cropX) > 5) {
                keyframes.push({ time: segment.startTime, cropX });
            }
        }
        // If all segments are at the same position, ensure at least one keyframe exists.
        if (keyframes.length === 0 && relevantTranscription.length > 0) {
             const firstSpeakerPos = speakerPositions.get(relevantTranscription[0].speakerId);
             if (firstSpeakerPos) {
                const cropX = Math.max(0, Math.min(iw - cropWidth, Math.floor(firstSpeakerPos.x * iw - cropWidth / 2)));
                keyframes.push({ time: relevantTranscription[0].startTime, cropX });
             }
        }
    }

    // Build the ffmpeg filter expression for smooth panning.
    let x_expr: string;
    if (keyframes.length <= 1) {
        // If one or zero keyframes, the crop position is static.
        const cropX = keyframes.length > 0 ? keyframes[0].cropX : (iw - cropWidth) / 2;
        x_expr = `${cropX}`;
    } else {
        // Build a chained if-expression for the crop's x position.
        // The expression is built backwards for correct ffmpeg filtergraph nesting.
        let chained_expr = `${keyframes[keyframes.length - 1].cropX}`;
        for (let i = keyframes.length - 2; i >= 0; i--) {
            const curr = keyframes[i];
            const next = keyframes[i + 1];
            
            const panStartTime = next.time - panHalf;
            const lerp = `(${curr.cropX}+(t-${panStartTime})/${panDuration}*(${next.cropX}-${curr.cropX}))`;
            
            chained_expr = `if(lt(t,${panStartTime}),${curr.cropX},if(lt(t,${panStartTime}+${panDuration}),${lerp},${chained_expr}))`;
        }
        x_expr = chained_expr;
    }

    const clipDuration = clipEndTime - clipStartTime;
    const tempVideoPath = path.join(tempDir, 'temp_video.mp4');

    // A single ffmpeg command to crop, pan, and scale the video. Audio is handled separately.
    const videoProcessingCommand = `ffmpeg -y -ss ${clipStartTime} -t ${clipDuration} -i "${originalVideoPath}" -vf "crop=${cropWidth}:${ih}:x='${x_expr}':y=0,scale=1080:1920,setsar=1" -c:v libx264 -preset veryfast -an "${tempVideoPath}"`;
    
    console.log('Processing video with smooth panning...');
    allFfmpegCommands = videoProcessingCommand + "\n\n";
    execSync(videoProcessingCommand, { stdio: 'inherit' });

    // Final command to mux the processed video with the original audio track.
    // Using -c:v copy is efficient as the video is already encoded.
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
    