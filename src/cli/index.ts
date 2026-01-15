#!/usr/bin/env node

/**
 * aspire2coolify CLI
 * Convert .NET Aspire configurations to Coolify CLI commands
 */

import { Command } from 'commander';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  .option('--project-id <id>', 'Coolify project UUID (if not provided, script will create a new project)')
  .option('--project-name <name>', 'Name for the new project (defaults to directory name)')
  .option('--server-id <id>', 'Coolify server UUID')
  .option('--environment-name <name>', 'Coolify environment name (e.g., production)')
  .option('--json', 'Output as JSON instead of shell script')
  .action(
    async (
      file: string,
      options: {
        output?: string;
        config?: string;
        comments?: boolean;
        projectId?: string;
        projectName?: string;
        serverId?: string;
        environmentName?: string;
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
          ? await import(pathToFileURL(resolve(options.config)).href).then((m) => m.default || m)
          : await loadConfig();

        // Derive project name from file path if not provided
        const deriveProjectName = (fp: string): string => {
          const dirName = dirname(fp);
          const parentDir = dirname(dirName);
          const appHostName = dirName.split(/[/\\]/).pop() || 'AspireApp';
          const projectDir = parentDir.split(/[/\\]/).pop() || '';

          if (appHostName.includes('.AppHost')) {
            return appHostName.replace('.AppHost', '');
          }
          if (appHostName.includes('AppHost')) {
            return appHostName.replace('AppHost', '') || projectDir || 'AspireApp';
          }
          return projectDir || appHostName;
        };

        const projectId = options.projectId || config.coolify?.projectId;
        const projectName = options.projectName || config.coolify?.projectName || deriveProjectName(filePath);

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
          projectId: projectId,
          projectName: !projectId ? projectName : undefined,
          serverId: options.serverId || config.coolify?.serverId,
          environmentName: options.environmentName || config.coolify?.environmentName,
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
  .option('--project-id <id>', 'Coolify project UUID (if not provided, a new project will be created)')
  .option('--project-name <name>', 'Name for the new project (used when --project-id is not provided)')
  .option('--server-id <id>', 'Coolify server UUID')
  .option('--environment-name <name>', 'Coolify environment name (e.g., production)')
  .option('--instant-deploy', 'Deploy resources immediately after creation')
  .option('--github-repo <url>', 'GitHub repository URL for applications (e.g., https://github.com/org/repo)')
  .option('--github-branch <branch>', 'GitHub branch to deploy (default: main)')
  .option('--github-base-path <path>', 'Base path within the GitHub repository')
  .option('--github-app-uuid <uuid>', 'GitHub App UUID for private repositories (from Coolify Sources page)')
  .option('--build-pack <type>', 'Build pack for applications (nixpacks, dockerfile, static, dockercompose)')
  .option('--skip-existing', 'Skip resources that already exist instead of failing')
  .action(
    async (
      file: string,
      options: {
        config?: string;
        dryRun?: boolean;
        apiUrl?: string;
        token?: string;
        projectId?: string;
        projectName?: string;
        serverId?: string;
        environmentName?: string;
        instantDeploy?: boolean;
        githubRepo?: string;
        githubBranch?: string;
        githubBasePath?: string;
        githubAppUuid?: string;
        buildPack?: string;
        skipExisting?: boolean;
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
          ? await import(pathToFileURL(resolve(options.config)).href).then((m) => m.default || m)
          : await loadConfig();

        // Resolve API URL and token
        const apiUrl = await resolveApiUrl({
          cliApiUrl: options.apiUrl,
          configApiUrl: config.coolify?.apiUrl,
          prompt: !options.dryRun, // Only prompt if not dry-run
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
        let projectUuid = options.projectId || config.coolify?.projectId;
        const serverUuid = options.serverId || config.coolify?.serverId;
        const environmentName = options.environmentName || config.coolify?.environmentName || 'production';

        if (!options.dryRun && !serverUuid) {
          console.error('\nMissing required configuration:');
          console.error('  - server-id (Coolify server UUID)');
          console.error(
            '\nProvide via CLI flags, config file, or environment variables.'
          );
          process.exit(1);
        }

        // Derive project name from file path if not provided
        const deriveProjectName = (filePath: string): string => {
          // Get directory name containing Program.cs (typically AppHost folder)
          const dirName = dirname(filePath);
          const parentDir = dirname(dirName);
          const appHostName = dirName.split(/[/\\]/).pop() || 'AspireApp';
          const projectDir = parentDir.split(/[/\\]/).pop() || '';

          // Try to extract a clean name (e.g., "VibeCode.AppHost" -> "VibeCode")
          if (appHostName.includes('.AppHost')) {
            return appHostName.replace('.AppHost', '');
          }
          if (appHostName.includes('AppHost')) {
            return appHostName.replace('AppHost', '') || projectDir || 'AspireApp';
          }
          return projectDir || appHostName;
        };

        const projectName = options.projectName || config.coolify?.projectName || deriveProjectName(filePath);

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

        // Resolve skipExisting from CLI or config (needed for project/environment checks)
        const skipExisting = options.skipExisting || config.coolify?.skipExisting;

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

        // Variable to store existing project (for environment check later)
        let existingProject: { uuid: string; name: string; environments?: { id: number; name: string }[] } | undefined;

        // Auto-create project if not provided
        if (!projectUuid) {
          if (options.dryRun) {
            console.log(`\n[DRY RUN] Would create project: "${projectName}"`);
            projectUuid = 'dry-run-project';
          } else {
            // Check if project with same name already exists
            console.log(`\nChecking for existing project: "${projectName}"...`);
            const projectsResult = await client.listProjects();
            if (projectsResult.success && projectsResult.data) {
              existingProject = projectsResult.data.find(p => p.name === projectName);
              if (existingProject) {
                if (skipExisting) {
                  console.log(`  ⊘ Using existing project "${projectName}" (uuid: ${existingProject.uuid})`);
                  projectUuid = existingProject.uuid;
                } else {
                  console.error(`  ✗ Project "${projectName}" already exists (use --skip-existing to reuse)`);
                  process.exit(1);
                }
              }
            }

            // Create project if not found
            if (!projectUuid) {
              console.log(`Creating project: "${projectName}"...`);
              const createResult = await client.createProject({
                name: projectName,
                description: `Deployed from aspire2coolify`,
              });

              if (!createResult.success || !createResult.data) {
                console.error(`  ✗ Failed to create project: ${createResult.error}`);
                process.exit(1);
              }

              projectUuid = createResult.data.uuid;
              console.log(`  ✓ Created project "${projectName}" (uuid: ${projectUuid})`);
            }
          }
        }

        // Check/create environment (unless dry-run)
        if (!options.dryRun && projectUuid && projectUuid !== 'dry-run-project') {
          // Check if environment already exists in the project (if API returns environments)
          const envExists = existingProject?.environments?.some(e => e.name === environmentName);

          if (envExists) {
            if (skipExisting) {
              console.log(`  ⊘ Using existing environment "${environmentName}"`);
            } else {
              console.error(`  ✗ Environment "${environmentName}" already exists in project (use --skip-existing to reuse)`);
              process.exit(1);
            }
          } else if (existingProject) {
            // Project exists - try to create the environment
            // Note: API may not return environments in listProjects (bug #7702), so we handle "already exists" error
            console.log(`Creating environment: "${environmentName}"...`);
            const envResult = await client.createEnvironment(projectUuid, environmentName);
            if (envResult.success) {
              console.log(`  ✓ Created environment "${environmentName}"`);
            } else if (envResult.error?.toLowerCase().includes('already exists')) {
              // Environment exists but wasn't returned by listProjects API
              if (skipExisting) {
                console.log(`  ⊘ Using existing environment "${environmentName}"`);
              } else {
                console.error(`  ✗ Environment "${environmentName}" already exists in project (use --skip-existing to reuse)`);
                process.exit(1);
              }
            } else {
              console.error(`  ✗ Failed to create environment: ${envResult.error}`);
              process.exit(1);
            }
          }
          // Note: If project was just created, the default 'production' environment is auto-created by Coolify
        }

        console.log('\nDeploying resources...\n');

        // Resolve GitHub config from CLI options or config file
        const githubRepo = options.githubRepo || config.github?.repository;
        const githubBranch = options.githubBranch || config.github?.branch;
        const githubBasePath = options.githubBasePath || config.github?.basePath;
        const githubAppUuid = options.githubAppUuid || config.github?.appUuid;
        const buildPack = options.buildPack as 'nixpacks' | 'dockerfile' | 'static' | 'dockercompose' | undefined;

        if (githubRepo) {
          if (githubAppUuid) {
            console.log(`Using private GitHub App: ${githubRepo} (branch: ${githubBranch || 'main'})`);
          } else {
            console.log(`Using public GitHub source: ${githubRepo} (branch: ${githubBranch || 'main'})`);
          }
        }

        const deployResult = await deployToCloudify(client, parseResult.app, {
          projectUuid: projectUuid || 'dry-run-project',
          serverUuid: serverUuid || 'dry-run-server',
          environmentName: environmentName || 'production',
          instantDeploy: options.instantDeploy,
          github: githubRepo ? {
            repository: githubRepo,
            branch: githubBranch,
            basePath: githubBasePath,
            appUuid: githubAppUuid,
          } : undefined,
          buildPack: buildPack,
          skipExisting: skipExisting,
        }, {
          dryRun: options.dryRun,
        });

        // Summary
        console.log('\n' + '─'.repeat(50));
        console.log('Deployment Summary:');
        console.log(`  ✓ Successful: ${deployResult.successful}`);
        console.log(`  ✗ Failed: ${deployResult.failed}`);
        if (deployResult.skipped > 0) {
          console.log(`  ⊘ Skipped: ${deployResult.skipped}`);
        }

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
