/**
 * Main parser module - orchestrates parsing of Aspire Program.cs files
 */

import { readFileSync } from 'node:fs';
import type { AspireApp, Reference } from '../models/aspire.js';
import { createEmptyAspireApp } from '../models/aspire.js';
import { extractFluentChains, type FluentChain } from './tokenizer.js';
import {
  isDatabaseChain,
  extractDatabase,
  extractChildDatabases,
  isContainerChain,
  extractContainer,
  isApplicationChain,
  extractApplication,
} from './extractors/index.js';

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
export function parseFile(filePath: string, options: ParseOptions = {}): ParseResult {
  const source = readFileSync(filePath, 'utf-8');
  return parseSource(source, options);
}

/**
 * Parse Aspire Program.cs source code and extract the application model
 */
export function parseSource(source: string, _options: ParseOptions = {}): ParseResult {
  const app = createEmptyAspireApp();
  const errors: ParseError[] = [];
  const warnings: string[] = [];

  try {
    // Extract all fluent method chains
    const chains = extractFluentChains(source);

    // Build a map of variable names to chains for reference resolution
    const chainMap = new Map<string, FluentChain>();
    for (const chain of chains) {
      if (chain.variableName) {
        chainMap.set(chain.variableName, chain);
      }
    }

    // Process each chain and categorize
    for (const chain of chains) {
      try {
        if (isDatabaseChain(chain)) {
          const db = extractDatabase(chain);
          app.databases.push(db);
        } else if (isContainerChain(chain)) {
          // Skip containers that are actually databases (Redis can be both)
          const container = extractContainer(chain);
          // Check if this is a database-like service
          if (['redis', 'mongodb'].includes(container.type)) {
            app.databases.push({
              name: container.name,
              type: container.type as 'redis' | 'mongodb',
              variableName: container.variableName,
              image: container.image,
              imageTag: container.imageTag,
              hostPort: container.hostPort,
              hasDataVolume: container.volumes.some((v) => v.isData),
              environment: container.environment,
            });
          } else if (['minio'].includes(container.type)) {
            app.storage.push({
              name: container.name,
              type: 'minio',
              variableName: container.variableName,
              image: container.image,
              imageTag: container.imageTag,
              hostPort: container.hostPort,
              environment: container.environment,
              volumes: container.volumes,
            });
          } else {
            app.services.push(container);
          }
        } else if (isApplicationChain(chain)) {
          const application = extractApplication(chain);
          app.applications.push(application);
        }
      } catch (err) {
        errors.push({
          message: `Failed to parse chain: ${err instanceof Error ? err.message : String(err)}`,
          context: chain.raw.substring(0, 100),
        });
      }
    }

    // Extract child databases (e.g., postgres.AddDatabase("db"))
    const childDbs = extractChildDatabases(chains);

    // Collect server variable names that have child databases
    const serversWithChildren = new Set<string>();
    for (const db of childDbs) {
      if (db.serverVariableName) {
        serversWithChildren.add(db.serverVariableName);
      }
    }

    // Remove server databases that have child databases (avoid duplicates)
    // Keep only the child database, which inherits the server's configuration
    app.databases = app.databases.filter(
      (db) => !db.variableName || !serversWithChildren.has(db.variableName)
    );

    for (const db of childDbs) {
      // Merge with parent database info if available (already done in extractChildDatabases)
      app.databases.push(db);
    }

    // Build references from application references
    app.references = buildReferences(app, chainMap);

    // Validate and warn about issues
    validateApp(app, warnings);
  } catch (err) {
    errors.push({
      message: `Parse failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return { app, errors, warnings };
}

/**
 * Build reference connections between resources
 */
function buildReferences(app: AspireApp, _chainMap: Map<string, FluentChain>): Reference[] {
  const references: Reference[] = [];

  // Process application references
  for (const application of app.applications) {
    for (const ref of application.references) {
      // Find what the reference points to
      const targetDb = app.databases.find((d) => d.variableName === ref || d.name === ref);
      const targetService = app.services.find((s) => s.variableName === ref || s.name === ref);
      const targetStorage = app.storage.find((s) => s.variableName === ref || s.name === ref);

      if (targetDb) {
        references.push({
          from: application.name,
          to: targetDb.name,
          connectionStringEnv: getConnectionStringEnvName(targetDb.type),
        });
      } else if (targetService) {
        references.push({
          from: application.name,
          to: targetService.name,
        });
      } else if (targetStorage) {
        references.push({
          from: application.name,
          to: targetStorage.name,
        });
      }
    }
  }

  // Process service references
  for (const service of app.services) {
    for (const ref of service.references) {
      const targetDb = app.databases.find((d) => d.variableName === ref || d.name === ref);
      if (targetDb) {
        references.push({
          from: service.name,
          to: targetDb.name,
          connectionStringEnv: getConnectionStringEnvName(targetDb.type),
        });
      }
    }
  }

  return references;
}

function getConnectionStringEnvName(dbType: string): string {
  switch (dbType) {
    case 'postgres':
      return 'DATABASE_URL';
    case 'sqlserver':
      return 'SQLSERVER_CONNECTION_STRING';
    case 'mysql':
      return 'MYSQL_URL';
    case 'mongodb':
      return 'MONGODB_URL';
    case 'redis':
      return 'REDIS_URL';
    default:
      return 'CONNECTION_STRING';
  }
}

function validateApp(app: AspireApp, warnings: string[]): void {
  // Check for duplicate names
  const allNames = [
    ...app.databases.map((d) => d.name),
    ...app.services.map((s) => s.name),
    ...app.storage.map((s) => s.name),
    ...app.applications.map((a) => a.name),
  ];

  const seen = new Set<string>();
  for (const name of allNames) {
    if (seen.has(name)) {
      warnings.push(`Duplicate resource name: ${name}`);
    }
    seen.add(name);
  }

  // Check for unresolved references
  for (const application of app.applications) {
    for (const ref of application.references) {
      const found =
        app.databases.some((d) => d.variableName === ref || d.name === ref) ||
        app.services.some((s) => s.variableName === ref || s.name === ref) ||
        app.storage.some((s) => s.variableName === ref || s.name === ref);

      if (!found) {
        warnings.push(`Unresolved reference in ${application.name}: ${ref}`);
      }
    }
  }
}

// Re-export tokenizer utilities
export { extractFluentChains, parseMethodChain, parseArgs } from './tokenizer.js';
