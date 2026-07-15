# Extension-specific agent guide

This file adds to the repository-root [AGENTS.md](../../AGENTS.md).

- `manifest.json` must keep Manifest V3, Chrome 116+, `activeTab`-driven
  on-demand injection, no host permissions, and no declared always-on content
  scripts unless the maintainer explicitly approves a product/security change.
- Treat the content script and every extracted page value as untrusted. Validate
  cross-context messages and route rich post content through
  `src/sanitize.ts`; never assign untrusted HTML directly to a live element.
- Keep local data in `chrome.storage.local`. A remote or sync backend requires
  explicit opt-in, disclosure, and threat-model review.
- Do not add background network APIs, telemetry, or remote assets. The repository
  boundary check intentionally fails when these appear.
- Update `test/manifest.test.ts` when a reviewed manifest policy changes.
- Run `pnpm --filter @forumforge/extension test`, `pnpm typecheck`,
  `pnpm build`, and the applicable browser checks in
  [docs/TESTING.md](../../docs/TESTING.md).
