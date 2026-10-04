#!/usr/bin/env python3
"""Exclude review tooling from a disposable PR30 Pages root-output checkout.

This must be explicitly selected as a Pages build step after review. It does
not deploy, change configuration, or prepare a production release.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat

PREVIEW_BRANCH = "codex/asap-full-website-approval-20260909"
EXPECTED_SHA256 = {
    "tests/local-inquiry-contract.test.cjs": "609103e97fb68f9a927972c5c3efa52a5e3cd4c486ddaa1e109737e549a722a4",
    "tests/local-inquiry-recovery.test.cjs": "de5f0483236163b30c114be5a5e8a1a027eefa7f91cb874e3a059554cc48cc74",
    "tools/local-inquiry-contract.cjs": "d03bcbe834b1ee7d8e5985fffb5e6a2dfd910b0e494f46188b4b474325836d58",
    "tools/run-local-inquiry-fixtures.cjs": "bc945d92bf1815e6a64e636426a88dccc122440610b5ffbb94db50a0d42763db",
}
EXCLUSIONS = tuple(EXPECTED_SHA256) + (
    "scripts/prepare-pages-preview.py",
    "tests/pages-preview-output.test.py",
)


def regular_file(root, relative):
    path = root / relative
    for parent in path.parents:
        if parent == root:
            break
        if parent.is_symlink():
            raise ValueError("symlink_parent: " + relative)
    mode = path.lstat().st_mode
    if not stat.S_ISREG(mode):
        raise ValueError("regular_file_required: " + relative)
    return path


def prepare(root, environment):
    if environment.get("CF_PAGES") != "1" or environment.get("CF_PAGES_BRANCH") != PREVIEW_BRANCH:
        raise ValueError("explicit_PR30_Pages_preview_required")
    root = Path(root).resolve()
    for marker in ("index.html", "_headers", "functions/api/capi.ts"):
        regular_file(root, marker)
    present = [name for name in EXCLUSIONS if (root / name).exists() or (root / name).is_symlink()]
    if not present:
        return []
    if len(present) != len(EXCLUSIONS):
        raise ValueError("incomplete_review_file_set")
    # Validate the complete set before deleting any file. A changed reviewed
    # input fails the build instead of silently expanding the approved scope.
    for name in EXCLUSIONS:
        path = regular_file(root, name)
        if name in EXPECTED_SHA256 and hashlib.sha256(path.read_bytes()).hexdigest() != EXPECTED_SHA256[name]:
            raise ValueError("reviewed_hash_mismatch: " + name)
    for name in EXCLUSIONS:
        (root / name).unlink()
    return list(EXCLUSIONS)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare-preview-root", required=True, action="store_true")
    parser.parse_args()
    try:
        excluded = prepare(Path(__file__).resolve().parents[1], os.environ)
    except (OSError, ValueError) as error:
        parser.exit(2, "Preview packaging refused: " + str(error) + "\n")
    print(json.dumps({"mode": "PR30_preview_only", "excluded": excluded, "deployed": False}))


if __name__ == "__main__":
    main()
