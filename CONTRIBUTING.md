# Contributing to ForumForge

ForumForge welcomes focused fixes, browser-test evidence, sanitized fixtures,
adapter improvements, documentation, and product work aligned with the roadmap.

## Before starting

1. Read [README.md](README.md), [ROADMAP.md](ROADMAP.md), and the relevant issue.
2. Search existing issues and pull requests to avoid duplicate work.
3. For a material change, open or claim one issue and agree on its acceptance
   criteria before writing a large patch.
4. Read [AGENTS.md](AGENTS.md) when using a coding agent and the nearest nested
   `AGENTS.md` for subsystem rules.

Security reports do not belong in public issues. Follow
[SECURITY.md](SECURITY.md).

## Development setup

The supported development and CI runtime is Node 22 (see `.nvmrc`). The package
manager is pinned in `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` is the required handoff gate. It runs:

- strict TypeScript checks across workspaces;
- all Vitest suites;
- the extension bundle;
- manifest, privacy-boundary, fixture, version, and documentation-link checks;
- verification of the built extension file set.

Useful focused commands:

```bash
pnpm --filter @forumforge/parser test
pnpm --filter @forumforge/extension test
pnpm typecheck
pnpm build
```

Documentation-only changes still run `pnpm repo:check`. Changes to the
extension, manifest, storage, parser selection, or user-visible behavior also
require the applicable manual checks in [docs/TESTING.md](docs/TESTING.md).

## Choose a contribution

Good first contributions are:

- reproduce a bug and reduce it to a sanitized fixture or unit test;
- test the source build on a public Discourse, Hacker News, or generic forum
  thread and report evidence;
- improve generic-parser accuracy without harming fallback behavior;
- anonymize and contribute an offline-safe HTML fixture;
- clarify current behavior or a documented limitation.

The JSON adapter runtime is planned but not implemented. Discuss its format in a
tracking issue before submitting adapter-format code that establishes a public
contract.

## Adapter and fixture acceptance

Parser changes must:

- use deterministic fixture tests, not automated live requests;
- preserve stable post IDs and fail gracefully when optional fields are absent;
- include a false-positive test when adapter detection changes;
- document target software, page types, and known limits;
- keep authentic identities, prose, credentials, and gated content out of the
  repository.

Fixtures must be anonymized and offline-safe. Remove scripts, frames, forms,
remote-loading assets, tokens, personal data, and unrelated markup while
preserving the DOM structure the extractor needs. Follow
[docs/FIXTURES.md](docs/FIXTURES.md).

## Pull requests

Keep one logical change per pull request. A reviewable PR includes:

- a linked issue or a concise reason an issue is unnecessary;
- the user-visible behavior and failure states;
- tests that would fail without the change;
- exact automated commands and results;
- manual browser evidence when required;
- explicit notes for dependency, permission, storage-schema, privacy, or
  security impact;
- updated documentation and `CHANGELOG.md` for user-visible changes.

Reviewers use [docs/CODE_REVIEW.md](docs/CODE_REVIEW.md). A passing CI run is
necessary, not sufficient, for browser or release claims.

## Dependencies and generated files

Browser-extension dependencies increase bundle size and supply-chain risk.
Prefer platform APIs and small local helpers; explain every new runtime
dependency. Do not commit `dist/`, `artifacts/`, ZIPs, source maps, or local
environment files.

## Commits

Use short, imperative messages. Do not include generated-by notices, assistant
signatures, tool names, or synthetic co-author trailers. Contributors retain
their own Git identity.

## Conduct and license

Participating means following the [Code of Conduct](CODE_OF_CONDUCT.md).
Contributions are licensed under the repository's [MIT License](LICENSE).
