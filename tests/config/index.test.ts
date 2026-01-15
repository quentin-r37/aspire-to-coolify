import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadConfig,
  loadConfigFile,
  getDefaultConfig,
  createConfigTemplate,
  type Aspire2CoolifyConfig,
} from '../../src/config/index.js';

describe('Config Module', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `aspire2coolify-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getDefaultConfig', () => {
    it('should return default config object', () => {
      const config = getDefaultConfig();

      expect(config).toBeDefined();
      expect(config.coolify).toEqual({});
      expect(config.mappings).toEqual({});
    });

    it('should have default buildPack as nixpacks', () => {
      const config = getDefaultConfig();

      expect(config.defaults?.buildPack).toBe('nixpacks');
    });

    it('should have default output format as shell', () => {
      const config = getDefaultConfig();

      expect(config.output?.format).toBe('shell');
    });

    it('should have includeComments enabled by default', () => {
      const config = getDefaultConfig();

      expect(config.output?.includeComments).toBe(true);
    });

    it('should return a new object each time', () => {
      const config1 = getDefaultConfig();
      const config2 = getDefaultConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('createConfigTemplate', () => {
    it('should return a non-empty string', () => {
      const template = createConfigTemplate();

      expect(template).toBeDefined();
      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(0);
    });

    it('should include module export', () => {
      const template = createConfigTemplate();

      expect(template).toContain('export default');
    });

    it('should include coolify section', () => {
      const template = createConfigTemplate();

      expect(template).toContain('coolify:');
      expect(template).toContain('apiUrl');
      expect(template).toContain('token');
      expect(template).toContain('projectId');
      expect(template).toContain('serverId');
      expect(template).toContain('environmentName');
      expect(template).toContain('skipExisting');
    });

    it('should include github section', () => {
      const template = createConfigTemplate();

      expect(template).toContain('github:');
      expect(template).toContain('repository');
      expect(template).toContain('branch');
      expect(template).toContain('basePath');
      expect(template).toContain('appUuid');
    });

    it('should include mappings section', () => {
      const template = createConfigTemplate();

      expect(template).toContain('mappings:');
      expect(template).toContain('databases:');
      expect(template).toContain('services:');
    });

    it('should include defaults section', () => {
      const template = createConfigTemplate();

      expect(template).toContain('defaults:');
      expect(template).toContain('buildPack');
      expect(template).toContain('nixpacks');
    });

    it('should include output section', () => {
      const template = createConfigTemplate();

      expect(template).toContain('output:');
      expect(template).toContain('includeComments');
      expect(template).toContain('format');
    });

    it('should be valid JavaScript syntax', () => {
      const template = createConfigTemplate();

      // Remove the export default and try to parse the object
      const objectPart = template
        .replace('// aspire2coolify.config.js', '')
        .replace('export default', 'const config =');

      // This should not throw
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        new Function(objectPart);
      }).not.toThrow();
    });
  });

  describe('loadConfigFile', () => {
    it('should load JSON config file', async () => {
      const configPath = join(testDir, 'aspire2coolify.config.json');
      const config: Aspire2CoolifyConfig = {
        coolify: {
          apiUrl: 'https://coolify.example.com',
          projectId: 'proj-123',
        },
        defaults: {
          buildPack: 'dockerfile',
        },
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const loaded = await loadConfigFile(configPath);

      expect(loaded.coolify?.apiUrl).toBe('https://coolify.example.com');
      expect(loaded.coolify?.projectId).toBe('proj-123');
      expect(loaded.defaults?.buildPack).toBe('dockerfile');
    });

    it('should load config with github settings', async () => {
      const configPath = join(testDir, 'aspire2coolify.config.json');
      const config: Aspire2CoolifyConfig = {
        github: {
          repository: 'https://github.com/org/repo',
          branch: 'develop',
          basePath: 'src',
          appUuid: 'app-uuid-123',
        },
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const loaded = await loadConfigFile(configPath);

      expect(loaded.github?.repository).toBe('https://github.com/org/repo');
      expect(loaded.github?.branch).toBe('develop');
      expect(loaded.github?.basePath).toBe('src');
      expect(loaded.github?.appUuid).toBe('app-uuid-123');
    });

    it('should load config with mappings', async () => {
      const configPath = join(testDir, 'aspire2coolify.config.json');
      const config: Aspire2CoolifyConfig = {
        mappings: {
          databases: {
            sqlserver: 'postgres',
            oracle: 'postgres',
          },
          services: {
            maildev: 'mailpit',
          },
          buildPacks: {
            npm: 'nixpacks',
          },
        },
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const loaded = await loadConfigFile(configPath);

      expect(loaded.mappings?.databases?.sqlserver).toBe('postgres');
      expect(loaded.mappings?.databases?.oracle).toBe('postgres');
      expect(loaded.mappings?.services?.maildev).toBe('mailpit');
      expect(loaded.mappings?.buildPacks?.npm).toBe('nixpacks');
    });

    it('should load config with output settings', async () => {
      const configPath = join(testDir, 'aspire2coolify.config.json');
      const config: Aspire2CoolifyConfig = {
        output: {
          includeComments: false,
          format: 'json',
        },
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const loaded = await loadConfigFile(configPath);

      expect(loaded.output?.includeComments).toBe(false);
      expect(loaded.output?.format).toBe('json');
    });

    it('should return empty object for non-existent file', async () => {
      const loaded = await loadConfigFile(join(testDir, 'non-existent.json'));

      expect(loaded).toEqual({});
    });

    it('should return empty object for invalid JSON', async () => {
      const configPath = join(testDir, 'invalid.json');
      writeFileSync(configPath, '{ invalid json }');

      const loaded = await loadConfigFile(configPath);

      expect(loaded).toEqual({});
    });

    it('should load .aspire2coolifyrc file', async () => {
      const configPath = join(testDir, '.aspire2coolifyrc');
      const config = {
        coolify: {
          apiUrl: 'https://rc.example.com',
        },
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const loaded = await loadConfigFile(configPath);

      expect(loaded.coolify?.apiUrl).toBe('https://rc.example.com');
    });

    it('should load complete config with all sections', async () => {
      const configPath = join(testDir, 'complete.json');
      const config: Aspire2CoolifyConfig = {
        coolify: {
          apiUrl: 'https://coolify.io',
          token: 'secret-token',
          projectId: 'proj-id',
          serverId: 'srv-id',
          environmentId: 'env-id',
          environmentName: 'production',
          skipExisting: true,
        },
        github: {
          repository: 'https://github.com/user/repo',
          branch: 'main',
          basePath: 'apps',
          appUuid: 'gh-app',
        },
        mappings: {
          databases: { custom: 'postgres' },
          services: { custom: 'rabbitmq' },
          buildPacks: { custom: 'dockerfile' },
        },
        defaults: {
          buildPack: 'dockerfile',
          region: 'us-east-1',
        },
        output: {
          includeComments: true,
          format: 'yaml',
        },
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const loaded = await loadConfigFile(configPath);

      expect(loaded).toEqual(config);
    });
  });

  describe('loadConfig', () => {
    it('should find config in directory with aspire2coolify.config.json', async () => {
      const configPath = join(testDir, 'aspire2coolify.config.json');
      const config: Aspire2CoolifyConfig = {
        coolify: {
          apiUrl: 'https://found.example.com',
        },
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const loaded = await loadConfig(testDir);

      expect(loaded.coolify?.apiUrl).toBe('https://found.example.com');
    });

    it('should find config in directory with .aspire2coolifyrc.json', async () => {
      const configPath = join(testDir, '.aspire2coolifyrc.json');
      const config: Aspire2CoolifyConfig = {
        coolify: {
          projectId: 'rc-project',
        },
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const loaded = await loadConfig(testDir);

      expect(loaded.coolify?.projectId).toBe('rc-project');
    });

    it('should find config in directory with .aspire2coolifyrc', async () => {
      const configPath = join(testDir, '.aspire2coolifyrc');
      const config: Aspire2CoolifyConfig = {
        defaults: {
          buildPack: 'static',
        },
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const loaded = await loadConfig(testDir);

      expect(loaded.defaults?.buildPack).toBe('static');
    });

    it('should return empty object when no config found', async () => {
      const emptyDir = join(testDir, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      const loaded = await loadConfig(emptyDir);

      expect(loaded).toEqual({});
    });

    it('should search from current directory when no path provided', async () => {
      // This test verifies the function doesn't throw when called without arguments
      const loaded = await loadConfig();

      // Should return either found config or empty object
      expect(loaded).toBeDefined();
      expect(typeof loaded).toBe('object');
    });

    it('should find config in package.json with aspire2coolify key', async () => {
      const packagePath = join(testDir, 'package.json');
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        aspire2coolify: {
          coolify: {
            apiUrl: 'https://package.example.com',
          },
        },
      };

      writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

      const loaded = await loadConfig(testDir);

      expect(loaded.coolify?.apiUrl).toBe('https://package.example.com');
    });

    it('should prefer aspire2coolify.config.json over package.json', async () => {
      // Create both files
      const configPath = join(testDir, 'aspire2coolify.config.json');
      const packagePath = join(testDir, 'package.json');

      writeFileSync(configPath, JSON.stringify({ coolify: { apiUrl: 'https://config.example.com' } }));
      writeFileSync(packagePath, JSON.stringify({
        name: 'test',
        aspire2coolify: { coolify: { apiUrl: 'https://package.example.com' } },
      }));

      const loaded = await loadConfig(testDir);

      // aspire2coolify.config.json should take precedence
      expect(loaded.coolify?.apiUrl).toBe('https://config.example.com');
    });

    it('should handle malformed config gracefully', async () => {
      const configPath = join(testDir, 'aspire2coolify.config.json');
      writeFileSync(configPath, 'not valid json at all');

      const loaded = await loadConfig(testDir);

      expect(loaded).toEqual({});
    });
  });

  describe('Config Type Validation', () => {
    it('should accept minimal config', async () => {
      const configPath = join(testDir, 'minimal.json');
      writeFileSync(configPath, '{}');

      const loaded = await loadConfigFile(configPath);

      expect(loaded).toEqual({});
    });

    it('should accept config with only coolify section', async () => {
      const configPath = join(testDir, 'coolify-only.json');
      const config: Aspire2CoolifyConfig = {
        coolify: {
          apiUrl: 'https://api.example.com',
        },
      };

      writeFileSync(configPath, JSON.stringify(config));

      const loaded = await loadConfigFile(configPath);

      expect(loaded.coolify).toBeDefined();
      expect(loaded.github).toBeUndefined();
      expect(loaded.mappings).toBeUndefined();
    });

    it('should accept config with only github section', async () => {
      const configPath = join(testDir, 'github-only.json');
      const config: Aspire2CoolifyConfig = {
        github: {
          repository: 'https://github.com/test/repo',
        },
      };

      writeFileSync(configPath, JSON.stringify(config));

      const loaded = await loadConfigFile(configPath);

      expect(loaded.github).toBeDefined();
      expect(loaded.coolify).toBeUndefined();
    });

    it('should accept config with skipExisting flag', async () => {
      const configPath = join(testDir, 'skip.json');
      const config: Aspire2CoolifyConfig = {
        coolify: {
          skipExisting: true,
        },
      };

      writeFileSync(configPath, JSON.stringify(config));

      const loaded = await loadConfigFile(configPath);

      expect(loaded.coolify?.skipExisting).toBe(true);
    });

    it('should accept config with environmentId and environmentName', async () => {
      const configPath = join(testDir, 'env.json');
      const config: Aspire2CoolifyConfig = {
        coolify: {
          environmentId: 'env-uuid-123',
          environmentName: 'staging',
        },
      };

      writeFileSync(configPath, JSON.stringify(config));

      const loaded = await loadConfigFile(configPath);

      expect(loaded.coolify?.environmentId).toBe('env-uuid-123');
      expect(loaded.coolify?.environmentName).toBe('staging');
    });
  });
});
