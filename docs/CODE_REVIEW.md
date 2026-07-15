# Code review guide

Review the highest-consequence risks first. A green automated check does not
replace browser evidence or security judgment.

## Review order

1. **Correctness and regressions:** Does the change satisfy the issue, handle
   failure states, and preserve existing behavior?
2. **Permissions and privacy:** Does it broaden the manifest, add a remote
   request, collect data, or change what is stored or exported?
3. **Untrusted boundaries:** Are page DOM, URLs, HTML, fixtures, and extension
   messages treated as hostile until validated or sanitized?
4. **Data safety:** Could an update lose, mix, leak, or make incompatible local
   read history, saves, or notes?
5. **Adapter behavior:** Is detection narrow, extraction graceful, and fixture
   coverage representative without live requests?
6. **User experience:** Are empty, denied, loading, and persistence-failure
   states understandable and accessible?
7. **Maintenance:** Is the change focused, dependency-light, typed at public
   boundaries, and documented without duplicating a source of truth?

## Storage lifecycle checks

Apply these whenever a change reads, writes, migrates, exports, or deletes local
data:

- [ ] Every new or changed prefix and record shape is documented; incompatible
      shape changes bump the schema version.
- [ ] Schema preparation runs before feature access. Migrations are deterministic
      and idempotent, write the next marker last, and preserve the pre-schema
      baseline without silently discarding malformed or unknown data.
- [ ] Invalid and newer versions fail closed. Downgrade and rollback behavior is
      understood before release.
- [ ] Destructive actions use the central ForumForge ownership allowlist, never
      `chrome.storage.local.clear()`, and attempt/report partial deletion safely.
- [ ] Clear-data confirmation, cancellation, progress, success, failure, focus,
      and rendered-state reset are understandable with keyboard and assistive
      technology.
- [ ] Deterministic migration/clear tests pass, and same-extension-ID Chrome
      upgrade and deletion evidence is attached for a release-facing change.
      Fake-backend tests do not prove browser update behavior.

## Evidence checklist

- [ ] A linked issue or clear acceptance criteria exists.
- [ ] New tests fail without the intended change.
- [ ] `pnpm verify` passed on the final diff.
- [ ] Browser evidence is attached when the extension behavior changed.
- [ ] Permission, dependency, storage, privacy, and security effects are stated.
- [ ] Storage migration/clear evidence is attached when local-data behavior
      changed.
- [ ] User-visible behavior and compatibility changes are in `CHANGELOG.md`.
- [ ] Generated files, secrets, authentic fixture content, and unrelated edits
      are absent.
- [ ] Documentation describes what exists now and labels planned work as planned.

Use this guide for human review and Codex `/review` requests.
