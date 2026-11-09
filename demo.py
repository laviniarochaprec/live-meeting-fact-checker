#!/usr/bin/env python3
"""Live Meeting Fact-Checker: a tiny, runnable demo.  ALL DATA IS FICTIONAL.

It shows the core behavior from the README, without audio and without a database:

  * a number is CHECKED against a metric catalog and only flagged when it is off,
  * a quick factual QUESTION is answered from the catalog,
  * a DEFINITION is answered from a glossary,
  * when it is not sure (unknown metric, no period, several numbers...) it stays SILENT.

Usage:
  python demo.py "Churn in March was about 6%"
  python demo.py --transcript examples/meeting.txt
  python demo.py                      # type sentences, empty line to quit
  python demo.py --verbose ...        # also say why it stayed silent

Python 3.8+, standard library only.
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BANNER = ("DEMO - every number here comes from sample_metrics.json and is FICTIONAL "
          "(Acme Cloud does not exist).")

MONTHS = {"january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3, "april": 4, "apr": 4,
          "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7, "august": 8, "aug": 8, "september": 9,
          "sept": 9, "sep": 9, "october": 10, "oct": 10, "november": 11, "nov": 11, "december": 12, "dec": 12}
MONTH_NAME = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September",
              "October", "November", "December"]
SCALE = {"k": 1e3, "thousand": 1e3, "m": 1e6, "mm": 1e6, "mil": 1e6, "million": 1e6, "b": 1e9, "billion": 1e9}

PCT = re.compile(r"(\d+(?:\.\d+)?)\s*(?:%|percent\b|per cent\b)", re.I)
USD = re.compile(r"\$\s*(\d[\d,]*(?:\.\d+)?)\s*(million|thousand|billion|mm|mil|k|m|b)?\b", re.I)
SCALED = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(million|thousand|billion|k|m)\b", re.I)
PLAIN = re.compile(r"(?<![\w.])(\d[\d,]*(?:\.\d+)?)(?![\w%])")
QUARTER_RX = re.compile(r"\bQ([1-4])\b(?:\s+(\d{4}))?", re.I)
MONTH_RX = re.compile(r"\b(" + "|".join(sorted(MONTHS, key=len, reverse=True)) + r")\b(?:\s+(\d{4}))?", re.I)
QUESTION_START = re.compile(r"^\s*(what|what's|whats|how|who|which|when|where|why|is|are|did|does|do|can|could)\b", re.I)
DEFINITION_CUE = re.compile(r"\b(what is|what's|what are|what does|define|definition|meaning|mean)\b", re.I)


# ---------------------------------------------------------------- parsing
def amount(num, suffix=None):
    return float(num.replace(",", "")) * SCALE.get((suffix or "").lower(), 1)


def numbers(text):
    """[(kind, value)], kind in pct | usd | scaled | plain. Each piece of text is used once."""
    found = []

    def take(rx, kind, fn):
        nonlocal text
        for m in list(rx.finditer(text)):
            found.append((kind, fn(m)))
        text = rx.sub(lambda m: " " * len(m.group(0)), text)

    take(PCT, "pct", lambda m: float(m.group(1)))
    take(USD, "usd", lambda m: amount(m.group(1), m.group(2)))
    take(SCALED, "scaled", lambda m: amount(m.group(1), m.group(2)))
    for m in PLAIN.finditer(text):
        raw = m.group(1)
        if re.fullmatch(r"(19|20)\d\d", raw):  # a year, not a quantity
            continue
        found.append(("plain", amount(raw)))
    return found


def find_period(text, as_of):
    """'YYYY-MM' or 'YYYY-Qn' or None. Understands month names, quarters, 'last/this month|quarter'."""
    y, mth = as_of
    low = text.lower()
    q_now = (mth - 1) // 3 + 1
    if "last quarter" in low:
        return f"{y}-Q{q_now - 1}" if q_now > 1 else f"{y - 1}-Q4"
    if "this quarter" in low:
        return f"{y}-Q{q_now}"
    mq = QUARTER_RX.search(text)
    if mq:
        return f"{int(mq.group(2)) if mq.group(2) else y}-Q{mq.group(1)}"
    if "last month" in low:
        return f"{y - (mth == 1)}-{(mth - 2) % 12 + 1:02d}"
    if "this month" in low:
        return f"{y}-{mth:02d}"
    for m in MONTH_RX.finditer(text):
        word = m.group(1)
        if word.lower() == "may" and word != "May":  # "we may ..." is not a month
            continue
        return f"{int(m.group(2)) if m.group(2) else y}-{MONTHS[word.lower()]:02d}"
    return None


def find_metric(text, metrics):
    """(metric, None) or (None, reason). Longest match wins; two different metrics = ambiguous."""
    hits = []
    for met in metrics:
        for name in met["names"]:
            for m in re.finditer(rf"\b{re.escape(name)}s?\b", text, re.I):
                hits.append((len(name), m.span(), met))
    hits.sort(key=lambda h: -h[0])
    taken, chosen = [], {}
    for _, (a, b), met in hits:
        if all(b <= c or a >= d for c, d in taken):
            taken.append((a, b))
            chosen[met["id"]] = met
    if not chosen:
        return None, "no known metric mentioned"
    if len(chosen) > 1:
        return None, "more than one metric mentioned"
    return next(iter(chosen.values())), None


# ---------------------------------------------------------------- formatting
def fmt(met, v):
    if met["unit"] == "usd":
        return f"${v / 1e6:.2f}M" if v >= 1e6 else f"${v / 1e3:.0f}K" if v >= 1e3 else f"${v:.0f}"
    if met["unit"] == "percent":
        return f"{v:.1f}%"
    return f"{v:,.0f}"


def period_label(key):
    y, m = key.split("-")
    return f"{m} {y}" if m.startswith("Q") else f"{MONTH_NAME[int(m)]} {y}"


def value_for(met, key):
    """The metric's value for a month ('2026-03') or a quarter ('2026-Q1'); None if it cannot be computed.
    A quarter needs all three months and an 'aggregation' (sum, avg or last) in the catalog."""
    if "-Q" not in key:
        return met["values"].get(key)
    agg = met.get("aggregation")
    year, q = key.split("-Q")
    months = [met["values"].get(f"{year}-{m:02d}") for m in range(3 * int(q) - 2, 3 * int(q) + 1)]
    if agg not in ("sum", "avg", "last") or any(v is None for v in months):
        return None
    return {"sum": sum(months), "avg": sum(months) / 3, "last": months[-1]}[agg]


def card(kind, who, lines, source):
    title = {"diff": "DIFFERENT FROM SOURCE", "ok": "CONFIRMED", "answer": "ANSWER"}[kind]
    head = f"{title}" + (f"  (said by {who})" if who else "")
    out = ["  +-- " + head]
    out += ["  |   " + ln for ln in lines]
    out += ["  |   Source: " + source + "  [fictional demo data]", "  +--"]
    return "\n".join(out)


# ---------------------------------------------------------------- the decision
def check(sentence, who, data, verbose=False):
    """Returns a card (str) or None. None means: stay quiet."""
    metrics, glossary = data["metrics"], data.get("glossary", [])
    y, m, _ = data["as_of"].split("-")
    as_of = (int(y), int(m))
    quiet = (lambda why: f"  (quiet: {why})" if verbose else None)

    # 1) definitions ("What's churn in June?" has a period, so it is a value question, not a definition)
    if DEFINITION_CUE.search(sentence) and not find_period(sentence, as_of):
        low = sentence.lower()
        for g in glossary:
            if any(re.search(rf"\b{re.escape(t)}\b", low) for t in g["terms"]):
                return card("answer", who, [g["answer"]], g["source"])
        met, _ = find_metric(sentence, metrics)
        if met:
            return card("answer", who, [f"{met['label']}: {met['definition']}", f"Owner: {met['owner']}."],
                        met["source"])
        return quiet("asked for a definition I do not have")

    met, why = find_metric(sentence, metrics)
    if not met:
        return quiet(why)
    period = find_period(sentence, as_of)
    is_question = "?" in sentence or QUESTION_START.search(sentence)

    # 2) factual question
    if is_question:
        latest = max(met["values"])
        key = period or latest
        if value_for(met, key) is None:
            return quiet(f"no data for {period_label(key)}")
        note = "" if period else " (latest available, no period was mentioned)"
        return card("answer", who, [f"{met['label']}, {period_label(key)}: {fmt(met, value_for(met, key))}{note}"],
                    met["source"])

    # 3) a statement with a number: check it
    if not period:
        return quiet("no period mentioned, so I cannot tell which value to compare")
    actual = value_for(met, period)
    if actual is None:
        return quiet(f"no data for {period_label(period)}")
    kinds = {"percent": {"pct"}, "usd": {"usd", "scaled", "plain"}, "count": {"plain", "scaled"}}[met["unit"]]
    cands = [v for k, v in numbers(sentence) if k in kinds]
    if len(cands) != 1:
        return quiet("no comparable number" if not cands else "several numbers, not sure which one")
    said = cands[0]
    tol = met["tolerance"]
    if tol["type"] == "relative":
        off = abs(said - actual) / actual > tol["value"]
        pct = abs(said - actual) / actual * 100
        gap = f"{pct:.1f}%" if pct < 10 else f"{pct:.0f}%"  # "3%" next to a 3% tolerance would look contradictory
    else:
        off = abs(said - actual) > tol["value"]
        gap = f"{abs(said - actual):.1f} pp"
    head = f"{met['label']}, {period_label(period)}: {fmt(met, actual)}"
    if off:
        way = "above" if said > actual else "below"
        return card("diff", who, [head, f"Said {fmt(met, said)} ({gap} {way} the source)."], met["source"])
    return card("ok", who, [head, f"Matches what was said ({fmt(met, said)})."], met["source"])


# ---------------------------------------------------------------- CLI
def sentences(text):
    return [s for s in re.split(r"(?<=[.?!])\s+", text.strip()) if s]


def run_text(text, who, data, verbose):
    for s in sentences(text):
        out = check(s, who, data, verbose)
        if out:
            print(out)


def main():
    ap = argparse.ArgumentParser(description="Live Meeting Fact-Checker demo (fictional data)")
    ap.add_argument("text", nargs="*", help="a sentence to check")
    ap.add_argument("--transcript", help="a text file with lines like 'Name: sentence'")
    ap.add_argument("--data", default=str(HERE / "sample_metrics.json"))
    ap.add_argument("--verbose", action="store_true", help="say why it stayed quiet")
    a = ap.parse_args()
    try:
        sys.stdout.reconfigure(errors="replace")
    except Exception:
        pass
    data = json.loads(Path(a.data).read_text(encoding="utf-8"))
    print(BANNER + "\n")

    if a.text:
        run_text(" ".join(a.text), None, data, a.verbose)
    elif a.transcript:
        for line in Path(a.transcript).read_text(encoding="utf-8").splitlines():
            if not line.strip() or line.startswith("#"):
                continue
            m = re.match(r"^([A-Za-z][\w ]{0,20}):\s*(.*)$", line)
            who, text = (m.group(1), m.group(2)) if m else (None, line)
            print(f"{who + ': ' if who else ''}{text}")
            run_text(text, who, data, a.verbose)
            print()
    else:
        print("Type a sentence (empty line to quit). Try: Revenue in March was about $2.1M\n")
        while True:
            try:
                line = input("> ").strip()
            except EOFError:
                break
            if not line:
                break
            run_text(line, None, data, a.verbose)
            print()


if __name__ == "__main__":
    main()
