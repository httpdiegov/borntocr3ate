
'use server';

/**
 * @fileOverview A flow for creating a vertical video clip from a larger video using ffmpeg.
 * This version uses a robust, single-command `filter_complex` approach to ensure perfect sync
 * and adds dynamic, styled subtitles to the output video.
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

// Define the schema for a segment of the transcription
const FullTranscriptionSegmentSchema = z.object({
    speakerId: z.string().describe('The ID of the speaker for this segment.'),
    text: z.string().describe('The transcribed text.'),
    startTime: z.number().describe('Start time in seconds.'),
    endTime: z.number().describe('End time in seconds.'),
});

// Schema for the smaller, formatted subtitle segments
const SubtitleSegmentSchema = z.object({
    text: z.string(),
    startTime: z.number(),
    endTime: z.number(),
});


const CreateVideoClipInputSchema = z.object({
  videoUrl: z.string().url().describe('The public URL of the original horizontal video.'),
  clipStartTime: z.number().describe('Start time of the clip in seconds.'),
  clipEndTime: z.number().describe('End time of the clip in seconds.'),
  clipTitle: z.string().describe('The title of the clip, used for the output filename.'),
  clipTranscription: z.string().describe('The exact transcription of the clip.'),
  speakers: z.array(SpeakerSchema).describe('List of all speakers identified in the video, with their fixed face coordinates.'),
  fullTranscription: z.array(FullTranscriptionSegmentSchema).describe('The full transcription of the video with speaker IDs and timings.'),
});
export type CreateVideoClipInput = z.infer<typeof CreateVideoClipInputSchema>;

const CreateVideoClipOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    filePath: z.string().optional().describe("The local path where the video was saved."),
    ffmpegCommand: z.string().describe("A summary of the ffmpeg commands that were generated.")
});
export type CreateVideoClipOutput = z.infer<typeof CreateVideoClipOutputSchema>;

// Helper function to escape text for ffmpeg filter
const escapeFfmpegText = (text: string) => {
    return text.replace(/[\\:']/g, '\\$&').replace(/"/g, '\\"');
};

/**
 * Splits the full transcription into smaller, timed chunks suitable for viral-style subtitles.
 * @param fullText The full transcription of the clip.
 * @param clipStartTime The start time of the clip.
 * @param clipEndTime The end time of the clip.
 * @returns An array of SubtitleSegment objects.
 */
function createSubtitleSegments(fullText: string, clipStartTime: number, clipEndTime: number): z.infer<typeof SubtitleSegmentSchema>[] {
    const words = fullText.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];

    const totalDuration = clipEndTime - clipStartTime;
    const durationPerWord = totalDuration / words.length;

    const segments: z.infer<typeof SubtitleSegmentSchema>[] = [];
    let chunk: string[] = [];
    let chunkStartTime = clipStartTime;

    for (let i = 0; i < words.length; i++) {
        chunk.push(words[i]);
        if (chunk.length === 3 || i === words.length - 1) {
            const segmentText = chunk.join(' ');
            const segmentEndTime = chunkStartTime + (chunk.length * durationPerWord);
            segments.push({
                text: segmentText,
                startTime: chunkStartTime - clipStartTime, // Relative to clip start
                endTime: segmentEndTime - clipStartTime,   // Relative to clip start
            });
            chunkStartTime = segmentEndTime;
            chunk = [];
        }
    }

    return segments;
}


async function createClip(input: CreateVideoClipInput): Promise<CreateVideoClipOutput> {
  const { videoUrl, clipStartTime, clipEndTime, clipTitle, clipTranscription, fullTranscription } = input;
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

    const relevantTranscriptionForPanning = fullTranscription.filter(
        (seg) => seg.startTime < clipEndTime && seg.endTime > clipStartTime
    ).sort((a, b) => a.startTime - b.startTime);
    
    if (relevantTranscriptionForPanning.length === 0) {
      throw new Error("No transcription segments found in the specified time range to create a clip.");
    }
    
    const subtitleSegments = createSubtitleSegments(clipTranscription, clipStartTime, clipEndTime);

    const speakerPositions = new Map(input.speakers.map(s => [s.id, s.faceCoordinates]));

    const ih = 1080;
    const iw = 1920;
    const cropWidth = Math.floor(ih * 9 / 16);
    const panDuration = 1.0; 
    const panHalf = panDuration / 2;

    const keyframes: { time: number; cropX: number }[] = [];
    if (relevantTranscriptionForPanning.length > 0) {
        for (const segment of relevantTranscriptionForPanning) {
            const speakerPos = speakerPositions.get(segment.speakerId);
            if (!speakerPos) continue; 

            const cropX = Math.max(0, Math.min(iw - cropWidth, Math.floor(speakerPos.x * iw - cropWidth / 2)));
            if (keyframes.length === 0 || Math.abs(cropX - keyframes[keyframes.length - 1].cropX) > 5) {
                keyframes.push({ time: segment.startTime, cropX });
            }
        }
        if (keyframes.length === 0 && relevantTranscriptionForPanning.length > 0) {
             const firstSpeakerPos = speakerPositions.get(relevantTranscriptionForPanning[0].speakerId);
             if (firstSpeakerPos) {
                const cropX = Math.max(0, Math.min(iw - cropWidth, Math.floor(firstSpeakerPos.x * iw - cropWidth / 2)));
                keyframes.push({ time: relevantTranscriptionForPanning[0].startTime, cropX });
             }
        }
    }

    let x_expr: string;
    if (keyframes.length <= 1) {
        const cropX = keyframes.length > 0 ? keyframes[0].cropX : (iw - cropWidth) / 2;
        x_expr = `${cropX}`;
    } else {
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

    const subtitlesFilter = subtitleSegments.map(sub => {
        const text = escapeFfmpegText(sub.text.toUpperCase());
        const start = sub.startTime;
        const end = sub.endTime;
        const duration = end - start;
        // Fade in/out duration for subtitles
        const fadeDuration = Math.min(0.2, duration / 4);

        // This creates the "viral" subtitle look
        return `drawtext=text='${text}':fontfile='C\\:/Windows/Fonts/arialbd.ttf':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=(h*0.85)-text_h/2:box=1:boxcolor=black@0.5:boxborderw=20:enable='between(t,${start},${end})':alpha='if(lt(t,${start}+${fadeDuration}),(t-${start})/${fadeDuration},if(lt(t,${end}-${fadeDuration}),1,((${end}-t))/${fadeDuration}))'`;
    }).join(',');

    const clipDuration = clipEndTime - clipStartTime;
    const tempVideoPath = path.join(tempDir, 'temp_video.mp4');

    const videoProcessingCommand = `ffmpeg -y -ss ${clipStartTime} -t ${clipDuration} -i "${originalVideoPath}" -vf "crop=${cropWidth}:${ih}:x='${x_expr}':y=0,scale=1080:1920,setsar=1,${subtitlesFilter}" -c:v libx264 -preset veryfast -an "${tempVideoPath}"`;
    
    console.log('Processing video with smooth panning and subtitles...');
    allFfmpegCommands = videoProcessingCommand + "\n\n";
    execSync(videoProcessingCommand, { stdio: 'inherit' });

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
