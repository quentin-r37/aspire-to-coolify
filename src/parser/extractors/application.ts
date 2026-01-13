/**
 * Application extractor - parses application-related Aspire methods
 */

import type {
  Application,
  ApplicationType,
  BuildPack,
  EnvironmentVariable,
  Endpoint,
} from '../../models/aspire.js';
import type { FluentChain } from '../tokenizer.js';
import { extractFirstStringArg, extractNamedArgs } from '../tokenizer.js';

const APPLICATION_METHODS: Record<string, { type: ApplicationType; buildPack: BuildPack }> = {
  AddNpmApp: { type: 'npm', buildPack: 'nixpacks' },
  AddNodeApp: { type: 'npm', buildPack: 'nixpacks' },
  AddJavaScriptApp: { type: 'npm', buildPack: 'nixpacks' },
  AddProject: { type: 'project', buildPack: 'dockerfile' },
  AddDockerfile: { type: 'dockerfile', buildPack: 'dockerfile' },
  AddContainer: { type: 'container', buildPack: 'dockerfile' },
  AddExecutable: { type: 'executable', buildPack: 'dockerfile' },
};

export function isApplicationChain(chain: FluentChain): boolean {
  return chain.rootMethod in APPLICATION_METHODS;
}

export function extractApplication(chain: FluentChain): Application {
  const config = APPLICATION_METHODS[chain.rootMethod] || {
    type: 'project',
    buildPack: 'dockerfile',
  };

  const app: Application = {
    name: chain.name,
    type: config.type,
    variableName: chain.variableName,
    buildPack: config.buildPack,
    environment: [],
    endpoints: [],
    references: [],
  };

  // Extract source path from second argument (for AddNpmApp, AddProject, AddJavaScriptApp)
  if (chain.rootArgs.length > 1) {
    const sourcePath =
      extractFirstStringArg(chain.rootArgs[1]) || chain.rootArgs[1]?.replace(/["']/g, '');
    if ((sourcePath && sourcePath.startsWith('.')) || sourcePath?.startsWith('/')) {
      app.sourcePath = sourcePath;
    }
  }

  // Extract named arguments from root method (e.g., runScriptName: "start")
  const rootNamedArgs = extractNamedArgs(chain.rootArgs);
  if (rootNamedArgs.runScriptName) {
    app.runScript = rootNamedArgs.runScriptName;
  }

  // For AddProject, look for project reference in args
  if (chain.rootMethod === 'AddProject') {
    // Handle AddProject<ProjectType>("name") pattern
    const projectMatch = chain.raw.match(/AddProject<([^>]+)>/);
    if (projectMatch) {
      app.project = projectMatch[1];
    }
  }

  // Process chained methods
  for (const method of chain.chainedMethods) {
    switch (method.method) {
      case 'WithEnvironment':
        const env = extractEnvironment(method.args, method.rawArgs);
        if (env) {
          app.environment.push(env);
        }
        break;

      case 'WithHttpEndpoint':
        app.endpoints.push(extractHttpEndpoint(method.args, method.rawArgs));
        break;

      case 'WithHttpsEndpoint':
        app.endpoints.push({
          ...extractHttpEndpoint(method.args, method.rawArgs),
          protocol: 'https',
        });
        break;

      case 'WithExternalHttpEndpoints':
        app.endpoints.push({
          protocol: 'http',
          isExternal: true,
        });
        break;

      case 'WithReference':
        const refName = extractReferenceTarget(method.args[0]);
        if (refName) {
          app.references.push(refName);
        }
        break;

      case 'PublishAsDockerFile':
      case 'PublishAsDockerfile':
        app.buildPack = 'dockerfile';
        app.publishMode = 'dockerfile';
        break;

      case 'PublishAsContainer':
        app.publishMode = 'container';
        break;

      case 'WithServiceBinding':
        // Deprecated but still used - extract port binding
        const bindingPort = method.args[0] ? parseInt(method.args[0], 10) : undefined;
        if (bindingPort) {
          app.endpoints.push({
            port: bindingPort,
            protocol: 'http',
            isExternal: false,
          });
        }
        break;

      case 'WaitFor':
        const waitTarget = extractReferenceTarget(method.args[0]);
        if (waitTarget) {
          app.waitFor = app.waitFor || [];
          app.waitFor.push(waitTarget);
        }
        break;

      case 'WithRunScript':
        const scriptName = extractFirstStringArg(method.args[0]) || method.args[0]?.replace(/["']/g, '');
        if (scriptName) {
          app.runScript = scriptName;
        }
        break;

      case 'WithNpm':
        const npmArgs = extractNamedArgs(method.args);
        if (npmArgs.installCommand) {
          app.npmInstallCommand = npmArgs.installCommand;
        }
        break;
    }
  }

  return app;
}

function extractEnvironment(args: string[], _rawArgs: string): EnvironmentVariable | null {
  if (args.length < 2) {
    // Single arg might be a callback - skip for now
    return null;
  }

  const key = extractFirstStringArg(args[0]) || args[0].replace(/["']/g, '');
  let value = args[1];

  // Check if value is a string literal
  const stringValue = extractFirstStringArg(args[1]);
  if (stringValue) {
    return { key, value: stringValue, isExpression: false };
  }

  // Value is an expression (variable reference)
  return { key, value: value.trim(), isExpression: true };
}

function extractHttpEndpoint(args: string[], _rawArgs: string): Endpoint {
  const namedArgs = extractNamedArgs(args);

  const endpoint: Endpoint = {
    protocol: 'http',
    isExternal: false,
  };

  // Parse port from first positional arg or named arg
  if (args[0] && !args[0].includes(':')) {
    const port = parseInt(args[0], 10);
    if (!isNaN(port)) {
      endpoint.port = port;
    }
  }

  // Parse named arguments
  if (namedArgs.port) {
    endpoint.port = parseInt(namedArgs.port, 10);
  }
  if (namedArgs.targetPort) {
    endpoint.targetPort = parseInt(namedArgs.targetPort, 10);
  }
  if (namedArgs.name) {
    endpoint.name = namedArgs.name;
  }
  if (namedArgs.env) {
    endpoint.envVariable = namedArgs.env;
  }
  if (namedArgs.isExternal === 'true') {
    endpoint.isExternal = true;
  }

  return endpoint;
}

function extractReferenceTarget(arg: string): string | null {
  if (!arg) return null;

  // Handle simple variable reference
  const cleaned = arg.trim().replace(/["']/g, '');

  // Handle property access like db.Resource
  const parts = cleaned.split('.');
  return parts[0] || null;
}
