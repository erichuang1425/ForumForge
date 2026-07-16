# ForumForge agent guide

This file is the durable operating contract for coding agents in this repository.
Keep it short, factual, and updated when the repository changes.

## Start here

- Read the nearest `AGENTS.md`; nested files add subsystem-specific rules.
- Use [Initial Plan.md](Initial%20Plan.md) for product boundaries and
  [ROADMAP.md](ROADMAP.md) for current sequencing.
- Check `git status --short --branch` before editing. Preserve unrelated work.
- Use Node 22 (see `.nvmrc`) and the pinned pnpm version in `package.json`.

## Repository map

- `apps/extension`: Manifest V3 extension, side panel, browser storage, and UI.
- `packages/adapter-schema`: data-only adapter contracts, validation, matching,
  and bounded extraction.
- `packages/core`: shared post model and pure helpers.
- `packages/parser`: generic, Discourse, and Hacker News extraction.
- `packages/storage`: local-first storage contracts and implementations.
- `docs`: contributor, testing, privacy, compatibility, and release guidance.
- `scripts`: repository, version, build, and packaging checks.

Phase 0 and Phase 1 code are complete on the current development line. The next
product phase is the JSON adapter ecosystem, but a public v0.1 release first
requires the browser-validation and release gates in
[docs/RELEASING.md](docs/RELEASING.md).

## Canonical commands

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` is the required local/CI gate. It type-checks, runs all tests,
builds the extension, checks documentation and privacy boundaries, and verifies
the built files. Use focused commands while iterating:

```bash
pnpm --filter @forumforge/parser test
pnpm --filter @forumforge/extension test
pnpm typecheck
pnpm build
```

For UI, manifest, storage, or release-facing changes, also complete the relevant
manual checks in [docs/TESTING.md](docs/TESTING.md). Never claim browser
verification without testing a real built or packaged extension.

## Non-negotiable product boundaries

- Core features work without an account or AI.
- Notes, saves, and read history remain on-device by default.
- No telemetry, tracking, hidden network requests, or remote processing by
  default.
- Keep extension permissions narrow. Do not add host permissions or always-on
  content scripts without explicit maintainer approval and a documented threat
  model.
- Treat page content and content-script messages as untrusted. Validate messages
  and sanitize HTML before rendering.
- Never bypass access controls, automate large-scale scraping, or retain private
  forum content in fixtures.
- AI stays optional, isolated, and opt-in.

If a requested change weakens one of these guarantees, stop and surface the
conflict before editing.

## Change rules

- Prefer the smallest complete change that solves one tracked problem.
- Keep TypeScript types explicit at package and message boundaries.
- Add or update tests with behavioral changes. Parser work uses sanitized,
  deterministic HTML fixtures, never live-site requests.
- Do not add a dependency when the platform or a small local helper is enough.
  Explain every new runtime dependency in the pull request.
- Update public docs and `CHANGELOG.md` when behavior, compatibility,
  permissions, storage, or contributor workflow changes.
- Do not edit generated `dist/` or `artifacts/` files; rebuild them.
- Review against [docs/CODE_REVIEW.md](docs/CODE_REVIEW.md) before handoff.

## Git and GitHub safety

- Agent-created branches use `work/<short-task-name>`. Do not use tool or model
  names in branch names.
- Before an owner-authored commit, verify the configured identity is
  `I-Kai Huang <61899328+erichuang1425@users.noreply.github.com>`. Never
  overwrite a different contributor's identity.
- Commit messages are short, imperative, and contain no agent/tool signatures,
  generated-by text, or synthetic co-author trailers.
- Do not push, merge, tag, publish a release, or change repository settings
  without explicit user authorization.
- Keep issue and pull-request claims evidence-based. Link the test output or
  manual evidence that supports them.

## Done means

1. The requested behavior and its failure states are implemented.
2. Relevant automated tests and docs are updated.
3. `pnpm verify` passes.
4. Required manual checks are completed or explicitly recorded as pending.
5. The final diff is reviewed for privacy, permissions, storage loss, generated
   files, and unrelated changes.
