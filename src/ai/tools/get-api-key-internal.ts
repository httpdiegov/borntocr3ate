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
    return undefined;
  }
  
  const secretManagerClient = getSecretManagerClient();

  try {
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    console.log(`Attempting to access secret: ${name}`);
    const [version] = await secretManagerClient.accessSecretVersion({ name });

    const payload = version.payload?.data?.toString();
    if (payload) {
      console.log(`Successfully accessed secret '${secretName}'.`);
    } else {
      console.warn(`Secret '${secretName}' exists but has no payload/value.`);
    }
    return payload;
  } catch (error: any) {
    // Gracefully handle cases where the secret or version doesn't exist yet.
    if (error.code === 5) { // GRPC 'NOT_FOUND' error code
      console.warn(`SECRET NOT FOUND: Secret '${secretName}' or its 'latest' version not found in project '${projectId}'. Please ensure the secret exists and has at least one enabled version.`);
    } else {
      // Log other errors for debugging
      console.error(`Failed to access secret '${secretName}' in project '${projectId}'. Error:`, error);
    }
    return undefined;
  }
}
