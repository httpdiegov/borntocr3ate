
'use server';

/**
 * @fileOverview A flow for creating a vertical video clip from a larger video using ffmpeg.
 * This version uses a robust "cut and concatenate" method with precise, face-centered dynamic cropping.
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
    ffmpegCommand: z.string().describe("The final ffmpeg command that was generated.")
});
export type CreateVideoClipOutput = z.infer<typeof CreateVideoClipOutputSchema>;

type Shot = {
    startTime: number;
    endTime: number;
    speakerId: string;
    faceCoordinates: z.infer<typeof FaceCoordinatesSchema>;
};


async function createClip(input: CreateVideoClipInput): Promise<CreateVideoClipOutput> {
  const { videoUrl, clipStartTime, clipEndTime, clipTitle, transcription } = input;
  let finalFfmpegCommand = 'Error: Command not generated.';

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
      console.warn("No transcription segments found for dynamic cropping. Defaulting to a simple center crop.");
      const clipDuration = clipEndTime - clipStartTime;
      const cropFilter = "crop=w=ih*9/16:h=ih:x=(iw-ih*9/16)/2:y=0,scale=1080:1920,setsar=1";
      finalFfmpegCommand = `ffmpeg -y -ss ${clipStartTime} -i "${originalVideoPath}" -t ${clipDuration} -vf "${cropFilter}" -c:v libx264 -preset veryfast -c:a aac "${outputClipPath}"`;
      execSync(finalFfmpegCommand);

    } else {
        const shots: Shot[] = [];
        let lastKnownCoords = relevantTranscription[0].faceCoordinates;
        let lastSpeakerId = relevantTranscription[0].speakerId;
        let lastEndTime = clipStartTime;

        for (const segment of relevantTranscription) {
            const segmentStart = Math.max(segment.startTime, clipStartTime);
            
            // If there's a silence gap, create a shot for it using the last known speaker and coordinates.
            if (segmentStart > lastEndTime) {
                shots.push({
                    startTime: lastEndTime,
                    endTime: segmentStart,
                    speakerId: lastSpeakerId,
                    faceCoordinates: lastKnownCoords
                });
            }
            
            shots.push({
                startTime: segmentStart,
                endTime: Math.min(segment.endTime, clipEndTime),
                speakerId: segment.speakerId,
                faceCoordinates: segment.faceCoordinates,
            });
            
            lastEndTime = Math.min(segment.endTime, clipEndTime);
            lastSpeakerId = segment.speakerId;
            lastKnownCoords = segment.faceCoordinates;
        }

        // If the last segment doesn't reach the end of the clip, add a final shot.
        if (lastEndTime < clipEndTime) {
            shots.push({
                startTime: lastEndTime,
                endTime: clipEndTime,
                speakerId: lastSpeakerId,
                faceCoordinates: lastKnownCoords
            });
        }
        
        const intermediateFiles: string[] = [];
        const concatFilePath = path.join(tempDir, 'concat.txt');
        
        for (let i = 0; i < shots.length; i++) {
            const shot = shots[i];
            // Skip zero-duration shots
            if (shot.endTime <= shot.startTime) continue;

            const faceX = shot.faceCoordinates.x;
            // The x-coordinate for the crop filter. It's the face's center X (as a fraction of iw) minus half the desired crop width.
            // We clamp the value to ensure the crop area doesn't go out of bounds.
            const x_expr = `max(0, min(iw - ih*9/16, ${faceX}*iw - (ih*9/16)/2))`;
            
            const shotStartTime = shot.startTime;
            const shotDuration = shot.endTime - shot.startTime;
            const intermediateFilePath = path.join(tempDir, `part_${i}.mp4`);
            intermediateFiles.push(intermediateFilePath);

            // Crop vertically centered on the face, then scale to 1080x1920
            const cropFilter = `crop=w=ih*9/16:h=ih:x=${x_expr}:y=0,scale=1080:1920,setsar=1`;
            
            const segmentCommand = `ffmpeg -y -ss ${shotStartTime} -i "${originalVideoPath}" -t ${shotDuration} -vf "${cropFilter}" -c:v libx264 -preset veryfast -c:a aac "${intermediateFilePath}"`;
            console.log(`Creating segment ${i} (${formatTimestamp(shotStartTime)} -> ${formatTimestamp(shot.endTime)}): ${segmentCommand}`);
            execSync(segmentCommand);
            
            fs.appendFileSync(concatFilePath, `file '${intermediateFilePath.replace(/\\/g, '/')}'\n`);
        }
        
        if (intermediateFiles.length === 0) {
            throw new Error("No video segments could be generated from the shots.");
        }

        finalFfmpegCommand = `ffmpeg -y -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputClipPath}"`;
        console.log(`Concatenating segments: ${finalFfmpegCommand}`);
        execSync(finalFfmpegCommand);
    }

    if (!fs.existsSync(outputClipPath)) {
        throw new Error("ffmpeg command did not produce an output file.");
    }
    
    console.log(`Successfully created clip and saved to: ${outputClipPath}`);
    return { 
        success: true, 
        message: `Clip created successfully! Saved to ${outputClipPath}`,
        filePath: outputClipPath,
        ffmpegCommand: finalFfmpegCommand
    };

  } catch (error: any) {
    console.error('Failed to create video clip:', error);
    const errorMessage = error.stderr ? error.stderr.toString() : error.message;
    return { success: false, message: `Failed to create clip: ${errorMessage}`, ffmpegCommand: finalFfmpegCommand };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function formatTimestamp(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(5, '0')}`;
}

export const createVideoClip = ai.defineFlow(
    {
        name: 'createVideoClipFlow',
        inputSchema: CreateVideoClipInputSchema,
        outputSchema: CreateVideoClipOutputSchema,
    },
    createClip
);
