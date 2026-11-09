"""Tests for the catalog validator."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import validate_catalog  # noqa: E402

GOOD = json.loads((ROOT / "sample_metrics.json").read_text(encoding="utf-8"))


def broken(change):
    data = copy.deepcopy(GOOD)
    change(data)
    return validate_catalog.validate(data)


class Validator(unittest.TestCase):
    def test_the_sample_catalog_is_valid(self):
        self.assertEqual(validate_catalog.validate(GOOD), [])

    def test_duplicate_ids(self):
        errs = broken(lambda d: d["metrics"][1].update(id=d["metrics"][0]["id"]))
        self.assertTrue(any("already used" in e for e in errs))

    def test_alias_shared_by_two_metrics_is_ambiguous(self):
        errs = broken(lambda d: d["metrics"][1]["names"].append("revenue"))
        self.assertTrue(any("alias 'revenue'" in e for e in errs))

    def test_unknown_unit(self):
        errs = broken(lambda d: d["metrics"][0].update(unit="euros"))
        self.assertTrue(any("'unit'" in e for e in errs))

    def test_bad_aggregation(self):
        errs = broken(lambda d: d["metrics"][0].update(aggregation="median"))
        self.assertTrue(any("'aggregation'" in e for e in errs))

    def test_tolerance_must_be_positive(self):
        errs = broken(lambda d: d["metrics"][0].update(tolerance={"type": "relative", "value": 0}))
        self.assertTrue(any("'tolerance'" in e for e in errs))

    def test_value_keys_must_be_months(self):
        errs = broken(lambda d: d["metrics"][0]["values"].update({"March": 1}))
        self.assertTrue(any("must look like 2026-03" in e for e in errs))

    def test_values_must_be_numbers(self):
        errs = broken(lambda d: d["metrics"][0]["values"].update({"2026-07": "lots"}))
        self.assertTrue(any("must be a number" in e for e in errs))

    def test_definition_is_required(self):
        errs = broken(lambda d: d["metrics"][0].update(definition=" "))
        self.assertTrue(any("'definition'" in e for e in errs))

    def test_glossary_entries_are_checked(self):
        errs = broken(lambda d: d["glossary"][0].update(terms=[]))
        self.assertTrue(any("glossary entry #1" in e for e in errs))


if __name__ == "__main__":
    unittest.main()
