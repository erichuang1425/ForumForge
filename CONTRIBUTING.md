# Contributing to ForumForge

Thanks for your interest in ForumForge — open-source tools to modernize any forum
from your browser. Contributions are very welcome.

> **Project status:** Early planning / prototype. The repository currently holds
> the product spec and project documentation; application code has not been
> scaffolded yet. The most valuable contributions right now are documentation,
> adapter design, and HTML fixtures. See **[Initial Plan.md](Initial%20Plan.md)**
> for the full plan and roadmap.

## Before you start

- Read **[README.md](README.md)** for the product overview.
- Read **[Initial Plan.md](Initial%20Plan.md)** — the canonical product spec.
- Read **[AGENTS.md](AGENTS.md)** if you're using an AI coding agent; it captures
  the project's conventions and boundaries.
- Check existing issues before opening a new one.

## Good first contributions

- **Request support for a forum** you use (open an issue with the URL pattern and
  a sample thread).
- **Submit an HTML fixture** — a saved, representative thread page we can build and
  test an adapter against.
- **Create a JSON adapter** for a forum (the safest, simplest adapter type).
- **Improve parser accuracy** or the generic fallback extractor.
- **Improve documentation.**
- **Test the extension on old/niche forums** and report what breaks.
- **Help design the Adapter Studio** workflow.

## Adapters

Adapters teach ForumForge how to read a particular forum. See
**[docs/ADAPTERS.md](docs/ADAPTERS.md)** for the full authoring guide. Prefer the
safest tier that can do the job:

1. **JSON selector adapters** — declarative CSS selectors + extraction rules. No
   code execution. **Start here.**
2. **Visual Adapter Studio** — a later, no-code way to generate adapters by
   clicking page elements.
3. **TypeScript adapters** — for sites selectors can't express. Treated as code
   that runs in the user's browser, clearly marked, and reviewed before inclusion
   in any public registry.

Guidelines:

- Test adapters against **saved HTML fixtures**, not live sites — keep tests
  deterministic and don't hammer real forums.
- Adapters must **fail gracefully**: a missing field should degrade, not crash.
- Document which forum software (and versions) the adapter targets, plus known
  limitations.
- Adapters must not collect unrelated data, bypass access controls, or make
  unnecessary network requests. See **[SECURITY.md](SECURITY.md)**.

## Privacy & security expectations for contributions

ForumForge is local-first and privacy-respecting by design. Contributions must not:

- add tracking, analytics, or hidden third-party requests;
- send user data off-device by default;
- enable AI features by default (AI is strictly opt-in);
- broaden extension permissions without a concrete, justified feature need.

If your change touches any of the above, call it out explicitly in the PR.

## Development setup

There is no build or test pipeline yet — code scaffolding begins with Phase 0 of
the roadmap. When tooling lands, setup and commands will be documented here and in
the README. Until then, documentation and adapter/fixture contributions don't
require a local build.

Planned technical direction (see the plan): TypeScript, WebExtensions-style APIs,
local-first storage, minimal dependencies, lockfiles committed.

## Pull requests

- Keep PRs focused — one logical change per PR.
- Don't add unrelated features, broad refactors, or premature abstractions.
- Update relevant documentation in the same PR.
- Describe what you changed, why, and how you verified it.
- Be kind and constructive in review. This is a community project.

## License

By contributing, you agree that your contributions are licensed under the
project's **[MIT License](LICENSE)**.
