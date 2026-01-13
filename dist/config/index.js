/**
 * Configuration loader using cosmiconfig
 */
import { cosmiconfig } from 'cosmiconfig';
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
export async function loadConfig(searchFrom) {
    try {
        const result = await explorer.search(searchFrom);
        return result?.config || {};
    }
    catch {
        return {};
    }
}
export async function loadConfigFile(filePath) {
    try {
        const result = await explorer.load(filePath);
        return result?.config || {};
    }
    catch {
        return {};
    }
}
export function getDefaultConfig() {
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
export function createConfigTemplate() {
    return `// aspire2coolify.config.js
export default {
  coolify: {
    // projectId: 'your-project-id',
    // serverId: 'your-server-id',
    // environmentId: 'your-environment-id',
    // apiUrl: 'https://your-coolify-instance.com',
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
//# sourceMappingURL=index.js.map