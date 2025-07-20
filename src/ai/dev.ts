'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-news-brief.ts';
import '@/ai/flows/get-youtube-stats.ts';
import '@/ai/flows/get-instagram-business-stats.ts';
import '@/ai/tools/get-api-key';
import '@/ai/flows/update-api-key';
