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

async function getSecretValue(secretManagerClient: SecretManagerServiceClient, name: string): Promise<string | undefined> {
  try {
    const [version] = await secretManagerClient.accessSecretVersion({ name: `${name}/versions/latest` });
    const payload = version.payload?.data?.toString();
    if (payload) {
      console.log(`Successfully accessed secret value for '${name}'.`);
    } else {
      console.warn(`Secret '${name}' exists but has no payload/value.`);
    }
    return payload;
  } catch (error: any) {
    if (error.code === 5) { // NOT_FOUND for the version
        console.warn(`No versions found for secret '${name}'. It might exist but be empty.`);
        return undefined;
    }
    console.error(`Failed to access secret version for ${name}:`, error.message);
    // Re-throw other errors
    throw error;
  }
}

function parseTagsFromLabels(labels: { [key: string]: string } | null | undefined): string[] {
    if (!labels) return [];
    return Object.keys(labels)
      .filter(key => key.startsWith('tag-'))
      .map(key => {
        const tag = key.substring(4).replace(/-/g, ' ');
        // Handle special cases like "IA"
        if (tag.toLowerCase() === 'ia') {
            return 'IA';
        }
        // Capitalize first letter of each word for other tags
        return tag.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      });
}

export async function getSecretWithMetadata(secretName: string): Promise<{ value?: string; tags: string[] }> {
    const projectId = process.env.GCLOUD_PROJECT;
    if (!projectId) {
      throw new Error('GCLOUD_PROJECT environment variable not set.');
    }
  
    const secretManagerClient = getSecretManagerClient();
    const name = `projects/${projectId}/secrets/${secretName}`;
    console.log(`Attempting to get metadata for secret: ${name}`);

    try {
        const [secret] = await secretManagerClient.getSecret({ name });
        const tags = parseTagsFromLabels(secret.labels);
        const value = await getSecretValue(secretManagerClient, name);

        console.log(`Successfully retrieved metadata for secret '${secretName}'.`);
        return { value, tags };

    } catch (error: any) {
        if (error.code === 5) { // NOT_FOUND for the secret itself
            console.warn(`Secret '${secretName}' not found.`);
            return { value: undefined, tags: [] };
        }
        console.error(`Failed to get secret metadata for ${secretName}:`, error);
        throw error;
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
  const name = `projects/${projectId}/secrets/${secretName}`;
  return getSecretValue(secretManagerClient, name);
}
