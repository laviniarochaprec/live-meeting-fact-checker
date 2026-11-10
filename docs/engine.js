/* Live Meeting Fact-Checker: the decision logic, in JavaScript (same behavior as demo.py).
 * Runs in the browser and in Node. No dependencies. ALL SAMPLE DATA IS FICTIONAL.
 *
 * check(sentence, who, data) returns:
 *   - a card   {kind: "diff"|"ok"|"answer", said_by, lines, source, as_of}
 *   - {quiet: "why"}  when it chose to stay silent (the UI may show the reason)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FactCheck = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MONTHS = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6,
    july: 7, jul: 7, august: 8, aug: 8, september: 9, sept: 9, sep: 9, october: 10, oct: 10,
    november: 11, nov: 11, december: 12, dec: 12,
  };
  const MONTH_NAME = ["", "January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"];
  const SCALE = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, mil: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

  const PCT = /(\d+(?:\.\d+)?)\s*(?:%|percent\b|per cent\b)/;
  const USD = /\$\s*(\d[\d,]*(?:\.\d+)?)\s*(million|thousand|billion|mm|mil|k|m|b)?\b/;
  const SCALED = /(\d[\d,]*(?:\.\d+)?)\s*(million|thousand|billion|k|m)\b/;
  const PLAIN = /(?<![\w.])(\d[\d,]*(?:\.\d+)?)(?![\w%])/;
  const QUARTER = /\bQ([1-4])\b(?:\s+(\d{4}))?/i;
  const MONTH_RX_SRC = "\\b(" + Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|") + ")\\b(?:\\s+(\\d{4}))?";
  const QUESTION_START = /^\s*(what|what's|whats|how|who|which|when|where|why|is|are|did|does|do|can|could)\b/i;
  const DEFINITION_CUE = /\b(what is|what's|what are|what does|define|definition|meaning|mean)\b/i;

  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const amount = (num, suffix) => parseFloat(num.replace(/,/g, "")) * (SCALE[(suffix || "").toLowerCase()] || 1);

  // ------------------------------------------------------------ parsing
  /** [[kind, value]], kind in pct | usd | scaled | plain. Each piece of text is used once. */
  function numbers(text) {
    const found = [];
    const take = (re, kind, fn) => {
      for (const m of text.matchAll(new RegExp(re.source, "gi"))) found.push([kind, fn(m)]);
      text = text.replace(new RegExp(re.source, "gi"), (s) => " ".repeat(s.length));
    };
    take(PCT, "pct", (m) => parseFloat(m[1]));
    take(USD, "usd", (m) => amount(m[1], m[2]));
    take(SCALED, "scaled", (m) => amount(m[1], m[2]));
    for (const m of text.matchAll(new RegExp(PLAIN.source, "g"))) {
      if (/^(19|20)\d\d$/.test(m[1])) continue; // a year, not a quantity
      found.push(["plain", amount(m[1])]);
    }
    return found;
  }

  /** "YYYY-MM", "YYYY-Qn" or null. asOf = [year, month]. */
  function findPeriod(text, asOf) {
    const [y, m] = asOf;
    const low = text.toLowerCase();
    const qNow = Math.floor((m - 1) / 3) + 1;
    if (low.includes("last quarter")) return qNow > 1 ? `${y}-Q${qNow - 1}` : `${y - 1}-Q4`;
    if (low.includes("this quarter")) return `${y}-Q${qNow}`;
    const mq = QUARTER.exec(text);
    if (mq) return `${mq[2] ? +mq[2] : y}-Q${mq[1]}`;
    if (low.includes("last month")) return `${y - (m === 1 ? 1 : 0)}-${pad(((m - 2) % 12 + 12) % 12 + 1)}`;
    if (low.includes("this month")) return `${y}-${pad(m)}`;
    for (const mt of text.matchAll(new RegExp(MONTH_RX_SRC, "gi"))) {
      if (mt[1].toLowerCase() === "may" && mt[1] !== "May") continue; // "we may ..." is not a month
      return `${mt[2] ? +mt[2] : y}-${pad(MONTHS[mt[1].toLowerCase()])}`;
    }
    return null;
  }

  /** {met} or {reason}. Longest match wins; two different metrics = ambiguous. */
  function findMetric(text, metrics) {
    const hits = [];
    for (const met of metrics) {
      for (const name of met.names.concat(met.heard_as || [])) {
        for (const m of text.matchAll(new RegExp(`\\b${esc(name)}s?\\b`, "gi"))) {
          hits.push({ len: name.length, a: m.index, b: m.index + m[0].length, met });
        }
      }
    }
    hits.sort((x, y) => y.len - x.len);
    const taken = [];
    const chosen = new Map();
    for (const h of hits) {
      if (taken.every(([c, d]) => h.b <= c || h.a >= d)) {
        taken.push([h.a, h.b]);
        chosen.set(h.met.id, h.met);
      }
    }
    if (chosen.size === 0) return { reason: "no known metric mentioned" };
    if (chosen.size > 1) return { reason: "more than one metric mentioned" };
    return { met: [...chosen.values()][0] };
  }

  // ------------------------------------------------------------ values and formatting
  function fmt(met, v) {
    if (met.unit === "usd") return v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;
    if (met.unit === "percent") return `${v.toFixed(1)}%`;
    return Math.round(v).toLocaleString("en-US");
  }

  function periodLabel(key) {
    const [y, m] = key.split("-");
    return m.startsWith("Q") ? `${m} ${y}` : `${MONTH_NAME[+m]} ${y}`;
  }

  /** Value for a month ("2026-03") or quarter ("2026-Q1"); null when it cannot be computed.
   *  A quarter needs all three months and an "aggregation" (sum, avg or last) in the dictionary. */
  function valueFor(met, key) {
    if (!key.includes("-Q")) return key in met.values ? met.values[key] : null;
    const [year, q] = key.split("-Q");
    const months = [];
    for (let m = 3 * q - 2; m <= 3 * q; m++) months.push(met.values[`${year}-${pad(m)}`]);
    if (!["sum", "avg", "last"].includes(met.aggregation) || months.some((v) => v === undefined)) return null;
    const sum = months.reduce((a, b) => a + b, 0);
    return { sum, avg: sum / 3, last: months[2] }[met.aggregation];
  }

  const card = (kind, who, lines, source) => ({ kind, said_by: who || null, lines, source });

  // ------------------------------------------------------------ the decision
  function check(sentence, who, data) {
    const quiet = (why) => ({ quiet: why });
    const [y, m] = data.as_of.split("-").map(Number);
    const asOf = [y, m];
    const stamp = (c) => Object.assign(c, { as_of: data.as_of });

    const period = findPeriod(sentence, asOf);

    // 1) definitions ("What's churn in June?" has a period, so it is a value question)
    if (DEFINITION_CUE.test(sentence) && !period) {
      const low = sentence.toLowerCase();
      for (const g of data.glossary || []) {
        if (g.terms.some((t) => new RegExp(`\\b${esc(t)}\\b`).test(low))) return stamp(card("answer", who, [g.answer], g.source));
      }
      const { met } = findMetric(sentence, data.metrics);
      if (met) return stamp(card("answer", who, [`${met.label}: ${met.definition}`, `Owner: ${met.owner}.`], met.source));
      return quiet("asked for a definition I do not have");
    }

    const found = findMetric(sentence, data.metrics);
    if (!found.met) return quiet(found.reason);
    const met = found.met;
    const isQuestion = sentence.includes("?") || QUESTION_START.test(sentence);

    // 2) factual question
    if (isQuestion) {
      const key = period || Object.keys(met.values).sort().pop();
      const v = valueFor(met, key);
      if (v === null) return quiet(`no data for ${periodLabel(key)}`);
      const note = period ? "" : " (latest available, no period was mentioned)";
      const lines = [`${met.label}, ${periodLabel(key)}: ${fmt(met, v)}${note}`];
      if (met.status === "answer-only") lines.push("Not validated yet: treat as indicative.");
      return stamp(card("answer", who, lines, met.source));
    }

    // 3) a statement with a number: check it (only metrics with a validated definition may correct anyone)
    if (met.status === "answer-only") return quiet(`${met.label} is answer-only (not validated), so it never corrects anyone`);
    if (!period) return quiet("no period mentioned, so I cannot tell which value to compare");
    const actual = valueFor(met, period);
    if (actual === null) return quiet(`no data for ${periodLabel(period)}`);
    const kinds = { percent: ["pct"], usd: ["usd", "scaled", "plain"], count: ["plain", "scaled"] }[met.unit];
    const cands = numbers(sentence).filter(([k]) => kinds.includes(k)).map(([, v]) => v);
    if (cands.length !== 1) return quiet(cands.length === 0 ? "no comparable number" : "several numbers, not sure which one");
    const said = cands[0];
    const tol = met.tolerance;
    let off, gap;
    if (tol.type === "relative") {
      const pct = (Math.abs(said - actual) / actual) * 100;
      off = Math.abs(said - actual) / actual > tol.value;
      gap = pct < 10 ? `${pct.toFixed(1)}%` : `${pct.toFixed(0)}%`;
    } else {
      off = Math.abs(said - actual) > tol.value;
      gap = `${Math.abs(said - actual).toFixed(1)} pp`;
    }
    const head = `${met.label}, ${periodLabel(period)}: ${fmt(met, actual)}`;
    if (off) {
      return stamp(card("diff", who, [head, `Said ${fmt(met, said)} (${gap} ${said > actual ? "above" : "below"} the source).`], met.source));
    }
    return stamp(card("ok", who, [head, `Matches what was said (${fmt(met, said)}).`], met.source));
  }

  // ------------------------------------------------------------ helpers for the UI
  const splitSentences = (text) => text.trim().split(/(?<=[.?!])\s+/).filter(Boolean);

  /** Lines like "Name: sentence" -> [{who, text}]. Blank lines and #comments are skipped. */
  function parseTranscript(text) {
    const out = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || line.startsWith("#")) continue;
      const m = /^([A-Za-z][\w ]{0,20}):\s*(.*)$/.exec(line);
      out.push(m ? { who: m[1], text: m[2] } : { who: null, text: line });
    }
    return out;
  }

  /** Speech models sometimes loop ("last day, last day, ...") or stutter ("what, what, what").
   *  Collapse stutters; return "" for a loop. */
  function cleanTranscript(text) {
    const t = text.replace(/\b([\w']+)([,.\s]+\1\b){2,}/gi, "$1");
    const words = t.toLowerCase().match(/[\w']+/g) || [];
    if (words.length >= 8 && new Set(words).size / words.length < 0.4) return "";
    return t.trim();
  }

  // ------------------------------------------------------------ dictionary validation
  const UNITS = ["usd", "percent", "count"];
  const AGGREGATIONS = ["sum", "avg", "last"];
  const STATUSES = ["validated", "answer-only"];
  const isText = (v) => typeof v === "string" && v.trim() !== "";

  /** List of problems (empty if well-formed). Mirrors validate_dictionary.py. */
  function validateDictionary(data) {
    const errs = [];
    if (!isText(data.company)) errs.push("top level: 'company' is missing");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.as_of || ""))) errs.push("top level: 'as_of' must look like 2026-06-30");
    if (!Array.isArray(data.metrics) || data.metrics.length === 0) return errs.concat("top level: 'metrics' must be a non-empty list");

    const ids = new Map();
    const aliases = new Map();
    data.metrics.forEach((m, i) => {
      const where = `metric #${i + 1} (${m.id || "?"})`;
      for (const f of ["id", "label", "definition", "owner", "source"]) if (!isText(m[f])) errs.push(`${where}: '${f}' is missing or empty`);
      if (ids.has(m.id)) errs.push(`${where}: id already used by metric #${ids.get(m.id)}`);
      else ids.set(m.id, i + 1);
      if (!Array.isArray(m.names) || m.names.length === 0 || !m.names.every(isText)) {
        errs.push(`${where}: 'names' must be a non-empty list of strings`);
      } else {
        for (const n of m.names) {
          const other = aliases.get(n.toLowerCase());
          if (other === undefined) aliases.set(n.toLowerCase(), m.id);
          else if (other !== m.id) errs.push(`${where}: alias '${n}' is also used by '${other}' (the checker could not tell them apart)`);
        }
      }
      if ("heard_as" in m && (!Array.isArray(m.heard_as) || !m.heard_as.every(isText))) errs.push(`${where}: 'heard_as' must be a list of strings`);
      for (const n of Array.isArray(m.heard_as) ? m.heard_as.filter(isText) : []) {
        const other = aliases.get(n.toLowerCase());
        if (other === undefined) aliases.set(n.toLowerCase(), m.id);
        else if (other !== m.id) errs.push(`${where}: heard_as '${n}' is also used by '${other}'`);
      }
      if (!UNITS.includes(m.unit)) errs.push(`${where}: 'unit' must be one of ${JSON.stringify(UNITS)}`);
      if ("aggregation" in m && !AGGREGATIONS.includes(m.aggregation)) errs.push(`${where}: 'aggregation' must be one of ${JSON.stringify(AGGREGATIONS)}`);
      if ("status" in m && !STATUSES.includes(m.status)) errs.push(`${where}: 'status' must be one of ${JSON.stringify(STATUSES)}`);
      const t = m.tolerance;
      if (!t || !["relative", "absolute"].includes(t.type) || typeof t.value !== "number" || t.value <= 0) {
        errs.push(`${where}: 'tolerance' needs a type (relative|absolute) and a positive value`);
      }
      if (!m.values || typeof m.values !== "object" || Object.keys(m.values).length === 0) {
        errs.push(`${where}: 'values' must be a non-empty object`);
      } else {
        for (const [k, v] of Object.entries(m.values)) {
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(k)) errs.push(`${where}: value key '${k}' must look like 2026-03`);
          else if (typeof v !== "number") errs.push(`${where}: value for ${k} must be a number`);
        }
      }
    });
    (data.glossary || []).forEach((g, i) => {
      const where = `glossary entry #${i + 1}`;
      if (!Array.isArray(g.terms) || g.terms.length === 0 || !g.terms.every(isText)) errs.push(`${where}: 'terms' must be a non-empty list of strings`);
      for (const f of ["answer", "source"]) if (!isText(g[f])) errs.push(`${where}: '${f}' is missing or empty`);
    });
    return errs;
  }

  return { check, numbers, findPeriod, findMetric, valueFor, fmt, periodLabel, splitSentences, parseTranscript, cleanTranscript, validateDictionary };
});
