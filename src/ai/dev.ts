'use server';
import { config } from 'dotenv';
config();

import '@/ai/genkit';
import '@/ai/flows/generate-news-brief.ts';
import '@/ai/flows/get-youtube-stats.ts';
import '@/ai/flows/get-instagram-business-stats.ts';
import '@/ai/tools/get-api-key';
import '@/ai/flows/update-api-key';
import '@/ai/flows/are-api-keys-set';
import '@/ai/flows/get-api-keys'; 
import '@/ai/flows/analyze-video-content';
import '@/ai/flows/transcribe-video';
import '@/ai/flows/generate-upload-url';
import '@/ai/flows/finalize-upload';
import './tools/get-api-key-internal';
