# ForumForge

**Local-first tools that turn difficult forum threads into a clean reading and
knowledge-saving experience.**

ForumForge is an open-source browser extension and adapter framework. It reads
the forum page the user explicitly opens, renders a clearer side-panel view, and
stores personal reading state on the device.

> Your favorite forum does not need to modernize. ForumForge can modernize it
> from your browser.

> **Development status — 2026-07-16:** Phase 0 and Phase 1 implementation is
> complete on the active development line, and version 0.1.0 is being assembled
> as an untagged release candidate. There is no tagged public release yet.
> Exact-artifact browser acceptance and the remaining v0.1 release checklist
> stay open; see [ROADMAP.md](ROADMAP.md).

## Available in the current source build

- Clean side-panel reading mode with allowlist-sanitized rich text.
- Original-poster, moderator, and administrator highlighting.
- New-since-last-visit tracking stored in `chrome.storage.local`.
- Locally saved posts and private per-author notes.
- Markdown export of saved posts.
- Versioned local storage with deterministic migration tests and a
  confirmation-gated user-data clear control.
- Dedicated Discourse and Hacker News extractors.
- Narrowly detected phpBB 3.3 stock prosilver topic-page extraction, backed by
  a synthetic offline fixture. Live-site and custom-theme evidence is pending.
- A best-effort generic forum extractor as the fallback.
- Fixture-backed automated tests, strict TypeScript checks, and a bundled MV3
  extension build.

## Planned, not shipped

- User-authored JSON adapters, validation, import/export, and an adapter SDK.
- Wider phpBB version/theme coverage plus XenForo and vBulletin-style adapters.
- Adapter Studio, thread maps, best-answer/unanswered detection, and an adapter
  registry.
- Optional AI features. These come last, stay isolated, and are opt-in.

The detailed product boundaries are in
[Initial Plan.md](Initial%20Plan.md). The implementation sequence and release
gates are in [ROADMAP.md](ROADMAP.md).

## Try the development build

Prerequisites: Node 22, Corepack, and Chrome or a Chromium browser with
`sidePanel.open()` (Chrome 116+ is the current declared minimum).

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

Then load the extension:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `apps/extension/dist`.
5. Open a forum thread and click the ForumForge toolbar action.

This is a source build, not a published store release. Please report results
using the [browser test checklist](docs/TESTING.md).

Release-candidate pilots use the safety and feedback instructions in
[docs/PILOT.md](docs/PILOT.md). Store copy and image requirements are maintained
in [docs/STORE_LISTING.md](docs/STORE_LISTING.md).

## Current compatibility

| Target | Automated evidence | Browser evidence |
| --- | --- | --- |
| Chrome/Chromium 116+ | MV3 build and manifest checks | Release matrix pending |
| Discourse threads | Sanitized fixture tests | Live-site matrix pending |
| Hacker News item pages | Sanitized fixture tests | Live-site matrix pending |
| phpBB 3.3 stock prosilver topic pages | Synthetic fixture tests | Live-site and custom-theme testing pending |
| Other forum pages | Generic parser tests | Site-specific results vary |
| Firefox/Safari | None | Not currently supported |

See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) for limitations and the
evidence standard.

## Why adapters

Forums use many different DOM structures. An adapter teaches ForumForge how to
find a thread title, post containers, authors, timestamps, bodies, permalinks,
nesting, and roles. Dedicated extractors currently live in
[`packages/parser`](packages/parser); the declarative JSON adapter runtime is
the next product phase.

Adapter work must be deterministic and respectful: tests use small, anonymized,
offline-safe HTML fixtures rather than repeated live-site requests. See
[docs/ADAPTERS.md](docs/ADAPTERS.md) and
[docs/FIXTURES.md](docs/FIXTURES.md).

## Architecture

```text
apps/extension     Manifest V3 extension and side-panel UI
packages/core      Shared ForumForgePost model and helpers
packages/parser    Generic, Discourse, Hacker News, and phpBB extraction
packages/storage   Local-first storage contracts
scripts            Verification, versioning, and release packaging
docs               Product, contributor, privacy, testing, and release guidance
```

Packages are added only when their phase has real implementation work. The post
model is the shared contract: parsers produce posts; storage and UI consume them.

## Privacy and security

ForumForge has no account, telemetry, analytics, hidden background requests, or
remote processing in the current build. It uses `activeTab` so the user chooses
which page to read, requests no host permissions, sanitizes extracted HTML before
rendering, and stores feature data locally.

ForumForge does not bypass access controls, automate scraping, or republish
restricted content. Read [docs/PRIVACY.md](docs/PRIVACY.md) and
[SECURITY.md](SECURITY.md) before changing permissions, storage, adapters, or
message boundaries.

## Contributing and project health

Contributions are welcome: bug reports, browser-test evidence, sanitized
fixtures, parser fixes, documentation, and focused product improvements.

- [CONTRIBUTING.md](CONTRIBUTING.md) — setup and acceptance criteria
- [SUPPORT.md](SUPPORT.md) — where to ask or report
- [GOVERNANCE.md](GOVERNANCE.md) — decisions and maintainer responsibilities
- [CHANGELOG.md](CHANGELOG.md) — user-visible changes
- [docs/IMPACT.md](docs/IMPACT.md) — evidence-based project health ledger
- [AGENTS.md](AGENTS.md) — instructions for coding agents

## License

[MIT](LICENSE) © 2026 Eric Huang.
