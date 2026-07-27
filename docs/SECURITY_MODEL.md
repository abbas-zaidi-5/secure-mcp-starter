# Security model

## Assets

- Credentials and authorization claims
- Note content
- Pending and approved changes
- Audit events
- Server availability

## Expected actors

| Actor          | Intended capability                                  |
| -------------- | ---------------------------------------------------- |
| Reader agent   | Read notes and prepare proposals                     |
| Operator agent | Reader capabilities plus applying approved proposals |
| Human approver | Approve a proposal outside the agent tool surface    |
| Maintainer     | Configure, deploy, monitor, and rotate credentials   |

## Threats and controls

| Threat                        | Primary controls                                    | Residual risk                                    |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| Stolen agent credential       | Least-privilege scopes, rotation-ready config       | Token remains usable until rotated               |
| Agent approves its own action | No MCP approval tool; independent credential        | Compromised human control plane                  |
| Replay of approved change     | Single-use proposal state                           | Distributed stores require atomic writes         |
| Scope escalation              | Server-owned credential mapping and handler checks  | Incorrect policy changes by maintainers          |
| Prompt injection              | Fixed tool schemas, narrow tools, approval boundary | A human can still approve malicious content      |
| DNS rebinding                 | Host allow-list and loopback binding                | Misconfigured public deployment                  |
| Secret leakage in logs        | Structured allow-listed audit fields                | Downstream logging must retain controls          |
| Resource exhaustion           | Body limits from the MCP app and rate limiting      | In-memory limiter is per process                 |
| Cross-tenant access           | Not implemented                                     | Do not use this sample as a multi-tenant service |

## Important non-goals

- The example bearer-token verifier is not an OAuth authorization server.
- In-memory storage is not durable or distributed.
- The sample does not provide tenant isolation.
- The sample does not validate arbitrary upstream URLs because it deliberately exposes no
  network-fetch tool.
- Security depends on deployment configuration, secret rotation, monitoring, and review.

## Security invariants

1. A missing or unknown credential never receives an MCP response.
2. A credential cannot choose its own identity or scopes.
3. Every mutation matches a previously approved payload.
4. Approval and application use different credentials.
5. A proposal can be applied at most once.
6. Secret values never appear in intentional audit fields.

Add tests for these invariants before changing authentication, approval, or persistence.
