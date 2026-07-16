# ForumForge privacy notice

Last updated: 2026-07-16

This notice describes the current untagged 0.1.0 release candidate. ForumForge
is local-first: it processes the page the user chooses and does not operate a
ForumForge account, analytics service, or remote backend.

## Data processed on a forum page

The toolbar action injects ForumForge only into the active tab selected by the
user, temporarily reads that page's thread structure and visible post data, and
opens the immersive reader. Processed fields can include titles, authors,
timestamps, post bodies, permalinks, and reply relationships. For reviewed
built-in adapters, processed fields can also include discussion layout, post
kind, PTT reaction direction, a displayed integer score, and accepted-answer
state. Processing occurs inside the browser to create the isolated on-page
view. Closing the reader leaves a slim launcher in that document until the page
is navigated or closed.

The reader's **Local library** action can open a secondary side panel for
compact reading, exports, and privacy controls. It does not grant access to any
additional tab or page.

The current code does not transmit that page content to the maintainer or any
third-party service.

## Data stored on the device

ForumForge uses `chrome.storage.local` for:

- per-thread read-history identifiers and visit state;
- saved-post snapshots, including the source URL, author, saved content, and any
  adapter-proven post kind, reaction, score, or accepted state present when it
  was saved;
- private notes keyed by author and forum origin.

This data stays in the browser profile. ForumForge has no server copy and cannot
recover it.

Saved posts can be exported to Markdown. Individual saves can be removed with
their Save toggle, and a note can be cleared by saving it empty. The panel's
**Clear local user data…** control asks for confirmation before permanently
deleting read history, saved posts, and private author notes. It reports success
or a possible partial failure; cancelling the confirmation changes nothing.
Removing the extension also deletes its local storage.

A downloaded Markdown export is an ordinary file outside extension storage.
ForumForge cannot delete that file through **Clear local user data** or when the
extension is removed.

User records remain until the user deletes them through one of those actions.
After a successful bulk clear, ForumForge retains numeric schema-version and
clear-generation metadata so open panels cannot resume against an ambiguous
storage lifecycle. Stable generation values are even; a clear publishes an odd
generation plus a `clearing` status before deletion, then a new even generation
after finalization. If the browser cannot store that initial guard, deletion
does not start. Once the guard exists, a later failure leaves it blocking until
a successful retry; it is normally marked `failed` and may remain `clearing` if
the browser also rejects that status update. These operational records contain
no page content, saved post, read history, or note.

Deletion is restricted to the documented ForumForge user-data prefixes and does
not call the browser's global storage-clear operation. The exact user and
operational key/record contracts are documented in
[`@forumforge/storage`](../packages/storage/README.md).

Schema preparation and migration happen locally in the browser. The schema 1
migration adopts existing unversioned read history, saves, and notes without
transmitting or rewriting them. Automated preservation tests pass, while the
same-profile Chrome upgrade check for the release artifact remains pending in
[TESTING.md](TESTING.md).

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `activeTab` | Read only the tab on which the user invokes ForumForge |
| `scripting` | Inject the packaged extractor and reader on demand after that user action |
| `sidePanel` | Display the optional local-library and privacy companion beside the current tab |
| `storage` | Keep read history, saves, and notes on the device |

The manifest declares no host permissions and no always-on content scripts.
Chrome 116 is the current minimum because the optional library action calls
`sidePanel.open()`.

## Network activity and telemetry

The current extension initiates no background network requests and contains no
telemetry, advertising, analytics, tracking pixels, remote fonts, or remote AI
calls. It can display safe links from a post; a network request happens only if
the user chooses to open such a link.

ForumForge does not sell personal information and has no data to sell.

## Fixtures and contributions

Test fixtures must contain only public, anonymized, synthetic thread content and
must be stripped of scripts, frames, remote resources, credentials, and personal
data. See [FIXTURES.md](FIXTURES.md).

## Future optional features

Any future sync, remote adapter registry, telemetry, or AI integration must be
separately disclosed, disabled by default where applicable, and reviewed before
release. This notice will be updated before such behavior ships.

## Security and contact

Extracted HTML is treated as untrusted and sanitized before rendering. Security
reports follow [../SECURITY.md](../SECURITY.md). Privacy questions may be sent to
**erichuang1425@gmail.com**.

Material changes to this notice will be documented in
[../CHANGELOG.md](../CHANGELOG.md) and dated above.
