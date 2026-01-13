/**
 * Database command generator for Coolify
 */
import type { Database } from '../../models/aspire.js';
import type { CoolifyDatabaseCommand } from '../../models/coolify.js';
export declare function generateDatabaseCommand(db: Database): CoolifyDatabaseCommand;
/**
 * Generate connection string placeholder for a database
 */
export declare function getDatabaseConnectionString(db: Database): string;
//# sourceMappingURL=database.d.ts.map