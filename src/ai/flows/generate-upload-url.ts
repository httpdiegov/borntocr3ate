
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
  gcsUri: z.string().describe('The GCS URI of the file for the AI to process.'),
});
export type GenerateUploadUrlOutput = z.infer<typeof GenerateUploadUrlOutputSchema>;


async function generateUrl(input: GenerateUploadUrlInput): Promise<GenerateUploadUrlOutput> {
  const credentialsPath = path.resolve(process.cwd(), 'google-credentials.json');
  let serviceAccountEmail: string | undefined;

  if (fs.existsSync(credentialsPath)) {
    const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    serviceAccountEmail = creds.client_email;
  }

  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new Error('GCLOUD_PROJECT environment variable not set.');
  }
  
  const bucketName = `${projectId}-media`; 
  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);

  const [exists] = await bucket.exists();
  if (!exists) {
    console.log(`Bucket '${bucketName}' does not exist. Creating it...`);
    try {
        await storage.createBucket(bucketName);
        console.log(`Bucket '${bucketName}' created.`);
        
        // Grant the service account permissions to view objects in the bucket.
        if (serviceAccountEmail) {
            console.log(`Granting storage.objectViewer role to ${serviceAccountEmail} on bucket ${bucketName}`);
            const [policy] = await bucket.getIamPolicy();
            policy.bindings.push({
                role: 'roles/storage.objectViewer',
                members: [`serviceAccount:${serviceAccountEmail}`],
            });
            await bucket.setIamPolicy(policy);
            console.log('IAM policy updated successfully.');
        } else {
            console.warn('Could not determine service account email. IAM policy not set. This might cause issues if not set manually.');
        }

    } catch (creationError: any) {
        console.error(`Failed to create bucket or set IAM policy on '${bucketName}':`, creationError);
        throw new Error(`Failed to create or configure storage bucket: ${creationError.message}`);
    }
  }

  try {
    await bucket.setCorsConfiguration([
        {
            maxAgeSeconds: 3600,
            method: ['PUT'],
            origin: ['*'],
            responseHeader: ['Content-Type'],
        },
    ]);
  } catch(corsError: any) {
    console.error(`Failed to set CORS configuration on bucket '${bucketName}':`, corsError);
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
    throw new Error(`Could not complete URL generation process. Details: ${error.message}`);
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
