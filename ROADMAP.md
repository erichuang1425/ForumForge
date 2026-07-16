# ForumForge roadmap

The canonical product boundaries and rationale live in
[Initial Plan.md](Initial%20Plan.md). This file tracks implementation and release
exit criteria.

## Now: v0.1 release candidate

Phase 0 and Phase 1 implementation is complete on the active development line.
It is not considered publicly released until all release evidence exists.
The release is tracked in
[#13](https://github.com/erichuang1425/ForumForge/issues/13); storage safety in
[#14](https://github.com/erichuang1425/ForumForge/issues/14); repository settings
in [#16](https://github.com/erichuang1425/ForumForge/issues/16); and the pilot in
[#17](https://github.com/erichuang1425/ForumForge/issues/17).

- [x] MV3 shell, on-demand content script, compact page launcher, immersive
      reader, and local-library side panel
- [x] Core post model, generic parser, and local storage seam
- [x] Publication-like reading mode and allowlist HTML sanitizer
- [x] Add an adapter-proven semantic contract and discussion-aware immersive
      layouts for linear, article/comment, nested, PTT, imageboard, and Q&A
      threads, with deterministic component tests
- [x] Build and inspect a deterministic offline visual gallery using the real
      reader component across all six layouts and eight reviewed target sites
- [ ] Repeat launcher, archetype, CJK, reduced-motion, narrow-panel, and 200%
      zoom checks against the exact candidate artifact in isolated Chrome
- [x] OP/staff highlighting
- [x] New-since-last-visit tracking
- [x] Saved posts, private author notes, and Markdown export
- [x] Discourse and Hacker News extractors with fixtures
- [x] Add a narrowly detected phpBB 3.3 stock prosilver topic extractor with a
      synthetic offline fixture
- [x] Add a narrowly detected XenForo 2.3 default public thread extractor with
      synthetic offline fixture tests and a dated read-only comparison against
      official normal, question, and article thread markup
- [x] Add a narrowly detected stock/classic vBulletin 4.x showthread extractor
      with a synthetic offline 4.2.5 fixture for legacy/EOL compatibility
- [x] Add narrowly detected Nairaland topic extraction with a synthetic offline
      paired-row fixture
- [x] Add narrowly detected PTT article extraction with a synthetic offline
      article-and-push fixture
- [x] Add narrowly detected 4chan thread extraction with a synthetic offline
      imageboard fixture and inert attachment links
- [x] Add narrowly detected Arca article extraction with nested comments, a
      synthetic offline fixture, and dated read-only public-page evidence
- [x] Add narrowly detected DC Inside article extraction with a synthetic
      offline fixture, dated read-only article evidence, and a first-party
      rendered-comment template comparison
- [x] Add narrowly detected FMKorea article extraction for the loaded comment
      page with a synthetic offline fixture and dated rendered-page evidence
- [x] Add narrowly detected Stack Overflow question/answer/comment extraction
      with a synthetic offline fixture and dated rendered-page evidence
- [ ] Validate F95Zone against a maintainer-supplied sanitized fixture and real
      browser page; automated public-page inspection is currently unavailable
- [x] Canonical automated verification and manifest/privacy guardrails
- [x] Deterministic extension ZIP and checksum tooling
- [x] Document the unversioned storage baseline and schema 1 contract
- [x] Add marker-last migration/error tests and a scoped, confirmed clear control
- [x] Merge the Phase 1 implementation into current `main`
- [ ] Complete and record Chrome 116+ manual testing on the final package
- [ ] Record same-extension-ID schema upgrade and clear-data browser evidence
- [x] Add reviewed 16, 32, 48, and 128 pixel extension icons
- [x] Prepare truthful store listing copy, permission text, and asset requirements
- [ ] Capture accurate candidate screenshots and the required promotional tile
- [ ] Set version 0.1.0, finalize the changelog, tag, and publish a GitHub release
- [ ] Run a small public pilot and triage the resulting issues

The exact release process is in [docs/RELEASING.md](docs/RELEASING.md).

## Next: Phase 2 adapter ecosystem

Exit criterion: a contributor can add, validate, test, import, and export a safe
declarative adapter without modifying extension internals.
The implementation epic is
[#15](https://github.com/erichuang1425/ForumForge/issues/15).

- [ ] Stabilize the JSON adapter schema and threat model
- [ ] Implement schema validation with actionable errors
- [ ] Add adapter matching, extraction, and generic fallback orchestration
- [ ] Add safe local import/export
- [ ] Publish minimal JSON and TypeScript examples
- [ ] Express the bundled hand-written targets in declarative adapters and
      expand phpBB and vBulletin beyond their current narrow fixture-backed
      stock markup
- [ ] Update the adapter contribution guide against the working runtime

## Later

### Phase 3: Adapter Studio

- Click-to-select fields, preview extraction, save locally, and export JSON.

### Phase 4: intelligence layer

- Thread map, best-answer and unanswered-question detection, OP update
  detection, useful-link extraction, and optional user-controlled AI.

### Phase 5: community layer

- Public adapter registry, quality evidence, requests, submissions, and
  broken-adapter reporting.

## Prioritization rules

1. Protect local-first privacy, narrow permissions, and useful non-AI behavior.
2. Finish release evidence before adding another broad feature surface.
3. Prefer work tied to a reproducible user problem or contributor request.
4. Track adoption and maintenance honestly in [docs/IMPACT.md](docs/IMPACT.md);
   never infer impact from implementation activity alone.
