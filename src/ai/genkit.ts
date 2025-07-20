import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { accessSecret } from './tools/get-api-key-internal';

// This function now initializes the plugin with an apiKey promise.
// Genkit will resolve this promise before making a call.
// This prevents the app from crashing on startup if the key isn't ready.
const googleAIPlugin = googleAI({
  apiKey: accessSecret('GEMINI_API_KEY'),
});


export const ai = genkit({
  plugins: [googleAIPlugin],
  model: 'googleai/gemini-2.0-flash',
});
