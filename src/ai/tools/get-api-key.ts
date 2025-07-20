'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ApiKeyInputSchema = z.object({
  service: z
    .enum(['youtube_api_key', 'instagram_access_token', 'instagram_business_account_id'])
    .describe('The service for which to retrieve the API key.'),
});

// This tool simulates fetching an API key from a secure, server-side store
// like Google Secret Manager or by using environment variables.
// For this example, we'll use environment variables.
export const getApiKey = ai.defineTool(
  {
    name: 'getApiKey',
    description: 'Retrieves an API key from a secure store.',
    inputSchema: ApiKeyInputSchema,
    outputSchema: z.string().optional(),
  },
  async (input) => {
    switch (input.service) {
      case 'youtube_api_key':
        return process.env.YOUTUBE_API_KEY;
      case 'instagram_access_token':
        return process.env.INSTAGRAM_ACCESS_TOKEN;
      case 'instagram_business_account_id':
        return process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
      default:
        return undefined;
    }
  }
);
