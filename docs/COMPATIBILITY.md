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
| Other forums | Generic fallback | Representative generic fixture | Accuracy varies; pagination and custom DOM often need a dedicated adapter |

The phpBB row is evidence for the tested stock prosilver DOM contract only. It
is not a claim of broad phpBB compatibility.

On 2026-07-16, the XenForo comparison checked public DOM structure for official
normal, question, and article thread pages on `xenforo.com/community` without
running ForumForge extraction or retaining page content. It is structural
evidence only, not packaged-extension or live extraction evidence. The default
XenForo 2.3 public markup does not expose a reliable OP marker, so the extractor
does not infer OP from display order.

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
