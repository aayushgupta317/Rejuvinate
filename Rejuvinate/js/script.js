// =====================================================
//  GEMINI API KEY
//  Get a new one free at: https://aistudio.google.com/apikey
// =====================================================
const GEMINI_API_KEY = "AQ.Ab8RN6Klip1l5MB4VRaqgp26UKBKMw5zmkyUYeNJTtu6-_Uc8A"; // <- put your own key here

// Fastest first. The last working model is remembered and tried first next time.
const MODELS = [
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview" // slowest, backup only
];

// Lower = faster. Options: "minimal", "low", "medium", "high"
const THINKING_LEVEL = "minimal";

// If a model sends nothing for this long, give up on it and try the next one.
const FIRST_TOKEN_TIMEOUT_MS = 8000;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const LANGUAGES = [
  "Python", "JavaScript", "TypeScript", "Java", "C", "C++", "C#", "Go", "Rust",
  "PHP", "Ruby", "Swift", "Kotlin", "Dart", "Scala", "R", "MATLAB", "Perl",
  "Lua", "Haskell", "Elixir", "Bash/Shell", "PowerShell", "SQL", "HTML", "CSS",
  "JSON", "YAML", "Visual Basic", "Objective-C", "COBOL", "Fortran", "Assembly"
];

const EXAMPLES = {
  py2: {
    mode: "convert", src: "Python", target: "Python",
    extra: "Convert from Python 2 to modern Python 3.",
    code: `import urllib2

def fetch(url):
    print "Fetching", url
    data = urllib2.urlopen(url).read()
    for i in xrange(3):
        print "attempt %d" % i
    return data

if __name__ == "__main__":
    print fetch("http://example.com")`
  },
  jquery: {
    mode: "convert", src: "JavaScript", target: "JavaScript",
    extra: "Remove jQuery and use modern vanilla JavaScript (ES6+).",
    code: `$(document).ready(function () {
  $("#save").click(function () {
    var name = $("#name").val();
    $.ajax({
      url: "/api/save",
      type: "POST",
      data: { name: name },
      success: function (res) { $("#msg").text("Saved!"); },
      error: function () { $("#msg").text("Error"); }
    });
  });
});`
  },
  js2py: {
    mode: "convert", src: "JavaScript", target: "Python", extra: "",
    code: `function fizzbuzz(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) out.push("FizzBuzz");
    else if (i % 3 === 0) out.push("Fizz");
    else if (i % 5 === 0) out.push("Buzz");
    else out.push(String(i));
  }
  return out;
}
console.log(fizzbuzz(15).join("\\n"));`
  },
  broken: {
    mode: "fix", src: "JavaScript", target: "JavaScript", extra: "",
    error: "Uncaught TypeError: items.map is not a function",
    code: `function total(items) {
  var sum = 0
  items.map(function(i) { sum += i.price * i.qty })
  return sum
}

console.log(total({ price: 5, qty: 2 }))`
  }
};

// ================== ELEMENTS ==================
const $ = (id) => document.getElementById(id);
const sourceLang = $("sourceLang");
const targetLang = $("targetLang");
const targetField = $("targetField");
const extraInstructions = $("extraInstructions");
const errorField = $("errorField");
const errorMsg = $("errorMsg");
const inputCode = $("inputCode");
const outputCode = $("outputCode");
const notes = $("notes");
const convertBtn = $("convertBtn");
const copyBtn = $("copyBtn");
const clearBtn = $("clearBtn");
const postBtn = $("postBtn");
const postModal = $("postModal");
const postTitle = $("postTitle");
const postError = $("postError");
const statusEl = $("status");
const modeHint = $("modeHint");

let mode = "convert"; // "convert" | "fix"
let lastResult = null;  // the most recent generated code, used by Post to Team

// ================== UI HELPERS ==================
function setStatus(msg, type = "") {
  statusEl.className = "status " + type;
  statusEl.textContent = msg;
}

// ================== INIT ==================
function fillSelect(select, includeAuto) {
  select.innerHTML = "";
  if (includeAuto) select.add(new Option("Auto-detect", "Auto-detect"));
  LANGUAGES.forEach((l) => select.add(new Option(l, l)));
}
fillSelect(sourceLang, true);
fillSelect(targetLang, false);
targetLang.value = "Python";

// Preselect target language from the home page link (?to=Rust)
const toParam = new URLSearchParams(location.search).get("to");
if (toParam && [...targetLang.options].some((o) => o.value === toParam)) {
  targetLang.value = toParam;
}

function keyIsSet() {
  return GEMINI_API_KEY && GEMINI_API_KEY.trim() !== "" &&
         GEMINI_API_KEY !== "PASTE_YOUR_API_KEY_HERE";
}

if (!keyIsSet()) {
  setStatus("Open js/script.js and paste your API key on the GEMINI_API_KEY line.", "error");
}

// ================== MODE TABS ==================
function setMode(newMode) {
  mode = newMode;
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.mode === mode)
  );
  if (mode === "convert") {
    targetField.classList.remove("hidden");
    errorField.classList.add("hidden");
    convertBtn.textContent = "Convert Code";
    modeHint.textContent = "Paste code in an old language or version and convert it to a new one.";
  } else {
    targetField.classList.add("hidden");
    errorField.classList.remove("hidden");
    convertBtn.textContent = "Fix Code";
    modeHint.textContent =
      "Paste code that didn't work (plus the error, if you have it) and get a corrected, updated version.";
  }
}
document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => setMode(tab.dataset.mode))
);

// ================== EXAMPLES ==================
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const ex = EXAMPLES[chip.dataset.example];
    if (!ex) return;
    setMode(ex.mode);
    sourceLang.value = ex.src;
    targetLang.value = ex.target;
    extraInstructions.value = ex.extra || "";
    errorMsg.value = ex.error || "";
    inputCode.value = ex.code;
    setStatus("Example loaded. Click the big button to run it.", "");
  });
});

// ================== PROMPT BUILDER ==================
function buildPrompt(code) {
  const src = sourceLang.value;
  const srcText = src === "Auto-detect" ? "its detected language" : src;
  const extra = extraInstructions.value.trim();
  const extraBlock = extra ? `\nAdditional instructions from the user:\n${extra}\n` : "";

  const format = `
Respond in EXACTLY this format and nothing else:
1. One fenced code block containing ONLY the final code (no explanations inside it).
2. After the code block, a line that says NOTES: followed by at most 3 bullets, each under 15 words.`;

  if (mode === "convert") {
    return `You are an expert software engineer and code translator.

Convert the code below from ${srcText} to ${targetLang.value}.

Rules:
- Preserve behavior, logic, and structure as closely as possible.
- Use modern, idiomatic ${targetLang.value} and current best practices.
- Keep comments short and names meaningful.
- Include all needed imports.
- Never invent libraries or functions that do not exist.
${extraBlock}${format}
In NOTES, list key differences and anything the user must install or change.

CODE:
${code}`;
  }

  const err = errorMsg.value.trim();
  return `You are an expert software engineer and debugger.

The code below${src === "Auto-detect" ? "" : " (" + src + ")"} is outdated or does not work. Fix it and update it to modern, current best practices: repair bugs and syntax errors, replace deprecated APIs, and keep the original intent.
${err ? "\nError / problem reported by the user:\n" + err + "\n" : ""}${extraBlock}${format}
In NOTES, explain what was wrong and what you changed.

CODE:
${code}`;
}

// ================== STREAMING API CALL ==================
// Streams the answer so text appears immediately instead of after the full wait.
const noThinking = new Set();   // models that rejected the thinking setting
const cache = new Map();        // prompt -> finished answer (repeat runs are instant)

async function streamModel(model, prompt, onText, useThinking = true, timeoutMs = 0) {
  if (noThinking.has(model)) useThinking = false;
  const url = `${API_BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

  const generationConfig = { temperature: 0.2 };
  if (useThinking && THINKING_LEVEL) {
    generationConfig.thinkingConfig = { thinkingLevel: THINKING_LEVEL };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = timeoutMs
    ? setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs)
    : null;
  const slowError = () => {
    const err = new Error(`${model} was too slow.`);
    err.retryNext = true;
    return err;
  };

  let res;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY.trim()
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig
      })
    });
  } catch (e) {
    clearTimeout(timer);
    if (timedOut) throw slowError();
    const err = new Error("Network error. Check your internet or disable ad blockers.");
    err.retryNext = false;
    throw err;
  }

  if (!res.ok) {
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    const msg = data?.error?.message || `Request failed (${res.status})`;

    // This model rejected the thinking setting: retry the same model without it.
    if (res.status === 400 && useThinking && /think/i.test(msg)) {
      noThinking.add(model);
      return streamModel(model, prompt, onText, false, timeoutMs);
    }

    const err = new Error(msg);
    err.retryNext =
      [404, 429, 500, 503].includes(res.status) ||
      /no longer available|not found|not supported|deprecated/i.test(msg);
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let blockReason = "";

  try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep any partial line for the next chunk

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        const chunk = JSON.parse(json);
        if (chunk?.promptFeedback?.blockReason) blockReason = chunk.promptFeedback.blockReason;
        const parts = chunk?.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
          if (p.thought) continue; // skip thinking text
          if (p.text) full += p.text;
        }
        if (full) clearTimeout(timer); // first real text arrived
        onText(full);
      } catch (e) { /* ignore a malformed chunk */ }
    }
  }
  } catch (e) {
    if (timedOut) throw slowError();
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!full) {
    const err = new Error(blockReason ? `Blocked by safety filter: ${blockReason}` : "Empty response from Gemini.");
    err.retryNext = !blockReason;
    throw err;
  }
  return full;
}

async function callGemini(prompt, onText) {
  if (!keyIsSet()) {
    throw new Error("No API key. Open js/script.js and paste it on the GEMINI_API_KEY line.");
  }

  if (cache.has(prompt)) { onText(cache.get(prompt)); return cache.get(prompt); }

  // Try the last model that worked first (skips slow failures).
  const remembered = localStorage.getItem("working_model");
  const order = remembered
    ? [remembered, ...MODELS.filter((m) => m !== remembered)]
    : MODELS;

  let lastError;
  for (const [i, model] of order.entries()) {
    try {
      const isLast = i === order.length - 1;
      const text = await streamModel(model, prompt, onText, true, isLast ? 0 : FIRST_TOKEN_TIMEOUT_MS);
      localStorage.setItem("working_model", model);
      cache.set(prompt, text);
      return text;
    } catch (err) {
      lastError = err;
      console.warn(`Model "${model}" failed:`, err.message);
      if (!err.retryNext) throw err; // bad key, blocked content, network, etc.
    }
  }
  throw lastError;
}

// ================== RESPONSE PARSER ==================
// Works on partial text too, so the code shows up while it is still streaming.
function parseResponse(text) {
  const fence = text.indexOf("```");
  let code = "";
  let noteText = "";

  if (fence === -1) {
    code = text.trim();
  } else {
    const afterFence = text.slice(fence);
    const nl = afterFence.indexOf("\n");
    const body = nl === -1 ? "" : afterFence.slice(nl + 1);
    const close = body.indexOf("```");

    if (close === -1) {
      code = body; // still streaming
    } else {
      code = body.slice(0, close).trimEnd();
      noteText = body.slice(close + 3).replace(/^\s*NOTES:?\s*/i, "").trim();
    }
  }
  return { code, noteText };
}

// ================== MAIN ACTION ==================
async function run() {
  const code = inputCode.value.trim();
  if (!code) { setStatus("Please paste some code first.", "error"); return; }
  if (!keyIsSet()) {
    setStatus("Open js/script.js and paste your API key on the GEMINI_API_KEY line.", "error");
    return;
  }

  convertBtn.disabled = true;
  copyBtn.disabled = true;
  postBtn.disabled = true;
  lastResult = null;
  notes.classList.add("hidden");
  outputCode.textContent = "";
  statusEl.className = "status";
  statusEl.innerHTML = '<span class="spinner"></span>Working with Gemini...';

  const started = performance.now();

  try {
    await callGemini(buildPrompt(code), (partial) => {
      const { code: c, noteText } = parseResponse(partial);
      outputCode.textContent = c;
      if (noteText) {
        notes.textContent = noteText;
        notes.classList.remove("hidden");
      }
    });

    copyBtn.disabled = false;
    lastResult = {
      code: outputCode.textContent,
      notes: notes.textContent,
      mode,
      language: mode === "convert" ? targetLang.value : (sourceLang.value === "Auto-detect" ? "Code" : sourceLang.value),
      from: sourceLang.value
    };
    postBtn.disabled = !lastResult.code;
    const secs = ((performance.now() - started) / 1000).toFixed(1);
    setStatus(`Done in ${secs}s`, "ok");
  } catch (err) {
    if (!outputCode.textContent) outputCode.textContent = "Your updated code will appear here.";
    setStatus(err.message, "error");
  } finally {
    convertBtn.disabled = false;
  }
}

convertBtn.addEventListener("click", run);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run();
});

// ================== COPY / CLEAR ==================
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputCode.textContent);
    copyBtn.textContent = "Copied!";
  } catch {
    copyBtn.textContent = "Press Ctrl+C";
  }
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
});

clearBtn.addEventListener("click", () => {
  inputCode.value = "";
  errorMsg.value = "";
  extraInstructions.value = "";
  outputCode.textContent = "Your updated code will appear here.";
  notes.classList.add("hidden");
  copyBtn.disabled = true;
  postBtn.disabled = true;
  lastResult = null;
  setStatus("");
});

// ================== POST TO TEAM ==================
function openPostModal() {
  if (!lastResult) return;
  postTitle.value = lastResult.mode === "fix"
    ? `Fixed ${lastResult.language} code`
    : `${lastResult.from === "Auto-detect" ? "Code" : lastResult.from} → ${lastResult.language}`;
  $("postModalMeta").textContent = `${lastResult.language} · ${lastResult.mode === "fix" ? "Fixed" : "Converted"}`;
  postError.classList.add("hidden");
  postModal.classList.remove("hidden");
  postTitle.focus();
  postTitle.select();
}
function closePostModal() { postModal.classList.add("hidden"); }

function confirmPost() {
  const title = postTitle.value.trim();
  if (!title) {
    postError.textContent = "Please enter a title.";
    postError.classList.remove("hidden");
    postTitle.focus();
    return;
  }
  try {
    const post = TeamStore.add({ title, ...lastResult });
    closePostModal();
    statusEl.className = "status ok";
    statusEl.textContent = "Posted to Team! ";
    const a = document.createElement("a");
    a.href = "team.html#" + post.id;
    a.textContent = "View it on the Team page";
    a.style.color = "var(--accent)";
    statusEl.append(a);
  } catch {
    postError.textContent = "Couldn't save the post (browser storage is full or blocked).";
    postError.classList.remove("hidden");
  }
}

postBtn.addEventListener("click", openPostModal);
$("postCancel").addEventListener("click", closePostModal);
$("postConfirm").addEventListener("click", confirmPost);
postModal.addEventListener("click", (e) => { if (e.target === postModal) closePostModal(); });
postTitle.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); confirmPost(); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePostModal(); });
