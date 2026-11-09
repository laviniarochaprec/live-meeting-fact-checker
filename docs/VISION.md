# Vision

## In one line

**Make every number said in a meeting trustworthy, in real time.**

Think of it as a *spell-checker for numbers*: invisible when you are right, useful the moment you are wrong.

## Why this, why now

- **Transcripts and summaries are commodities.** Many tools write down what was said. None of the common ones check it against the company's own source of truth *while the meeting is still going on*.
- **The ingredients got cheap.** Speech-to-text that runs on a laptop CPU is good enough. Read-only access to a warehouse or BI model is normal. Side panels inside video-call apps exist.
- **The pain is universal and recurring.** Every weekly review has someone saying a number from memory, and someone else not having the dashboard open.

## Who it is for

| Persona | Pain today | What they get |
|---|---|---|
| Leader running a weekly review | Decisions made on a wrong number | A quiet check that speaks up only when it matters |
| The analyst who is the "human fact-checker" | Interrupted all meeting to look things up | The lookup happens on its own |
| Finance / FP&A | Definitions drift between teams | One catalog of validated definitions, quoted with the source |
| The BI / data team | Questions about "what does this metric mean?" in every meeting | Definitions answered from the catalog they own |

## What winning looks like

We would call the idea proven when a pilot team can say yes to all of these after four weeks:

1. **Precision:** at least 95% of the alerts it raised were correct (a wrong alert is worse than none).
2. **Noise:** fewer than one false alert per meeting hour.
3. **Speed:** a card appears within about 3 seconds of the sentence ending.
4. **Coverage:** a meaningful share of the numbers said out loud are checkable (we track this, it starts low and grows with the catalog).
5. **Stickiness:** the team keeps it on without being reminded.

## Strategy

1. **Wedge on numbers, not summaries.** Do one thing nobody else does. Do not become another note-taker.
2. **Earn trust through silence and provenance.** Stay quiet when unsure. Show the source and the freshness on every card.
3. **The metric catalog is the moat.** The shared, validated definitions are the valuable part. The audio plumbing is replaceable.
4. **Cheap and local by default.** If trying it costs nothing and needs no procurement, people will try it.
5. **Open and self-hostable.** Companies will not point a listening tool at their data unless they can read the code and run it themselves.

## Positioning

- Not a **note-taker**: it does not summarize.
- Not a **chatbot over your data**: it does not answer free-form analytics questions. It checks claims and answers questions that map to a validated metric or a written definition.
- Not a **BI replacement**: it reads from your BI and warehouse, never writes.

## Non-goals

- No summaries, action items or CRM updates.
- No storing of recordings or transcripts by default.
- No automatic correction of people in front of others without them being able to see the source.
- No "AI decides the right number". Numbers come from validated queries.

## Risks and how we handle them

| Risk | Mitigation |
|---|---|
| A confident wrong alert | Deterministic checks, per-metric tolerance, "answer-only" mode until a metric is validated, silence when unsure |
| Speech-to-text mishears a number ("15" vs "50") | Show what was heard on the card; add a vocabulary prompt; allow the speaker to dismiss |
| Same metric, different definitions | Every card names the definition and source it quoted |
| Consent and privacy | Tell participants; no storage by default; not for external parties unless all agree |
| Latency makes it useless | Budget of a few seconds; small local model by default; bigger model optional |
| Catalog rots | Owners and review dates in the catalog; unvalidated metrics are answer-only |

## Where this goes

See the [roadmap](ROADMAP.md) for phases and milestones, the [metric catalog spec](METRIC_CATALOG.md) for the format that everything else depends on, and the [architecture](ARCHITECTURE.md) for how the pieces fit.
