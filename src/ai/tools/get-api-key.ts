import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { accessSecret } from './get-api-key-internal';

const ApiKeyInputSchema = z.object({
  service: z
    .enum(['youtube_api_key', 'instagram_access_token', 'instagram_business_account_id', 'GEMINI_API_KEY'])
    .describe('The service for which to retrieve the API key.'),
});

// This tool fetches an API key from Google Secret Manager.
export const getApiKey = ai.defineTool(
  {
    name: 'getApiKey',
    description: 'Retrieves an API key from a secure store.',
    inputSchema: ApiKeyInputSchema,
    outputSchema: z.string().optional(),
  },
  async (input) => {
    return accessSecret(input.service);
  }
);
