#!/usr/bin/env node

/**
 * aspire2coolify CLI
 * Convert .NET Aspire configurations to Coolify CLI commands
 */

import { Command } from 'commander';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { parseFile } from '../parser/index.js';
import { generate } from '../generators/coolify/index.js';
import { loadConfig, createConfigTemplate } from '../config/index.js';

const program = new Command();

program
  .name('aspire2coolify')
  .description('Convert .NET Aspire configurations to Coolify CLI commands')
  .version('1.0.0');

// Parse command
program
  .command('parse <file>')
  .description('Parse an Aspire Program.cs file and display the extracted model')
  .option('-o, --output <file>', 'Output file for the JSON model')
  .option('--pretty', 'Pretty print JSON output', true)
  .action(async (file: string, options: { output?: string; pretty?: boolean }) => {
    try {
      const filePath = resolve(file);

      if (!existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
      }

      console.log(`Parsing: ${filePath}`);
      const result = parseFile(filePath);

      if (result.errors.length > 0) {
        console.error('\nErrors:');
        for (const error of result.errors) {
          console.error(`  - ${error.message}`);
        }
      }

      if (result.warnings.length > 0) {
        console.warn('\nWarnings:');
        for (const warning of result.warnings) {
          console.warn(`  - ${warning}`);
        }
      }

      const jsonOutput = options.pretty
        ? JSON.stringify(result.app, null, 2)
        : JSON.stringify(result.app);

      if (options.output) {
        writeFileSync(options.output, jsonOutput);
        console.log(`\nModel saved to: ${options.output}`);
      } else {
        console.log('\nExtracted Model:');
        console.log(jsonOutput);
      }

      // Summary
      console.log('\nSummary:');
      console.log(`  Databases: ${result.app.databases.length}`);
      console.log(`  Services: ${result.app.services.length}`);
      console.log(`  Storage: ${result.app.storage.length}`);
      console.log(`  Applications: ${result.app.applications.length}`);
      console.log(`  References: ${result.app.references.length}`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// Generate command
program
  .command('generate <file>')
  .description('Generate Coolify CLI commands from an Aspire Program.cs file')
  .option('-o, --output <file>', 'Output file for the generated script')
  .option('-c, --config <file>', 'Config file path')
  .option('--no-comments', 'Exclude comments from output')
  .option('--project-id <id>', 'Coolify project ID')
  .option('--server-id <id>', 'Coolify server ID')
  .option('--environment-id <id>', 'Coolify environment ID')
  .option('--json', 'Output as JSON instead of shell script')
  .action(
    async (
      file: string,
      options: {
        output?: string;
        config?: string;
        comments?: boolean;
        projectId?: string;
        serverId?: string;
        environmentId?: string;
        json?: boolean;
      }
    ) => {
      try {
        const filePath = resolve(file);

        if (!existsSync(filePath)) {
          console.error(`Error: File not found: ${filePath}`);
          process.exit(1);
        }

        // Load config
        const config = options.config
          ? await import(resolve(options.config)).then((m) => m.default || m)
          : await loadConfig();

        console.log(`Parsing: ${filePath}`);
        const parseResult = parseFile(filePath);

        if (parseResult.errors.length > 0) {
          console.error('\nParse Errors:');
          for (const error of parseResult.errors) {
            console.error(`  - ${error.message}`);
          }
        }

        // Generate commands
        const generateResult = generate(parseResult.app, {
          includeComments: options.comments !== false,
          projectId: options.projectId || config.coolify?.projectId,
          serverId: options.serverId || config.coolify?.serverId,
          environmentId: options.environmentId || config.coolify?.environmentId,
        });

        if (generateResult.errors.length > 0) {
          console.error('\nGeneration Errors:');
          for (const error of generateResult.errors) {
            console.error(`  - ${error}`);
          }
        }

        // Output
        let output: string;
        if (options.json) {
          output = JSON.stringify(generateResult.commands, null, 2);
        } else {
          output = generateResult.script;
        }

        if (options.output) {
          writeFileSync(options.output, output);
          console.log(`\nScript saved to: ${options.output}`);
        } else {
          console.log('\nGenerated Commands:');
          console.log('─'.repeat(50));
          console.log(output);
        }

        // Summary
        console.log('\nGenerated:');
        console.log(`  ${generateResult.commands.length} Coolify commands`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    }
  );

// Deploy command
program
  .command('deploy <file>')
  .description('Parse and execute Coolify commands (requires coolify CLI)')
  .option('-c, --config <file>', 'Config file path')
  .option('--dry-run', 'Print commands without executing')
  .option('--project-id <id>', 'Coolify project ID')
  .option('--server-id <id>', 'Coolify server ID')
  .option('--environment-id <id>', 'Coolify environment ID')
  .action(
    async (
      file: string,
      options: {
        config?: string;
        dryRun?: boolean;
        projectId?: string;
        serverId?: string;
        environmentId?: string;
      }
    ) => {
      try {
        const filePath = resolve(file);

        if (!existsSync(filePath)) {
          console.error(`Error: File not found: ${filePath}`);
          process.exit(1);
        }

        // Load config
        const config = options.config
          ? await import(resolve(options.config)).then((m) => m.default || m)
          : await loadConfig();

        console.log(`Parsing: ${filePath}`);
        const parseResult = parseFile(filePath);

        if (parseResult.errors.length > 0) {
          console.error('\nParse Errors:');
          for (const error of parseResult.errors) {
            console.error(`  - ${error.message}`);
          }
          process.exit(1);
        }

        // Generate commands
        const generateResult = generate(parseResult.app, {
          includeComments: false,
          projectId: options.projectId || config.coolify?.projectId,
          serverId: options.serverId || config.coolify?.serverId,
          environmentId: options.environmentId || config.coolify?.environmentId,
        });

        if (generateResult.errors.length > 0) {
          console.error('\nGeneration Errors:');
          for (const error of generateResult.errors) {
            console.error(`  - ${error}`);
          }
          process.exit(1);
        }

        // Execute commands
        console.log(`\nDeploying ${generateResult.commands.length} resources...`);

        for (const cmd of generateResult.commands) {
          const fullCommand = `coolify ${cmd.command} ${cmd.args.join(' ')}`;

          if (options.dryRun) {
            console.log(`[DRY RUN] ${fullCommand}`);
          } else {
            console.log(`Executing: ${fullCommand}`);
            try {
              const output = execSync(fullCommand, { encoding: 'utf-8' });
              console.log(output);
            } catch (execErr) {
              console.error(
                `Command failed: ${execErr instanceof Error ? execErr.message : execErr}`
              );
            }
          }
        }

        console.log('\nDeployment complete!');
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    }
  );

// Init command
program
  .command('init')
  .description('Create a configuration file')
  .option('-f, --force', 'Overwrite existing config file')
  .action((options: { force?: boolean }) => {
    const configPath = resolve('aspire2coolify.config.js');

    if (existsSync(configPath) && !options.force) {
      console.error('Config file already exists. Use --force to overwrite.');
      process.exit(1);
    }

    writeFileSync(configPath, createConfigTemplate());
    console.log(`Created: ${configPath}`);
  });

program.parse();
