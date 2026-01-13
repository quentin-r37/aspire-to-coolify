/**
 * Main parser module - orchestrates parsing of Aspire Program.cs files
 */
import type { AspireApp } from '../models/aspire.js';
export interface ParseOptions {
    strict?: boolean;
}
export interface ParseResult {
    app: AspireApp;
    errors: ParseError[];
    warnings: string[];
}
export interface ParseError {
    message: string;
    line?: number;
    context?: string;
}
/**
 * Parse an Aspire Program.cs file and extract the application model
 */
export declare function parseFile(filePath: string, options?: ParseOptions): ParseResult;
/**
 * Parse Aspire Program.cs source code and extract the application model
 */
export declare function parseSource(source: string, options?: ParseOptions): ParseResult;
export { extractFluentChains, parseMethodChain, parseArgs } from './tokenizer.js';
//# sourceMappingURL=index.d.ts.map