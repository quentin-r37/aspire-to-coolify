import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CoolifyApiClient,
  type PostgresDatabasePayload,
  type MysqlDatabasePayload,
  type MongoDbDatabasePayload,
  type RedisDatabasePayload,
  type DockerImageApplicationPayload,
  type PublicRepositoryApplicationPayload,
  type ServicePayload,
} from '../../src/api/coolify.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('CoolifyApiClient', () => {
  let client: CoolifyApiClient;

  beforeEach(() => {
    client = new CoolifyApiClient({
      apiUrl: 'https://coolify.example.com',
      token: 'test-token-123',
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should remove trailing slash from API URL', () => {
      const clientWithSlash = new CoolifyApiClient({
        apiUrl: 'https://coolify.example.com/',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'test-uuid' }),
      });

      // Trigger a request to verify URL formatting
      clientWithSlash.listProjects();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/projects',
        expect.any(Object)
      );
    });

    it('should handle multiple trailing slashes', () => {
      const clientWithSlashes = new CoolifyApiClient({
        apiUrl: 'https://coolify.example.com///',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'test-uuid' }),
      });

      clientWithSlashes.listProjects();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/projects',
        expect.any(Object)
      );
    });
  });

  describe('request headers', () => {
    it('should include authorization bearer token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await client.listProjects();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should include content-type and accept headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await client.listProjects();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle HTTP error with JSON error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({ message: 'Invalid payload' }),
      });

      const result = await client.listProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid payload');
    });

    it('should handle HTTP error with error field in JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ error: 'Invalid token' }),
      });

      const result = await client.listProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should handle HTTP error with plain text response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server crashed',
      });

      const result = await client.listProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server crashed');
    });

    it('should handle HTTP error with empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      });

      const result = await client.listProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 404: Not Found');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.listProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValueOnce('String error');

      const result = await client.listProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('createPostgresDatabase', () => {
    it('should create postgres database successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'db-uuid-123' }),
      });

      const payload: PostgresDatabasePayload = {
        server_uuid: 'server-1',
        project_uuid: 'project-1',
        environment_name: 'production',
        name: 'mydb',
        instant_deploy: true,
      };

      const result = await client.createPostgresDatabase(payload);

      expect(result.success).toBe(true);
      expect(result.data?.uuid).toBe('db-uuid-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/databases/postgresql',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
    });
  });

  describe('createMysqlDatabase', () => {
    it('should create mysql database successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'mysql-uuid' }),
      });

      const payload: MysqlDatabasePayload = {
        server_uuid: 'server-1',
        project_uuid: 'project-1',
        environment_name: 'production',
        name: 'mysqldb',
      };

      const result = await client.createMysqlDatabase(payload);

      expect(result.success).toBe(true);
      expect(result.data?.uuid).toBe('mysql-uuid');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/databases/mysql',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('createMongoDatabase', () => {
    it('should create mongodb database successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'mongo-uuid' }),
      });

      const payload: MongoDbDatabasePayload = {
        server_uuid: 'server-1',
        project_uuid: 'project-1',
        environment_name: 'production',
        name: 'mongodb',
      };

      const result = await client.createMongoDatabase(payload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/databases/mongodb',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('createRedisDatabase', () => {
    it('should create redis database successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'redis-uuid' }),
      });

      const payload: RedisDatabasePayload = {
        server_uuid: 'server-1',
        project_uuid: 'project-1',
        environment_name: 'production',
        name: 'cache',
      };

      const result = await client.createRedisDatabase(payload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/databases/redis',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('createMariaDbDatabase', () => {
    it('should create mariadb database successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'mariadb-uuid' }),
      });

      const payload: MysqlDatabasePayload = {
        server_uuid: 'server-1',
        project_uuid: 'project-1',
        environment_name: 'production',
        name: 'mariadb',
      };

      const result = await client.createMariaDbDatabase(payload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/databases/mariadb',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('createDockerImageApplication', () => {
    it('should create docker image application successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'app-uuid' }),
      });

      const payload: DockerImageApplicationPayload = {
        server_uuid: 'server-1',
        project_uuid: 'project-1',
        environment_name: 'production',
        docker_registry_image_name: 'nginx',
        docker_registry_image_tag: 'latest',
        name: 'web',
      };

      const result = await client.createDockerImageApplication(payload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/applications/dockerimage',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('createPublicApplication', () => {
    it('should create public repository application successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'public-app-uuid' }),
      });

      const payload: PublicRepositoryApplicationPayload = {
        server_uuid: 'server-1',
        project_uuid: 'project-1',
        environment_name: 'production',
        git_repository: 'https://github.com/user/repo',
        git_branch: 'main',
        build_pack: 'nixpacks',
        name: 'myapp',
      };

      const result = await client.createPublicApplication(payload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/applications/public',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('createPrivateGithubAppApplication', () => {
    it('should create private github app application successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'private-app-uuid' }),
      });

      const result = await client.createPrivateGithubAppApplication({
        server_uuid: 'server-1',
        project_uuid: 'project-1',
        environment_name: 'production',
        github_app_uuid: 'github-app-uuid',
        git_repository: 'user/repo',
        git_branch: 'main',
        build_pack: 'nixpacks',
        name: 'private-app',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/applications/private-github-app',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('createDockerfileApplication', () => {
    it('should create dockerfile application successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'dockerfile-app-uuid' }),
      });

      const result = await client.createDockerfileApplication({
        server_uuid: 'server-1',
        project_uuid: 'project-1',
        environment_name: 'production',
        dockerfile: 'FROM node:18\nCOPY . .\nRUN npm install',
        name: 'dockerfile-app',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/applications/dockerfile',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('createService', () => {
    it('should create service successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'svc-uuid', domains: ['rabbitmq.example.com'] }),
      });

      const payload: ServicePayload = {
        server_uuid: 'server-1',
        project_uuid: 'project-1',
        environment_name: 'production',
        type: 'rabbitmq',
        name: 'messaging',
      };

      const result = await client.createService(payload);

      expect(result.success).toBe(true);
      expect(result.data?.uuid).toBe('svc-uuid');
      expect(result.data?.domains).toEqual(['rabbitmq.example.com']);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/services',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('testConnection', () => {
    it('should return success with JSON version response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ version: '4.0.0' }),
      });

      const result = await client.testConnection();

      expect(result.success).toBe(true);
      expect(result.data?.version).toBe('4.0.0');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/version',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Accept: 'application/json, text/plain',
          }),
        })
      );
    });

    it('should return success with plain text version response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '4.0.0-beta.1',
      });

      const result = await client.testConnection();

      expect(result.success).toBe(true);
      expect(result.data?.version).toBe('4.0.0-beta.1');
    });

    it('should handle connection error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await client.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 401: Unauthorized');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await client.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('createProject', () => {
    it('should create project successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'project-uuid-123' }),
      });

      const result = await client.createProject({
        name: 'My Project',
        description: 'A test project',
      });

      expect(result.success).toBe(true);
      expect(result.data?.uuid).toBe('project-uuid-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'My Project', description: 'A test project' }),
        })
      );
    });
  });

  describe('listProjects', () => {
    it('should list projects successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { uuid: 'proj-1', name: 'Project 1' },
          { uuid: 'proj-2', name: 'Project 2' },
        ],
      });

      const result = await client.listProjects();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].uuid).toBe('proj-1');
    });
  });

  describe('createEnvironment', () => {
    it('should create environment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, name: 'staging', project_id: 123 }),
      });

      const result = await client.createEnvironment('project-uuid', 'staging');

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('staging');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/projects/project-uuid/environments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'staging' }),
        })
      );
    });
  });

  describe('listDatabases', () => {
    it('should list databases successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { uuid: 'db-1', name: 'postgres', type: 'postgresql' },
          { uuid: 'db-2', name: 'redis', type: 'redis' },
        ],
      });

      const result = await client.listDatabases();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/databases',
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('listApplications', () => {
    it('should list applications successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ uuid: 'app-1', name: 'webapp' }],
      });

      const result = await client.listApplications();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/applications',
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('listServices', () => {
    it('should list services successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ uuid: 'svc-1', name: 'rabbitmq' }],
      });

      const result = await client.listServices();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/services',
        expect.objectContaining({ method: 'GET' })
      );
    });
  });
});
