# `@forumforge/adapter-schema`

This private workspace package defines ForumForge's versioned, data-only JSON
adapter contract, bounded runtime validator, deterministic matcher, and bounded
extractor. It is a Phase 2 foundation and is not imported by the extension yet.

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

`selectAdapterForPage()` accepts only values produced by this validator. It
normalizes the already-loaded URL, ranks a bounded registry deterministically,
requires every detection selector, and returns either one adapter or an
explicit generic-fallback reason. Bundled entries outrank local entries; within
one tier, more literal pathnames, fewer wildcards, and lexical adapter IDs win.
Bundled provenance is represented by a package-owned opaque catalog, so local
data cannot claim that tier. Selection also has an aggregate URL-match work
budget, examines at most 16 URL candidates, and makes at most 64 selector
queries. It does not extract, combine selectors, or invoke the generic parser.

`extractThreadWithAdapter()` rechecks a validated adapter against the supplied
page URL and root, then reads one complete thread under independent query,
selected-node, field-read, DOM-node, attribute, raw-input, and retained-output
budgets. Post discovery walks descendants lazily with `Element.matches()` and
stops on the 501st match without materializing the remainder. It never calls
native `textContent` or `innerHTML`: text is read in bounded `CharacterData`
chunks, while rich HTML is produced by a bounded, read-only serializer and
returned with the explicit
`untrusted-page-html` marker. The extractor retains only same-origin HTTP(S)
permalinks, requires unique non-empty IDs, and never returns partial posts or
invokes the current generic parser. Semantic layouts that version 1 cannot map
degrade to `linear`; validated preceding parent edges can retain `nested`.

See [the adapter threat model](../../docs/ADAPTER_THREAT_MODEL.md) before
changing this package. Adding a capability requires a schema-version decision,
negative tests, and a review of matching, document-processing, privacy, and
rendering boundaries.
