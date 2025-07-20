import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { accessSecret } from './tools/get-api-key-internal';

// This function now initializes the plugin with a function that resolves the apiKey promise.
// Genkit will call this function to get the key just before making an API call.
// This ensures that even if the key is updated, the next call will use the new one.
const googleAIPlugin = googleAI({
  apiKey: () => accessSecret('GEMINI_API_KEY'),
});


export const ai = genkit({
  plugins: [googleAIPlugin],
  model: 'googleai/gemini-2.0-flash',
});
