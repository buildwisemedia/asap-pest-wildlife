# Production Gate Runbook

## Architecture

The live client domain is served from the `production` branch. `main` is the integration branch and produces previews only. This is the primary production gate: a push to `main` must not deploy to `removeasap.com`.

The guard has two layers:

1. Structural decouple: Pages production deploys from `production`, not `main`.
2. Human approval: the manual GitHub workflows use the `client-production` environment before moving `production`.

The `production` branch is protected by a repository ruleset named `production-release-gate`. It blocks deletion and non-fast-forward updates. The blessed update path is through the environment-gated `Promote to Production` and `Rollback Production` workflows.

Honest residual: this repository is owned by the `buildwisemedia` GitHub User account, not a GitHub organization. On a user-owned repository, the ruleset cannot use a GitHub Actions integration bypass actor, so it cannot safely include an `update` restriction while still allowing the promote workflow to write `production`. A deliberate direct fast-forward push to `production` is not hard-blocked by the ruleset. The production risk is still materially reduced because Cloudflare deploys production from `production`, while `main` produces previews only.

## One-Time Supervisor Apply

Run these after this branch is reviewed and merged by the supervisor:

```bash
bash scripts/production-gate.sh check
bash scripts/production-gate.sh apply-github
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... bash scripts/production-gate.sh apply-cloudflare --confirm
bash scripts/production-gate.sh check
```

`apply-github` creates or updates:

- Repository ruleset `production-release-gate` for `refs/heads/production`.
- GitHub environment `client-production` with a required reviewer.

`apply-cloudflare --confirm` patches the Pages project so the production branch is `production` and production branch deployments stay enabled.

## Shipping a Real Client Change

1. Merge approved work to `main`.
2. Copy the exact 40-character commit SHA to release.
3. Run the `Promote to Production` workflow manually.
4. Enter the exact SHA and the approval reason.
5. Confirm the QA job passes.
6. Approve the `client-production` environment hold.
7. The workflow pushes that exact SHA to `refs/heads/production`.

Do not push directly to `production`. Do not use branch names as release inputs. The workflow accepts only full commit SHAs.

## Rollback

Use the `Rollback Production` workflow when the live domain needs to return to a known-good commit.

1. Find the exact known-good 40-character SHA.
2. Run `Rollback Production` manually.
3. Enter the SHA and rollback reason.
4. Approve the `client-production` environment hold.
5. The workflow checks out current `production`, restores the working tree to the known-good SHA, verifies the resulting tree matches that SHA, creates a new rollback commit, and pushes that commit to `production`.

Emergency Cloudflare branch rollback, if the branch decouple itself must be backed out:

```bash
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... bash scripts/production-gate.sh rollback-cloudflare --confirm
```

That sets the Pages production branch back to `main`; use only as an infrastructure emergency rollback.

## QA Gate

The promote workflow runs:

```bash
bash scripts/production-gate.sh qa-gate <checked-out-sha-dir>
```

The gate verifies:

- Required production files/pages exist: `index.html`, `_redirects`, `privacy-policy/index.html`, `terms-of-service/index.html`, `robots.txt`, `llms.txt`.
- Client-visible HTML does not name third-party infrastructure vendors. Legal pages are exempt.
- Obvious placeholder text is absent.

## Recommended Hardening

The environment currently defaults to the authenticated GitHub User as the required reviewer. Add Robert's personal GitHub account as a repository collaborator and make that account the required reviewer on `client-production`; then enable prevent-self-review for the environment.

For stronger technical enforcement, either:

- Migrate the repository to a GitHub organization, then add an `update` restriction with a valid GitHub Actions bypass actor so only the environment-gated workflows can write `production`.
- Disable Cloudflare automatic production deployments and have the promote workflow trigger production deploys through the Cloudflare API after approval.
