# ForumForge Roadmap

A living, phase-by-phase checklist. The full product spec and rationale live in
**[Initial Plan.md](Initial%20Plan.md)** — that document is the source of truth;
this file is the tracking view. Phases are ordered: foundation before features,
features before the adapter ecosystem, AI last and always optional.

> **Status:** Phase 0 complete; Phase 1 underway. The foundation — core post
> model, generic extractor, local storage layer — and the `apps/extension` MV3
> shell (background, on-demand content script, side panel) are built, unit-tested,
> and bundled via esbuild. Phase 1 has begun with **clean reading mode** (the side
> panel renders each post's rich `contentHtml` through an allowlist sanitizer),
> **OP highlighting** (OP / mod / admin posts get a readable badge and a colored
> edge so the important voices stand out across the thread), and **new posts
> since last visit** (per-thread read history, persisted on-device via
> `chrome.storage.local`, flags the posts you haven't seen yet), **saved
> comments** (a per-post Save toggle keeps an on-device snapshot of useful posts),
> and **local user notes** (a private, per-author note that follows the author
> across every thread on the forum).

## Phase 0 — Foundation

- [x] Extension shell — `apps/extension` (MV3 manifest + background service worker)
- [x] Content script — `apps/extension` (`content.ts`, injected on demand via `activeTab`)
- [x] Side panel UI — `apps/extension` (`sidepanel.ts` + `renderThread`)
- [x] Core post model — `packages/core` (`ForumForgePost` + helpers)
- [x] Local storage layer — `packages/storage` (`StorageBackend` + in-memory backend + `Collection`)
- [x] Basic generic extractor — `packages/parser` (`extractThreadGeneric`)

## Phase 1 — First useful version

- [x] Clean reading mode — sanitized rich `contentHtml` rendering in the side panel (`apps/extension`)
- [x] OP highlighting — OP / mod / admin posts get a readable badge and a colored edge in the side panel (`apps/extension`)
- [x] New posts since last visit — per-thread read history (on-device via `chrome.storage.local`) flags posts unseen since the last visit (`apps/extension`)
- [x] Save comments — a per-post Save toggle keeps an on-device snapshot of useful posts (`apps/extension`)
- [x] Local user notes — a private, per-author note (scoped on-device per forum origin) shown on every post by that author (`apps/extension`)
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
