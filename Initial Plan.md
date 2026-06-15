ForumForge

GitHub repo description:

Open-source browser extension and adapter framework for modernizing messy forum threads with clean reading, thread maps, local notes, and custom site adapters.

Suggested Topics:
browser-extension, webextensions, forums, forum-tools, open-source, local-first, adapter-framework, discourse, phpbb, xenforo, thread-reader, knowledge-management

# ForumForge

**Open-source tools to modernize any forum from your browser.**

ForumForge is a local-first browser extension and adapter framework that turns messy forum threads into clean reading views, thread maps, saved knowledge, and new-comment tracking.

Old forums still contain some of the best knowledge on the internet. The problem is that many of them are difficult to read, search, revisit, or contribute to. ForumForge helps users make those communities more usable without requiring the forum owner to rebuild the site.

> Your favorite forum does not need to modernize. ForumForge can modernize it from your browser.

---

## What ForumForge does

ForumForge adds a useful layer on top of forum pages:

* Clean reading mode for long threads
* New posts since your last visit
* OP, moderator, and staff highlighting
* Local notes and tags for users
* Saved comments and useful posts
* Markdown export for important thread knowledge
* Thread maps for long discussions
* Unanswered-question detection
* Optional summaries
* Custom adapters for niche forums

The core idea is simple:

> Every forum is different, so ForumForge should be easy to adapt.

Instead of hardcoding support for a few websites, ForumForge uses adapters. Users and communities can create adapters for their own forum sites using CSS selectors, JSON recipes, or advanced TypeScript adapters.

---

## Why this exists

Forums are still where a lot of serious knowledge lives:

* hardware troubleshooting
* game modding
* immigration and visa advice
* university communities
* programming help
* car repair
* niche hobbies
* fan communities
* old technical archives

But many valuable forum threads are buried inside:

* outdated layouts
* huge quote chains
* repeated replies
* unclear accepted answers
* missing summaries
* poor search
* no memory of who is reliable
* no easy way to track updates

ForumForge is built to rescue signal from messy threads.

---

## Product philosophy

ForumForge is not meant to be another closed AI wrapper.

It is designed around five principles:

1. **Open source first**
   The extension, adapter format, and adapter examples should be inspectable and modifiable.

2. **Local first**
   Notes, read history, saved comments, and user tags should stay on the user’s device by default.

3. **Adapter driven**
   Any forum should be supportable without waiting for the core maintainers.

4. **Useful without AI**
   Clean reading, new-comment tracking, OP highlights, user notes, and saved comments should work even without summaries.

5. **Community extensible**
   Users should be able to request, create, improve, and share adapters.

---

## Core features

### Clean reading mode

ForumForge can turn cluttered forum layouts into a focused reading experience.

Planned reading tools include:

* cleaner typography
* quote collapsing
* image and code block handling
* wider layout option
* dark mode compatibility
* keyboard navigation
* distraction reduction

---

### New since last visit

ForumForge remembers what you have already read locally and highlights posts that appeared since your last visit.

This is especially useful for long-running threads, support discussions, and active community topics.

---

### OP and moderator highlighting

ForumForge can highlight important voices in a thread:

* original poster
* moderators
* admins
* staff
* users you personally marked as helpful
* users you personally marked as unreliable

This helps readers understand which replies matter most.

---

### Local user notes

Users can attach private local notes to usernames.

Example:

```text
Helpful with GPU driver issues.
Usually gives detailed repair advice.
Check their sources before trusting pricing claims.
```

These notes are stored locally by default.

---

### Saved comments

ForumForge lets users save useful posts from any supported forum thread.

Saved comments can later be exported as Markdown for personal notes, troubleshooting logs, research, or documentation.

---

### Thread map

Long discussions can be converted into a structured map:

```text
Original question
├── Practical solution
├── Alternative fixes
├── Warnings
├── OP updates
├── Moderator replies
└── Unanswered questions
```

The goal is not only to summarize the thread, but to make the structure of the discussion visible.

---

### Unanswered-question radar

ForumForge can detect likely unanswered questions inside threads.

This helps readers find places where they can contribute and helps communities reduce repeated unanswered posts.

---

### Markdown export

A useful thread can be exported into a clean Markdown note:

```markdown
# How to fix monitor no signal after laptop sleep

## Confirmed fixes

- Disable monitor deep sleep
- Check display input source
- Replace faulty HDMI/USB-C cable
- Update GPU driver

## Warnings

- Avoid repeated hard shutdowns
- Some USB-C cables only support charging

## Source posts

- Post #12 by user123
- Post #27 by moderator
```

---

## Adapter system

ForumForge supports forums through adapters.

An adapter teaches ForumForge how to read a particular forum page.

Adapters define things like:

* thread title
* post containers
* usernames
* timestamps
* post bodies
* permalinks
* reply nesting
* next-page buttons
* moderator/admin labels
* OP detection

---

## Adapter types

### 1. JSON selector adapters

The safest and simplest adapter type.

Example:

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

---

### 2. Visual adapter builder

ForumForge should eventually include an Adapter Studio.

The user flow:

1. Open a forum thread.
2. Click the ForumForge extension icon.
3. Choose **Create adapter for this site**.
4. Click the thread title.
5. Click a post container.
6. Click the username.
7. Click the timestamp.
8. Click the post body.
9. Preview extracted posts.
10. Save or export the adapter.

This allows power users to support custom forum sites without writing extension code.

---

### 3. TypeScript adapters

For complex sites, developers can write advanced adapters.

```ts
import type { ForumAdapter } from "@forumforge/adapter-sdk";

export const adapter: ForumAdapter = {
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
      links: [...el.querySelectorAll("a")].map((a) => a.href)
    }));
  }
};
```

---

## Planned built-in adapters

Initial targets:

* Discourse
* Hacker News
* phpBB
* XenForo
* vBulletin-style forums
* Generic fallback parser

The generic fallback parser will not be perfect. Its goal is to provide basic extraction until a better community adapter exists.

---

## Architecture

```text
forumforge/
├── apps/
│   ├── extension/
│   ├── adapter-studio/
│   └── docs/
│
├── packages/
│   ├── core/
│   ├── adapter-sdk/
│   ├── parser/
│   ├── storage/
│   ├── ui/
│   └── ai-optional/
│
├── adapters/
│   ├── discourse/
│   ├── hackernews/
│   ├── phpbb/
│   ├── xenforo/
│   └── generic/
│
├── examples/
│   ├── json-adapter/
│   └── typescript-adapter/
│
└── docs/
```

---

## Local-first storage

ForumForge should store user data locally by default:

* read history
* saved posts
* user notes
* user tags
* site settings
* installed adapters

Cloud sync may be added later, but it should be optional.

---

## Privacy

ForumForge should not track users.

Default privacy expectations:

* No account required
* No analytics by default
* No remote summaries by default
* No selling user data
* No hidden third-party requests
* Local notes stay local
* AI features should be opt-in

If AI summaries are added, users should be able to use their own provider or local model where practical.

---

## Security

ForumForge should treat custom adapters carefully.

Safe JSON adapters should support:

* CSS selectors
* attribute extraction
* text cleanup rules
* URL match patterns

They should not support:

* arbitrary remote JavaScript
* hidden network requests
* eval
* cross-site tracking
* unreviewed code execution

Advanced JavaScript or TypeScript adapters should be clearly marked and reviewed before being included in any public adapter registry.

---

## Roadmap

### Phase 0 — Foundation

* [x] Extension shell
* [x] Content script
* [x] Side panel UI
* [x] Core post model
* [x] Local storage layer
* [x] Basic generic extractor

### Phase 1 — First useful version

* [x] Clean reading mode
* [ ] OP highlighting
* [ ] New posts since last visit
* [ ] Save comments
* [ ] Local user notes
* [ ] Markdown export
* [ ] Discourse adapter
* [ ] Hacker News adapter

### Phase 2 — Adapter ecosystem

* [ ] JSON adapter format
* [ ] Adapter validator
* [ ] Adapter import/export
* [ ] Adapter examples
* [ ] phpBB adapter
* [ ] XenForo adapter
* [ ] vBulletin-style adapter
* [ ] Adapter contribution guide

### Phase 3 — Adapter Studio

* [ ] Click-to-select thread title
* [ ] Click-to-select post container
* [ ] Click-to-select author
* [ ] Click-to-select timestamp
* [ ] Click-to-select post body
* [ ] Preview extracted posts
* [ ] Save local adapter
* [ ] Export adapter JSON

### Phase 4 — Intelligence layer

* [ ] Thread map
* [ ] Best-answer detection
* [ ] Unanswered-question detection
* [ ] OP update detection
* [ ] Useful-link extraction
* [ ] Optional summaries
* [ ] Optional local or user-key AI support

### Phase 5 — Community layer

* [ ] Public adapter registry
* [ ] Adapter quality badges
* [ ] Adapter requests
* [ ] Fixture-based adapter tests
* [ ] Community-submitted adapters
* [ ] Broken-adapter reporting

---

## Possible future features

* Cross-device encrypted sync
* Daily digest for followed forum threads
* Related-thread discovery
* Personal knowledge base export
* Obsidian export
* Notion export
* Local semantic search
* Forum-specific keyboard shortcuts
* Accessibility improvements
* Community-maintained adapter lists
* Self-hosted adapter registry

---

## What ForumForge is not

ForumForge is not:

* a replacement for forum software
* a social network
* a scraping product
* a closed AI wrapper
* a moderation bot
* a tool for bypassing private communities
* a way to copy paid or restricted content

ForumForge is a reader-side enhancement layer for forums the user can already access.

---

## Development status

ForumForge is currently in early planning and prototype stage.

The first goal is to build a working browser extension MVP with:

* local storage
* generic thread extraction
* Discourse support
* Hacker News support
* saved comments
* local user notes
* new-comment tracking
* Markdown export

---

## Contributing

Contributions are welcome.

Good first contributions include:

* requesting support for a forum
* submitting an HTML fixture
* creating a JSON adapter
* improving parser accuracy
* improving documentation
* testing the extension on old forums
* designing the Adapter Studio workflow

See `CONTRIBUTING.md` for details.

---

## License

MIT License.

ForumForge should remain open, hackable, and community-extensible.

Recommended Structure:
forumforge/
├── README.md
├── LICENSE
├── SECURITY.md
├── ROADMAP.md
├── CONTRIBUTING.md
├── package.json
├── pnpm-workspace.yaml
├── apps/
│   └── extension/
├── packages/
│   ├── core/
│   ├── adapter-sdk/
│   ├── parser/
│   ├── storage/
│   └── ui/
├── adapters/
│   ├── discourse/
│   ├── hackernews/
│   └── generic/
├── docs/
│   ├── ADAPTERS.md
│   └── PRIVACY.md
└── .github/
    ├── ISSUE_TEMPLATE/
    └── PULL_REQUEST_TEMPLATE.md

# Recommended `LICENSE`

```text
MIT License

Copyright (c) 2026 Eric Huang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

# Recommended `.gitignore`

```gitignore
# Dependencies
node_modules/
.pnpm-store/
.yarn/
.yarn-cache/

# Build outputs
dist/
build/
out/
.output/
.next/
.nuxt/
.svelte-kit/
.vite/
.turbo/
.cache/
.parcel-cache/

# Browser extension build artifacts
web-ext-artifacts/
*.crx
*.xpi
*.zip
*.pem
key.pem
extension-key.pem

# Test and coverage
coverage/
.nyc_output/
playwright-report/
test-results/
vitest-results/
*.lcov

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Environment variables
.env
.env.*
!.env.example
!.env.local.example

# TypeScript
*.tsbuildinfo

# IDE / editor
.vscode/*
!.vscode/extensions.json
!.vscode/settings.example.json
.idea/
*.swp
*.swo

# OS files
.DS_Store
.AppleDouble
.LSOverride
Thumbs.db
ehthumbs.db
Desktop.ini

# Temporary files
tmp/
temp/
*.tmp
*.temp

# Local database / storage experiments
*.sqlite
*.sqlite3
*.db

# Generated docs
docs/.vitepress/dist/
storybook-static/

# Package manager notes
# Keep lockfiles committed for reproducible installs:
# pnpm-lock.yaml
# package-lock.json
# yarn.lock
```
