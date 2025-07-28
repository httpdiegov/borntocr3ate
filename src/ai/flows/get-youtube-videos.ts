'use server';

/**
 * @fileOverview A flow for fetching the latest videos from a YouTube channel.
 *
 * - getYoutubeVideos - Fetches the latest videos for a given YouTube channel ID.
 * - GetYoutubeVideosInput - The input type for the function.
 * - GetYoutubeVideosOutput - The return type for the function.
 */

import { z } from 'zod';
import { getApiKey } from '../tools/get-api-key';

const GetYoutubeVideosInputSchema = z.object({
  channelId: z.string().describe('The ID of the YouTube channel.'),
  maxResults: z.number().optional().default(6).describe('The maximum number of videos to return.'),
});
export type GetYoutubeVideosInput = z.infer<typeof GetYoutubeVideosInputSchema>;

const VideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  thumbnailUrl: z.string(),
});

const GetYoutubeVideosOutputSchema = z.object({
  videos: z.array(VideoSchema),
});
export type GetYoutubeVideosOutput = z.infer<typeof GetYoutubeVideosOutputSchema>;

export async function getYoutubeVideos(input: GetYoutubeVideosInput): Promise<GetYoutubeVideosOutput> {
  const apiKey = await getApiKey({ service: 'youtube_api_key' });
  if (!apiKey) {
    throw new Error('YouTube API key not found. Please ensure it is set correctly in Secret Manager.');
  }

  const { channelId, maxResults } = input;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${maxResults}&order=date&type=video&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('YouTube API Error (Videos):', errorData);
      throw new Error(`YouTube API request failed: ${errorData.error.message}`);
    }
    const data = await response.json();

    const videos = data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnailUrl: item.snippet.thumbnails.high.url,
    }));

    return { videos };
  } catch (error: any) {
    console.error("Failed to fetch channel videos:", error);
    throw new Error(error.message || 'An unknown error occurred while fetching channel videos.');
  }
}
