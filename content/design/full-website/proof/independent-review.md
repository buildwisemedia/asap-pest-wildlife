The memory write was denied — correct for this deliberately read-only review session, so the durable notes live in this report instead. Everything is verified; here is the verdict.

---

# Verdict: NEEDS FIXES — small ones, hours not days

The package is fundamentally sound, honest, and safe. The design holds, the no-send story is real and tested, and the release tooling does what it claims. But I found one client-visible content defect the build introduced, plus two cheap pre-send items. Fix those, then send the approval email. Nothing here reopens the design and nothing calls for a sample gate.

## Blocking defect (fix before the approval email)

1. **Two articles show a link labeled "removeasap.com" that goes somewhere else.** The bat article's closing box says "You can also visit removeasap.com" but links to `/wildlife/bats/`; the rat article does the same to `/wildlife/mouse-rat/`. Cause: `build-full-website.py:46` rewrites every homepage href to the service page but leaves the visible anchor text. The raccoon article is fine because its anchor text is the business name. Both render visibly in the desktop captures. Nehemiah will be reading these articles word-by-word to approve them; our link bug should not be his first find. Fix is minutes: change the anchor text (for example "our bat page") or point the href back to `/`.

## Should-fix before sending (cheap, protects credibility)

2. **The blog page renders a line of raw CSS code as visible text near the footer.** The archived Webflow markup has `</style` with no closing `>` (blog/index.html line 96), which per HTML parsing rules swallows the next `<style>` opener and dumps `.outlined-cream { -webkit-text-fill-color: transparent; ... }` onto the page as text. I confirmed by fetching the live removeasap.com/blog: **the live site has the same visible CSS text today** — so this is faithful parity, not a regression from this build. Still, the blog page is in the approval package; a one-character fix makes our version better than what the client has now.

3. **The screenshot proof set is corrupted and overstated.** All 14 full-page PNGs have a stitching defect: sections render twice, a phantom footer appears mid-page, and there's a long blank tail. I verified against the actual HTML — the pages themselves have each section exactly once; this is a capture-tool artifact, not a site bug. But anyone judging from these images (including Robert pre-send) could think the site duplicates content. Also, `captures.json` lists 21 captures while only 14 PNGs (+1 form proof) exist on disk — 8 mobile entries (animal pages, four cities) have no file. If the approval email links only the preview site, the client never sees these; either way, recapture with a fixed method and reconcile the receipt before anyone leans on them as evidence.

## What I verified clean (the important positives)

- **The preview tells the truth.** The hub says "Preview only… Forms in this preview send nothing. Phone and email links are real" — all three claims match behavior. Client approval is `false` in every artifact; manifests say `published: false, human_approval: false`.
- **No-send is layered and demonstrated:** submit buttons ship `disabled`, a capture-phase document listener blocks all form submits (including the old Webflow blog form's own fetch handler) before any other handler runs, GA4 is killed off-domain, and the live send path in `asap-close.js` requires both the removeasap.com hostname and the `data-integration-state="live"` flag that only the un-deployed production candidate sets. The `rodent-form-no-send.png` proof shows the filled form, "CHECK FORM" button, and the exact no-send status line. The 10 form tests pass, including "preview fixtures never call the live endpoint" and "live configuration on an unapproved host remains disabled."
- **Article integrity:** the build asserts body text is byte-identical to the reviewed sources at build time; I read the raccoon source against its output and confirmed. Canonicals, Open Graph, Article schema, and the AI-image disclosure captions are all correct. Blog card image dimensions (1440×810) match the actual generated files.
- **Screenshots (in their clean regions) show good layout, contrast, and mobile usability** across hub, articles, blog, rodent, and Canton. The new blog "Signs and next steps" card section places well under the ASAP Blog heading.
- **Link check: 48 pages, zero errors.** Every hub link resolves; nav is coherent; robots noindex covers every review page (page meta plus an `X-Robots-Tag` catch-all appended to the review build's `_headers`).
- **Rate page:** the requested `#page-title` urw-din 900 heading rule is in place, Typekit loads on that page so it will render, Privacy/Terms footer links added, and the rating endpoint contract is untouched — 20 existing rating/attribution/CAPI tests pass in the log.
- **Production candidate transforms verified by inspection:** review script stripped and deleted, `disabled data-review-disable` removed, fixture copy swapped to live copy ("Your details will be sent…"), noscript swapped to the call message, articles and new pages made indexable, `/rate/` keeps its pre-existing noindex and stays out of the sitemap, `peace-of-mind-from/rodents` deleted with both 301s appended, sitemap adds rodent + five cities + three articles idempotently, the `PRIVATE REVIEW HOLD` header block is removed cleanly, and `/website-review/` is excluded. The current `review-build/` folder hash-matches the reviewed work tree.

## Production-release limits (separate from client review — these gate the later deploy, not the email)

- **Approvals are all still open:** client approval false, Nehemiah's technical image approval pending, and the droppings species↔generator mapping is explicitly unknown. If Nehemiah can't confirm the four species labels, pull the droppings section before release — it's marker-delimited (`full-website:droppings`) and lifts out cleanly.
- **No live end-to-end form delivery has ever been fired from this candidate.** The six new forms (rodent + five cities) are unit-tested only. Post-deploy checklist must include one real submission per form, verifying the lead record, the CAPI event id, and the failure copy path, before telling the client forms are live.
- **`asap-website-review.css` is load-bearing in production** despite its name: the droppings grid (`.review-images`) and the blog section (`.asap-new-articles`) get their layout from it, and the release keeps the link on purpose. Move those rules into `asap-animal-v2.css` eventually, or someone will "clean up" the review CSS and silently break two production layouts.
- **Button label delta:** the client approves forms displaying "Check form" (review state, real label "SUBMIT"), but production ships "Send request." One sentence in the approval email should say the live button reads "Send request" so the approval covers what actually ships.
- Minor, note-only: the blanket robots-strip also removes 404.html's noindex (harmless — the 404 status protects it); JS-off preview visitors still fire the archived pages' GTM/Meta noscript pixels (no lead data, no records); a 5-star click on the preview `/rate/` without `?preview=1` navigates to the real Google review composer (no data written — that path requires a `request_id` nobody would have); three generations of build manifests exist for one folder each name — prune the stale ones.

## Evidence basis

Hashes in `reviewed-files.json` and the build manifests are **supplied, not recomputed** — this session has no shell. I verified content by reading the files directly, and cross-checked that the review-build manifest's page hashes match the reviewed-files hashes for the same files (they do, e.g. rodent-removal `cb1fe5…`). Test results are as observed in the two logs (20/20 and 10/10 passing); I make no claim about the further functional tests still in progress. This review is not client acceptance, and per the package's own state, client approval and permission to send the email remain false.

✅ SCOPE COMPLETE
