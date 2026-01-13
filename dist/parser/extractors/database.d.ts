/**
 * Database extractor - parses database-related Aspire methods
 */
import type { Database } from '../../models/aspire.js';
import type { FluentChain } from '../tokenizer.js';
export declare function isDatabaseChain(chain: FluentChain): boolean;
export declare function extractDatabase(chain: FluentChain): Database;
/**
 * Extract databases from .AddDatabase() calls on a server chain
 */
export declare function extractChildDatabases(chains: FluentChain[]): Database[];
//# sourceMappingURL=database.d.ts.map