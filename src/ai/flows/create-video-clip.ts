'use server';

/**
 * @fileOverview A flow for creating a vertical video clip from a larger video using ffmpeg.
 * This version uses a robust "cut, concatenate, and re-add audio" method to ensure stability and sync.
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
    
    const speakerPositions = new Map(speakers.map(s => [s.id, s.faceCoordinates]));

    const ih = 1080;
    const iw = 1920;
    const cropWidth = Math.floor(ih * 9 / 16);

    let filterComplex = "";
    let lastEndTime = clipStartTime;

    relevantTranscription.forEach((segment, index) => {
        const segmentStart = Math.max(segment.startTime, clipStartTime);
        const segmentEnd = Math.min(segment.endTime, clipEndTime);
        if (segmentStart >= segmentEnd) return;

        const faceCoordinates = speakerPositions.get(segment.speakerId);
        if (!faceCoordinates) {
            console.warn(`Warning: Could not find face coordinates for speaker ${segment.speakerId}. Skipping segment.`);
            return;
        }

        const faceX_norm = faceCoordinates.x;
        const cropX = Math.max(0, Math.min(iw - cropWidth, Math.floor(faceX_norm * iw - cropWidth / 2)));

        // Trim the original video, apply the crop, and create a stream for this segment
        filterComplex += `[0:v]trim=${segmentStart}:${segmentEnd},setpts=PTS-STARTPTS,crop=${cropWidth}:${ih}:${cropX}:0,scale=1080:1920,setsar=1[v${index}]; `;
        lastEndTime = segmentEnd;
    });

    // Chain all the segment streams together
    const concatFilter = relevantTranscription.map((_, index) => `[v${index}]`).join('') + `concat=n=${relevantTranscription.length}:v=1:a=0[outv]`;
    filterComplex += concatFilter;

    const tempVideoPath = path.join(tempDir, 'temp_video.mp4');

    // Execute the complex filter in one go
    const videoProcessingCommand = `ffmpeg -y -i "${originalVideoPath}" -filter_complex "${filterComplex}" -map "[outv]" -c:v libx264 -preset veryfast "${tempVideoPath}"`;
    console.log('Processing video with filter_complex...');
    allFfmpegCommands = videoProcessingCommand + "\n\n";
    execSync(videoProcessingCommand, { stdio: 'inherit' });

    // Extract the audio from the original clip duration
    const clipDuration = clipEndTime - clipStartTime;
    const tempAudioPath = path.join(tempDir, 'temp_audio.aac');
    const audioCommand = `ffmpeg -y -ss ${clipStartTime} -t ${clipDuration} -i "${originalVideoPath}" -vn -c:a aac "${tempAudioPath}"`;
    console.log('Extracting audio segment...');
    allFfmpegCommands += audioCommand + "\n\n";
    execSync(audioCommand, { stdio: 'inherit' });

    // Mux the processed video and extracted audio
    const finalCommand = `ffmpeg -y -i "${tempVideoPath}" -i "${tempAudioPath}" -c:v copy -c:a copy -map 0:v:0 -map 1:a:0 -shortest "${outputClipPath}"`;
    console.log('Muxing final video and audio...');
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