# Clean reading mode renders contentHtml through a hand-rolled allowlist sanitizer (no runtime deps)

**Type:** confirmed-approach
**Date:** 2026-06-15

Phase 1 "clean reading mode" landed as `apps/extension/src/sanitize.ts`. How and
why, so a future session doesn't re-litigate it:

- **Build-up allowlist, not tear-down.** `sanitizeFragment` rebuilds a fresh tree
  containing ONLY allowlisted semantic tags and copies no attributes except a
  sanitized `href` on `<a>` (plus `target=_blank` / `rel=noopener noreferrer
  nofollow` that we add). Disallowed wrappers (`div`, `span`, `font`, …) are
  unwrapped (children kept); script/style/embeds/media/form controls are dropped
  with their subtree (`DROP_WITH_CONTENT`). Anything not explicitly allowed is
  gone — so on* handlers, `style`, `class`, `id`, unsafe URL schemes can't survive.
- **Images are dropped by default** (privacy: no third-party requests). Opt-in
  image handling is a later clean-reading sub-feature.
- **Relative/fragment links are resolved, then re-checked.** `contentHtml` is raw
  `innerHTML`, so its hrefs are unresolved (unlike `permalink`/`links`). The
  parser now exposes the page base as `ExtractedThread.baseUrl`; the sanitizer
  resolves relative hrefs against it (when given) *before* applying the scheme
  allowlist — resolution never widens what's safe (a resolved `javascript:` URL
  still fails). Without a base, relative links are dropped as before.
- **Inert parsing via `<template>`.** `sanitizeHtml` sets `template.innerHTML`;
  `<template>.content` lives in a document with no browsing context, so nothing
  executes or loads during parse. `document.implementation.createHTMLDocument` was
  rejected — **linkedom (the test DOM) doesn't implement it**, but it does support
  `<template>.content`. Also: no `Node` global in tests, so use numeric nodeType
  (1/3); and **linkedom `DocumentFragment.textContent` doesn't aggregate child
  text** — append the fragment into an element and check the element's textContent
  (render.ts falls back to plain text when the sanitized body has no visible text).
- **Why hand-rolled, not DOMPurify.** Deliberate, with the maintainer's sign-off:
  keep the extension's zero-runtime-dependency stance, and clean reading mode wants
  a small normalized allowlist anyway. The trade-off accepted is that `sanitize.ts`
  is security-critical code we own — so the security boundary (`sanitizeFragment`)
  is a pure function with exhaustive XSS unit tests (`test/sanitize.test.ts`).
- **Sanitize at render time, in the panel** (trusted context), not in the content
  script — `contentHtml` crosses the untrusted page→panel message boundary first.
