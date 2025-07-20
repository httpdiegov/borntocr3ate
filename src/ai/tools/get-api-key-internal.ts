'use server';

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import fs from 'fs';
import path from 'path';

// Helper function to initialize the client just-in-time
function getSecretManagerClient() {
  const credentialsPath = path.resolve(process.cwd(), 'google-credentials.json');

  if (fs.existsSync(credentialsPath)) {
    // This console log is helpful for debugging authentication.
    console.log("Found google-credentials.json, using it for authentication.");
    return new SecretManagerServiceClient({
      keyFilename: credentialsPath,
    });
  } else {
    // This will work in a deployed Firebase/Google Cloud environment
    console.log("google-credentials.json not found, using default application credentials.");
    return new SecretManagerServiceClient();
  }
}

export async function accessSecret(secretName: string): Promise<string | undefined> {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    console.error('GCLOUD_PROJECT environment variable not set.');
    // Throw an error instead of returning undefined so the issue is obvious.
    throw new Error('GCLOUD_PROJECT environment variable not set.');
  }
  
  const secretManagerClient = getSecretManagerClient();

  // Removing try-catch to let the actual Google Cloud error surface.
  // This will give a much more specific error message if something is wrong.
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  console.log(`Attempting to access secret: ${name}`);
  const [version] = await secretManagerClient.accessSecretVersion({ name });

  const payload = version.payload?.data?.toString();
  if (payload) {
    console.log(`Successfully accessed secret '${secretName}'.`);
  } else {
    // This case should ideally not happen if a version exists, but good to have.
    console.warn(`Secret '${secretName}' exists but has no payload/value.`);
  }
  return payload;
}
