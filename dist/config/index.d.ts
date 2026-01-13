/**
 * Configuration loader using cosmiconfig
 */
export interface Aspire2CoolifyConfig {
    coolify?: {
        projectId?: string;
        serverId?: string;
        environmentId?: string;
        apiUrl?: string;
    };
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
export declare function loadConfig(searchFrom?: string): Promise<Aspire2CoolifyConfig>;
export declare function loadConfigFile(filePath: string): Promise<Aspire2CoolifyConfig>;
export declare function getDefaultConfig(): Aspire2CoolifyConfig;
export declare function createConfigTemplate(): string;
//# sourceMappingURL=index.d.ts.map