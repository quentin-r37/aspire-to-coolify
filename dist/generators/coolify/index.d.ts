/**
 * Main Coolify generator - orchestrates command generation
 */
import type { AspireApp } from '../../models/aspire.js';
import type { CoolifyCommand } from '../../models/coolify.js';
export interface GenerateOptions {
    includeComments?: boolean;
    projectId?: string;
    serverId?: string;
    environmentId?: string;
}
export interface GenerateResult {
    commands: CoolifyCommand[];
    script: string;
    errors: string[];
}
/**
 * Generate Coolify CLI commands from an Aspire application model
 */
export declare function generate(app: AspireApp, options?: GenerateOptions): GenerateResult;
export { generateDatabaseCommand } from './database.js';
export { generateServiceCommand, generateStorageCommand } from './service.js';
export { generateApplicationCommand } from './application.js';
//# sourceMappingURL=index.d.ts.map