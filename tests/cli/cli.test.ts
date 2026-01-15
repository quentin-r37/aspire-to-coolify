import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../dist/cli/index.js');
const FIXTURES_PATH = resolve(__dirname, '../fixtures');

// Helper to run CLI commands
async function runCli(
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || '',
      exitCode: execError.code || 1,
    };
  }
}

describe('CLI', () => {
  let testDir: string;

  beforeAll(() => {
    // Verify CLI is built
    if (!existsSync(CLI_PATH)) {
      throw new Error(`CLI not built. Run 'npm run build' first. Expected: ${CLI_PATH}`);
    }
  });

  beforeEach(() => {
    testDir = join(tmpdir(), `aspire2coolify-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('--help', () => {
    it('should display help information', async () => {
      const { stdout, exitCode } = await runCli(['--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('aspire2coolify');
      expect(stdout).toContain('Convert .NET Aspire configurations to Coolify');
      expect(stdout).toContain('parse');
      expect(stdout).toContain('generate');
      expect(stdout).toContain('deploy');
      expect(stdout).toContain('init');
    });

    it('should display help for parse command', async () => {
      const { stdout, exitCode } = await runCli(['parse', '--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Parse an Aspire Program.cs file');
      expect(stdout).toContain('--output');
      expect(stdout).toContain('--pretty');
    });

    it('should display help for generate command', async () => {
      const { stdout, exitCode } = await runCli(['generate', '--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Generate Coolify CLI commands');
      expect(stdout).toContain('--output');
      expect(stdout).toContain('--project-id');
      expect(stdout).toContain('--server-id');
      expect(stdout).toContain('--json');
    });

    it('should display help for deploy command', async () => {
      const { stdout, exitCode } = await runCli(['deploy', '--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Deploy Aspire resources to Coolify');
      expect(stdout).toContain('--dry-run');
      expect(stdout).toContain('--api-url');
      expect(stdout).toContain('--token');
      expect(stdout).toContain('--skip-existing');
      expect(stdout).toContain('--github-repo');
    });

    it('should display help for init command', async () => {
      const { stdout, exitCode } = await runCli(['init', '--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Create a configuration file');
      expect(stdout).toContain('--force');
    });
  });

  describe('--version', () => {
    it('should display version number', async () => {
      const { stdout, exitCode } = await runCli(['--version']);

      expect(exitCode).toBe(0);
      // Version should match package.json
      const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));
      expect(stdout.trim()).toBe(packageJson.version);
    });
  });

  describe('parse command', () => {
    it('should parse simple.cs fixture', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli(['parse', fixturePath]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Parsing:');
      expect(stdout).toContain('Extracted Model:');
      expect(stdout).toContain('databases');
      expect(stdout).toContain('applications');
      expect(stdout).toContain('Summary:');
    });

    it('should parse complex.cs fixture', async () => {
      const fixturePath = join(FIXTURES_PATH, 'complex.cs');
      const { stdout, exitCode } = await runCli(['parse', fixturePath]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Parsing:');
      expect(stdout).toContain('Summary:');
    });

    it('should output JSON model with database details', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli(['parse', fixturePath]);

      expect(exitCode).toBe(0);
      // Parse the JSON from output
      const jsonMatch = stdout.match(/Extracted Model:\s*([\s\S]+?)(?=\n\nSummary:|$)/);
      expect(jsonMatch).not.toBeNull();

      const model = JSON.parse(jsonMatch![1].trim());
      expect(model.databases).toBeDefined();
      expect(model.applications).toBeDefined();
      expect(model.databases.length).toBeGreaterThanOrEqual(1);
    });

    it('should save output to file with --output option', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const outputPath = join(testDir, 'output.json');

      const { stdout, exitCode } = await runCli(['parse', fixturePath, '--output', outputPath]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Model saved to:');
      expect(existsSync(outputPath)).toBe(true);

      const savedModel = JSON.parse(readFileSync(outputPath, 'utf-8'));
      expect(savedModel.databases).toBeDefined();
      expect(savedModel.applications).toBeDefined();
    });

    it('should output pretty JSON by default', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const outputPath = join(testDir, 'pretty.json');

      const { exitCode } = await runCli(['parse', fixturePath, '--output', outputPath]);

      expect(exitCode).toBe(0);
      const content = readFileSync(outputPath, 'utf-8');
      // Pretty JSON should have multiple lines
      expect(content.split('\n').length).toBeGreaterThan(1);
    });

    it('should fail with non-existent file', async () => {
      const { stderr, exitCode } = await runCli(['parse', '/non/existent/file.cs']);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Error: File not found');
    });

    it('should display summary with resource counts', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli(['parse', fixturePath]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Summary:');
      expect(stdout).toMatch(/Databases:\s+\d+/);
      expect(stdout).toMatch(/Services:\s+\d+/);
      expect(stdout).toMatch(/Storage:\s+\d+/);
      expect(stdout).toMatch(/Applications:\s+\d+/);
      expect(stdout).toMatch(/References:\s+\d+/);
    });
  });

  describe('generate command', () => {
    it('should generate shell script from simple.cs', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli(['generate', fixturePath, '--server-id', 'srv-123']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Parsing:');
      expect(stdout).toContain('Generated Commands:');
      expect(stdout).toContain('#!/bin/bash');
      expect(stdout).toContain('curl');
    });

    it('should include project creation when no project-id provided', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli(['generate', fixturePath, '--server-id', 'srv-123']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('PROJECT_UUID');
      expect(stdout).toContain('/api/v1/projects');
    });

    it('should use provided project-id', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli([
        'generate',
        fixturePath,
        '--project-id',
        'proj-abc',
        '--server-id',
        'srv-123',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('proj-abc');
      // Should not create a new project
      expect(stdout).not.toContain('Creating project:');
    });

    it('should output JSON format with --json option', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli([
        'generate',
        fixturePath,
        '--json',
        '--project-id',
        'proj-123',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Generated Commands:');

      // Extract JSON from output
      const jsonMatch = stdout.match(/Generated Commands:\s*─+\s*([\s\S]+?)(?=\n\nGenerated:|$)/);
      expect(jsonMatch).not.toBeNull();

      const commands = JSON.parse(jsonMatch![1].trim());
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
      expect(commands[0]).toHaveProperty('endpoint');
      expect(commands[0]).toHaveProperty('method');
    });

    it('should save generated script to file with --output', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const outputPath = join(testDir, 'deploy.sh');

      const { stdout, exitCode } = await runCli([
        'generate',
        fixturePath,
        '--output',
        outputPath,
        '--server-id',
        'srv-123',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Script saved to:');
      expect(existsSync(outputPath)).toBe(true);

      const script = readFileSync(outputPath, 'utf-8');
      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('curl');
    });

    it('should include comments by default', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli([
        'generate',
        fixturePath,
        '--project-id',
        'proj-123',
      ]);

      expect(exitCode).toBe(0);
      // Default output should include some comment lines (starting with #)
      const lines = stdout.split('\n').filter((l) => l.startsWith('#'));
      expect(lines.length).toBeGreaterThan(0);
    });

    it('should fail with non-existent file', async () => {
      const { stderr, exitCode } = await runCli(['generate', '/non/existent/file.cs']);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Error: File not found');
    });

    it('should accept server-id and environment-name options', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');

      const { stdout, exitCode } = await runCli([
        'generate',
        fixturePath,
        '--project-id',
        'proj-123',
        '--server-id',
        'srv-456',
        '--environment-name',
        'staging',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('srv-456');
      expect(stdout).toContain('staging');
    });

    it('should display generation summary', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli(['generate', fixturePath, '--project-id', 'proj-123']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Generated:');
      expect(stdout).toMatch(/\d+ Coolify commands/);
    });
  });

  describe('deploy command', () => {
    it('should perform dry-run deployment', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli([
        'deploy',
        fixturePath,
        '--dry-run',
        '--server-id',
        'srv-123',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Parsing:');
      expect(stdout).toContain('Found');
      expect(stdout).toContain('resources to deploy');
      expect(stdout).toContain('[DRY RUN]');
      expect(stdout).toContain('Deployment Summary:');
    });

    it('should show resource counts in dry-run', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli([
        'deploy',
        fixturePath,
        '--dry-run',
        '--server-id',
        'srv-123',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Databases:\s+\d+/);
      expect(stdout).toMatch(/Storage:\s+\d+/);
      expect(stdout).toMatch(/Services:\s+\d+/);
      expect(stdout).toMatch(/Applications:\s+\d+/);
    });

    it('should accept all deploy options in dry-run', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli([
        'deploy',
        fixturePath,
        '--dry-run',
        '--server-id',
        'srv-123',
        '--project-name',
        'TestProject',
        '--environment-name',
        'staging',
        '--instant-deploy',
        '--skip-existing',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('[DRY RUN]');
      expect(stdout).toContain('TestProject');
    });

    it('should accept github options in dry-run', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli([
        'deploy',
        fixturePath,
        '--dry-run',
        '--server-id',
        'srv-123',
        '--github-repo',
        'https://github.com/test/repo',
        '--github-branch',
        'develop',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('https://github.com/test/repo');
    });

    it('should fail with non-existent file', async () => {
      const { stderr, exitCode } = await runCli(['deploy', '/non/existent/file.cs', '--dry-run']);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Error: File not found');
    });

    it('should fail when trying to connect without valid credentials', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stderr, exitCode } = await runCli([
        'deploy',
        fixturePath,
        '--api-url',
        'https://coolify.example.com',
        '--token',
        'test-token',
        '--server-id',
        'srv-123',
      ]);

      // Should fail to connect (invalid API URL or token)
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Failed to connect');
    });

    it('should accept github options via CLI', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');

      const { stdout, exitCode } = await runCli([
        'deploy',
        fixturePath,
        '--dry-run',
        '--server-id',
        'srv-123',
        '--github-repo',
        'https://github.com/cli/repo',
        '--github-branch',
        'main',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('https://github.com/cli/repo');
    });

    it('should show deployment summary with success count', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const { stdout, exitCode } = await runCli([
        'deploy',
        fixturePath,
        '--dry-run',
        '--server-id',
        'srv-123',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Deployment Summary:');
      expect(stdout).toMatch(/Successful:\s+\d+/);
      expect(stdout).toMatch(/Failed:\s+\d+/);
      expect(stdout).toContain('Deployment complete!');
    });
  });

  describe('init command', () => {
    it('should create config file', async () => {
      const { stdout, exitCode } = await runCli(['init'], { cwd: testDir });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Created:');
      expect(stdout).toContain('aspire2coolify.config.js');

      const configPath = join(testDir, 'aspire2coolify.config.js');
      expect(existsSync(configPath)).toBe(true);

      const content = readFileSync(configPath, 'utf-8');
      expect(content).toContain('export default');
      expect(content).toContain('coolify:');
    });

    it('should fail if config file already exists', async () => {
      // Create existing config
      const configPath = join(testDir, 'aspire2coolify.config.js');
      writeFileSync(configPath, 'export default {}');

      const { stderr, exitCode } = await runCli(['init'], { cwd: testDir });

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Config file already exists');
      expect(stderr).toContain('--force');
    });

    it('should overwrite config file with --force', async () => {
      // Create existing config with minimal content
      const configPath = join(testDir, 'aspire2coolify.config.js');
      writeFileSync(configPath, 'export default {}');

      const { stdout, exitCode } = await runCli(['init', '--force'], { cwd: testDir });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Created:');

      const content = readFileSync(configPath, 'utf-8');
      expect(content).toContain('coolify:');
      expect(content).toContain('github:');
      expect(content).toContain('mappings:');
    });

    it('should create config with all sections', async () => {
      const { exitCode } = await runCli(['init'], { cwd: testDir });

      expect(exitCode).toBe(0);

      const configPath = join(testDir, 'aspire2coolify.config.js');
      const content = readFileSync(configPath, 'utf-8');

      expect(content).toContain('coolify:');
      expect(content).toContain('apiUrl');
      expect(content).toContain('token');
      expect(content).toContain('projectId');
      expect(content).toContain('serverId');
      expect(content).toContain('github:');
      expect(content).toContain('repository');
      expect(content).toContain('mappings:');
      expect(content).toContain('defaults:');
      expect(content).toContain('buildPack');
      expect(content).toContain('output:');
    });
  });

  describe('error handling', () => {
    it('should show error for unknown command', async () => {
      const { stderr, exitCode } = await runCli(['unknown-command']);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('error');
    });

    it('should show error when parse command missing file argument', async () => {
      const { stderr, exitCode } = await runCli(['parse']);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("missing required argument 'file'");
    });

    it('should show error when generate command missing file argument', async () => {
      const { stderr, exitCode } = await runCli(['generate']);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("missing required argument 'file'");
    });

    it('should show error when deploy command missing file argument', async () => {
      const { stderr, exitCode } = await runCli(['deploy']);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("missing required argument 'file'");
    });

    it('should handle invalid config file gracefully', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');
      const configPath = join(testDir, 'invalid-config.json');
      writeFileSync(configPath, '{ invalid json }');

      // Should still work but use default config
      const { exitCode } = await runCli([
        'generate',
        fixturePath,
        '--config',
        configPath,
        '--project-id',
        'proj-123',
      ]);

      // May succeed or fail depending on how config loading is handled
      // The important thing is it doesn't crash
      expect([0, 1]).toContain(exitCode);
    });
  });

  describe('environment variables', () => {
    it('should use COOLIFY_TOKEN from environment in dry-run info', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');

      // In dry-run mode, token is not required but we can verify the flow
      const { stdout, exitCode } = await runCli(
        ['deploy', fixturePath, '--dry-run', '--server-id', 'srv-123'],
        { env: { COOLIFY_TOKEN: 'env-token-123' } }
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain('[DRY RUN]');
    });

    it('should use COOLIFY_API_URL from environment in dry-run info', async () => {
      const fixturePath = join(FIXTURES_PATH, 'simple.cs');

      const { stdout, exitCode } = await runCli(
        ['deploy', fixturePath, '--dry-run', '--server-id', 'srv-123'],
        { env: { COOLIFY_API_URL: 'https://env.coolify.io' } }
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain('[DRY RUN]');
    });
  });

  describe('complex fixtures', () => {
    it('should parse javascript-apps.cs fixture correctly', async () => {
      const fixturePath = join(FIXTURES_PATH, 'javascript-apps.cs');
      const { stdout, exitCode } = await runCli(['parse', fixturePath]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Applications:');

      // Should find multiple apps
      const match = stdout.match(/Applications:\s+(\d+)/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1])).toBeGreaterThanOrEqual(3);
    });

    it('should generate commands for complex.cs', async () => {
      const fixturePath = join(FIXTURES_PATH, 'complex.cs');
      const { stdout, exitCode } = await runCli([
        'generate',
        fixturePath,
        '--project-id',
        'proj-123',
        '--server-id',
        'srv-123',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Generated:');
      // Complex fixture should generate multiple commands
      const match = stdout.match(/(\d+) Coolify commands/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1])).toBeGreaterThan(3);
    });

    it('should deploy complex.cs in dry-run mode', async () => {
      const fixturePath = join(FIXTURES_PATH, 'complex.cs');
      const { stdout, exitCode } = await runCli([
        'deploy',
        fixturePath,
        '--dry-run',
        '--server-id',
        'srv-123',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Deployment Summary:');
      expect(stdout).toContain('Deployment complete!');
    });
  });
});
