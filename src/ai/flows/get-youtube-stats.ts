'use server';

/**
 * @fileOverview A flow for fetching YouTube channel statistics.
 *
 * - getYoutubeStats - A function that fetches statistics for a given YouTube channel.
 * - GetYoutubeStatsInput - The input type for the getYoutubeStats function.
 * - GetYoutubeStatsOutput - The return type for the getYoutubeStats function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getApiKey } from '../tools/get-api-key';

const GetYoutubeStatsInputSchema = z.object({
  channelHandle: z.string().describe('The handle of the YouTube channel (e.g., @transdavismo).'),
});
export type GetYoutubeStatsInput = z.infer<typeof GetYoutubeStatsInputSchema>;

const GetYoutubeStatsOutputSchema = z.object({
  name: z.string().describe('The name of the channel.'),
  profilePicUrl: z.string().describe('The URL of the profile picture.'),
  subscriberCount: z.string().describe('The number of subscribers.'),
  videoCount: z.string().describe('The total number of videos.'),
  viewCount: z.string().describe('The total number of views.'),
});
export type GetYoutubeStatsOutput = z.infer<typeof GetYoutubeStatsOutputSchema>;

export const getYoutubeStats = ai.defineFlow(
  {
    name: 'getYoutubeStatsFlow',
    inputSchema: GetYoutubeStatsInputSchema,
    outputSchema: GetYoutubeStatsOutputSchema,
  },
  async (input) => {
    const apiKey = await getApiKey({ service: 'youtube_api_key' });
    if (!apiKey) {
      throw new Error('YouTube API key not found. Please ensure it is set correctly in Secret Manager.');
    }

    const handle = input.channelHandle.startsWith('@') ? input.channelHandle.substring(1) : input.channelHandle;
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${handle}&key=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('YouTube API Error:', errorData);
        throw new Error(`YouTube API request failed: ${errorData.error.message}`);
      }
      const data = await response.json();
      const item = data.items?.[0];

      if (!item) {
        throw new Error(`Channel with handle '${input.channelHandle}' not found.`);
      }

      // Function to format large numbers
      const formatNumber = (numStr: string): string => {
          const num = parseInt(numStr, 10);
          if (num >= 1000000) {
              return (num / 1000000).toFixed(1) + 'M';
          }
          if (num >= 1000) {
              return (num / 1000).toFixed(1) + 'K';
          }
          return num.toString();
      };

      return {
        name: item.snippet.title,
        profilePicUrl: item.snippet.thumbnails.high.url,
        subscriberCount: formatNumber(item.statistics.subscriberCount),
        videoCount: formatNumber(item.statistics.videoCount),
        viewCount: formatNumber(item.statistics.viewCount),
      };
    } catch (error: any) {
      console.error("Failed to fetch channel data:", error);
      throw new Error(error.message || 'An unknown error occurred while fetching channel data.');
    }
  }
);