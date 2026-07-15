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

- [x] MV3 shell, on-demand content script, and side panel
- [x] Core post model, generic parser, and local storage seam
- [x] Clean reading mode and allowlist HTML sanitizer
- [x] OP/staff highlighting
- [x] New-since-last-visit tracking
- [x] Saved posts, private author notes, and Markdown export
- [x] Discourse and Hacker News extractors with fixtures
- [x] Canonical automated verification and manifest/privacy guardrails
- [x] Deterministic extension ZIP and checksum tooling
- [ ] Merge the Phase 1 development pull request into current `main`
- [ ] Complete and record Chrome 116+ manual testing on the final package
- [ ] Add extension icons and store listing assets
- [ ] Add an in-product bulk clear-local-data control
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
- [ ] Add phpBB, XenForo, and vBulletin-style fixtures/adapters
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
