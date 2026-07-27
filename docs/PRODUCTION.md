# Production hardening

The starter demonstrates boundaries; production deployment must replace its local
conveniences.

## Identity and authorization

- Validate OAuth 2.1 access tokens issued for this resource server.
- Validate issuer, audience/resource indicator, signature, expiry, and not-before claims.
- Use short-lived credentials and automated rotation.
- Derive subject and scopes only from validated server-side claims.
- Define scope semantics in version-controlled policy and test every tool.

## State

- Store proposals and data in durable, encrypted persistence.
- Apply approved proposals through a transaction or conditional update.
- Include tenant identity in every key, query, and audit event.
- Define backup, restore, retention, and deletion procedures.

## Network

- Terminate TLS at a trusted boundary.
- Set exact allowed hosts and origins.
- Keep the approval control plane on an internal network or separate service.
- Use a shared rate limiter when running multiple replicas.
- Apply request timeouts and concurrency limits at the proxy and application layers.

## Observability

- Send audit events to append-only storage.
- Alert on authentication failures, approval spikes, denied tool calls, and replay attempts.
- Correlate requests without logging prompts, credentials, or sensitive content.
- Define retention and access policies for logs.

## Software supply chain

- Pin deployable artifacts by digest.
- Require reviewed pull requests and protected branches.
- Enable secret scanning, push protection, dependency review, and CodeQL.
- Generate an SBOM and sign releases or container images.
- Reassess dependencies and protocol changes before each upgrade.

## Deployment gate

Do not expose the service publicly until all items below are true:

- [ ] OAuth verifier replaces environment tokens.
- [ ] Durable atomic persistence replaces in-memory stores.
- [ ] Tenant isolation requirements are implemented and tested.
- [ ] TLS and exact host/origin allow-lists are configured.
- [ ] Shared rate limits and timeouts are enabled.
- [ ] Audit events reach protected append-only storage.
- [ ] Abuse cases and incident response have been exercised.
- [ ] A security review covers the final deployment architecture.
