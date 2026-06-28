# Discourse/HN adapters landed as hand-written extractors in packages/parser, ahead of the Phase 2 adapter-sdk runtime

**Type:** confirmed-approach
**Date:** 2026-06-28

ROADMAP.md lists "Discourse adapter" and "Hacker News adapter" in **Phase 1**,
but the JSON adapter format, validator, and `ForumForgeAdapter` runtime
(`packages/adapter-sdk`, the `adapters/` directory) are **Phase 2**. So these
two adapters could not be built as JSON/TypeScript adapters per
[docs/ADAPTERS.md](../../docs/ADAPTERS.md) — that loader doesn't exist yet.

Resolution: `extractThreadDiscourse` and `extractThreadHackerNews` live as
plain exported functions in `packages/parser`, same shape as
`extractThreadGeneric` (`(root, options) => ExtractedThread`), each with a
companion `isXPage(root)` detector. `apps/extension/src/extract.ts` is the only
place that chooses between them — it tries Hacker News (`#hnmain`), then
Discourse (`generator` meta tag), then falls back to generic. No
`adapters/discourse/` directory, no adapter manifest, no registry: that
restructuring is real work for Phase 2, when there's an actual adapter
runtime to migrate them into. Don't scaffold `packages/adapter-sdk` or
`adapters/` early just to "match the target layout" — these two extractors
are the real work Phase 1 needed; the packaging shape is Phase 2's job.

Shared resolveUrl/documentBaseUrl helpers were factored out of `generic.ts`
into `packages/parser/src/url.ts` (and `ExtractedThread`/options types into
`src/types.ts`) once the second and third extractor needed them — don't
duplicate them again for a future fourth adapter.
