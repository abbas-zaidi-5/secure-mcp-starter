# Security policy

## Supported versions

Only the latest release receives security updates.

## Reporting a vulnerability

Do not open a public issue. Use **Security → Report a vulnerability** on the GitHub
repository to create a private security advisory. Include:

- Affected version or commit
- Reproduction steps
- Expected and observed impact
- Suggested remediation, if available

Please avoid accessing data that is not yours and do not disrupt services while
researching. Maintainers should acknowledge a complete report within five business days.

## Deployment warning

The included environment-token verifier and in-memory stores are development examples.
Read [Production hardening](docs/PRODUCTION.md) before deploying beyond a trusted local
environment.
