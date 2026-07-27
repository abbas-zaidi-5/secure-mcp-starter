import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { SCOPES } from './auth.js';
import { stderrAuditSink } from './audit.js';
import { createSecureMcpServer } from './mcp-server.js';
import { InMemoryApprovalStore } from './stores/approval-store.js';
import { InMemoryNoteStore } from './stores/note-store.js';

const server = createSecureMcpServer({
  approvals: new InMemoryApprovalStore(10 * 60 * 1_000),
  audit: stderrAuditSink,
  localAuth: {
    clientId: 'trusted-local-process',
    scopes: [SCOPES.read, SCOPES.propose],
    token: 'stdio-process-boundary'
  },
  maxNoteLength: 4_000,
  notes: new InMemoryNoteStore()
});

const transport = new StdioServerTransport();

process.on('SIGINT', () => {
  void server.close().finally(() => process.exit(0));
});

await server.connect(transport);
