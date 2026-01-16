# aspire2coolify

[![CI](https://github.com/quentin-r37/aspire-to-coolify/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/quentin-r37/aspire-to-coolify/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/aspire2coolify.svg)](https://www.npmjs.com/package/aspire2coolify)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![semantic-release](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

CLI tool to convert .NET Aspire configurations to Coolify deployments using the Coolify REST API.

## Installation

```bash
npm install -g aspire2coolify
```

Or run locally:

```bash
npm install
npm run build
```

## Quick Start

```bash
# 1. Set your Coolify credentials
export COOLIFY_API_URL=https://coolify.example.com
export COOLIFY_TOKEN=your-api-token

# 2. Deploy your Aspire app (project is auto-created from directory name)
aspire2coolify deploy ./AppHost/Program.cs --server-id your-server-uuid

# Or with a custom project name
aspire2coolify deploy ./AppHost/Program.cs \
  --server-id your-server-uuid \
  --project-name "My App"

# Or use an existing project
aspire2coolify deploy ./AppHost/Program.cs \
  --server-id your-server-uuid \
  --project-id your-project-uuid
```

## Usage

### Parse Command

Parse an Aspire Program.cs file and display the extracted model:

```bash
aspire2coolify parse ./AppHost/Program.cs

# Output to file
aspire2coolify parse ./AppHost/Program.cs -o model.json
```

### Generate Command

Generate a bash script with curl commands to deploy via the Coolify API:

```bash
# Simple - script will create project automatically (named from directory)
aspire2coolify generate ./AppHost/Program.cs --server-id srv-456

# Output to file
aspire2coolify generate ./AppHost/Program.cs --server-id srv-456 -o deploy.sh

# With custom project name
aspire2coolify generate ./AppHost/Program.cs \
  --server-id srv-456 \
  --project-name "My App"

# Use existing project (no project creation in script)
aspire2coolify generate ./AppHost/Program.cs \
  --project-id proj-123 \
  --server-id srv-456 \
  --environment-name production

# Output as JSON (API payloads)
aspire2coolify generate ./AppHost/Program.cs --json
```

#### Generate Options

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Output file for the generated script |
| `-c, --config <file>` | Config file path |
| `--no-comments` | Exclude comments from output |
| `--project-id <id>` | Coolify project UUID (if not provided, script creates a new project) |
| `--project-name <name>` | Name for the new project (defaults to directory name) |
| `--server-id <id>` | Coolify server UUID |
| `--environment-name <name>` | Environment name (e.g., `production`) |
| `--json` | Output as JSON instead of shell script |

### Deploy Command

Deploy directly to Coolify via the REST API:

```bash
# Set credentials via environment variables (recommended)
export COOLIFY_API_URL=https://coolify.example.com
export COOLIFY_TOKEN=your-api-token

# Simple deployment - auto-creates project from directory name (e.g., "VibeCode" from "VibeCode.AppHost")
aspire2coolify deploy ./AppHost/Program.cs --server-id srv-456

# Dry run (shows what would be deployed)
aspire2coolify deploy ./AppHost/Program.cs --dry-run --server-id srv-456

# With custom project name
aspire2coolify deploy ./AppHost/Program.cs \
  --server-id srv-456 \
  --project-name "My Application"

# Use existing project (skips auto-creation)
aspire2coolify deploy ./AppHost/Program.cs \
  --project-id proj-123 \
  --server-id srv-456

# Deploy and start resources immediately
aspire2coolify deploy ./AppHost/Program.cs \
  --server-id srv-456 \
  --instant-deploy

# Skip resources that already exist (idempotent deployment)
aspire2coolify deploy ./AppHost/Program.cs \
  --server-id srv-456 \
  --skip-existing
```

#### Deploy Options

| Option | Description |
|--------|-------------|
| `--api-url <url>` | Coolify API URL (or use `COOLIFY_API_URL` env var) |
| `--token <token>` | Coolify API token (or use `COOLIFY_TOKEN` env var) |
| `--project-id <id>` | Coolify project UUID (optional - if not provided, a new project is created) |
| `--project-name <name>` | Name for the new project (defaults to directory name, e.g., "VibeCode" from "VibeCode.AppHost") |
| `--server-id <id>` | Coolify server UUID (required) |
| `--environment-name <name>` | Environment name (default: `production`) |
| `--instant-deploy` | Deploy resources immediately after creation |
| `--skip-existing` | Skip resources that already exist instead of failing |
| `--dry-run` | Preview deployment without executing |
| `--github-repo <url>` | GitHub repository URL for applications |
| `--github-branch <branch>` | GitHub branch to deploy (default: `main`) |
| `--github-base-path <path>` | Base path within the GitHub repository |
| `--github-app-uuid <uuid>` | GitHub App UUID for private repositories |
| `--build-pack <type>` | Build pack: `nixpacks`, `dockerfile`, `static`, `dockercompose` |

### Init Command

Create a configuration file:

```bash
aspire2coolify init
```

### GitHub Source Deployment

Deploy applications directly from a GitHub repository instead of creating Docker image placeholders.

#### Public Repository

```bash
aspire2coolify deploy ./AppHost/Program.cs \
  --server-id srv-456 \
  --github-repo https://github.com/your-org/your-repo \
  --github-branch main \
  --github-base-path /AppSvelteKit
```

#### Private Repository (with GitHub App)

For private repositories, you need to configure a GitHub App in Coolify first:

1. Go to your Coolify instance > **Sources** > **Add GitHub App**
2. Complete the GitHub App setup
3. Copy the GitHub App UUID from the Sources page

```bash
aspire2coolify deploy ./AppHost/Program.cs \
  --server-id srv-456 \
  --github-repo https://github.com/your-org/your-private-repo \
  --github-branch main \
  --github-app-uuid your-github-app-uuid
```

The `--github-base-path` option is combined with the application's `sourcePath` (from `AddNpmApp("name", "../path")`) to determine the correct directory in the repository.

## Example

### Input (Program.cs)

```csharp
var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddAzurePostgresFlexibleServer("postgreServer")
    .RunAsContainer(a => a
        .WithImage("pgvector/pgvector")
        .WithImageTag("pg17")
        .WithDataVolume()
        .WithHostPort(5432)
    );
var db = postgres.AddDatabase("db");

builder.AddNpmApp("svelte", "../VibeCode.SvelteKit")
    .WithEnvironment("BODY_SIZE_LIMIT", "10M")
    .WithHttpEndpoint(env: "PORT")
    .WithReference(db)
    .PublishAsDockerFile();

builder.Build().Run();
```

### Output (Coolify API Script)

```bash
#!/bin/bash
# Generated by aspire2coolify
# Coolify API deployment script
#
# Required environment variables:
#   COOLIFY_API_URL - Your Coolify instance URL (e.g., https://coolify.example.com)
#   COOLIFY_TOKEN   - Your Coolify API token
#
# Usage:
#   export COOLIFY_API_URL=https://coolify.example.com
#   export COOLIFY_TOKEN=your-api-token
#   ./deploy.sh

set -e

# Validate environment variables
if [ -z "$COOLIFY_API_URL" ]; then
  echo "Error: COOLIFY_API_URL environment variable is not set"
  exit 1
fi

if [ -z "$COOLIFY_TOKEN" ]; then
  echo "Error: COOLIFY_TOKEN environment variable is not set"
  exit 1
fi

echo "Deploying to Coolify at $COOLIFY_API_URL"
echo ""

# Database: postgreServer (postgres)
echo "Creating postgreServer..."
curl -X POST "${COOLIFY_API_URL}/api/v1/databases/postgresql" \
  -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "server_uuid": "${SERVER_UUID}",
    "project_uuid": "${PROJECT_UUID}",
    "environment_name": "${ENVIRONMENT_NAME}",
    "name": "postgreServer",
    "image": "pgvector/pgvector:pg17",
    "is_public": true,
    "public_port": 5432,
    "instant_deploy": true
  }'
echo ""

# Application: svelte (npm)
echo "Creating svelte..."
curl -X POST "${COOLIFY_API_URL}/api/v1/applications/dockerimage" \
  -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "server_uuid": "${SERVER_UUID}",
    "project_uuid": "${PROJECT_UUID}",
    "environment_name": "${ENVIRONMENT_NAME}",
    "docker_registry_image_name": "svelte",
    "docker_registry_image_tag": "latest",
    "name": "svelte",
    "ports_exposes": "80",
    "instant_deploy": false
  }'
echo ""

echo "Deployment complete!"
```

## Configuration

Create an `aspire2coolify.config.js` file:

```javascript
export default {
  coolify: {
    // API connection
    apiUrl: 'https://coolify.example.com',
    token: 'your-api-token', // Or use COOLIFY_TOKEN env var (recommended)

    // Deployment target
    serverId: 'your-server-uuid',        // Required
    projectId: 'your-project-uuid',      // Optional - if not set, a new project is created
    projectName: 'My App',               // Optional - name for auto-created project
    environmentName: 'production',       // Optional - defaults to 'production'
    skipExisting: false,                 // Optional - skip resources that already exist
  },
  // GitHub source configuration (optional)
  // When set, applications are deployed from GitHub instead of Docker image placeholders
  github: {
    repository: 'https://github.com/your-org/your-repo',
    branch: 'main',
    basePath: '/AppSvelteKit',           // Optional - base path within the repository
    appUuid: 'your-github-app-uuid',     // Optional - required for private repositories
  },
  defaults: {
    buildPack: 'nixpacks', // 'nixpacks' | 'dockerfile' | 'static' | 'dockercompose'
  },
  output: {
    includeComments: true,
    format: 'shell', // 'shell' | 'json'
  },
};
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `COOLIFY_API_URL` | Your Coolify instance URL |
| `COOLIFY_TOKEN` | Your Coolify API token (from Keys & Tokens in Coolify) |

### Credential Priority

Credentials are resolved in this order (highest to lowest priority):

1. CLI flags (`--api-url`, `--token`)
2. Environment variables (`COOLIFY_API_URL`, `COOLIFY_TOKEN`)
3. Config file (`coolify.apiUrl`, `coolify.token`)
4. Interactive prompt (for token, if running in a TTY)

## Supported Aspire Methods

### Databases
- `AddPostgres`, `AddAzurePostgresFlexibleServer`
- `AddSqlServer`, `AddAzureSqlServer`
- `AddMySql`
- `AddMongoDB`
- `AddRedis`

### Services
- `AddRabbitMQ`
- `AddKafka`
- `AddKeycloak`
- `AddSeq`
- `AddMailDev`
- `AddElasticsearch`

### Storage
- `AddMinioContainer`

### Applications
- `AddNpmApp`, `AddNodeApp`, `AddJavaScriptApp`
- `AddProject<T>`
- `AddDockerfile`
- `AddContainer`

### Configuration Methods
- `WithEnvironment(key, value)`
- `WithReference(resource)`
- `WaitFor(resource)`
- `WithHttpEndpoint()`, `WithHttpsEndpoint()`
- `WithExternalHttpEndpoints()`
- `WithHostPort(port)`
- `WithImage(image)`, `WithImageTag(tag)`
- `WithDataVolume()`
- `WithRunScript(scriptName)`
- `WithNpm(installCommand: "ci")`
- `PublishAsDockerFile()`
- `RunAsContainer()`

## API Reference

This tool uses the [Coolify REST API](https://coolify.io/docs/api-reference/api/) to create and manage resources:

| Resource | API Endpoint |
|----------|--------------|
| Projects | `POST /api/v1/projects`, `GET /api/v1/projects` |
| PostgreSQL | `POST /api/v1/databases/postgresql` |
| MySQL | `POST /api/v1/databases/mysql` |
| MongoDB | `POST /api/v1/databases/mongodb` |
| Redis | `POST /api/v1/databases/redis` |
| Databases (list) | `GET /api/v1/databases` |
| Services | `POST /api/v1/services`, `GET /api/v1/services` |
| Applications (Docker) | `POST /api/v1/applications/dockerimage` |
| Applications (Public Git) | `POST /api/v1/applications/public` |
| Applications (Private GitHub) | `POST /api/v1/applications/private-github-app` |
| Applications (list) | `GET /api/v1/applications` |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev

# Lint
npm run lint
```

## Programmatic API

You can also use aspire2coolify as a library in your Node.js projects:

```bash
npm install aspire2coolify
```

### Basic Usage

```typescript
import { parseFile, generate, deployToCloudify, CoolifyApiClient } from 'aspire2coolify';

// Parse an Aspire Program.cs file
const { app, errors, warnings } = parseFile('./AppHost/Program.cs');

// Generate a bash script
const { script, commands } = generate(app, {
  projectName: 'my-app',
  serverId: 'your-server-uuid',
});

console.log(script);

// Or deploy directly via API
const client = new CoolifyApiClient('https://coolify.example.com', 'your-token');
const summary = await deployToCloudify(client, app, {
  projectUuid: 'project-uuid',
  serverUuid: 'server-uuid',
  environmentName: 'production',
});

console.log(`Deployed: ${summary.successful} succeeded, ${summary.failed} failed`);
```

### Sub-module Imports

```typescript
// Parser only
import { parseFile, parseSource } from 'aspire2coolify/parser';

// API client only
import { CoolifyApiClient, deployToCloudify } from 'aspire2coolify/api';

// Generator only
import { generate } from 'aspire2coolify/generator';
```

### Available Exports

| Export | Description |
|--------|-------------|
| `parseFile(path)` | Parse a Program.cs file |
| `parseSource(code)` | Parse C# source code string |
| `generate(app, options)` | Generate Coolify deployment script |
| `CoolifyApiClient` | Coolify REST API client class |
| `deployToCloudify(client, app, config)` | Deploy resources to Coolify |
| `resolveToken()` | Resolve API token from env/config |
| `resolveApiUrl()` | Resolve API URL from env/config |
| `createEmptyAspireApp()` | Create an empty AspireApp model |

### TypeScript Types

All types are exported for TypeScript users:

```typescript
import type {
  AspireApp,
  Database,
  Service,
  Application,
  ParseResult,
  GenerateResult,
  DeployConfig,
  DeploymentSummary,
} from 'aspire2coolify';
```

## Support

If this project helped you save time or simplified your deployments, consider supporting its development:

<a href="https://buymeacoffee.com/quentin.roger">
  <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee">
</a>

## License

MIT
