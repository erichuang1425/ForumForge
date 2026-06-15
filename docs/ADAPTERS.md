# Writing ForumForge adapters

An **adapter** teaches ForumForge how to read one forum. ForumForge doesn't
hardcode support for a handful of sites — instead, adapters describe where the
title, posts, authors, timestamps, bodies, permalinks, roles, and pagination live
on a given forum's pages.

This guide is the how-to. For the security model behind adapters, see
**[../SECURITY.md](../SECURITY.md)**. For the product context, see
**[../Initial Plan.md](../Initial%20Plan.md)**.

> **Status:** The adapter formats below are the planned design. The runtime that
> loads and validates adapters is not built yet (see
> **[../ROADMAP.md](../ROADMAP.md)**, Phase 2). Formats may evolve before the first
> release.

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

## What every adapter must locate

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

## JSON selector adapter

The safest, simplest adapter. CSS selectors with a few extraction hints.

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

Field reference:

- **`id`** — unique, stable, kebab-case identifier.
- **`name`** — human-readable forum name.
- **`match`** — one or more URL match patterns (`*` wildcards). The adapter is only
  considered on pages whose URL matches.
- **`selectors.threadTitle`** — element containing the thread title.
- **`selectors.post`** — selector for the repeating post container. Everything below
  is resolved *within* each matched post.
- **`selectors.postId`** — an **attribute name** on the post element (e.g.
  `data-post-id`) used as the post's stable id.
- **`selectors.author`** — element containing the author's name.
- **`selectors.timestamp`** — element containing the post time (often a `<time>`).
- **`selectors.content`** — element containing the post body.
- **`selectors.permalink`** — link to the individual post.
- **`selectors.nextPage`** — link/button to the next page, for paginated threads.
- **`features`** — capability hints so the UI knows what to show
  (`supportsNestedReplies`, `supportsScores`, `supportsRoles`, …).

JSON adapters are **declarative only**. They cannot run arbitrary JavaScript, call
`eval`, make network requests, or track across sites.

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
  links?: string[];
};
```

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
deterministic and avoids hammering real forums. The general pattern (fixture-based
adapter tests land in Phase 5):

1. Save a representative thread page as an HTML fixture.
2. Run the adapter against the fixture.
3. Assert the extracted posts (counts, authors, ids, roles) match expectations.

## Submitting an adapter

See **[../CONTRIBUTING.md](../CONTRIBUTING.md)**. In short: open a forum support
request (or PR) with the forum URL, the software if known, a sample public thread,
and ideally an HTML fixture. JSON adapters are reviewed for correctness;
TypeScript adapters additionally get a security review before entering any public
registry.
