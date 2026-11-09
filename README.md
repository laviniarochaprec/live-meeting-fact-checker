# Live Meeting Fact-Checker

**An open idea: an assistant that listens to your meeting, catches wrong numbers as they are said, and answers questions on the spot, using your own company's data.**

> Status: idea + design notes. A working prototype exists; this repo is where the idea gets shaped in the open.
> **We want your comments.** Open a [Discussion](../../discussions) or an [Issue](../../issues) and tell us what you would use it for, what would break it, and what you would build on top.

---

## The problem

Every company has the same meeting:

- Someone says *"we closed 40 million last month"*. Another person remembers 46. Nobody has the dashboard open, so the number stays on the record, wrong.
- Someone asks *"wait, how do we define a qualified lead?"* and the meeting stalls for five minutes, or the answer is a guess.
- Notes and AI summaries arrive *after* the meeting. They record what was said, including the errors.

Meeting assistants today transcribe and summarize. None of them **check what was said against your company's source of truth while the meeting is still happening**.

## The idea

A small side panel that sits next to your video call:

```
 ┌─────────────────────────────────────────────┐
 │ SAID BY: Alex                               │
 │ "Churn in March was around 6%."             │
 │                                             │
 │ ⚠ DIFFERENT FROM SOURCE                     │
 │ Churn, March: 4.1%                          │
 │ Said 6.0% (1.9 pp above official).          │
 │ Source: Finance dashboard · read 09:12      │
 └─────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────┐
 │ ANSWER                                      │
 │ Q: "What counts as an active customer?"     │
 │ Paid at least one invoice in the last 90    │
 │ days. Source: Metrics handbook, §2.         │
 └─────────────────────────────────────────────┘
```

Three behaviors:

1. **Check** a number when someone says it (metric + period + slice + value) and speak up only if it is off.
2. **Answer** quick factual questions ("what was revenue in Q2?", "who owns this metric?").
3. **Explain** definitions and rules from your own documents ("what is a qualified lead?").

It is connected to **each company's own database and docs**, so the same tool adapts to any business by changing the metric catalog, not the code.

## Design principles

These come from building a prototype and getting it wrong a few times.

1. **Silence beats a wrong correction.** If it is not sure of the metric, the period, the slice, or the definition, it says nothing. A confident wrong alert destroys trust in one meeting.
2. **Numbers are checked by code, not by a language model.** Claim extraction and comparison are deterministic (with tolerances for "about 40 million"). A model may *explain*, never *decide* what the right number is.
3. **Every number has a validated definition.** "Revenue" or "closed deals" can mean three things in three dashboards. The metric catalog records the definition, the query, and who validated it. No validation, no correction (answer-only at most).
4. **Read-only, least privilege.** It reads from a replica or a dedicated read-only user. It never writes to your systems.
5. **Always show the source and the freshness.** Every card says where the number came from and when it was read.
6. **Cheap by default.** Speech-to-text and the rules engine can run locally or on a small server. A local small LLM is optional and only for explanations. No per-minute API bill is required.
7. **Consent and privacy first.** The meeting is being transcribed; people must be told. Nothing is stored by default. Not for use with external parties unless everyone agrees.

## How it could work

```
 Meeting audio (system sound + microphone)
        │
        ▼
 Local speech-to-text  ──►  who is speaking (speaker embeddings)
        │
        ▼
 Claim extractor  (metric · period · slice · number)      Question router
        │                                                       │
        ▼                                                       ▼
 Metric catalog ──► read-only queries ──► compare      Docs / glossary search
 (definitions,        against your DB or BI            (+ optional local LLM
  validated)                                             to phrase the answer)
        │                                                       │
        └──────────────────────► side panel ◄──────────────────┘
                              (browser tab / Teams / Zoom app)
```

- **Capture:** system audio loopback plus microphone, cut into utterances on silence.
- **Transcription:** a local Whisper-class model, with a domain vocabulary prompt (metric names, team names, people).
- **Metric catalog:** a versioned file per metric: names and aliases, the query, the definition, the owner, the tolerance, and whether it may *correct* or only *answer*.
- **Panel:** a small web page that any participant can open. Only the person running the listener needs the heavy parts.

## What a prototype taught us

- **Echo ruins transcripts.** Without headphones, the microphone hears the speakers and the same sentence is transcribed twice, the second time badly. Gate the microphone while the meeting audio is playing.
- **A vocabulary prompt is the cheapest accuracy win.** Feeding the speech model your metric names, product terms and people's names fixed most mistakes before we tried a bigger model.
- **Bigger model, slower panel.** A larger speech model was about three times slower on a laptop CPU for modest gains. Latency matters more than polish in a live meeting.
- **Same name, different numbers.** The same metric split by team gave different values in two systems, because "team" was defined differently. The tool must know *which* definition it is quoting, and say so on the card.
- **Do not trust one source for everything.** Some questions are answered by a database, some by a BI model, some by a document. Route by question type and label the source.

## Open questions (this is where we need you)

- Which **meetings** would benefit most: sales reviews, finance check-ins, operations stand-ups, board meetings, incident calls?
- Which **data sources** matter first: SQL warehouse, a BI tool, spreadsheets, a CRM, a wiki?
- How do you keep a **metric catalog** alive without it becoming another stale document?
- What is the right **UX for a correction** so it informs without embarrassing anyone?
- How should **consent** work in a call with a mix of people and companies?
- How do you handle **multiple languages** in the same meeting?
- What would make you **trust** it enough to leave it on?
- Is there prior art we should read or build on?

## How to take part

- 💬 **Share an idea or a use case** in [Discussions](../../discussions).
- 🐛 **Point out a flaw in the design** by opening an [Issue](../../issues).
- 🔧 **Want to build a piece?** (audio capture, a connector for your database, a panel, a metric-catalog format.) Say so in a Discussion and we will sketch the interface together.

Comments in **English or Portuguese** are welcome.

## License

[MIT](LICENSE). Ideas and docs here are free to use, adapt and build on.
