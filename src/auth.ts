import { createHash, timingSafeEqual } from 'node:crypto';

import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import type { RuntimeConfig } from './config.js';

export const SCOPES = {
  apply: 'notes:apply',
  propose: 'notes:propose',
  read: 'notes:read'
} as const;

export class AuthenticationError extends Error {
  public constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  public constructor(scope: string) {
    super(`Missing required scope: ${scope}`);
    this.name = 'AuthorizationError';
  }
}

export function safeEqual(candidate: string, expected: string): boolean {
  const candidateDigest = createHash('sha256').update(candidate).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export function parseBearerToken(header: string | undefined): string {
  if (!header) {
    throw new AuthenticationError('A bearer token is required');
  }

  const match = /^Bearer ([^\s]+)$/i.exec(header);
  if (!match?.[1]) {
    throw new AuthenticationError('Authorization must use the Bearer scheme');
  }

  return match[1];
}

export function authenticateMcpRequest(
  authorizationHeader: string | undefined,
  config: RuntimeConfig
): AuthInfo {
  const token = parseBearerToken(authorizationHeader);

  if (safeEqual(token, config.operatorToken)) {
    return {
      token,
      clientId: 'environment-operator',
      scopes: [SCOPES.read, SCOPES.propose, SCOPES.apply]
    };
  }

  if (safeEqual(token, config.readerToken)) {
    return {
      token,
      clientId: 'environment-reader',
      scopes: [SCOPES.read, SCOPES.propose]
    };
  }

  throw new AuthenticationError();
}

export function requireScope(authInfo: AuthInfo | undefined, scope: string): AuthInfo {
  if (!authInfo) {
    throw new AuthenticationError();
  }
  if (!authInfo.scopes.includes(scope)) {
    throw new AuthorizationError(scope);
  }
  return authInfo;
}
