# Changelog

All notable user-visible changes are recorded here. The project follows
[Semantic Versioning](https://semver.org/) once tagged releases begin.

## [Unreleased]

No changes yet.

## [0.1.0] - 2026-07-16

This version is assembled as an untagged release candidate. Chrome acceptance,
same-extension-ID upgrade evidence, tagging, and publication remain pending.

### Added

- Adapter-proven discussion layouts and post semantics for linear forums,
  article/comment communities, nested Hacker News threads, PTT reactions,
  4chan imageboards, and Stack Overflow Q&A. Scores and accepted-answer state
  have deterministic fixture evidence; exact-package Chrome evidence remains
  pending.
- A bounded presentation layer and immersive archetype renderers that preserve
  every post, flatten unsafe relationships, cap visual indentation, and keep all
  rich content on the established sanitizer path.
- Manifest V3 extension shell with an on-demand content script, compact
  on-page launcher, immersive reader, and secondary local-library side panel.
- Discussion-aware reading mode with allowlist sanitization of untrusted forum
  HTML.
- OP/staff highlighting, local read history, saved posts, private author notes,
  and Markdown export.
- Generic, Discourse, and Hacker News extractors with deterministic fixtures.
- A narrowly detected phpBB 3.3 stock prosilver topic-page extractor with a
  synthetic offline fixture. Live-site and custom-theme verification remain
  pending.
- A narrowly detected XenForo 2.3 default public thread-view extractor with
  synthetic offline fixture tests and a 2026-07-16 read-only structural
  comparison against official normal, question, and article thread pages.
  Packaged-extension and live extraction verification remain pending.
- A narrowly detected stock/classic vBulletin 4.x showthread extractor with
  synthetic offline 4.2.5 fixture tests for legacy/EOL compatibility. It does
  not infer OP; branding-free, customized, localized, other-major, and live
  browser behavior remain unverified.
- A narrowly detected Nairaland topic extractor with synthetic offline tests
  for paired post metadata/body rows, explicit OP/moderator markers, missing
  fields, and false-positive rejection. Live-site, pagination, and packaged
  browser behavior remain unverified.
- A narrowly detected PTT article extractor with synthetic offline tests for
  Chinese metadata, article/footer isolation, flat push replies, missing fields,
  and false-positive rejection. Live-site, pagination, and packaged-browser
  behavior remain unverified.
- A narrowly detected 4chan thread extractor with synthetic offline tests for
  numeric post coherence, attachment links without media loading, explicit
  capcodes, flat quote relationships, missing fields, and index/lookalike
  rejection. Live-site and packaged-browser behavior remain unverified.
- A narrowly detected Arca article extractor with synthetic offline tests for
  Korean metadata, canonical IDs, nested comments, manager roles, deleted
  comments, media-only placeholders, and false-positive rejection. A
  2026-07-16 read-only command-line extraction succeeded on one public article;
  packaged-browser behavior remains unverified.
- A narrowly detected DC Inside gallery-article extractor with synthetic
  offline tests for Korean metadata, coherent numeric IDs, anonymous identity,
  already-rendered comments and replies, deleted comments, media-only
  placeholders, and false-positive rejection. A 2026-07-16 read-only
  command-line extraction succeeded on one public article; its static response
  contained no rendered comments, so rendered-comment and packaged-browser
  behavior remain unverified.
- A narrowly detected FMKorea article extractor with synthetic offline tests
  for coherent document IDs, Korean metadata, exact member-ID OP matching,
  current-page comments, explicit reply-parent links, deleted comments,
  media-only placeholders, and false-positive rejection. On 2026-07-16, the
  exact source extracted one rendered public page in an isolated in-app browser;
  packaged-extension and Chrome behavior remain unverified.
- A narrowly detected Stack Overflow question extractor with synthetic offline
  tests for coherent question, answer, comment, parent, permalink, and user IDs;
  code-rich content; OP matching; deleted comments; media-only placeholders;
  and false-positive rejection. On 2026-07-16, the exact source extracted one
  rendered public question in an isolated in-app browser; packaged-extension and
  Chrome behavior remain unverified.
- Local-first storage contracts and a `chrome.storage.local` implementation.
- Storage schema 1 with marker-last, retry-safe adoption of existing unversioned
  read history, saved posts, and private notes, plus cross-panel clear generation
  guards.
- A confirmed **Clear local user data** control with scoped deletion, partial
  failure messaging, and reset of rendered local state.
- Canonical `pnpm verify` gate, manifest/privacy guardrails, deterministic
  extension packaging, checksum generation, and release automation.
- Reviewed 16, 32, 48, and 128 pixel PNG icons for extension, toolbar,
  management-page, and store use.
- Maintainer, compatibility, testing, privacy, governance, and project-health
  documentation.

### Security

- Validate complete extraction-response payloads before extension views consume
  content-script messages, and validate requests that cross between the page
  reader and service worker.
- Isolate the on-page interface in a closed shadow root without remote styles,
  fonts, images, or other assets.
- Enforce the reviewed manifest permission set and absence of host permissions
  and always-on content scripts.
- Fail closed on invalid or newer local-storage versions and restrict bulk
  deletion to centrally registered ForumForge keys.

### Changed

- Keep the edge launcher fully inside the viewport as a compact 32 by 68 pixel
  control instead of exposing only a narrow slice of its target.
- Keep Refresh, Local library, and Return to forum reachable in narrow reader
  layouts, propagate the source page language, use readable English/CJK line
  measures, and honor reduced-motion preferences for programmatic scrolling.
- Restore keyboard focus after a clear in another panel disables or hides the
  active local-data control.
- Keep every panel's writes blocked when the initial clear-state guard write
  fails, without deleting user data, until a confirmed retry succeeds.
- Bind extraction messages to the injected document and discard results if the
  active tab or URL changes before local state is read or written.
- Assign deterministic collision-safe ids when pages repeat post ids, and
  reject any duplicate-id extraction payload that crosses the message boundary.
- Reflow primary controls, post metadata, and long labels without horizontal
  overflow in narrow side panels at 200% browser scaling.
- Make the toolbar open a full-window reading experience in the current page,
  with thread overview, conversation navigation, local reading tools, focus
  containment, and a slim edge launcher for reopening or closing it.
- Keep desktop reader actions in one compact top-bar row and remove the edge
  launcher from the reading surface until the reader closes.
- Keep the reader focus loop on controls that remain rendered after responsive
  desktop-only sections collapse.
- Keep saves and notes fail-closed in the page reader while local data is being
  cleared, including when an earlier write finishes during the clear.
- Refresh the side panel with clearer action hierarchy, card-based reading,
  explicit light/dark colors, visible keyboard focus, and structured empty and
  status states as a compact library and privacy companion.
- Build release ZIPs without source maps or source-map references and verify
  every manifest icon is present in the deterministic package.

[Unreleased]: https://github.com/erichuang1425/ForumForge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/erichuang1425/ForumForge/releases/tag/v0.1.0
