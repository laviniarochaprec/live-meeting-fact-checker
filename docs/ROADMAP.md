# Roadmap

Honest status: **Phase 0 is done. Everything else is open.** Items marked 🙋 are good places to jump in.

## Phase 0: prove the decision logic ✅

- [x] Check a spoken number against a dictionary (tolerance, relative or absolute)
- [x] Answer factual questions and definitions
- [x] Stay quiet when unsure, and say why in `--verbose`
- [x] Runnable demo with fictional data, no dependencies

## Phase 1: make the dictionary real

Goal: anyone can describe their own metrics and trust the result.

- [x] Quarters with per-metric aggregation (sum / average / last)
- [ ] Years and "year to date" 🙋
- [x] Dictionary validator (`validate_dictionary.py`), run on every push
- [ ] JSON Schema for the dictionary, so editors can validate as you type ([spec](METRIC_DICTIONARY.md)) 🙋
- [x] `validated` vs `answer-only` status per metric, enforced by the checker
- [x] Cards as plain data, with `--json` output a panel can read
- [ ] Slices: "revenue for the EMEA team in March" (metric + period + slice)
- [ ] Relative periods: "last week", "year to date", "same month last year"
- [ ] Number parsing in other languages and formats (Portuguese, Spanish, German decimals) 🙋

## Phase 2: real data connectors

Goal: replace the sample JSON with the company's own source of truth. Read-only, always.

- [ ] Connector interface (one small function: `get(metric, period, slice) -> value, source, as_of`)
- [ ] CSV / spreadsheet connector 🙋
- [ ] SQL connector (Postgres first) with a read-only user and statement timeouts 🙋
- [ ] BI semantic-model connector (query a published model)
- [ ] Caching and freshness: cards always show when the number was read

## Phase 3: live audio

Goal: hear the meeting instead of typed sentences.

- [x] **Browser beta:** microphone and/or a shared meeting tab, cut into utterances on silence, local speech model in the browser (no install, nothing uploaded)
- [x] Echo handling: the microphone is ignored while the meeting tab is speaking
- [ ] Desktop capture of system audio (not only a browser tab), for call apps that are not in a browser 🙋
- [ ] Local speech-to-text with a domain vocabulary prompt (not available in the browser model today)
- [ ] Speaker separation (who said it)
- [ ] Latency budget and a benchmark you can run on your own laptop 🙋

## Phase 4: the panel

Goal: other participants see the cards without installing anything.

- [ ] Small web panel that any participant can open from a link
- [ ] Optional embedding as a meeting-app side panel
- [ ] "Dismiss" and "show me the query" on every card
- [ ] Consent banner and a one-click pause

## Phase 5: trust at scale

- [ ] Precision and noise metrics measured per meeting (the success criteria in the [vision](VISION.md))
- [ ] Dictionary review workflow: owners, review dates, change history
- [ ] Multi-language meetings
- [ ] Pilot with 3 teams in different functions (sales, finance, ops)

## How priorities are decided

1. Anything that **reduces wrong alerts** comes first.
2. Then anything that **widens what can be checked** (dictionary, slices, connectors).
3. Audio and UI polish come after the logic is trusted, because a slick panel with wrong cards is worse than a plain one with right cards.

Suggest a change in [Discussions](../../../discussions). Concrete tasks live in [Issues](../../../issues).
