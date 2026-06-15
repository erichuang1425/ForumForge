# @forumforge/parser

The ForumForge **extraction engine**. It turns forum-page DOM into
[`ForumForgePost`](../core/README.md) values that the rest of ForumForge consumes.

This package currently ships the **generic fallback parser** — a best-effort
extractor for pages with no site-specific adapter yet. It walks a prioritized set
of common forum/comment selectors, picks the post container that matches the most
elements, and extracts each field defensively: a missing field is skipped, never
thrown. The generic parser is intentionally imperfect; dedicated adapters (Phase 1+)
will produce better results for known forums.

## Exports

- `extractThreadGeneric(root, options?)` — extract a thread from a `Document` or
  any element containing it. Returns `{ title?, posts }`.
- `ExtractedThread`, `GenericExtractOptions` — result and option types.

Pass `options.baseUrl` when parsing detached HTML (tests, fixtures) so relative
permalinks and links resolve to absolute URLs; in a live browser the DOM already
resolves them.

> Extracted `contentHtml` is **untrusted** and must be sanitized before rendering.
> See [SECURITY.md](../../SECURITY.md).

## Develop

From the repo root: `pnpm test` runs the suite (the parser is tested against saved
HTML fixtures, never live sites — see [docs/FIXTURES.md](../../docs/FIXTURES.md));
`pnpm typecheck` type-checks all packages. `linkedom` provides a DOM for tests.
