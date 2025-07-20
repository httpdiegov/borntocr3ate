import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';

config();

// Initialize the plugin without a global API key.
// The key will be provided just-in-time in each generate call.
const googleAIPlugin = googleAI();


export const ai = genkit({
  plugins: [googleAIPlugin],
  model: 'googleai/gemini-1.5-flash',
});
