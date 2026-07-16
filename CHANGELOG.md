# Changelog

All notable user-visible changes are recorded here. The project follows
[Semantic Versioning](https://semver.org/) once tagged releases begin.

## [Unreleased]

## [0.1.0] - 2026-07-16

This version is assembled as an untagged release candidate. Chrome acceptance,
same-extension-ID upgrade evidence, tagging, and publication remain pending.

### Added

- Manifest V3 extension shell with an on-demand content script and side panel.
- Clean reading mode with allowlist sanitization of untrusted forum HTML.
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

- Validate complete extraction-response payloads before the side panel consumes
  content-script messages.
- Enforce the reviewed manifest permission set and absence of host permissions
  and always-on content scripts.
- Fail closed on invalid or newer local-storage versions and restrict bulk
  deletion to centrally registered ForumForge keys.

### Changed

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
- Refresh the side panel with clearer action hierarchy, card-based reading,
  explicit light/dark colors, visible keyboard focus, and structured empty and
  status states.
- Build release ZIPs without source maps or source-map references and verify
  every manifest icon is present in the deterministic package.

[Unreleased]: https://github.com/erichuang1425/ForumForge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/erichuang1425/ForumForge/releases/tag/v0.1.0
