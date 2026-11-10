# Metric dictionary (format, draft v0)

The dictionary is the heart of the project. It says *what a number means* and *where to read it*. The demo reads `sample_metrics.json`; this page describes that format and where it should go.

> All example data is fictional.

## Why a dictionary

"Revenue" can mean three things in three dashboards. A checker that does not know *which* one it is quoting will eventually flag a correct number as wrong. The dictionary records the definition once, with an owner, so the checker can quote it and so people can argue about it in one place.

## A metric

```json
{
  "id": "churn",
  "label": "Churn rate",
  "names": ["churn", "churn rate"],
  "unit": "percent",
  "aggregation": "avg",
  "tolerance": {"type": "absolute", "value": 0.5},
  "definition": "Customers lost in the month divided by active customers at the start of the month.",
  "owner": "Customer Success",
  "source": "Sample retention report",
  "status": "validated",
  "values": {"2026-03": 4.1}
}
```

| Field | Meaning |
|---|---|
| `id` | Stable identifier. Never reuse it for a different definition. |
| `label` | How the card names the metric. |
| `names` | Aliases people say out loud. Plurals are matched automatically. |
| `heard_as` | *(optional)* How a speech model tends to **mishear** the name ("churn" heard as "chirni"). Treated like an alias. Add them as you discover them; they may not collide with another metric's names. |
| `unit` | `usd`, `percent` or `count`. Decides which spoken number can be compared. |
| `aggregation` | How months roll up into a quarter or year: `sum`, `avg` or `last`. If missing, quarters are not checked. |
| `tolerance` | When a spoken number counts as "the same": `relative` (a fraction) or `absolute` (points for percentages). |
| `definition` | One or two sentences, plain language. Shown when someone asks what it means. |
| `owner` | Who to ask. Shown on definition cards. |
| `source` | Where the number comes from. Shown on every card. |
| `status` | `validated` (the default) may correct people. `answer-only` may only answer questions, and the card says it is not validated. **Implemented in the demo.** |
| `values` | The demo's fake data. Real connectors replace this with a query. |

## The rule that matters most

**A metric without a validated definition must never correct anyone.** It can still answer a question, with its source and a "not yet validated" note. This is how the tool avoids the worst failure: a confident, wrong correction.

## Glossary entries

Definitions that are not metrics ("qualified lead", "MRR") live next to the metrics:

```json
{"terms": ["qualified lead"], "answer": "A signup that finished onboarding...", "source": "Handbook, section 2"}
```

## Validating a dictionary

```bash
python validate_dictionary.py path/to/dictionary.json
```

It checks that ids are unique, that **no alias is shared by two metrics** (the checker could not tell them apart), that units, aggregations, statuses and tolerances are valid, and that value keys look like `2026-03`. A dictionary that passes is well-formed, not correct. The sample dictionary is validated on every push.

## Where this is going

- A JSON Schema so editors can validate a dictionary as you type. 🙋
- `slices` (team, region, product) so "revenue for EMEA in March" is checkable.
- `reviewed_on` enforced, so a stale definition shows up as a warning.
- A connector per metric instead of inline `values`. See the [roadmap](ROADMAP.md), Phase 2.
