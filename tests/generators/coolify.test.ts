import { describe, it, expect } from 'vitest';
import { generate } from '../../src/generators/coolify/index.js';
import { generateDatabaseCommand } from '../../src/generators/coolify/database.js';
import { generateServiceCommand } from '../../src/generators/coolify/service.js';
import { generateApplicationCommand } from '../../src/generators/coolify/application.js';
import type { AspireApp, Database, Service, Application } from '../../src/models/aspire.js';
import { createEmptyAspireApp } from '../../src/models/aspire.js';

describe('Database Generator', () => {
  it('should generate postgres database API command', () => {
    const db: Database = {
      name: 'mydb',
      type: 'postgres',
      variableName: 'db',
      hasDataVolume: true,
      hostPort: 5432,
      environment: [],
    };

    const cmd = generateDatabaseCommand(db);

    expect(cmd.endpoint).toBe('/databases/postgresql');
    expect(cmd.method).toBe('POST');
    expect(cmd.databaseType).toBe('postgresql');
    expect(cmd.name).toBe('mydb');
    expect(cmd.payload.name).toBe('mydb');
    expect(cmd.payload.is_public).toBe(true);
    expect(cmd.payload.public_port).toBe(5432);
  });

  it('should include custom image in payload', () => {
    const db: Database = {
      name: 'vectordb',
      type: 'postgres',
      image: 'pgvector/pgvector',
      imageTag: 'pg17',
      hasDataVolume: false,
      environment: [],
    };

    const cmd = generateDatabaseCommand(db);

    expect(cmd.payload.image).toBe('pgvector/pgvector:pg17');
  });

  it('should use server/project UUIDs from options', () => {
    const db: Database = {
      name: 'mydb',
      type: 'postgres',
      hasDataVolume: false,
      environment: [],
    };

    const cmd = generateDatabaseCommand(db, {
      serverUuid: 'server-123',
      projectUuid: 'project-456',
      environmentName: 'production',
    });

    expect(cmd.payload.server_uuid).toBe('server-123');
    expect(cmd.payload.project_uuid).toBe('project-456');
    expect(cmd.payload.environment_name).toBe('production');
  });
});

describe('Service Generator', () => {
  it('should generate rabbitmq service API command', () => {
    const service: Service = {
      name: 'messaging',
      type: 'rabbitmq',
      hostPort: 5672,
      environment: [],
      volumes: [],
      endpoints: [],
      references: [],
    };

    const cmd = generateServiceCommand(service);

    expect(cmd.endpoint).toBe('/services');
    expect(cmd.method).toBe('POST');
    expect(cmd.serviceType).toBe('rabbitmq');
    expect(cmd.payload.name).toBe('messaging');
    expect(cmd.payload.type).toBe('rabbitmq');
  });

  it('should map maildev to mailpit', () => {
    const service: Service = {
      name: 'mail',
      type: 'maildev',
      environment: [],
      volumes: [],
      endpoints: [],
      references: [],
    };

    const cmd = generateServiceCommand(service);

    expect(cmd.serviceType).toBe('mailpit');
    expect(cmd.payload.type).toBe('mailpit');
  });
});

describe('Application Generator', () => {
  it('should generate docker image app API command', () => {
    const app: Application = {
      name: 'webapp',
      type: 'npm',
      sourcePath: '../WebApp',
      buildPack: 'nixpacks',
      environment: [{ key: 'NODE_ENV', value: 'production' }],
      endpoints: [],
      references: [],
    };

    const aspireApp = createEmptyAspireApp();
    const cmd = generateApplicationCommand(app, aspireApp);

    expect(cmd.endpoint).toBe('/applications/dockerimage');
    expect(cmd.method).toBe('POST');
    expect(cmd.buildPack).toBe('nixpacks');
    expect(cmd.payload.name).toBe('webapp');
    expect(cmd.payload.docker_registry_image_name).toBe('webapp');
  });

  it('should include ports from endpoints', () => {
    const app: Application = {
      name: 'api',
      type: 'project',
      buildPack: 'dockerfile',
      publishMode: 'dockerfile',
      environment: [],
      endpoints: [
        { port: 8080, protocol: 'http', isExternal: true },
        { port: 8081, protocol: 'http', isExternal: false },
      ],
      references: [],
    };

    const aspireApp = createEmptyAspireApp();
    const cmd = generateApplicationCommand(app, aspireApp);

    expect(cmd.payload.ports_exposes).toBe('8080,8081');
  });

  it('should use project name for image if available', () => {
    const app: Application = {
      name: 'webapp',
      type: 'project',
      project: 'MyProject.Web',
      buildPack: 'nixpacks',
      environment: [],
      endpoints: [],
      references: [],
    };

    const aspireApp = createEmptyAspireApp();
    const cmd = generateApplicationCommand(app, aspireApp);

    expect(cmd.payload.docker_registry_image_name).toBe('MyProject.Web');
  });
});

describe('Full Generator', () => {
  it('should generate commands in correct order', () => {
    const app: AspireApp = {
      databases: [
        {
          name: 'postgres',
          type: 'postgres',
          variableName: 'db',
          hasDataVolume: true,
          environment: [],
        },
      ],
      services: [
        {
          name: 'rabbitmq',
          type: 'rabbitmq',
          environment: [],
          volumes: [],
          endpoints: [],
          references: [],
        },
      ],
      storage: [
        {
          name: 'minio',
          type: 'minio',
          environment: [],
          volumes: [],
        },
      ],
      applications: [
        {
          name: 'webapp',
          type: 'npm',
          buildPack: 'nixpacks',
          environment: [],
          endpoints: [],
          references: ['db'],
        },
      ],
      references: [
        {
          from: 'webapp',
          to: 'postgres',
          connectionStringEnv: 'DATABASE_URL',
        },
      ],
    };

    const result = generate(app, { includeComments: true });

    expect(result.errors).toHaveLength(0);
    expect(result.commands).toHaveLength(4);

    // Databases should come first
    expect(result.commands[0].endpoint).toBe('/databases/postgresql');
    // Storage second
    expect(result.commands[1].endpoint).toBe('/services');
    // Services third
    expect(result.commands[2].endpoint).toBe('/services');
    // Applications last
    expect(result.commands[3].endpoint).toBe('/applications/dockerimage');
  });

  it('should generate valid shell script with curl commands', () => {
    const app: AspireApp = {
      databases: [
        {
          name: 'db',
          type: 'postgres',
          hasDataVolume: false,
          environment: [],
        },
      ],
      services: [],
      storage: [],
      applications: [],
      references: [],
    };

    // Pass projectId to avoid shell variable expansion mode
    const result = generate(app, { projectId: 'test-project' });

    expect(result.script).toContain('#!/bin/bash');
    expect(result.script).toContain('curl -X POST');
    expect(result.script).toContain('/api/v1/databases/postgresql');
    expect(result.script).toContain('"name": "db"');
    expect(result.script).toContain('COOLIFY_API_URL');
    expect(result.script).toContain('COOLIFY_TOKEN');
  });

  it('should include UUIDs in payload when provided', () => {
    const app: AspireApp = {
      databases: [
        {
          name: 'db',
          type: 'postgres',
          hasDataVolume: false,
          environment: [],
        },
      ],
      services: [],
      storage: [],
      applications: [],
      references: [],
    };

    const result = generate(app, {
      projectId: 'proj-123',
      serverId: 'srv-456',
      environmentName: 'production',
    });

    expect(result.commands[0].payload.project_uuid).toBe('proj-123');
    expect(result.commands[0].payload.server_uuid).toBe('srv-456');
    expect(result.commands[0].payload.environment_name).toBe('production');
  });

  it('should generate project creation command when projectName is provided without projectId', () => {
    const app: AspireApp = {
      databases: [
        {
          name: 'db',
          type: 'postgres',
          hasDataVolume: false,
          environment: [],
        },
      ],
      services: [],
      storage: [],
      applications: [],
      references: [],
    };

    const result = generate(app, {
      projectName: 'MyProject',
      serverId: 'srv-456',
    });

    // First command should be project creation
    expect(result.commands[0].endpoint).toBe('/projects');
    expect(result.commands[0].payload.name).toBe('MyProject');

    // Second command should use $PROJECT_UUID
    expect(result.commands[1].endpoint).toBe('/databases/postgresql');
    expect(result.commands[1].payload.project_uuid).toBe('$PROJECT_UUID');

    // Script should contain project creation
    expect(result.script).toContain('Creating project: MyProject');
    expect(result.script).toContain('PROJECT_UUID=$(');
  });
});
