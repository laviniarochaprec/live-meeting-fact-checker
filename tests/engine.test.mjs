// Tests for docs/engine.js. Same behavior as tests/test_demo.py. All data is fictional.
// Run:  node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FC = require("../docs/engine.js");
const DATA = JSON.parse(readFileSync(new URL("../sample_metrics.json", import.meta.url), "utf-8"));

const run = (s, who = null) => FC.check(s, who, DATA);
const text = (c) => (c && c.lines ? c.lines.join(" | ") : "");
const quiet = (s) => assert.ok(run(s).quiet, `expected silence for: ${s}`);

test("flags numbers that are far off", () => {
  const c = run("Revenue in March was about $2.1M.");
  assert.equal(c.kind, "diff");
  assert.match(text(c), /\$1\.84M/);
  assert.match(text(c), /14% above/);
  assert.equal(run("I thought churn was higher, maybe 6% in March.").kind, "diff");
  assert.match(text(run("I thought churn was higher, maybe 6% in March.")), /1\.9 pp above/);
  assert.equal(run("Signups in February were 600.").kind, "diff");
});

test("confirms numbers within tolerance", () => {
  assert.equal(run("Active customers in June were 12,900.").kind, "ok");
  assert.equal(run("Active customers in March were 12.3 thousand.").kind, "ok");
  assert.equal(run("Churn in March was 4.3%.").kind, "ok");
});

test("answers questions and definitions", () => {
  assert.match(text(run("How many new signups did we get last month?")), /May 2026: 520/);
  assert.match(text(run("What's churn in June?")), /3\.7%/);
  assert.match(text(run("What does MRR mean?")).toLowerCase(), /monthly recurring revenue/);
  assert.match(text(run("What is an active customer?")), /paid invoice/);
});

test("stays quiet when unsure", () => {
  quiet("The offsite was a great success, everyone loved it.");
  quiet("Revenue was $2M.");
  quiet("Churn in March 2025 was 3%.");
  quiet("Revenue and churn in March were both up.");
  quiet("I feel the new pricing page helped churn in March.");
  quiet("We may see revenue grow at 9%.");
  quiet("Revenue in March 2026 was strong.");
});

test("quarters use the dictionary's aggregation", () => {
  assert.equal(run("Revenue in Q1 was $5.2M.").kind, "ok");
  assert.match(text(run("What was churn in Q2?")), /4\.0%/);
  assert.equal(run("Active customers in Q1 were 12,310.").kind, "ok");
  quiet("Revenue in Q3 was $6M.");
  assert.equal(FC.findPeriod("last quarter", [2026, 6]), "2026-Q1");
  assert.equal(FC.findPeriod("last quarter", [2026, 2]), "2025-Q4");
  assert.equal(FC.findPeriod("this quarter", [2026, 6]), "2026-Q2");
  const noAgg = { ...DATA.metrics[0] };
  delete noAgg.aggregation;
  assert.equal(FC.valueFor(noAgg, "2026-Q1"), null);
});

test("an unvalidated metric never corrects anyone", () => {
  quiet("NPS in March was 60.");
  const c = run("What was NPS in March?");
  assert.match(text(c), /35/);
  assert.match(text(c), /Not validated yet/);
  assert.ok(!/Not validated/.test(text(run("What was churn in March?"))));
});

test("small gaps keep a decimal so 3.2% is not shown as 3%", () => {
  assert.match(text(run("Revenue last quarter was 5 million.")), /3\.2% below/);
});

test("cards are plain data stamped with the data date", () => {
  const c = run("Revenue in March was about $2.1M.", "Alex");
  assert.equal(c.said_by, "Alex");
  assert.equal(c.as_of, DATA.as_of);
  assert.doesNotThrow(() => JSON.stringify(c));
});

test("number parsing", () => {
  const kinds = FC.numbers("$2.1M, 6% and 12,900 customers in 2026").map(([k]) => k).sort();
  assert.deepEqual(kinds, ["pct", "plain", "usd"]);
  assert.equal(FC.findPeriod("last month", [2026, 6]), "2026-05");
  assert.equal(FC.findPeriod("last month", [2026, 1]), "2025-12");
});

test("transcript helpers", () => {
  assert.deepEqual(FC.splitSentences("Revenue was 4.1M. Is that right? Yes."), ["Revenue was 4.1M.", "Is that right?", "Yes."]);
  assert.deepEqual(FC.parseTranscript("# note\nAlex: Hello there.\n\nplain line"), [
    { who: "Alex", text: "Hello there." },
    { who: null, text: "plain line" },
  ]);
});

test("dictionary validation", () => {
  assert.deepEqual(FC.validateDictionary(DATA), []);
  const bad = (fn) => {
    const d = JSON.parse(JSON.stringify(DATA));
    fn(d);
    return FC.validateDictionary(d);
  };
  assert.ok(bad((d) => (d.metrics[1].id = d.metrics[0].id)).some((e) => /already used/.test(e)));
  assert.ok(bad((d) => d.metrics[1].names.push("revenue")).some((e) => /alias 'revenue'/.test(e)));
  assert.ok(bad((d) => (d.metrics[0].unit = "euros")).some((e) => /'unit'/.test(e)));
  assert.ok(bad((d) => (d.metrics[0].tolerance = { type: "relative", value: 0 })).some((e) => /'tolerance'/.test(e)));
  assert.ok(bad((d) => (d.metrics[0].values.March = 1)).some((e) => /must look like 2026-03/.test(e)));
});

test("pronunciation aliases (heard_as) let a misheard word still match", () => {
  const c = run("Chirni in March was 6%.");
  assert.equal(c.kind, "diff");
  assert.match(text(c), /Churn rate, March 2026: 4\.1%/);
});

test("heard_as is validated and may not collide with another metric", () => {
  const bad = (fn) => {
    const d = JSON.parse(JSON.stringify(DATA));
    fn(d);
    return FC.validateDictionary(d);
  };
  assert.ok(bad((d) => (d.metrics[0].heard_as = "revenue")).some((e) => /'heard_as' must be a list/.test(e)));
  assert.ok(bad((d) => (d.metrics[0].heard_as = ["chirn"])).some((e) => /heard_as 'chirn'/.test(e)));
});

test("transcript cleaning collapses stutters and drops model loops", () => {
  assert.equal(FC.cleanTranscript("What, what, what, what, what was revenue in March?"), "What was revenue in March?");
  assert.equal(FC.cleanTranscript("Last day, ".repeat(40)), "");
  assert.equal(FC.cleanTranscript("Churn in March was 6%."), "Churn in March was 6%.");
  assert.equal(FC.cleanTranscript("That was very, very good."), "That was very, very good.");
});
