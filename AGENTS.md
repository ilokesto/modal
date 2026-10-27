# @ilokesto/modal

This repository owns one public library.
Use Node 24.22.1 and pnpm 10.17.1. Run commands from this root.

- Keep the Overlay-based modal lifecycle, adapters, focus handling, and APIs intact.
- Library source is in `src/`; tests are in `tests/unit`, `tests/tooling`, and
  `tests/browser`, with shared helpers and browser apps in `tests/fixtures`.
- Keep other libraries as registry dependencies. Only this library and private workspaces
  inside this repository may use workspace links.
- Run `pnpm typecheck` for library source and `pnpm test` for the complete gate.
  The gate builds once, then runs `test:unit`, `test:tooling`,
  `test:pack`, and `test:browser` (the `test:browser:e2e` and
  `test:browser:a11y` suites). Standalone `test:pack` requires `pnpm build` first.
- Consumer-facing changes need a root Changeset.
- `release:verify --sha <full-SHA>` is read-only. Main merges maintain the Changesets release PR; merging
  it publishes only the exact successful Verify artifact through GitHub Actions with the
  latest dist-tag. Never publish locally.
- Before rollout, enable `Allow GitHub Actions to create and approve pull requests`
  and configure `NPM_TOKEN` in the `Production` environment.
