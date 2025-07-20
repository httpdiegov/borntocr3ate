'use server';

/**
 * @fileOverview An AI agent for generating the top news stories of the day.
 *
 * - generateNewsBrief - A function that generates a news brief.
 * - GenerateNewsBriefInput - The input type for the generateNewsBrief function.
 * - GenerateNewsBriefOutput - The return type for the generateNewsBrief function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateNewsBriefInputSchema = z.object({});
export type GenerateNewsBriefInput = z.infer<typeof GenerateNewsBriefInputSchema>;

const NewsItemSchema = z.object({
  title: z.string().describe('The title of the news story.'),
  summary: z.string().describe('A brief summary of the news story.'),
});

const GenerateNewsBriefOutputSchema = z.object({
  newsItems: z
    .array(NewsItemSchema)
    .length(5)
    .describe('A list of the top 5 news stories of the day.'),
});
export type GenerateNewsBriefOutput = z.infer<typeof GenerateNewsBriefOutputSchema>;

export async function generateNewsBrief(input: GenerateNewsBriefInput): Promise<GenerateNewsBriefOutput> {
  return generateNewsBriefFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNewsBriefPrompt',
  input: {schema: GenerateNewsBriefInputSchema},
  output: {schema: GenerateNewsBriefOutputSchema},
  prompt: `You are a world-class news editor. Your task is to provide a summary of the 5 most important news stories of the day.`,
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
