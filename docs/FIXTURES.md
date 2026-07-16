# Contributing HTML fixtures

An **HTML fixture** is a small representative forum-thread document, either a
sanitized capture or a hand-authored synthetic page that follows a documented
DOM contract. Fixtures are the foundation of reliable adapters: they let us build
and test an adapter against realistic markup **deterministically**, without
repeatedly hitting a live forum.

Submitting a fixture is one of the most useful contributions you can make — even if
you never write an adapter yourself. See **[../CONTRIBUTING.md](../CONTRIBUTING.md)**
and the adapter guide in **[ADAPTERS.md](ADAPTERS.md)**.

> **Status:** Fixture-backed parser tests exist today for the generic, Discourse,
> Hacker News, phpBB 3.3 stock prosilver, and XenForo 2.3 default public thread
> extractors, plus stock/classic vBulletin 4.x showthread extraction represented
> by a synthetic 4.2.5 fixture, Nairaland topic extraction represented by a
> synthetic paired-row fixture, PTT article extraction represented by a
> synthetic article-and-push fixture, and 4chan thread extraction represented by
> a synthetic imageboard fixture, Arca article extraction represented by a
> synthetic nested-comment fixture, and DC Inside extraction represented by a
> synthetic gallery-article and rendered-comment fixture. The phpBB, XenForo,
> vBulletin, Nairaland, PTT, 4chan, Arca, and DC Inside fixtures are synthetic
> and offline-safe. On 2026-07-16,
> the XenForo fixture selectors
> received a read-only structural comparison against normal, question, and
> article thread pages on the official `xenforo.com/community` forum; ForumForge
> extraction was not run there and no page content was retained. The vBulletin
> fixture provides legacy/EOL DOM evidence only. Its postbit structure received
> a 2026-07-16 read-only comparison with the official vBulletin
> [postbit manual](https://www.vbulletin.com/docs/html/main/stylevars_postbit)
> and a public
> [vBulletin 4 support-template excerpt](https://forum.vbulletin.com/forum/vbulletin-4/vbulletin-4-questions-problems-and-troubleshooting/359755-how-can-i-remove-ads-in-postbit-from-specific-forums),
> but ForumForge extraction was not run on a live vBulletin 4 installation.
> The Nairaland fixture was informed by publicly indexed page text and stable
> `.narrow`, `.user`, and numeric `/post/{id}` signatures, but no current live
> page was retained or successfully inspected.
> The PTT fixture represents its article metadata and flat push-reply contract;
> the public-page connection reset during inspection, so no current live page
> was retained or successfully inspected.
> The 4chan fixture represents a dedicated thread, numeric post identity,
> capcodes, quote links, and attachment metadata without any image or remote
> resource. A direct public-page request did not return usable thread markup, so
> no current live page was retained or successfully inspected.
> The Arca fixture selectors received a 2026-07-16 read-only comparison and
> command-line extraction against one public article. The adapter detected the
> page and extracted five numeric posts through depth 2; no page content was
> printed or retained. This is not packaged-extension or browser evidence.
> The DC Inside fixture follows the current gallery-view article structure and
> the site's first-party `comment.js` rendering template. A 2026-07-16 read-only
> command-line extraction detected and extracted one public article, but its
> static response contained no rendered comments. No page content was printed
> or retained. This is not rendered-comment, packaged-extension, or browser
> evidence. Synthetic fixtures are deterministic DOM-contract evidence, not by
> themselves live or packaged-extension evidence. Phase 2 extends the same
> pattern to contributor-made declarative adapters; Phase 5 adds registry-wide
> quality reporting.

## What makes a good fixture

- A representative DOM for the exact forum software, version, and theme being
  tested. Prefer a sanitized public-page capture when one can be shared safely;
  a small hand-authored synthetic fixture is also appropriate when it follows a
  documented stock-template contract.
- When a synthetic fixture is compared with public markup, record the date,
  exact software/version/theme, page types, and whether the extractor was run.
  A selector-level structural comparison is not live extraction evidence.
- Ideally a thread with some variety: an original post, several replies, and — if
  the forum has them — a moderator/admin post, a quote, and a code block.
- If the thread is paginated, capturing **page 1** (and optionally page 2) helps
  test pagination.

## What to avoid

- **No private, gated, or paywalled content.** Only capture pages anyone can view
  without logging in. ForumForge does not bypass access controls.
- **Anonymize user content.** Adapter tests need realistic *markup structure*, not
  authentic identities or prose. Before submitting, replace usernames, display names,
  avatars, signatures, profile links, and post/comment bodies with synthetic
  placeholders (e.g. `user-1`, `Lorem ipsum…`) while preserving the surrounding DOM
  structure, tags, and attributes the adapter relies on. A public thread is not a
  license to permanently republish someone's words — and authors sometimes edit or
  delete posts after the fact.
- **Scrub personal and sensitive data.** Remove or redact anything sensitive that may
  remain after anonymizing — email addresses, IP addresses, private messages, real
  names. If it wasn't meant to be a permanent public record, it doesn't belong in a
  fixture.
- **Strip active and remote content.** A plain "HTML only" save still contains
  `<script>` tags, `<iframe>`s, and remote `src`/`href` references (images,
  stylesheets, fonts, trackers). Opening or loading such a file can execute untrusted
  forum code and make hidden network requests to third parties — exactly what
  ForumForge forbids. Remove `<script>` and `<iframe>` elements and neutralize remote
  references before submitting (see capture step 3 below).
- **Don't include auth tokens or cookies.** Saved pages sometimes embed session
  identifiers in URLs or scripts — remove them.
- Keep it reasonably small; trim unrelated pages or huge embedded assets if you can.

## How to capture a fixture

The simplest reliable method:

1. Open the thread in your browser.
2. Save the page as **HTML only** (not "complete"/"web archive"), e.g.
   *Save As → Web Page, HTML Only*. This keeps the markup an adapter actually parses
   and avoids bundling large media.
3. **Sanitize the saved file** so it is deterministic and offline-safe:
   - Delete every `<script>` and `<iframe>` element.
   - Remove or blank out remote references — `src`/`href`/`srcset` pointing at
     `http(s)://` URLs (images, stylesheets, fonts, beacons). A placeholder such as
     `removed` is fine; adapters key off tags and classes, not the remote assets.
   - Anonymize usernames and post bodies as described under **What to avoid** above.

   The result should open in a browser with **no network access** and run **no
   scripts**.
4. Save it under a folder named for the forum software or site, for example:

   ```text
   fixtures/
   └── discourse/
       └── example-thread.html
   ```

5. Add a short note in the PR with:
   - the **forum software** (if known): Discourse, phpBB, XenForo, vBulletin, custom…
   - the **original URL** (so the source is traceable),
   - anything notable: nested replies, role labels, unusual pagination.

Keep extractor fixtures under the owning package's `test/fixtures/` directory
and add assertions in the adjacent test suite.

## Submitting

Open a **Forum support request** issue (or a PR) and attach or include your fixture.
Mention whether you'd also like to try writing the JSON adapter for it — see
**[ADAPTERS.md](ADAPTERS.md)**. Thank you for helping ForumForge support more
forums!
