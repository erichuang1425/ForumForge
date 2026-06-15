# Project memory

A lightweight, file-based memory so lessons survive across agent sessions. This is
**project memory** for anyone (human or AI agent) working in ForumForge — not a
substitute for the product spec or the docs.

## Layout

```text
.memory/
├── README.md      # this file
└── lessons/       # one lesson per file
```

## What belongs here

- **Corrections** — "we tried X, it was wrong, do Y instead" (and why).
- **Confirmed approaches** — "the agreed way to do X in this repo is Y."
- Non-obvious working knowledge a future session would otherwise rediscover.

## What does NOT belong here

- Anything the repo already records: the product spec
  ([Initial Plan.md](../Initial%20Plan.md)), [README.md](../README.md),
  [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md), the code, or git history.
  Link to those instead of copying them.
- Routine session journaling or task lists.
- Secrets, credentials, or personal data.

## Rules

- **One lesson per file** in `lessons/`.
- **Put a one-line summary on the first line** (an `# H1`), so the lesson is
  scannable without opening it.
- **Update an existing lesson** instead of creating a near-duplicate.
- **Delete a lesson** that turns out to be wrong — wrong memory is worse than none.
- Keep lessons short and specific.

## File format

Name files `NNNN-short-kebab-title.md` (e.g. `0001-prefer-json-adapters.md`).
Use this template:

```markdown
# One-line summary of the lesson

**Type:** correction | confirmed-approach
**Date:** YYYY-MM-DD

What was learned, and why it matters. Keep it concise. If it corrects an earlier
assumption, say what the wrong assumption was. Link related docs or lessons
instead of duplicating them.
```

`lessons/` starts empty — add the first lesson when there's something genuinely
worth remembering.
