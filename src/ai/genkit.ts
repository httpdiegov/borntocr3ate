import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';

config();

// Initialize the plugin with the API key from environment variables.
// This is a more direct way for debugging authentication issues.
const googleAIPlugin = googleAI({
  apiKey: process.env.GEMINI_API_KEY,
});


export const ai = genkit({
  plugins: [googleAIPlugin],
  model: 'googleai/gemini-2.0-flash',
});
