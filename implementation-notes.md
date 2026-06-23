# Implementation Notes

## 2026-06-23 - Human-Approval Production Gate

Added release infrastructure so approved live client content is promoted deliberately instead of auto-published from `main`.

- Added `Promote to Production` manual workflow. It requires an exact 40-character commit SHA, runs the shared QA gate against that SHA, waits on the `client-production` environment, then moves `refs/heads/production` to the approved SHA.
- Added `Rollback Production` manual workflow. It requires an exact known-good SHA, waits on the same environment, then restores the known-good tree in a new forward rollback commit on `production`.
- Added `scripts/production-gate.sh` for read-only state checks, shared QA checks, idempotent GitHub gate setup, and confirmed Cloudflare branch flips.
- Added `PRODUCTION-GATE.md` as the supervisor runbook.

At initial implementation time, no live GitHub ruleset/environment changes or Cloudflare mutations were run from this worktree.

## 2026-06-23 - Round 2 GitHub Ruleset Fix

Updated the GitHub ruleset payload for the actual repository owner model: `buildwisemedia/asap-pest-wildlife` is owned by a GitHub User account, so a GitHub Actions integration bypass actor is not valid.

- Removed the GitHub Actions app bypass lookup and the `bypass_actors` payload.
- Removed the `update` rule. The ruleset now blocks only deletion and non-fast-forward pushes to `refs/heads/production`.
- Kept idempotent create-or-update behavior for `production-release-gate`.
- Kept `client-production` environment setup unchanged; it defaults to the authenticated GitHub User, and the recommended hardening is to add Robert's personal GitHub account as the required reviewer.
- Updated rollback so it can work with non-fast-forward pushes blocked: it checks out current `production`, restores the tree from the target SHA, verifies the resulting tree equals the target tree, commits `rollback: restore production to <sha>`, and pushes that new commit.

Actual enforcement after this fix:

- Primary gate: Cloudflare production deploys from `production`; `main` produces previews only.
- Ruleset: blocks force-push and deletion of `production`.
- Blessed update path: environment-gated Promote/Rollback workflows.

Residual on user-owned GitHub repositories: the ruleset cannot hard-block a deliberate direct fast-forward push to `production` without also blocking the workflow path. Future hardening options are to migrate the repository to a GitHub organization and add an Actions-bypass `update` restriction, or disable Cloudflare automatic production deployments and trigger production deploys from the promote workflow through the Cloudflare API.
