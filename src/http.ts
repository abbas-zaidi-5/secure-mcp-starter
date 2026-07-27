import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import {
  AuthenticationError,
  authenticateMcpRequest,
  fingerprint,
  parseBearerToken,
  safeEqual
} from './auth.js';
import { stderrAuditSink } from './audit.js';
import { loadConfig } from './config.js';
import { createSecureMcpServer } from './mcp-server.js';
import { FixedWindowRateLimiter } from './rate-limit.js';
import { InMemoryApprovalStore } from './stores/approval-store.js';
import { InMemoryNoteStore } from './stores/note-store.js';

type AuthenticatedRequest = Request & { auth?: AuthInfo };

const approvalBodySchema = z.object({ decision: z.literal('approve') }).strict();
const config = loadConfig();
const approvals = new InMemoryApprovalStore(config.approvalTtlMs);
const notes = new InMemoryNoteStore();
const limiter = new FixedWindowRateLimiter(config.rateLimitMax, config.rateLimitWindowMs);

const app = createMcpExpressApp({
  allowedHosts: config.allowedHosts,
  host: config.host
});

app.disable('x-powered-by');
app.use((_request: Request, response: Response, next: NextFunction) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.get('/healthz', (_request: Request, response: Response) => {
  response.status(200).json({ status: 'ok' });
});

function rateLimit(request: Request, response: Response, next: NextFunction): void {
  const keyMaterial = request.headers.authorization ?? request.ip ?? 'unknown';
  const decision = limiter.consume(fingerprint(keyMaterial));
  response.setHeader('RateLimit-Limit', String(config.rateLimitMax));
  response.setHeader('RateLimit-Remaining', String(decision.remaining));

  if (!decision.allowed) {
    const seconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1_000));
    response.setHeader('Retry-After', String(seconds));
    response.status(429).json({ error: 'rate_limit_exceeded', retryAfterSeconds: seconds });
    return;
  }
  next();
}

function authenticate(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
  try {
    request.auth = authenticateMcpRequest(request.headers.authorization, config);
    next();
  } catch (error) {
    const message = error instanceof AuthenticationError ? error.message : 'Authentication failed';
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'unauthorized', message });
  }
}

app.post('/admin/proposals/:id/approval', rateLimit, (request: Request, response: Response) => {
  try {
    const token = parseBearerToken(request.headers.authorization);
    if (!safeEqual(token, config.approverToken)) {
      throw new AuthenticationError();
    }

    const body = approvalBodySchema.parse(request.body);
    const proposalId = z.string().uuid().parse(request.params.id);
    const proposal = approvals.approve(proposalId);
    stderrAuditSink({
      action: `proposal.${body.decision}`,
      actor: 'independent-approver',
      outcome: 'allowed',
      target: proposal.id
    });
    response.status(200).json({ proposal });
  } catch (error) {
    const denied = error instanceof AuthenticationError;
    stderrAuditSink({
      action: 'proposal.approve',
      actor: denied ? 'anonymous' : 'independent-approver',
      outcome: denied ? 'denied' : 'failed',
      target: typeof request.params.id === 'string' ? request.params.id : 'invalid'
    });
    response
      .status(denied ? 401 : 400)
      .json({ error: denied ? 'unauthorized' : 'invalid_approval' });
  }
});

app.post(
  '/mcp',
  rateLimit,
  authenticate,
  async (request: AuthenticatedRequest, response: Response) => {
    const server = createSecureMcpServer({
      approvals,
      audit: stderrAuditSink,
      maxNoteLength: config.maxNoteLength,
      notes
    });
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: undefined
    });

    response.on('close', () => {
      void Promise.allSettled([transport.close(), server.close()]);
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch {
      stderrAuditSink({
        action: 'mcp.request',
        actor: request.auth?.clientId ?? 'anonymous',
        outcome: 'failed'
      });
      if (!response.headersSent) {
        response.status(500).json({
          error: { code: -32603, message: 'Internal server error' },
          id: null,
          jsonrpc: '2.0'
        });
      }
    }
  }
);

app.get('/mcp', (_request: Request, response: Response) => {
  response.status(405).json({ error: 'method_not_allowed' });
});

app.delete('/mcp', (_request: Request, response: Response) => {
  response.status(405).json({ error: 'method_not_allowed' });
});

function shutdown(signal: string): void {
  process.stderr.write(`${signal} received; shutting down\n`);
  httpServer.close(error => {
    if (error) {
      process.stderr.write(`Shutdown error: ${error.message}\n`);
      process.exit(1);
    }
    process.exit(0);
  });
}

const httpServer = app.listen(config.port, config.host, (error?: Error) => {
  if (error) {
    process.stderr.write(`Failed to start MCP server: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  process.stderr.write(`Secure MCP server listening on http://${config.host}:${config.port}/mcp\n`);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
