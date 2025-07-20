'use server';

/**
 * @fileOverview A flow for updating API keys in a secure store.
 * This flow now writes the key to Google Secret Manager.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretManagerClient = new SecretManagerServiceClient();

const UpdateApiKeyInputSchema = z.object({
  service: z
    .enum(['youtube_api_key', 'instagram_access_token', 'instagram_business_account_id', 'GEMINI_API_KEY'])
    .describe('The service for which to update the API key.'),
  value: z.string().describe('The new API key value.'),
});
export type UpdateApiKeyInput = z.infer<typeof UpdateApiKeyInputSchema>;

const UpdateApiKeyOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});
export type UpdateApiKeyOutput = z.infer<typeof UpdateApiKeyOutputSchema>;


async function updateApiKeyInSecretManager(input: UpdateApiKeyInput): Promise<UpdateApiKeyOutput> {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    return { success: false, message: 'GCLOUD_PROJECT environment variable not set.' };
  }

  const secretName = input.service;
  const parent = `projects/${projectId}`;
  const secretPath = `${parent}/secrets/${secretName}`;

  try {
    // Check if secret exists, if not, create it
    try {
      await secretManagerClient.getSecret({ name: secretPath });
    } catch (e: any) {
      if (e.code === 5) { // NOT_FOUND
        console.log(`Secret ${secretName} not found. Creating it...`);
        await secretManagerClient.createSecret({
          parent,
          secretId: secretName,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });
        console.log(`Secret ${secretName} created.`);
      } else {
        // Re-throw other errors
        throw e;
      }
    }

    // Add a new version with the provided value
    const [version] = await secretManagerClient.addSecretVersion({
      parent: secretPath,
      payload: {
        data: Buffer.from(input.value, 'utf8'),
      },
    });

    console.log(`Added secret version ${version.name}`);
    return { success: true, message: `Successfully updated ${secretName}.` };
  } catch (error: any) {
    console.error(`Failed to update secret ${secretName}:`, error);
    const errorMessage = error.details || error.message || 'An unknown error occurred.';
    return { success: false, message: `Failed to save secret: ${errorMessage}` };
  }
}


export const updateApiKey = ai.defineFlow(
  {
    name: 'updateApiKeyFlow',
    inputSchema: UpdateApiKeyInputSchema,
    outputSchema: UpdateApiKeyOutputSchema,
  },
  updateApiKeyInSecretManager
);
