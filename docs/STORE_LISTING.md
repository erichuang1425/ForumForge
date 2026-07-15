# Chrome Web Store listing draft

This is the reviewed English listing source for the untagged ForumForge 0.1.0
release candidate. It is not authorization to submit or publish. Replace no
text with stronger compatibility, privacy, or adoption claims unless the final
artifact evidence supports them.

## Listing fields

- **Name:** ForumForge
- **Primary language:** English
- **Category:** Productivity
- **Short description:** Modernize messy forum threads into a clean, readable
  view — local-first, from your own browser.
- **Single purpose:** Turn a forum thread the user explicitly chooses into a
  clearer side-panel reading view, with related reading state stored locally.

### Detailed description

ForumForge turns the forum thread you choose into a cleaner side-panel reading
view. Open a thread, select ForumForge, and choose “Read this thread.” The
extension then extracts the page currently loaded in that tab and organizes its
posts without changing the original site.

Current features:

- a focused thread view with sanitized rich text;
- original-poster and staff labels when the page exposes those roles;
- local new-since-last-visit markers;
- saved posts and private per-author notes;
- Markdown export for saved posts; and
- a confirmed control for clearing ForumForge user data.

ForumForge includes dedicated extraction logic for representative Discourse
and Hacker News thread structures, plus a best-effort generic fallback. Forum
markup varies. Paginated, lazy-loaded, private, or heavily customized pages may
be incomplete or unsupported, and ForumForge does not crawl additional pages or
bypass access controls.

ForumForge is local-first. It has no account, analytics, ads, telemetry, remote
AI, or ForumForge backend. It requests no host permissions and injects its
extractor only after you invoke it on the active tab. Thread read history,
saved-post snapshots, and notes stay in chrome.storage.local in your browser
profile. A Markdown export is a normal downloaded file outside extension
storage. See the privacy notice for the complete data and deletion behavior.

Chrome 116 or newer is required. Firefox and Safari are not supported by this
release.

## Permission explanations

These explanations must match the submitted manifest exactly.

| Permission | Store explanation |
| --- | --- |
| `activeTab` | Temporarily access only the tab where the user invokes ForumForge, so it can read that chosen thread. |
| `scripting` | Inject the packaged extractor into the chosen tab on demand after the user selects **Read this thread**. |
| `sidePanel` | Show the ForumForge reading interface beside the current page. |
| `storage` | Keep read history, saved posts, private author notes, and storage-lifecycle metadata locally in the browser profile. |

The package must continue to declare no host permissions, optional host
permissions, always-on content scripts, externally connectable origins, or
remote code.

## Privacy and support fields

- **Privacy policy:**
  `https://github.com/erichuang1425/ForumForge/blob/main/docs/PRIVACY.md`
- **Support / normal bug reports:**
  `https://github.com/erichuang1425/ForumForge/issues/new/choose`
- **Security reports:** Follow `SECURITY.md`; do not use a public issue.

The store privacy questionnaire must disclose that ForumForge processes website
content and URLs selected by the user, even though processing and storage stay
on the device. It must state that this data is used only for the extension's
thread-reading, save, note, history, export, and deletion features; it is not
sold, transmitted to the maintainer, used for advertising, or used for credit
or lending. Recheck the dashboard's exact questions at submission time rather
than copying an answer from an older form.

## Graphic-asset requirements

Capture assets only from the exact candidate ZIP in an isolated profile after
the corresponding browser scenarios pass. Use synthetic or clearly public
content and remove account names, avatars, bookmarks, profile paths,
notifications, and other personal information. Do not mock product UI or show a
feature that the candidate cannot perform.

The current Chrome Web Store requirements call for:

- the packaged 128×128 PNG icon, with square artwork occupying approximately
  96×96 pixels inside transparent padding;
- at least one and at most five full-bleed screenshots at 1280×800 pixels
  (preferred) or 640×400 pixels;
- one 440×280 PNG or JPEG small promotional tile; and
- an optional 1400×560 marquee promotional tile.

The small promotional tile should use the ForumForge mark and a representative
reading-panel composition, not a raw screenshot, and should remain legible when
reduced by half. Avoid text in the tile so it can serve future locales.

### Screenshot shot list

| Order | Candidate scene | Required truth check |
| --- | --- | --- |
| 1 | ForumForge beside a synthetic generic thread | Exact packaged UI; clear title, authors, timestamps, and readable posts |
| 2 | A representative Discourse fixture/page with rich text and role labels | Sanitized links, quotes, code, and labels actually observed |
| 3 | A representative Hacker News item with nested replies | Actual nesting and missing/deleted-field behavior |
| 4 | Saved state, a non-sensitive sample note, and enabled Markdown export | Persistence confirmed after restart; no private note content |
| 5 | Local-data controls in a narrow or zoomed panel | Keyboard/200% zoom behavior confirmed; no claim that a clear has run if it has not |

Each final asset record should include the candidate commit, ZIP SHA-256,
Chrome/OS version, capture date, source scenario, dimensions, and reviewer.

## Submission blockers

- Exact-artifact Chrome acceptance and same-extension-ID storage upgrade
  evidence are still required.
- Store screenshots and the small promotional tile have not yet been captured.
- The privacy questionnaire needs review against the live submission form.
- Submission, publication, and any rollout require explicit maintainer approval.

Store image dimensions and listing requirements were checked against Chrome's
[listing documentation](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/)
and [image guidance](https://developer.chrome.com/docs/webstore/images/).
