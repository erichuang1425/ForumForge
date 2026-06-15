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
- **Scrub personal data.** Remove or redact anything sensitive — private messages,
  email addresses, IP addresses, real names you wouldn't want republished. Posts on
  a public thread are fine; anything that wasn't already public is not.
- **Don't include auth tokens or cookies.** Saved pages sometimes embed session
  identifiers in URLs or scripts — remove them.
- Keep it reasonably small; trim unrelated pages or huge embedded assets if you can.

## How to capture a fixture

The simplest reliable method:

1. Open the thread in your browser.
2. Save the page as **HTML only** (not "complete"/"web archive"), e.g.
   *Save As → Web Page, HTML Only*. This keeps the markup an adapter actually parses
   and avoids bundling large media.
3. Save it under a folder named for the forum software or site, for example:

   ```text
   fixtures/
   └── discourse/
       └── example-thread.html
   ```

4. Add a short note (in the PR or a sibling `.md`) with:
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
