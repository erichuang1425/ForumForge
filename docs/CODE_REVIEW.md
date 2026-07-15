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

## Evidence checklist

- [ ] A linked issue or clear acceptance criteria exists.
- [ ] New tests fail without the intended change.
- [ ] `pnpm verify` passed on the final diff.
- [ ] Browser evidence is attached when the extension behavior changed.
- [ ] Permission, dependency, storage, privacy, and security effects are stated.
- [ ] User-visible behavior and compatibility changes are in `CHANGELOG.md`.
- [ ] Generated files, secrets, authentic fixture content, and unrelated edits
      are absent.
- [ ] Documentation describes what exists now and labels planned work as planned.

Use this guide for human review and Codex `/review` requests.
