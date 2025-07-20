'use server';

/**
 * @fileOverview A flow for fetching Instagram profile statistics using mock data.
 *
 * - getInstagramStats - A function that returns mock statistics for an Instagram profile.
 * - GetInstagramStatsInput - The input type for the getInstagramStats function.
 * - GetInstagramStatsOutput - The return type for the getInstagramStats function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GetInstagramStatsInputSchema = z.object({
  // No input needed as we are returning mock data.
});
export type GetInstagramStatsInput = z.infer<typeof GetInstagramStatsInputSchema>;

const GetInstagramStatsOutputSchema = z.object({
    username: z.string().describe('The username of the account.'),
    mediaCount: z.number().describe('The number of media objects on the account (placeholder).'),
    followersCount: z.string().describe('The number of followers (placeholder).'), 
    profilePicUrl: z.string().describe('The URL of the profile picture (placeholder).'),
});
export type GetInstagramStatsOutput = z.infer<typeof GetInstagramStatsOutputSchema>;

// This function returns mock data.
async function fetchInstagramData(input: GetInstagramStatsInput): Promise<GetInstagramStatsOutput> {
  return {
    username: 'ilovesanrio666',
    mediaCount: 1337,
    followersCount: '1.2M',
    profilePicUrl: 'https://placehold.co/80x80.png',
  };
}

export const getInstagramStats = ai.defineFlow(
  {
    name: 'getInstagramStatsFlow',
    inputSchema: GetInstagramStatsInputSchema,
    outputSchema: GetInstagramStatsOutputSchema,
  },
  async (input) => {
    return fetchInstagramData(input);
  }
);
