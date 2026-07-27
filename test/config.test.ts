import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

const validEnvironment = {
  MCP_APPROVER_TOKEN: 'a'.repeat(32),
  MCP_OPERATOR_TOKEN: 'o'.repeat(32),
  MCP_READER_TOKEN: 'r'.repeat(32)
};

describe('configuration', () => {
  it('loads secure defaults', () => {
    const config = loadConfig(validEnvironment);
    expect(config.host).toBe('127.0.0.1');
    expect(config.allowedHosts).toEqual(['localhost', '127.0.0.1']);
    expect(config.rateLimitMax).toBe(60);
  });

  it('rejects placeholders and short secrets', () => {
    expect(() =>
      loadConfig({ ...validEnvironment, MCP_READER_TOKEN: 'replace-with-secret-value' })
    ).toThrow('Invalid configuration');
  });

  it('rejects shared credentials across trust boundaries', () => {
    expect(() =>
      loadConfig({ ...validEnvironment, MCP_APPROVER_TOKEN: validEnvironment.MCP_OPERATOR_TOKEN })
    ).toThrow('approval token must be independent');
    expect(() =>
      loadConfig({ ...validEnvironment, MCP_READER_TOKEN: validEnvironment.MCP_OPERATOR_TOKEN })
    ).toThrow('reader and operator tokens must be different');
  });

  it('rejects an empty host allow-list', () => {
    expect(() => loadConfig({ ...validEnvironment, MCP_ALLOWED_HOSTS: ', ,' })).toThrow(
      'MCP_ALLOWED_HOSTS cannot be empty'
    );
  });
});
