'use server';

/**
 * @fileOverview A flow for fetching Instagram profile statistics using the Business Discovery API.
 *
 * - getInstagramBusinessStats - A function that fetches statistics for a given Instagram Business Account.
 * - GetInstagramBusinessStatsInput - The input type for the function.
 * - GetInstagramBusinessStatsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GetInstagramBusinessStatsInputSchema = z.object({
  usernameToQuery: z.string().describe('The username of the Instagram Business Account to query.'),
  instagramBusinessAccountId: z.string().describe('The ID of your own Instagram Business Account making the request.'),
  accessToken: z.string().describe('A valid Instagram Graph API access token.'),
});
export type GetInstagramBusinessStatsInput = z.infer<typeof GetInstagramBusinessStatsInputSchema>;

const GetInstagramBusinessStatsOutputSchema = z.object({
  username: z.string().describe('The username of the account.'),
  mediaCount: z.number().describe('The number of media objects on the account.'),
  followersCount: z.number().describe('The number of followers.'),
  profilePicUrl: z.string().optional().describe('The URL of the profile picture.'),
});
export type GetInstagramBusinessStatsOutput = z.infer<typeof GetInstagramBusinessStatsOutputSchema>;

async function fetchBusinessDiscoveryData(input: GetInstagramBusinessStatsInput): Promise<GetInstagramBusinessStatsOutput> {
  const fields = 'business_discovery.username(' + input.usernameToQuery + '){followers_count,media_count,profile_picture_url,username}';
  const url = `https://graph.facebook.com/v20.0/${input.instagramBusinessAccountId}?fields=${fields}&access_token=${input.accessToken}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Instagram API Error:', errorData);
      throw new Error(`Error from Instagram API: ${errorData.error.message} (Code: ${errorData.error.code})`);
    }
    const data = await response.json();
    const discoveryData = data.business_discovery;

    if (!discoveryData) {
      throw new Error(`Could not find business discovery data for user '${input.usernameToQuery}'. Make sure it is a Business or Creator account.`);
    }

    return {
      username: discoveryData.username,
      profilePicUrl: discoveryData.profile_picture_url,
      followersCount: discoveryData.followers_count,
      mediaCount: discoveryData.media_count,
    };
  } catch (error: any) {
    console.error("Failed to fetch Instagram Business Discovery data:", error);
    throw new Error(error.message || 'An unknown error occurred while fetching Instagram data.');
  }
}

export const getInstagramBusinessStats = ai.defineFlow(
  {
    name: 'getInstagramBusinessStatsFlow',
    inputSchema: GetInstagramBusinessStatsInputSchema,
    outputSchema: GetInstagramBusinessStatsOutputSchema,
  },
  fetchBusinessDiscoveryData
);
