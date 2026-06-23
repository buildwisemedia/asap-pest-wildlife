# Production Gate Runbook

## Architecture

The live client domain is served only from the `production` branch. `main` is the integration branch and should produce previews only after the supervisor flips the Pages production branch.

The guard has two layers:

1. Structural decouple: Pages production deploys from `production`, not `main`.
2. Human approval: the manual GitHub workflows use the `client-production` environment before moving `production`.

The `production` branch is protected by a repository ruleset named `production-release-gate`. It blocks deletion, non-fast-forward updates, and normal updates for everyone except the GitHub Actions app. The only intended branch-moving jobs are `Promote to Production` and `Rollback Production`, both environment-gated.

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
5. The workflow resets `production` to that SHA with `--force-with-lease`.

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

The current repository uses a shared GitHub identity, so the structural branch decouple is the primary control and the environment approval click is secondary. Add Robert's personal GitHub account as a repository collaborator and make that account the required reviewer on `client-production`; then enable prevent-self-review for the environment.
