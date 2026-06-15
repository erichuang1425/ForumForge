# CLAUDE.md

Claude-specific working guidance for the ForumForge repository. This builds on
**[AGENTS.md](AGENTS.md)** — read that first; it holds the shared rules (mission,
boundaries, architecture, privacy/security, adapters, code style, what not to do).
This file only adds how **Claude** should work here.

---

## Before you start

1. **Read [AGENTS.md](AGENTS.md) first.** It is the shared contract for every
   agent in this repo. Don't restate it here — apply it.
2. **Read [Initial Plan.md](Initial%20Plan.md) before any major or architectural
   change.** It is the canonical product spec. For small, routine edits you don't
   need to re-read the whole plan, but never make a structural or product decision
   without grounding it there.
3. **Check `.memory/`** (see below) for lessons from past sessions before starting
   non-trivial work.

## Effort calibration

- **High effort** for architecture, product direction, the post model, the adapter
  SDK, privacy/security decisions, and anything that shapes the foundation. Think
  it through, weigh trade-offs, and ground decisions in the plan.
- **Lower effort** for routine, well-scoped edits — fixing a typo, a small doc
  tweak, a localized change with an obvious correct form. Don't over-ceremony
  simple work; just do it cleanly.
- Calibrate to impact and reversibility, not to how long the task feels.

## Use subagents for independent work

When subagents are available, **delegate genuinely independent subtasks** to run
them in parallel and keep the main thread focused. Good fits:

- broad codebase/plan exploration and search ("find every place X is defined");
- reviewing an existing plan or repo structure;
- an independent **documentation-consistency audit** after you've authored changes;
- proposing a minimal scaffold for a package about to be built.

Keep tightly-coupled authoring (e.g. files that must stay mutually consistent, like
this one and AGENTS.md) on the main thread — splitting it across cold-start agents
adds inconsistency risk. Subagents start without this conversation's context, so
give them self-contained prompts and relay what matters back to the user.

## Lightweight project memory

This repo keeps a small, file-based memory at **`.memory/`** so lessons survive
across sessions. See **[.memory/README.md](.memory/README.md)** for the format.
In short:

- One lesson per file in `.memory/lessons/`, with a one-line summary at the top.
- Record **corrections** ("we tried X, it was wrong, do Y") and **confirmed
  approaches** ("the agreed way to do X here is Y").
- **Don't duplicate** what the repo already records (the plan, README, AGENTS.md,
  code, git history). Memory is for the non-obvious working knowledge that isn't
  captured elsewhere.
- **Update** an existing lesson instead of adding a near-duplicate. **Delete** a
  lesson that turns out to be wrong.

Write a lesson when you learn something a future session would otherwise have to
rediscover. Don't journal routine work.

## Verifying and reporting

- **Audit every progress claim against actual tool output from this session.**
  Before you say a file was created, edited, tested, built, or verified, confirm a
  tool result in this session shows it. If you didn't do it, don't claim it.
- If a build/test isn't possible because the code or pipeline doesn't exist yet,
  **say that plainly.** Don't imply results you didn't produce.
- If you skipped something, say what and why.

## Final responses

- **Lead with the outcome** — one sentence stating what was completed.
- Then: files changed, verification performed, and anything intentionally not done.
- **Prefer clear summaries over dense shorthand.** Be concise but readable.
- **Don't end with an unexecuted plan.** No "I will now…" / "Next I would…" for
  work that's in scope — do it before ending the turn. Naming genuine follow-ups
  that are out of scope (or need the user) is fine; promising work you could have
  done is not.

Suggested final-response shape:

1. One sentence: what was completed.
2. Files changed.
3. Verification performed (or why none was possible).
4. Anything intentionally not done, and why.

## When to pause

Proceed autonomously on reversible, in-scope work (see AGENTS.md → "When to
proceed autonomously"). Pause only for:

- destructive or irreversible actions;
- a real change in product scope or a "ForumForge is NOT" boundary;
- anything weakening privacy/security defaults or broadening extension permissions;
- a decision needing information only the user has.
