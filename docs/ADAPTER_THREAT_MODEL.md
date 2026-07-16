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
and selectors. Validation, matching, and extraction enforce these limits:

| Resource | Limit |
| --- | ---: |
| UTF-8 JSON import | 65,536 bytes |
| Adapters considered in one local registry | 128 |
| URL-matched candidates queried against the page | 16 |
| Selector queries during one selection | 64 |
| Current page URL | 8,192 code units |
| Canonical loaded pathname | 4,096 Unicode code points |
| Aggregate URL-match work in one selection | 1,000,000 charged code units |
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
| Selector queries during one extraction | 3,002 |
| Nodes selected during one extraction | 3,501 |
| Field reads during one extraction | 3,001 |
| Descendant DOM nodes walked during one extraction | 50,000 |
| HTML attributes serialized during one extraction | 50,000 |
| Raw text/attribute/tag code units read during one extraction | 16,777,216 |
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
native selector evaluation still depends on the size of the page the user
opened, so the runtime additionally caps calls and returned-node processing.

## Deterministic matching and precedence

Matching must normalize URLs with the platform `URL` parser and compare exact
origins. Path globs support literal characters plus `*` only and are evaluated
by a linear matcher, never by constructing a regular expression. A wildcard
matches zero or more serialized pathname characters, including `/`. Ambiguous
loaded paths fail to the generic result rather than weakening canonical rules.

For each adapter, the most specific matching URL record supplies its score:
more literal pathname code points, then fewer wildcards, then the record's
lexically smaller pathname. Registry validation rejects duplicate adapter IDs.
URL candidates are then ordered by:

1. reviewed bundled adapters before locally imported adapters;
2. more literal pathname code points before fewer;
3. fewer wildcards before more; and
4. adapter ID in ascending Unicode code-point order.

The package, not imported data or a registry caller, owns bundled provenance.
Only an opaque catalog created by the reviewed source-build seam can enter the
bundled tier; a forged or cloned catalog fails closed. Local entries cannot
assert a higher trust tier. URL matching charges the lengths of each compared
origin, glob, and loaded pathname against one aggregate 1,000,000-code-unit
budget before any detector queries run.

Detection runs in that order. Every detector for a candidate must match; a
syntax error or missing detector rejects that candidate and continues to the
next ranked candidate. The current foundation returns a generic decision after
selection or extraction failure but does not invoke the existing generic parser,
whose work is not yet governed by these budgets. Later orchestration must share
equivalent limits; budget exhaustion must never launch an unbounded second pass.
The same input registry, URL, and page root must always select the same adapter
regardless of insertion order. A tie never combines selectors from multiple
adapters.

## Bounded extraction

`extractThreadWithAdapter()` accepts only validator-produced values and rechecks
the exact page URL plus every detector against the supplied page root. It then
returns either one complete adapter result or a stable generic decision. It
never skips a malformed required post, returns a truncated post list, combines
adapter and generic output, mutates the page, or invokes a parser fallback.

Extraction does not materialize a post selector's complete result or an
element's aggregate `textContent` or `innerHTML`. Post discovery walks at most
50,000 descendants and applies `Element.matches()` one node at a time, stopping
on the 501st match without indexing the rest of the document. Content walkers
cap child collections before indexing them, check each `CharacterData.length`
before reading text in 4,096-code-unit chunks, and serialize HTML through a
read-only bounded walker. Attribute collections are capped before indexing.
Comments and non-content node types are omitted. The serializer performs no DOM
writes and does not attach, preload, or render captured markup.

The result marks serialized rich HTML as `untrusted-page-html`. Event handlers,
unsafe links, remote resources, and active elements may still be present as
inert strings; extension integration must pass that field through the existing
build-up sanitizer before rendering. The extractor itself does not weaken or
duplicate the sanitizer boundary.

Post IDs must be present, non-empty, bounded, control-free, and unique after
trimming. A violation fails the whole adapter; IDs are never generated,
suffixed, or truncated. A missing author target fails, while a present empty
author becomes `Unknown` to match the core contract. Empty post content is
allowed. Missing optional values are omitted. Parent IDs are retained only when
they name a unique preceding loaded post; unknown, self, forward, and therefore
cyclic edges flatten safely.

Permalinks are read only from the declared text or `getAttribute()` source and
resolved against the explicitly supplied page URL, never page-controlled base
state or an element URL property. Only bounded, credential-free, same-origin
HTTP(S) results survive; malformed, cross-origin, and unsafe optional values are
omitted. HTML-contained URLs remain hostile sanitizer input.

Version 1 has no per-post rules for question/answer kinds, PTT reactions,
scores, accepted answers, or other semantic roles. Extraction therefore emits
`linear` unless validated preceding parent edges support `nested`; it never
infers semantics from post position or the adapter's declared site layout.

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
adapter set or returning partial extracted posts. Storage writes commit a
complete validated record atomically; a failed update leaves the previous valid
record intact. Future schema migrations must be deterministic, idempotent,
marker-last, and reject newer versions.

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
