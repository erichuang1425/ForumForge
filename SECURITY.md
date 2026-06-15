# Security Policy

ForumForge runs in the user's browser and reads forum pages the user already has
access to. Because it executes in a privileged extension context and can load
community-authored adapters, we take security and privacy seriously.

> **Status:** Early planning / prototype. There is no released extension yet. This
> policy describes the security model the project is being built around.

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** — do not open a public issue
for security problems.

- Use GitHub's **private vulnerability reporting** ("Report a vulnerability" under
  the repository's Security tab) once enabled, or
- email the maintainer at **erichuang1425@gmail.com** with details and steps to
  reproduce.

We'll acknowledge your report, investigate, and coordinate a fix and disclosure.
Please give us a reasonable window to address the issue before any public
disclosure.

## Threat model

ForumForge is a **reader-side enhancement layer**. It is explicitly **not**:

- a way to bypass private communities, access controls, or paywalls;
- a scraping product or large-scale automation tool;
- a way to copy paid or restricted content.

Key concerns we design against:

- **Untrusted page content.** Forum HTML is untrusted input. Extracted content
  must be sanitized before rendering; never inject unsanitized markup.
- **Community-authored adapters** running in a privileged context (see below).
- **Over-broad extension permissions** widening the attack surface.

## Adapter security model

Adapters teach ForumForge how to read a forum. They come in tiers, safest first:

- **JSON selector adapters (safe).** Declarative only — CSS selectors, attribute
  extraction, text-cleanup rules, and URL match patterns. They **cannot** run
  arbitrary JavaScript, call `eval`, make hidden network requests, perform
  cross-site tracking, or execute unreviewed code. This is the preferred tier.
- **TypeScript / JavaScript adapters (advanced).** These are code that runs in the
  user's browser. They are **clearly marked as code**, and are **reviewed before
  inclusion** in any public adapter registry. Treat installing a third-party code
  adapter with the same caution as installing any browser extension.

All adapters — regardless of tier — must not collect unrelated user data, bypass
access controls, or make unnecessary network requests.

## Permissions

Extension permissions stay **narrow and justified**. Every host permission or
capability must map to a concrete feature; we don't request broad permissions
"just in case." Permission changes are reviewed as security-relevant.

## Privacy commitments

ForumForge is local-first by default:

- no account required for core features;
- no tracking or analytics by default;
- no hidden third-party network requests;
- local notes, tags, read history, and saved posts stay on-device by default;
- AI features are opt-in only, and can use the user's own provider or a local
  model where practical.

See **[README.md](README.md)** and **[Initial Plan.md](Initial%20Plan.md)** for the
broader privacy and product stance.
