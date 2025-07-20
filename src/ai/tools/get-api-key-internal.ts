'use server';

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import fs from 'fs';
import path from 'path';

let secretManagerClient: SecretManagerServiceClient;

// This function initializes the client with explicit credentials
// to ensure authentication works correctly in local development.
function initializeClient() {
  if (secretManagerClient) {
    return;
  }
  
  const credentialsPath = path.resolve(process.cwd(), 'google-credentials.json');

  if (fs.existsSync(credentialsPath)) {
    console.log("Found google-credentials.json, using it for authentication.");
    secretManagerClient = new SecretManagerServiceClient({
      keyFilename: credentialsPath,
    });
  } else {
    console.log("google-credentials.json not found, using default application credentials.");
    // This will work in a deployed Firebase/Google Cloud environment
    secretManagerClient = new SecretManagerServiceClient();
  }
}

// Ensure the client is initialized before we export the function
initializeClient();


export async function accessSecret(secretName: string): Promise<string | undefined> {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    console.error('GCLOUD_PROJECT environment variable not set.');
    return undefined;
  }
  
  try {
    const [version] = await secretManagerClient.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
    });

    const payload = version.payload?.data?.toString();
    if (!payload) {
      console.warn(`Secret ${secretName} has no payload.`);
    }
    return payload;
  } catch (error: any) {
    // Gracefully handle cases where the secret or version doesn't exist yet.
    if (error.code === 5) { // GRPC 'NOT_FOUND' error code
      console.warn(`Secret '${secretName}' or its latest version not found.`);
      return undefined;
    }
    console.error(`Failed to access secret ${secretName}:`, error);
    return undefined;
  }
}
