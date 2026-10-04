# QA tool result and limits

The unmodified canonical bwm-website-qa.sh ran against the rodent review page. It reported 54 pass, 33 fail, 15 warn. This is not a production pass.

Most reported missing routes come from a tool URL-join defect: it turns root-relative /contact/ into /rodent-removal/contact/, and similarly nests /assets/, /robots.txt/, /llms.txt/ and legal links. The independent 48-page file-and-fragment check found zero missing local links; rendered capture reports show no broken images. The new production /rodent-removal/ URL is not published yet, as expected.

Production tracking is intentionally absent from the new review pages. The production-candidate builder adds the existing analytics and attribution assets. It was not deployed and no live delivery is claimed. Raw mailto is inherited client contact information, not a newly invented link.

The tool also reports local-preview FCP 1.2s/LCP 2.8s and the existing rodent CTA below a 375x580 fold. These are retained as release checks. Its FK13.1 conflicts with prior scoped text review; minified markup extraction must be checked before using that as a copy score. Existing reviewed copy has not been rewritten to satisfy an unverified parser.

The older pre-ship grep tool applies BWM color/type rules to this client site. Its scope warning is explicitly recorded in Brain memory-snapshots/feedback_preship_gate_is_bwm_triangulation_only.md. Run result is retained as diagnostic, never claimed as client or production acceptance.
