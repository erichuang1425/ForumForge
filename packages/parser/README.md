# @forumforge/parser

The ForumForge **extraction engine**. It turns forum-page DOM into
[`ForumForgePost`](../core/README.md) values that the rest of ForumForge consumes.

This package ships four extractors:

- **`extractThreadGeneric`** — the best-effort fallback for pages with no
  site-specific adapter. It walks a prioritized set of common forum/comment
  selectors, picks the post container that matches the most elements, and
  extracts each field defensively: a missing field is skipped, never thrown.
  Intentionally imperfect — its job is basic extraction until a real adapter
  exists for that forum.
- **`extractThreadDiscourse`** — targets Discourse's own DOM directly
  (`article.topic-post`, `.cooked` bodies, `.names .username`), since every
  Discourse forum runs the same software. `topic-owner` and staff/moderator
  badges drive role detection. `isDiscoursePage(root)` detects a Discourse page
  via its `generator` meta tag.
- **`extractThreadHackerNews`** — targets `news.ycombinator.com` item pages.
  HN's comments are a flat list of `tr.athing.comtr` rows; `parentId` and
  `depth` are reconstructed from each row's `indent` attribute. Comments by the
  story's own submitter are marked `role: "op"`. `isHackerNewsPage(root)`
  detects an HN page via its `#hnmain` wrapper.
- **`extractThreadPhpBB`** targets phpBB 3.3 topic pages using the stock
  prosilver DOM contract. It extracts numeric post IDs, authors, timestamps,
  profile URLs, permalinks, body links, and explicit English staff-rank labels.
  It does not infer OP from display order because phpBB sorting and direct-post
  views can hide the true topic start. `isPhpBBPage(root)`
  requires the phpBB topic-page body signature plus a numeric post container
  and post body, so forum indexes and unrelated lookalike pages retain the
  generic fallback. Evidence is limited to a synthetic offline fixture; live
  sites, custom themes, other versions, and packaged-browser behavior remain
  unverified.

`apps/extension/src/extract.ts` is the one place that chooses between them —
each extractor here is independent and adapter selection isn't this package's
concern.

## Exports

- `extractThreadGeneric(root, options?)`, `extractThreadDiscourse(root, options?)`,
  `extractThreadHackerNews(root, options?)`, and
  `extractThreadPhpBB(root, options?)` extract a thread from a `Document` or any
  element containing it. Each returns `{ title?, baseUrl?, posts }`
  (`ExtractedThread`).
- `isDiscoursePage(root)`, `isHackerNewsPage(root)`, and `isPhpBBPage(root)`
  detect whether a document matches that extractor.
- `ExtractedThread`, `ExtractOptions`, `GenericExtractOptions`,
  `DiscourseExtractOptions`, `HackerNewsExtractOptions`, and
  `PhpBBExtractOptions` are result and option types.

Pass `options.baseUrl` when parsing detached HTML (tests, fixtures) so relative
permalinks and links resolve to absolute URLs; in a live browser the DOM already
resolves them.

> Extracted `contentHtml` is **untrusted** and must be sanitized before rendering.
> See [SECURITY.md](../../SECURITY.md).

## Develop

From the repo root: `pnpm test` runs the suite (the parser is tested against saved
HTML fixtures, never live sites — see [docs/FIXTURES.md](../../docs/FIXTURES.md));
`pnpm typecheck` type-checks all packages. `linkedom` provides a DOM for tests.
