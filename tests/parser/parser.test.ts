import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSource, parseFile } from '../../src/parser/index.js';
import {
  extractFluentChains,
  parseMethodChain,
  parseArgs,
  extractFirstStringArg,
} from '../../src/parser/tokenizer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Tokenizer', () => {
  describe('parseArgs', () => {
    it('should parse simple string arguments', () => {
      expect(parseArgs('"hello", "world"')).toEqual(['"hello"', '"world"']);
    });

    it('should parse numeric arguments', () => {
      expect(parseArgs('5432')).toEqual(['5432']);
    });

    it('should handle named arguments', () => {
      expect(parseArgs('env: "PORT"')).toEqual(['env: "PORT"']);
    });

    it('should handle nested parentheses', () => {
      expect(parseArgs('a => a.Method()')).toEqual(['a => a.Method()']);
    });
  });

  describe('extractFirstStringArg', () => {
    it('should extract double-quoted strings', () => {
      expect(extractFirstStringArg('"mydb"')).toBe('mydb');
    });

    it('should extract first string from multiple args', () => {
      expect(extractFirstStringArg('"name", "../path"')).toBe('name');
    });

    it('should return null for non-string args', () => {
      expect(extractFirstStringArg('5432')).toBeNull();
    });
  });

  describe('parseMethodChain', () => {
    it('should parse single method', () => {
      const result = parseMethodChain('.WithDataVolume()');
      expect(result).toHaveLength(1);
      expect(result[0].method).toBe('WithDataVolume');
    });

    it('should parse multiple methods', () => {
      const result = parseMethodChain('.WithImage("pg").WithHostPort(5432)');
      expect(result).toHaveLength(2);
      expect(result[0].method).toBe('WithImage');
      expect(result[1].method).toBe('WithHostPort');
    });
  });

  describe('extractFluentChains', () => {
    it('should extract simple chain', () => {
      const source = 'var db = builder.AddPostgres("mydb");';
      const chains = extractFluentChains(source);

      expect(chains).toHaveLength(1);
      expect(chains[0].variableName).toBe('db');
      expect(chains[0].rootMethod).toBe('AddPostgres');
      expect(chains[0].name).toBe('mydb');
    });

    it('should extract chain with methods', () => {
      const source = 'var db = builder.AddPostgres("mydb").WithDataVolume().WithHostPort(5432);';
      const chains = extractFluentChains(source);

      expect(chains).toHaveLength(1);
      expect(chains[0].chainedMethods).toHaveLength(2);
      expect(chains[0].chainedMethods[0].method).toBe('WithDataVolume');
      expect(chains[0].chainedMethods[1].method).toBe('WithHostPort');
    });

    it('should extract chain without variable assignment', () => {
      const source = 'builder.AddNpmApp("webapp", "../app").WithReference(db);';
      const chains = extractFluentChains(source);

      expect(chains).toHaveLength(1);
      expect(chains[0].variableName).toBeUndefined();
      expect(chains[0].name).toBe('webapp');
    });
  });
});

describe('Parser', () => {
  describe('parseSource', () => {
    it('should parse simple fixture', () => {
      const source = `
        var builder = DistributedApplication.CreateBuilder(args);
        var postgres = builder.AddPostgres("postgres").WithHostPort(5432);
        var db = postgres.AddDatabase("mydb");
        builder.AddNpmApp("webapp", "../WebApp").WithReference(db);
        builder.Build().Run();
      `;

      const result = parseSource(source);

      expect(result.errors).toHaveLength(0);
      expect(result.app.databases.length).toBeGreaterThanOrEqual(1);
      expect(result.app.applications).toHaveLength(1);
      expect(result.app.applications[0].name).toBe('webapp');
    });

    it('should extract database with custom image', () => {
      const source = `
        var postgres = builder.AddAzurePostgresFlexibleServer("db")
            .RunAsContainer(a => a
                .WithImage("pgvector/pgvector")
                .WithImageTag("pg17")
            );
      `;

      const result = parseSource(source);

      expect(result.app.databases).toHaveLength(1);
      expect(result.app.databases[0].name).toBe('db');
      expect(result.app.databases[0].type).toBe('postgres');
    });

    it('should extract lambda with long parameter names (container =>)', () => {
      const source = `
        var postgres = builder.AddPostgres("db")
            .RunAsContainer(container => container
                .WithImage("postgres")
                .WithImageTag("16-alpine")
            );
      `;

      const result = parseSource(source);

      expect(result.app.databases).toHaveLength(1);
      expect(result.app.databases[0].name).toBe('db');
      expect(result.app.databases[0].image).toBe('postgres');
      expect(result.app.databases[0].imageTag).toBe('16-alpine');
    });

    it('should extract application with environment variables', () => {
      const source = `
        builder.AddNpmApp("svelte", "../SvelteKit")
            .WithEnvironment("NODE_ENV", "production")
            .WithEnvironment("PORT", "3000")
            .PublishAsDockerFile();
      `;

      const result = parseSource(source);

      expect(result.app.applications).toHaveLength(1);
      expect(result.app.applications[0].environment).toHaveLength(2);
      expect(result.app.applications[0].buildPack).toBe('dockerfile');
    });

    it('should build references correctly', () => {
      const source = `
        var db = builder.AddPostgres("postgres");
        builder.AddNpmApp("webapp", "../app").WithReference(db);
      `;

      const result = parseSource(source);

      expect(result.app.references).toHaveLength(1);
      expect(result.app.references[0].from).toBe('webapp');
      expect(result.app.references[0].to).toBe('postgres');
    });
  });

  describe('parseFile', () => {
    it('should parse simple.cs fixture', () => {
      const fixturePath = resolve(__dirname, '../fixtures/simple.cs');
      const result = parseFile(fixturePath);

      expect(result.errors).toHaveLength(0);
      expect(result.app.databases.length).toBeGreaterThanOrEqual(1);
      expect(result.app.applications).toHaveLength(1);
    });

    it('should parse complex.cs fixture', () => {
      const fixturePath = resolve(__dirname, '../fixtures/complex.cs');
      const result = parseFile(fixturePath);

      expect(result.errors).toHaveLength(0);
      expect(result.app.databases.length).toBeGreaterThanOrEqual(2); // postgres + redis
      expect(result.app.services.length).toBeGreaterThanOrEqual(1); // rabbitmq
      expect(result.app.applications.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('JavaScript apps', () => {
    it('should parse AddJavaScriptApp as application', () => {
      const source = `
        builder.AddJavaScriptApp("angular", "../AspireJavaScript.Angular", runScriptName: "start")
            .WithHttpEndpoint(env: "PORT")
            .PublishAsDockerFile();
      `;

      const result = parseSource(source);

      expect(result.errors).toHaveLength(0);
      expect(result.app.applications).toHaveLength(1);
      expect(result.app.applications[0].name).toBe('angular');
      expect(result.app.applications[0].type).toBe('npm');
      expect(result.app.applications[0].sourcePath).toBe('../AspireJavaScript.Angular');
      expect(result.app.applications[0].runScript).toBe('start');
    });

    it('should extract WaitFor dependencies', () => {
      const source = `
        var api = builder.AddProject<Projects.Api>("api");
        builder.AddJavaScriptApp("webapp", "../app")
            .WithReference(api)
            .WaitFor(api);
      `;

      const result = parseSource(source);

      const webapp = result.app.applications.find((a) => a.name === 'webapp');
      expect(webapp).toBeDefined();
      expect(webapp?.waitFor).toContain('api');
    });

    it('should extract WithRunScript', () => {
      const source = `
        builder.AddJavaScriptApp("vue", "../Vue")
            .WithRunScript("start");
      `;

      const result = parseSource(source);

      expect(result.app.applications[0].runScript).toBe('start');
    });

    it('should extract WithNpm options', () => {
      const source = `
        builder.AddJavaScriptApp("vue", "../Vue")
            .WithNpm(installCommand: "ci");
      `;

      const result = parseSource(source);

      expect(result.app.applications[0].npmInstallCommand).toBe('ci');
    });

    it('should parse javascript-apps.cs fixture', () => {
      const fixturePath = resolve(__dirname, '../fixtures/javascript-apps.cs');
      const result = parseFile(fixturePath);

      expect(result.errors).toHaveLength(0);
      expect(result.app.applications).toHaveLength(4); // weatherapi + angular + react + vue

      // Angular app
      const angular = result.app.applications.find((a) => a.name === 'angular');
      expect(angular).toBeDefined();
      expect(angular?.type).toBe('npm');
      expect(angular?.sourcePath).toBe('../AspireJavaScript.Angular');
      expect(angular?.runScript).toBe('start');
      expect(angular?.waitFor).toContain('weatherApi'); // variable name, not resource name

      // React app with environment variable
      const react = result.app.applications.find((a) => a.name === 'react');
      expect(react).toBeDefined();
      expect(react?.environment.find((e) => e.key === 'BROWSER')?.value).toBe('none');

      // Vue app with WithRunScript and WithNpm
      const vue = result.app.applications.find((a) => a.name === 'vue');
      expect(vue).toBeDefined();
      expect(vue?.runScript).toBe('start');
      expect(vue?.npmInstallCommand).toBe('ci');
    });
  });
});
