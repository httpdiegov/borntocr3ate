'use server';

import { z } from 'zod';
import { accessSecret } from './get-api-key-internal';

const ApiKeyInputSchema = z.object({
  service: z
    .enum(['youtube_api_key', 'instagram_access_token', 'instagram_business_account_id', 'GEMINI_API_KEY'])
    .describe('The service for which to retrieve the API key.'),
});

// This is now a regular server function, not a Genkit tool.
export async function getApiKey(input: z.infer<typeof ApiKeyInputSchema>): Promise<string | undefined> {
  console.log(`Getting API Key for ${input.service}`);
  return accessSecret(input.service);
}
