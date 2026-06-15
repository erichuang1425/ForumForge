# ForumForge

**Open-source tools to modernize any forum from your browser.**

ForumForge is a local-first browser extension and adapter framework that turns
messy forum threads into clean reading views, thread maps, saved knowledge, and
new-comment tracking.

Old forums still contain some of the best knowledge on the internet — hardware
troubleshooting, game modding, visa advice, programming help, car repair, niche
hobbies. The problem is that this knowledge is buried in outdated layouts, huge
quote chains, repeated replies, and unclear answers. ForumForge helps users make
those communities more usable **without requiring the forum owner to rebuild the
site.**

> Your favorite forum does not need to modernize. ForumForge can modernize it
> from your browser.

> **Status:** Early planning / prototype. No application code exists yet — this
> repository currently holds the product spec and project documentation. The
> canonical product spec is **[Initial Plan.md](Initial%20Plan.md)**.

---

## What ForumForge does

- **Clean reading mode** — cleaner typography, quote collapsing, distraction reduction
- **New since last visit** — locally tracks what you've read and highlights new posts
- **OP / moderator / staff highlighting** — see which voices matter most
- **Local user notes & tags** — private notes attached to usernames, stored on-device
- **Saved comments** — keep the useful posts from any supported thread
- **Markdown export** — turn thread knowledge into a clean note
- **Thread maps** — make the structure of a long discussion visible
- **Unanswered-question detection** — find where you can contribute
- **Optional summaries** — opt-in, never on by default
- **Custom adapters** — teach ForumForge to read niche and custom forums

## Principles

1. **Open source first** — the extension, adapter format, and examples are inspectable and modifiable.
2. **Local first** — notes, read history, saved comments, and tags stay on your device by default.
3. **Privacy-respecting** — no account, no tracking, no hidden network requests, AI strictly opt-in.
4. **Adapter driven** — any forum can be supported without waiting for the core maintainers.
5. **Useful without AI** — the core experience works fully before any AI feature is involved.
6. **Community extensible** — users can request, create, improve, and share adapters.

## The adapter system

Every forum is different, so ForumForge reads forums through **adapters** rather
than hardcoding a handful of sites. An adapter teaches ForumForge how to find a
thread's title, posts, authors, timestamps, bodies, permalinks, reply nesting,
pagination, roles, and the original poster.

There are three adapter tiers, safest first:

1. **JSON selector adapters** — declarative CSS selectors and extraction rules. Safe, simple, no code execution.
2. **Visual Adapter Studio** *(later)* — click elements on a page to generate an adapter, no coding required.
3. **TypeScript adapters** — for complex sites. Powerful, clearly marked, and reviewed before entering any public registry.

Planned built-in adapters: Discourse, Hacker News, phpBB, XenForo, vBulletin-style,
plus a best-effort generic fallback parser.

See **[docs/ADAPTERS.md](docs/ADAPTERS.md)** for the adapter authoring guide, and
**[Initial Plan.md](Initial%20Plan.md)** for the full product spec.

## Architecture (target)

```text
forumforge/
├── apps/
│   ├── extension/        # the browser extension (WebExtensions)
│   ├── adapter-studio/   # visual adapter builder (later phase)
│   └── docs/             # documentation site
├── packages/
│   ├── core/             # post model + orchestration
│   ├── adapter-sdk/      # types and helpers for writing adapters
│   ├── parser/           # extraction engine
│   ├── storage/          # local-first storage layer
│   ├── ui/               # shared UI components
│   └── ai-optional/      # opt-in, isolated AI features
├── adapters/             # built-in adapters (discourse, hackernews, generic, …)
├── examples/             # json-adapter and typescript-adapter examples
└── docs/
```

This is the **target** layout. Packages are intentionally **not** scaffolded with
placeholder code yet — the project is documentation-first until Phase 0 begins.

## Roadmap

- **Phase 0 — Foundation:** extension shell, content script, side panel, post model, local storage, generic extractor
- **Phase 1 — First useful version:** clean reading, OP highlighting, new-since-last-visit, saved comments, notes, Markdown export, Discourse + Hacker News adapters
- **Phase 2 — Adapter ecosystem:** JSON format, validator, import/export, phpBB/XenForo/vBulletin adapters, contribution guide
- **Phase 3 — Adapter Studio:** click-to-select builder + adapter preview/export
- **Phase 4 — Intelligence layer:** thread map, best-answer & unanswered detection, optional summaries
- **Phase 5 — Community layer:** public adapter registry, quality badges, fixture tests, broken-adapter reporting

Full roadmap with checklists is in **[ROADMAP.md](ROADMAP.md)** (spec and rationale
in **[Initial Plan.md](Initial%20Plan.md)**).

## Privacy & security

ForumForge is a reader-side enhancement layer for forums **you can already
access**. It does not bypass access controls, scrape at scale, or copy restricted
content. Local data stays local; AI is opt-in and works with your own provider or
local model where practical. Safe (JSON) adapters cannot run arbitrary code or
make hidden network requests; advanced (TypeScript) adapters are clearly marked
and reviewed. See **[docs/PRIVACY.md](docs/PRIVACY.md)** and
**[SECURITY.md](SECURITY.md)**.

## Contributing

Contributions are welcome — especially forum support requests, HTML fixtures, JSON
adapters, parser improvements, and documentation. See
**[CONTRIBUTING.md](CONTRIBUTING.md)** and our **[Code of Conduct](CODE_OF_CONDUCT.md)**.

Working with an AI coding agent in this repo? Read **[AGENTS.md](AGENTS.md)**
(general agent guidance) and **[CLAUDE.md](CLAUDE.md)** (Claude-specific workflow).

## License

[MIT](LICENSE) © 2026 Eric Huang. ForumForge should remain open, hackable, and
community-extensible.
