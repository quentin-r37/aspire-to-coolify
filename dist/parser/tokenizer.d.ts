/**
 * Tokenizer for C# fluent method chains
 * Extracts method calls and their arguments from Aspire Program.cs files
 */
export interface MethodCall {
    method: string;
    args: string[];
    rawArgs: string;
}
export interface FluentChain {
    variableName?: string;
    baseObject?: string;
    rootMethod: string;
    rootArgs: string[];
    name: string;
    chainedMethods: MethodCall[];
    raw: string;
}
/**
 * Extract all fluent method chains from C# source code
 * Matches patterns like: var x = builder.AddXxx("name").WithYyy().WithZzz();
 */
export declare function extractFluentChains(source: string): FluentChain[];
/**
 * Parse method chain string into individual method calls
 */
export declare function parseMethodChain(chainStr: string): MethodCall[];
/**
 * Parse argument string into array of arguments
 */
export declare function parseArgs(argsStr: string): string[];
/**
 * Extract the first string argument from args string
 */
export declare function extractFirstStringArg(argsStr: string): string | null;
/**
 * Extract key-value pairs from named arguments
 * e.g., "env: \"PORT\"" -> { env: "PORT" }
 */
export declare function extractNamedArgs(args: string[]): Record<string, string>;
/**
 * Normalize C# source code for easier parsing
 */
export declare function normalizeSource(source: string): string;
//# sourceMappingURL=tokenizer.d.ts.map