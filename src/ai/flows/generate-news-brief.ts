'use server';

/**
 * @fileOverview An AI agent for generating personalized news briefs based on user interests.
 *
 * - generateNewsBrief - A function that generates a news brief.
 * - GenerateNewsBriefInput - The input type for the generateNewsBrief function.
 * - GenerateNewsBriefOutput - The return type for the generateNewsBrief function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateNewsBriefInputSchema = z.object({
  interests: z
    .string()
    .describe('A comma-separated list of topics the user is interested in.'),
});
export type GenerateNewsBriefInput = z.infer<typeof GenerateNewsBriefInputSchema>;

const GenerateNewsBriefOutputSchema = z.object({
  newsBrief: z
    .string()
    .describe('A concise news brief based on the user specified interests.'),
});
export type GenerateNewsBriefOutput = z.infer<typeof GenerateNewsBriefOutputSchema>;

export async function generateNewsBrief(input: GenerateNewsBriefInput): Promise<GenerateNewsBriefOutput> {
  return generateNewsBriefFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNewsBriefPrompt',
  input: {schema: GenerateNewsBriefInputSchema},
  output: {schema: GenerateNewsBriefOutputSchema},
  prompt: `You are a personalized news aggregator. You will generate a concise news brief based on the user's specified interests.

  Interests: {{{interests}}}

  News Brief:`,
});

const generateNewsBriefFlow = ai.defineFlow(
  {
    name: 'generateNewsBriefFlow',
    inputSchema: GenerateNewsBriefInputSchema,
    outputSchema: GenerateNewsBriefOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
