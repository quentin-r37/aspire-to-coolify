/**
 * Deployer - Deploys Aspire resources to Coolify via API
 */

import type { AspireApp, Database, Service, StorageService, Application } from '../models/aspire.js';
import {
  CoolifyApiClient,
  type PostgresDatabasePayload,
  type MysqlDatabasePayload,
  type MongoDbDatabasePayload,
  type RedisDatabasePayload,
  type DockerImageApplicationPayload,
  type ServicePayload,
} from './coolify.js';

export interface DeployConfig {
  projectUuid: string;
  serverUuid: string;
  environmentName: string;
  instantDeploy?: boolean;
}

export interface DeployResult {
  success: boolean;
  resourceType: 'database' | 'service' | 'application';
  name: string;
  uuid?: string;
  error?: string;
}

export interface DeploymentSummary {
  results: DeployResult[];
  successful: number;
  failed: number;
}

/**
 * Deploy an Aspire application model to Coolify
 */
export async function deployToCloudify(
  client: CoolifyApiClient,
  app: AspireApp,
  config: DeployConfig,
  options: {
    dryRun?: boolean;
    onProgress?: (message: string) => void;
  } = {}
): Promise<DeploymentSummary> {
  const results: DeployResult[] = [];
  const log = options.onProgress || console.log;

  // Deploy databases first
  for (const db of app.databases) {
    if (options.dryRun) {
      log(`[DRY RUN] Would create database: ${db.name} (${db.type})`);
      results.push({
        success: true,
        resourceType: 'database',
        name: db.name,
        uuid: 'dry-run-uuid',
      });
      continue;
    }

    log(`Creating database: ${db.name} (${db.type})...`);
    const result = await deployDatabase(client, db, config);
    results.push(result);

    if (result.success) {
      log(`  ✓ Created database ${db.name} (uuid: ${result.uuid})`);
    } else {
      log(`  ✗ Failed to create database ${db.name}: ${result.error}`);
    }
  }

  // Deploy storage services
  for (const storage of app.storage) {
    if (options.dryRun) {
      log(`[DRY RUN] Would create storage service: ${storage.name} (${storage.type})`);
      results.push({
        success: true,
        resourceType: 'service',
        name: storage.name,
        uuid: 'dry-run-uuid',
      });
      continue;
    }

    log(`Creating storage service: ${storage.name} (${storage.type})...`);
    const result = await deployService(client, storage, config);
    results.push(result);

    if (result.success) {
      log(`  ✓ Created storage service ${storage.name} (uuid: ${result.uuid})`);
    } else {
      log(`  ✗ Failed to create storage service ${storage.name}: ${result.error}`);
    }
  }

  // Deploy other services
  for (const service of app.services) {
    if (options.dryRun) {
      log(`[DRY RUN] Would create service: ${service.name} (${service.type})`);
      results.push({
        success: true,
        resourceType: 'service',
        name: service.name,
        uuid: 'dry-run-uuid',
      });
      continue;
    }

    log(`Creating service: ${service.name} (${service.type})...`);
    const result = await deployService(client, service, config);
    results.push(result);

    if (result.success) {
      log(`  ✓ Created service ${service.name} (uuid: ${result.uuid})`);
    } else {
      log(`  ✗ Failed to create service ${service.name}: ${result.error}`);
    }
  }

  // Deploy applications last
  for (const application of app.applications) {
    if (options.dryRun) {
      log(`[DRY RUN] Would create application: ${application.name}`);
      results.push({
        success: true,
        resourceType: 'application',
        name: application.name,
        uuid: 'dry-run-uuid',
      });
      continue;
    }

    log(`Creating application: ${application.name}...`);
    const result = await deployApplication(client, application, config);
    results.push(result);

    if (result.success) {
      log(`  ✓ Created application ${application.name} (uuid: ${result.uuid})`);
    } else {
      log(`  ✗ Failed to create application ${application.name}: ${result.error}`);
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return { results, successful, failed };
}

/**
 * Deploy a database to Coolify
 */
async function deployDatabase(
  client: CoolifyApiClient,
  db: Database,
  config: DeployConfig
): Promise<DeployResult> {
  const basePayload = {
    server_uuid: config.serverUuid,
    project_uuid: config.projectUuid,
    environment_name: config.environmentName,
    name: db.name,
    instant_deploy: config.instantDeploy ?? true,
    is_public: db.hostPort ? true : undefined,
    public_port: db.hostPort,
  };

  try {
    let response;

    switch (db.type) {
      case 'postgres': {
        const payload: PostgresDatabasePayload = {
          ...basePayload,
          image: db.image ? `${db.image}${db.imageTag ? `:${db.imageTag}` : ''}` : undefined,
        };
        response = await client.createPostgresDatabase(payload);
        break;
      }

      case 'mysql': {
        const payload: MysqlDatabasePayload = {
          ...basePayload,
          image: db.image ? `${db.image}${db.imageTag ? `:${db.imageTag}` : ''}` : undefined,
        };
        response = await client.createMysqlDatabase(payload);
        break;
      }

      case 'mongodb': {
        const payload: MongoDbDatabasePayload = {
          ...basePayload,
          image: db.image ? `${db.image}${db.imageTag ? `:${db.imageTag}` : ''}` : undefined,
        };
        response = await client.createMongoDatabase(payload);
        break;
      }

      case 'redis': {
        const payload: RedisDatabasePayload = {
          ...basePayload,
          image: db.image ? `${db.image}${db.imageTag ? `:${db.imageTag}` : ''}` : undefined,
        };
        response = await client.createRedisDatabase(payload);
        break;
      }

      case 'sqlserver': {
        // SQL Server not natively supported, try PostgreSQL as fallback
        console.warn(`  Warning: SQL Server not supported, using PostgreSQL as fallback`);
        const payload: PostgresDatabasePayload = {
          ...basePayload,
          name: db.name,
        };
        response = await client.createPostgresDatabase(payload);
        break;
      }

      default:
        return {
          success: false,
          resourceType: 'database',
          name: db.name,
          error: `Unsupported database type: ${db.type}`,
        };
    }

    if (response.success && response.data) {
      return {
        success: true,
        resourceType: 'database',
        name: db.name,
        uuid: response.data.uuid,
      };
    }

    return {
      success: false,
      resourceType: 'database',
      name: db.name,
      error: response.error || 'Unknown error',
    };
  } catch (err) {
    return {
      success: false,
      resourceType: 'database',
      name: db.name,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Deploy a service to Coolify
 */
async function deployService(
  client: CoolifyApiClient,
  service: Service | StorageService,
  config: DeployConfig
): Promise<DeployResult> {
  // Map Aspire service types to Coolify service types
  const serviceTypeMap: Record<string, string> = {
    rabbitmq: 'rabbitmq',
    minio: 'minio',
    azurite: 'minio', // Use MinIO as Azure Storage fallback
    keycloak: 'keycloak',
    seq: 'seq',
    maildev: 'mailpit',
    mailpit: 'mailpit',
    kafka: 'kafka',
    elasticsearch: 'elasticsearch',
  };

  const coolifyType = serviceTypeMap[service.type] || service.type;

  const payload: ServicePayload = {
    server_uuid: config.serverUuid,
    project_uuid: config.projectUuid,
    environment_name: config.environmentName,
    type: coolifyType,
    name: service.name,
    instant_deploy: config.instantDeploy ?? true,
  };

  try {
    const response = await client.createService(payload);

    if (response.success && response.data) {
      return {
        success: true,
        resourceType: 'service',
        name: service.name,
        uuid: response.data.uuid,
      };
    }

    return {
      success: false,
      resourceType: 'service',
      name: service.name,
      error: response.error || 'Unknown error',
    };
  } catch (err) {
    return {
      success: false,
      resourceType: 'service',
      name: service.name,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Deploy an application to Coolify
 */
async function deployApplication(
  client: CoolifyApiClient,
  application: Application,
  config: DeployConfig
): Promise<DeployResult> {
  // Determine ports to expose
  const ports = application.endpoints
    .map((e) => e.targetPort || e.port)
    .filter((p): p is number => p !== undefined);
  const portsExposes = ports.length > 0 ? ports.join(',') : '80';

  // For Aspire apps, we create a placeholder Docker image application
  // The user will need to configure the actual image or git source in Coolify
  const imageName = application.project || application.name;

  const payload: DockerImageApplicationPayload = {
    server_uuid: config.serverUuid,
    project_uuid: config.projectUuid,
    environment_name: config.environmentName,
    docker_registry_image_name: imageName,
    docker_registry_image_tag: 'latest',
    name: application.name,
    ports_exposes: portsExposes,
    instant_deploy: config.instantDeploy ?? false, // Don't auto-deploy apps, user may want to configure first
  };

  try {
    const response = await client.createDockerImageApplication(payload);

    if (response.success && response.data) {
      return {
        success: true,
        resourceType: 'application',
        name: application.name,
        uuid: response.data.uuid,
      };
    }

    return {
      success: false,
      resourceType: 'application',
      name: application.name,
      error: response.error || 'Unknown error',
    };
  } catch (err) {
    return {
      success: false,
      resourceType: 'application',
      name: application.name,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
