# Testing ForumForge

ForumForge uses two evidence layers: deterministic automated checks and manual
browser acceptance. Record what actually ran; do not use a source-level test to
claim packaged browser behavior.

## Automated gate

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` performs type checking, all unit/fixture tests, extension
bundling, repository-boundary checks, version synchronization, local Markdown
link checks, and build-output verification.

Before release, also create the exact user artifact:

```bash
pnpm package:extension
```

This creates a deterministic, source-map-free ZIP and SHA-256 file in
`artifacts/`. Test that ZIP after extracting it to a clean directory.

## Manual browser matrix

Use Chrome stable 116 or newer. Record the browser version, operating system,
ForumForge commit/version, test date, page URL or fixture class, and result. Use
a clean profile for install testing and an existing profile for upgrade testing.

### Install and invocation

- [ ] Final ZIP extracts and loads with no manifest or service-worker error.
- [ ] Install requests no host access.
- [ ] Toolbar action opens a panel for the intended tab.
- [ ] A normal forum page can be read only after the user invokes ForumForge.
- [ ] Restricted pages such as `chrome://`, the Web Store, and the PDF viewer
      fail with a useful message.
- [ ] Switching or navigating tabs does not render data from the wrong tab.

### Extraction

- [ ] Discourse: title, OP/staff roles, timestamps, permalinks, quotes, code,
      lists, links, and missing/deleted fields.
- [ ] Hacker News: normal item, Ask HN self-post, nested replies, dead/deleted
      comments, and an item with no comments.
- [ ] Hacker News non-item pages do not select the Hacker News extractor.
- [ ] Generic forum: representative old layout, sparse markup, missing fields,
      duplicate/missing IDs, and no-post page.
- [ ] Paginated and lazy-loaded limitations are recorded rather than hidden.

### Features and persistence

- [ ] First visit, unchanged revisit, and appended-post behavior for “new”
      markers.
- [ ] Save/un-save persists after restart and isolates identical post IDs from
      different threads.
- [ ] Notes follow an author on the same origin, do not cross origins, and can be
      cleared.
- [ ] Markdown export handles Unicode, escaping, safe permalinks, empty content,
      and multiple threads.
- [ ] Existing local data survives an update from the previous supported build.

### Security and privacy

- [ ] Scripts, styles, handlers, frames, embeds, forms, images, and unsafe URL
      schemes do not survive rendered post HTML.
- [ ] Safe HTTPS, HTTP, mailto, relative, and fragment links behave as documented
      and open with `noopener noreferrer`.
- [ ] DevTools Network shows no ForumForge-initiated request during read, save,
      note, revisit, and export flows.
- [ ] `chrome.storage.local` contains only the record types documented in
      [PRIVACY.md](PRIVACY.md).

### Accessibility and layout

- [ ] Core controls work with keyboard only and retain visible focus.
- [ ] Labels and expanded/pressed states are announced sensibly.
- [ ] Content remains usable at 200% zoom and in narrow/wide side panels.
- [ ] Long code blocks, tables, links, and notes do not hide controls.

## Evidence record

Copy this table into the release issue or pull request:

| Date | Build/commit | Browser + OS | Scenario | Result | Evidence/notes |
| --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | v0.1.0 / SHA | Chrome 000 / OS | Discourse smoke | Pass/Fail | Link or concise notes |
