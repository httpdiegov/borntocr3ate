'use server';

/**
 * @fileOverview A flow for checking which API keys are set in Secret Manager.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { accessSecret } from '../tools/get-api-key-internal';

const AreApiKeysSetInputSchema = z.object({
  services: z.array(z.string()).describe('A list of secret names to check.'),
});
export type AreApiKeysSetInput = z.infer<typeof AreApiKeysSetInputSchema>;

const AreApiKeysSetOutputSchema = z.object({
  setKeys: z.array(z.string()).describe('A list of the secret names that are set.'),
});
export type AreApiKeysSetOutput = z.infer<typeof AreApiKeysSetOutputSchema>;

export async function areApiKeysSet(input: AreApiKeysSetInput): Promise<AreApiKeysSetOutput> {
  const checkPromises = input.services.map(async (service) => {
    try {
      const secret = await accessSecret(service);
      return secret ? service : null;
    } catch (error) {
      // If accessSecret throws an error (e.g., secret not found), treat it as not set.
      return null;
    }
  });

  const results = await Promise.all(checkPromises);
  const setKeys = results.filter((key): key is string => key !== null);
  
  return { setKeys };
}
