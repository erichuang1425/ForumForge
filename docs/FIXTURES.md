# Contributing HTML fixtures

An **HTML fixture** is a saved copy of a representative forum thread page. Fixtures
are the foundation of reliable adapters: they let us build and test an adapter
against real markup **deterministically**, without repeatedly hitting a live forum.

Submitting a fixture is one of the most useful contributions you can make — even if
you never write an adapter yourself. See **[../CONTRIBUTING.md](../CONTRIBUTING.md)**
and the adapter guide in **[ADAPTERS.md](ADAPTERS.md)**.

> **Status:** The fixture-based test harness lands in Phase 5 (see
> **[../ROADMAP.md](../ROADMAP.md)**). This guide describes how to capture and submit
> fixtures now so adapters can be built against them.

## What makes a good fixture

- A **real, public** thread page from the forum you want supported.
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

5. Add a short note (in the PR or a sibling `.md`) with:
   - the **forum software** (if known): Discourse, phpBB, XenForo, vBulletin, custom…
   - the **original URL** (so the source is traceable),
   - anything notable: nested replies, role labels, unusual pagination.

> The `fixtures/` directory is a convention for now; the exact layout and any test
> runner will be finalized when the adapter test harness is built (Phase 5).

## Submitting

Open a **Forum support request** issue (or a PR) and attach or include your fixture.
Mention whether you'd also like to try writing the JSON adapter for it — see
**[ADAPTERS.md](ADAPTERS.md)**. Thank you for helping ForumForge support more
forums!
