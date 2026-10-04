# Full ASAP website approval package

Robert's September 9 direction replaces the earlier Raccoon-first approval.
One request covers five animal pages, five cities, three complete articles,
four droppings images, the existing shared site pages, and rating-page heading.
Nehemiah owns animal/article/image review; James owns city review.

## Rebuild

The source checkout is a review website, not a direct production merge.
Python requires BeautifulSoup4 and Pillow. Node uses only built-in modules.

```sh
node tools/build-asap-close.mjs --mode=animal
node tools/build-asap-close.mjs --mode=legacy-review
python3 tools/build-full-website.py
python3 tools/prepare-website-release.py --output /new/path/review-build
python3 tools/prepare-website-release.py --production-candidate --output /new/path/production-candidate
node --experimental-strip-types --test tests/capi-auth-probe.test.mjs rate/review-engine.test.js attribution.test.js
node --test tests/full-website-forms.test.cjs
```

Both prepared folders include only website assets and Pages functions. They
exclude source articles, internal proof, prompts, tools, tests, and private
lead-flow review material. Each build gets an exact SHA-256 manifest outside
the served folder. Neither command deploys, sends email, or grants approval.

## Release after full approval

1. Record approval against the immutable review URL and exact manifest. Any
   requested changes require an updated full package; do not reinstate samples.
2. Use the prepared production folder on a dedicated production release
   branch based on the then-current production head. Compare against current
   production to retain the September 8 rating repair and later valid work.
3. Check the six new forms with their actual page/service/city fields, current
   attribution contract, and exact success/error behavior. Browser previews
   send nothing. Local mocked success is not proof of live lead delivery.
4. Verify indexability, sitemap/canonicals and legacy rodent redirect on the
   staged production candidate, then the approved production domain. Review
   directory, docs, and source artifacts must stay out of the release.
5. Check live form delivery and tracking, phone links, legal links, navigation,
   desktop/mobile layout and performance. Keep the previous production tag
   available for rollback. Record actual outcomes, never only deployment success.
6. Leave existing Medium articles in place. Update a canonical only after its
   exact replacement is live and verified under the approved migration scope.

Client acceptance, email-send approval, live form delivery and production
release are separate facts. None is implied by a draft PR or prepared folder.
