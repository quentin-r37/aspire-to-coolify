import { describe, it, expect } from 'vitest';
import { isDatabaseChain, extractDatabase, extractChildDatabases } from '../../src/parser/extractors/database.js';
import { isApplicationChain, extractApplication } from '../../src/parser/extractors/application.js';
import { isContainerChain, extractContainer } from '../../src/parser/extractors/container.js';
import type { FluentChain, MethodCall } from '../../src/parser/tokenizer.js';

// Helper to create a FluentChain for testing
function createChain(
  rootMethod: string,
  name: string,
  options: {
    variableName?: string;
    baseObject?: string;
    rootArgs?: string[];
    chainedMethods?: MethodCall[];
    raw?: string;
  } = {}
): FluentChain {
  return {
    rootMethod,
    name,
    variableName: options.variableName,
    baseObject: options.baseObject || 'builder',
    rootArgs: options.rootArgs || [`"${name}"`],
    chainedMethods: options.chainedMethods || [],
    raw: options.raw || `var ${options.variableName || 'x'} = builder.${rootMethod}("${name}");`,
  };
}

// Helper to create a MethodCall
function createMethod(method: string, args: string[] = [], rawArgs?: string): MethodCall {
  return {
    method,
    args,
    rawArgs: rawArgs ?? args.join(', '),
  };
}

describe('Database Extractor', () => {
  describe('isDatabaseChain', () => {
    it('should recognize AddPostgres as database', () => {
      const chain = createChain('AddPostgres', 'mydb');
      expect(isDatabaseChain(chain)).toBe(true);
    });

    it('should recognize AddAzurePostgresFlexibleServer as database', () => {
      const chain = createChain('AddAzurePostgresFlexibleServer', 'mydb');
      expect(isDatabaseChain(chain)).toBe(true);
    });

    it('should recognize AddPostgresContainer as database', () => {
      const chain = createChain('AddPostgresContainer', 'mydb');
      expect(isDatabaseChain(chain)).toBe(true);
    });

    it('should recognize AddSqlServer as database', () => {
      const chain = createChain('AddSqlServer', 'sqldb');
      expect(isDatabaseChain(chain)).toBe(true);
    });

    it('should recognize AddAzureSqlServer as database', () => {
      const chain = createChain('AddAzureSqlServer', 'sqldb');
      expect(isDatabaseChain(chain)).toBe(true);
    });

    it('should recognize AddMySql as database', () => {
      const chain = createChain('AddMySql', 'mysqldb');
      expect(isDatabaseChain(chain)).toBe(true);
    });

    it('should recognize AddMySqlContainer as database', () => {
      const chain = createChain('AddMySqlContainer', 'mysqldb');
      expect(isDatabaseChain(chain)).toBe(true);
    });

    it('should recognize AddMongoDB as database', () => {
      const chain = createChain('AddMongoDB', 'mongodb');
      expect(isDatabaseChain(chain)).toBe(true);
    });

    it('should recognize AddMongoDBContainer as database', () => {
      const chain = createChain('AddMongoDBContainer', 'mongodb');
      expect(isDatabaseChain(chain)).toBe(true);
    });

    it('should recognize AddRedis as database', () => {
      const chain = createChain('AddRedis', 'redis');
      expect(isDatabaseChain(chain)).toBe(true);
    });

    it('should recognize AddRedisContainer as database', () => {
      const chain = createChain('AddRedisContainer', 'redis');
      expect(isDatabaseChain(chain)).toBe(true);
    });

    it('should not recognize AddNpmApp as database', () => {
      const chain = createChain('AddNpmApp', 'webapp');
      expect(isDatabaseChain(chain)).toBe(false);
    });

    it('should not recognize AddRabbitMQ as database', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq');
      expect(isDatabaseChain(chain)).toBe(false);
    });
  });

  describe('extractDatabase', () => {
    it('should extract basic postgres database', () => {
      const chain = createChain('AddPostgres', 'mydb', { variableName: 'db' });
      const result = extractDatabase(chain);

      expect(result.name).toBe('mydb');
      expect(result.type).toBe('postgres');
      expect(result.variableName).toBe('db');
      expect(result.hasDataVolume).toBe(false);
      expect(result.environment).toEqual([]);
    });

    it('should extract mysql database', () => {
      const chain = createChain('AddMySql', 'mysqldb');
      const result = extractDatabase(chain);

      expect(result.type).toBe('mysql');
    });

    it('should extract sqlserver database', () => {
      const chain = createChain('AddSqlServer', 'sqldb');
      const result = extractDatabase(chain);

      expect(result.type).toBe('sqlserver');
    });

    it('should extract mongodb database', () => {
      const chain = createChain('AddMongoDB', 'mongodb');
      const result = extractDatabase(chain);

      expect(result.type).toBe('mongodb');
    });

    it('should extract redis database', () => {
      const chain = createChain('AddRedis', 'redis');
      const result = extractDatabase(chain);

      expect(result.type).toBe('redis');
    });

    it('should extract WithImage', () => {
      const chain = createChain('AddPostgres', 'mydb', {
        chainedMethods: [createMethod('WithImage', [], '"pgvector/pgvector"')],
      });
      const result = extractDatabase(chain);

      expect(result.image).toBe('pgvector/pgvector');
    });

    it('should extract WithImageTag', () => {
      const chain = createChain('AddPostgres', 'mydb', {
        chainedMethods: [createMethod('WithImageTag', [], '"16-alpine"')],
      });
      const result = extractDatabase(chain);

      expect(result.imageTag).toBe('16-alpine');
    });

    it('should extract WithHostPort', () => {
      const chain = createChain('AddPostgres', 'mydb', {
        chainedMethods: [createMethod('WithHostPort', ['5432'], '5432')],
      });
      const result = extractDatabase(chain);

      expect(result.hostPort).toBe(5432);
    });

    it('should extract WithDataVolume', () => {
      const chain = createChain('AddPostgres', 'mydb', {
        chainedMethods: [createMethod('WithDataVolume', [], '')],
      });
      const result = extractDatabase(chain);

      expect(result.hasDataVolume).toBe(true);
    });

    it('should extract WithEnvironment', () => {
      const chain = createChain('AddPostgres', 'mydb', {
        chainedMethods: [createMethod('WithEnvironment', ['"POSTGRES_INITDB_ARGS"', '"--data-checksums"'], '"POSTGRES_INITDB_ARGS", "--data-checksums"')],
      });
      const result = extractDatabase(chain);

      expect(result.environment).toHaveLength(1);
      expect(result.environment[0].key).toBe('POSTGRES_INITDB_ARGS');
      expect(result.environment[0].value).toBe('--data-checksums');
    });

    it('should extract multiple chained methods', () => {
      const chain = createChain('AddPostgres', 'mydb', {
        variableName: 'postgres',
        chainedMethods: [
          createMethod('WithImage', [], '"custom/postgres"'),
          createMethod('WithImageTag', [], '"latest"'),
          createMethod('WithHostPort', ['5432'], '5432'),
          createMethod('WithDataVolume', [], ''),
        ],
      });
      const result = extractDatabase(chain);

      expect(result.name).toBe('mydb');
      expect(result.image).toBe('custom/postgres');
      expect(result.imageTag).toBe('latest');
      expect(result.hostPort).toBe(5432);
      expect(result.hasDataVolume).toBe(true);
    });

    it('should extract RunAsContainer with nested lambda methods', () => {
      const chain = createChain('AddPostgres', 'mydb', {
        chainedMethods: [
          createMethod(
            'RunAsContainer',
            ['a => a.WithImage("pgvector").WithImageTag("16").WithHostPort(5432)'],
            'a => a.WithImage("pgvector").WithImageTag("16").WithHostPort(5432)'
          ),
        ],
      });
      const result = extractDatabase(chain);

      expect(result.image).toBe('pgvector');
      expect(result.imageTag).toBe('16');
      expect(result.hostPort).toBe(5432);
    });

    it('should handle RunAsContainer with WithDataVolume', () => {
      const chain = createChain('AddPostgres', 'mydb', {
        chainedMethods: [
          createMethod(
            'RunAsContainer',
            ['c => c.WithDataVolume()'],
            'c => c.WithDataVolume()'
          ),
        ],
      });
      const result = extractDatabase(chain);

      expect(result.hasDataVolume).toBe(true);
    });
  });

  describe('extractChildDatabases', () => {
    it('should extract child database from AddDatabase call', () => {
      const serverChain = createChain('AddPostgres', 'postgres-server', {
        variableName: 'server',
      });
      const dbChain = createChain('AddDatabase', 'mydb', {
        variableName: 'db',
        baseObject: 'server',
      });

      const result = extractChildDatabases([serverChain, dbChain]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('mydb');
      expect(result[0].type).toBe('postgres');
      expect(result[0].serverName).toBe('postgres-server');
      expect(result[0].serverVariableName).toBe('server');
    });

    it('should extract multiple child databases', () => {
      const serverChain = createChain('AddMySql', 'mysql-server', {
        variableName: 'mysql',
      });
      const db1 = createChain('AddDatabase', 'users', {
        variableName: 'usersDb',
        baseObject: 'mysql',
      });
      const db2 = createChain('AddDatabase', 'orders', {
        variableName: 'ordersDb',
        baseObject: 'mysql',
      });

      const result = extractChildDatabases([serverChain, db1, db2]);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('users');
      expect(result[0].type).toBe('mysql');
      expect(result[1].name).toBe('orders');
      expect(result[1].type).toBe('mysql');
    });

    it('should handle child database without matching parent', () => {
      const dbChain = createChain('AddDatabase', 'orphan-db', {
        baseObject: 'unknownServer',
      });

      const result = extractChildDatabases([dbChain]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('orphan-db');
      expect(result[0].type).toBe('postgres'); // defaults to postgres
      expect(result[0].serverName).toBeUndefined();
    });

    it('should not extract non-AddDatabase chains', () => {
      const chains = [
        createChain('AddPostgres', 'postgres'),
        createChain('AddNpmApp', 'webapp'),
      ];

      const result = extractChildDatabases(chains);

      expect(result).toHaveLength(0);
    });
  });
});

describe('Application Extractor', () => {
  describe('isApplicationChain', () => {
    it('should recognize AddNpmApp as application', () => {
      const chain = createChain('AddNpmApp', 'webapp');
      expect(isApplicationChain(chain)).toBe(true);
    });

    it('should recognize AddNodeApp as application', () => {
      const chain = createChain('AddNodeApp', 'nodeapp');
      expect(isApplicationChain(chain)).toBe(true);
    });

    it('should recognize AddJavaScriptApp as application', () => {
      const chain = createChain('AddJavaScriptApp', 'jsapp');
      expect(isApplicationChain(chain)).toBe(true);
    });

    it('should recognize AddProject as application', () => {
      const chain = createChain('AddProject', 'api');
      expect(isApplicationChain(chain)).toBe(true);
    });

    it('should recognize AddDockerfile as application', () => {
      const chain = createChain('AddDockerfile', 'custom');
      expect(isApplicationChain(chain)).toBe(true);
    });

    it('should recognize AddContainer as application', () => {
      const chain = createChain('AddContainer', 'container');
      expect(isApplicationChain(chain)).toBe(true);
    });

    it('should recognize AddExecutable as application', () => {
      const chain = createChain('AddExecutable', 'exec');
      expect(isApplicationChain(chain)).toBe(true);
    });

    it('should not recognize AddPostgres as application', () => {
      const chain = createChain('AddPostgres', 'db');
      expect(isApplicationChain(chain)).toBe(false);
    });

    it('should not recognize AddRabbitMQ as application', () => {
      const chain = createChain('AddRabbitMQ', 'mq');
      expect(isApplicationChain(chain)).toBe(false);
    });
  });

  describe('extractApplication', () => {
    it('should extract basic npm app', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        variableName: 'app',
      });
      const result = extractApplication(chain);

      expect(result.name).toBe('webapp');
      expect(result.type).toBe('npm');
      expect(result.variableName).toBe('app');
      expect(result.buildPack).toBe('nixpacks');
      expect(result.environment).toEqual([]);
      expect(result.endpoints).toEqual([]);
      expect(result.references).toEqual([]);
    });

    it('should extract project with dockerfile buildpack', () => {
      const chain = createChain('AddProject', 'api');
      const result = extractApplication(chain);

      expect(result.type).toBe('project');
      expect(result.buildPack).toBe('dockerfile');
    });

    it('should extract source path from second argument', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        rootArgs: ['"webapp"', '"../WebApp"'],
      });
      const result = extractApplication(chain);

      expect(result.sourcePath).toBe('../WebApp');
    });

    it('should extract absolute source path', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        rootArgs: ['"webapp"', '"/app/frontend"'],
      });
      const result = extractApplication(chain);

      expect(result.sourcePath).toBe('/app/frontend');
    });

    it('should extract runScriptName from named args', () => {
      const chain = createChain('AddJavaScriptApp', 'angular', {
        rootArgs: ['"angular"', '"../Angular"', 'runScriptName: "start"'],
      });
      const result = extractApplication(chain);

      expect(result.runScript).toBe('start');
    });

    it('should extract project type from generic parameter', () => {
      const chain = createChain('AddProject', 'api', {
        raw: 'var api = builder.AddProject<Projects.Api>("api");',
      });
      const result = extractApplication(chain);

      expect(result.project).toBe('Projects.Api');
    });

    it('should extract WithEnvironment with string value', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [
          createMethod('WithEnvironment', ['"NODE_ENV"', '"production"'], '"NODE_ENV", "production"'),
        ],
      });
      const result = extractApplication(chain);

      expect(result.environment).toHaveLength(1);
      expect(result.environment[0].key).toBe('NODE_ENV');
      expect(result.environment[0].value).toBe('production');
      expect(result.environment[0].isExpression).toBe(false);
    });

    it('should extract WithEnvironment with expression value', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [
          createMethod('WithEnvironment', ['"DB_URL"', 'db.ConnectionString'], '"DB_URL", db.ConnectionString'),
        ],
      });
      const result = extractApplication(chain);

      expect(result.environment).toHaveLength(1);
      expect(result.environment[0].key).toBe('DB_URL');
      expect(result.environment[0].value).toBe('db.ConnectionString');
      expect(result.environment[0].isExpression).toBe(true);
    });

    it('should extract WithHttpEndpoint with port', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [createMethod('WithHttpEndpoint', ['3000'], '3000')],
      });
      const result = extractApplication(chain);

      expect(result.endpoints).toHaveLength(1);
      expect(result.endpoints[0].port).toBe(3000);
      expect(result.endpoints[0].protocol).toBe('http');
    });

    it('should extract WithHttpEndpoint with named args', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [
          createMethod(
            'WithHttpEndpoint',
            ['port: 8080', 'targetPort: 3000', 'name: "web"', 'env: "PORT"'],
            'port: 8080, targetPort: 3000, name: "web", env: "PORT"'
          ),
        ],
      });
      const result = extractApplication(chain);

      expect(result.endpoints).toHaveLength(1);
      expect(result.endpoints[0].port).toBe(8080);
      expect(result.endpoints[0].targetPort).toBe(3000);
      expect(result.endpoints[0].name).toBe('web');
      expect(result.endpoints[0].envVariable).toBe('PORT');
    });

    it('should extract WithHttpsEndpoint', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [createMethod('WithHttpsEndpoint', ['443'], '443')],
      });
      const result = extractApplication(chain);

      expect(result.endpoints).toHaveLength(1);
      expect(result.endpoints[0].protocol).toBe('https');
    });

    it('should extract WithExternalHttpEndpoints', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [createMethod('WithExternalHttpEndpoints', [], '')],
      });
      const result = extractApplication(chain);

      expect(result.endpoints).toHaveLength(1);
      expect(result.endpoints[0].isExternal).toBe(true);
    });

    it('should extract WithReference', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [createMethod('WithReference', ['db'], 'db')],
      });
      const result = extractApplication(chain);

      expect(result.references).toContain('db');
    });

    it('should extract WithReference with property access', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [createMethod('WithReference', ['postgres.Resource'], 'postgres.Resource')],
      });
      const result = extractApplication(chain);

      expect(result.references).toContain('postgres');
    });

    it('should extract PublishAsDockerFile', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [createMethod('PublishAsDockerFile', [], '')],
      });
      const result = extractApplication(chain);

      expect(result.buildPack).toBe('dockerfile');
      expect(result.publishMode).toBe('dockerfile');
    });

    it('should extract PublishAsDockerfile (lowercase)', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [createMethod('PublishAsDockerfile', [], '')],
      });
      const result = extractApplication(chain);

      expect(result.buildPack).toBe('dockerfile');
      expect(result.publishMode).toBe('dockerfile');
    });

    it('should extract PublishAsContainer', () => {
      const chain = createChain('AddProject', 'api', {
        chainedMethods: [createMethod('PublishAsContainer', [], '')],
      });
      const result = extractApplication(chain);

      expect(result.publishMode).toBe('container');
    });

    it('should extract WithServiceBinding (deprecated)', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [createMethod('WithServiceBinding', ['8080'], '8080')],
      });
      const result = extractApplication(chain);

      expect(result.endpoints).toHaveLength(1);
      expect(result.endpoints[0].port).toBe(8080);
      expect(result.endpoints[0].isExternal).toBe(false);
    });

    it('should extract WaitFor', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [createMethod('WaitFor', ['db'], 'db')],
      });
      const result = extractApplication(chain);

      expect(result.waitFor).toContain('db');
    });

    it('should extract multiple WaitFor', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        chainedMethods: [
          createMethod('WaitFor', ['db'], 'db'),
          createMethod('WaitFor', ['redis'], 'redis'),
        ],
      });
      const result = extractApplication(chain);

      expect(result.waitFor).toHaveLength(2);
      expect(result.waitFor).toContain('db');
      expect(result.waitFor).toContain('redis');
    });

    it('should extract WithRunScript', () => {
      const chain = createChain('AddJavaScriptApp', 'vue', {
        chainedMethods: [createMethod('WithRunScript', ['"dev"'], '"dev"')],
      });
      const result = extractApplication(chain);

      expect(result.runScript).toBe('dev');
    });

    it('should extract WithNpm installCommand', () => {
      const chain = createChain('AddJavaScriptApp', 'vue', {
        chainedMethods: [createMethod('WithNpm', ['installCommand: "ci"'], 'installCommand: "ci"')],
      });
      const result = extractApplication(chain);

      expect(result.npmInstallCommand).toBe('ci');
    });

    it('should extract all chained methods together', () => {
      const chain = createChain('AddNpmApp', 'webapp', {
        variableName: 'app',
        rootArgs: ['"webapp"', '"../WebApp"'],
        chainedMethods: [
          createMethod('WithEnvironment', ['"NODE_ENV"', '"production"'], '"NODE_ENV", "production"'),
          createMethod('WithHttpEndpoint', ['port: 3000'], 'port: 3000'),
          createMethod('WithReference', ['db'], 'db'),
          createMethod('WaitFor', ['db'], 'db'),
          createMethod('PublishAsDockerFile', [], ''),
        ],
      });
      const result = extractApplication(chain);

      expect(result.name).toBe('webapp');
      expect(result.sourcePath).toBe('../WebApp');
      expect(result.environment).toHaveLength(1);
      expect(result.endpoints).toHaveLength(1);
      expect(result.references).toContain('db');
      expect(result.waitFor).toContain('db');
      expect(result.buildPack).toBe('dockerfile');
    });
  });
});

describe('Container Extractor', () => {
  describe('isContainerChain', () => {
    it('should recognize AddMinioContainer as container', () => {
      const chain = createChain('AddMinioContainer', 'minio');
      expect(isContainerChain(chain)).toBe(true);
    });

    it('should recognize AddMinio as container', () => {
      const chain = createChain('AddMinio', 'minio');
      expect(isContainerChain(chain)).toBe(true);
    });

    it('should recognize AddRabbitMQ as container', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq');
      expect(isContainerChain(chain)).toBe(true);
    });

    it('should recognize AddRabbitMQContainer as container', () => {
      const chain = createChain('AddRabbitMQContainer', 'rabbitmq');
      expect(isContainerChain(chain)).toBe(true);
    });

    it('should recognize AddKeycloak as container', () => {
      const chain = createChain('AddKeycloak', 'keycloak');
      expect(isContainerChain(chain)).toBe(true);
    });

    it('should recognize AddSeq as container', () => {
      const chain = createChain('AddSeq', 'seq');
      expect(isContainerChain(chain)).toBe(true);
    });

    it('should recognize AddMailDev as container', () => {
      const chain = createChain('AddMailDev', 'maildev');
      expect(isContainerChain(chain)).toBe(true);
    });

    it('should recognize AddKafka as container', () => {
      const chain = createChain('AddKafka', 'kafka');
      expect(isContainerChain(chain)).toBe(true);
    });

    it('should recognize AddElasticsearch as container', () => {
      const chain = createChain('AddElasticsearch', 'elastic');
      expect(isContainerChain(chain)).toBe(true);
    });

    it('should recognize AddContainer as container', () => {
      const chain = createChain('AddContainer', 'custom');
      expect(isContainerChain(chain)).toBe(true);
    });

    it('should not recognize AddPostgres as container', () => {
      const chain = createChain('AddPostgres', 'db');
      expect(isContainerChain(chain)).toBe(false);
    });

    it('should not recognize AddNpmApp as container', () => {
      const chain = createChain('AddNpmApp', 'webapp');
      expect(isContainerChain(chain)).toBe(false);
    });
  });

  describe('extractContainer', () => {
    it('should extract basic RabbitMQ service', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq', {
        variableName: 'mq',
      });
      const result = extractContainer(chain);

      expect(result.name).toBe('rabbitmq');
      expect(result.type).toBe('rabbitmq');
      expect(result.variableName).toBe('mq');
      expect(result.environment).toEqual([]);
      expect(result.volumes).toEqual([]);
      expect(result.endpoints).toEqual([]);
      expect(result.references).toEqual([]);
    });

    it('should extract Minio service', () => {
      const chain = createChain('AddMinio', 'storage');
      const result = extractContainer(chain);

      expect(result.type).toBe('minio');
    });

    it('should extract Keycloak service', () => {
      const chain = createChain('AddKeycloak', 'auth');
      const result = extractContainer(chain);

      expect(result.type).toBe('keycloak');
    });

    it('should extract Seq service', () => {
      const chain = createChain('AddSeq', 'logs');
      const result = extractContainer(chain);

      expect(result.type).toBe('seq');
    });

    it('should extract MailDev service', () => {
      const chain = createChain('AddMailDev', 'mail');
      const result = extractContainer(chain);

      expect(result.type).toBe('maildev');
    });

    it('should extract Kafka service', () => {
      const chain = createChain('AddKafka', 'messaging');
      const result = extractContainer(chain);

      expect(result.type).toBe('kafka');
    });

    it('should extract Elasticsearch service', () => {
      const chain = createChain('AddElasticsearch', 'search');
      const result = extractContainer(chain);

      expect(result.type).toBe('elasticsearch');
    });

    it('should extract custom container with image from args', () => {
      const chain = createChain('AddContainer', 'nginx', {
        rootArgs: ['"nginx"', '"nginx:alpine"'],
      });
      const result = extractContainer(chain);

      expect(result.type).toBe('custom');
      expect(result.image).toBe('nginx:alpine');
    });

    it('should extract WithImage', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq', {
        chainedMethods: [createMethod('WithImage', [], '"rabbitmq:management"')],
      });
      const result = extractContainer(chain);

      expect(result.image).toBe('rabbitmq:management');
    });

    it('should extract WithImageTag', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq', {
        chainedMethods: [createMethod('WithImageTag', [], '"3.12"')],
      });
      const result = extractContainer(chain);

      expect(result.imageTag).toBe('3.12');
    });

    it('should extract WithHostPort', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq', {
        chainedMethods: [createMethod('WithHostPort', ['5672'], '5672')],
      });
      const result = extractContainer(chain);

      expect(result.hostPort).toBe(5672);
    });

    it('should extract WithEnvironment', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq', {
        chainedMethods: [
          createMethod('WithEnvironment', ['"RABBITMQ_DEFAULT_USER"', '"admin"'], '"RABBITMQ_DEFAULT_USER", "admin"'),
        ],
      });
      const result = extractContainer(chain);

      expect(result.environment).toHaveLength(1);
      expect(result.environment[0].key).toBe('RABBITMQ_DEFAULT_USER');
      expect(result.environment[0].value).toBe('admin');
    });

    it('should extract WithEnvironment as expression', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq', {
        chainedMethods: [
          createMethod('WithEnvironment', ['"CONFIG"', 'configVar'], '"CONFIG", configVar'),
        ],
      });
      const result = extractContainer(chain);

      expect(result.environment[0].isExpression).toBe(true);
    });

    it('should extract WithDataVolume', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq', {
        chainedMethods: [createMethod('WithDataVolume', [], '"/var/lib/rabbitmq"')],
      });
      const result = extractContainer(chain);

      expect(result.volumes).toHaveLength(1);
      expect(result.volumes[0].isData).toBe(true);
      expect(result.volumes[0].mountPath).toBe('/var/lib/rabbitmq');
    });

    it('should extract WithBindMount', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq', {
        chainedMethods: [
          createMethod('WithBindMount', ['"./config"', '"/etc/rabbitmq"'], '"./config", "/etc/rabbitmq"'),
        ],
      });
      const result = extractContainer(chain);

      expect(result.volumes).toHaveLength(1);
      expect(result.volumes[0].isData).toBe(false);
      expect(result.volumes[0].name).toBe('./config');
      expect(result.volumes[0].mountPath).toBe('/etc/rabbitmq');
    });

    it('should extract WithHttpEndpoint', () => {
      const chain = createChain('AddSeq', 'logs', {
        chainedMethods: [createMethod('WithHttpEndpoint', ['5341'], '5341')],
      });
      const result = extractContainer(chain);

      expect(result.endpoints).toHaveLength(1);
      expect(result.endpoints[0].port).toBe(5341);
      expect(result.endpoints[0].protocol).toBe('http');
    });

    it('should extract WithHttpEndpoint with named args', () => {
      const chain = createChain('AddSeq', 'logs', {
        chainedMethods: [
          createMethod(
            'WithHttpEndpoint',
            ['port: 5341', 'targetPort: 80', 'isExternal: true'],
            'port: 5341, targetPort: 80, isExternal: true'
          ),
        ],
      });
      const result = extractContainer(chain);

      expect(result.endpoints).toHaveLength(1);
      expect(result.endpoints[0].port).toBe(5341);
      expect(result.endpoints[0].targetPort).toBe(80);
      expect(result.endpoints[0].isExternal).toBe(true);
    });

    it('should extract WithHttpsEndpoint', () => {
      const chain = createChain('AddKeycloak', 'auth', {
        chainedMethods: [createMethod('WithHttpsEndpoint', ['8443'], '8443')],
      });
      const result = extractContainer(chain);

      expect(result.endpoints).toHaveLength(1);
      expect(result.endpoints[0].protocol).toBe('https');
    });

    it('should extract WithExternalHttpEndpoints', () => {
      const chain = createChain('AddSeq', 'logs', {
        chainedMethods: [createMethod('WithExternalHttpEndpoints', [], '')],
      });
      const result = extractContainer(chain);

      expect(result.endpoints).toHaveLength(1);
      expect(result.endpoints[0].isExternal).toBe(true);
    });

    it('should extract WithReference', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq', {
        chainedMethods: [createMethod('WithReference', ['config'], '"config"')],
      });
      const result = extractContainer(chain);

      expect(result.references).toContain('config');
    });

    it('should extract all chained methods together', () => {
      const chain = createChain('AddRabbitMQ', 'rabbitmq', {
        variableName: 'mq',
        chainedMethods: [
          createMethod('WithImage', [], '"rabbitmq"'),
          createMethod('WithImageTag', [], '"management"'),
          createMethod('WithHostPort', ['5672'], '5672'),
          createMethod('WithEnvironment', ['"USER"', '"admin"'], '"USER", "admin"'),
          createMethod('WithDataVolume', [], '"/data"'),
          createMethod('WithHttpEndpoint', ['15672'], '15672'),
        ],
      });
      const result = extractContainer(chain);

      expect(result.name).toBe('rabbitmq');
      expect(result.type).toBe('rabbitmq');
      expect(result.image).toBe('rabbitmq');
      expect(result.imageTag).toBe('management');
      expect(result.hostPort).toBe(5672);
      expect(result.environment).toHaveLength(1);
      expect(result.volumes).toHaveLength(1);
      expect(result.endpoints).toHaveLength(1);
    });
  });
});
