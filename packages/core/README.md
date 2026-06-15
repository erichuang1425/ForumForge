# @forumforge/core

The ForumForge **post model** and the small, pure helpers that produce it. This
package is the shared data contract: adapters and the parser produce
`ForumForgePost` values, and storage, UI, and (later) intelligence features
consume them. Keep the model minimal and stable — see
[AGENTS.md](../../AGENTS.md) → "The post model is the contract".

## Exports

- `ForumForgePost`, `ForumRole` — the model types.
- `createPost(input)` — build a normalized post from loose adapter output, filling
  required fields with safe defaults (missing id → generated, missing author →
  `"Unknown"`, missing content → `""`).
- `isForumForgePost(value)` — runtime guard for the required shape.
- `normalizeWhitespace`, `cleanText`, `dedupeLinks` — pure text/link utilities.

> `contentHtml` is **untrusted** and must be sanitized before rendering. See
> [SECURITY.md](../../SECURITY.md).

## Develop

From the repo root: `pnpm test` runs the suite, `pnpm typecheck` type-checks all
packages. This package has no runtime dependencies.
