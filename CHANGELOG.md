# Changelog

All notable user-visible changes are recorded here. The project follows
[Semantic Versioning](https://semver.org/) once tagged releases begin.

## [Unreleased]

### Added

- Manifest V3 extension shell with an on-demand content script and side panel.
- Clean reading mode with allowlist sanitization of untrusted forum HTML.
- OP/staff highlighting, local read history, saved posts, private author notes,
  and Markdown export.
- Generic, Discourse, and Hacker News extractors with deterministic fixtures.
- Local-first storage contracts and a `chrome.storage.local` implementation.
- Storage schema 1 with marker-last, retry-safe adoption of existing unversioned
  read history, saved posts, and private notes, plus cross-panel clear generation
  guards.
- A confirmed **Clear local user data** control with scoped deletion, partial
  failure messaging, and reset of rendered local state.
- Canonical `pnpm verify` gate, manifest/privacy guardrails, deterministic
  extension packaging, checksum generation, and release automation.
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

[Unreleased]: https://github.com/erichuang1425/ForumForge/commits/main
