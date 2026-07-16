# Security policy

ForumForge reads untrusted forum markup inside a browser-extension workflow and
stores user-created data locally. Security and privacy boundaries are part of
the product contract, not optional polish.

## Supported versions

| Version | Support |
| --- | --- |
| Current `main` / pre-release development line | Best-effort security fixes |
| Tagged releases | None published yet |

Once v0.1 is released, this table will identify supported release lines.

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability.

Email **erichuang1425@gmail.com** with:

- the affected commit/version and browser;
- impact and realistic attack conditions;
- minimal reproduction steps or proof of concept;
- whether the report may be credited after disclosure.

If GitHub private vulnerability reporting is enabled for the repository, that
channel is also appropriate. Never attach private forum content, cookies,
tokens, or personal notes unless they are essential and safely redacted.

The maintainer targets acknowledgement within 72 hours and an initial severity
assessment within seven days. Complex fixes may take longer; material updates
will be shared with the reporter.

## Security invariants

- **User-selected access:** `activeTab` and on-demand injection are used instead
  of broad host permissions or always-on content scripts.
- **Untrusted content:** extracted HTML is rebuilt through the allowlist
  sanitizer in `apps/extension/src/sanitize.ts` before rendering.
- **Validated boundaries:** messages crossing extension contexts are checked by
  runtime guards before the page reader, side panel, or service worker acts on
  them.
- **Isolated page UI:** the on-page launcher and reader render in a closed
  shadow root using packaged styles and no remote assets.
- **Local-first storage:** read history, saved post snapshots, and notes use
  `chrome.storage.local`.
- **Non-destructive upgrades:** storage migrations are idempotent, commit their
  version marker last, and fail closed on invalid or newer schemas.
- **Scoped deletion:** the confirmed clear-data action removes only centrally
  registered ForumForge user-data keys and never calls
  `chrome.storage.local.clear()`. A generation and clear-state record block
  stale or queued writes during deletion and until a failed clear is retried.
- **No hidden network path:** the current extension has no telemetry, analytics,
  background fetch, WebSocket, or remote-processing code.
- **Deterministic fixtures:** repository fixtures contain no active embedded
  content or remote-loading resources.
- **Declarative adapters first:** the planned JSON adapter tier cannot execute
  arbitrary code. Any future code adapter requires explicit trust and review.

The Phase 2 JSON boundary and its processing budgets are specified in the
[declarative adapter threat model](docs/ADAPTER_THREAT_MODEL.md). Its isolated
schema package rejects unsafe structure with bounded path-based errors, but it
is not connected to the v0.1 extension runtime. Adapter files must pass through
its production parser; the exported JSON Schema alone is not an acceptance gate.

Automated tests and `pnpm repo:check` enforce several of these invariants.
Changing an enforced boundary requires a documented product and threat-model
decision, matching tests, and maintainer approval.

## In scope

Examples include:

- cross-site scripting or unsafe URL handling in either reading interface;
- malformed message payloads that cause unsafe behavior;
- unauthorized page access or unexpectedly broad extension permissions;
- leakage, corruption, or unintended cross-origin mixing of local user data;
- malicious fixture or adapter content that executes or loads remotely;
- supply-chain compromise affecting the shipped extension.

## Usually out of scope

- flaws in a forum site itself;
- reports that require a user to intentionally modify the source or disable
  browser security controls;
- social engineering without a ForumForge vulnerability;
- automated scanner output without a reproducible impact;
- denial of service requiring unrealistic local resource use.

## Disclosure

Please allow a reasonable remediation window before public disclosure. The
maintainer will coordinate a fix, release notes, credit (if desired), and a
GitHub security advisory when appropriate. Good-faith research that respects
privacy and avoids data destruction is welcome.
