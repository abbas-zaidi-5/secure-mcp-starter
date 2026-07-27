# Contributing

Thanks for improving Secure MCP Starter.

## Before opening a change

1. Search existing issues.
2. Open a design issue for new tools, authentication changes, or persistence changes.
3. Keep examples small enough that security boundaries remain inspectable.
4. Never include credentials, production data, or vulnerability details in a public issue.

## Development

```bash
npm install
npm run check
npm run build
```

Pull requests should explain the security impact, include tests for policy changes, and
update the threat model when a trust boundary changes.

## Commit and pull-request quality

- Prefer focused commits and a focused pull request.
- Add tests that fail before the change and pass afterward.
- Avoid new dependencies unless the maintenance and security cost is justified.
- Keep the README quick start runnable.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
