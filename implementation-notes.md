# Implementation Notes

## 2026-06-23 - Human-Approval Production Gate

Added release infrastructure so approved live client content is promoted deliberately instead of auto-published from `main`.

- Added `Promote to Production` manual workflow. It requires an exact 40-character commit SHA, runs the shared QA gate against that SHA, waits on the `client-production` environment, then moves `refs/heads/production` to the approved SHA.
- Added `Rollback Production` manual workflow. It requires an exact known-good SHA, waits on the same environment, then resets `production` with `--force-with-lease`.
- Added `scripts/production-gate.sh` for read-only state checks, shared QA checks, idempotent GitHub gate setup, and confirmed Cloudflare branch flips.
- Added `PRODUCTION-GATE.md` as the supervisor runbook.

No live GitHub ruleset/environment changes or Cloudflare mutations were run from this worktree.
