'use server';

/**
 * @fileOverview A flow for updating API keys in a secure store.
 * This flow now writes the key to Google Secret Manager and can add multiple tags as labels.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import fs from 'fs';
import path from 'path';

// Helper function to initialize the client just-in-time
function getSecretManagerClient() {
  const credentialsPath = path.resolve(process.cwd(), 'google-credentials.json');

  if (fs.existsSync(credentialsPath)) {
    console.log("Found google-credentials.json, using it for update-api-key flow.");
    return new SecretManagerServiceClient({
      keyFilename: credentialsPath,
    });
  } else {
    console.log("google-credentials.json not found, using default application credentials for update-api-key flow.");
    // This will work in a deployed Firebase/Google Cloud environment
    return new SecretManagerServiceClient();
  }
}

const UpdateApiKeyInputSchema = z.object({
  service: z.string().describe('The name of the secret to create or update (e.g., youtube_api_key).'),
  value: z.string().describe('The new API key value.'),
  tags: z.array(z.string()).optional().describe('Optional tags to categorize the secret (e.g., ["IA", "redes sociales"]).'),
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

  if (!input.service || !input.value) {
    return { success: false, message: 'Service name and value cannot be empty.' };
  }

  const secretManagerClient = getSecretManagerClient();
  const secretName = input.service;
  const parent = `projects/${projectId}`;
  const secretPath = `${parent}/secrets/${secretName}`;
  
  // Create labels from tags
  const labels: Record<string, string> = {};
  if (input.tags && input.tags.length > 0) {
    input.tags.forEach(tag => {
      const labelKey = `tag-${tag.toLowerCase().replace(/\s+/g, '-')}`;
      labels[labelKey] = "true";
    });
  }


  try {
    // Check if secret exists, if not, create it
    try {
      await secretManagerClient.getSecret({ name: secretPath });
      console.log(`Secret ${secretName} exists. Updating labels...`);
      await secretManagerClient.updateSecret({
        secret: {
          name: secretPath,
          labels: labels,
        },
        updateMask: {
          paths: ['labels'],
        },
      });
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
            labels: labels,
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
    return { success: true, message: `Successfully updated secret for ${secretName}.` };
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