#!/usr/bin/env python3
"""Validate a metric dictionary (see docs/METRIC_DICTIONARY.md). Standard library only.

  python validate_dictionary.py                      # checks sample_metrics.json
  python validate_dictionary.py path/to/dictionary.json

Exit code 0 = valid, 1 = problems found (printed one per line).
A dictionary that passes is not *correct*, only well-formed: checking that the numbers are right is still your job.
"""
import json
import re
import sys
from pathlib import Path

UNITS = {"usd", "percent", "count"}
AGGREGATIONS = {"sum", "avg", "last"}
STATUSES = {"validated", "answer-only"}
TOLERANCE_TYPES = {"relative", "absolute"}
MONTH_KEY = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _text(v):
    return isinstance(v, str) and v.strip() != ""


def validate(data):
    """Returns a list of problems (empty if the dictionary is well-formed)."""
    errs = []
    if not _text(data.get("company")):
        errs.append("top level: 'company' is missing")
    if not DATE.match(str(data.get("as_of", ""))):
        errs.append("top level: 'as_of' must look like 2026-06-30")
    metrics = data.get("metrics")
    if not isinstance(metrics, list) or not metrics:
        return errs + ["top level: 'metrics' must be a non-empty list"]

    ids, aliases = {}, {}
    for i, m in enumerate(metrics):
        where = f"metric #{i + 1} ({m.get('id', '?')})"
        for field in ("id", "label", "definition", "owner", "source"):
            if not _text(m.get(field)):
                errs.append(f"{where}: '{field}' is missing or empty")
        if m.get("id") in ids:
            errs.append(f"{where}: id already used by metric #{ids[m['id']]}")
        ids.setdefault(m.get("id"), i + 1)

        names = m.get("names")
        if not isinstance(names, list) or not names or not all(_text(n) for n in names):
            errs.append(f"{where}: 'names' must be a non-empty list of strings")
        else:
            for n in names:
                other = aliases.setdefault(n.lower(), m.get("id"))
                if other != m.get("id"):
                    errs.append(f"{where}: alias '{n}' is also used by '{other}' (the checker could not tell them apart)")

        heard = m.get("heard_as", [])
        if not isinstance(heard, list) or not all(_text(h) for h in heard):
            errs.append(f"{where}: 'heard_as' must be a list of strings")
        else:
            for h in heard:
                other = aliases.setdefault(h.lower(), m.get("id"))
                if other != m.get("id"):
                    errs.append(f"{where}: heard_as '{h}' is also used by '{other}'")
        if m.get("unit") not in UNITS:
            errs.append(f"{where}: 'unit' must be one of {sorted(UNITS)}")
        if "aggregation" in m and m["aggregation"] not in AGGREGATIONS:
            errs.append(f"{where}: 'aggregation' must be one of {sorted(AGGREGATIONS)}")
        if "status" in m and m["status"] not in STATUSES:
            errs.append(f"{where}: 'status' must be one of {sorted(STATUSES)}")

        tol = m.get("tolerance")
        if not isinstance(tol, dict) or tol.get("type") not in TOLERANCE_TYPES \
                or not isinstance(tol.get("value"), (int, float)) or tol["value"] <= 0:
            errs.append(f"{where}: 'tolerance' needs a type (relative|absolute) and a positive value")

        values = m.get("values")
        if not isinstance(values, dict) or not values:
            errs.append(f"{where}: 'values' must be a non-empty object")
        else:
            for k, v in values.items():
                if not MONTH_KEY.match(k):
                    errs.append(f"{where}: value key '{k}' must look like 2026-03")
                elif isinstance(v, bool) or not isinstance(v, (int, float)):
                    errs.append(f"{where}: value for {k} must be a number")

    for i, g in enumerate(data.get("glossary", [])):
        where = f"glossary entry #{i + 1}"
        if not isinstance(g.get("terms"), list) or not g["terms"] or not all(_text(t) for t in g["terms"]):
            errs.append(f"{where}: 'terms' must be a non-empty list of strings")
        for field in ("answer", "source"):
            if not _text(g.get(field)):
                errs.append(f"{where}: '{field}' is missing or empty")
    return errs


def main(argv):
    path = Path(argv[1]) if len(argv) > 1 else Path(__file__).resolve().parent / "sample_metrics.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        print(f"cannot read {path}: {e}")
        return 1
    errs = validate(data)
    for e in errs:
        print("-", e)
    print(f"{path.name}: {'OK' if not errs else str(len(errs)) + ' problem(s)'}")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
