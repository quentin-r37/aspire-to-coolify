/**
 * Main Coolify generator - orchestrates API command generation
 */

import type { AspireApp } from '../../models/aspire.js';
import type { CoolifyCommand, CoolifyOutput } from '../../models/coolify.js';
import { formatOutput } from '../../models/coolify.js';
import { generateDatabaseCommand } from './database.js';
import { generateServiceCommand, generateStorageCommand } from './service.js';
import { generateApplicationCommand } from './application.js';

export interface GenerateOptions {
  includeComments?: boolean;
  projectId?: string;
  serverId?: string;
  environmentId?: string;
  environmentName?: string;
  instantDeploy?: boolean;
}

export interface GenerateResult {
  commands: CoolifyCommand[];
  script: string;
  errors: string[];
}

/**
 * Generate Coolify API commands from an Aspire application model
 */
export function generate(app: AspireApp, options: GenerateOptions = {}): GenerateResult {
  const commands: CoolifyCommand[] = [];
  const errors: string[] = [];

  // Common options for all generators
  const generatorOptions = {
    serverUuid: options.serverId,
    projectUuid: options.projectId,
    environmentName: options.environmentName || options.environmentId,
    instantDeploy: options.instantDeploy,
  };

  // Generate database commands first (they need to exist before apps reference them)
  for (const db of app.databases) {
    try {
      const cmd = generateDatabaseCommand(db, generatorOptions);
      if (!options.includeComments) {
        delete cmd.comment;
      }
      commands.push(cmd);
    } catch (err) {
      errors.push(`Failed to generate database command for ${db.name}: ${err}`);
    }
  }

  // Generate storage service commands
  for (const storage of app.storage) {
    try {
      const cmd = generateStorageCommand(storage, generatorOptions);
      if (!options.includeComments) {
        delete cmd.comment;
      }
      commands.push(cmd);
    } catch (err) {
      errors.push(`Failed to generate storage command for ${storage.name}: ${err}`);
    }
  }

  // Generate other service commands
  for (const service of app.services) {
    try {
      const cmd = generateServiceCommand(service, generatorOptions);
      if (!options.includeComments) {
        delete cmd.comment;
      }
      commands.push(cmd);
    } catch (err) {
      errors.push(`Failed to generate service command for ${service.name}: ${err}`);
    }
  }

  // Generate application commands last (they reference other resources)
  for (const application of app.applications) {
    try {
      const cmd = generateApplicationCommand(application, app, generatorOptions);
      if (!options.includeComments) {
        delete cmd.comment;
      }
      commands.push(cmd);
    } catch (err) {
      errors.push(`Failed to generate application command for ${application.name}: ${err}`);
    }
  }

  // Generate the shell script with curl commands
  const output: CoolifyOutput = {
    commands,
    script: '',
  };
  output.script = formatOutput(output);

  return {
    commands,
    script: output.script,
    errors,
  };
}

// Re-export sub-generators
export { generateDatabaseCommand } from './database.js';
export { generateServiceCommand, generateStorageCommand } from './service.js';
export { generateApplicationCommand } from './application.js';
