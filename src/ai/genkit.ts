import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { accessSecret } from './tools/get-api-key-internal';

async function initializeGoogleAI() {
    const apiKey = await accessSecret('GEMINI_API_KEY');
    return googleAI({ apiKey });
}

export const ai = genkit({
  plugins: [await initializeGoogleAI()],
  model: 'googleai/gemini-2.0-flash',
});
