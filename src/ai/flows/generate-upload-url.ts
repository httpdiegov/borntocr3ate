
'use server';

/**
 * @fileOverview A flow for generating a signed URL to upload a file to Google Cloud Storage.
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
    console.log("Found google-credentials.json, using it for Storage client.");
    return new Storage({
      keyFilename: credentialsPath,
    });
  } else {
    console.log("google-credentials.json not found, using default application credentials for Storage client.");
    // This will work in a deployed Firebase/Google Cloud environment
    return new Storage();
  }
}

const GenerateUploadUrlInputSchema = z.object({
  filename: z.string().describe('The name of the file to upload.'),
  contentType: z.string().describe('The MIME type of the file.'),
});
export type GenerateUploadUrlInput = z.infer<typeof GenerateUploadUrlInputSchema>;

const GenerateUploadUrlOutputSchema = z.object({
  signedUrl: z.string().url().describe('The signed URL for the PUT request.'),
  gcsUri: z.string().describe('The GCS URI for the uploaded file.'),
});
export type GenerateUploadUrlOutput = z.infer<typeof GenerateUploadUrlOutputSchema>;


async function generateUrl(input: GenerateUploadUrlInput): Promise<GenerateUploadUrlOutput> {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new Error('GCLOUD_PROJECT environment variable not set.');
  }
  
  // You must create a bucket in your Google Cloud project.
  // We recommend giving it a unique name, like `your-project-id-media`.
  const bucketName = `${projectId}-media`; 
  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);

  // Check if the bucket exists. If not, create it.
  const [exists] = await bucket.exists();
  if (!exists) {
    console.log(`Bucket '${bucketName}' does not exist. Creating it...`);
    try {
        // Create the bucket.
        await storage.createBucket(bucketName);
        console.log(`Bucket '${bucketName}' created.`);
        
        // Optional: Make the bucket public for simplicity in this demo.
        // For production apps, you should use more granular permissions.
        await bucket.makePublic();
        console.log(`Bucket '${bucketName}' made public.`);
    } catch (creationError: any) {
        console.error(`Failed to create bucket '${bucketName}':`, creationError);
        throw new Error(`Failed to create storage bucket: ${creationError.message}`);
    }
  }

  const file = bucket.file(input.filename);
  
  const options = {
    version: 'v4' as const,
    action: 'write' as const,
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType: input.contentType,
  };

  try {
    const [url] = await file.getSignedUrl(options);
    console.log(`Generated signed URL for ${input.filename}`);
    
    return {
      signedUrl: url,
      gcsUri: `gs://${bucketName}/${input.filename}`,
    };
  } catch (error: any) {
    console.error('Failed to generate signed URL:', error);
    throw new Error(`Could not generate upload URL. Ensure the service account has 'Service Account Token Creator' role. Details: ${error.message}`);
  }
}

export const generateUploadUrl = ai.defineFlow(
    {
        name: 'generateUploadUrlFlow',
        inputSchema: GenerateUploadUrlInputSchema,
        outputSchema: GenerateUploadUrlOutputSchema,
    },
    generateUrl
);
