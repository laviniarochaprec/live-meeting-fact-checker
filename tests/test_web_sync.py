"""The browser app serves its own copy of the sample catalog (GitHub Pages only publishes docs/).
This test makes sure the two copies never drift apart."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class WebCopy(unittest.TestCase):
    def test_docs_sample_catalog_matches_the_root_one(self):
        root = (ROOT / "sample_metrics.json").read_bytes().replace(b"\r\n", b"\n")
        web = (ROOT / "docs" / "sample_metrics.json").read_bytes().replace(b"\r\n", b"\n")
        self.assertEqual(root, web, "copy sample_metrics.json to docs/sample_metrics.json")

    def test_example_meeting_in_the_page_matches_the_examples_folder(self):
        page = (ROOT / "docs" / "app.js").read_text(encoding="utf-8")
        for line in (ROOT / "examples" / "meeting.txt").read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.startswith("#"):
                self.assertIn(line.strip(), page, f"example line missing from docs/app.js: {line}")


if __name__ == "__main__":
    unittest.main()
