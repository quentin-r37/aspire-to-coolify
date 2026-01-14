/**
 * Coolify REST API client
 */

export interface CoolifyApiConfig {
  apiUrl: string;
  token: string;
}

export interface CoolifyApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateDatabaseResponse {
  uuid: string;
}

export interface CreateApplicationResponse {
  uuid: string;
}

export interface CreateServiceResponse {
  uuid: string;
  domains: string[];
}

// Database payload types
export interface PostgresDatabasePayload {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name?: string;
  description?: string;
  image?: string;
  postgres_user?: string;
  postgres_password?: string;
  postgres_db?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
}

export interface MysqlDatabasePayload {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name?: string;
  description?: string;
  image?: string;
  mysql_user?: string;
  mysql_password?: string;
  mysql_database?: string;
  mysql_root_password?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
}

export interface MongoDbDatabasePayload {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name?: string;
  description?: string;
  image?: string;
  mongo_initdb_root_username?: string;
  mongo_initdb_root_password?: string;
  mongo_initdb_database?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
}

export interface RedisDatabasePayload {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  name?: string;
  description?: string;
  image?: string;
  redis_password?: string;
  is_public?: boolean;
  public_port?: number;
  instant_deploy?: boolean;
}

// Application payload types
export interface DockerImageApplicationPayload {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  docker_registry_image_name: string;
  docker_registry_image_tag?: string;
  name?: string;
  description?: string;
  domains?: string;
  ports_exposes?: string;
  ports_mappings?: string;
  instant_deploy?: boolean;
}

export interface DockerfileApplicationPayload {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  dockerfile: string;
  name: string;
  description?: string;
  domains?: string;
  ports_exposes?: string;
  ports_mappings?: string;
  base_directory?: string;
  instant_deploy?: boolean;
}

// Service payload types
export interface ServicePayload {
  server_uuid: string;
  project_uuid: string;
  environment_name: string;
  type: string;
  name: string;
  description?: string;
  instant_deploy?: boolean;
  docker_compose_raw?: string;
}

export type DatabasePayload =
  | PostgresDatabasePayload
  | MysqlDatabasePayload
  | MongoDbDatabasePayload
  | RedisDatabasePayload;

export type ApplicationPayload = DockerImageApplicationPayload | DockerfileApplicationPayload;

export class CoolifyApiClient {
  private apiUrl: string;
  private token: string;

  constructor(config: CoolifyApiConfig) {
    // Remove trailing slash from API URL
    this.apiUrl = config.apiUrl.replace(/\/+$/, '');
    this.token = config.token;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<CoolifyApiResponse<T>> {
    const url = `${this.apiUrl}/api/v1${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
        }

        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = (await response.json()) as T;
      return {
        success: true,
        data,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Create a PostgreSQL database
   */
  async createPostgresDatabase(
    payload: PostgresDatabasePayload
  ): Promise<CoolifyApiResponse<CreateDatabaseResponse>> {
    return this.request<CreateDatabaseResponse>('POST', '/databases/postgresql', payload);
  }

  /**
   * Create a MySQL database
   */
  async createMysqlDatabase(
    payload: MysqlDatabasePayload
  ): Promise<CoolifyApiResponse<CreateDatabaseResponse>> {
    return this.request<CreateDatabaseResponse>('POST', '/databases/mysql', payload);
  }

  /**
   * Create a MongoDB database
   */
  async createMongoDatabase(
    payload: MongoDbDatabasePayload
  ): Promise<CoolifyApiResponse<CreateDatabaseResponse>> {
    return this.request<CreateDatabaseResponse>('POST', '/databases/mongodb', payload);
  }

  /**
   * Create a Redis database
   */
  async createRedisDatabase(
    payload: RedisDatabasePayload
  ): Promise<CoolifyApiResponse<CreateDatabaseResponse>> {
    return this.request<CreateDatabaseResponse>('POST', '/databases/redis', payload);
  }

  /**
   * Create a MariaDB database
   */
  async createMariaDbDatabase(
    payload: MysqlDatabasePayload
  ): Promise<CoolifyApiResponse<CreateDatabaseResponse>> {
    return this.request<CreateDatabaseResponse>('POST', '/databases/mariadb', payload);
  }

  /**
   * Create a Docker image application
   */
  async createDockerImageApplication(
    payload: DockerImageApplicationPayload
  ): Promise<CoolifyApiResponse<CreateApplicationResponse>> {
    return this.request<CreateApplicationResponse>('POST', '/applications/dockerimage', payload);
  }

  /**
   * Create a Dockerfile application
   */
  async createDockerfileApplication(
    payload: DockerfileApplicationPayload
  ): Promise<CoolifyApiResponse<CreateApplicationResponse>> {
    return this.request<CreateApplicationResponse>('POST', '/applications/dockerfile', payload);
  }

  /**
   * Create a service (one-click services like RabbitMQ, MinIO, etc.)
   */
  async createService(payload: ServicePayload): Promise<CoolifyApiResponse<CreateServiceResponse>> {
    return this.request<CreateServiceResponse>('POST', '/services', payload);
  }

  /**
   * Test connection to the Coolify API
   */
  async testConnection(): Promise<CoolifyApiResponse<{ version?: string }>> {
    return this.request<{ version?: string }>('GET', '/version');
  }
}
