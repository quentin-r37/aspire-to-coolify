/**
 * Database extractor - parses database-related Aspire methods
 */

import type { Database, DatabaseType, EnvironmentVariable } from '../../models/aspire.js';
import type { FluentChain } from '../tokenizer.js';
import { extractFirstStringArg } from '../tokenizer.js';

const DATABASE_METHODS: Record<string, DatabaseType> = {
  AddPostgres: 'postgres',
  AddAzurePostgresFlexibleServer: 'postgres',
  AddPostgresContainer: 'postgres',
  AddSqlServer: 'sqlserver',
  AddAzureSqlServer: 'sqlserver',
  AddMySql: 'mysql',
  AddMySqlContainer: 'mysql',
  AddMongoDB: 'mongodb',
  AddMongoDBContainer: 'mongodb',
  AddRedis: 'redis',
  AddRedisContainer: 'redis',
};

export function isDatabaseChain(chain: FluentChain): boolean {
  return chain.rootMethod in DATABASE_METHODS;
}

export function extractDatabase(chain: FluentChain): Database {
  const dbType = DATABASE_METHODS[chain.rootMethod] || 'postgres';

  const database: Database = {
    name: chain.name,
    type: dbType,
    variableName: chain.variableName,
    hasDataVolume: false,
    environment: [],
  };

  // Process chained methods
  for (const method of chain.chainedMethods) {
    switch (method.method) {
      case 'WithImage':
        database.image = extractFirstStringArg(method.rawArgs) || undefined;
        break;

      case 'WithImageTag':
        database.imageTag = extractFirstStringArg(method.rawArgs) || undefined;
        break;

      case 'WithHostPort':
        const portArg = method.args[0];
        if (portArg) {
          database.hostPort = parseInt(portArg, 10) || undefined;
        }
        break;

      case 'WithDataVolume':
        database.hasDataVolume = true;
        break;

      case 'WithEnvironment':
        const env = extractEnvironment(method.args);
        if (env) {
          database.environment.push(env);
        }
        break;

      case 'RunAsContainer':
        // Process nested lambda configuration
        const nestedMethods = extractNestedMethods(method.rawArgs);
        for (const nested of nestedMethods) {
          processNestedMethod(database, nested);
        }
        break;
    }
  }

  return database;
}

/**
 * Extract databases from .AddDatabase() calls on a server chain
 */
export function extractChildDatabases(chains: FluentChain[]): Database[] {
  const databases: Database[] = [];

  for (const chain of chains) {
    if (chain.rootMethod === 'AddDatabase') {
      // Find the parent server by baseObject variable name
      const parentChain = chains.find((c) => c.variableName === chain.baseObject);

      // Extract parent server's image configuration if available
      const parentDb = parentChain ? extractDatabase(parentChain) : null;

      databases.push({
        name: chain.name,
        type: parentChain ? DATABASE_METHODS[parentChain.rootMethod] || 'postgres' : 'postgres',
        variableName: chain.variableName,
        serverName: parentChain?.name,
        serverVariableName: chain.baseObject,
        image: parentDb?.image,
        imageTag: parentDb?.imageTag,
        hostPort: parentDb?.hostPort,
        hasDataVolume: parentDb?.hasDataVolume ?? false,
        environment: parentDb?.environment ?? [],
      });
    }
  }

  return databases;
}

function extractEnvironment(args: string[]): EnvironmentVariable | null {
  if (args.length < 2) return null;

  const key = extractFirstStringArg(args[0]) || args[0].replace(/["']/g, '');
  const value = extractFirstStringArg(args[1]) || args[1].replace(/["']/g, '');

  return { key, value };
}

function extractNestedMethods(argsStr: string): Array<{ method: string; args: string[] }> {
  const methods: Array<{ method: string; args: string[] }> = [];

  // Match lambda pattern: a => a.Method(...)...
  const lambdaMatch = argsStr.match(/\w+\s*=>\s*\w+\s*/);
  if (!lambdaMatch) return methods;

  // Start parsing after the lambda parameter
  let pos = lambdaMatch.index! + lambdaMatch[0].length;

  while (pos < argsStr.length) {
    // Look for .MethodName(
    const methodMatch = argsStr.substring(pos).match(/^\s*\.\s*(\w+)\s*\(/);
    if (!methodMatch) break;

    const methodName = methodMatch[1];
    const argsStart = pos + methodMatch[0].length;

    // Find matching closing paren using balanced matching
    const argsEnd = findMatchingParen(argsStr, argsStart - 1);
    if (argsEnd === -1) break;

    const rawArgs = argsStr.substring(argsStart, argsEnd);
    methods.push({
      method: methodName,
      args: rawArgs.split(',').map((a) => a.trim()).filter((a) => a),
    });

    pos = argsEnd + 1;
  }

  return methods;
}

function findMatchingParen(source: string, openIndex: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    const prevChar = i > 0 ? source[i - 1] : '';

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

function processNestedMethod(database: Database, nested: { method: string; args: string[] }): void {
  switch (nested.method) {
    case 'WithImage':
      database.image =
        extractFirstStringArg(nested.args[0]) || nested.args[0]?.replace(/["']/g, '');
      break;
    case 'WithImageTag':
      database.imageTag =
        extractFirstStringArg(nested.args[0]) || nested.args[0]?.replace(/["']/g, '');
      break;
    case 'WithHostPort':
      database.hostPort = parseInt(nested.args[0], 10) || undefined;
      break;
    case 'WithDataVolume':
      database.hasDataVolume = true;
      break;
  }
}
