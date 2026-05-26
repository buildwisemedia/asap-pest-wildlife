#!/usr/bin/env python3
"""
BWM Client Locks QA Gate — perceptual layer on top of bwm-website-qa.sh.

Reads .bwm-client-locks.json from the repo root and asserts each lock against a
deployed URL. Catches the failure modes that mechanical curl+grep gates miss:
required content strings, required/forbidden asset paths, required CSS classes
on H1s, and minimum repeat counts (e.g., partner-logo grids).

Usage: python3 tools/check-client-locks.py <base_url>
Example: python3 tools/check-client-locks.py https://asap-pest-wildlife.pages.dev

Exit codes: 0 if all locks pass, 1 if any fail.

Source of this pattern: 2026-05-12 ASAP client review (John 2026-05-08 email +
Nehemiah 2026-05-11 meeting). Robert: "the QA system isn't working — these are
stupid mistakes that should never have happened for any client." That gap was
six of nine items being perceptual (content/asset/class drift) that the
mechanical gate cannot see.
"""
import json
import re
import sys
import urllib.request
from pathlib import Path


_SCRIPT_CACHE: dict[str, str] = {}
_STYLESHEET_CACHE: dict[str, str] = {}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "bwm-client-locks-qa/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")


def check_required_strings(html: str, lock: dict) -> tuple[bool, str]:
    s = lock["string"]
    return (s in html, f'expected literal "{s}" in HTML')


def check_forbidden_strings(html: str, lock: dict) -> tuple[bool, str]:
    s = lock["string"]
    return (s not in html, f'forbidden literal "{s}" must not appear in HTML')


def check_required_assets(html: str, lock: dict) -> tuple[bool, str]:
    a = lock["asset"]
    return (a in html, f'expected asset reference "{a}" in HTML')


def check_forbidden_assets(html: str, lock: dict) -> tuple[bool, str]:
    a = lock["asset"]
    return (a not in html, f'forbidden asset reference "{a}" must not appear in HTML')


def check_required_class_on_h1(html: str, lock: dict) -> tuple[bool, str]:
    pattern = lock["class_pattern"]
    # Find all <h1 ...> tags and check at least one has the class pattern
    h1_tags = re.findall(r"<h1\b[^>]*>", html, flags=re.IGNORECASE)
    if not h1_tags:
        return (False, "no <h1> tag found at all")
    for tag in h1_tags:
        # class attribute may contain pattern or one of its child spans does
        if pattern in tag:
            return (True, f'h1 has class matching "{pattern}"')
    # Also check spans inside the H1 (some pages put the outlined class on inner spans)
    h1_block_match = re.search(r"<h1\b[^>]*>(.*?)</h1>", html, flags=re.IGNORECASE | re.DOTALL)
    if h1_block_match and pattern in h1_block_match.group(1):
        return (True, f'h1 has child span with class matching "{pattern}"')
    return (False, f'no h1 (or child span) has class matching "{pattern}"')


def check_min_pattern_count(html: str, lock: dict) -> tuple[bool, str]:
    rgx = re.compile(lock["regex"])
    matches = rgx.findall(html)
    actual = len(matches)
    minimum = lock["min"]
    return (
        actual >= minimum,
        f'expected at least {minimum} matches of /{lock["regex"]}/, found {actual}',
    )


def check_script_src_contains(html: str, lock: dict, *, base_url: str) -> tuple[bool, str]:
    """Lock the BODY of an external JS file, not its presence in HTML.

    Use when the asserted behavior lives in a <script src="..."></script> file
    and absence from HTML would otherwise yield a false negative (e.g., the
    `is-scrolled` CSS class is toggled inside main.js, never serialized to HTML).
    """
    src = lock["src"]
    needle = lock["string"]
    # Confirm the page actually loads the file we're about to fetch — otherwise
    # the lock would pass against a JS file the page doesn't use.
    if f'src="{src}"' not in html and f"src='{src}'" not in html:
        return (False, f'page does not load <script src="{src}">')
    js_url = base_url + src if src.startswith("/") else base_url + "/" + src
    if js_url not in _SCRIPT_CACHE:
        try:
            _SCRIPT_CACHE[js_url] = fetch(js_url)
        except Exception as e:
            return (False, f"fetch {js_url} failed: {e}")
    body = _SCRIPT_CACHE[js_url]
    return (needle in body, f'expected literal "{needle}" in {src}')


def check_stylesheet_href_contains(html: str, lock: dict, *, base_url: str) -> tuple[bool, str]:
    """Lock the BODY of an external CSS file loaded by the page."""
    href = lock["href"]
    needle = lock["string"]
    if f'href="{href}"' not in html and f"href='{href}'" not in html:
        return (False, f'page does not load <link href="{href}">')
    css_url = base_url + href if href.startswith("/") else base_url + "/" + href
    if css_url not in _STYLESHEET_CACHE:
        try:
            _STYLESHEET_CACHE[css_url] = fetch(css_url)
        except Exception as e:
            return (False, f"fetch {css_url} failed: {e}")
    body = _STYLESHEET_CACHE[css_url]
    return (needle in body, f'expected literal "{needle}" in {href}')


def check_forbidden_substring_in_svg_fill(html: str, lock: dict) -> tuple[bool, str]:
    """Scan local SVG files in a directory for a forbidden substring.

    Reads from disk (not the deployed URL) because:
    (a) the build copies SVGs 1:1, so local == deployed for static assets;
    (b) HTML-list-of-SVGs is not authoritative — the lock guards the file
        itself, not whichever pages reference it.

    The `html` arg is unused but kept for handler-signature uniformity.
    """
    del html  # signature uniformity with HTML-scoped checkers
    dir_path = Path(lock["path"])
    substring = lock["substring"]
    if not dir_path.is_dir():
        return (False, f"directory {dir_path} not found")
    offenders = []
    svgs = sorted(dir_path.glob("*.svg"))
    for svg in svgs:
        try:
            text = svg.read_text(errors="replace")
        except Exception as e:
            return (False, f"read {svg} failed: {e}")
        if substring in text:
            offenders.append(svg.name)
    if offenders:
        return (
            False,
            f'forbidden substring "{substring}" found in {len(offenders)} SVG(s) under {dir_path}/: {", ".join(offenders)}',
        )
    return (True, f'no SVG under {dir_path}/ contains "{substring}" ({len(svgs)} scanned)')


CHECKERS = {
    "required_strings": check_required_strings,
    "forbidden_strings": check_forbidden_strings,
    "required_assets": check_required_assets,
    "forbidden_assets": check_forbidden_assets,
    "required_class_on_h1": check_required_class_on_h1,
    "min_pattern_count": check_min_pattern_count,
    "script_src_contains": check_script_src_contains,
    "stylesheet_href_contains": check_stylesheet_href_contains,
    "forbidden_substring_in_svg_fill": check_forbidden_substring_in_svg_fill,
}

# Keys in .bwm-client-locks.json that are metadata, not lock sections.
_METADATA_KEYS = {"_doc", "client_slug", "version", "last_updated"}


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: check-client-locks.py <base_url>", file=sys.stderr)
        return 2
    base_url = argv[1].rstrip("/")

    locks_path = Path(".bwm-client-locks.json")
    if not locks_path.is_file():
        print(f"::error::No .bwm-client-locks.json at repo root — gate cannot enforce", file=sys.stderr)
        return 2

    locks = json.loads(locks_path.read_text())
    client = locks.get("client_slug", "?")
    print(f"BWM client-locks gate · client={client} · base={base_url}\n")

    # Schema drift guard: a JSON section without a handler is a silent skip,
    # which is the exact failure mode that hid the v8.5→v8.6 forbidden_strings
    # and forbidden_substring_in_svg_fill regressions. Fail loud instead.
    unknown_sections = set(locks.keys()) - _METADATA_KEYS - set(CHECKERS.keys())
    if unknown_sections:
        print(
            f"::error::Unknown lock section(s) in .bwm-client-locks.json: "
            f"{sorted(unknown_sections)}. Either add a checker or remove the section.",
            file=sys.stderr,
        )
        return 2

    # URL-less locks (disk-scoped, e.g. SVG fill scans). Run before HTTP fetches.
    diskless_kinds = {"forbidden_substring_in_svg_fill"}

    passed = 0
    failed_items = []

    for kind in diskless_kinds:
        for lock in locks.get(kind, []):
            ok, msg = CHECKERS[kind]("", lock)
            status = " PASS " if ok else "  FAIL"
            scope = lock.get("path", "<disk>")
            print(f"  {status}  [{kind}] {scope} — {msg}")
            if ok:
                passed += 1
            else:
                failed_items.append((scope, kind, msg, lock.get("rationale", "")))

    # URL-scoped locks: group by URL so each page is fetched once.
    pages: dict[str, list[tuple[str, dict]]] = {}
    for kind in CHECKERS.keys() - diskless_kinds:
        for lock in locks.get(kind, []):
            pages.setdefault(lock["url"], []).append((kind, lock))

    for url, items in pages.items():
        full = base_url + url
        try:
            html = fetch(full)
        except Exception as e:
            print(f"  FAIL  fetch {full}: {e}")
            failed_items.append((url, "fetch", str(e), ""))
            continue
        for kind, lock in items:
            if kind in {"script_src_contains", "stylesheet_href_contains"}:
                ok, msg = CHECKERS[kind](html, lock, base_url=base_url)
            else:
                ok, msg = CHECKERS[kind](html, lock)
            status = " PASS " if ok else "  FAIL"
            print(f"  {status}  [{kind}] {url} — {msg}")
            if ok:
                passed += 1
            else:
                failed_items.append((url, kind, msg, lock.get("rationale", "")))

    total = passed + len(failed_items)
    print(f"\n{passed}/{total} locks passed")

    if failed_items:
        print("\nFAILURES (these are perceptual regressions the mechanical gate misses):")
        for url, kind, msg, rationale in failed_items:
            print(f"  · {url} [{kind}] {msg}")
            if rationale:
                print(f"        why this lock exists: {rationale}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
