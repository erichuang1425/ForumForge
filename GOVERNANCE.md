# Governance

ForumForge currently has one maintainer: Eric Huang
([@erichuang1425](https://github.com/erichuang1425)). This document makes the
single-maintainer model explicit while leaving a path for shared stewardship.

## Decisions

- Routine fixes and documentation changes are decided through pull-request
  review against the product boundaries, tests, and roadmap.
- Public contracts, permissions, storage migrations, remote behavior, security
  boundaries, and major scope changes require a design issue before
  implementation.
- When reasonable alternatives exist, the maintainer records the choice and
  trade-offs in the issue or pull request so the decision can be revisited.
- The canonical product boundaries in
  [Initial Plan.md](Initial%20Plan.md) win over an untracked implementation idea.

## Roles

Contributors may report, design, implement, test, document, and review changes.
The maintainer triages issues, protects release credentials, makes final merge
and release decisions, coordinates security response, and keeps project-health
claims evidence-based.

Sustained contributors may be invited to triage or maintain an area after
demonstrating sound review judgment, respectful collaboration, and consistent
care for privacy and compatibility. Expanded permissions are documented
publicly.

## Merge and release authority

Only a maintainer merges to protected branches, tags versions, publishes
artifacts, or changes extension-store listings. Approval is based on the
acceptance criteria in [CONTRIBUTING.md](CONTRIBUTING.md) and
[docs/CODE_REVIEW.md](docs/CODE_REVIEW.md), not contributor identity.

No contributor is expected to approve their own security-sensitive or
release-critical change when another qualified reviewer is available. Until
there is a second maintainer, high-risk changes should remain small,
well-tested, and publicly reviewable for a reasonable period.

## Conflicts and conduct

Technical disagreement should focus on user impact, evidence, reversibility,
and the project's stated boundaries. Conduct concerns follow
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). A maintainer involved in a conduct
complaint should seek an independent community reviewer before taking action
when one is available.

## Continuity

If the maintainer can no longer operate the project, priority is to transfer
repository and release access to an established contributor who accepts the
privacy and open-source commitments. If no successor exists, the repository
remains available under MIT and is marked unmaintained rather than implying
active support.
