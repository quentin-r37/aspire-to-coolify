# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

aspire2coolify is a CLI tool that converts .NET Aspire configurations (from C# `Program.cs` files) to Coolify deployments. It parses Aspire's fluent API calls and either generates bash scripts with curl commands or deploys directly via the Coolify REST API.

## Commands

```bash
# Build
npm run build

# Run tests
npm test

# Run a single test file
npx vitest run tests/parser.test.ts

# Run tests matching a pattern
npx vitest run -t "pattern"

# Watch mode (continuous compilation)
npm run dev

# Lint and format
npm run lint
npm run lint:fix
npm run format

# Type checking only
npm run typecheck

# Run the CLI locally
node dist/cli/index.js <command>
```

## Architecture

The tool follows a three-stage pipeline:

```
C# Source (Program.cs)
        ↓
   [Parser Layer]
   tokenizer.ts → extractors/*
        ↓
   AspireApp Model (intermediate representation)
        ↓
   [Generator Layer] or [API Layer]
   generators/coolify/*    api/deployer.ts
        ↓                       ↓
   Bash Script            Direct API calls
```

### Parser Layer (`src/parser/`)

- **tokenizer.ts**: Extracts fluent method chains from C# code using regex patterns. Handles `builder.Add*()` calls and their chained methods (`.WithEnvironment()`, `.WithReference()`, etc.)
- **extractors/**: Resource-specific extraction logic
  - `database.ts`: PostgreSQL, MySQL, MongoDB, Redis, SQL Server
  - `application.ts`: NpmApp, Project, Container, Dockerfile
  - `container.ts`: Generic containers and services (RabbitMQ, Keycloak, etc.)

### Models (`src/models/`)

- **aspire.ts**: The `AspireApp` intermediate model - the bridge between parsing and generation. Contains `databases`, `services`, `storage`, `applications`, and `references` arrays.
- **coolify.ts**: Coolify API payload types and response structures.

### Generator Layer (`src/generators/coolify/`)

Transforms `AspireApp` into Coolify API commands. Generates curl-based bash scripts with proper ordering (databases → services → applications).

### API Layer (`src/api/`)

- **coolify.ts**: `CoolifyApiClient` class wrapping all Coolify REST API calls
- **deployer.ts**: `deployToCloudify()` orchestrates actual deployment, iterating through resources in dependency order
- **token.ts**: Credential resolution (CLI flags → env vars → config file → interactive prompt)

### CLI (`src/cli/index.ts`)

Commander.js-based CLI with four commands: `parse`, `generate`, `deploy`, `init`.

## Key Patterns

**Adding a new Aspire resource type:**
1. Add detection logic in `src/parser/extractors/` (or extend existing extractor)
2. Add the type to `src/models/aspire.ts`
3. Add generator in `src/generators/coolify/` for script output
4. Add deployment handler in `src/api/deployer.ts` for API deployment

**Adding a new Coolify service mapping:**
1. Update `serviceTypeMap` in `src/api/deployer.ts:deployService()`
2. Add corresponding command generation in `src/generators/coolify/service.ts`

## Testing

Tests are in `tests/` using Vitest. Parser tests use inline C# snippets to verify extraction.
