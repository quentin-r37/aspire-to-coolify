/**
 * aspire2coolify - Public API
 *
 * Convert .NET Aspire configurations to Coolify deployments
 */

// Parser exports
export { parseFile, parseSource } from './parser/index.js';
export type { ParseOptions, ParseResult, ParseError } from './parser/index.js';

// Generator exports
export { generate } from './generators/coolify/index.js';
export type { GenerateOptions, GenerateResult } from './generators/coolify/index.js';

// API exports
export { CoolifyApiClient } from './api/coolify.js';
export { deployToCoolify } from './api/deployer.js';
export type {
  DeployConfig,
  DeployResult,
  DeploymentSummary,
  GitHubConfig,
} from './api/deployer.js';
export { resolveToken, resolveApiUrl } from './api/token.js';

// Model types
export type {
  AspireApp,
  Service,
  ServiceType,
  Database,
  DatabaseType,
  StorageService,
  StorageType,
  Application,
  ApplicationType,
  BuildPack,
  EnvironmentVariable,
  Volume,
  Endpoint,
  Reference,
} from './models/aspire.js';

export type {
  CoolifyCommand,
  CoolifyDatabaseType,
  CoolifyServiceType,
  CoolifyBuildPack,
  CoolifyOutput,
} from './models/coolify.js';

export { createEmptyAspireApp } from './models/aspire.js';
