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


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "bwm-client-locks-qa/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")


def check_required_strings(html: str, lock: dict) -> tuple[bool, str]:
    s = lock["string"]
    return (s in html, f'expected literal "{s}" in HTML')


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


CHECKERS = {
    "required_strings": check_required_strings,
    "required_assets": check_required_assets,
    "forbidden_assets": check_forbidden_assets,
    "required_class_on_h1": check_required_class_on_h1,
    "min_pattern_count": check_min_pattern_count,
}


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

    pages = {}
    for kind, checker in CHECKERS.items():
        for lock in locks.get(kind, []):
            pages.setdefault(lock["url"], []).append((kind, lock))

    passed = 0
    failed_items = []
    for url, items in pages.items():
        full = base_url + url
        try:
            html = fetch(full)
        except Exception as e:
            print(f"  FAIL  fetch {full}: {e}")
            failed_items.append((url, "fetch", str(e), ""))
            continue
        for kind, lock in items:
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
