# Compatibility

Compatibility claims require either deterministic fixture evidence or a dated
manual test. “Builds successfully” is not equivalent to “works on a live site.”

Last updated: 2026-07-16

## Browsers

| Browser | Status | Evidence |
| --- | --- | --- |
| Chrome 116+ | Development target | MV3 bundle and manifest checks; `sidePanel.open()` requires 116; release browser matrix pending |
| Chromium-based Edge | Expected but unverified | No dated manual evidence yet |
| Firefox | Unsupported | Current code depends on Chrome Side Panel APIs |
| Safari | Unsupported | No Safari extension packaging or test path |

## Forum targets

| Target | Extractor | Automated evidence | Known limits |
| --- | --- | --- | --- |
| Discourse topic pages | Dedicated | Sanitized representative fixture | Live markup, lazy loading, login states, and pagination need release testing |
| Hacker News item pages | Dedicated | Thread and Ask HN fixtures; non-item detection tests | Only item pages; deleted/dead variants need browser evidence |
| phpBB 3.3 topic pages using stock prosilver markup | Dedicated | Synthetic topic fixture; missing-field, English staff-rank, OP non-inference, and false-positive detection tests | No dated packaged-browser or live-site evidence; custom themes, localized/custom ranks, other versions, and pagination remain unverified |
| XenForo 2.3 default public thread views | Dedicated | Synthetic offline fixture tests covering extraction, alternate article profiles, detection, missing fields, explicit English moderator/administrator evidence, staff-only non-inference, and OP non-inference | No packaged-extension or live extraction success; custom themes, localized/custom roles, non-2.3 versions, pagination, and lazy loading remain unverified; OP is intentionally unset without a reliable marker |
| vBulletin 4.x stock/classic showthread pages | Dedicated | Synthetic offline 4.2.5 fixture tests covering horizontal and legacy postbits, extraction, missing fields, explicit English moderator/administrator titles, staff-only non-inference, OP non-inference, other-major rejection, and false-positive detection | Legacy/EOL compatibility only; no packaged-extension or live browser evidence; branding-free installs, customized templates, localized roles, other major versions, and pagination remain unverified; OP is intentionally unset |
| Nairaland topic pages using paired metadata/body rows | Dedicated | Synthetic offline fixture tests covering numeric post IDs, authors, timestamps, body links, explicit `(op)`/`(m)` roles, missing fields, and false-positive detection | No packaged-extension or live-site evidence; current live markup, pagination, edited timestamps, and layout variants remain unverified |
| PTT article pages using the article metadata and push-reply shell | Dedicated | Synthetic offline fixture tests covering Chinese metadata, article/footer isolation, push direction, authors, timestamps, body links, OP matching, empty replies, and false-positive detection | No packaged-extension or live-site evidence; current live markup, pagination, deleted content, IP/date variants, and layout variants remain unverified |
| 4chan dedicated thread pages using coherent numeric post markup | Dedicated | Synthetic offline fixture tests covering subject, post IDs, authors/tripcodes, timestamps, explicit capcodes, local quote parents, deleted/empty replies, inert attachment links, index rejection, and mismatched-ID rejection | No packaged-extension or live-site evidence; current live markup, archived/deleted threads, board-specific variants, media, embeds, and moderation states remain unverified; attachment media is not rendered or loaded |
| Arca article pages using the canonical board-article wrapper | Dedicated | Synthetic offline fixture tests covering Korean metadata, canonical numeric IDs, authors, timestamps, nested comments, OP matching, manager roles, deleted comments, media-only placeholders, and false-positive detection; 2026-07-16 read-only command-line extraction on one public article detected and extracted five numeric posts through depth 2 | No packaged-extension or Chrome evidence; other channels, authentication states, dynamically appended comments, deleted/blocked pages, pagination, embeds, and media remain unverified; remote media is not rendered |
| DC Inside gallery articles using the current gallery-view shell | Dedicated | Synthetic offline fixture tests covering Korean metadata, coherent numeric IDs, named and IP-qualified anonymous identities, already-rendered comments/replies, OP matching, deleted comments, media-only placeholders, and false-positive detection; 2026-07-16 read-only command-line extraction on one public article detected and extracted its article | The static public response contained no rendered comments; no packaged-extension or Chrome evidence; dynamically loaded comments, gallery variants, authentication states, deleted/blocked pages, pagination, embeds, and media remain unverified; remote media is not rendered |
| FMKorea article pages using the current rendered `rd`/`fdb` shell | Dedicated | Synthetic offline fixture tests covering Korean metadata, coherent numeric document/comment/permalink IDs, exact member-ID OP matching, current-page comments, explicit reply-parent links, deleted comments, media-only placeholders, missing parents, and false-positive detection; 2026-07-16 exact-source extraction inside one isolated rendered public page produced 51 unique numeric posts, including 30 replies through depth 2 | No packaged-extension or Chrome evidence; the browser version was unavailable; only one public article and one of its paginated comment pages were observed; other boards/themes, authentication states, deleted/blocked pages, other comment pages, embeds, and media remain unverified; ForumForge does not crawl pagination or load remote media |
| Stack Overflow question pages using the current question/answer/comment shell | Dedicated | Synthetic offline fixture tests covering coherent numeric question/answer/comment identities, parent and share-permalink validation, exact user-ID OP matching, question/answer/comment hierarchy, timestamps, code-rich bodies, deleted comments, media-only placeholders, and false-positive detection; 2026-07-16 exact-source extraction inside one isolated rendered public question produced 32 unique numeric posts: one question, 26 answers, and five loaded comments | No packaged-extension or Chrome evidence; the browser version was unavailable; only one public question was observed; collapsed/lazy comments were not expanded, accepted status is not represented by the current post model, and other Stack Exchange sites, deleted/closed pages, authentication states, embeds, and media remain unverified; remote media is not rendered |
| F95Zone threads | Not claimed | No sanitized site fixture or dated public-page extraction evidence | Automated public-page inspection was unavailable on 2026-07-16. F95Zone may expose XenForo-derived markup, but the existing XenForo 2.3 default-theme row is not evidence for its custom site. A sanitized maintainer-supplied fixture and real-browser run are required before claiming support. |
| Other forums | Generic fallback | Representative generic fixture | Accuracy varies; pagination and custom DOM often need a dedicated adapter |

The phpBB row is evidence for the tested stock prosilver DOM contract only. It
is not a claim of broad phpBB compatibility.

The Nairaland row is evidence only for the synthetic paired-row DOM contract.
The public site rejected/reset the 2026-07-16 command-line markup check and the
isolated in-app browser controller was unavailable, so no live extraction or
selector-level comparison is claimed.

The PTT row is evidence only for the synthetic article-and-push DOM contract.
The public page connection reset during the 2026-07-16 command-line markup check
and the isolated in-app browser controller was unavailable, so no live
extraction or selector-level comparison is claimed.

The 4chan row is evidence only for the synthetic dedicated-thread DOM contract.
The 2026-07-16 direct public-page request did not return usable thread markup and
the isolated in-app browser controller was unavailable, so no live extraction
or selector-level comparison is claimed. ForumForge retains attachment metadata
and safe links, but deliberately does not load or render imageboard media.

The Arca row combines a synthetic, anonymized fixture with a 2026-07-16
read-only command-line extraction against one public article. The check returned
HTTP 200, selected the dedicated adapter, extracted five numeric posts with a
maximum depth of 2, found a title, and emitted no remote media URL through the
post-link field. No title, author, or body text was printed or retained. This is
current selector/extraction evidence, not packaged-extension, Chrome, or visual
evidence. Media remains represented only by local placeholder text when a body
has no readable text; the established sanitizer drops remote media elements.

The DC Inside row combines a synthetic, anonymized fixture with a 2026-07-16
read-only command-line extraction against one public gallery article. The check
returned HTTP 200, selected the dedicated adapter, and extracted one article
with a numeric ID, title, known author, timestamp, and readable body. The static
response contained no loaded comments. Comment selectors were compared with
the site's first-party `comment.js` rendering template, but ForumForge was not
run after that script populated a live page. No title, author, or body text was
printed or retained. This is current article selector/extraction evidence, not
rendered-comment, packaged-extension, Chrome, or visual evidence.

The FMKorea row combines a synthetic, anonymized fixture with a 2026-07-16
read-only extraction inside one isolated in-app browser page. The exact local
source selected the dedicated adapter and extracted the article plus the 50
comments present on comment page 4: all 51 post IDs were unique and numeric, all
51 posts had an author and timestamp, and 30 explicit reply links resolved to a
loaded parent at depth 2. The article permalink was coherent. One source body
contained media markup; this remains untrusted input and the established reader
sanitizer drops remote media elements. No public page content was copied into
the repository or retained as a fixture. This is rendered-DOM selector and
extraction evidence, not packaged-extension, Chrome, visual, persistence, or
network evidence. The isolated browser did not expose a version string.

The Stack Overflow row combines a synthetic, anonymized fixture with a
2026-07-16 read-only extraction inside one isolated in-app browser question.
The exact local source selected the dedicated adapter and extracted the question,
all 26 loaded answers, and five loaded comments. All 32 IDs were unique and
numeric; every post had an author and timestamp; answers and comments retained
their observed parents; and 25 bodies retained code markup. Six source bodies
contained media markup, which remains untrusted input and is dropped by the
established reader sanitizer. Collapsed comments were not expanded. No public
page content was copied into the repository or retained as a fixture. This is
rendered-DOM selector and extraction evidence, not packaged-extension, Chrome,
visual, persistence, or network evidence. The isolated browser did not expose a
version string.

F95Zone could not be inspected in the available public-page tools on
2026-07-16. The available isolated browser denied navigation, and no alternate
automation route was used. A generic or XenForo fallback may produce
some output, but that is not a compatibility claim. The next safe evidence is a
small sanitized fixture supplied by a maintainer who can access a harmless
public thread, followed by the packaged-extension browser matrix.

On 2026-07-16, the XenForo comparison checked public DOM structure for official
normal, question, and article thread pages on `xenforo.com/community` without
running ForumForge extraction or retaining page content. It is structural
evidence only, not packaged-extension or live extraction evidence. The default
XenForo 2.3 public markup does not expose a reliable OP marker, so the extractor
does not infer OP from display order.

The vBulletin row covers only the stock/classic vBulletin 4.x DOM contract
represented by the synthetic 4.2.5 fixture. Its postbit structure was compared
on 2026-07-16 with the official
[postbit manual](https://www.vbulletin.com/docs/html/main/stylevars_postbit) and
[vBulletin 4 support-template excerpt](https://forum.vbulletin.com/forum/vbulletin-4/vbulletin-4-questions-problems-and-troubleshooting/359755-how-can-i-remove-ads-in-postbit-from-specific-forums);
the extractor was not run on a live vBulletin 4 installation. The vendor marks
[vBulletin 4.2.5 as end of life](https://forum.vbulletin.com/forum/vbulletin-4/vbulletin-4-questions-problems-and-troubleshooting/4383927-vbulletin-4-x-publishing-suite-end-of-life);
compatibility here does not imply that operating unmaintained software is safe.
Dedicated detection requires the vBulletin 4
generator signature, so branding-free and customized installations remain
outside the verified contract. Stock postbits expose no reliable OP marker, so
the extractor does not infer OP from display order.

ForumForge currently extracts the DOM loaded in the active tab. It does not crawl
additional pages, expand every lazy-loaded post, or bypass a login/access
boundary. Read-history behavior can therefore be page-specific on paginated
threads.

## Local-data upgrades

| Upgrade | Automated evidence | Browser evidence |
| --- | --- | --- |
| Unversioned schema 0 -> schema 1 | Legacy keys/values preserved; interrupted marker write retries; invalid/newer versions fail closed | Pending same-extension-ID Chrome test against the final ZIP |
| Clear local user data | Scoped/idempotent deletion, cross-panel generation/state blocking, partial failure/retry, and rendered-state reset | Pending keyboard, persistence, two-window, and actual `chrome.storage.local` test |

Until the pending rows are recorded through
[TESTING.md](TESTING.md), ForumForge does not claim that a packaged Chrome update
or deletion flow has been manually verified.

## Updating this document

Every compatibility claim should include:

- date, browser/OS, ForumForge commit/version, and page type;
- whether evidence came from a fixture, unpacked build, or final ZIP;
- what passed, what failed, and any limitation users would notice.

Attach evidence to the relevant issue or release record and update this table
when a regression or new target is confirmed.
