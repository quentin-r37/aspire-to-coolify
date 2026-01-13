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
export function extractFluentChains(source: string): FluentChain[] {
  const chains: FluentChain[] = [];

  // Normalize source: remove comments and collapse whitespace
  const normalized = normalizeSource(source);

  // Match fluent chains starting with Add* methods
  // Handles: var x = builder.AddXxx("name")...;
  //          builder.AddXxx("name")...;
  //          builder.AddProject<T>("name")...;
  //          x.AddDatabase("name")...;
  const chainRegex =
    /(?:(?:var|const)\s+(\w+)\s*=\s*)?(\w+)\.(Add\w+)(?:<[^>]+>)?\s*\(([^)]*)\)((?:\s*\.\s*\w+\s*\([^)]*(?:\([^)]*\)[^)]*)*\))*)\s*;/g;

  let match;
  while ((match = chainRegex.exec(normalized)) !== null) {
    const [raw, varName, baseObj, rootMethod, rootArgsRaw, chainPart] = match;

    const chain: FluentChain = {
      variableName: varName || undefined,
      baseObject: baseObj,
      rootMethod,
      rootArgs: parseArgs(rootArgsRaw),
      name: extractFirstStringArg(rootArgsRaw) || '',
      chainedMethods: [],
      raw,
    };

    // Parse chained method calls
    if (chainPart) {
      chain.chainedMethods = parseMethodChain(chainPart);
    }

    chains.push(chain);
  }

  // Also match lambda/callback patterns like .RunAsContainer(a => a.WithImage(...))
  const lambdaChains = extractLambdaChains(normalized);
  for (const lambda of lambdaChains) {
    // Find parent chain and merge
    const parent = chains.find(
      (c) => c.raw.includes(lambda.parentMethod) && c.raw.includes(lambda.raw)
    );
    if (parent) {
      parent.chainedMethods.push(...lambda.methods);
    }
  }

  return chains;
}

/**
 * Parse method chain string into individual method calls
 */
export function parseMethodChain(chainStr: string): MethodCall[] {
  const methods: MethodCall[] = [];

  // Match .MethodName(args) patterns, handling nested parentheses
  const methodRegex = /\.(\w+)\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g;

  let match;
  while ((match = methodRegex.exec(chainStr)) !== null) {
    const [, method, rawArgs] = match;
    methods.push({
      method,
      args: parseArgs(rawArgs),
      rawArgs,
    });
  }

  return methods;
}

/**
 * Parse argument string into array of arguments
 */
export function parseArgs(argsStr: string): string[] {
  if (!argsStr.trim()) return [];

  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    const prevChar = i > 0 ? argsStr[i - 1] : '';

    // Handle string boundaries
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    // Track parentheses depth (outside strings)
    if (!inString) {
      if (char === '(' || char === '[' || char === '{') depth++;
      if (char === ')' || char === ']' || char === '}') depth--;
    }

    // Split on comma at depth 0
    if (char === ',' && depth === 0 && !inString) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Extract the first string argument from args string
 */
export function extractFirstStringArg(argsStr: string): string | null {
  const match = argsStr.match(/["']([^"']+)["']/);
  return match ? match[1] : null;
}

/**
 * Extract key-value pairs from named arguments
 * e.g., "env: \"PORT\"" -> { env: "PORT" }
 */
export function extractNamedArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const arg of args) {
    const match = arg.match(/(\w+)\s*:\s*["']?([^"',]+)["']?/);
    if (match) {
      result[match[1]] = match[2];
    }
  }

  return result;
}

/**
 * Extract lambda/callback chains
 */
function extractLambdaChains(
  source: string
): Array<{ parentMethod: string; raw: string; methods: MethodCall[] }> {
  const results: Array<{ parentMethod: string; raw: string; methods: MethodCall[] }> = [];

  // Match patterns like .RunAsContainer(a => a.WithImage("x").WithTag("y"))
  const lambdaRegex = /\.(\w+)\s*\(\s*\w+\s*=>\s*\w+((?:\s*\.\s*\w+\s*\([^)]*\))+)\s*\)/g;

  let match;
  while ((match = lambdaRegex.exec(source)) !== null) {
    const [raw, parentMethod, chainPart] = match;
    results.push({
      parentMethod,
      raw,
      methods: parseMethodChain(chainPart),
    });
  }

  return results;
}

/**
 * Normalize C# source code for easier parsing
 */
export function normalizeSource(source: string): string {
  return (
    source
      // Remove single-line comments
      .replace(/\/\/.*$/gm, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Collapse multiple whitespace/newlines into single space
      .replace(/\s+/g, ' ')
      // Normalize around operators (=> must be handled before = to avoid breaking lambda arrows)
      .replace(/\s*=>\s*/g, ' => ')
      .replace(/\s*=(?!>)\s*/g, ' = ')
      .trim()
  );
}
