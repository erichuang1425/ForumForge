# Declarative adapter threat model

This document defines the security boundary for ForumForge's Phase 2 JSON
adapters. It applies before import, matching, extraction, storage, sharing, or
registry work is connected to the extension.

The version 1 schema is
[`packages/adapter-schema/schema/adapter-v1.schema.json`](../packages/adapter-schema/schema/adapter-v1.schema.json).
It is structural interoperability metadata, not a security acceptance gate.
Hostile files must enter through `parseAdapterJson()`, which applies the
semantic constraints that JSON Schema cannot express. The package is foundation
code only; the v0.1 extension does not load custom adapters.

## Assets and trust boundaries

Forum pages, URLs, DOM attributes, rich HTML, imported JSON, filenames, and
adapter metadata are hostile input. Local read history, saved posts, private
notes, installed adapter records, and the user's browsing context are protected
assets. An adapter author is not trusted merely because an adapter is valid.

Validation proves only that data fits a bounded vocabulary. It does not prove
that selectors are accurate, a target is safe, a forum permits automation, or
an adapter deserves inclusion in a bundled or public registry.

## Primary threats

- **Code or network smuggling:** fields that are interpreted as JavaScript,
  functions, event handlers, remote modules, requests, headers, or pagination
  actions could create remote execution or tracking paths.
- **False-positive matching:** a broad or ambiguous match could extract an
  unrelated page and mix its content into local history, saves, or notes.
- **Resource exhaustion:** oversized JSON, numerous or pathological selectors,
  wildcard patterns, huge result sets, or deeply nested values could block a
  page or extension context.
- **Content injection:** selected HTML, URLs, names, and attributes can contain
  scripts, unsafe schemes, misleading markup, or remote resources.
- **Schema confusion:** missing, invalid, duplicate, or newer versions could be
  interpreted differently across extension releases.
- **Prototype and key confusion:** non-JSON objects, inherited properties,
  unknown fields, or duplicate normalized matches could bypass assumptions.
- **Precedence capture:** an imported adapter could try to override a narrower
  or more trusted adapter through ambiguous ordering.

## Version 1 controls

- The root carries `schemaVersion: 1`; missing, invalid, and newer versions fail
  closed. Unknown properties fail validation at every object boundary, and raw
  JSON imports reject duplicate decoded property names before validation.
- Validation requires canonical exact HTTP(S) origins plus pathname globs with
  at most eight non-adjacent `*` wildcards. It rejects credentials, paths in
  origins, default-port aliases, query capture, redirects, regular expressions,
  and network probes.
- Pathname globs use the ASCII serialization exposed by `URL.pathname`. Percent
  escapes are uppercase, valid UTF-8, and used only for bytes the URL serializer
  must escape. Raw Unicode, spaces, dot segments, and encoded ASCII aliases such
  as `%41`, `%2E`, `%2F`, `%5C`, and `%2A` fail closed.
- Detection is a bounded list of selectors that must be satisfied in the
  already loaded document. A URL match alone is never extraction evidence.
- Reads are limited to text, an attribute, or post-body HTML. HTML remains
  hostile and must pass through the established renderer sanitizer. URLs still
  require scheme validation at the extraction/message/render boundaries.
- Attribute reads use a closed vocabulary and a smaller destination-specific
  allowlist. For example, `href` is a permalink source, not an author or post-ID
  source; event handlers, form values, inline styles, and `srcdoc` are excluded.
- Version 1 has no JavaScript, functions, expressions, templates, event
  handlers, regex transforms, remote code/assets, request actions, DOM writes,
  observers, pagination, or background work.
- Invalid adapters fall back safely to reviewed built-ins or the generic parser;
  they never partially activate.
- Imported adapters and their metadata remain local by default. Sync, upload,
  analytics, registry download, and automatic updates require separate product
  and threat-model approval.

## Required budgets

The schema bounds IDs, names, match arrays, detector arrays, paths, attributes,
and selectors. The validator and future runtime must also enforce these limits:

| Resource | Limit |
| --- | ---: |
| UTF-8 JSON import | 65,536 bytes |
| Adapters considered in one local registry | 128 |
| URL match records per adapter | 16 |
| Required detection selectors | 8 |
| One selector | 256 Unicode code points |
| Compound selectors in one selector | 8 |
| Attribute selectors in one selector | 8 |
| Simple selector parts in one selector | 24 |
| Wildcards in one pathname glob | 8 |
| JSON nesting | 32 levels |
| Validation errors returned | 64, including truncation notice |
| Properties/items in structured input | 512 |
| Extracted posts from one loaded document | 500 |
| Thread title | 16,384 code units |
| Post ID / parent ID | 512 code units each |
| Author | 4,096 code units |
| Timestamp | 512 code units |
| Permalink | 8,192 code units |
| Text post body | 131,072 code units |
| Rich HTML post body before sanitization | 262,144 code units |
| All retained fields in one extraction | 8,388,608 code units |

The version 1 selector grammar is intentionally smaller than CSS: ASCII type,
class, and ID selectors; a reviewed set of attribute selectors; and descendant
or child combinators. Escapes, lists, pseudo-selectors (including every spelling
of `:has()`), universal selectors, sibling combinators, namespaces, and
parentheses are excluded. Runtime selector calls must be wrapped for syntax
errors, execute only against the supplied current document or post container,
stop consuming results at both the post and aggregate-content budgets, and
never trigger a live-site request. These bounds limit ForumForge's work;
browser matching still depends on the size of the page the user opened.

## Deterministic matching and precedence

Matching must normalize URLs with the platform `URL` parser and compare exact
origins. Path globs support literal characters plus `*` only and are evaluated
by a linear matcher, never by constructing a regular expression.

For each adapter, the most specific matching URL record supplies its score:
more literal pathname code points, then fewer wildcards, then the record's
lexically smaller pathname. Registry validation rejects duplicate adapter IDs.
URL candidates are then ordered by:

1. reviewed bundled adapters before locally imported adapters;
2. more literal pathname code points before fewer;
3. fewer wildcards before more; and
4. adapter ID in ascending Unicode code-point order.

Detection runs in that order. Every detector for a candidate must match; a
syntax error or missing detector rejects that candidate and continues to the
next ranked candidate. Only after all candidates fail does orchestration use
the generic parser. The same input registry, URL, and document must always
select the same adapter regardless of insertion order. A tie never combines
selectors from multiple adapters.

## Validation and failure behavior

Validation errors use stable JSON-style paths such as
`$.posts.fields.content.source`. An import reports up to 63 safely discoverable
structural errors, followed by one truncation notice when necessary; it does
not echo post content or other page data. JSON parse errors report position
information only when the platform provides it. Raw imports are bounded by
UTF-8 bytes and nesting before the platform JSON parser runs.

`validateAdapter()` accepts already-materialized plain JSON data and caps the
properties and items it visits. Arbitrary JavaScript proxies are outside the
JSON data model; reflection failures are contained as `non-json-value`, but raw
hostile files must use `parseAdapterJson()` so executable proxy traps never
enter the boundary.

Validation, matching, and extraction fail without mutating the installed
adapter set. Storage writes commit a complete validated record atomically; a
failed update leaves the previous valid record intact. Future schema migrations
must be deterministic, idempotent, marker-last, and reject newer versions.

## Test requirements

Every schema or runtime change needs positive, missing-field, wrong-type,
unknown-field, oversized-input, malformed-origin, selector-bound, duplicate-
match, unsupported-version, precedence, false-positive, and generic-fallback
coverage. Extraction tests use small anonymized synthetic fixtures with no
active embeds or live requests. Browser evidence is still required before a
site compatibility claim.

## Deferred decisions

Role/reaction mappings, score parsing, pagination, dynamic updates, adapter
sharing, registry transport, signatures, and TypeScript/code adapters are not
part of version 1. Each requires a separate capability and threat review rather
than adding an executable escape hatch to this schema.
