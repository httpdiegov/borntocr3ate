'use server';

/**
 * @fileOverview A flow for fetching the values of multiple API keys from Secret Manager.
 */

import { z } from 'zod';
import { accessSecret } from '../tools/get-api-key-internal';

const GetApiKeysInputSchema = z.object({
  services: z.array(z.string()).describe('A list of secret names to fetch.'),
});
export type GetApiKeysInput = z.infer<typeof GetApiKeysInputSchema>;

const GetApiKeysOutputSchema = z.object({
  keys: z.record(z.string()).describe('A map of secret names to their values.'),
});
export type GetApiKeysOutput = z.infer<typeof GetApiKeysOutputSchema>;

export async function getApiKeys(input: GetApiKeysInput): Promise<GetApiKeysOutput> {
  const keyPromises = input.services.map(async (service) => {
    try {
      const secret = await accessSecret(service);
      return { service, secret: secret || null };
    } catch (error) {
      // If a secret is not found, we just return null for its value.
      return { service, secret: null };
    }
  });

  const results = await Promise.all(keyPromises);
  const keys: Record<string, string> = {};

  results.forEach(item => {
    if (item.secret) {
      keys[item.service] = item.secret;
    }
  });

  return { keys };
}
