# @forumforge/parser

The ForumForge **extraction engine**. It turns forum-page DOM into
[`ForumForgePost`](../core/README.md) values that the rest of ForumForge consumes.

This package ships thirteen extractors:

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
- **`extractThreadXenForo`** targets XenForo 2.3 default public thread views.
  It requires a versioned public thread-view signature and a coherent numeric
  post shell before extracting titles, authors, timestamps, profile URLs,
  permalinks, body links, and explicit English moderator/administrator roles;
  XenForo's staff display flag alone is not treated as moderator authority. It
  supports the alternate author-profile layout used by article threads. OP
  remains unset
  because the default markup exposes no reliable marker and display order is
  unsafe across pagination, direct-post URLs, and sorting. Evidence is limited
  to synthetic offline fixture tests and a 2026-07-16 read-only structural
  comparison against official XenForo 2.3 normal, question, and article thread
  pages; the extractor was not run on those pages. Packaged-extension and live
  extraction success, custom themes, localized/custom roles, non-2.3 versions,
  pagination, and lazy loading remain unverified.
- **`extractThreadVBulletin`** targets stock/classic vBulletin 4.x showthread
  pages. `isVBulletinPage(root)` requires the vBulletin 4 generator signature,
  thread title, and a coherent numeric postbit/permalink pair, keeping forum
  indexes, other major versions, and unrelated lookalike pages on the generic
  fallback. It handles horizontal and legacy postbits and extracts titles,
  authors, timestamps, profile URLs, permalinks, message links, and explicit
  English moderator/administrator titles. OP remains unset because stock
  postbits expose no reliable marker and display order is unsafe. Evidence is
  limited to synthetic offline vBulletin 4.2.5 fixture tests for legacy/EOL
  compatibility. Branding-free installations, customized templates, localized
  roles, other major versions, pagination, and packaged-extension or live
  browser behavior remain unverified.
- **`extractThreadNairaland`** targets Nairaland topic pages whose legacy table
  layout pairs a metadata row with the next `.narrow` post-body row. Detection
  requires a numeric `/post/{id}` permalink and `.user` author in that adjacent
  header. Explicit `(op)` and `(m)` markers set roles; display order never does.
  Evidence is limited to a synthetic offline fixture, so live markup,
  pagination, and packaged-browser behavior remain unverified.
- **`extractThreadPtt`** targets PTT article pages with the standard Chinese
  author/board/title/time metadata and station footer. It extracts the article
  as the OP, removes metadata and footer chrome from its body, and maps each flat
  `.push` reply to a deterministic child post while retaining its direction.
  Detection requires the complete signed article shell, keeping board indexes
  and lookalikes on the generic fallback. Evidence is limited to a synthetic
  offline fixture; current live markup, pagination, and packaged-browser
  behavior remain unverified.
- **`extractThreadFourChan`** targets dedicated 4chan thread pages whose signed
  page state and post containers expose coherent numeric post, message, and
  permalink IDs. It retains attachment filename/link metadata without loading
  media, uses only explicit capcodes for staff roles, and records the first
  local quote as a flat reply relationship. Board indexes and mismatched
  lookalikes stay on the generic fallback. Evidence is limited to a synthetic
  offline fixture; current live markup, archived threads, board variants,
  media, and packaged-browser behavior remain unverified.
- **`extractThreadArca`** targets Arca article pages with the canonical
  board-article wrapper and numeric `/b/{channel}/{id}` link. It preserves
  native nested comments, matches OP replies by exact identity, treats only an
  explicit channel-manager marker as moderator evidence, and substitutes local
  text for otherwise unreadable media-only bodies. Evidence includes a
  synthetic offline fixture and a 2026-07-16 read-only command-line extraction
  on one public article; packaged-browser behavior and broader channel/auth/media
  variants remain unverified.
- **`extractThreadDcInside`** targets DC Inside gallery articles with the
  current gallery-view shell and coherent numeric recommendation-control ID. It
  preserves the article plus comments and replies already rendered by the
  site's own script, qualifies anonymous identities with their displayed IP,
  and uses local text for otherwise unreadable media-only bodies. Evidence
  includes a synthetic offline fixture, a 2026-07-16 read-only command-line
  extraction of one public article, and a structural comparison with the site's
  first-party comment rendering template. The static public response contained
  no rendered comments; packaged-browser behavior, loaded-comment extraction,
  and broader gallery/auth/media variants remain unverified.
- **`extractThreadFmKorea`** targets the current FMKorea `rd` article shell and
  its loaded `fdb` comment page. It requires coherent numeric document, content,
  comment, and permalink identities; matches OP replies only by exact member ID;
  and follows explicit loaded reply-parent links without fetching another
  comment page. Evidence includes a synthetic offline fixture and a 2026-07-16
  exact-source extraction inside one isolated rendered public page. That check
  extracted 51 unique numeric posts, including 30 replies through depth 2.
  Packaged-extension, Chrome, other comment pages, and broader board/auth/media
  variants remain unverified.
- **`extractThreadStackOverflow`** targets the current Stack Overflow question,
  answer, and loaded-comment shell. It validates numeric element/data IDs,
  parent IDs, share/comment permalinks, and exact user IDs before preserving the
  question → answer → comment hierarchy, code-rich bodies, and OP identity.
  Evidence includes a synthetic offline fixture and a 2026-07-16 exact-source
  extraction inside one isolated rendered public question. That check extracted
  32 unique numeric posts: one question, 26 answers, and five loaded comments.
  Packaged-extension, Chrome, collapsed comments, other Stack Exchange sites,
  and broader state/media variants remain unverified.

`apps/extension/src/extract.ts` is the one place that chooses between them —
each extractor here is independent and adapter selection isn't this package's
concern.

## Discussion semantics

Reviewed built-in adapters can add a closed `layout` and `source` to the
thread, plus optional `kind`, PTT `reaction`, safe-integer `score`, and
`accepted` fields to posts. These values come from the adapter's already-proven
DOM contract, never an arbitrary hostname. Missing semantics remain valid and
use the linear reader fallback. Current layout mappings are:

- Nairaland: `linear`;
- DC Inside, FMKorea, and Arca: `article-comments`;
- Hacker News: `nested`;
- PTT: `ptt` with `push`, `boo`, or `neutral` comment reactions;
- 4chan: `imageboard` with `topic` and `reply` post kinds;
- Stack Overflow: `qa` with question, answer, comment, score, and accepted state.

This is deterministic parser/component evidence, not packaged-browser evidence.
F95Zone remains unclaimed until its own sanitized fixture and browser run exist.

## Exports

- `extractThreadGeneric(root, options?)`, `extractThreadDiscourse(root, options?)`,
  `extractThreadHackerNews(root, options?)`,
  `extractThreadPhpBB(root, options?)`, `extractThreadXenForo(root, options?)`,
  `extractThreadVBulletin(root, options?)`, `extractThreadNairaland(root, options?)`,
  `extractThreadPtt(root, options?)`, `extractThreadFourChan(root, options?)`,
  `extractThreadArca(root, options?)`, `extractThreadDcInside(root, options?)`,
  `extractThreadFmKorea(root, options?)`, and
  `extractThreadStackOverflow(root, options?)` extract a thread from a `Document`
  or any element containing it. Each returns
  `{ title?, baseUrl?, layout?, source?, posts }`
  (`ExtractedThread`).
- `isDiscoursePage(root)`, `isHackerNewsPage(root)`, `isPhpBBPage(root)`,
  `isXenForoPage(root)`, `isVBulletinPage(root)`, `isNairalandPage(root)`, and
  `isPttPage(root)`, `isFourChanPage(root)`, `isArcaPage(root)`, and
  `isDcInsidePage(root)`, `isFmKoreaPage(root)`, and `isStackOverflowPage(root)`
  detect whether a document matches that extractor.
- `ExtractedThread`, `ThreadLayout`, `ThreadSource`, `ExtractOptions`,
  `GenericExtractOptions`,
  `DiscourseExtractOptions`, `HackerNewsExtractOptions`,
  `PhpBBExtractOptions`, `XenForoExtractOptions`, `VBulletinExtractOptions`, and
  `NairalandExtractOptions`, `PttExtractOptions`, `FourChanExtractOptions`, and
  `ArcaExtractOptions`, `DcInsideExtractOptions`, `FmKoreaExtractOptions`, and
  `StackOverflowExtractOptions` are result and option types.

Pass `options.baseUrl` when parsing detached HTML (tests, fixtures) so relative
permalinks and links resolve to absolute URLs; in a live browser the DOM already
resolves them.

> Extracted `contentHtml` is **untrusted** and must be sanitized before rendering.
> See [SECURITY.md](../../SECURITY.md).

## Develop

From the repo root: `pnpm test` runs the suite (the parser is tested against saved
HTML fixtures, never live sites — see [docs/FIXTURES.md](../../docs/FIXTURES.md));
`pnpm typecheck` type-checks all packages. `linkedom` provides a DOM for tests.
