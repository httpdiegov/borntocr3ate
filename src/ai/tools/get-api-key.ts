'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const ApiKeyInputSchema = z.object({
  service: z
    .enum(['youtube_api_key', 'instagram_access_token', 'instagram_business_account_id'])
    .describe('The service for which to retrieve the API key.'),
});

const secretManagerClient = new SecretManagerServiceClient();

async function accessSecret(secretName: string): Promise<string | undefined> {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    console.error('GCLOUD_PROJECT environment variable not set.');
    return undefined;
  }
  
  try {
    const [version] = await secretManagerClient.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
    });

    const payload = version.payload?.data?.toString();
    if (!payload) {
      console.warn(`Secret ${secretName} has no payload.`);
    }
    return payload;
  } catch (error) {
    console.error(`Failed to access secret ${secretName}:`, error);
    return undefined;
  }
}

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
