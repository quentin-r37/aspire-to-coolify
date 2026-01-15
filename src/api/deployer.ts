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
  type PublicRepositoryApplicationPayload,
  type PrivateGithubAppApplicationPayload,
  type ServicePayload,
  type CoolifyDatabase,
  type CoolifyApplication,
  type CoolifyService,
} from './coolify.js';

export interface GitHubConfig {
  repository: string;
  branch?: string;
  basePath?: string;
  appUuid?: string; // GitHub App UUID for private repositories
}

export interface DeployConfig {
  projectUuid: string;
  serverUuid: string;
  environmentName: string;
  instantDeploy?: boolean;
  github?: GitHubConfig;
  buildPack?: 'nixpacks' | 'dockerfile' | 'static' | 'dockercompose';
  skipExisting?: boolean;
}

export interface DeployResult {
  success: boolean;
  resourceType: 'database' | 'service' | 'application';
  name: string;
  uuid?: string;
  error?: string;
  skipped?: boolean;
}

export interface DeploymentSummary {
  results: DeployResult[];
  successful: number;
  failed: number;
  skipped: number;
}

/**
 * Existing resources cache for skip-existing checks
 */
interface ExistingResources {
  databases: Map<string, string>; // name -> uuid
  applications: Map<string, string>;
  services: Map<string, string>;
}

/**
 * Fetch existing resources from Coolify API
 */
async function fetchExistingResources(
  client: CoolifyApiClient,
  log: (message: string) => void
): Promise<ExistingResources> {
  const existing: ExistingResources = {
    databases: new Map(),
    applications: new Map(),
    services: new Map(),
  };

  log('Fetching existing resources...');

  // Fetch databases
  const dbResponse = await client.listDatabases();
  if (dbResponse.success && dbResponse.data) {
    for (const db of dbResponse.data) {
      existing.databases.set(db.name, db.uuid);
    }
  }

  // Fetch applications
  const appResponse = await client.listApplications();
  if (appResponse.success && appResponse.data) {
    for (const app of appResponse.data) {
      existing.applications.set(app.name, app.uuid);
    }
  }

  // Fetch services
  const svcResponse = await client.listServices();
  if (svcResponse.success && svcResponse.data) {
    for (const svc of svcResponse.data) {
      existing.services.set(svc.name, svc.uuid);
    }
  }

  log(`  Found ${existing.databases.size} databases, ${existing.applications.size} applications, ${existing.services.size} services`);

  return existing;
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

  // Always fetch existing resources to detect duplicates (unless dry-run)
  let existing: ExistingResources | null = null;
  if (!options.dryRun) {
    existing = await fetchExistingResources(client, log);
  }

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

    // Check if database already exists
    const existingUuid = existing?.databases.get(db.name);
    if (existingUuid) {
      if (config.skipExisting) {
        log(`  ⊘ Skipped database "${db.name}" (already exists)`);
        results.push({
          success: true,
          resourceType: 'database',
          name: db.name,
          uuid: existingUuid,
          skipped: true,
        });
        continue;
      } else {
        log(`  ✗ Database "${db.name}" already exists (use --skip-existing to skip)`);
        results.push({
          success: false,
          resourceType: 'database',
          name: db.name,
          error: `Database "${db.name}" already exists`,
        });
        continue;
      }
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

    // Check if storage service already exists
    const existingUuid = existing?.services.get(storage.name);
    if (existingUuid) {
      if (config.skipExisting) {
        log(`  ⊘ Skipped storage service "${storage.name}" (already exists)`);
        results.push({
          success: true,
          resourceType: 'service',
          name: storage.name,
          uuid: existingUuid,
          skipped: true,
        });
        continue;
      } else {
        log(`  ✗ Storage service "${storage.name}" already exists (use --skip-existing to skip)`);
        results.push({
          success: false,
          resourceType: 'service',
          name: storage.name,
          error: `Storage service "${storage.name}" already exists`,
        });
        continue;
      }
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

    // Check if service already exists
    const existingUuid = existing?.services.get(service.name);
    if (existingUuid) {
      if (config.skipExisting) {
        log(`  ⊘ Skipped service "${service.name}" (already exists)`);
        results.push({
          success: true,
          resourceType: 'service',
          name: service.name,
          uuid: existingUuid,
          skipped: true,
        });
        continue;
      } else {
        log(`  ✗ Service "${service.name}" already exists (use --skip-existing to skip)`);
        results.push({
          success: false,
          resourceType: 'service',
          name: service.name,
          error: `Service "${service.name}" already exists`,
        });
        continue;
      }
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

    // Check if application already exists
    const existingUuid = existing?.applications.get(application.name);
    if (existingUuid) {
      if (config.skipExisting) {
        log(`  ⊘ Skipped application "${application.name}" (already exists)`);
        results.push({
          success: true,
          resourceType: 'application',
          name: application.name,
          uuid: existingUuid,
          skipped: true,
        });
        continue;
      } else {
        log(`  ✗ Application "${application.name}" already exists (use --skip-existing to skip)`);
        results.push({
          success: false,
          resourceType: 'application',
          name: application.name,
          error: `Application "${application.name}" already exists`,
        });
        continue;
      }
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

  const successful = results.filter((r) => r.success && !r.skipped).length;
  const failed = results.filter((r) => !r.success).length;
  const skipped = results.filter((r) => r.skipped).length;

  return { results, successful, failed, skipped };
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
  // Coolify uses full service template names (e.g., 'minio-community-edition')
  const serviceTypeMap: Record<string, string> = {
    rabbitmq: 'rabbitmq',
    minio: 'minio-community-edition',
    azurite: 'minio-community-edition', // Use MinIO as Azure Storage fallback
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

  try {
    let response;

    // If GitHub config is provided, create a GitHub-based application
    if (config.github?.repository) {
      // Calculate base directory: combine github basePath with application sourcePath
      let baseDirectory = config.github.basePath || '';
      if (application.sourcePath) {
        // Clean the source path (remove leading ./ or ../)
        const cleanSourcePath = application.sourcePath.replace(/^\.\.?\//, '');
        baseDirectory = baseDirectory
          ? `${baseDirectory}/${cleanSourcePath}`
          : cleanSourcePath;
      }

      // Map application buildPack to Coolify-compatible build_pack
      const mapBuildPack = (bp?: string): 'nixpacks' | 'dockerfile' | 'static' | 'dockercompose' => {
        if (bp === 'dockerfile') return 'dockerfile';
        if (bp === 'static') return 'static';
        if (bp === 'dockercompose') return 'dockercompose';
        return 'nixpacks'; // Default for 'nixpacks', 'node', and others
      };

      const buildPack = config.buildPack || mapBuildPack(application.buildPack);

      // Use private GitHub App if appUuid is provided, otherwise use public repository
      if (config.github.appUuid) {
        const payload: PrivateGithubAppApplicationPayload = {
          server_uuid: config.serverUuid,
          project_uuid: config.projectUuid,
          environment_name: config.environmentName,
          github_app_uuid: config.github.appUuid,
          git_repository: config.github.repository,
          git_branch: config.github.branch || 'main',
          build_pack: buildPack,
          name: application.name,
          ports_exposes: portsExposes,
          base_directory: baseDirectory || undefined,
          instant_deploy: config.instantDeploy ?? false,
        };

        response = await client.createPrivateGithubAppApplication(payload);
      } else {
        const payload: PublicRepositoryApplicationPayload = {
          server_uuid: config.serverUuid,
          project_uuid: config.projectUuid,
          environment_name: config.environmentName,
          git_repository: config.github.repository,
          git_branch: config.github.branch || 'main',
          build_pack: buildPack,
          name: application.name,
          ports_exposes: portsExposes,
          base_directory: baseDirectory || undefined,
          instant_deploy: config.instantDeploy ?? false,
        };

        response = await client.createPublicApplication(payload);
      }
    } else {
      // Fallback to Docker image placeholder
      const imageName = application.project || application.name;

      const payload: DockerImageApplicationPayload = {
        server_uuid: config.serverUuid,
        project_uuid: config.projectUuid,
        environment_name: config.environmentName,
        docker_registry_image_name: imageName,
        docker_registry_image_tag: 'latest',
        name: application.name,
        ports_exposes: portsExposes,
        instant_deploy: config.instantDeploy ?? false,
      };

      response = await client.createDockerImageApplication(payload);
    }

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
