# @forumforge/extension

The ForumForge **browser extension** — a Manifest V3 app that turns the thread on
the current page into a clean, readable list in a side panel. It is the Phase 0
shell that later features (clean reading mode, OP highlighting, notes, saved
posts) build on.

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
- **`src/render.ts`** — builds the read-only view. It writes only `textContent`,
  never `innerHTML`, so untrusted page content can't inject markup (see
  [SECURITY.md](../../SECURITY.md)). Rich `contentHtml` rendering with
  sanitization is Phase 1.
- **`src/messaging.ts`** — the typed message protocol, validated with type guards
  because messages cross the untrusted page boundary.

## Permissions

Narrow by design (see [docs/PRIVACY.md](../../docs/PRIVACY.md)): `activeTab` and
`scripting` so the content script runs **only** on the tab the user invokes
ForumForge on, plus `sidePanel`. No host permissions, no standing access to pages
the user hasn't asked about.

## Develop

From the repo root:

- `pnpm --filter @forumforge/extension build` — bundle into `apps/extension/dist/`
  (esbuild). `pnpm build` builds every package.
- `pnpm --filter @forumforge/extension typecheck`
- `pnpm test` — runs the unit tests (extraction wiring, rendering, messaging).

### Load it in a browser

1. `pnpm --filter @forumforge/extension build`
2. Open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, and
   select `apps/extension/dist/`.
3. Open a forum thread, click the ForumForge toolbar icon to open the panel, then
   **Read this thread**.

> The unit tests and the bundle build are automated; loading the unpacked
> extension and clicking through is a manual step (it needs a real browser).
