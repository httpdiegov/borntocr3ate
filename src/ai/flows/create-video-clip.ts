
'use server';

/**
 * @fileOverview A flow for creating a vertical video clip from a larger video using ffmpeg.
 * Now includes dynamic cropping based on transcription segments.
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

const TranscriptionSegmentSchema = z.object({
    speakerId: z.string(),
    startTime: z.number(),
    endTime: z.number(),
});

const CreateVideoClipInputSchema = z.object({
  videoUrl: z.string().url().describe('The public URL of the original horizontal video.'),
  clipStartTime: z.number().describe('Start time of the clip in seconds.'),
  clipEndTime: z.number().describe('End time of the clip in seconds.'),
  clipTitle: z.string().describe('The title of the clip, used for the output filename.'),
  speakers: z.array(SpeakerSchema).describe('List of all speakers identified in the video.'),
  transcription: z.array(TranscriptionSegmentSchema).describe('Transcription segments with speaker IDs and timings.'),
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
  const { videoUrl, clipStartTime, clipEndTime, clipTitle, speakers, transcription } = input;
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

    const duration = clipEndTime - clipStartTime;

    // Filter transcription to only include segments within our clip's timeframe
    const clipTranscription = transcription.filter(
        (seg) => seg.startTime >= clipStartTime && seg.endTime <= clipEndTime
    );

    // Generate the complex filtergraph for dynamic cropping
    let complexFilter = "";
    clipTranscription.forEach((segment, index) => {
        const speaker = speakers.find(s => s.id === segment.speakerId);
        if (!speaker) return;

        const segmentStartTime = segment.startTime - clipStartTime; // Time relative to the clip start
        const segmentEndTime = segment.endTime - clipStartTime;

        let crop_x: string;
        // Center the 9:16 crop on the speaker
        switch (speaker.position) {
            case 'izquierda':
                crop_x = 'iw*0.25 - (ih*9/16)/2'; // Center of the left half
                break;
            case 'derecha':
                crop_x = 'iw*0.75 - (ih*9/16)/2'; // Center of the right half
                break;
            case 'centro':
            default:
                crop_x = '(iw-ih*9/16)/2'; // Center of the full video
                break;
        }

        // Apply a subtle zoom and pan to keep the face centered
        // Zooms in to 1.1x over 4 seconds, then stays there.
        const zoom = "1.1";
        const pan_duration = 4;
        const pan_x = `'(iw/2) - (iw/2)/${zoom}'`;
        const pan_y = `'(ih/2) - (ih/2)/${zoom}'`;

        // We build a chain of filters. Each segment gets its own crop.
        complexFilter += `[0:v]trim=${segmentStartTime}:${segmentEndTime},setpts=PTS-STARTPTS,crop=ih*9/16:ih:x=${crop_x},zoompan=z='min(zoom+0.0015,${zoom})':d=1:x=${pan_x}:y=${pan_y}:s=1080x1920,setpts=PTS-STARTPTS[v${index}]; `;
    });

    const concatInputs = clipTranscription.map((_, index) => `[v${index}]`).join('');
    complexFilter += `${concatInputs}concat=n=${clipTranscription.length}:v=1:a=0[v_out]`;
    
    // Command to cut the main audio and combine it with the dynamically cropped video
    ffmpegCommand = `ffmpeg -y -i "${originalVideoPath}" -ss ${clipStartTime} -t ${duration} -filter_complex "${complexFilter}" -map "[v_out]" -map 0:a? -c:a copy "${outputClipPath}"`;
    
    console.log(`Generated dynamic ffmpeg command: ${ffmpegCommand}`);

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
    // Include stderr in the error message if available
    const errorMessage = error.stderr ? error.stderr.toString() : error.message;
    return { success: false, message: `Failed to create clip: ${errorMessage}`, ffmpegCommand };
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
