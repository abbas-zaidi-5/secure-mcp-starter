import { describe, expect, it } from 'vitest';

import {
  AuthenticationError,
  AuthorizationError,
  authenticateMcpRequest,
  parseBearerToken,
  requireScope,
  safeEqual,
  SCOPES
} from '../src/auth.js';
import type { RuntimeConfig } from '../src/config.js';

const config: RuntimeConfig = {
  allowedHosts: ['localhost'],
  approvalTtlMs: 60_000,
  approverToken: 'a'.repeat(32),
  host: '127.0.0.1',
  maxNoteLength: 4_000,
  operatorToken: 'o'.repeat(32),
  port: 3_000,
  rateLimitMax: 10,
  rateLimitWindowMs: 60_000,
  readerToken: 'r'.repeat(32)
};

describe('authentication', () => {
  it('uses constant-length digests for comparisons', () => {
    expect(safeEqual('same', 'same')).toBe(true);
    expect(safeEqual('short', 'a much longer value')).toBe(false);
  });

  it('requires a well-formed bearer header', () => {
    expect(parseBearerToken(`Bearer ${config.readerToken}`)).toBe(config.readerToken);
    expect(() => parseBearerToken(undefined)).toThrow(AuthenticationError);
    expect(() => parseBearerToken(`Basic ${config.readerToken}`)).toThrow(AuthenticationError);
  });

  it('maps tokens to least-privilege identities', () => {
    const reader = authenticateMcpRequest(`Bearer ${config.readerToken}`, config);
    const operator = authenticateMcpRequest(`Bearer ${config.operatorToken}`, config);

    expect(reader.scopes).toEqual([SCOPES.read, SCOPES.propose]);
    expect(operator.scopes).toContain(SCOPES.apply);
    expect(() => authenticateMcpRequest('Bearer invalid', config)).toThrow(AuthenticationError);
  });

  it('enforces required scopes', () => {
    const reader = authenticateMcpRequest(`Bearer ${config.readerToken}`, config);
    expect(requireScope(reader, SCOPES.read)).toBe(reader);
    expect(() => requireScope(reader, SCOPES.apply)).toThrow(AuthorizationError);
    expect(() => requireScope(undefined, SCOPES.read)).toThrow(AuthenticationError);
  });
});
