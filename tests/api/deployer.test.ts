import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deployToCloudify, type DeployConfig } from '../../src/api/deployer.js';
import { CoolifyApiClient } from '../../src/api/coolify.js';
import type { AspireApp } from '../../src/models/aspire.js';
import { createEmptyAspireApp } from '../../src/models/aspire.js';

// Mock the CoolifyApiClient
vi.mock('../../src/api/coolify.js', () => {
  return {
    CoolifyApiClient: vi.fn().mockImplementation(() => ({
      listDatabases: vi.fn(),
      listApplications: vi.fn(),
      listServices: vi.fn(),
      createPostgresDatabase: vi.fn(),
      createMysqlDatabase: vi.fn(),
      createMongoDatabase: vi.fn(),
      createRedisDatabase: vi.fn(),
      createService: vi.fn(),
      createDockerImageApplication: vi.fn(),
      createPublicApplication: vi.fn(),
      createPrivateGithubAppApplication: vi.fn(),
    })),
  };
});

describe('deployToCloudify', () => {
  let mockClient: {
    listDatabases: ReturnType<typeof vi.fn>;
    listApplications: ReturnType<typeof vi.fn>;
    listServices: ReturnType<typeof vi.fn>;
    createPostgresDatabase: ReturnType<typeof vi.fn>;
    createMysqlDatabase: ReturnType<typeof vi.fn>;
    createMongoDatabase: ReturnType<typeof vi.fn>;
    createRedisDatabase: ReturnType<typeof vi.fn>;
    createService: ReturnType<typeof vi.fn>;
    createDockerImageApplication: ReturnType<typeof vi.fn>;
    createPublicApplication: ReturnType<typeof vi.fn>;
    createPrivateGithubAppApplication: ReturnType<typeof vi.fn>;
  };

  const baseConfig: DeployConfig = {
    projectUuid: 'project-123',
    serverUuid: 'server-456',
    environmentName: 'production',
    instantDeploy: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      listDatabases: vi.fn().mockResolvedValue({ success: true, data: [] }),
      listApplications: vi.fn().mockResolvedValue({ success: true, data: [] }),
      listServices: vi.fn().mockResolvedValue({ success: true, data: [] }),
      createPostgresDatabase: vi.fn().mockResolvedValue({ success: true, data: { uuid: 'db-uuid' } }),
      createMysqlDatabase: vi.fn().mockResolvedValue({ success: true, data: { uuid: 'mysql-uuid' } }),
      createMongoDatabase: vi.fn().mockResolvedValue({ success: true, data: { uuid: 'mongo-uuid' } }),
      createRedisDatabase: vi.fn().mockResolvedValue({ success: true, data: { uuid: 'redis-uuid' } }),
      createService: vi.fn().mockResolvedValue({ success: true, data: { uuid: 'svc-uuid', domains: [] } }),
      createDockerImageApplication: vi.fn().mockResolvedValue({ success: true, data: { uuid: 'app-uuid' } }),
      createPublicApplication: vi.fn().mockResolvedValue({ success: true, data: { uuid: 'public-app-uuid' } }),
      createPrivateGithubAppApplication: vi.fn().mockResolvedValue({ success: true, data: { uuid: 'private-app-uuid' } }),
    };
  });

  describe('dry run mode', () => {
    it('should not make API calls in dry run mode', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'mydb', type: 'postgres', hasDataVolume: true, environment: [] }],
      };

      const logs: string[] = [];
      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig, {
        dryRun: true,
        onProgress: (msg) => logs.push(msg),
      });

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockClient.createPostgresDatabase).not.toHaveBeenCalled();
      expect(mockClient.listDatabases).not.toHaveBeenCalled();
      expect(logs.some((l) => l.includes('[DRY RUN]'))).toBe(true);
    });

    it('should return dry-run-uuid for all resources', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'db', type: 'postgres', hasDataVolume: false, environment: [] }],
        services: [{ name: 'mq', type: 'rabbitmq', environment: [], volumes: [], endpoints: [], references: [] }],
        applications: [{ name: 'webapp', type: 'npm', buildPack: 'nixpacks', environment: [], endpoints: [], references: [] }],
      };

      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig, { dryRun: true });

      expect(result.results).toHaveLength(3);
      result.results.forEach((r) => {
        expect(r.uuid).toBe('dry-run-uuid');
        expect(r.success).toBe(true);
      });
    });
  });

  describe('database deployment', () => {
    it('should deploy postgres database', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'mydb', type: 'postgres', hasDataVolume: true, environment: [] }],
      };

      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createPostgresDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          server_uuid: 'server-456',
          project_uuid: 'project-123',
          environment_name: 'production',
          name: 'mydb',
          instant_deploy: true,
        })
      );
      expect(result.successful).toBe(1);
      expect(result.results[0].uuid).toBe('db-uuid');
    });

    it('should deploy mysql database', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'mysqldb', type: 'mysql', hasDataVolume: false, environment: [] }],
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createMysqlDatabase).toHaveBeenCalled();
    });

    it('should deploy mongodb database', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'mongo', type: 'mongodb', hasDataVolume: false, environment: [] }],
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createMongoDatabase).toHaveBeenCalled();
    });

    it('should deploy redis database', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'cache', type: 'redis', hasDataVolume: false, environment: [] }],
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createRedisDatabase).toHaveBeenCalled();
    });

    it('should handle unsupported database type', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'unknown', type: 'unknown' as any, hasDataVolume: false, environment: [] }],
      };

      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(result.failed).toBe(1);
      expect(result.results[0].error).toContain('Unsupported database type');
    });

    it('should use postgres fallback for sqlserver', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'sqldb', type: 'sqlserver', hasDataVolume: false, environment: [] }],
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createPostgresDatabase).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SQL Server not supported'));

      consoleSpy.mockRestore();
    });

    it('should include custom image in payload', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [
          {
            name: 'vectordb',
            type: 'postgres',
            image: 'pgvector/pgvector',
            imageTag: 'pg16',
            hasDataVolume: false,
            environment: [],
          },
        ],
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createPostgresDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          image: 'pgvector/pgvector:pg16',
        })
      );
    });

    it('should set is_public and public_port when hostPort is specified', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'db', type: 'postgres', hasDataVolume: false, hostPort: 5432, environment: [] }],
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createPostgresDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          is_public: true,
          public_port: 5432,
        })
      );
    });

    it('should handle database creation failure', async () => {
      mockClient.createPostgresDatabase.mockResolvedValueOnce({
        success: false,
        error: 'Database limit exceeded',
      });

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'db', type: 'postgres', hasDataVolume: false, environment: [] }],
      };

      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(result.failed).toBe(1);
      expect(result.results[0].error).toBe('Database limit exceeded');
    });

    it('should handle database creation exception', async () => {
      mockClient.createPostgresDatabase.mockRejectedValueOnce(new Error('Network error'));

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'db', type: 'postgres', hasDataVolume: false, environment: [] }],
      };

      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(result.failed).toBe(1);
      expect(result.results[0].error).toBe('Network error');
    });
  });

  describe('service deployment', () => {
    it('should deploy rabbitmq service', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        services: [{ name: 'messaging', type: 'rabbitmq', environment: [], volumes: [], endpoints: [], references: [] }],
      };

      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createService).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rabbitmq',
          name: 'messaging',
        })
      );
      expect(result.successful).toBe(1);
    });

    it('should map minio to minio-community-edition', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        services: [{ name: 'storage', type: 'minio', environment: [], volumes: [], endpoints: [], references: [] }],
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createService).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'minio-community-edition',
        })
      );
    });

    it('should deploy storage services', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        storage: [{ name: 'blob', type: 'minio', environment: [], volumes: [] }],
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createService).toHaveBeenCalled();
    });

    it('should handle service creation failure', async () => {
      mockClient.createService.mockResolvedValueOnce({
        success: false,
        error: 'Service type not supported',
      });

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        services: [{ name: 'svc', type: 'custom', environment: [], volumes: [], endpoints: [], references: [] }],
      };

      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(result.failed).toBe(1);
      expect(result.results[0].error).toBe('Service type not supported');
    });

    it('should handle service creation exception', async () => {
      mockClient.createService.mockRejectedValueOnce(new Error('API timeout'));

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        services: [{ name: 'svc', type: 'rabbitmq', environment: [], volumes: [], endpoints: [], references: [] }],
      };

      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(result.failed).toBe(1);
      expect(result.results[0].error).toBe('API timeout');
    });
  });

  describe('application deployment', () => {
    it('should deploy docker image application without github config', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        applications: [
          {
            name: 'webapp',
            type: 'project',
            project: 'MyProject.Web',
            buildPack: 'nixpacks',
            environment: [],
            endpoints: [{ port: 8080, protocol: 'http', isExternal: true }],
            references: [],
          },
        ],
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createDockerImageApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          docker_registry_image_name: 'MyProject.Web',
          docker_registry_image_tag: 'latest',
          ports_exposes: '8080',
        })
      );
    });

    it('should deploy public repository application with github config', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        applications: [
          {
            name: 'webapp',
            type: 'npm',
            buildPack: 'nixpacks',
            environment: [],
            endpoints: [],
            references: [],
          },
        ],
      };

      const configWithGithub: DeployConfig = {
        ...baseConfig,
        github: {
          repository: 'https://github.com/user/repo',
          branch: 'main',
        },
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, configWithGithub);

      expect(mockClient.createPublicApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          git_repository: 'https://github.com/user/repo',
          git_branch: 'main',
          build_pack: 'nixpacks',
        })
      );
    });

    it('should deploy private github app application', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        applications: [
          {
            name: 'private-app',
            type: 'project',
            buildPack: 'dockerfile',
            environment: [],
            endpoints: [],
            references: [],
          },
        ],
      };

      const configWithPrivateGithub: DeployConfig = {
        ...baseConfig,
        github: {
          repository: 'user/private-repo',
          branch: 'develop',
          appUuid: 'github-app-123',
        },
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, configWithPrivateGithub);

      expect(mockClient.createPrivateGithubAppApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          github_app_uuid: 'github-app-123',
          git_repository: 'user/private-repo',
          git_branch: 'develop',
          build_pack: 'dockerfile',
        })
      );
    });

    it('should combine github basePath with application sourcePath', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        applications: [
          {
            name: 'api',
            type: 'project',
            sourcePath: '../src/Api',
            buildPack: 'nixpacks',
            environment: [],
            endpoints: [],
            references: [],
          },
        ],
      };

      const configWithBasePath: DeployConfig = {
        ...baseConfig,
        github: {
          repository: 'https://github.com/user/monorepo',
          branch: 'main',
          basePath: 'apps',
        },
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, configWithBasePath);

      expect(mockClient.createPublicApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          base_directory: 'apps/src/Api',
        })
      );
    });

    it('should use application sourcePath as base_directory when no github basePath', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        applications: [
          {
            name: 'api',
            type: 'project',
            sourcePath: './src/Api',
            buildPack: 'nixpacks',
            environment: [],
            endpoints: [],
            references: [],
          },
        ],
      };

      const configWithGithub: DeployConfig = {
        ...baseConfig,
        github: {
          repository: 'https://github.com/user/repo',
          branch: 'main',
        },
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, configWithGithub);

      expect(mockClient.createPublicApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          base_directory: 'src/Api',
        })
      );
    });

    it('should use config buildPack over application buildPack', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        applications: [
          {
            name: 'webapp',
            type: 'npm',
            buildPack: 'nixpacks',
            environment: [],
            endpoints: [],
            references: [],
          },
        ],
      };

      const configWithBuildPack: DeployConfig = {
        ...baseConfig,
        buildPack: 'dockerfile',
        github: { repository: 'https://github.com/user/repo' },
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, configWithBuildPack);

      expect(mockClient.createPublicApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          build_pack: 'dockerfile',
        })
      );
    });

    it('should use default ports when no endpoints defined', async () => {
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        applications: [
          {
            name: 'webapp',
            type: 'npm',
            buildPack: 'nixpacks',
            environment: [],
            endpoints: [],
            references: [],
          },
        ],
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createDockerImageApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          ports_exposes: '80',
        })
      );
    });

    it('should handle application creation failure', async () => {
      mockClient.createDockerImageApplication.mockResolvedValueOnce({
        success: false,
        error: 'Invalid image name',
      });

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        applications: [
          {
            name: 'app',
            type: 'project',
            buildPack: 'nixpacks',
            environment: [],
            endpoints: [],
            references: [],
          },
        ],
      };

      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(result.failed).toBe(1);
      expect(result.results[0].error).toBe('Invalid image name');
    });

    it('should handle application creation exception', async () => {
      mockClient.createDockerImageApplication.mockRejectedValueOnce(new Error('Timeout'));

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        applications: [
          {
            name: 'app',
            type: 'project',
            buildPack: 'nixpacks',
            environment: [],
            endpoints: [],
            references: [],
          },
        ],
      };

      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(result.failed).toBe(1);
      expect(result.results[0].error).toBe('Timeout');
    });
  });

  describe('skip existing resources', () => {
    it('should skip existing database when skipExisting is true', async () => {
      mockClient.listDatabases.mockResolvedValueOnce({
        success: true,
        data: [{ name: 'mydb', uuid: 'existing-db-uuid' }],
      });

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'mydb', type: 'postgres', hasDataVolume: false, environment: [] }],
      };

      const result = await deployToCloudify(
        mockClient as unknown as CoolifyApiClient,
        app,
        { ...baseConfig, skipExisting: true }
      );

      expect(mockClient.createPostgresDatabase).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
      expect(result.results[0].skipped).toBe(true);
      expect(result.results[0].uuid).toBe('existing-db-uuid');
    });

    it('should fail on existing database when skipExisting is false', async () => {
      mockClient.listDatabases.mockResolvedValueOnce({
        success: true,
        data: [{ name: 'mydb', uuid: 'existing-db-uuid' }],
      });

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'mydb', type: 'postgres', hasDataVolume: false, environment: [] }],
      };

      const result = await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(mockClient.createPostgresDatabase).not.toHaveBeenCalled();
      expect(result.failed).toBe(1);
      expect(result.results[0].error).toContain('already exists');
    });

    it('should skip existing service when skipExisting is true', async () => {
      mockClient.listServices.mockResolvedValueOnce({
        success: true,
        data: [{ name: 'rabbitmq', uuid: 'existing-svc-uuid' }],
      });

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        services: [{ name: 'rabbitmq', type: 'rabbitmq', environment: [], volumes: [], endpoints: [], references: [] }],
      };

      const result = await deployToCloudify(
        mockClient as unknown as CoolifyApiClient,
        app,
        { ...baseConfig, skipExisting: true }
      );

      expect(mockClient.createService).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });

    it('should skip existing application when skipExisting is true', async () => {
      mockClient.listApplications.mockResolvedValueOnce({
        success: true,
        data: [{ name: 'webapp', uuid: 'existing-app-uuid' }],
      });

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        applications: [
          { name: 'webapp', type: 'npm', buildPack: 'nixpacks', environment: [], endpoints: [], references: [] },
        ],
      };

      const result = await deployToCloudify(
        mockClient as unknown as CoolifyApiClient,
        app,
        { ...baseConfig, skipExisting: true }
      );

      expect(mockClient.createDockerImageApplication).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });

    it('should skip existing storage service when skipExisting is true', async () => {
      mockClient.listServices.mockResolvedValueOnce({
        success: true,
        data: [{ name: 'minio', uuid: 'existing-storage-uuid' }],
      });

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        storage: [{ name: 'minio', type: 'minio', environment: [], volumes: [] }],
      };

      const result = await deployToCloudify(
        mockClient as unknown as CoolifyApiClient,
        app,
        { ...baseConfig, skipExisting: true }
      );

      expect(mockClient.createService).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });
  });

  describe('deployment summary', () => {
    it('should return correct counts for mixed results', async () => {
      mockClient.listDatabases.mockResolvedValueOnce({
        success: true,
        data: [{ name: 'existing-db', uuid: 'existing-uuid' }],
      });

      mockClient.createMysqlDatabase.mockResolvedValueOnce({
        success: false,
        error: 'Failed to create',
      });

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [
          { name: 'existing-db', type: 'postgres', hasDataVolume: false, environment: [] },
          { name: 'new-postgres', type: 'postgres', hasDataVolume: false, environment: [] },
          { name: 'new-mysql', type: 'mysql', hasDataVolume: false, environment: [] },
        ],
      };

      const result = await deployToCloudify(
        mockClient as unknown as CoolifyApiClient,
        app,
        { ...baseConfig, skipExisting: true }
      );

      expect(result.skipped).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(3);
    });
  });

  describe('progress logging', () => {
    it('should call onProgress callback for each operation', async () => {
      const logs: string[] = [];
      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'db', type: 'postgres', hasDataVolume: false, environment: [] }],
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig, {
        onProgress: (msg) => logs.push(msg),
      });

      expect(logs.some((l) => l.includes('Fetching existing resources'))).toBe(true);
      expect(logs.some((l) => l.includes('Creating database'))).toBe(true);
      expect(logs.some((l) => l.includes('Created database'))).toBe(true);
    });

    it('should use console.log when no onProgress callback provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const app: AspireApp = {
        ...createEmptyAspireApp(),
        databases: [{ name: 'db', type: 'postgres', hasDataVolume: false, environment: [] }],
      };

      await deployToCloudify(mockClient as unknown as CoolifyApiClient, app, baseConfig);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
