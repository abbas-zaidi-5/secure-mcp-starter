import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { z } from 'zod/v4';

import { requireScope, SCOPES } from './auth.js';
import type { AuditSink } from './audit.js';
import type { InMemoryApprovalStore } from './stores/approval-store.js';
import type { InMemoryNoteStore } from './stores/note-store.js';

type Dependencies = {
  approvals: InMemoryApprovalStore;
  audit: AuditSink;
  localAuth?: AuthInfo;
  maxNoteLength: number;
  notes: InMemoryNoteStore;
};

function jsonText(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
  };
}

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : 'The operation failed';
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true
  };
}

export function createSecureMcpServer(dependencies: Dependencies): McpServer {
  const server = new McpServer(
    {
      name: 'secure-mcp-starter',
      version: '0.1.0'
    },
    {
      capabilities: { logging: {} },
      instructions:
        'Read data before proposing changes. Mutations require an independently approved proposal. Never request or expose credentials.'
    }
  );

  const effectiveAuth = (requestAuth: AuthInfo | undefined): AuthInfo | undefined =>
    requestAuth ?? dependencies.localAuth;

  server.registerTool(
    'notes_list',
    {
      description: 'List notes. Requires the notes:read scope.',
      inputSchema: {}
    },
    async (_input, extra) => {
      const auth = effectiveAuth(extra.authInfo);
      try {
        const actor = requireScope(auth, SCOPES.read);
        dependencies.audit({ action: 'notes.list', actor: actor.clientId, outcome: 'allowed' });
        return jsonText({ notes: dependencies.notes.list() });
      } catch (error) {
        dependencies.audit({
          action: 'notes.list',
          actor: auth?.clientId ?? 'anonymous',
          outcome: 'denied'
        });
        return errorText(error);
      }
    }
  );

  server.registerTool(
    'note_change_propose',
    {
      description:
        'Create a time-limited proposal for a new note. This does not mutate the note store.',
      inputSchema: {
        content: z
          .string()
          .trim()
          .min(1)
          .max(dependencies.maxNoteLength)
          .describe('Plain-text note content'),
        title: z.string().trim().min(1).max(120).describe('Short note title')
      }
    },
    async ({ content, title }, extra) => {
      const auth = effectiveAuth(extra.authInfo);
      try {
        const actor = requireScope(auth, SCOPES.propose);
        const proposal = dependencies.approvals.propose(title, content, actor.clientId);
        dependencies.audit({
          action: 'note.propose',
          actor: actor.clientId,
          outcome: 'allowed',
          target: proposal.id
        });
        return jsonText({
          nextStep: `An independent operator must approve proposal ${proposal.id} through the admin endpoint.`,
          proposal
        });
      } catch (error) {
        dependencies.audit({
          action: 'note.propose',
          actor: auth?.clientId ?? 'anonymous',
          outcome: 'denied'
        });
        return errorText(error);
      }
    }
  );

  server.registerTool(
    'note_change_apply',
    {
      description:
        'Apply an independently approved note proposal exactly once. Requires notes:apply.',
      inputSchema: {
        proposalId: z.string().uuid().describe('Approved proposal identifier')
      }
    },
    async ({ proposalId }, extra) => {
      const auth = effectiveAuth(extra.authInfo);
      try {
        const actor = requireScope(auth, SCOPES.apply);
        const proposal = dependencies.approvals.consumeApproved(proposalId);
        const note = dependencies.notes.create(proposal.title, proposal.content);
        dependencies.audit({
          action: 'note.apply',
          actor: actor.clientId,
          outcome: 'allowed',
          target: note.id
        });
        return jsonText({ note });
      } catch (error) {
        dependencies.audit({
          action: 'note.apply',
          actor: auth?.clientId ?? 'anonymous',
          outcome: 'denied',
          target: proposalId
        });
        return errorText(error);
      }
    }
  );

  server.registerResource(
    'security-policy',
    'security://policy',
    {
      description: 'Machine-readable summary of the starter security policy',
      mimeType: 'application/json',
      title: 'Security policy'
    },
    async uri => ({
      contents: [
        {
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              approval: 'out-of-band and single-use',
              authentication: 'bearer token demo; replace with OAuth 2.1 for production',
              authorization: 'scope checked in every tool',
              logging: 'structured security events with secret redaction',
              transport: 'stateless Streamable HTTP'
            },
            null,
            2
          ),
          uri: uri.href
        }
      ]
    })
  );

  server.registerPrompt(
    'review-change-safely',
    {
      argsSchema: {
        proposalId: z.string().uuid()
      },
      description: 'Review a proposed change without approving or applying it.'
    },
    async ({ proposalId }) => ({
      messages: [
        {
          content: {
            text: `Review proposal ${proposalId}. Check scope, data sensitivity, reversibility, and expected impact. Do not approve or apply it.`,
            type: 'text'
          },
          role: 'user'
        }
      ]
    })
  );

  return server;
}
