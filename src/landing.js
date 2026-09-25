import { calculateCockcroftGault, calculateEgfrCkdEpi2021, getCkdStage } from "./renal.js";
import { gaugePosition } from "./ui/kidneyCard.js";
import { initTheme } from "./ui/theme.js";

// Telegram Mini App launches and shared check links (#c=...) belong in the
// calculator, not on the landing page.
const params = new URLSearchParams(window.location.search);
if (
  params.get("telegram") === "1" ||
  params.has("tgWebAppData") ||
  /(^#|&)(c=|tgWebAppData)/.test(window.location.hash)
) {
  window.location.replace(`/app/${window.location.search}${window.location.hash}`);
}

initTheme();

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;


/* ---------- Nav ---------- */
function initNav() {
  const nav = document.getElementById("lp-nav");
  if (!nav) return;
  const update = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/* ---------- Drug marquee ---------- */
function initMarquee() {
  const track = document.getElementById("lp-marquee");
  if (!track) return;
  const drugs = [
    "Meropenem",
    "Piperacillin/tazobactam",
    "Vancomycin",
    "Cefepime",
    "Apixaban",
    "Rivaroxaban",
    "Enoxaparin",
    "Gabapentin",
    "Pregabalin",
    "Levetiracetam",
    "Metformin",
    "Sitagliptin",
    "Levofloxacin",
    "Ciprofloxacin",
    "Acyclovir",
    "Valacyclovir",
    "Famotidine",
    "Allopurinol",
    "Dabigatran",
    "Fluconazole",
    "Oseltamivir",
    "Colistin",
    "Ertapenem",
    "Topiramate",
  ];
  // Two copies so the -50% translate loops seamlessly.
  for (const name of [...drugs, ...drugs]) {
    const chip = document.createElement("span");
    chip.textContent = name;
    track.append(chip);
  }
}

/* ---------- Scroll reveal, stats, steps ---------- */
function initReveal() {
  const targets = [...document.querySelectorAll("[data-reveal]")];
  // Stagger siblings that reveal together.
  targets.forEach((element) => {
    const siblings = [...element.parentElement.children].filter((child) => child.hasAttribute("data-reveal"));
    element.style.setProperty("--reveal-delay", `${siblings.indexOf(element) * 90}ms`);
  });

  if (reducedMotion || !("IntersectionObserver" in window)) {
    targets.forEach((element) => element.classList.add("is-visible"));
    document.getElementById("lp-steps")?.style.setProperty("--progress", "1");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        entry.target.querySelectorAll("[data-count]").forEach(countUp);
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
  );
  targets.forEach((element) => observer.observe(element));

  const steps = document.getElementById("lp-steps");
  if (steps) {
    new IntersectionObserver(
      ([entry], stepObserver) => {
        if (entry.isIntersecting) {
          steps.style.setProperty("--progress", "1");
          stepObserver.disconnect();
        }
      },
      { threshold: 0.4 }
    ).observe(steps);
  }
}

function countUp(element) {
  const target = Number(element.dataset.count);
  const duration = 1400;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) ** 4;
    element.textContent = Math.round(target * eased).toLocaleString("en-US");
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- Pointer effects: demo tilt and card spotlight ---------- */
function initPointerEffects() {
  if (reducedMotion || !finePointer) return;

  const demo = document.getElementById("lp-demo");
  const hero = document.querySelector(".lp-hero");
  if (demo && hero) {
    hero.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      demo.style.setProperty("--lp-tilt-y", `${-8 + x * 10}deg`);
      demo.style.setProperty("--lp-tilt-x", `${4 - y * 8}deg`);
    });
    hero.addEventListener("pointerleave", () => {
      demo.style.removeProperty("--lp-tilt-y");
      demo.style.removeProperty("--lp-tilt-x");
    });
  }

  document.querySelectorAll(".lp-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  });
}

/* ---------- Live demo ---------- */
// Card text mirrors what the calculator returns for these patients today;
// kidney numbers are computed live with the app's own equations.
const SCENARIOS = [
  {
    input: "72 M 78 kg SCr 1.8 meropenem IV, doxy oral",
    patient: { age: 72, sex: "male", weight: 78, creatinine: 1.8 },
    status: "",
    cards: [
      {
        drug: "Meropenem",
        route: "IV",
        badge: ["good", "Clinician-verified"],
        dose: "Every 12 hours",
        note: "CrCl 26–50 · recommended dose",
        decision: ["warn", "Adjust dose"],
      },
      {
        drug: "Doxycycline",
        route: "Oral",
        badge: ["info", "Curated · draft"],
        dose: "No renal adjustment",
        note: "All CrCl values",
        decision: ["good", "No change"],
      },
    ],
  },
  {
    input: "82 F 55 kg SCr 1.6 apixaban, gabapentin",
    patient: { age: 82, sex: "female", weight: 55, creatinine: 1.6 },
    status: "",
    cards: [
      {
        drug: "Apixaban",
        route: "Oral",
        badge: ["info", "Curated · draft"],
        dose: "2.5 mg twice daily",
        note: "NVAF dose-reduction criteria met: 3 of 3",
        decision: ["info", "Label dose"],
      },
      {
        drug: "Gabapentin",
        route: "Oral",
        badge: ["info", "Curated · draft"],
        dose: "200–700 mg/day",
        note: "CrCl 15 to <30 · once daily",
        decision: ["warn", "Adjust dose"],
      },
    ],
  },
  {
    input: "60 M 70 kg SCr 7.2 on HD · cefepime IV",
    patient: { age: 60, sex: "male", weight: 70, creatinine: 7.2 },
    status: "On hemodialysis — the label's dialysis rule is used",
    cards: [
      {
        drug: "Cefepime",
        route: "IV",
        badge: ["info", "Curated · draft"],
        dose: "1 g day 1, then 500 mg q24h",
        note: "Give after hemodialysis on dialysis days",
        decision: ["info", "HD rule"],
      },
    ],
  },
];

function initDemo() {
  const demo = document.getElementById("lp-demo");
  if (!demo) return;
  const els = {
    typed: document.getElementById("demo-typed"),
    crcl: document.getElementById("demo-crcl"),
    egfr: document.getElementById("demo-egfr"),
    stage: document.getElementById("demo-stage"),
    marker: document.getElementById("demo-marker"),
    status: document.getElementById("demo-status"),
    cards: document.getElementById("demo-cards"),
    gauge: demo.querySelector(".lp-demo-gauge"),
  };

  if (reducedMotion) {
    showScenario(els, SCENARIOS[0], { animate: false });
    return;
  }

  let visible = true;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(demo);
  const whenActive = async () => {
    while (!visible || document.hidden) {
      await sleep(400);
    }
  };

  (async function loop() {
    await sleep(900);
    for (let index = 0; ; index = (index + 1) % SCENARIOS.length) {
      await whenActive();
      await playScenario(els, SCENARIOS[index], whenActive);
    }
  })();
}

async function playScenario(els, scenario, whenActive) {
  for (let i = 1; i <= scenario.input.length; i += 1) {
    els.typed.textContent = scenario.input.slice(0, i);
    await sleep(22 + Math.random() * 38);
  }
  await sleep(350);
  showScenario(els, scenario, { animate: true });
  await sleep(4200);
  await whenActive();
  els.cards.querySelectorAll(".lp-demo-card").forEach((card) => card.classList.add("is-leaving"));
  await sleep(260);
  for (let i = scenario.input.length; i >= 0; i -= 3) {
    els.typed.textContent = scenario.input.slice(0, i);
    await sleep(10);
  }
  els.cards.textContent = "";
  els.status.textContent = "";
}

function showScenario(els, scenario, { animate }) {
  els.typed.textContent = scenario.input;
  const crcl = calculateCockcroftGault(scenario.patient);
  const egfr = calculateEgfrCkdEpi2021(scenario.patient);
  const stage = getCkdStage(egfr);
  tween(els.crcl, crcl, animate);
  tween(els.egfr, egfr, animate);
  els.stage.textContent = stage.stage;
  els.gauge.style.setProperty("--pos", `${gaugePosition(egfr)}%`);
  els.gauge.style.setProperty("--marker-opacity", "1");
  els.status.textContent = scenario.status;

  els.cards.textContent = "";
  scenario.cards.forEach((card, index) => {
    const element = document.createElement("div");
    element.className = "lp-demo-card";
    element.dataset.tone = card.decision[0];
    element.style.setProperty("--i", String(animate ? index + 2 : 0));
    element.append(
      el("div", "lp-demo-card-head", [
        el("span", "", [card.drug, el("small", "", [card.route])]),
        el("span", "badge", [card.badge[1]], { tone: card.badge[0] }),
      ]),
      el("strong", "", [card.dose]),
      el("div", "lp-demo-card-head", [
        el("p", "", [card.note]),
        el("span", "decision", [card.decision[1]], { tone: card.decision[0] }),
      ])
    );
    els.cards.append(element);
  });
}

function el(tag, className, children, data = {}) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (data.tone) element.dataset.tone = data.tone;
  element.append(...children);
  return element;
}

function tween(element, value, animate) {
  const from = Number.parseFloat(element.textContent);
  if (!animate || !Number.isFinite(from)) {
    element.textContent = value.toFixed(1);
    if (!animate) return;
  }
  const start = performance.now();
  const origin = Number.isFinite(from) ? from : 0;
  const step = (now) => {
    const progress = Math.min(1, (now - start) / 700);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = (origin + (value - origin) * eased).toFixed(1);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start-up runs last so every constant above (e.g. SCENARIOS) is defined.
initNav();
initMarquee();
initReveal();
initPointerEffects();
initDemo();
