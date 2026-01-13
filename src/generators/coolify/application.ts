/**
 * Application command generator for Coolify
 */

import type { Application, AspireApp } from '../../models/aspire.js';
import type { CoolifyApplicationCommand, CoolifyBuildPack } from '../../models/coolify.js';

const ASPIRE_TO_COOLIFY_BUILDPACK: Record<string, CoolifyBuildPack> = {
  nixpacks: 'nixpacks',
  dockerfile: 'dockerfile',
  static: 'static',
  node: 'nixpacks',
};

export function generateApplicationCommand(
  app: Application,
  aspireApp: AspireApp
): CoolifyApplicationCommand {
  const buildPack = ASPIRE_TO_COOLIFY_BUILDPACK[app.buildPack] || 'nixpacks';

  const args: string[] = [`--name "${app.name}"`, `--build-pack ${buildPack}`];

  // Add source path if available
  if (app.sourcePath) {
    args.push(`--source "${app.sourcePath}"`);
  }

  // Build environment variables map
  const envVars: Record<string, string> = {};

  // Add explicit environment variables
  for (const env of app.environment) {
    if (!env.isExpression) {
      envVars[env.key] = env.value;
      args.push(`--env "${env.key}=${env.value}"`);
    }
  }

  // Add reference-based environment variables
  const references = aspireApp.references.filter((ref) => ref.from === app.name);
  for (const ref of references) {
    const envName = ref.connectionStringEnv || 'CONNECTION_STRING';
    const envValue = `\${${ref.to}.connectionString}`;
    envVars[envName] = envValue;
    args.push(`--env "${envName}=${envValue}"`);
  }

  // Add port configuration from endpoints
  const ports: number[] = [];
  for (const endpoint of app.endpoints) {
    if (endpoint.port) {
      ports.push(endpoint.port);
    }
    if (endpoint.envVariable) {
      // The endpoint exposes a port via environment variable
      envVars[endpoint.envVariable] = endpoint.port?.toString() || '3000';
      args.push(`--env "${endpoint.envVariable}=${endpoint.port || 3000}"`);
    }
  }

  // Add external endpoint configuration
  const hasExternalEndpoint = app.endpoints.some((e) => e.isExternal);
  if (hasExternalEndpoint) {
    args.push('--expose');
  }

  return {
    command: 'application:create',
    name: app.name,
    buildPack,
    source: app.sourcePath,
    envVars,
    ports: ports.length > 0 ? ports : undefined,
    args,
    comment: `Application: ${app.name} (${app.type})`,
  };
}
