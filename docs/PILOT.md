# ForumForge 0.1.0 pilot runbook

Use this runbook only after the exact candidate ZIP has completed the applicable
release matrix. A pilot is observation, not proof of broad compatibility or
adoption. Participation is voluntary, and publishing or distributing a build
still requires explicit maintainer approval.

## Pilot scope

- Chrome stable 116 or newer on a desktop operating system.
- A small number of opted-in participants who understand they are testing an
  unpacked release candidate.
- Public or synthetic forum pages only. Do not use confidential, paywalled, or
  access-controlled content for a report.
- One or more applicable rows from the current
  [compatibility matrix](COMPATIBILITY.md). The visual-release priorities are
  Nairaland, Hacker News, PTT, 4chan, Arca, DC Inside, FMKorea, and Stack
  Overflow. A result on one page does not establish broad site, theme, forum-
  engine, or version compatibility.
- F95Zone is not a claimed pilot target until the evidence-intake procedure
  below produces a sanitized representative fixture and a real-browser result.

Known limitations: ForumForge reads only the DOM currently loaded in the active
tab. It does not crawl pagination, force lazy content to load, or bypass login
and access controls. Firefox and Safari are outside this pilot.

### F95Zone evidence intake (not a support claim)

Only a maintainer who can lawfully access a harmless public thread should
prepare this input. Start from a logged-out page and retain only the smallest
DOM fragment needed to identify a thread, its posts, authors, timestamps,
permalinks, hierarchy, and missing-field behavior. Replace all prose, names,
IDs, dates, and URLs with neutral synthetic values. Remove scripts, styles,
forms, media, advertisements, analytics markup, tokens, cookies, account data,
private messages, and adult or otherwise sensitive content.

The fixture must be reviewed as text before it enters the repository. A
dedicated detector and extractor then need positive, missing-field, malformed-
identity, and false-positive tests. Finally, the exact candidate ZIP must be
run on a harmless public page in an isolated browser profile. A generic or
XenForo-derived parse by itself is not F95Zone compatibility evidence.

## Package handoff

Give each participant all of the following together:

- `forumforge-0.1.0-chrome.zip` from the reviewed candidate commit;
- the expected SHA-256 checksum and source commit;
- a link to the current [privacy notice](PRIVACY.md); and
- a private contact for security reports plus the normal feedback channel.

Ask the participant to verify the checksum, extract the ZIP into a dedicated
folder, open `chrome://extensions`, enable Developer mode, choose **Load
unpacked**, and select that folder. They should record the extension ID and
should not replace an existing ForumForge test installation unless the pilot is
explicitly exercising the documented upgrade procedure.

## Core session

1. Confirm installation shows version 0.1.0, the ForumForge icon, and no host
   access request or extension error.
2. Invoke the toolbar action, then read one appropriate page from each
   applicable extractor class in the immersive view. Close it, confirm the slim
   launcher does not obstruct the forum, reopen it from the launcher, and record
   missing, duplicated, misordered, unsafe, or visually obstructed content.
3. Navigate or switch tabs during one read attempt. Wrong-tab content must never
   render or enter read history.
4. Test a restricted Chrome page and record whether the failure message explains
   that the page cannot be read.
5. Save and un-save a sample post, create and clear a deliberately non-sensitive
   note, export saved posts, restart Chrome, and verify the expected remaining
   state.
6. Use only the keyboard for a pass through the immersive reader and local
   library, then check narrow widths and 200% zoom. Record lost focus, hidden
   controls, page content covered by the launcher, and unclear announcements.
7. If the participant agrees to test deletion, seed only disposable sample
   data, cancel the first confirmation, then confirm a clear and verify that the
   UI and restart state agree. Do not ask a pilot participant to risk valuable
   notes or saved posts.

The maintainer's release acceptance remains the source of truth for the
complete matrix in [TESTING.md](TESTING.md). Pilot feedback supplements that
matrix and does not replace it.

## Feedback template

```text
ForumForge version: 0.1.0
Source commit:
ZIP SHA-256:
Chrome version and OS:
Extension ID:
Page class:
  Nairaland / Hacker News / PTT / 4chan / Arca / DC Inside /
  FMKorea / Stack Overflow / Discourse / phpBB / XenForo /
  vBulletin / generic / restricted / F95Zone evidence intake
Public URL or redacted page description:
Scenario:
Expected:
Observed:
Reproduction steps:
Restarted Chrome? yes/no
Permission, privacy, or unexpected-network concern? yes/no + details
Accessibility or layout concern? yes/no + details
Sanitized screenshot or console text (optional):
```

Never include cookies, tokens, credentials, private messages, private forum
content, real private notes, or an unredacted browser profile path. Suspected
vulnerabilities follow [SECURITY.md](../SECURITY.md), not a public issue.

## Stop conditions

Pause the pilot and preserve evidence if any participant observes:

- data loss, data reappearing after deletion, or cross-origin/thread mixing;
- content from a tab other than the one the user selected;
- executable or unsafe page content surviving sanitization;
- a new permission, host-access request, hidden network request, or remote code;
- an unrecoverable install, migration, restart, or clear failure; or
- a high-impact accessibility failure that blocks core operation.

Do not work around a release defect by weakening the instructions or changing
the artifact in place. Fix it through a new candidate with a new checksum and
repeat the affected acceptance scenario.

## Closeout

Track participants only after they actually run a session; invitations and
maintainer-authored tests are not adoption. Summarize outcomes in issue
[#17](https://github.com/erichuang1425/ForumForge/issues/17) only after explicit
authorization to post. Record denominators, failures, browser/OS coverage, and
known gaps. Do not publish participant identities or private content.

Participants can remove the unpacked extension from `chrome://extensions` when
finished. Removal deletes its extension storage, but any Markdown files they
exported remain ordinary files and must be deleted separately if desired.
