# QA Self Report

Date: 2026-06-23
Branch: `infra/production-gate`

## Files Authored

- `.github/workflows/promote-to-production.yml`
- `.github/workflows/rollback-production.yml`
- `scripts/production-gate.sh`
- `PRODUCTION-GATE.md`
- `implementation-notes.md`
- `QA-SELF-REPORT.md`

## Self-Test Results

### `shellcheck scripts/production-gate.sh`

Result: exit 0, no output.

### `bash -n scripts/production-gate.sh`

Output:

```text
bash -n ok
```

### `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/promote-to-production.yml')); yaml.safe_load(open('.github/workflows/rollback-production.yml')); print('yaml ok')"`

Output:

```text
yaml ok
```

### `bash scripts/production-gate.sh check`

Output:

```text
Production gate state check
Repo: buildwisemedia/asap-pest-wildlife
Cloudflare Pages: production_branch=main production_deployments_enabled=True
GitHub ruleset: absent
GitHub environment: absent
Production domain: https://removeasap.com HTTP 200
```

### Clean and Dirty Fixture QA

Command:

```bash
tmpdir="$(mktemp -d)"
for fixture in clean dirty; do
  mkdir -p "$tmpdir/$fixture/privacy-policy" "$tmpdir/$fixture/terms-of-service"
  printf '<!doctype html><html><body><h1>ASAP Pest and Wildlife</h1></body></html>\n' > "$tmpdir/$fixture/index.html"
  printf '<!doctype html><html><body><h1>Privacy Policy</h1></body></html>\n' > "$tmpdir/$fixture/privacy-policy/index.html"
  printf '<!doctype html><html><body><h1>Terms of Service</h1></body></html>\n' > "$tmpdir/$fixture/terms-of-service/index.html"
  printf '/book /contact 302\n' > "$tmpdir/$fixture/_redirects"
  printf 'User-agent: *\nAllow: /\n' > "$tmpdir/$fixture/robots.txt"
  printf '# ASAP Pest and Wildlife\n> Wildlife removal and pest control.\n\n## About\nLocal service page.\n\n## Services\nRemoval and exclusion.\n\n## Contact\nUse the website contact form.\n' > "$tmpdir/$fixture/llms.txt"
done
printf '<!doctype html><html><body><h1>Cloudflare preview</h1></body></html>\n' > "$tmpdir/dirty/index.html"
echo "CLEAN FIXTURE"
bash scripts/production-gate.sh qa-gate "$tmpdir/clean"
echo "DIRTY FIXTURE"
if bash scripts/production-gate.sh qa-gate "$tmpdir/dirty"; then
  echo 'dirty fixture unexpectedly passed'
  rm -rf "$tmpdir"
  exit 1
else
  echo 'dirty fixture failed as expected'
fi
rm -rf "$tmpdir"
```

Output:

```text
CLEAN FIXTURE
QA gate: PASS
Checked required files, client-visible vendor names, and placeholder text in /var/folders/60/p9ytq2r15l37pk_290_d3b4w0000gn/T/tmp.53a4d1CKZB/clean
DIRTY FIXTURE
QA gate: FAIL
vendor name found in client-visible HTML: index.html
  1:<!doctype html><html><body><h1>Cloudflare preview</h1></body></html>
dirty fixture failed as expected
```

### Current Tree QA Sanity Check

Command:

```bash
bash scripts/production-gate.sh qa-gate .
```

Output:

```text
QA gate: PASS
Checked required files, client-visible vendor names, and placeholder text in /private/tmp/claude-501/-Users-robertechevarria/aaaad121-8d54-4693-84fc-2ebcf71e3062/scratchpad/asap-infra-gate
```

Note: the current tree contains a noindex private QA page at `lead-flow/index.html` with infrastructure details. The vendor-name check treats legal pages and noindex internal QA pages as non-client-visible, while still failing the dirty public-page fixture above.

### Confirm Existing Ship Workflow Untouched

Command:

```bash
git diff -- .github/workflows/ship.yml --exit-code && echo 'ship.yml unchanged'
```

Output:

```text
ship.yml unchanged
```

### Extra Whitespace Check

Command:

```bash
git diff --check
```

Result: exit 0, no output.

## Not Run

- No `apply-github` mutation was run.
- No `apply-cloudflare --confirm` mutation was run.
- No `rollback-cloudflare --confirm` mutation was run.
- No PR was opened.
- Nothing was pushed to origin.
