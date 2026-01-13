import { describe, it, expect } from 'vitest';
import { generate } from '../../src/generators/coolify/index.js';
import { generateDatabaseCommand } from '../../src/generators/coolify/database.js';
import { generateServiceCommand } from '../../src/generators/coolify/service.js';
import { generateApplicationCommand } from '../../src/generators/coolify/application.js';
import type { AspireApp, Database, Service, Application } from '../../src/models/aspire.js';
import { createEmptyAspireApp } from '../../src/models/aspire.js';

describe('Database Generator', () => {
  it('should generate postgres database command', () => {
    const db: Database = {
      name: 'mydb',
      type: 'postgres',
      variableName: 'db',
      hasDataVolume: true,
      hostPort: 5432,
      environment: [],
    };

    const cmd = generateDatabaseCommand(db);

    expect(cmd.command).toBe('database:create');
    expect(cmd.type).toBe('postgres');
    expect(cmd.name).toBe('mydb');
    expect(cmd.args).toContain('--name "mydb"');
    expect(cmd.args).toContain('--type postgres');
    expect(cmd.args).toContain('--public-port 5432');
  });

  it('should include custom image in command', () => {
    const db: Database = {
      name: 'vectordb',
      type: 'postgres',
      image: 'pgvector/pgvector',
      imageTag: 'pg17',
      hasDataVolume: false,
      environment: [],
    };

    const cmd = generateDatabaseCommand(db);

    expect(cmd.args).toContain('--image "pgvector/pgvector:pg17"');
    expect(cmd.image).toBe('pgvector/pgvector:pg17');
  });

  it('should include environment variables', () => {
    const db: Database = {
      name: 'mydb',
      type: 'postgres',
      hasDataVolume: false,
      environment: [{ key: 'POSTGRES_DB', value: 'appdb' }],
    };

    const cmd = generateDatabaseCommand(db);

    expect(cmd.args).toContain('--env "POSTGRES_DB=appdb"');
  });
});

describe('Service Generator', () => {
  it('should generate rabbitmq service command', () => {
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

    expect(cmd.command).toBe('service:create');
    expect(cmd.type).toBe('rabbitmq');
    expect(cmd.args).toContain('--name "messaging"');
    expect(cmd.args).toContain('--public-port 5672');
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

    expect(cmd.type).toBe('mailpit');
  });
});

describe('Application Generator', () => {
  it('should generate npm app with nixpacks', () => {
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

    expect(cmd.command).toBe('application:create');
    expect(cmd.buildPack).toBe('nixpacks');
    expect(cmd.args).toContain('--build-pack nixpacks');
    expect(cmd.args).toContain('--source "../WebApp"');
    expect(cmd.args).toContain('--env "NODE_ENV=production"');
  });

  it('should generate app with dockerfile buildpack', () => {
    const app: Application = {
      name: 'api',
      type: 'project',
      buildPack: 'dockerfile',
      publishMode: 'dockerfile',
      environment: [],
      endpoints: [],
      references: [],
    };

    const aspireApp = createEmptyAspireApp();
    const cmd = generateApplicationCommand(app, aspireApp);

    expect(cmd.buildPack).toBe('dockerfile');
    expect(cmd.args).toContain('--build-pack dockerfile');
  });

  it('should include database connection string from references', () => {
    const app: Application = {
      name: 'webapp',
      type: 'npm',
      buildPack: 'nixpacks',
      environment: [],
      endpoints: [],
      references: ['db'],
    };

    const aspireApp = createEmptyAspireApp();
    aspireApp.databases.push({
      name: 'mydb',
      type: 'postgres',
      variableName: 'db',
      hasDataVolume: false,
      environment: [],
    });
    aspireApp.references.push({
      from: 'webapp',
      to: 'mydb',
      connectionStringEnv: 'DATABASE_URL',
    });

    const cmd = generateApplicationCommand(app, aspireApp);

    expect(cmd.args).toContain('--env "DATABASE_URL=${mydb.connectionString}"');
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
    expect(result.commands[0].command).toBe('database:create');
    // Storage second
    expect(result.commands[1].command).toBe('service:create');
    // Services third
    expect(result.commands[2].command).toBe('service:create');
    // Applications last
    expect(result.commands[3].command).toBe('application:create');
  });

  it('should generate valid shell script', () => {
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

    const result = generate(app);

    expect(result.script).toContain('#!/bin/bash');
    expect(result.script).toContain('database:create');
    expect(result.script).toContain('--name "db"');
  });

  it('should add global options when provided', () => {
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
    });

    expect(result.commands[0].args).toContain('--project-id "proj-123"');
    expect(result.commands[0].args).toContain('--server-id "srv-456"');
  });
});
