/**
 * Token management for Coolify API
 */

import { createInterface } from 'node:readline';

export interface TokenConfig {
  token?: string;
  apiUrl?: string;
}

/**
 * Get token from various sources in priority order:
 * 1. CLI flag (passed as parameter)
 * 2. COOLIFY_TOKEN environment variable
 * 3. Config file token
 * 4. Interactive prompt (if TTY)
 */
export async function resolveToken(options: {
  cliToken?: string;
  configToken?: string;
  prompt?: boolean;
}): Promise<string | null> {
  // 1. CLI flag (highest priority)
  if (options.cliToken) {
    return options.cliToken;
  }

  // 2. Environment variable
  const envToken = process.env.COOLIFY_TOKEN;
  if (envToken) {
    return envToken;
  }

  // 3. Config file token
  if (options.configToken) {
    return options.configToken;
  }

  // 4. Interactive prompt (if TTY and prompt enabled)
  if (options.prompt !== false && process.stdin.isTTY) {
    return await promptForToken();
  }

  return null;
}

/**
 * Get API URL from various sources in priority order:
 * 1. CLI flag (passed as parameter)
 * 2. COOLIFY_API_URL environment variable
 * 3. Config file apiUrl
 * 4. Interactive prompt (if TTY)
 */
export async function resolveApiUrl(options: {
  cliApiUrl?: string;
  configApiUrl?: string;
  prompt?: boolean;
}): Promise<string | null> {
  // 1. CLI flag (highest priority)
  if (options.cliApiUrl) {
    return options.cliApiUrl;
  }

  // 2. Environment variable
  const envApiUrl = process.env.COOLIFY_API_URL;
  if (envApiUrl) {
    return envApiUrl;
  }

  // 3. Config file apiUrl
  if (options.configApiUrl) {
    return options.configApiUrl;
  }

  // 4. Interactive prompt (if TTY and prompt enabled)
  if (options.prompt !== false && process.stdin.isTTY) {
    return await promptForApiUrl();
  }

  return null;
}

/**
 * Prompt user for Coolify API token
 */
async function promptForToken(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter your Coolify API token: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt user for Coolify API URL
 */
export async function promptForApiUrl(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter your Coolify API URL (e.g., https://coolify.example.com): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Validate that required credentials are present
 */
export function validateCredentials(options: {
  apiUrl: string | null;
  token: string | null;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!options.apiUrl) {
    errors.push(
      'Missing Coolify API URL. Provide via --api-url flag, COOLIFY_API_URL env var, or config file.'
    );
  }

  if (!options.token) {
    errors.push(
      'Missing Coolify API token. Provide via --token flag, COOLIFY_TOKEN env var, or config file.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
