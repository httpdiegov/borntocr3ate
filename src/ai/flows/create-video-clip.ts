
'use server';

/**
 * @fileOverview A flow for creating a vertical video clip from a larger video using ffmpeg.
 * This version uses a robust "cut and concatenate" method for maximum compatibility.
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

// Define the schema for a segment of the transcription, now required for dynamic cropping
const TranscriptionSegmentSchema = z.object({
    speakerId: z.string().describe('The ID of the speaker for this segment.'),
    text: z.string().describe('The transcribed text.'), // Keep text for context, though not used by ffmpeg
    startTime: z.number().describe('Start time in seconds.'),
    endTime: z.number().describe('End time in seconds.'),
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
    ffmpegCommand: z.string().describe("The final ffmpeg command that was generated.")
});
export type CreateVideoClipOutput = z.infer<typeof CreateVideoClipOutputSchema>;


async function createClip(input: CreateVideoClipInput): Promise<CreateVideoClipOutput> {
  const { videoUrl, clipStartTime, clipEndTime, clipTitle, speakers, transcription } = input;
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

    const clipTranscription = transcription.filter(
        (seg) => seg.startTime >= clipStartTime && seg.endTime <= clipEndTime && seg.endTime > seg.startTime
    );

    if (clipTranscription.length === 0) {
      console.warn("No transcription segments found for dynamic cropping. Defaulting to a simple center crop.");
      const duration = clipEndTime - clipStartTime;
      const cropFilter = "crop=w=ih*9/16:h=ih:x=(iw-ih*9/16)/2:y=0,scale=1080:1920,setsar=1";
      finalFfmpegCommand = `ffmpeg -y -i "${originalVideoPath}" -ss ${clipStartTime} -t ${duration} -vf "${cropFilter}" -c:v libx264 -preset veryfast -c:a aac "${outputClipPath}"`;
      console.log(`Executing FFmpeg command: ${finalFfmpegCommand}`);
      execSync(finalFfmpegCommand);
    } else {
        const tempClips: string[] = [];
        const concatListPath = path.join(tempDir, 'concat_list.txt');

        for (let i = 0; i < clipTranscription.length; i++) {
          const segment = clipTranscription[i];
          const speaker = speakers.find(s => s.id === segment.speakerId);
          let x_expr: string;

          switch (speaker?.position) {
              case 'izquierda':
                  x_expr = 'iw*0.25 - (ih*9/16)/2'; // Center of the left half
                  break;
              case 'derecha':
                  x_expr = 'iw*0.75 - (ih*9/16)/2'; // Center of the right half
                  break;
              case 'centro':
              default:
                  x_expr = '(iw-ih*9/16)/2'; // Center of the full video
                  break;
          }

          const tempClipPath = path.join(tempDir, `temp_clip_${i}.ts`);
          const cropFilter = `crop=w=ih*9/16:h=ih:x=${x_expr}:y=0,scale=1080:1920,setsar=1`;
          const duration = segment.endTime - segment.startTime;

          const cutCommand = `ffmpeg -y -ss ${segment.startTime} -i "${originalVideoPath}" -t ${duration} -vf "${cropFilter}" -c:v libx264 -preset veryfast -c:a aac -f mpegts "${tempClipPath}"`;
          
          console.log(`Generating segment ${i}: ${cutCommand}`);
          execSync(cutCommand);
          tempClips.push(tempClipPath);
          fs.appendFileSync(concatListPath, `file '${tempClipPath}'\n`);
        }
        
        finalFfmpegCommand = `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${outputClipPath}"`;
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

export const createVideoClip = ai.defineFlow(
    {
        name: 'createVideoClipFlow',
        inputSchema: CreateVideoClipInputSchema,
        outputSchema: CreateVideoClipOutputSchema,
    },
    createClip
);
