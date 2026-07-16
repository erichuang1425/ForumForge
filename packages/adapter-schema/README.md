# `@forumforge/adapter-schema`

This private workspace package defines ForumForge's versioned, data-only JSON
adapter contract and bounded runtime validator. It is a Phase 2 foundation and
is not imported by the extension yet.

`parseAdapterJson()` is the authoritative entry point for hostile adapter files:
it enforces raw byte, nesting, duplicate-key, structure, and semantic limits.
`validateAdapter()` is for already-materialized plain JSON values from a trusted
parser or structured-clone boundary; it caps traversal and contains reflection
errors, but it is not a sandbox for arbitrary JavaScript proxies. Both return
either a detached version 1 value or bounded, path-based errors.

The exported JSON Schema is structural interoperability metadata. Schema-only
acceptance is unsupported because canonical origins and paths, the complete
selector grammar, normalized duplicates, and aggregate budgets require the
runtime validator. Checked-in positive examples use the `.adapter.json` suffix
and are passed through `parseAdapterJson()` by `pnpm repo:check`.

Version 1 describes an exact HTTP(S) origin, a canonical serialized pathname
glob, and a deliberately small selector grammar. It can read a thread title
plus post IDs, authors, content, timestamps, permalinks, and parent IDs. It
cannot execute code, request a URL, crawl pagination, mutate a page, observe
future DOM changes, or bypass the shared rich-HTML sanitizer.

See [the adapter threat model](../../docs/ADAPTER_THREAT_MODEL.md) before
changing this package. Adding a capability requires a schema-version decision,
negative tests, and a review of matching, document-processing, privacy, and
rendering boundaries.
