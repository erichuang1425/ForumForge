# Parser-specific agent guide

This file adds to the repository-root [AGENTS.md](../../AGENTS.md).

- Adapters produce the `ForumForgePost` contract from `@forumforge/core`.
  Preserve stable IDs, plain text, sanitized-at-render raw HTML provenance, and
  graceful handling of missing fields.
- Adapter detection must be narrow enough that the generic parser remains the
  safe fallback on unrelated pages.
- Tests use small, anonymized, offline-safe fixtures under `test/fixtures/`.
  Never fetch a live forum from an automated test.
- Strip scripts, frames, forms, remote resource loads, identities, tokens, and
  authentic post prose from contributed fixtures. `pnpm repo:check` enforces
  the active-content boundary.
- Add positive extraction tests, malformed/missing-field coverage, and a
  false-positive detection test for each adapter.
- Run `pnpm --filter @forumforge/parser test` and `pnpm verify` before handoff.
