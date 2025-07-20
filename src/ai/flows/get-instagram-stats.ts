'use server';

/**
 * @fileOverview A flow for fetching Instagram profile statistics.
 *
 * - getInstagramStats - A function that fetches statistics for an Instagram profile.
 * - GetInstagramStatsInput - The input type for the getInstagramStats function.
 * - GetInstagramStatsOutput - The return type for the getInstagramStats function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GetInstagramStatsInputSchema = z.object({
  accessToken: z.string().describe('The Instagram Graph API access token.'),
});
export type GetInstagramStatsInput = z.infer<typeof GetInstagramStatsInputSchema>;

const GetInstagramStatsOutputSchema = z.object({
    username: z.string().describe('The username of the account.'),
    mediaCount: z.number().describe('The number of media objects on the account (placeholder).'),
    followersCount: z.string().describe('The number of followers (placeholder).'), 
    profilePicUrl: z.string().describe('The URL of the profile picture (placeholder).'),
});
export type GetInstagramStatsOutput = z.infer<typeof GetInstagramStatsOutputSchema>;

async function fetchInstagramData(input: GetInstagramStatsInput): Promise<GetInstagramStatsOutput> {
  // The Basic Display API only provides 'id' and 'username'. 'media_count' is not available.
  const url = `https://graph.instagram.com/me?fields=username&access_token=${input.accessToken}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Instagram API Error:', errorData);
      throw new Error(`Error from Instagram API: ${errorData.error.message} (Code: ${errorData.error.code})`);
    }
    const data = await response.json();

    return {
      username: data.username,
      // Placeholder data as media_count and followers_count are not available in the Basic Display API
      mediaCount: 1337, 
      followersCount: '1.2M', 
      profilePicUrl: 'https://placehold.co/80x80.png',
    };
  } catch (error: any) {
    console.error("Failed to fetch Instagram data:", error.message);
    // Re-throw the error to be caught by the client component
    throw new Error(error.message || 'An unknown error occurred while fetching Instagram data.');
  }
}

export const getInstagramStats = ai.defineFlow(
  {
    name: 'getInstagramStatsFlow',
    inputSchema: GetInstagramStatsInputSchema,
    outputSchema: GetInstagramStatsOutputSchema,
  },
  fetchInstagramData
);
