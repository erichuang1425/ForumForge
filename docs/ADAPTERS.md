# Writing ForumForge adapters

An **adapter** teaches ForumForge how to read one forum. The planned adapter
runtime will describe where the title, posts, authors, timestamps, bodies,
permalinks, roles, and pagination live instead of limiting support to
hand-written site integrations.

This guide is the how-to. For the security model behind adapters, see
**[../SECURITY.md](../SECURITY.md)**. For the product context, see
**[../Initial Plan.md](../Initial%20Plan.md)**.

> **Status:** The versioned, data-only JSON v1 schema and bounded validator now
> exist as an isolated Phase 2 foundation in
> [`packages/adapter-schema`](../packages/adapter-schema). Deterministic URL and
> detector selection also exists in that isolated package. Extraction,
> persistence, import/export UI, and extension integration are not built yet (see
> **[../ROADMAP.md](../ROADMAP.md)**, Phase 2). **Discourse, Hacker News, phpBB
> 3.3 stock prosilver, XenForo
> 2.3 default public threads, stock/classic vBulletin 4.x, Nairaland, PTT,
> 4chan, Arca, DC Inside, FMKorea, and Stack Overflow have hand-written
> extractors today** in [`packages/parser`](../packages/parser), not yet JSON or
> `ForumForgeAdapter` adapters. Each has deterministic offline fixture evidence,
> but live-site, theme/version, pagination, lazy-content, and exact-package
> browser coverage varies. The authoritative evidence and limits are recorded
> in [COMPATIBILITY.md](COMPATIBILITY.md). F95Zone is not claimed: it still needs
> a sanitized representative fixture and real-browser evidence rather than an
> assumed XenForo match. Migration to declarative adapters happens once the
> Phase 2 runtime exists.

## Choose the safest tier that works

1. **JSON selector adapter** — declarative CSS selectors + extraction rules. No
   code runs. **Start here**; it covers most forums.
2. **Visual Adapter Studio** *(planned, Phase 3)* — generate a JSON adapter by
   clicking elements on a live thread. No coding.
3. **TypeScript adapter** — for sites selectors can't express. This is code that
   runs in the user's browser; it is clearly marked as code and reviewed before
   inclusion in any public registry.

Only reach for a TypeScript adapter when a JSON adapter genuinely cannot describe
the page.

## Long-term adapter model

| Concept            | Meaning                                              |
| ------------------ | ---------------------------------------------------- |
| thread title       | the discussion's title                               |
| post container     | the repeating element wrapping each post             |
| author             | the poster's display name                            |
| timestamp          | when the post was made                               |
| post body          | the post's content                                   |
| permalink          | a stable link to the individual post                 |
| reply nesting      | parent/child relationships, if the forum threads     |
| next-page button   | how to reach the next page of a paginated thread     |
| moderator/admin    | role labels (mod, admin, staff)                      |
| OP detection       | which posts are by the original poster               |

Version 1 currently describes the title, repeating post container, author,
body, timestamp, permalink, and optional parent ID. Pagination, roles, OP
detection, reactions, and score parsing remain deferred capabilities rather
than hidden conventions.

## JSON selector adapter

The safest, simplest adapter. CSS selectors with a few extraction hints.

```json
{
  "schemaVersion": 1,
  "id": "example-forum",
  "name": "Example Forum",
  "matches": [
    {
      "origin": "https://forum.example.com",
      "pathname": "/thread/*"
    }
  ],
  "detect": ["h1.thread-title", ".post[data-post-id]"],
  "layout": "linear",
  "thread": {
    "title": {
      "selector": "h1.thread-title",
      "source": "text"
    }
  },
  "posts": {
    "selector": ".post[data-post-id]",
    "fields": {
      "id": {
        "source": "attribute",
        "attribute": "data-post-id"
      },
      "author": {
        "selector": ".username",
        "source": "text"
      },
      "timestamp": {
        "selector": "time",
        "source": "attribute",
        "attribute": "datetime"
      },
      "content": {
        "selector": ".post-body",
        "source": "html"
      },
      "permalink": {
        "selector": ".post-number a",
        "source": "attribute",
        "attribute": "href"
      }
    }
  }
}
```

Field reference:

- **`schemaVersion`** — the exact data contract; version 1 is the only accepted
  value.
- **`id`** — unique, stable, kebab-case identifier.
- **`name`** — human-readable forum name.
- **`matches`** — one or more exact HTTP(S) origins with bounded pathname globs.
- **`detect`** — a small list of selectors that must all exist before extraction.
- **`layout`** — an optional closed reader layout; missing values use `linear`.
- **`thread.title`** — a selected text or reviewed attribute read for the thread
  title; its selector is required.
- **`posts.selector`** — the repeating post container. Post field selectors are
  resolved only within each matched post.
- **`posts.fields`** — required `id`, `author`, and `content` reads, with optional
  `timestamp`, `permalink`, and `parentId` reads.
- **`source`** — `text`, `attribute`, or `html`; `attribute` also requires a
  destination-specific reviewed attribute name, and `html` is accepted only
  for post content.

Selectors use a constrained version 1 grammar rather than arbitrary CSS:
type/class/ID selectors, reviewed attributes, and descendant or child
combinators. Lists, escapes, pseudo-selectors, sibling combinators, and
universal selectors fail validation with a path to the affected field.

Use `parseAdapterJson()` for every imported file. The exported JSON Schema is
useful for editor hints and structural interoperability, but schema-only
acceptance is not a security boundary and is unsupported.

Path matching uses a canonical ASCII serialization of `URL.pathname`; `*`
matches zero or more serialized pathname characters, including `/`. Selection
never relies on URL matching alone: every `detect` selector must exist. If more
than one adapter qualifies, reviewed bundled entries precede local entries,
then more literal path characters, fewer wildcards, and lexical adapter IDs
decide. A failed detector continues to the next candidate; exhausted budgets or
no qualifying candidate return an explicit generic fallback. Bundled priority
comes from a package-owned opaque catalog; imported data cannot label itself as
bundled.

JSON adapters are **declarative only**. They cannot run arbitrary JavaScript, call
`eval`, make network requests, crawl pagination, mutate the DOM, or track across
sites. The exact limits and failure behavior are in the
[adapter threat model](ADAPTER_THREAT_MODEL.md).

## The post model

Adapters produce a list of posts in this shape (the contract every other part of
ForumForge consumes):

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
  parentId?: string;   // for nested replies
  depth?: number;      // nesting depth
  kind?: "topic" | "article" | "question" | "answer" | "comment" | "reply";
  reaction?: "push" | "boo" | "neutral";
  score?: number;      // finite safe integer shown by the source
  accepted?: boolean;
  links?: string[];
};
```

The extracted thread can also carry a closed renderer `layout` and reviewed
built-in `source`. Hand-written adapters emit these only from their
already-selected DOM contract; the renderer never guesses them from an
arbitrary hostname. Missing semantics fall back to the linear layout.

## TypeScript adapter

For complex sites. Powerful, but treated as code that runs in the user's browser.

```ts
import type { ForumForgeAdapter } from "@forumforge/adapter-sdk";

export const adapter: ForumForgeAdapter = {
  id: "weird-old-forum",
  name: "Weird Old Forum",
  match: ["https://oldforum.example.com/*"],

  detect() {
    return document.querySelector(".threadtable") !== null;
  },

  extractThread() {
    return [...document.querySelectorAll(".message")].map((el) => ({
      id: el.getAttribute("data-id") ?? crypto.randomUUID(),
      author: el.querySelector(".name")?.textContent?.trim() ?? "Unknown",
      contentText: el.querySelector(".body")?.textContent?.trim() ?? "",
      contentHtml: el.querySelector(".body")?.innerHTML ?? "",
      timestamp: el.querySelector(".date")?.textContent?.trim(),
      links: [...el.querySelectorAll("a")].map((a) => a.href),
    }));
  },
};
```

The planned adapter interface:

```ts
type ForumForgeAdapter = {
  id: string;
  name: string;
  match: string[];

  detect(): boolean;                       // is this adapter right for the page?
  extractThread(): ForumForgePost[];       // the posts
  extractTitle?(): string;                 // thread title, if separable
  extractPagination?(): PaginationInfo;    // how to page through the thread
  observeUpdates?(): void;                 // watch for live/new posts
};

type PaginationInfo = {
  nextPageUrl?: string;
  currentPage?: number;
  totalPages?: number;
};
```

## Rules for every adapter

- **Fail gracefully.** A missing selector should skip a field, never crash the page
  or the extension. The generic fallback parser is allowed to be imperfect.
- **No unrelated data collection**, no bypassing access controls, no unnecessary
  network requests.
- **Document the target** — which forum software and versions, and known limits.

## Testing adapters

Test against **saved HTML fixtures**, not live sites — this keeps tests
deterministic and avoids hammering real forums. See **[FIXTURES.md](FIXTURES.md)**
for how to capture and contribute one. Every adapter is fixture-tested when it
is introduced; Phase 5 expands this into registry-wide quality reporting:

1. Save a representative thread page as an HTML fixture.
2. Run the adapter against the fixture.
3. Assert the extracted posts (counts, authors, ids, roles) match expectations.

## Submitting an adapter

See **[../CONTRIBUTING.md](../CONTRIBUTING.md)**. In short: open a forum support
request (or PR) with the forum URL, the software if known, a sample public thread,
and ideally an HTML fixture. JSON adapters are reviewed for correctness;
TypeScript adapters additionally get a security review before entering any public
registry.
