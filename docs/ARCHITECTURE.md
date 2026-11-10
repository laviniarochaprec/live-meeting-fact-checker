# Architecture

Draft. The demo implements only the middle box (decision logic). The rest is the plan, and the plan is open to challenge.

```
 Meeting audio (system sound + microphone)
        │
        ▼
 ┌──────────────┐   ┌──────────────────┐
 │ Capture      │──►│ Speech-to-text    │──► speaker label
 │ (utterances) │   │ (local, vocab     │
 └──────────────┘   │  prompt)          │
                    └─────────┬─────────┘
                              ▼
                    ┌──────────────────┐
                    │ Decision logic    │  ◄── this is the demo
                    │  - find metric    │
                    │  - find period    │
                    │  - find number    │
                    │  - question or    │
                    │    statement?     │
                    └───┬──────────┬───┘
                        │          │
             ┌──────────▼──┐   ┌───▼────────────┐
             │ Metric       │   │ Docs / glossary │
             │ dictionary +    │   │ search          │
             │ connectors   │   │ (+ optional     │
             │ (read-only)  │   │  local LLM to   │
             └──────┬───────┘   │  phrase answers)│
                    │           └───┬─────────────┘
                    ▼               ▼
                 Cards (JSON) ──► Panel (web page, any participant)
```

## Components and their contracts

| Component | Input | Output | Notes |
|---|---|---|---|
| Capture | audio stream | utterances (audio + timestamps) | Gate the microphone while meeting audio plays, otherwise speakers are heard twice |
| Speech-to-text | utterance | text | Local model; feed it a vocabulary of metric and people names |
| Decision logic | text + speaker | a card, or nothing | Deterministic. Nothing is the right answer most of the time |
| Connector | metric, period, slice | value, source, as-of time | Read-only. One small function per source |
| Docs search | question | best passage + source | Keyword search is enough to start |
| Local LLM *(optional)* | question + passage | a phrased answer | Only for explanations. Never decides a number |
| Panel | cards | what participants see | A static page polling a small API is enough |

## The card (the one data shape that crosses boundaries)

```json
{"kind": "diff", "title": "Churn rate, March 2026: 4.1%", "text": "Said 6.0% (1.9 pp above the source).",
 "source": "Sample retention report", "as_of": "2026-06-30T09:12", "said_by": "Sam"}
```

`kind` is one of `diff`, `ok`, `answer`. Everything the panel needs is in the card. This keeps the audio side and the UI side independent.

## Privacy model

- Transcription runs on the machine of the person running the listener.
- The server (if any) receives **text only, never audio**.
- Nothing is persisted by default. Rooms live in memory and expire.
- Connectors use a **read-only** credential with a statement timeout.
- Participants are told the meeting is being transcribed. Not for use with external parties unless everyone agrees.

## Threats we think about

| Threat | Why it matters | Mitigation |
|---|---|---|
| Wrong alert shown to a room | Embarrassment, loss of trust | Silence when unsure, tolerance per metric, answer-only until validated |
| Data exfiltration through the panel | The panel shows company numbers | Link is a random room id, rooms expire, no listing, put it behind your network or SSO |
| Heavy queries hurting the database | A listener should never slow production | Read replica, read-only user, timeouts, caching |
| Prompt injection through the transcript | Someone says "ignore previous instructions" | The LLM only phrases an answer from retrieved text and never picks numbers or runs queries |
| Credentials leaking | Connectors hold secrets | Secrets in environment variables, never in the dictionary or the repo |

## What we deliberately did not decide yet

- The panel's transport (polling vs push).
- Whether the listener and the checker are one process or two.
- How to authenticate participants who open the panel.

Tell us what you would pick, and why, in [Discussions](../../../discussions).
