// Live Meeting Fact-Checker (beta): the page. Logic lives in engine.js. ALL SAMPLE DATA IS FICTIONAL.
const FC = window.FactCheck;
const $ = (sel) => document.querySelector(sel);

const EXAMPLE = `# A made-up meeting at a made-up company (Acme Cloud). Nothing here is real.
Alex: Let's start with the numbers. Revenue in March was about $2.1M.
Sam: I thought churn was higher, maybe 6% in March.
Jo: Active customers in June were 12,900.
Alex: What is an active customer?
Sam: How many new signups did we get last month?
Jo: The offsite was a great success, everyone loved it.
Alex: Revenue in April was $1.8M.
Sam: What's churn in June?
Jo: What does MRR mean?
Alex: I feel the new pricing page helped churn.
Sam: Signups in February were 600.
Alex: Revenue last quarter was 5 million.
Jo: NPS in March was 60.
Sam: What was NPS in March?
Alex: Revenue in Q1 was $5.2M.`;

let data = null; // the dictionary in use

// ------------------------------------------------------------------ tabs
const TABS = ["try", "live", "cat"];
const PANELS = { try: "try", live: "live", cat: "dictionary" };
function showTab(name) {
  for (const t of TABS) {
    $(`#tab-${t}`).setAttribute("aria-selected", String(t === name));
    $(`#${PANELS[t]}`).hidden = t !== name;
  }
}
for (const t of TABS) $(`#tab-${t}`).addEventListener("click", () => showTab(t));

// ------------------------------------------------------------------ cards
const TAG = { diff: "DIFFERENT FROM SOURCE", ok: "CONFIRMED", answer: "ANSWER" };

function cardEl(c) {
  const el = document.createElement("div");
  el.className = `card ${c.kind}`;
  const tag = document.createElement("div");
  tag.className = "tag";
  tag.textContent = TAG[c.kind];
  if (c.said_by) {
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = `said by ${c.said_by}`;
    tag.append(who);
  }
  el.append(tag);
  for (const line of c.lines) {
    const p = document.createElement("p");
    p.textContent = line;
    el.append(p);
  }
  const src = document.createElement("div");
  src.className = "src";
  src.textContent = `Source: ${c.source} · data as of ${c.as_of}${data && data.company ? " · " + data.company : ""}`;
  el.append(src);
  return el;
}

function quietEl(why) {
  const p = document.createElement("p");
  p.className = "quiet";
  p.textContent = `(stayed quiet: ${why})`;
  return p;
}

/** Runs the checker on every sentence of one speaker's text and appends the results to `box`. */
function checkInto(box, who, text, { showQuiet, prepend = false } = {}) {
  const els = [];
  for (const s of FC.splitSentences(text)) {
    const r = FC.check(s, who, data);
    if (r.quiet) {
      if (showQuiet) els.push(quietEl(r.quiet));
    } else {
      els.push(cardEl(r));
    }
  }
  if (prepend) els.reverse().forEach((e) => box.prepend(e));
  else els.forEach((e) => box.append(e));
  return els.length;
}

// ------------------------------------------------------------------ try it
function runSentence() {
  const text = $("#sentence").value.trim();
  if (!text) return;
  const box = $("#out");
  box.replaceChildren();
  const line = document.createElement("div");
  line.className = "line";
  line.textContent = text;
  box.append(line);
  if (!checkInto(box, null, text, { showQuiet: true })) box.append(quietEl("nothing to check here"));
}

function runTranscript() {
  const box = $("#out");
  box.replaceChildren();
  const showQuiet = $("#showQuiet").checked;
  for (const { who, text } of FC.parseTranscript($("#transcript").value)) {
    const line = document.createElement("div");
    line.className = "line";
    const name = document.createElement("b");
    name.textContent = who ? `${who}: ` : "";
    line.append(name, document.createTextNode(text));
    box.append(line);
    checkInto(box, who, text, { showQuiet });
  }
}

$("#checkOne").addEventListener("click", runSentence);
$("#sentence").addEventListener("keydown", (e) => { if (e.key === "Enter") runSentence(); });
$("#runTranscript").addEventListener("click", runTranscript);
$("#loadExample").addEventListener("click", () => { $("#transcript").value = EXAMPLE; runTranscript(); });

// ------------------------------------------------------------------ dictionary
function showDictionary() { $("#dictionaryJson").value = JSON.stringify(data, null, 2); }

function applyDictionary() {
  const msg = $("#dictionaryMsg");
  let parsed;
  try { parsed = JSON.parse($("#dictionaryJson").value); } catch (e) { msg.textContent = `Not valid JSON: ${e.message}`; return; }
  const errs = FC.validateDictionary(parsed);
  if (errs.length) { msg.textContent = errs.map((e) => `- ${e}`).join("\n"); return; }
  data = parsed;
  msg.textContent = "";
  msg.style.color = "var(--ok)";
  msg.textContent = "Dictionary is valid and in use. Go to “Try it”.";
  setTimeout(() => { msg.style.color = ""; }, 4000);
}

async function loadSample() {
  const r = await fetch("sample_metrics.json");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

$("#applyDictionary").addEventListener("click", applyDictionary);
$("#resetDictionary").addEventListener("click", async () => { data = await loadSample(); showDictionary(); $("#dictionaryMsg").textContent = ""; });
$("#downloadDictionary").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([$("#dictionaryJson").value], { type: "application/json" }));
  a.download = "my_metrics.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

// ------------------------------------------------------------------ live audio
const CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";
const RATE = 16000;
let asr = null; // {name, fn}
const live = { sources: [], queue: [], busy: false, activity: null };

const setStatus = (t) => { $("#liveStatus").textContent = t; };

async function loadModel(name) {
  if (asr && asr.name === name) return asr.fn;
  const bar = $("#progress");
  bar.hidden = false;
  setStatus(`Downloading the speech model (${name}). This happens once; your browser caches it.`);
  const { pipeline, env } = await import(CDN);
  env.allowLocalModels = false;
  env.backends.onnx.wasm.proxy = false; // a worker loaded from the CDN is refused by browsers, so inference runs on the main thread for now
  const fn = await pipeline("automatic-speech-recognition", name, {
    device: "wasm",
    progress_callback: (p) => { if (p.status === "progress" && typeof p.progress === "number") bar.value = p.progress; },
  });
  bar.hidden = true;
  asr = { name, fn };
  return fn;
}

/** When the meeting audio was playing. The microphone is ignored in those moments (it is just the echo). */
class Activity {
  constructor() { this.closed = []; this.open = null; }
  begin(t) { this.open = t; }
  end(a, b) { this.closed = this.closed.concat([[a, b]]).slice(-40); this.open = null; }
  overlap(a, b, slack = 0.6) {
    const now = performance.now() / 1000;
    const ivs = this.closed.concat(this.open !== null ? [[this.open, now]] : []);
    const playing = ivs.reduce((sum, [x, y]) => sum + Math.max(0, Math.min(b, y + slack) - Math.max(a, x - slack)), 0);
    return playing / Math.max(b - a, 1e-6);
  }
}

/** Cuts a stream into utterances: speech ends after 0.5 s of silence (or 15 s). */
class Cutter {
  constructor(label, onUtterance, activity) {
    Object.assign(this, { label, onUtterance, activity, buf: [], quiet: 0, speaking: false, noise: 0.003, start: 0 });
  }
  feed(x) {
    const dur = x.length / RATE;
    let s = 0;
    for (let i = 0; i < x.length; i++) s += x[i] * x[i];
    const rms = Math.sqrt(s / x.length);
    const voice = rms > Math.max(0.008, this.noise * 3);
    if (!voice) this.noise = 0.95 * this.noise + 0.05 * rms;
    const now = performance.now() / 1000;
    if (voice) {
      if (!this.speaking) {
        this.start = now - dur;
        if (this.label === "Meeting") this.activity.begin(this.start);
      }
      this.speaking = true;
      this.quiet = 0;
    } else if (this.speaking) {
      this.quiet += dur;
    }
    if (this.speaking) this.buf.push(x);
    const total = this.buf.reduce((n, b) => n + b.length, 0) / RATE;
    if (this.speaking && (this.quiet >= 0.5 || total >= 15)) {
      const end = now - this.quiet;
      if (this.label === "Meeting") this.activity.end(this.start, end);
      const echo = this.label === "You" && this.activity.overlap(this.start, end) > 0.35;
      if (total >= 0.8 && !echo) {
        const all = new Float32Array(this.buf.reduce((n, b) => n + b.length, 0));
        let o = 0;
        for (const b of this.buf) { all.set(b, o); o += b.length; }
        this.onUtterance(this.label, all);
      }
      this.buf = [];
      this.quiet = 0;
      this.speaking = false;
    }
  }
}

const JUNK = /^\s*(thank you\.?|thanks for watching\.?|you\.?|bye\.?|\[.*\]|\(.*\))\s*$/i; // things the model invents on silence

function addLine(label, text) {
  const box = $("#liveLines");
  const p = document.createElement("div");
  const b = document.createElement("b");
  b.textContent = `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}  ${label}: `;
  p.append(b, document.createTextNode(text));
  box.prepend(p);
}

function handleText(label, raw) {
  const text = FC.cleanTranscript(raw); // collapses stutters, drops model loops
  if (!text || JUNK.test(text)) return;
  addLine(label, text);
  const box = $("#liveCards");
  checkInto(box, label, text, { prepend: true });
  while (box.children.length > 12) box.lastChild.remove();
}

async function pump() {
  if (live.busy) return;
  live.busy = true;
  while (live.queue.length) {
    const { label, audio } = live.queue.shift();
    setStatus(`Transcribing… (${live.queue.length} waiting)`);
    try {
      const out = await asr.fn(audio, { chunk_length_s: 30 });
      handleText(label, (out.text || "").trim());
    } catch (e) {
      setStatus(`Transcription error: ${e.message}`);
    }
  }
  live.busy = false;
  if (live.sources.length) setStatus("Listening…");
}

function enqueue(label, audio) {
  live.queue.push({ label, audio });
  pump();
}

async function getStream(kind) {
  if (kind === "mic") {
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  }
  const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  if (!s.getAudioTracks().length) {
    s.getTracks().forEach((t) => t.stop());
    throw new Error('No audio was shared. Choose a browser TAB and tick "Share tab audio".');
  }
  return s;
}

async function startSource(kind) {
  const label = kind === "mic" ? "You" : "Meeting";
  if (live.sources.some((s) => s.label === label)) return;
  try {
    await loadModel($("#model").value);
    const stream = await getStream(kind);
    if (!live.activity) live.activity = new Activity();
    const ctx = new AudioContext({ sampleRate: RATE });
    if (ctx.state === "suspended") await ctx.resume();
    const src = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain(); // nothing is played back
    mute.gain.value = 0;
    const cutter = new Cutter(label, enqueue, live.activity);
    proc.onaudioprocess = (e) => cutter.feed(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);
    stream.getAudioTracks()[0].addEventListener("ended", () => stopLive());
    live.sources.push({ label, stream, ctx, proc });
    $("#stopLive").disabled = false;
    setStatus("Listening…");
  } catch (e) {
    $("#progress").hidden = true;
    setStatus(`Could not start (${label}): ${e.message}`);
  }
}

function stopLive() {
  for (const s of live.sources) {
    s.stream.getTracks().forEach((t) => t.stop());
    s.proc.disconnect();
    s.ctx.close();
  }
  live.sources = [];
  live.queue = [];
  live.activity = null;
  $("#stopLive").disabled = true;
  setStatus("Stopped.");
}

$("#consent").addEventListener("change", (e) => {
  $("#startMic").disabled = !e.target.checked;
  $("#startTab").disabled = !e.target.checked;
});
$("#startMic").addEventListener("click", () => startSource("mic"));
$("#startTab").addEventListener("click", () => startSource("tab"));
$("#stopLive").addEventListener("click", stopLive);

// ------------------------------------------------------------------ start
(async function init() {
  $("#transcript").value = EXAMPLE;
  try {
    data = await loadSample();
    showDictionary();
  } catch (e) {
    $("#out").textContent = location.protocol === "file:"
      ? "Open this page through a web server, not as a file. In this folder run: python -m http.server 8000, then visit http://localhost:8000"
      : `Could not load the sample dictionary (${e.message}).`;
    $("#checkOne").disabled = $("#runTranscript").disabled = true;
  }
})();
