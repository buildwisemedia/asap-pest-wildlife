# Analytics Relayer Report

Branch: `analytics-relayer`
Base: `a0fe4ba177439fa0b39d9f9e6d1e278f07f1d286`
Scope: data/tracking only. No visible hero, nav, animal grid, CTA, page-set, or `/book` content was intentionally changed.

## Changes Applied

- Added the exact neutral `bwm-ga-gate` script as the first item inside `<head>` on all 37 current HTML files.
- Added `/assets/js/bwm-analytics.js` to all 37 current HTML files.
- Added `assets/js/bwm-analytics.js` as the canonical delayed loader for:
  - GTM `GTM-K953HZ9R`
  - GA4 `G-8M705Z89TE`
  - Clarity `w91h0ljsbn`
  - Meta Pixel `26350078141329630`
- Kept existing inline analytics stacks as fallbacks, but made the canonical loader idempotent and non-overwritable so it wins when present.
- Updated old inline Clarity literal URLs from `whpri6g1yi` to `w91h0ljsbn` where those URLs existed in tracking snippets.
- Added analytics coverage to `404.html`, `privacy-policy/index.html`, and `terms-of-service/index.html` through the gate, canonical loader, attribution script, GTM noscript, and Meta noscript blocks.
- Added the local static-server `/api/capi` skip in `attribution.js`.
- Added `GTM-PHONE-CLICK-SETUP.md` and `attribution.test.js` from `bda944f`.
- Added `_verification/` to `.gitignore`.
- Preserved the existing homepage Google Search Console verification meta, already present in `a0fe4ba`: `OmCVfX8G0hJ0rtS6RcDoWsZxGXJrxwr_JF5oKxofekE`.

## Skipped

- Historical note: this earlier data/tracking pass did not normalize the visible nav email. The audit batch now uses `info@removeasap.com` as the canonical sitewide email.
- Did not edit pre-existing visible vendor-name copy in `lead-flow/index.html`. The diff for that file is head-only. Sampled client-facing pages passed the vendor-name grep.

## Changed Files

- `.gitignore`
- `404.html`
- `ANALYTICS-RELAYER-REPORT.md`
- `GTM-PHONE-CLICK-SETUP.md`
- `about/index.html`
- `assets/js/bwm-analytics.js`
- `attribution.js`
- `attribution.test.js`
- `blog/index.html`
- `commercial-services/index.html`
- `contact/index.html`
- `index.html`
- `lead-flow/index.html`
- `peace-of-mind-from/beavers/index.html`
- `peace-of-mind-from/bees-wasps-and-hornets/index.html`
- `peace-of-mind-from/rodents/index.html`
- `pest-control-services/index.html`
- `privacy-policy/index.html`
- `services/index.html`
- `terms-of-service/index.html`
- `warranty-assurance/index.html`
- `wildlife/armadillo/index.html`
- `wildlife/bats/index.html`
- `wildlife/beaver/index.html`
- `wildlife/bees-wasp-hornets/index.html`
- `wildlife/bird/index.html`
- `wildlife/coyote/index.html`
- `wildlife/flying-squirrel/index.html`
- `wildlife/fox/index.html`
- `wildlife/geese/index.html`
- `wildlife/gopher/index.html`
- `wildlife/gray-squirrel/index.html`
- `wildlife/index.html`
- `wildlife/mole/index.html`
- `wildlife/mouse-rat/index.html`
- `wildlife/opossum/index.html`
- `wildlife/otters/index.html`
- `wildlife/rabbit/index.html`
- `wildlife/raccoon/index.html`
- `wildlife/snake/index.html`
- `wildlife/turtle/index.html`
- `wildlife/vole/index.html`
- `wildlife/wild-hogs/index.html`

## Homepage Diff Summary

Command: `diff <(git show a0fe4ba:index.html) index.html`

Observed hunks:

- `<head>` was split open to add:
  - the `bwm-ga-gate` script
  - `<script src="/assets/js/bwm-analytics.js"></script>`
- One existing analytics-only Clarity literal URL changed from `whpri6g1yi` to `w91h0ljsbn`.

No homepage hero, nav, animal grid, body copy, CTA, or `/book` link changes were present in the homepage diff.

## Self-Test Results

`git diff --stat a0fe4ba`

- Tracked diff before this report: 39 files, 133 insertions, 44 deletions.
- New files added: `GTM-PHONE-CLICK-SETUP.md`, `assets/js/bwm-analytics.js`, `attribution.test.js`.

Gate coverage:

- `grep -c 'bwm-ga-gate' index.html` -> `1`
- `for f in $(find . -name '*.html' -not -path './.git/*'); do grep -lq bwm-ga-gate "$f" || echo "MISSING gate: $f"; done` -> no missing pages.
- Every HTML file has exactly one `/assets/js/bwm-analytics.js` include.

404/legal analytics coverage:

- `404.html`, `privacy-policy/index.html`, and `terms-of-service/index.html` each contain: `bwm-ga-gate`, `bwm-analytics.js`, `attribution.js`, `GTM-K953HZ9R`, `G-8M705Z89TE`, `26350078141329630`, and Meta noscript.

No `/book` regression:

- `grep -rl 'href="/book"' --include='*.html' .` -> no output.
- `find . -maxdepth 2 \( -path './book' -o -name 'book.html' \) -print` -> no output.

Vendor-name grep:

- Sampled client-facing pages `index.html`, `about/index.html`, `contact/index.html`, `services/index.html`, `wildlife/index.html` for `cloudflare|supabase|gohighlevel|\bghl\b|resend|vercel|netlify` -> no output.
- Full-tree grep still finds pre-existing internal `lead-flow/index.html` body copy containing `Supabase` and `Cloudflare`; not changed because it is visible content.

GA4 preview-host gate simulation:

- `branch.asap-pest-wildlife.pages.dev` -> disabled `true`
- `asap-pest-wildlife.pages.dev` -> disabled `false`
- `removeasap.com` -> disabled `false`
- `localhost`, `127.0.0.1`, `0.0.0.0`, empty host -> disabled `true`

Static checks:

- `node --check assets/js/bwm-analytics.js` -> pass.
- `node --check attribution.js` -> pass.
- `node --check attribution.test.js` -> pass.
- `git diff --check` -> pass.

## GTM Dashboard Step

The repo now documents the `phone_click` and `email_click` setup in `GTM-PHONE-CLICK-SETUP.md`, and `attribution.js` already fires the events. The actual GTM container mapping is a Tag Manager dashboard action, not a repo change. A human needs to create/publish the custom event triggers and GA4 event tags in GTM for `phone_click` and `email_click` per the doc.
