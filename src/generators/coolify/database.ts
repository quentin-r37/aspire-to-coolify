/**
 * Database command generator for Coolify API
 */

import type { Database } from '../../models/aspire.js';
import type { CoolifyDatabaseCommand, CoolifyDatabaseType } from '../../models/coolify.js';

const ASPIRE_TO_COOLIFY_DB: Record<string, CoolifyDatabaseType> = {
  postgres: 'postgresql',
  sqlserver: 'postgresql', // Coolify doesn't have native SQL Server, use PostgreSQL as fallback
  mysql: 'mysql',
  mongodb: 'mongodb',
  redis: 'redis',
};

export interface DatabaseGeneratorOptions {
  serverUuid?: string;
  projectUuid?: string;
  environmentName?: string;
  instantDeploy?: boolean;
}

export function generateDatabaseCommand(
  db: Database,
  options: DatabaseGeneratorOptions = {}
): CoolifyDatabaseCommand {
  const coolifyType = ASPIRE_TO_COOLIFY_DB[db.type] || 'postgresql';

  // Build the API payload
  const payload: Record<string, unknown> = {
    server_uuid: options.serverUuid || '${SERVER_UUID}',
    project_uuid: options.projectUuid || '${PROJECT_UUID}',
    environment_name: options.environmentName || '${ENVIRONMENT_NAME}',
    name: db.name,
    instant_deploy: options.instantDeploy ?? true,
  };

  // Add custom image if specified
  if (db.image) {
    payload.image = db.imageTag ? `${db.image}:${db.imageTag}` : db.image;
  }

  // Add public port if specified
  if (db.hostPort) {
    payload.is_public = true;
    payload.public_port = db.hostPort;
  }

  return {
    endpoint: `/databases/${coolifyType}`,
    method: 'POST',
    payload,
    name: db.name,
    resourceType: 'database',
    databaseType: coolifyType,
    comment: `Database: ${db.name} (${db.type})`,
  };
}

/**
 * Generate connection string placeholder for a database
 */
export function getDatabaseConnectionString(db: Database): string {
  switch (db.type) {
    case 'postgres':
      return `\${${db.name}.connectionString}`;
    case 'mysql':
      return `\${${db.name}.connectionString}`;
    case 'mongodb':
      return `\${${db.name}.connectionString}`;
    case 'redis':
      return `\${${db.name}.connectionString}`;
    default:
      return `\${${db.name}.connectionString}`;
  }
}
