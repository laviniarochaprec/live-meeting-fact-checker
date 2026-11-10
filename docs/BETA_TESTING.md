# Beta testing guide

Thank you for testing. This takes about 10 minutes and needs no account and no install.

> **All sample data is fictional.** "Acme Cloud" does not exist. Please do **not** type real company numbers, names or confidential material into the beta, and do not use it on real calls with people who have not agreed.

## What you need

- A recent **Chrome or Edge** on a computer (the Live tab needs it; the other tabs work in any modern browser).
- Headphones, if you want to test the Live tab (otherwise the microphone hears the speakers).

## Privacy, in plain words

- Your sentences, your dictionary and your **audio never leave your browser**. There is no server.
- The only download is the speech model (about 40 MB) the first time you use the Live tab, from a public CDN. Your browser keeps it afterwards.
- Nothing is saved when you close the tab.

## Test 1: does it catch a wrong number? (Try it tab)

Type each sentence and press **Check**.

| Sentence | You should see |
|---|---|
| `Revenue in March was about $2.1M` | **DIFFERENT FROM SOURCE**, the real value `$1.84M` |
| `Active customers in June were 12,900` | **CONFIRMED** |
| `What was churn in June?` | **ANSWER**: `3.7%` |
| `What does MRR mean?` | **ANSWER** with a definition |
| `NPS in March was 60` | **Nothing** (the metric is not validated, so it never corrects) |
| `Revenue was $2M` | **Nothing** (no period, so it cannot tell which value to compare) |

Silence is a feature. Tick *show why it stayed quiet* in the meeting box to see the reason each time.

## Test 2: a whole meeting

Press **Load the example meeting**. You should get 12 cards: 4 different, 3 confirmed, 5 answers. Did every card feel right? Was any one annoying or confusing?

## Test 3: your own metrics (the important one)

Open the **Dictionary** tab and replace two or three metrics with ones from your world (**invented numbers**, please). Press **Validate and use**, go back to *Try it*, and say sentences you actually hear in meetings.

- Did the dictionary format let you describe your metric? What was missing?
- Did a sentence from your real meetings get ignored that you wish it had caught?
- Did it flag something that was actually fine?

## Test 4: listening (Live tab)

1. Tick the consent box, choose a model, press **Listen to my microphone**, allow the microphone.
2. Say: *"Churn in March was six percent."* then, after a pause, *"What was revenue in March?"*
3. To listen to a call instead: press **Listen to a meeting tab**, choose the **tab** with your call and tick **Share tab audio**.

Things worth noticing:
- How many seconds from the end of your sentence to the card?
- Did it write what you said? Numbers, names and accents are the hard part.
- Without headphones, did the same sentence show up twice?

## How to report

Open a [Discussion](../../../discussions) or an [Issue](../../../issues/new/choose) and tell us:

1. **What you did** (the exact sentence, or the step).
2. **What you expected** and **what happened**.
3. Your **browser and system** (e.g. Chrome on Windows).
4. For the Live tab: **how long it took** and **what it heard**.

Screenshots are welcome, as long as they show only the fictional data.

## Known limits of the beta

- **English only** for now (speech and number parsing). See the open issue about other languages.
- The Live tab uses a small model that runs on your CPU, so it is slower and less accurate than a desktop setup. The first time, it downloads the model (about 80 MB for the recommended `base.en`).
- **Speech models mishear domain words.** In our own test, "churn" came out as "chirni" and "revenue" as "revanui" with the small model. If a word of yours is misheard, add what you saw to `heard_as` in the dictionary ([spec](METRIC_DICTIONARY.md)) and tell us which words kept failing.
- The page can freeze for a moment while it transcribes (the model runs on the page itself, not in a background worker yet).
- The model sometimes loops or stutters ("what, what, what"). The page collapses stutters and drops loops.
- It hears **one tab and one microphone**. It does not identify who is speaking beyond "You" and "Meeting".
- Months and quarters work. Years, "year to date" and slices ("for team X") do not yet.
- Chrome and Edge only for the Live tab.
