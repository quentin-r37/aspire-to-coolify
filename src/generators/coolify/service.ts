/**
 * Service command generator for Coolify API
 */

import type { Service, StorageService } from '../../models/aspire.js';
import type { CoolifyServiceCommand, CoolifyServiceType } from '../../models/coolify.js';

const ASPIRE_TO_COOLIFY_SERVICE: Record<string, CoolifyServiceType> = {
  minio: 'minio',
  rabbitmq: 'rabbitmq',
  keycloak: 'keycloak',
  seq: 'seq',
  maildev: 'mailpit', // Coolify uses mailpit instead of maildev
  kafka: 'kafka',
  elasticsearch: 'elasticsearch',
  custom: 'custom',
};

export interface ServiceGeneratorOptions {
  serverUuid?: string;
  projectUuid?: string;
  environmentName?: string;
  instantDeploy?: boolean;
}

export function generateServiceCommand(
  service: Service,
  options: ServiceGeneratorOptions = {}
): CoolifyServiceCommand {
  const coolifyType = ASPIRE_TO_COOLIFY_SERVICE[service.type] || 'custom';

  // Build the API payload
  const payload: Record<string, unknown> = {
    server_uuid: options.serverUuid || '${SERVER_UUID}',
    project_uuid: options.projectUuid || '${PROJECT_UUID}',
    environment_name: options.environmentName || '${ENVIRONMENT_NAME}',
    type: coolifyType,
    name: service.name,
    instant_deploy: options.instantDeploy ?? true,
  };

  return {
    endpoint: '/services',
    method: 'POST',
    payload,
    name: service.name,
    resourceType: 'service',
    serviceType: coolifyType,
    comment: `Service: ${service.name} (${service.type})`,
  };
}

export function generateStorageCommand(
  storage: StorageService,
  options: ServiceGeneratorOptions = {}
): CoolifyServiceCommand {
  // Map storage types to Coolify service types
  const storageTypeMap: Record<string, CoolifyServiceType> = {
    minio: 'minio',
    azurite: 'minio', // Use MinIO as Azure Storage emulator fallback
    blob: 'minio',
  };

  const coolifyType = storageTypeMap[storage.type] || 'minio';

  // Build the API payload
  const payload: Record<string, unknown> = {
    server_uuid: options.serverUuid || '${SERVER_UUID}',
    project_uuid: options.projectUuid || '${PROJECT_UUID}',
    environment_name: options.environmentName || '${ENVIRONMENT_NAME}',
    type: coolifyType,
    name: storage.name,
    instant_deploy: options.instantDeploy ?? true,
  };

  return {
    endpoint: '/services',
    method: 'POST',
    payload,
    name: storage.name,
    resourceType: 'service',
    serviceType: coolifyType,
    comment: `Storage: ${storage.name} (${storage.type})`,
  };
}
