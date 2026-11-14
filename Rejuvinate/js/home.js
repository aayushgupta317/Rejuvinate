// ============ DATA ============
const LANGUAGES = [
  "Python", "JavaScript", "TypeScript", "Java", "C", "C++", "C#", "Go", "Rust",
  "PHP", "Ruby", "Swift", "Kotlin", "Dart", "Scala", "R", "MATLAB", "Perl",
  "Lua", "Haskell", "Elixir", "Bash/Shell", "PowerShell", "SQL", "HTML", "CSS",
  "JSON", "YAML", "Visual Basic", "Objective-C", "COBOL", "Fortran", "Assembly"
];

// Demo examples that rotate in the hero window
const DEMOS = [
  {
    title: "Python 2 → Python 3",
    before: `print "Hello", name\nfor i in xrange(3):\n    print i`,
    after: `print("Hello", name)\nfor i in range(3):\n    print(i)`
  },
  {
    title: "JavaScript → Python",
    before: `const nums = [1, 2, 3];\nconst doubled = nums.map(n => n * 2);\nconsole.log(doubled);`,
    after: `nums = [1, 2, 3]\ndoubled = [n * 2 for n in nums]\nprint(doubled)`
  },
  {
    title: "Fix broken JavaScript",
    before: `function add(a, b) {\n  retrun a + b\n}\nconsole.log(add(1 2))`,
    after: `function add(a, b) {\n  return a + b;\n}\nconsole.log(add(1, 2));`
  }
];

const $ = (id) => document.getElementById(id);

// ============ LANGUAGE CLOUD ============
// Clicking a language opens the converter with ?to=Language
const cloud = $("langCloud");
LANGUAGES.forEach((lang) => {
  const a = document.createElement("a");
  a.className = "chip";
  a.textContent = lang;
  a.href = "index.html?to=" + encodeURIComponent(lang);
  cloud.appendChild(a);
});

// ============ TYPING DEMO ============
const beforeEl = $("demoBefore");
const afterEl = $("demoAfter");
const titleEl = $("demoTitle");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeInto(el, text, speed) {
  el.textContent = "";
  for (const ch of text) {
    el.textContent += ch;
    await sleep(speed);
  }
}

async function runDemo() {
  let i = 0;
  while (true) {
    const d = DEMOS[i % DEMOS.length];
    titleEl.textContent = d.title;
    afterEl.textContent = "";
    await typeInto(beforeEl, d.before, 22);
    await sleep(500);
    await typeInto(afterEl, d.after, 22);
    await sleep(2600);
    i++;
  }
}
runDemo();

// ============ COUNT-UP STATS ============
function countUp(el) {
  const target = Number(el.dataset.count);
  const steps = 30;
  let n = 0;
  const timer = setInterval(() => {
    n++;
    el.textContent = Math.round((target * n) / steps);
    if (n >= steps) clearInterval(timer);
  }, 30);
}

// ============ SCROLL REVEAL ============
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("show");
    observer.unobserve(entry.target);
  });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

const statObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll("[data-count]").forEach(countUp);
    statObserver.unobserve(entry.target);
  });
}, { threshold: 0.4 });
statObserver.observe(document.querySelector(".stats"));

// ============ FOOTER YEAR ============
$("year").textContent = new Date().getFullYear();
