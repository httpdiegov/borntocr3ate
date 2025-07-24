
import { z } from 'zod';

export const Word = z.object({
	word: z.string(),
	start: z.number(),
	end: z.number(),
	probability: z.number(),
});

export const Segment = z.object({
    id: z.number(),
    seek: z.number(),
    start: z.number(),
    end: z.number(),
    text: z.string(),
    tokens: z.array(z.number()),
    temperature: z.number(),
    avg_logprob: z.number(),
    compression_ratio: z.number(),
    no_speech_prob: z.number(),
    words: z.array(Word),
});

export const transcriptionSchema = z.object({
	titulo: z.string(),
	segments: z.array(Segment),
});
