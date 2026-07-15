# ForumForge privacy notice

Last updated: 2026-07-15

This notice describes the current pre-release source build. ForumForge is
local-first: it processes the page the user chooses and does not operate a
ForumForge account, analytics service, or remote backend.

## Data processed on a forum page

When the user clicks the toolbar action, ForumForge temporarily reads the active
tab's thread structure and visible post data, including titles, authors,
timestamps, post bodies, permalinks, and reply relationships. Processing occurs
inside the browser to create the side-panel view.

The current code does not transmit that page content to the maintainer or any
third-party service.

## Data stored on the device

ForumForge uses `chrome.storage.local` for:

- per-thread read-history identifiers and visit state;
- saved-post snapshots, including the source URL, author, and saved content;
- private notes keyed by author and forum origin.

This data stays in the browser profile. ForumForge has no server copy and cannot
recover it.

Saved posts can be exported to Markdown. Individual saves can be removed with
their Save toggle, and a note can be cleared by saving it empty. A bulk clear
control is not implemented yet. Until it is, users can remove the extension (or
clear its extension storage through browser developer tools) to delete all local
ForumForge data.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `activeTab` | Read only the tab on which the user invokes ForumForge |
| `scripting` | Inject the extractor on demand after that user action |
| `sidePanel` | Display the reading interface beside the current tab |
| `storage` | Keep read history, saves, and notes on the device |

The manifest declares no host permissions and no always-on content scripts.
Chrome 116 is the current minimum because the toolbar action calls
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
