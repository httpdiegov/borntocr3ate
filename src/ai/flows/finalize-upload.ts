
'use server';

/**
 * @fileOverview A flow for making an uploaded GCS file public.
 */

import { z } from 'zod';
import { Storage } from '@google-cloud/storage';
import { ai } from '@/ai/genkit';
import fs from 'fs';
import path from 'path';

// Helper function to initialize the client just-in-time
function getStorageClient() {
  const credentialsPath = path.resolve(process.cwd(), 'google-credentials.json');

  if (fs.existsSync(credentialsPath)) {
    return new Storage({ keyFilename: credentialsPath });
  } else {
    return new Storage();
  }
}

const FinalizeUploadInputSchema = z.object({
  gcsUri: z.string().refine(
    (uri) => uri.startsWith('gs://'), 
    { message: "Invalid GCS URI format. Must start with 'gs://'." }
  ).describe('The GCS URI of the file to make public.'),
});
export type FinalizeUploadInput = z.infer<typeof FinalizeUploadInputSchema>;

const FinalizeUploadOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type FinalizeUploadOutput = z.infer<typeof FinalizeUploadOutputSchema>;

async function makeFilePublic(input: FinalizeUploadInput): Promise<FinalizeUploadOutput> {
  try {
    const { gcsUri } = input;
    // Extract bucket name and filename from the URI
    const [bucketName, ...filePathParts] = gcsUri.replace('gs://', '').split('/');
    const filename = filePathParts.join('/');

    if (!bucketName || !filename) {
      throw new Error('Invalid GCS URI format.');
    }
    
    console.log(`Making gs://${bucketName}/${filename} public.`);

    const storage = getStorageClient();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filename);

    await file.makePublic();
    
    console.log(`File ${filename} is now public.`);
    return { success: true, message: 'File is now public.' };

  } catch (error: any) {
    console.error('Failed to make file public:', error);
    return { success: false, message: `Failed to make file public: ${error.message}` };
  }
}

export const finalizeUpload = ai.defineFlow(
    {
        name: 'finalizeUploadFlow',
        inputSchema: FinalizeUploadInputSchema,
        outputSchema: FinalizeUploadOutputSchema,
    },
    makeFilePublic
);
