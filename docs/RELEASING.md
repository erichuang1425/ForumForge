# Releasing ForumForge

Releases are cut from a clean, reviewed `main` after automated and manual
acceptance. Extension-store publishing remains manual until the project has a
reviewed credential and rollback process.

## Version sources

The root package, `apps/extension/package.json`, and
`apps/extension/manifest.json` carry the same three-part numeric extension
version. Prerelease suffixes are not valid in Chrome's manifest `version`.
Chrome accepts one to four numeric components; ForumForge uses three so the
same value is also a normal package version. See Chrome's
[version format](https://developer.chrome.com/docs/extensions/reference/manifest/version).

```bash
pnpm version:check
pnpm version:set 0.1.0
```

Normal development stays at `0.0.0`. Set `0.1.0` on the untagged release-candidate
branch before producing the exact ZIP used for browser acceptance; do not merge,
tag, or publish that version until the matrix passes. The private library
packages remain implementation workspaces and are not published independently.

## Release candidate

1. Confirm the implementation prerequisites are ready for browser acceptance.
   In particular, [issue #14](https://github.com/erichuang1425/ForumForge/issues/14)
   requires green migration/clear tests, a retained pre-schema baseline, and
   reviewed migration/clear behavior. Its same-extension-ID Chrome evidence is
   collected against the exact candidate in step 5 and blocks merging, tagging,
   and publishing that candidate rather than creating it.
2. Pull current protected `main` and start a normal `work/*` release branch.
3. Set the version and move relevant `CHANGELOG.md` entries from Unreleased to
   a dated release heading.
4. Run:

   ```bash
   corepack enable
   pnpm install --frozen-lockfile
   pnpm verify
   pnpm package:extension
   ```

5. Extract the generated ZIP to a clean directory and complete
   [TESTING.md](TESTING.md) against that exact artifact.
6. Verify the ZIP contains only `manifest.json`, `sidepanel.html`, and the
   three JavaScript bundles. Source maps and source files must not ship.
7. Compare the printed SHA-256 with `artifacts/*.sha256`.
8. Review the final diff against [CODE_REVIEW.md](CODE_REVIEW.md).
9. For a storage-changing release, attach before/after key inventories and state
   schema compatibility, downgrade behavior, and recovery steps in the release
   notes. Do not tag while the applicable upgrade or deletion rows remain
   unchecked.

## Tag and GitHub release

After the release pull request is merged and explicit maintainer approval is
given:

1. Verify `main` is clean and at the reviewed commit.
2. Create an annotated `v<version>` tag whose version exactly matches the
   manifest/package files.
3. Push the tag.
4. The release workflow reruns `pnpm verify`, checks tag/version agreement,
   creates the deterministic ZIP/checksum, and publishes a GitHub release.
5. Download the GitHub asset, confirm its checksum, and smoke-test it once more.

Never tag or publish from an unmerged feature branch.

## Store submission

Before the first Chrome Web Store submission:

- add reviewed 16, 32, 48, and 128 pixel extension icons;
- prepare accurate screenshots and listing copy;
- link the current privacy notice and support channel;
- confirm the permission justification matches the shipped manifest;
- complete the store's privacy questionnaire from observed behavior;
- retain the final ZIP, checksum, source commit, listing text, and review result.

Store publish is manual. A store rejection is fixed through a new reviewed
release candidate; do not silently replace an existing GitHub artifact.

## Rollback and hotfix

For a harmful release, stop store rollout where possible, mark the GitHub release
clearly, open a security or regression issue, and ship a higher patch version.
Do not rewrite tags or reuse versions. If local data is at risk, prioritize
preservation/migration and explain recovery steps in the release notes. Never
roll back to code that can write through a newer unknown schema; use a higher
patch release with an explicit forward migration or a user-confirmed reset.
