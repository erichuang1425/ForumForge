# AGENTS.md

Guidance for any coding agent working in the ForumForge repository (Claude Code,
Cursor, Copilot, Aider, and others). Human contributors are welcome to read it
too — it doubles as a contributor orientation. For Claude-specific workflow
rules, also read **[CLAUDE.md](CLAUDE.md)**.

---

## Source of truth

**[Initial Plan.md](Initial%20Plan.md) is the canonical product spec.** Treat it
as the source of truth for scope, features, architecture, privacy/security
stance, and roadmap. `README.md`, `AGENTS.md`, and `CLAUDE.md` are derived from
it and must stay consistent with it.

- If a request conflicts with the plan, **surface the conflict** rather than
  silently diverging.
- When product direction genuinely changes, update the plan **and** the derived
  docs in the same change, so they never drift apart.

## Project mission

ForumForge is an **open-source, local-first browser extension and adapter
framework** that modernizes messy, old, niche, and custom forum threads from the
user's own browser.

> Your favorite forum does not need to modernize. ForumForge can modernize it
> from your browser.

The goal is not "AI forum summaries." The goal is to let users and communities
make forums they already use more **readable, revisitable, and contributable** —
through a browser extension plus an easy adapter system. ForumForge must be
genuinely useful **with no AI involved at all.**

Primary users: normal forum readers, power users, forum moderators, niche-community
maintainers, and developers who add support for custom forum sites.

## Product boundaries

**ForumForge is:** a reader-side enhancement layer for forums the user can
already access; open source first; local first; privacy-respecting; adapter-driven;
useful without AI; community-extensible.

**ForumForge is NOT** (do not build toward any of these):

- a closed AI wrapper
- a forum scraping product
- a replacement for forum software
- a social network
- a moderation bot
- a way to bypass private communities, access controls, or paywalls
- a way to copy paid or restricted content

When a proposed feature drifts toward the "is NOT" list, stop and flag it.

## Architecture expectations

The **target** monorepo layout (see `README.md` and the plan):

```text
apps/        extension, adapter-studio, docs
packages/    core, adapter-sdk, parser, storage, ui, ai-optional
adapters/    discourse, hackernews, phpbb, xenforo, generic, …
examples/    json-adapter, typescript-adapter
docs/
```

Expectations:

- **Documentation-first, for now.** The repo currently holds the spec and project
  docs. Do **not** scaffold every package with placeholder or fake
  implementations. Prefer clear documentation and minimal real code over
  half-finished stubs. Build a package when there is real work for it, ideally
  driven by the roadmap phase in play.
- **Respect the phase order.** Phase 0 (extension shell, content script, side
  panel, post model, local storage, generic extractor) comes before features;
  features (Phase 1) come before the adapter ecosystem (Phase 2); AI (Phase 4)
  comes last and stays optional. Don't jump ahead without reason.
- **Keep layers separated.** Extraction (`parser`/adapters) → model (`core`) →
  storage (`storage`) → UI (`ui`/extension). AI lives only in `ai-optional` and
  must be isolated and removable without breaking core features.
- **The post model is the contract.** Adapters produce posts; everything else
  consumes the model. Keep it stable and minimal. The planned shape:

  ```ts
  type ForumForgePost = {
    id: string;
    author: string;
    authorUrl?: string;
    role?: "op" | "user" | "mod" | "admin";
    timestamp?: string;
    contentText: string;
    contentHtml?: string;
    permalink?: string;
    parentId?: string;
    depth?: number;
    links?: string[];
  };
  ```

## Privacy rules (non-negotiable)

- No account required for core features.
- No tracking or analytics by default.
- No hidden third-party network requests.
- No remote summaries by default.
- Local notes, tags, read history, and saved posts stay **local** by default.
- AI features are **opt-in only**; users can use their own provider or a local
  model where practical.
- Any sync or remote feature must be optional and clearly disclosed.

If a change would send user data off-device, that is a product decision — stop
and confirm (see "When to ask the user").

## Security rules

- **Safe (JSON) adapters use selectors and extraction rules — never arbitrary
  remote code.** Supported: CSS selectors, attribute extraction, text-cleanup
  rules, URL match patterns. Not supported: remote JavaScript, `eval`, hidden
  network requests, cross-site tracking, unreviewed code execution.
- **Advanced (TypeScript/JavaScript) adapters must be clearly marked** and treated
  as code that runs in the user's browser. They are reviewed before inclusion in
  any public registry.
- Adapters must not collect unrelated user data, bypass access controls, or make
  unnecessary network requests.
- **Extension permissions stay narrow and justified.** Every host permission or
  capability must be tied to a concrete feature. Do not request broad permissions
  "just in case."
- Treat forum page content as untrusted input. Sanitize extracted HTML before
  rendering; never inject unsanitized markup.

## Adapter rules

An adapter teaches ForumForge how to read one forum. Adapters define: thread
title, post containers, usernames, timestamps, post bodies, permalinks, reply
nesting, next-page buttons, moderator/admin labels, and OP detection.

- **Prefer JSON adapters.** Reach for a TypeScript adapter only when selectors
  genuinely cannot express the site.
- **Fail gracefully.** A missing selector should degrade (skip a field), not crash
  the page or the extension. The generic fallback parser is allowed to be
  imperfect.
- **Test adapters against fixtures**, not live sites. Save representative HTML as a
  fixture and assert on extracted output (see Phase 5: fixture-based adapter
  tests). This keeps tests deterministic and avoids hammering real forums.
- Keep each adapter self-contained and documented (which forum software / versions
  it targets, known limitations).

Canonical JSON adapter shape:

```json
{
  "id": "example-forum",
  "name": "Example Forum",
  "match": ["https://forum.example.com/thread/*"],
  "selectors": {
    "threadTitle": "h1.thread-title",
    "post": ".post",
    "postId": "data-post-id",
    "author": ".username",
    "timestamp": "time",
    "content": ".post-body",
    "permalink": ".post-number a",
    "nextPage": "a.next"
  },
  "features": {
    "supportsNestedReplies": false,
    "supportsScores": false,
    "supportsRoles": true
  }
}
```

## Code style

- **TypeScript** across the project; prefer explicit types at module boundaries
  (the post model, adapter SDK, storage API).
- **Minimal dependencies.** Each new dependency is a cost — especially in a browser
  extension where bundle size and supply-chain surface matter. Justify additions;
  prefer the platform and small focused libraries.
- **WebExtensions-style APIs** where practical, so the extension stays portable
  across browsers.
- Match the surrounding code's naming, formatting, and idioms. When a formatter/
  linter config lands, follow it; until then, keep things clean and conventional.
- Small, composable modules over large multi-purpose ones. Keep extraction pure
  and side-effect-free where possible.
- Write code that reads like the rest of the codebase — comment density and style
  to match.

## Testing & verification expectations

- **Verify before claiming.** Run builds/tests/typechecks and report real results.
  Never state that something builds, passes, or works unless a tool run in your
  session shows it.
- **If the repo has no code or no test setup yet, say so plainly** instead of
  inventing or implying results. Right now there is no build or test pipeline —
  that is expected at this stage.
- When you add real code, add the matching tests (unit tests for parser/core
  logic; fixture-based tests for adapters) and run them.
- For extension/UI behavior that can't be unit-tested, describe how you manually
  verified it (or that you couldn't, and why).

## When to ask the user

Pause and ask only when input is genuinely the user's to give:

- a destructive or hard-to-reverse action (deleting/overwriting non-trivial files,
  rewriting history, force-pushing);
- a real change in product scope, direction, or one of the "is NOT" boundaries;
- anything that would weaken privacy or security guarantees (sending data
  off-device, broadening permissions, enabling AI by default);
- a decision that needs information only the user has (credentials, account
  choices, external service selection).

## When to proceed autonomously

For reversible edits that clearly follow from an agreed task, **proceed** — don't
ask permission for routine work. This includes writing/editing docs and code that
fit the plan, fixing obvious issues, adding tests, and improving consistency.
Make the simplest change that creates a solid foundation, then report what you
did. Don't end a turn with an unexecuted "I will now…" — if it's in scope, do it.

## Documentation expectations

- Keep `README.md`, `AGENTS.md`, `CLAUDE.md`, and `Initial Plan.md` mutually
  consistent. A product change that lands in code should land in docs in the same
  change.
- Prefer updating an existing doc over creating a new one. Don't duplicate content
  across files — link instead.
- Document adapters (target software, limitations) and any non-obvious decisions.
- Write for newcomers: this is an open-source project meant to attract contributors.

## What not to do

- Don't add unrelated features, premature abstractions, defensive backups, feature
  flags, or broad refactors.
- Don't scaffold empty packages with fake implementations.
- Don't build toward anything on the "ForumForge is NOT" list.
- Don't weaken privacy/security defaults or broaden extension permissions without
  explicit sign-off.
- Don't add heavy dependencies casually.
- Don't claim a file was created/edited/tested/verified unless you actually did it
  in this session.
- Don't bypass forum access controls or build scraping/automation that abuses
  forums.
