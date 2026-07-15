# Compatibility

Compatibility claims require either deterministic fixture evidence or a dated
manual test. “Builds successfully” is not equivalent to “works on a live site.”

Last updated: 2026-07-15

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
| Other forums | Generic fallback | Representative generic fixture | Accuracy varies; pagination and custom DOM often need a dedicated adapter |

ForumForge currently extracts the DOM loaded in the active tab. It does not crawl
additional pages, expand every lazy-loaded post, or bypass a login/access
boundary. Read-history behavior can therefore be page-specific on paginated
threads.

## Updating this document

Every compatibility claim should include:

- date, browser/OS, ForumForge commit/version, and page type;
- whether evidence came from a fixture, unpacked build, or final ZIP;
- what passed, what failed, and any limitation users would notice.

Attach evidence to the relevant issue or release record and update this table
when a regression or new target is confirmed.
