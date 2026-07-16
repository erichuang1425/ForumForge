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

The storage lifecycle suite deterministically covers:

- the unversioned schema-0 baseline migrating to schema 1 with every legacy key
  and value preserved;
- a current-version no-op, invalid metadata, and a newer unsupported version;
- an interrupted version-marker write followed by a successful retry;
- allowlisted clearing, lookalike/unrelated-key preservation, idempotency,
  partial remove/finalization failure, failed-state blocking, and retry;
- serialization between two coordinators sharing an in-flight feature write and
  clear, rejection of work started or queued across odd/even clear epochs, and
  explicit recovery from newer/invalid schema or generation metadata;
- confirmation cancel/success/failure orchestration, semantic status/control
  markup, persistence-control disabling, and rendered new/saved/note reset.

These tests use injected storage and DOM implementations. They do not prove
Chrome update, persistence, focus, or assistive-technology behavior.

The semantic presentation suite also deterministically covers all six reader
layouts, adapter-proven post kinds, PTT reaction directions, Stack Overflow
scores/accepted state, missing and malformed parent relationships, four-level
visual indentation capping, source-order jump targets, reduced-motion scroll
selection, language propagation, and sanitizer reuse. These component tests do
not prove visual appearance, browser reflow, zoom, or packaged behavior.

Before release, also create the exact user artifact:

```bash
pnpm package:extension
```

This creates a deterministic, source-map-free ZIP and SHA-256 file in
`artifacts/`. Test that ZIP after extracting it to a clean directory.

## Local visual preview

For repeatable layout review before packaging:

```bash
pnpm preview:build
pnpm preview:serve
```

The loopback-only page at `http://127.0.0.1:47831/` uses the real on-page reader
with bounded synthetic stories for eight reviewed site renderers and all six
discussion layouts. It writes no extension storage, loads no remote assets, and
is kept under ignored `tmp/reader-preview/`. The repository checker scans its
TypeScript for prohibited network/code-execution APIs and its HTML for remote
resources, active embeds, and inline handlers.

Record preview findings as component-level visual evidence only. A preview pass
does not satisfy any exact-ZIP, extension installation, active-tab injection,
live-site compatibility, Chrome persistence, network-panel, zoom, or assistive-
technology row below.

## Manual browser matrix

Use Chrome stable 116 or newer. Record the browser version, operating system,
ForumForge commit/version, test date, page URL or fixture class, and result. Use
a clean profile for install testing and an existing profile for upgrade testing.

### Install and invocation

- [ ] Final ZIP extracts and loads with no manifest or service-worker error.
- [ ] Install requests no host access.
- [ ] Toolbar action injects only the intended top-frame document and opens the
      immersive reader for that page.
- [ ] Before invocation there is no ForumForge host in the page. Closing the
      reader restores the original page and leaves only the slim edge launcher.
- [ ] The launcher reopens and closes the reader without duplicating hosts,
      even after repeated toolbar invocation.
- [ ] **Local library** opens the secondary side panel for the intended tab.
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
- [ ] phpBB 3.3 stock prosilver topic: title, numeric post IDs, authors,
      timestamps, profile links, permalinks, body links, explicit English staff
      ranks, missing fields, and no display-order OP inference.
- [ ] phpBB forum indexes and unrelated lookalike pages do not select the phpBB
      extractor; the first visible author is never inferred to be the OP because
      phpBB display order and direct-post views can hide the true topic start.
- [ ] XenForo 2.3 default public normal, question, and article thread views:
      title, numeric post IDs, authors, timestamps, profile links, permalinks,
      body links, article-profile layout, explicit English moderator/admin
      evidence, staff-only non-inference, and missing fields.
- [ ] XenForo forum indexes, unrelated lookalike pages, and mismatched post IDs
      do not select the XenForo extractor. OP remains unset on normal, later-page,
      direct-post, and sorted views because the default markup has no reliable
      OP marker. Record custom themes, localized/custom roles, non-2.3 versions,
      pagination, and lazy loading as pending unless separately observed.
- [ ] vBulletin 4.x stock/classic showthread page, with 4.2.5 as the fixture
      baseline: horizontal and legacy postbits, title, numeric post IDs, authors,
      timestamps, profile links, permalinks, message links, explicit English
      moderator/administrator titles, and missing fields.
- [ ] vBulletin forum indexes, unrelated lookalike pages, other-major generator
      signatures, and mismatched post/permalink IDs do not select the dedicated
      extractor. OP remains unset because stock postbits have no reliable marker.
      Record branding-free installs, customized templates, localized roles,
      other major versions, pagination, and live browser behavior as pending
      unless separately observed.
- [ ] Nairaland topic page: title, numeric post IDs, authors, profile links,
      timestamps, permalinks, body links, explicit `(op)` and `(m)` markers,
      missing fields, and edited-timestamp behavior.
- [ ] Nairaland forum indexes and unrelated compact tables do not select the
      dedicated extractor. Record pagination and any layout that does not pair
      a post metadata row with the next `.narrow` body row as pending.
- [ ] PTT article page: Chinese title/author metadata, OP article, timestamp,
      body links, station/footer exclusion, push direction, push authors and
      timestamps, OP replies, empty pushes, and restart behavior.
- [ ] PTT board indexes and unrelated `.push` lookalikes do not select the
      dedicated extractor. Record pagination, deleted articles, IP/date
      variants, and layouts missing the signed article shell as pending.
- [ ] 4chan dedicated thread page: subject, numeric post IDs, names/tripcodes,
      timestamps, OP, explicit moderator/admin capcodes, quote relationships,
      deleted/empty replies, and attachment filename/link behavior.
- [ ] 4chan board indexes and mismatched-ID lookalikes do not select the
      dedicated extractor. Confirm no attachment image, embed, or other remote
      media is loaded by ForumForge; record archives and board variants as
      pending unless separately observed.
- [ ] Arca article page: Korean title/author metadata, canonical numeric ID,
      timestamp, body links, OP, nested comments, manager roles, deleted
      comments, media-only placeholders, and comment permalinks.
- [ ] Arca channel lists and nonnumeric canonical-link lookalikes do not select
      the dedicated extractor. Confirm remote images, video, emoticons, embeds,
      and avatars are not loaded by ForumForge; record dynamically appended
      comments and channel/authentication variants as pending unless observed.
- [ ] DC Inside gallery article: Korean title/author metadata, coherent numeric
      article ID, timestamp, body links, OP, named and IP-qualified anonymous
      identities, already-rendered comments/replies, deleted comments,
      media-only placeholders, and comment permalinks.
- [ ] DC Inside gallery lists, missing/nonnumeric/conflicting article IDs, and
      mismatched rendered-comment IDs do not select or contaminate the dedicated
      extractor. Confirm ForumForge makes no comment endpoint request and loads
      no remote media; record comments absent from the loaded DOM, gallery
      variants, and authentication states as pending unless observed.
- [ ] FMKorea article page: Korean title/author metadata, coherent numeric
      document and comment IDs, canonical article/comment permalinks, exact
      member-ID OP matching, current-page comments, explicit reply-parent links,
      deleted comments, media-only placeholders, and timestamps.
- [ ] FMKorea board lists, nonnumeric/mismatched document IDs, foreign comment
      wrappers, and mismatched comment permalinks do not select or contaminate
      the dedicated extractor. Confirm ForumForge does not request other comment
      pages or load remote media; record pagination, missing parents, other
      boards/themes, and authentication states as pending unless observed.
- [ ] Stack Overflow question page: title, coherent numeric question/answer and
      comment IDs, share permalinks, exact user-ID OP matching, author profile
      links, timestamps, code/lists/tables/links, answer/comment parents, deleted
      comments, media-only placeholders, signed integer scores, and accepted
      answer state.
- [ ] Stack Overflow question lists, mismatched title/data/element IDs, foreign
      comment wrappers, mismatched share/comment permalinks, and answer parent-ID
      conflicts do not select or contaminate the dedicated extractor. Confirm
      remote media is not loaded by ForumForge; record collapsed comments,
      score/accepted selector variants, other Stack Exchange sites, and login
      states as pending unless observed.
- [ ] F95Zone harmless public thread: establish its exact forum/version/theme
      signature with a sanitized fixture before testing extraction. Do not mark
      this row passed solely because the generic XenForo adapter returns posts.
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
- [ ] The schema-0 to schema-1 procedure below preserves existing local data.

### Schema-0 to schema-1 upgrade

Use pre-schema commit `91fc205` as the first v0.1 baseline. The target is the
exact final release-candidate ZIP and checksum. Keep the same unpacked extension
directory throughout: loading a second directory can produce a different
extension ID and would not test an update of the same local store.

1. Build `91fc205` in a separate worktree, place its unpacked extension files in
   a fixed baseline directory, load that directory, and record the extension ID,
   Chrome/OS version, commit, path, and starting key inventory.
2. Seed read history on at least two threads, save posts whose IDs overlap across
   threads, and create notes for authors on at least two origins. Restart Chrome
   and confirm the baseline data is still present.
3. Extract the target ZIP elsewhere, replace the files inside the same loaded
   baseline directory, use Chrome's **Reload** action, and do not remove/re-add
   the extension.
4. Before creating new data, verify every legacy key/value is unchanged and
   `forumforge:storageSchemaVersion` equals `1`. Before the first clear,
   `forumforge:storageGeneration` may be absent (generation 0); there must be no
   `forumforge:storageClearState`. Confirm unchanged and appended thread
   behavior, saved state/export, notes, and origin/thread isolation.
5. Create a new save and note, restart Chrome, and verify both migrated and new
   data remain correct.

Attach the before/after key inventory and results to
[#14](https://github.com/erichuang1425/ForumForge/issues/14). Until that record
exists, actual Chrome upgrade preservation is **unverified**.

### Clear local user data

- [ ] Seed read history, saves, and notes across multiple threads and origins.
- [ ] Add a non-ForumForge sentinel key in the extension's storage through
      DevTools and record the starting inventory.
- [ ] Reach **Clear local user data…** by keyboard; Cancel preserves every key and
      rendered state.
- [ ] Confirm names the irreversible categories. During deletion, controls are
      disabled and the live status reports progress.
- [ ] Success removes every owned user-data key, preserves the unrelated
      sentinel, retains schema marker `1`, advances the numeric
      `forumforge:storageGeneration` to a new even epoch, removes
      `forumforge:storageClearState`, and updates the live status. Neither
      operational marker contains user data.
- [ ] The visible thread remains readable; New badges, Saved state, note text,
      expanded note editors, and export availability reset. Focus returns to the
      clear button. In another open panel or page reader, focus also moves to a
      valid control if the lifecycle disabled or hid the control that had focus.
- [ ] With ForumForge views open in two Chrome windows, a write already running
      in one finishes before the other clears it. A write started or queued
      across that clear is rejected rather than recreating deleted data. Both
      views disable persistence during deletion and reset stale New/Saved/note
      cues after success.
- [ ] Reading the unchanged page again behaves as a first visit; new saves/notes
      work, and a browser restart does not restore deleted data.
- [ ] A storage-removal failure never reports success. If a safe real-browser
      failure cannot be induced, record that scenario as unverified and cite the
      deterministic injected-failure test instead. After failure,
      `forumforge:storageClearState` reports `failed`, save/note writes remain
      blocked in every panel, and a successful retry removes the state before
      writes resume.

### Security and privacy

- [ ] Scripts, styles, handlers, frames, embeds, forms, images, and unsafe URL
      schemes do not survive rendered post HTML.
- [ ] Safe HTTPS, HTTP, mailto, relative, and fragment links behave as documented
      and open with `noopener noreferrer`.
- [ ] DevTools Network shows no ForumForge-initiated request during read, save,
      note, revisit, and export flows.
- [ ] `chrome.storage.local` contains only the record types documented in the
      [`@forumforge/storage` format](../packages/storage/README.md).

### Accessibility and layout

- [ ] Core controls work with keyboard only and retain visible focus.
- [ ] Labels and expanded/pressed states are announced sensibly.
- [ ] Opening the reader moves focus inside it, Tab/Shift+Tab stay inside, Escape
      closes it, and focus returns to the invoking control or launcher.
- [ ] The underlying forum is not focusable while the reader is open and its
      prior scroll-lock/inert state is restored when the reader closes.
- [ ] The launcher remains discoverable without covering meaningful page
      content at default size, 200% zoom, and narrow viewport widths. Its full
      pointer target remains in the viewport.
- [ ] Content remains usable at 200% zoom in narrow/wide page readers and side
      panels; the three-column reader reflows without horizontal page scrolling.
- [ ] Long code blocks, tables, links, and notes do not hide controls.
- [ ] Refresh, Local library, and Return to forum remain reachable at 320 CSS
      pixels and during 200% zoom/reflow.
- [ ] Linear, article/comment, nested, PTT, imageboard, and Q&A fixtures each
      render every source post once with the intended grouping and no page-level
      horizontal scrolling.
- [ ] Push/Boo/Neutral, accepted answer, score, role, saved, and new states have
      readable text and do not rely on color alone.
- [ ] Deep nested replies cap visual indentation without hiding content; missing,
      self, and forward parents flatten safely.
- [ ] English prose stays near a 60–75 character measure; Korean and Traditional
      Chinese examples remain comfortably readable without forced horizontal
      scrolling.
- [ ] With reduced motion enabled, opening/closing has no meaningful animation
      and jump controls do not invoke smooth programmatic scrolling.

## Evidence record

Copy this table into the release issue or pull request:

| Date | Baseline -> target | Artifact / extension ID | Browser + OS | Scenario | Result | Evidence/notes |
| --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | `91fc205` -> target SHA | ZIP SHA-256 / ID | Chrome 000 / OS | Schema 0 -> 1 upgrade | Pass/Fail | Before/after keys + link |

### Current local candidate evidence

These rows are narrower than release acceptance. They do not mark any manual
matrix checkbox complete and must not be used as substitutes for testing the
exact ZIP in Chrome.

| Date | Source | Artifact / environment | Scenario | Result | Evidence/notes |
| --- | --- | --- | --- | --- | --- |
| 2026-07-16 | Extension source `c20c8ed`, version `0.1.0` | `forumforge-0.1.0-chrome.zip`; SHA-256 `4a797bbb5c1413b5931706288aff51d1583cc74fe21c62165b20e178c8d5326b` | Package twice from the same clean source; compare hashes; inspect the ZIP entry allowlist, manifest permissions, source-map references, and bundled network/eval/storage-sync API patterns | Pass for deterministic structure only | Both hashes matched. The ZIP contained the five runtime files plus `icons/icon-{16,32,48,128}.png`; permissions were exactly `activeTab`, `scripting`, `sidePanel`, and `storage`. No host permissions, optional permissions, declared content scripts, source-map references, or scanned runtime API patterns were present. The ZIP was not loaded in Chrome. |
| 2026-07-16 | Reader source `9b721fa`, version `0.1.0` | Temporary synthetic local page in an isolated in-app browser; browser version unavailable; Microsoft Windows 10.0.26200 x64 | Closed launcher and open reader at 1280 x 720 and 600 x 900 | Pass for observed visual layout only | The real reader component and stylesheet showed a mostly hidden edge launcher, compact desktop top bar, no launcher over the open reader, and a usable single-column narrow layout without reader-level horizontal overflow. The temporary page and generated bundle were removed. This was not packaged-extension evidence; the browser surface could not target controls inside the closed shadow root, so keyboard/focus behavior, 200% zoom, persistence, and network behavior remain pending. |
