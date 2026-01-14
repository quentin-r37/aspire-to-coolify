#!/usr/bin/env node

/**
 * aspire2coolify CLI
 * Convert .NET Aspire configurations to Coolify CLI commands
 */

import { Command } from 'commander';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);
import { parseFile } from '../parser/index.js';
import { generate } from '../generators/coolify/index.js';
import { loadConfig, createConfigTemplate } from '../config/index.js';
import {
  CoolifyApiClient,
  resolveToken,
  resolveApiUrl,
  validateCredentials,
  deployToCloudify,
} from '../api/index.js';

const program = new Command();

program
  .name('aspire2coolify')
  .description('Convert .NET Aspire configurations to Coolify CLI commands')
  .version(packageJson.version);

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
  .description('Deploy Aspire resources to Coolify via API')
  .option('-c, --config <file>', 'Config file path')
  .option('--dry-run', 'Print actions without executing')
  .option('--api-url <url>', 'Coolify API URL')
  .option('--token <token>', 'Coolify API token')
  .option('--project-id <id>', 'Coolify project UUID')
  .option('--server-id <id>', 'Coolify server UUID')
  .option('--environment-name <name>', 'Coolify environment name (e.g., production)')
  .option('--instant-deploy', 'Deploy resources immediately after creation')
  .action(
    async (
      file: string,
      options: {
        config?: string;
        dryRun?: boolean;
        apiUrl?: string;
        token?: string;
        projectId?: string;
        serverId?: string;
        environmentName?: string;
        instantDeploy?: boolean;
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

        // Resolve API URL and token
        const apiUrl = resolveApiUrl({
          cliApiUrl: options.apiUrl,
          configApiUrl: config.coolify?.apiUrl,
        });

        const token = await resolveToken({
          cliToken: options.token,
          configToken: config.coolify?.token,
          prompt: !options.dryRun, // Only prompt if not dry-run
        });

        // Validate credentials (skip for dry-run)
        if (!options.dryRun) {
          const validation = validateCredentials({ apiUrl, token });
          if (!validation.valid) {
            console.error('\nConfiguration errors:');
            for (const error of validation.errors) {
              console.error(`  - ${error}`);
            }
            process.exit(1);
          }
        }

        // Resolve deployment config
        const projectUuid = options.projectId || config.coolify?.projectId;
        const serverUuid = options.serverId || config.coolify?.serverId;
        const environmentName = options.environmentName || config.coolify?.environmentName;

        if (!options.dryRun && (!projectUuid || !serverUuid || !environmentName)) {
          console.error('\nMissing required configuration:');
          if (!projectUuid) console.error('  - project-id (Coolify project UUID)');
          if (!serverUuid) console.error('  - server-id (Coolify server UUID)');
          if (!environmentName) console.error('  - environment-name (e.g., production)');
          console.error(
            '\nProvide via CLI flags, config file, or environment variables.'
          );
          process.exit(1);
        }

        // Parse the Aspire file
        console.log(`Parsing: ${filePath}`);
        const parseResult = parseFile(filePath);

        if (parseResult.errors.length > 0) {
          console.error('\nParse Errors:');
          for (const error of parseResult.errors) {
            console.error(`  - ${error.message}`);
          }
          process.exit(1);
        }

        // Count resources
        const totalResources =
          parseResult.app.databases.length +
          parseResult.app.storage.length +
          parseResult.app.services.length +
          parseResult.app.applications.length;

        console.log(`\nFound ${totalResources} resources to deploy:`);
        console.log(`  - Databases: ${parseResult.app.databases.length}`);
        console.log(`  - Storage: ${parseResult.app.storage.length}`);
        console.log(`  - Services: ${parseResult.app.services.length}`);
        console.log(`  - Applications: ${parseResult.app.applications.length}`);

        // Create API client and deploy
        const client = new CoolifyApiClient({
          apiUrl: apiUrl || 'http://localhost', // Dummy URL for dry-run
          token: token || 'dry-run-token',
        });

        // Test connection (unless dry-run)
        if (!options.dryRun) {
          console.log('\nTesting API connection...');
          const testResult = await client.testConnection();
          if (!testResult.success) {
            console.error(`  ✗ Failed to connect to Coolify API: ${testResult.error}`);
            process.exit(1);
          }
          console.log('  ✓ Connected to Coolify API');
        }

        console.log('\nDeploying resources...\n');

        const deployResult = await deployToCloudify(client, parseResult.app, {
          projectUuid: projectUuid || 'dry-run-project',
          serverUuid: serverUuid || 'dry-run-server',
          environmentName: environmentName || 'production',
          instantDeploy: options.instantDeploy,
        }, {
          dryRun: options.dryRun,
        });

        // Summary
        console.log('\n' + '─'.repeat(50));
        console.log('Deployment Summary:');
        console.log(`  ✓ Successful: ${deployResult.successful}`);
        console.log(`  ✗ Failed: ${deployResult.failed}`);

        if (deployResult.failed > 0) {
          console.log('\nFailed resources:');
          for (const result of deployResult.results.filter((r) => !r.success)) {
            console.log(`  - ${result.name}: ${result.error}`);
          }
          process.exit(1);
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
