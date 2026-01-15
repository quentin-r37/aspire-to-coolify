import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveToken, resolveApiUrl, validateCredentials } from '../../src/api/token.js';

describe('token.ts', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    delete process.env.COOLIFY_TOKEN;
    delete process.env.COOLIFY_API_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('resolveToken', () => {
    it('should return CLI token as highest priority', async () => {
      process.env.COOLIFY_TOKEN = 'env-token';

      const result = await resolveToken({
        cliToken: 'cli-token',
        configToken: 'config-token',
        prompt: false,
      });

      expect(result).toBe('cli-token');
    });

    it('should return environment variable token when no CLI token', async () => {
      process.env.COOLIFY_TOKEN = 'env-token';

      const result = await resolveToken({
        configToken: 'config-token',
        prompt: false,
      });

      expect(result).toBe('env-token');
    });

    it('should return config file token when no CLI or env token', async () => {
      const result = await resolveToken({
        configToken: 'config-token',
        prompt: false,
      });

      expect(result).toBe('config-token');
    });

    it('should return null when no token available and prompt disabled', async () => {
      const result = await resolveToken({
        prompt: false,
      });

      expect(result).toBe(null);
    });

    it('should return null when no token and stdin is not TTY', async () => {
      // Mock process.stdin.isTTY as false
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

      const result = await resolveToken({});

      expect(result).toBe(null);

      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
    });
  });

  describe('resolveApiUrl', () => {
    it('should return CLI API URL as highest priority', async () => {
      process.env.COOLIFY_API_URL = 'https://env.example.com';

      const result = await resolveApiUrl({
        cliApiUrl: 'https://cli.example.com',
        configApiUrl: 'https://config.example.com',
        prompt: false,
      });

      expect(result).toBe('https://cli.example.com');
    });

    it('should return environment variable API URL when no CLI URL', async () => {
      process.env.COOLIFY_API_URL = 'https://env.example.com';

      const result = await resolveApiUrl({
        configApiUrl: 'https://config.example.com',
        prompt: false,
      });

      expect(result).toBe('https://env.example.com');
    });

    it('should return config file API URL when no CLI or env URL', async () => {
      const result = await resolveApiUrl({
        configApiUrl: 'https://config.example.com',
        prompt: false,
      });

      expect(result).toBe('https://config.example.com');
    });

    it('should return null when no API URL available and prompt disabled', async () => {
      const result = await resolveApiUrl({
        prompt: false,
      });

      expect(result).toBe(null);
    });

    it('should return null when no API URL and stdin is not TTY', async () => {
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

      const result = await resolveApiUrl({});

      expect(result).toBe(null);

      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
    });
  });

  describe('validateCredentials', () => {
    it('should return valid when both apiUrl and token provided', () => {
      const result = validateCredentials({
        apiUrl: 'https://coolify.example.com',
        token: 'my-token',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid with error when apiUrl is missing', () => {
      const result = validateCredentials({
        apiUrl: null,
        token: 'my-token',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('API URL');
    });

    it('should return invalid with error when token is missing', () => {
      const result = validateCredentials({
        apiUrl: 'https://coolify.example.com',
        token: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('token');
    });

    it('should return invalid with two errors when both are missing', () => {
      const result = validateCredentials({
        apiUrl: null,
        token: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('should include helpful hints in error messages', () => {
      const result = validateCredentials({
        apiUrl: null,
        token: null,
      });

      const apiUrlError = result.errors.find((e) => e.includes('API URL'));
      const tokenError = result.errors.find((e) => e.includes('token'));

      expect(apiUrlError).toContain('--api-url');
      expect(apiUrlError).toContain('COOLIFY_API_URL');
      expect(apiUrlError).toContain('config file');

      expect(tokenError).toContain('--token');
      expect(tokenError).toContain('COOLIFY_TOKEN');
      expect(tokenError).toContain('config file');
    });
  });
});
