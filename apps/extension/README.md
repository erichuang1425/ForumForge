# @forumforge/extension

The ForumForge **browser extension** is a Manifest V3 app that transforms the
thread on the current page into an immersive, publication-like reader. A slim
edge launcher remains available after the reader closes, and the side panel is a
secondary local library for compact reading, exports, and privacy controls. The
current source also includes OP highlighting, **new posts since last visit**,
**saving useful posts**, and **local user notes**.

It wires together the foundation packages: the active page's DOM →
[`@forumforge/parser`](../../packages/parser) → the
[`@forumforge/core`](../../packages/core) post model → a rendered view.

## How it fits together

```text
toolbar action ─▶ background (service worker) ─▶ inject content.js (activeTab)
content script ─▶ extract current page ─▶ mount isolated launcher + reader
edge launcher ◀──────────────▶ immersive reader
reader "Local library" ─▶ background ─▶ opens the secondary side panel
```

- **`src/background.ts`** — the shell. Injects the packaged content script into
  the exact active document after a toolbar click, asks that document to toggle
  the reader, and opens the secondary library only after a validated request.
- **`src/content.ts`** — injected **on demand** into the active tab (never
  declared with broad host matches). Extracts the thread and replies, coordinates
  local state, and mounts one idempotent reader host for the document.
- **`src/pageReader.ts`** + **`src/pageReaderStyles.ts`** — the compact edge
  launcher and full-window reading workspace. The UI lives in a closed shadow
  root, traps focus while open, restores the forum and prior focus when closed,
  and uses only packaged system-font styles and generated marks.
- **`src/sidepanel.ts`** + **`public/sidepanel.html`** — the panel UI: a button
  that can still request and render the current thread, plus saved-post export
  and local-data controls. It is the compact companion rather than the primary
  invocation surface.
- **`src/extract.ts`** — the seam that chooses how to read a page: the
  Discourse, Hacker News, phpBB, XenForo, vBulletin, Nairaland, or PTT adapter
  when the page's own markup signals one, otherwise the generic fallback parser.
  More site-specific adapters land here as they're built (Phase 2 adds the JSON
  adapter format for community-contributed ones).
- **`src/render.ts`** — builds the read-only view. Author, role and timestamp are
  written with `textContent`; the body renders the post's rich `contentHtml`
  through the sanitizer (clean reading mode), falling back to plain text.
  **OP highlighting:** OP / moderator / admin posts get a readable role badge and
  a colored edge (driven by a `data-role` attribute and styled in
  `public/sidepanel.html`); the role is set by the parser and follows the OP
  through the whole thread. The plain "user" role is left unmarked.
- **`src/sanitize.ts`** — the **clean reading mode** sanitizer. Untrusted post
  HTML is parsed inertly and rebuilt from an allowlist of safe, semantic tags and
  attributes, so no script, inline handler, style, embed or unsafe URL survives
  (see [SECURITY.md](../../SECURITY.md)). Relative/fragment links are resolved
  against the thread's source page (`ExtractedThread.baseUrl`) before the scheme
  allowlist, so internal forum links keep working. Images are dropped by default
  to avoid third-party requests.
- **`src/messaging.ts`** — the typed message protocol, validated with type guards
  because messages cross the untrusted page boundary.
- **`src/readHistory.ts`** — the **new posts since last visit** feature. Keyed by
  the thread's page URL (fragment dropped), it remembers which post ids the reader
  has already seen and reports the ones that are new on the next visit; the first
  visit marks nothing. Pure id-diffing logic plus a thin store over a
  `StorageBackend`. `src/render.ts` gives new posts a "New" badge and an edge
  accent (text as well as color).
- **`src/savedPosts.ts`** — the **save comments** feature. The reader can save any
  post; ForumForge keeps a snapshot (content frozen at save time) plus where it
  came from, keyed per thread so the same post id in two threads can't collide.
  Saved posts can be revisited and exported to Markdown (see `src/markdown.ts`).
  `src/render.ts` gives each post a "Save"/"Saved" toggle; `src/content.ts` and
  `src/sidepanel.ts` wire the two views to the same local records, so the render
  stays a pure view.
- **`src/markdown.ts`** — the **Markdown export** feature. A pure function turns
  saved-post snapshots into a clean Markdown note, grouped by source thread, with
  each post's author/role/timestamp, a blockquoted body, and a permalink.
  `src/sidepanel.ts`'s "Export saved" button gathers every saved post and
  downloads the file on-device — no new permissions, nothing leaves the browser.
- **`src/userNotes.ts`** — the **local user notes** feature. The reader can attach
  a private note to an author; the note is keyed per forum *origin* (not per
  thread), so it follows the author across every thread on that site but never
  leaks onto a like-named stranger on another site. `src/render.ts` gives each post
  a "Note" toggle that opens a per-author editor (pre-filled, with a dot cue when
  the author is already annotated); `src/content.ts` and `src/sidepanel.ts` wire
  saving and keep every post by the same author in sync, so the render stays a
  pure view.
- **`src/storage.ts`** — `ChromeStorageBackend`, the
  [`@forumforge/storage`](../../packages/storage) `StorageBackend` implemented over
  `chrome.storage.local`. Read history, saved posts, and user notes persist
  on-device through it; nothing leaves the browser.
- **`src/storageSchema.ts`** — the schema-1 migration and lifecycle coordinator.
  It adopts pre-schema records without rewriting them, blocks invalid/newer
  versions, serializes feature operations and clearing across panel documents
  with an extension-origin Web Lock, and deletes only the central ForumForge key
  allowlist. A persisted clear generation/state rejects queued writes, blocks
  writes after partial failure, and lets a storage-change listener disable or
  reset stale local-state cues in every open panel or page reader.
- **`src/localDataUi.ts`** — confirmation and rendered-state reset helpers for the
  panel's **Clear local user data…** control. The native confirmation names the
  irreversible categories; progress and success/failure text is written to the
  panel's polite live status region. Browser assistive-technology testing remains
  a release gate.

## Permissions

Narrow by design (see [docs/PRIVACY.md](../../docs/PRIVACY.md)): `activeTab` and
`scripting` so the content script runs **only** on the tab the user invokes
ForumForge on, `sidePanel` for the optional local-library UI, and `storage` to
keep per-thread read history, saved posts, and user notes on-device. No host
permissions, no standing access to pages the user hasn't asked about, and
nothing synced off-device. The manifest declares Chrome 116 as the minimum
because the library action uses `sidePanel.open()`.

## Develop

From the repo root:

- `pnpm verify` runs the canonical typecheck, test, build, boundary,
  documentation, and build-output gate.

- `pnpm --filter @forumforge/extension build` — bundle into `apps/extension/dist/`
  (esbuild). `pnpm build` runs `build` in each workspace that defines it.
- `pnpm --filter @forumforge/extension typecheck`
- `pnpm test` — runs the unit tests (extraction wiring, rendering, sanitization,
  messaging, read history, saved posts, user notes, Markdown export, and the
  chrome.storage backend).

### Load it in a browser

1. `pnpm --filter @forumforge/extension build`
2. Open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, and
   select `apps/extension/dist/`.
3. Open a forum thread and click the ForumForge toolbar icon. The immersive
   reader opens in the page. Choose **Return to forum** to leave its slim edge
   launcher available, or choose **Local library** for compact reading, Markdown
   export, and the confirmed **Clear local user data…** flow.

> Automated checks do not prove browser behavior. Follow
> [docs/TESTING.md](../../docs/TESTING.md) and record the exact unpacked or
> packaged build used for manual testing.
