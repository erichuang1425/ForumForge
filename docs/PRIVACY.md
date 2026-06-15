# Privacy

ForumForge is **local-first** and **privacy-respecting** by design. It is a
reader-side enhancement layer for forums you already have access to — not a
tracking, scraping, or data-collection product.

> **Status:** Early planning / prototype — there is no released extension yet. This
> document states the privacy commitments the project is built around. It is not a
> legal privacy policy for a shipped product; a formal policy will accompany the
> first release.

## What ForumForge stores, and where

By default, the following stay **on your device**:

- read history (what you've already seen, for "new since last visit")
- saved posts / comments
- local user notes and tags
- per-site settings
- installed adapters

There is **no account** required for core features, and your data is not sent to
any ForumForge server — there is no ForumForge server in the default design.

## What ForumForge does not do

- No tracking or analytics by default.
- No hidden third-party network requests.
- No remote summaries by default.
- No selling or sharing of user data.
- Local notes stay local.

## AI features are opt-in

Any AI-assisted feature (for example, optional summaries) is **off by default** and
must be explicitly enabled. Where practical, you can point AI features at **your own
provider or a local model**, so your content isn't sent anywhere you didn't choose.

## Optional sync (future)

Cross-device sync is a *possible future feature*, not part of the default
experience. If added, it will be **optional**, clearly disclosed, and designed to
keep your data under your control (e.g. end-to-end encrypted). It will never be
turned on without your action.

## Adapters and your data

Adapters read the forum page you're viewing to extract its posts. They must not
collect unrelated data, bypass access controls, or make unnecessary network
requests. Safe (JSON) adapters can't run code or make network requests at all;
advanced (TypeScript) adapters are reviewed before inclusion in any public
registry. See **[../SECURITY.md](../SECURITY.md)**.

## Permissions

The extension requests **narrow, justified** permissions only — each tied to a
concrete feature. Broad "just in case" permissions are not requested.

---

For the broader product stance, see **[../README.md](../README.md)** and
**[../Initial Plan.md](../Initial%20Plan.md)**.
