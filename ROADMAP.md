# ForumForge Roadmap

A living, phase-by-phase checklist. The full product spec and rationale live in
**[Initial Plan.md](Initial%20Plan.md)** — that document is the source of truth;
this file is the tracking view. Phases are ordered: foundation before features,
features before the adapter ecosystem, AI last and always optional.

> **Status:** Phase 0 in progress. The pnpm/TypeScript workspace is set up, and the
> first two foundation pieces — the core post model and the generic extractor —
> are built and unit-tested. The remaining Phase 0 items are next.

## Phase 0 — Foundation

- [ ] Extension shell
- [ ] Content script
- [ ] Side panel UI
- [x] Core post model — `packages/core` (`ForumForgePost` + helpers)
- [ ] Local storage layer
- [x] Basic generic extractor — `packages/parser` (`extractThreadGeneric`)

## Phase 1 — First useful version

- [ ] Clean reading mode
- [ ] OP highlighting
- [ ] New posts since last visit
- [ ] Save comments
- [ ] Local user notes
- [ ] Markdown export
- [ ] Discourse adapter
- [ ] Hacker News adapter

## Phase 2 — Adapter ecosystem

- [ ] JSON adapter format
- [ ] Adapter validator
- [ ] Adapter import/export
- [ ] Adapter examples
- [ ] phpBB adapter
- [ ] XenForo adapter
- [ ] vBulletin-style adapter
- [ ] Adapter contribution guide

## Phase 3 — Adapter Studio

- [ ] Click-to-select thread title
- [ ] Click-to-select post container
- [ ] Click-to-select author
- [ ] Click-to-select timestamp
- [ ] Click-to-select post body
- [ ] Preview extracted posts
- [ ] Save local adapter
- [ ] Export adapter JSON

## Phase 4 — Intelligence layer

- [ ] Thread map
- [ ] Best-answer detection
- [ ] Unanswered-question detection
- [ ] OP update detection
- [ ] Useful-link extraction
- [ ] Optional summaries
- [ ] Optional local or user-key AI support

## Phase 5 — Community layer

- [ ] Public adapter registry
- [ ] Adapter quality badges
- [ ] Adapter requests
- [ ] Fixture-based adapter tests
- [ ] Community-submitted adapters
- [ ] Broken-adapter reporting

## Possible future features

Not committed — candidates only: cross-device encrypted sync, daily digest for
followed threads, related-thread discovery, personal knowledge-base export
(Obsidian / Notion), local semantic search, forum-specific keyboard shortcuts,
accessibility improvements, community-maintained adapter lists, self-hosted
adapter registry.
