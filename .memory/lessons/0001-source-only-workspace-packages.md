# Internal packages are source-only (no build step yet); dev tooling lives at the repo root

**Type:** confirmed-approach
**Date:** 2026-06-15

The Phase 0 monorepo uses **source-only internal packages**: each `packages/*`
`package.json` points `exports`/`main`/`types` straight at `./src/index.ts` (not a
built `dist/`). Vitest/esbuild and `tsc` (`moduleResolution: "Bundler"`) load the
TypeScript directly, so there is **no build step** — only `pnpm test` and
`pnpm typecheck`. A real bundle/build step arrives with the extension app
(it needs to ship JS), not before. Don't add `dist/` builds or `tsup` to these
packages just to make imports work; they already resolve.

Shared dev tooling (`typescript`, `vitest`, `linkedom`, `@types/node`) is declared
**once at the workspace root**, not per package. `pnpm -r <script>` still finds the
binaries because pnpm puts the root `node_modules/.bin` on each package script's
PATH, and Node/tsc resolve `linkedom` etc. by walking up to root `node_modules`.
Keep runtime deps in the package that needs them (e.g. `@forumforge/core` is a
`workspace:*` dependency of `@forumforge/parser`).

Parser/adapter tests use `linkedom` to build a DOM from saved HTML fixtures and
pass `baseUrl` so relative links resolve — the extractor takes a `ParentNode`, so
it works against both a real browser DOM and linkedom (cast the linkedom document
to `ParentNode` in tests).
