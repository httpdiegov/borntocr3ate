'use server';

/**
 * @fileOverview A flow for fetching the values and tags of multiple API keys from Secret Manager.
 */

import { z } from 'zod';
import { getSecretWithMetadata } from '../tools/get-api-key-internal';

const GetApiKeysInputSchema = z.object({
  services: z.array(z.string()).describe('A list of secret names to fetch.'),
});
export type GetApiKeysInput = z.infer<typeof GetApiKeysInputSchema>;

const ApiKeyInfoSchema = z.object({
  value: z.string().optional(),
  tags: z.array(z.string()),
});

const GetApiKeysOutputSchema = z.object({
  keys: z.record(ApiKeyInfoSchema).describe('A map of secret names to their values and tags.'),
});
export type GetApiKeysOutput = z.infer<typeof GetApiKeysOutputSchema>;

export async function getApiKeys(input: GetApiKeysInput): Promise<GetApiKeysOutput> {
  const keyPromises = input.services.map(async (service) => {
    try {
      const secretInfo = await getSecretWithMetadata(service);
      return { service, secretInfo };
    } catch (error) {
      // If a secret is not found, we just return null for its value.
      return { service, secretInfo: { value: undefined, tags: [] } };
    }
  });

  const results = await Promise.all(keyPromises);
  const keys: Record<string, { value?: string; tags: string[] }> = {};

  results.forEach(item => {
    keys[item.service] = item.secretInfo;
  });

  return { keys };
}
