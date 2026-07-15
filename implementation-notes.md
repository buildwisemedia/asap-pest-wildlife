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

## 2026-07-15 - Form Routing Parity (client-reported: inner-page forms not reaching Webflow submissions)

Client (John, 7/8 + 7/13 + 7/15) asked for every form to behave like the homepage form, whose submissions land in their Webflow submissions panel and fire their automation chain (email -> SMS -> Monday.com). Diagnosis:

- Homepage inline handler used `preventDefault()` only, so the Webflow runtime's own submit still ran -> dual delivery (BWM worker + Webflow). That was the only correct page.
- about/blog/contact/services/warranty-assurance inline handlers added `stopImmediatePropagation()` (+ capture), which killed Webflow's handler -> leads reached only the BWM worker.
- wildlife/* and peace-of-mind-from/* used a third, document-level handler that never set `__bwmBound`, so `assets/js/asap-lead-flow.js` (fallback, also capture+stopProp) bound too and blocked Webflow.
- commercial-services / pest-control-services / wildlife index had no inline handler; the fallback blocked Webflow there as well.
- Visual mismatch the client screenshotted: the homepage hides `Others_Input` ("Type other") until Issue=Other via a homepage-only Webflow interaction chunk; all other pages showed the field naked.

Changes:
- Removed `stopImmediatePropagation` + capture flag from the 5 divergent inline handlers (now byte-equivalent to the homepage contract, per-page `source_form_type` labels kept).
- Replaced the document-level variant on 24 wildlife/peace pages with the homepage-pattern handler; binds at parse time and respects `__asapLeadFlowBound` so the fallback can never double-post.
- `assets/js/asap-lead-flow.js`: dropped stopProp/capture (Webflow must run); added a site-wide `Others_Input` toggle replicating the homepage show/hide on every page.
- lead-flow/ LP untouched (own gated form, `data-no-bwm-lead-flow` opt-out).

Verified locally (iframe harness, fetch/XHR instrumented): every page class = exactly 1 BWM worker post + 1 Webflow post, done-message shown, `Others_Input` hidden until Other. Real e2e test submission from /about/ accepted by the Webflow API (their panel + automation). Client's own 7/15 13:43 test appears in lead_submissions with `about-webflow-reference`, confirming the worker leg was never the gap.
