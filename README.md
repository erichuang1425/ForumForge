# ForumForge

**Local-first tools that turn difficult forum threads into a clean reading and
knowledge-saving experience.**

ForumForge is an open-source browser extension and adapter framework. It reads
the forum page the user explicitly opens and turns it into an immersive,
publication-like reading view inside that page. A slim edge launcher keeps the
reader close without permanently occupying the screen, while a secondary local
library holds compact reading, exports, and privacy controls.

> Your favorite forum does not need to modernize. ForumForge can modernize it
> from your browser.

> **Development status — 2026-07-16:** Phase 0 and Phase 1 implementation is
> complete on the active development line, and version 0.1.0 is being assembled
> as an untagged release candidate. There is no tagged public release yet.
> Exact-artifact browser acceptance and the remaining v0.1 release checklist
> stay open; see [ROADMAP.md](ROADMAP.md).

## Available in the current source build

- A compact on-page launcher and full-window, forum-native reading mode with
  allowlist-sanitized rich text.
- A secondary side-panel library for compact reading, saved-post export, and
  local-data controls.
- Original-poster, moderator, and administrator highlighting.
- New-since-last-visit tracking stored in `chrome.storage.local`.
- Locally saved posts and private per-author notes.
- Markdown export of saved posts.
- Versioned local storage with deterministic migration tests and a
  confirmation-gated user-data clear control.
- Dedicated Discourse and Hacker News extractors.
- Narrowly detected phpBB 3.3 stock prosilver topic-page extraction, backed by
  a synthetic offline fixture. Live-site and custom-theme evidence is pending.
- Narrowly detected XenForo 2.3 default public thread-view extraction, backed
  by synthetic offline fixture tests and a 2026-07-16 read-only structural
  comparison with official normal, question, and article thread pages. No
  packaged-extension or live extraction success has been recorded.
- Narrowly detected stock/classic vBulletin 4.x showthread extraction, backed
  only by synthetic offline vBulletin 4.2.5 fixture tests. This is legacy/EOL
  compatibility: branding-free, customized, localized, other-major, and live
  browser behavior remain pending, and OP is not inferred.
- A best-effort generic forum extractor as the fallback.
- Fixture-backed automated tests, strict TypeScript checks, and a bundled MV3
  extension build.

## Planned, not shipped

- User-authored JSON adapters, validation, import/export, an adapter SDK, and
  declarative migration of the bundled hand-written extractors.
- Wider phpBB and vBulletin version/theme coverage.
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
5. Open a forum thread and click the ForumForge toolbar action. The immersive
   reader opens in the page; close it to leave the slim launcher available for
   the rest of the visit. Use **Local library** for the compact companion panel.

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
| XenForo 2.3 default public thread views | Synthetic offline fixture tests | 2026-07-16 read-only official normal/question/article markup comparison; no packaged-extension or live extraction success |
| vBulletin 4.x stock/classic showthread pages | Synthetic offline 4.2.5 fixture tests | No packaged-extension or live browser evidence |
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
apps/extension     Manifest V3 extension, on-page reader, and local-library panel
packages/core      Shared ForumForgePost model and helpers
packages/parser    Generic, Discourse, Hacker News, phpBB, XenForo, and vBulletin extraction
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
