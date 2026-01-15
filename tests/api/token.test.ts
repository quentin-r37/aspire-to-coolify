import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveToken, resolveApiUrl, validateCredentials, promptForApiUrl } from '../../src/api/token.js';
import { EventEmitter } from 'node:events';

// Mock readline module
vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => {
    const emitter = new EventEmitter();
    return {
      question: vi.fn((prompt: string, callback: (answer: string) => void) => {
        // Simulate user input after a short delay
        setTimeout(() => callback('mocked-input'), 0);
      }),
      close: vi.fn(),
      on: emitter.on.bind(emitter),
      emit: emitter.emit.bind(emitter),
    };
  }),
}));

describe('token.ts', () => {
  const originalEnv = process.env;
  const originalIsTTY = process.stdin.isTTY;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    delete process.env.COOLIFY_TOKEN;
    delete process.env.COOLIFY_API_URL;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
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

  describe('promptForApiUrl', () => {
    it('should return user input from prompt', async () => {
      const result = await promptForApiUrl();

      expect(result).toBe('mocked-input');
    });

    it('should call readline createInterface', async () => {
      const readline = await import('node:readline');

      await promptForApiUrl();

      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
      });
    });
  });

  describe('resolveToken with TTY prompt', () => {
    it('should prompt for token when TTY is available and no other source', async () => {
      // Mock stdin as TTY
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const result = await resolveToken({});

      expect(result).toBe('mocked-input');
    });

    it('should prompt for token when prompt is explicitly true', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const result = await resolveToken({ prompt: true });

      expect(result).toBe('mocked-input');
    });

    it('should not prompt when prompt is explicitly false even with TTY', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const result = await resolveToken({ prompt: false });

      expect(result).toBe(null);
    });

    it('should prefer config token over prompt', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const result = await resolveToken({ configToken: 'config-token' });

      expect(result).toBe('config-token');
    });
  });

  describe('resolveApiUrl with TTY prompt', () => {
    it('should prompt for API URL when TTY is available and no other source', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const result = await resolveApiUrl({});

      expect(result).toBe('mocked-input');
    });

    it('should prompt for API URL when prompt is explicitly true', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const result = await resolveApiUrl({ prompt: true });

      expect(result).toBe('mocked-input');
    });

    it('should not prompt when prompt is explicitly false even with TTY', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const result = await resolveApiUrl({ prompt: false });

      expect(result).toBe(null);
    });

    it('should prefer config API URL over prompt', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

      const result = await resolveApiUrl({ configApiUrl: 'https://config.example.com' });

      expect(result).toBe('https://config.example.com');
    });
  });
});
