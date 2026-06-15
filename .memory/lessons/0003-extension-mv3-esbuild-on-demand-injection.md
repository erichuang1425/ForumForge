# The extension is MV3, bundled with esbuild, and injects its content script on demand

**Type:** confirmed-approach
**Date:** 2026-06-15

`apps/extension` is the Phase 0 shell + content script + side panel. Key choices
a future session should not have to re-derive:

- **Bundler: esbuild** (root dev dependency). The source-only, no-build pattern
  used by `packages/*` does not work for an extension — the browser can't resolve
  workspace TS imports — so the extension has a real build. `build.mjs` bundles
  `src/{background,content,sidepanel}.ts` into `dist/*.js` and copies
  `manifest.json` + `public/sidepanel.html`. Run `pnpm --filter
  @forumforge/extension build`; `pnpm build` (root) = `pnpm -r build`. CI builds too.
- **All entries are `format: "iife"` (classic scripts), not ESM.** A content
  script injected via `chrome.scripting.executeScript({ files })` runs as a
  classic script, so keep every entry consistent and drop `"type": "module"` from
  the manifest's background.
- **On-demand injection, not a declared content script.** No `content_scripts`
  block and no host permissions. Permissions are `activeTab` + `scripting` +
  `sidePanel`. The side panel injects `content.js` into the active tab on the
  user's click (activeTab grants per-tab access on that gesture). This is the
  privacy-narrow path AGENTS.md wants — ForumForge only ever reads the page the
  user explicitly invoked it on. Injection is made idempotent with a
  `window.__forumforgeContentReady` guard so re-injection doesn't stack listeners.
- **Rendering never uses `innerHTML`.** Author/role/timestamp are written with
  `textContent`. The post body is now rich (Phase 1 clean reading mode): it
  renders sanitized `contentHtml` via `sanitize.ts`, falling back to plain text.
  See lesson 0004 for the sanitizer. (Phase 0 was `textContent`-only; that
  constraint is superseded by the sanitizer — not by raw `innerHTML`.)
- **`extract.ts` is the adapter-selection seam.** The content script imports
  `extractThreadFromDocument`, not the parser directly; site-specific adapter
  selection lands here in Phase 2, with the generic parser as fallback.
- **Minimal WebExtension types**, not `@types/chrome`. `src/webext.d.ts` declares
  only the `chrome.*` surface actually used (keeps deps minimal, stays portable).

**Verifiable vs. not:** the unit tests (messaging guards, extraction wiring,
render incl. XSS-safety) and the esbuild bundle are automated. Loading the
unpacked `dist/` in Chrome and clicking through needs a real browser — that's a
manual step, called out in the app README.
