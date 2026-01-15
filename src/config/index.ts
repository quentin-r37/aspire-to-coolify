/**
 * Configuration loader using cosmiconfig
 */

import { cosmiconfig } from 'cosmiconfig';

export interface GitHubSourceConfig {
  repository: string;
  branch?: string;
  basePath?: string;
  appUuid?: string; // GitHub App UUID for private repositories
}

export interface Aspire2CoolifyConfig {
  coolify?: {
    projectId?: string;
    serverId?: string;
    environmentId?: string;
    environmentName?: string;
    apiUrl?: string;
    token?: string;
    skipExisting?: boolean;
  };
  github?: GitHubSourceConfig;
  mappings?: {
    databases?: Record<string, string>;
    services?: Record<string, string>;
    buildPacks?: Record<string, string>;
  };
  defaults?: {
    buildPack?: string;
    region?: string;
  };
  output?: {
    includeComments?: boolean;
    format?: 'shell' | 'json' | 'yaml';
  };
}

const explorer = cosmiconfig('aspire2coolify', {
  searchPlaces: [
    'aspire2coolify.config.js',
    'aspire2coolify.config.mjs',
    'aspire2coolify.config.cjs',
    'aspire2coolify.config.json',
    '.aspire2coolifyrc',
    '.aspire2coolifyrc.json',
    'package.json',
  ],
});

export async function loadConfig(searchFrom?: string): Promise<Aspire2CoolifyConfig> {
  try {
    const result = await explorer.search(searchFrom);
    return result?.config || {};
  } catch {
    return {};
  }
}

export async function loadConfigFile(filePath: string): Promise<Aspire2CoolifyConfig> {
  try {
    const result = await explorer.load(filePath);
    return result?.config || {};
  } catch {
    return {};
  }
}

export function getDefaultConfig(): Aspire2CoolifyConfig {
  return {
    coolify: {},
    mappings: {},
    defaults: {
      buildPack: 'nixpacks',
    },
    output: {
      includeComments: true,
      format: 'shell',
    },
  };
}

export function createConfigTemplate(): string {
  return `// aspire2coolify.config.js
export default {
  coolify: {
    // apiUrl: 'https://your-coolify-instance.com',
    // token: 'your-api-token', // Or use COOLIFY_TOKEN env var
    // projectId: 'your-project-uuid',
    // serverId: 'your-server-uuid',
    // environmentName: 'production', // e.g., 'production', 'staging'
    // skipExisting: false, // Skip resources that already exist instead of failing
  },
  // GitHub source configuration (optional)
  // When set, applications will be created with this GitHub repository as the source
  github: {
    // repository: 'https://github.com/your-org/your-repo',
    // branch: 'main', // default branch to deploy
    // basePath: '', // base path within the repository (optional)
    // appUuid: '', // GitHub App UUID for private repositories (from Coolify's Sources page)
  },
  mappings: {
    // Custom database type mappings
    databases: {
      // 'sqlserver': 'postgres', // Map SQL Server to PostgreSQL
    },
    // Custom service type mappings
    services: {
      // 'maildev': 'mailpit',
    },
  },
  defaults: {
    buildPack: 'nixpacks',
  },
  output: {
    includeComments: true,
    format: 'shell', // 'shell' | 'json'
  },
};
`;
}
