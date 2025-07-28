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
  duration: z.string().optional(),
});

const GetYoutubeVideosOutputSchema = z.object({
  videos: z.array(VideoSchema),
});
export type GetYoutubeVideosOutput = z.infer<typeof GetYoutubeVideosOutputSchema>;

// Helper function to format ISO 8601 duration to MM:SS
const formatDuration = (duration: string) => {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '0:00';

    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    const finalMinutes = Math.floor(totalSeconds / 60);
    const finalSeconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}:${String(finalMinutes).padStart(2, '0')}:${String(finalSeconds).padStart(2, '0')}`;
    }

    return `${finalMinutes}:${String(finalSeconds).padStart(2, '0')}`;
};

export async function getYoutubeVideos(input: GetYoutubeVideosInput): Promise<GetYoutubeVideosOutput> {
  const apiKey = await getApiKey({ service: 'youtube_api_key' });
  if (!apiKey) {
    throw new Error('YouTube API key not found. Please ensure it is set correctly in Secret Manager.');
  }

  const { channelId, maxResults } = input;
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${maxResults}&order=date&type=video&key=${apiKey}`;

  try {
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      console.error('YouTube API Error (Search):', errorData);
      throw new Error(`YouTube API request failed: ${errorData.error.message}`);
    }
    const searchData = await searchResponse.json();
    const videoIds = searchData.items.map((item: any) => item.id.videoId);

    if (videoIds.length === 0) {
      return { videos: [] };
    }

    // Fetch video details to get duration
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`;
    const detailsResponse = await fetch(detailsUrl);
     if (!detailsResponse.ok) {
      const errorData = await detailsResponse.json();
      console.error('YouTube API Error (Videos):', errorData);
      throw new Error(`YouTube API request failed: ${errorData.error.message}`);
    }
    const detailsData = await detailsResponse.json();

    const videosById = new Map(detailsData.items.map((item: any) => [item.id, item]));

    const videos = searchData.items.map((item: any) => {
        const videoDetails = videosById.get(item.id.videoId);
        return {
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnailUrl: item.snippet.thumbnails.high.url,
            duration: videoDetails ? formatDuration(videoDetails.contentDetails.duration) : undefined,
        }
    });

    return { videos };
  } catch (error: any) {
    console.error("Failed to fetch channel videos:", error);
    throw new Error(error.message || 'An unknown error occurred while fetching channel videos.');
  }
}
