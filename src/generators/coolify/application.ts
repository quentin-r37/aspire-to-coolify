/**
 * Application command generator for Coolify API
 */

import type { Application, AspireApp } from '../../models/aspire.js';
import type { CoolifyApplicationCommand, CoolifyBuildPack } from '../../models/coolify.js';

const ASPIRE_TO_COOLIFY_BUILDPACK: Record<string, CoolifyBuildPack> = {
  nixpacks: 'nixpacks',
  dockerfile: 'dockerfile',
  static: 'static',
  node: 'nixpacks',
};

export interface ApplicationGeneratorOptions {
  serverUuid?: string;
  projectUuid?: string;
  environmentName?: string;
  instantDeploy?: boolean;
}

export function generateApplicationCommand(
  app: Application,
  aspireApp: AspireApp,
  options: ApplicationGeneratorOptions = {}
): CoolifyApplicationCommand {
  const buildPack = ASPIRE_TO_COOLIFY_BUILDPACK[app.buildPack] || 'nixpacks';

  // Determine ports to expose
  const ports: number[] = [];
  for (const endpoint of app.endpoints) {
    const port = endpoint.targetPort || endpoint.port;
    if (port) {
      ports.push(port);
    }
  }
  const portsExposes = ports.length > 0 ? ports.join(',') : '80';

  // Use docker image endpoint for now (most common case)
  // The user will need to configure the actual image or git source in Coolify
  const imageName = app.project || app.name;

  // Build the API payload
  const payload: Record<string, unknown> = {
    server_uuid: options.serverUuid || '${SERVER_UUID}',
    project_uuid: options.projectUuid || '${PROJECT_UUID}',
    environment_name: options.environmentName || '${ENVIRONMENT_NAME}',
    docker_registry_image_name: imageName,
    docker_registry_image_tag: 'latest',
    name: app.name,
    ports_exposes: portsExposes,
    instant_deploy: options.instantDeploy ?? false, // Don't auto-deploy, user may need to configure
  };

  // For now, use dockerimage endpoint as placeholder
  // TODO: Support dockerfile endpoint when dockerfile content is available

  return {
    endpoint: '/applications/dockerimage',
    method: 'POST',
    payload,
    name: app.name,
    resourceType: 'application',
    buildPack,
    comment: `Application: ${app.name} (${app.type})`,
  };
}
