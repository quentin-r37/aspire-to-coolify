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

  // Find all Add* method calls and extract chains using balanced parentheses matching
  // Allow optional whitespace between base object and method call
  const addMethodRegex =
    /(?:(?:var|const)\s+(\w+)\s*=\s*)?(\w+)\s*\.\s*(Add\w+)(?:<[^>]+>)?\s*\(/g;

  let match;
  while ((match = addMethodRegex.exec(normalized)) !== null) {
    const [prefix, varName, baseObj, rootMethod] = match;
    const startIdx = match.index;
    const argsStartIdx = match.index + prefix.length;

    // Find the matching closing paren for the root method args
    const rootArgsEnd = findMatchingParen(normalized, argsStartIdx - 1);
    if (rootArgsEnd === -1) continue;

    const rootArgsRaw = normalized.substring(argsStartIdx, rootArgsEnd);

    // Now find chained methods until we hit a semicolon
    let chainEndIdx = rootArgsEnd + 1;
    const chainedMethods: MethodCall[] = [];

    while (chainEndIdx < normalized.length) {
      // Skip whitespace
      while (chainEndIdx < normalized.length && /\s/.test(normalized[chainEndIdx])) {
        chainEndIdx++;
      }

      // Check for end of chain
      if (normalized[chainEndIdx] === ';') {
        chainEndIdx++;
        break;
      }

      // Check for chained method: .MethodName(
      const chainMatch = normalized.substring(chainEndIdx).match(/^\.(\w+)\s*\(/);
      if (!chainMatch) break;

      const methodName = chainMatch[1];
      const methodArgsStart = chainEndIdx + chainMatch[0].length;
      const methodArgsEnd = findMatchingParen(normalized, methodArgsStart - 1);
      if (methodArgsEnd === -1) break;

      const rawArgs = normalized.substring(methodArgsStart, methodArgsEnd);
      chainedMethods.push({
        method: methodName,
        args: parseArgs(rawArgs),
        rawArgs,
      });

      chainEndIdx = methodArgsEnd + 1;
    }

    const raw = normalized.substring(startIdx, chainEndIdx);

    const chain: FluentChain = {
      variableName: varName || undefined,
      baseObject: baseObj,
      rootMethod,
      rootArgs: parseArgs(rootArgsRaw),
      name: extractFirstStringArg(rootArgsRaw) || '',
      chainedMethods,
      raw,
    };

    chains.push(chain);
  }

  return chains;
}

/**
 * Find the matching closing parenthesis for an opening paren at the given index
 * Returns the index of the closing paren, or -1 if not found
 */
function findMatchingParen(source: string, openIndex: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    const prevChar = i > 0 ? source[i - 1] : '';

    // Handle string boundaries
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    if (!inString) {
      if (char === '(') depth++;
      if (char === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
  }

  return -1;
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
