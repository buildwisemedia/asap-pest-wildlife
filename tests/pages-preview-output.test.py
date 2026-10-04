"""Offline artifact checks. No Pages API, browser, build or provider calls."""
import hashlib
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("preview_packaging", SOURCE / "scripts/prepare-pages-preview.py")
packaging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packaging)
ENV = {"CF_PAGES": "1", "CF_PAGES_BRANCH": packaging.PREVIEW_BRANCH}


class PreviewOutput(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="asap-preview-package-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "checkout"
        self.root.mkdir()
        for name in packaging.EXCLUSIONS:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(SOURCE / name, path)
        for name, data in {
            "index.html": b"<html>existing website</html>\n",
            "_headers": b"/*\n  X-Frame-Options: DENY\n",
            "_redirects": b"/old /existing 301\n",
            "assets/photo.webp": b"\x00existing image bytes\xff",
            "functions/api/capi.ts": b"existing gated function source\n",
            "functions/rate.js": b"existing rate function source\n",
            ".github/workflows/pr-ci.yml": b"existing ordinary CI\n",
            "tools/other-review.cjs": b"existing unrelated tool\n",
        }.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)

    def inventory(self):
        return {str(p.relative_to(self.root)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in self.root.rglob("*") if p.is_file()}

    def test_exact_exclusion_preserves_every_other_website_function_and_CI_byte(self):
        before = self.inventory()
        removed = packaging.prepare(self.root, ENV)
        self.assertEqual(set(removed), set(packaging.EXCLUSIONS))
        self.assertEqual(self.inventory(), {p: h for p, h in before.items() if p not in removed})
        for path in packaging.EXCLUSIONS:
            self.assertFalse((self.root / path).exists())

    def test_local_checkout_without_Pages_environment_is_untouched(self):
        before = self.inventory()
        with self.assertRaisesRegex(ValueError, "explicit_PR30"):
            packaging.prepare(self.root, {})
        self.assertEqual(self.inventory(), before)

    def test_production_and_other_previews_cannot_run_this_step(self):
        before = self.inventory()
        for branch in ("production", "main", "another-preview", ""):
            with self.subTest(branch=branch), self.assertRaisesRegex(ValueError, "explicit_PR30"):
                packaging.prepare(self.root, {**ENV, "CF_PAGES_BRANCH": branch})
        self.assertEqual(self.inventory(), before)

    def test_changed_reviewed_input_fails_before_any_removal(self):
        (self.root / "tools/local-inquiry-contract.cjs").write_bytes(b"changed input")
        before = self.inventory()
        with self.assertRaisesRegex(ValueError, "reviewed_hash_mismatch"):
            packaging.prepare(self.root, ENV)
        self.assertEqual(self.inventory(), before)

    def test_partial_source_set_fails_before_any_removal(self):
        (self.root / "tests/local-inquiry-recovery.test.cjs").unlink()
        before = self.inventory()
        with self.assertRaisesRegex(ValueError, "incomplete_review_file_set"):
            packaging.prepare(self.root, ENV)
        self.assertEqual(self.inventory(), before)

    def test_file_symlink_does_not_delete_outside_target_or_any_other_source(self):
        target = Path(self.temp.name) / "outside.cjs"
        target.write_bytes(b"outside must remain")
        path = self.root / "tools/local-inquiry-contract.cjs"
        path.unlink()
        path.symlink_to(target)
        before = self.inventory()
        with self.assertRaisesRegex(ValueError, "regular_file_required"):
            packaging.prepare(self.root, ENV)
        self.assertEqual(self.inventory(), before)
        self.assertEqual(target.read_bytes(), b"outside must remain")

    def test_symlinked_parent_does_not_expand_deletion_scope(self):
        external = Path(self.temp.name) / "outside-tools"
        (self.root / "tools").rename(external)
        (self.root / "tools").symlink_to(external, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symlink_parent"):
            packaging.prepare(self.root, ENV)
        self.assertTrue((external / "local-inquiry-contract.cjs").exists())
        self.assertTrue((self.root / "tests/local-inquiry-contract.test.cjs").exists())

    def test_missing_website_marker_refuses_packaging(self):
        (self.root / "index.html").unlink()
        before = self.inventory()
        with self.assertRaises(OSError):
            packaging.prepare(self.root, ENV)
        self.assertEqual(self.inventory(), before)

    def test_repeated_preparation_has_no_further_changes(self):
        packaging.prepare(self.root, ENV)
        once = self.inventory()
        self.assertEqual(packaging.prepare(self.root, ENV), [])
        self.assertEqual(self.inventory(), once)

    def test_real_CLI_removes_tooling_from_only_a_disposable_checkout(self):
        before = self.inventory()
        result = subprocess.run([sys.executable, str(self.root / "scripts/prepare-pages-preview.py"),
                                 "--prepare-preview-root"], env={**os.environ, **ENV},
                                text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.inventory(), {p: h for p, h in before.items() if p not in packaging.EXCLUSIONS})
        self.assertTrue((SOURCE / "scripts/prepare-pages-preview.py").exists())

    def test_real_CLI_without_explicit_action_does_not_mutate(self):
        before = self.inventory()
        result = subprocess.run([sys.executable, str(self.root / "scripts/prepare-pages-preview.py")],
                                env={**os.environ, **ENV}, capture_output=True)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.inventory(), before)


if __name__ == "__main__":
    unittest.main()
