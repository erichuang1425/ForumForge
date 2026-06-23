# @forumforge/extension

The ForumForge **browser extension** — a Manifest V3 app that turns the thread on
the current page into a clean, readable list in a side panel. It is the Phase 0
shell that later features build on, and it already ships the first Phase 1
features — clean reading mode, OP highlighting, **new posts since last visit**,
**saving useful posts**, and **local user notes**.

It wires together the foundation packages: the active page's DOM →
[`@forumforge/parser`](../../packages/parser) → the
[`@forumforge/core`](../../packages/core) post model → a rendered view.

## How it fits together

```text
toolbar action ─▶ background (service worker) ─▶ opens the side panel
side panel "Read this thread" ─▶ inject content.js (activeTab) ─▶ extract ─▶ render
```

- **`src/background.ts`** — the shell. Makes the toolbar action open the side
  panel; intentionally thin for now.
- **`src/content.ts`** — injected **on demand** into the active tab (never
  declared with broad host matches). Extracts the thread and replies. Injection
  is idempotent.
- **`src/sidepanel.ts`** + **`public/sidepanel.html`** — the panel UI: a button
  that injects the content script, requests extraction, and renders the result.
- **`src/extract.ts`** — the seam that chooses how to read a page. Today it always
  uses the generic parser; a site-specific adapter is selected here later (Phase 2).
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
  Saved posts can be revisited and (later) exported to Markdown. `src/render.ts`
  gives each post a "Save"/"Saved" toggle; `src/sidepanel.ts` wires the click and
  persists the change, so the render stays a pure view.
- **`src/userNotes.ts`** — the **local user notes** feature. The reader can attach
  a private note to an author; the note is keyed per forum *origin* (not per
  thread), so it follows the author across every thread on that site but never
  leaks onto a like-named stranger on another site. `src/render.ts` gives each post
  a "Note" toggle that opens a per-author editor (pre-filled, with a dot cue when
  the author is already annotated); `src/sidepanel.ts` wires saving and keeps every
  post by the same author in sync, so the render stays a pure view.
- **`src/storage.ts`** — `ChromeStorageBackend`, the
  [`@forumforge/storage`](../../packages/storage) `StorageBackend` implemented over
  `chrome.storage.local`. Read history, saved posts, and user notes persist
  on-device through it; nothing leaves the browser.

## Permissions

Narrow by design (see [docs/PRIVACY.md](../../docs/PRIVACY.md)): `activeTab` and
`scripting` so the content script runs **only** on the tab the user invokes
ForumForge on, `sidePanel` for the panel UI, and `storage` to keep per-thread
read history, saved posts, and user notes on-device. No host permissions, no
standing access to pages the user hasn't asked about, and nothing synced
off-device.

## Develop

From the repo root:

- `pnpm --filter @forumforge/extension build` — bundle into `apps/extension/dist/`
  (esbuild). `pnpm build` builds every package.
- `pnpm --filter @forumforge/extension typecheck`
- `pnpm test` — runs the unit tests (extraction wiring, rendering, sanitization,
  messaging, read history, saved posts, user notes, and the chrome.storage backend).

### Load it in a browser

1. `pnpm --filter @forumforge/extension build`
2. Open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, and
   select `apps/extension/dist/`.
3. Open a forum thread, click the ForumForge toolbar icon to open the panel, then
   **Read this thread**.

> The unit tests and the bundle build are automated; loading the unpacked
> extension and clicking through is a manual step (it needs a real browser).
