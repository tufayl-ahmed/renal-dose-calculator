import { calculateCockcroftGault, calculateEgfrCkdEpi2021, getCkdStage } from "./renal.js";
import { gaugePosition } from "./ui/kidneyCard.js";
import { reloadWhenUpdated } from "./ui/pwa.js";
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
reloadWhenUpdated();

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Nav: a hairline appears once the page scrolls ---------- */
function initNav() {
  const nav = document.getElementById("lp-nav");
  if (!nav) return;
  const update = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  update();
  window.addEventListener("scroll", update, { passive: true });

  // Mark the section that crosses the middle of the screen.
  if (!("IntersectionObserver" in window)) return;
  const links = new Map(
    [...nav.querySelectorAll(".lp-nav-links a[href^='#']")].map((link) => [link.getAttribute("href").slice(1), link])
  );
  let current = null;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) current = entry.target.id;
        else if (current === entry.target.id) current = null;
      }
      links.forEach((link, id) => {
        if (id === current) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-50% 0px -50% 0px" }
  );
  links.forEach((_link, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}

/* ---------- How it works: a scroll-driven scene ---------- */
// While the scene is pinned, scroll progress (0 to 1) plays one check through on
// the phone: the patient line types itself and its fields appear, the kidney
// numbers roll in (computed by the app's own equations), two drugs are typed and
// added, then their result cards assemble. Scrolling back plays it backwards.
// Reduced motion, short screens and no script keep the three static cards.
const SCENE_PATIENT = { age: 72, sex: "male", weight: 78, creatinine: 1.8 };
// Where each moment happens, as a fraction of the scene's scroll.
const BEAT = {
  type: [0.04, 0.17],
  numbers: 0.2,
  drugs: 0.38,
  mero: [0.4, 0.45],
  chip1: 0.47,
  doxy: [0.5, 0.55],
  chip2: 0.57,
  card1: 0.7,
  card2: 0.8,
  link: 0.9,
};

function initStory() {
  const story = document.getElementById("lp-story");
  const scene = document.getElementById("lp-scene");
  const app = document.getElementById("lp-app");
  const screen = document.getElementById("lp-phone-screen");
  if (!story || !scene || !app || !screen || reducedMotion) return;

  const find = (selector) => app.querySelector(selector);
  const steps = [...story.querySelectorAll(".lp-step")];
  const fills = [...scene.querySelectorAll(".lp-scene-progress b")];
  const types = {
    patient: find('[data-type="patient"]'),
    mero: find('[data-type="mero"]'),
    doxy: find('[data-type="doxy"]'),
  };
  const fields = { patient: find('[data-field="patient"]'), drug: find('[data-field="drug"]') };
  const placeholder = find(".lp-app-placeholder");
  const pills = [...app.querySelectorAll("[data-at]")];
  const chips = [...app.querySelectorAll("[data-chip]")];
  const suggest = { mero: find('[data-suggest="mero"]'), doxy: find('[data-suggest="doxy"]') };
  const cards = [...app.querySelectorAll("[data-card]")];
  const empty = find(".lp-app-empty");
  const links = [...app.querySelectorAll(".lp-app-link")];
  const blocks = {
    kidney: find('[data-block="kidney"]'),
    drugs: find('[data-block="drugs"]'),
    results: find('[data-block="results"]'),
  };
  const kidney = {
    crcl: document.getElementById("scene-crcl"),
    egfr: document.getElementById("scene-egfr"),
    stage: document.getElementById("scene-stage"),
    marker: document.getElementById("scene-marker"),
    segments: [...blocks.kidney.querySelectorAll("[data-stage]")],
  };

  // The scene's numbers come from the calculator's own functions.
  const crcl = calculateCockcroftGault(SCENE_PATIENT);
  const egfr = calculateEgfrCkdEpi2021(SCENE_PATIENT);
  const stage = getCkdStage(egfr);
  const position = gaugePosition(egfr);

  const within = (p, [start, end]) => Math.min(1, Math.max(0, (p - start) / (end - start)));
  const smooth = (t) => t * t * (3 - 2 * t);
  let stops = [];
  let shown = null;
  let frame = 0;

  // Where the phone's screen should be scrolled at each point of the scene.
  function measure() {
    const view = screen.clientHeight;
    const max = Math.max(0, app.offsetHeight - view);
    const at = (value) => Math.min(max, Math.max(0, value));
    const kidneyEnd = at(blocks.kidney.offsetTop + blocks.kidney.offsetHeight - view + 16);
    const drugs = Math.max(kidneyEnd, at(blocks.drugs.offsetTop - view * 0.2));
    const results = Math.max(drugs, at(blocks.results.offsetTop - view * 0.04));
    stops = [
      [0, 0],
      [0.2, 0],
      [0.27, kidneyEnd],
      [0.36, drugs],
      [0.62, drugs],
      [0.68, results],
      [0.8, results],
      [0.92, Math.max(results, max)],
      [1, Math.max(results, max)],
    ];
  }

  function panAt(p) {
    for (let i = 0; i < stops.length - 1; i += 1) {
      const [p0, y0] = stops[i];
      const [p1, y1] = stops[i + 1];
      if (p <= p1) return y0 + (y1 - y0) * smooth(within(p, [p0, p1]));
    }
    return stops.at(-1)[1];
  }

  function showNumbers(on) {
    if (on === shown) return;
    shown = on;
    if (on) {
      rollDigits(kidney.crcl, crcl);
      rollDigits(kidney.egfr, egfr, 0);
      kidney.stage.textContent = `CKD ${stage.stage}`;
      kidney.stage.dataset.tone = stage.tone;
      kidney.marker.style.setProperty("--pos", `${position}%`);
      kidney.marker.style.setProperty("--marker-opacity", "1");
    } else {
      blankDigits(kidney.crcl);
      blankDigits(kidney.egfr, 0);
      kidney.stage.textContent = "Waiting";
      kidney.stage.dataset.tone = "neutral";
      kidney.marker.style.setProperty("--pos", "0%");
      kidney.marker.style.setProperty("--marker-opacity", "0");
    }
    kidney.segments.forEach((segment) =>
      segment.classList.toggle("is-active", on && segment.dataset.stage === stage.stage)
    );
  }

  function render(p) {
    const current = p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2;
    steps.forEach((step, i) => step.classList.toggle("is-current", i === current));
    fills.forEach((fill, i) => fill.style.setProperty("--fill", String(Math.min(1, Math.max(0, p * 3 - i)))));

    // Step 1: the patient line types itself; each field appears once its words are in.
    const typed = Math.round(within(p, BEAT.type) * types.patient.textContent.length);
    types.patient.style.setProperty("--n", String(typed));
    types.patient.classList.toggle("is-caret", p < BEAT.numbers);
    fields.patient.classList.toggle("is-focus", p < BEAT.numbers);
    pills.forEach((pill) => pill.classList.toggle("is-on", typed >= Number(pill.dataset.at)));
    showNumbers(p >= BEAT.numbers);

    // Step 2: "mero" and "doxy" are typed, suggested and added as chips.
    const mero = p >= BEAT.chip1 ? 0 : Math.round(within(p, BEAT.mero) * 4);
    const doxy = p >= BEAT.chip2 ? 0 : Math.round(within(p, BEAT.doxy) * 4);
    const typingDrugs = p >= BEAT.drugs && p < BEAT.chip2;
    types.mero.style.setProperty("--n", String(mero));
    types.doxy.style.setProperty("--n", String(doxy));
    types.mero.classList.toggle("is-caret", typingDrugs && p < BEAT.chip1);
    types.doxy.classList.toggle("is-caret", typingDrugs && p >= BEAT.chip1);
    fields.drug.classList.toggle("is-focus", typingDrugs);
    placeholder.classList.toggle("is-off", typingDrugs);
    suggest.mero.classList.toggle("is-on", mero >= 2);
    suggest.doxy.classList.toggle("is-on", doxy >= 2);
    chips[0].classList.toggle("is-on", p >= BEAT.chip1);
    chips[1].classList.toggle("is-on", p >= BEAT.chip2);

    // Each added drug shows "checking renal dosing…" until step 3, where its
    // result card assembles and then its DailyMed link lights.
    empty.classList.toggle("is-off", p >= BEAT.chip1);
    cards.forEach((card, i) => {
      const start = i === 0 ? BEAT.card1 : BEAT.card2;
      card.classList.toggle("is-on", p >= (i === 0 ? BEAT.chip1 : BEAT.chip2));
      card.classList.toggle("is-done", p >= start);
      card
        .querySelectorAll("[data-piece]")
        .forEach((piece) => piece.classList.toggle("is-on", p >= start + Number(piece.dataset.piece) * 0.02));
    });
    links.forEach((link) => link.classList.toggle("is-lit", p >= BEAT.link));

    app.style.setProperty("--pan", panAt(p).toFixed(1));
  }

  const progress = () => {
    const box = story.getBoundingClientRect();
    const pinnedAt = Number.parseFloat(getComputedStyle(scene).top) || 0;
    const travel = box.height - scene.offsetHeight;
    return travel > 0 ? Math.min(1, Math.max(0, (pinnedAt - box.top) / travel)) : 0;
  };
  const tick = () => {
    frame = 0;
    render(progress());
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  // The scene needs room for the phone; short screens keep the static cards.
  const roomy = window.matchMedia("(min-height: 600px)");
  const apply = () => {
    story.classList.toggle("is-story", roomy.matches);
    if (roomy.matches) {
      measure();
      tick();
      window.addEventListener("scroll", onScroll, { passive: true });
    } else {
      window.removeEventListener("scroll", onScroll);
    }
  };
  apply();
  roomy.addEventListener("change", apply);
  const remeasure = () => {
    if (!story.classList.contains("is-story")) return;
    measure();
    onScroll();
  };
  window.addEventListener("resize", remeasure);
  document.fonts?.ready.then(remeasure);
}

// Empty digit slots, ready to roll in.
function blankDigits(element, decimals = 1) {
  rollDigits(element, 0, decimals);
  element.classList.add("is-blank");
  for (const slot of element.children) {
    if (slot.classList.contains("lp-odo-sep")) continue;
    slot.textContent = "";
    slot.style.setProperty("--d", "10");
  }
}

/* ---------- Sections fade up once; proof numbers count up once ---------- */
function initReveal() {
  const targets = [...document.querySelectorAll("[data-reveal]")];
  targets.forEach((element) => {
    const siblings = [...element.parentElement.children].filter((child) => child.hasAttribute("data-reveal"));
    element.style.setProperty("--reveal-delay", `${Math.min(siblings.indexOf(element), 4) * 60}ms`);
  });
  const showAll = () => targets.forEach((element) => element.classList.add("is-visible"));
  window.addEventListener("beforeprint", showAll);

  if (reducedMotion || !("IntersectionObserver" in window)) {
    showAll();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  targets.forEach((element) => observer.observe(element));

  const proof = document.querySelector(".lp-proof");
  if (proof) {
    const proofObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        proofObserver.disconnect();
        proof.querySelectorAll("[data-count]").forEach(countUp);
      },
      { threshold: 0.6 }
    );
    proofObserver.observe(proof);
  }
}

// Only the large numbers count: counting "<1 s" up from "<0 s" would show a
// false value on the way.
function countUp(element) {
  const target = Number(element.dataset.count);
  if (!Number.isFinite(target) || target < 10) return;
  // Hold the final width so nothing beside the number moves while it counts.
  element.style.minWidth = `${element.getBoundingClientRect().width}px`;
  const duration = 900;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = Math.round(target * eased).toLocaleString("en-US");
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
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
        // From the app's cefepime rule (src/data/renalRules/antiinfectives-beta-lactams.js):
        // "Hemodialysis, all infections except febrile neutropenia".
        indication: "All infections except febrile neutropenia",
        note: "Give after hemodialysis on dialysis days",
        decision: ["info", "HD rule"],
      },
    ],
  },
];

// Decision icons as drawn on the app's dose cards (src/ui/doseCards.js).
const ICONS = {
  adjust: '<path d="M12 19V5" /><path d="m6 11 6-6 6 6" />',
  check: '<path d="m5 12 5 5 9-10" />',
  info: '<circle cx="12" cy="12" r="8" /><path d="M12 8v5" /><path d="M12 16h.01" />',
};
const DECISION_ICON = { "Adjust dose": "adjust", "No change": "check", "Label dose": "info", "HD rule": "info" };

const HOLD_MS = 4400;
const FIRST_HOLD_MS = 2400;

function initDemo() {
  const demo = document.getElementById("lp-demo");
  if (!demo) return;
  const els = {
    demo,
    field: document.getElementById("demo-field"),
    typed: document.getElementById("demo-typed"),
    count: document.getElementById("demo-count"),
    crcl: document.getElementById("demo-crcl"),
    egfr: document.getElementById("demo-egfr"),
    stage: document.getElementById("demo-stage"),
    stageLabel: document.getElementById("demo-stage-label"),
    marker: document.getElementById("demo-marker"),
    flag: document.getElementById("demo-flag"),
    segments: [...demo.querySelectorAll(".lp-demo-track [data-stage]")],
    cards: document.getElementById("demo-cards"),
    deck: document.getElementById("demo-deck"),
  };

  reserveSpace(els);
  showScenario(els, 0, { animate: false });
  if (reducedMotion) return;

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
    let hold = FIRST_HOLD_MS; // the first example rests briefly, so the demo comes alive within seconds
    for (let index = 1; ; index = (index + 1) % SCENARIOS.length) {
      await sleep(hold);
      hold = HOLD_MS;
      await whenActive();
      await playScenario(els, index, whenActive);
    }
  })();
}

// Invisible copies of every scenario's entry line and cards sit in the same grid
// cells as the live ones, so the demo never changes height between scenarios.
function reserveSpace(els) {
  for (const scenario of SCENARIOS) {
    els.field.append(el("span", "lp-demo-ghost", [`${scenario.input} `]));
    const ghost = el("div", "lp-demo-ghost-deck");
    if (scenario.status) ghost.append(statusLine(scenario.status));
    scenario.cards.forEach((card) => ghost.append(drugCard(card)));
    els.deck.append(ghost);
  }
}

async function playScenario(els, index, whenActive) {
  const scenario = SCENARIOS[index];
  els.demo.classList.add("is-stale");
  els.demo.classList.remove("is-settled");
  const previous = els.typed.textContent;
  for (let i = previous.length; i >= 0; i -= 3) {
    els.typed.textContent = previous.slice(0, Math.max(0, i));
    await sleep(12);
  }
  els.typed.textContent = "";
  els.count.textContent = `Example ${index + 1} of ${SCENARIOS.length}`;
  await sleep(240);
  for (let i = 1; i <= scenario.input.length; i += 1) {
    els.typed.textContent = scenario.input.slice(0, i);
    await sleep(24 + Math.random() * 32);
  }
  await whenActive();
  await sleep(260);
  showScenario(els, index, { animate: true });
}

function showScenario(els, index, { animate }) {
  const scenario = SCENARIOS[index];
  const crcl = calculateCockcroftGault(scenario.patient);
  const egfr = calculateEgfrCkdEpi2021(scenario.patient);
  const stage = getCkdStage(egfr);

  els.typed.textContent = scenario.input;
  els.count.textContent = `Example ${index + 1} of ${SCENARIOS.length}`;
  rollDigits(els.crcl, crcl);
  rollDigits(els.egfr, egfr, 0);
  els.stage.textContent = stage.stage;
  els.stage.dataset.tone = stage.tone;
  els.stageLabel.textContent = stage.label;
  els.segments.forEach((segment) => segment.classList.toggle("is-active", segment.dataset.stage === stage.stage));
  // The first, static frame places the marker directly; later ones ease to it.
  const position = gaugePosition(egfr);
  if (!animate) els.marker.style.transition = "none";
  els.marker.style.setProperty("--pos", `${position}%`);
  els.marker.style.setProperty("--marker-opacity", "1");
  // Keep the value flag inside the gauge at either end.
  const edge = position < 8 ? "start" : position > 92 ? "end" : "middle";
  els.marker.style.setProperty("--flag-x", { start: "-12px", end: "calc(-100% + 12px)", middle: "-50%" }[edge]);
  els.marker.style.setProperty("--flag-tip", { start: "12px", end: "calc(100% - 12px)", middle: "50%" }[edge]);
  tween(els.flag, egfr, animate, 0);
  if (!animate) {
    void els.marker.offsetWidth;
    els.marker.style.removeProperty("transition");
  } else {
    els.deck.classList.remove("is-computed");
    void els.deck.offsetWidth;
    els.deck.classList.add("is-computed");
  }

  // The status line and cards are rebuilt together, so no surviving box moves.
  const cards = scenario.cards.map((card, cardIndex) => {
    const element = drugCard(card);
    element.classList.add("lp-demo-card");
    element.style.setProperty("--i", String(animate ? cardIndex : 0));
    if (!animate) element.style.animation = "none";
    return element;
  });
  els.cards.replaceChildren(...(scenario.status ? [statusLine(scenario.status)] : []), ...cards);
  els.demo.classList.remove("is-stale");
  els.demo.classList.add("is-settled");
}

function statusLine(text) {
  return el("p", "lp-demo-status", [icon(ICONS.info), el("span", "", [text])]);
}

function drugCard(card) {
  const decisionIcon = icon(ICONS[DECISION_ICON[card.decision[1]] || "info"], "decision-icon");
  const element = el("div", "lp-dc", [
    el("div", "lp-dc-head", [
      el("div", "", [
        el("p", "lp-dc-drug", [card.drug]),
        el("p", "lp-dc-meta", [card.route, el("span", "badge", [card.badge[1]], { tone: card.badge[0] })]),
      ]),
      el("span", "decision", [decisionIcon, card.decision[1]], { tone: card.decision[0] }),
    ]),
    el("p", "lp-dc-dose", [card.dose]),
  ]);
  if (card.indication) {
    element.append(el("p", "lp-dc-note", [el("b", "", ["Indication: "]), card.indication]));
  }
  element.append(el("p", "lp-dc-note", [card.note]));
  element.dataset.tone = card.decision[0];
  return element;
}

function el(tag, className, children = [], data = {}) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (data.tone) element.dataset.tone = data.tone;
  element.append(...children);
  return element;
}

function icon(paths, className = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  if (className) svg.setAttribute("class", className);
  svg.innerHTML = paths;
  return svg;
}

// Shows a number (one decimal, or whole with decimals 0) as rolling digit slots.
// Each slot keeps its digit as text (so the element reads as the plain number)
// and --d for the CSS roll.
function rollDigits(element, value, decimals = 1) {
  const [whole, decimal] = value.toFixed(decimals).split(".");
  const width = Math.max(2, whole.length);
  const layout = `${width}.${decimals}`;
  if (element.dataset.slots !== layout) {
    const slots = [];
    for (let i = 0; i < width; i += 1) slots.push(el("span", "lp-odo-d"));
    if (decimals) slots.push(el("span", "lp-odo-sep", ["."]), el("span", "lp-odo-d"));
    slots.forEach((slot, i) => slot.style.setProperty("--delay", `${i * 40}ms`));
    element.replaceChildren(...slots);
    element.dataset.slots = layout;
  }
  element.classList.remove("is-blank");
  const chars = decimals ? [...whole.padStart(width, " "), ".", decimal] : [...whole.padStart(width, " ")];
  [...element.children].forEach((slot, i) => {
    if (slot.classList.contains("lp-odo-sep")) return;
    const char = chars[i];
    slot.textContent = char === " " ? "" : char;
    slot.style.setProperty("--d", char === " " ? "10" : char);
  });
}

function tween(element, value, animate, decimals = 1) {
  const from = Number.parseFloat(element.textContent);
  if (!animate || !Number.isFinite(from)) {
    element.textContent = value.toFixed(decimals);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - start) / 400);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = (from + (value - from) * eased).toFixed(decimals);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------- Under the hood: both equations, drawn live ---------- */
// Every number and curve point comes from the calculator's own functions.
const SVG_NS = "http://www.w3.org/2000/svg";
const LAB = { minScr: 0.4, maxScr: 8, maxY: 150, samples: 120 };
const KDIGO_BANDS = [
  ["G1", 90, 150],
  ["G2", 60, 90],
  ["G3a", 45, 60],
  ["G3b", 30, 45],
  ["G4", 15, 30],
  ["G5", 0, 15],
];

function initLab() {
  const form = document.getElementById("lab-form");
  const svg = document.getElementById("lab-chart");
  if (!form || !svg) return;
  const inputs = { age: form.elements.age, weight: form.elements.weight, creatinine: form.elements.creatinine };
  const outputs = {
    age: document.getElementById("lab-age-out"),
    weight: document.getElementById("lab-weight-out"),
    creatinine: document.getElementById("lab-scr-out"),
  };
  const read = {
    crcl: document.getElementById("lab-crcl"),
    egfr: document.getElementById("lab-egfr"),
    stage: document.getElementById("lab-stage"),
    stageLabel: document.getElementById("lab-stage-label"),
    live: document.getElementById("lab-live"),
  };
  const pad = { left: 40, right: 40, top: 26, bottom: 48 };
  let size = { width: 0, height: 0 };
  let parts = null;
  let announce = 0;

  const plotWidth = () => size.width - pad.left - pad.right;
  const toX = (scr) => pad.left + (Math.log(scr / LAB.minScr) / Math.log(LAB.maxScr / LAB.minScr)) * plotWidth();
  const toScr = (x) => LAB.minScr * (LAB.maxScr / LAB.minScr) ** ((x - pad.left) / plotWidth());
  const toY = (value) => size.height - pad.bottom - (value / LAB.maxY) * (size.height - pad.top - pad.bottom);
  const inPlot = (y) => Math.min(Math.max(y, pad.top), size.height - pad.bottom);

  const patient = () => ({
    age: Number(inputs.age.value),
    sex: form.elements.sex.value,
    weight: Number(inputs.weight.value),
    creatinine: Number(inputs.creatinine.value),
  });

  function node(tag, attrs = {}, text) {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  }

  // Bands, grid and axes: redrawn only when the chart's size changes.
  function drawFrame() {
    const right = size.width - pad.right;
    const bottom = size.height - pad.bottom;
    svg.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
    const frame = node("g");
    for (const [name, low, high] of KDIGO_BANDS) {
      const top = toY(high);
      frame.append(
        // Colour comes from a class: the site's CSP (style-src 'self') blocks style attributes.
        node("rect", {
          class: `lab-band lab-band-${name.toLowerCase()}`,
          x: pad.left,
          y: top,
          width: right - pad.left,
          height: toY(low) - top,
        }),
        node("text", { class: "lab-band-label", x: right + 8, y: (top + toY(low)) / 2 + 4 }, name)
      );
    }
    for (const value of [0, 30, 60, 90, 120, 150]) {
      const y = toY(value);
      frame.append(
        node("line", { class: "lab-grid", x1: pad.left, x2: right, y1: y, y2: y }),
        node("text", { class: "lab-tick", x: pad.left - 8, y: y + 4, "text-anchor": "end" }, String(value))
      );
    }
    for (const scr of [0.5, 1, 2, 4, 8]) {
      const x = toX(scr);
      frame.append(
        node("line", { class: "lab-grid", x1: x, x2: x, y1: bottom, y2: bottom + 5 }),
        node("text", { class: "lab-tick", x, y: bottom + 19, "text-anchor": "middle" }, String(scr))
      );
    }
    frame.append(
      node("text", { class: "lab-axis-title", x: pad.left, y: 14 }, "mL/min"),
      node(
        "text",
        { class: "lab-axis-title", x: (pad.left + right) / 2, y: size.height - 6, "text-anchor": "middle" },
        "Serum creatinine, mg/dL (log scale)"
      )
    );

    const clip = node("clipPath", { id: "lab-plot" });
    clip.append(node("rect", { x: pad.left, y: pad.top, width: right - pad.left, height: bottom - pad.top }));
    const curves = node("g", { "clip-path": "url(#lab-plot)" });
    parts = {
      crcl: node("path", { class: "lab-curve lab-curve-crcl" }),
      egfr: node("path", { class: "lab-curve lab-curve-egfr" }),
      guide: node("line", { class: "lab-guide", y1: pad.top, y2: bottom }),
      dotCrcl: node("circle", { class: "lab-dot lab-dot-crcl", r: 5.5 }),
      dotEgfr: node("circle", { class: "lab-dot lab-dot-egfr", r: 5.5 }),
      labelCrcl: node("text", { class: "lab-label lab-label-crcl" }),
      labelEgfr: node("text", { class: "lab-label lab-label-egfr" }),
      labelScr: node("text", { class: "lab-label lab-label-scr", y: bottom - 8 }),
    };
    curves.append(parts.crcl, parts.egfr);
    const defs = node("defs");
    defs.append(clip);
    svg.replaceChildren(
      defs,
      frame,
      parts.guide,
      curves,
      parts.dotCrcl,
      parts.dotEgfr,
      parts.labelCrcl,
      parts.labelEgfr,
      parts.labelScr
    );
  }

  function update() {
    const values = patient();
    const crcl = calculateCockcroftGault(values);
    const egfr = calculateEgfrCkdEpi2021(values);
    const stage = getCkdStage(egfr);

    outputs.age.textContent = `${values.age} years`;
    outputs.weight.textContent = `${values.weight} kg`;
    outputs.creatinine.textContent = `${values.creatinine.toFixed(1)} mg/dL`;
    for (const input of Object.values(inputs)) {
      const share = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
      input.style.setProperty("--fill", `${share * 100}%`);
    }
    read.crcl.textContent = crcl.toFixed(1);
    read.egfr.textContent = egfr.toFixed(0);
    read.stage.textContent = stage.stage;
    read.stage.dataset.tone = stage.tone;
    read.stageLabel.textContent = stage.label;
    window.clearTimeout(announce);
    announce = window.setTimeout(() => {
      read.live.textContent = `CrCl ${crcl.toFixed(1)} mL/min. eGFR ${egfr.toFixed(0)}, KDIGO ${stage.stage}.`;
    }, 500);

    if (!parts) return;
    // Both curves across the creatinine range, for this patient's age, sex and weight.
    const crclPoints = [];
    const egfrPoints = [];
    for (let i = 0; i <= LAB.samples; i += 1) {
      const scr = LAB.minScr * (LAB.maxScr / LAB.minScr) ** (i / LAB.samples);
      const x = toX(scr).toFixed(1);
      const at = { ...values, creatinine: scr };
      crclPoints.push(`${x},${toY(calculateCockcroftGault(at)).toFixed(1)}`);
      egfrPoints.push(`${x},${toY(calculateEgfrCkdEpi2021(at)).toFixed(1)}`);
    }
    parts.crcl.setAttribute("d", `M${crclPoints.join("L")}`);
    parts.egfr.setAttribute("d", `M${egfrPoints.join("L")}`);

    const x = toX(values.creatinine);
    const yCrcl = inPlot(toY(crcl));
    const yEgfr = inPlot(toY(egfr));
    parts.guide.setAttribute("x1", x);
    parts.guide.setAttribute("x2", x);
    parts.dotCrcl.setAttribute("cx", x);
    parts.dotCrcl.setAttribute("cy", yCrcl);
    parts.dotEgfr.setAttribute("cx", x);
    parts.dotEgfr.setAttribute("cy", yEgfr);

    // Labels sit on the roomier side of the marker and never overlap each other.
    const onRight = x < pad.left + plotWidth() * 0.62;
    const labelX = onRight ? x + 12 : x - 12;
    let labelCrclY = yCrcl + 4;
    let labelEgfrY = yEgfr + 4;
    const gap = 18 - Math.abs(labelCrclY - labelEgfrY);
    if (gap > 0) {
      const crclAbove = labelCrclY < labelEgfrY || (labelCrclY === labelEgfrY && crcl >= egfr);
      labelCrclY += crclAbove ? -gap / 2 : gap / 2;
      labelEgfrY += crclAbove ? gap / 2 : -gap / 2;
    }
    for (const [label, text, y] of [
      [parts.labelCrcl, `CrCl ${crcl.toFixed(1)}`, labelCrclY],
      [parts.labelEgfr, `eGFR ${egfr.toFixed(0)}`, labelEgfrY],
    ]) {
      label.textContent = text;
      label.setAttribute("x", labelX);
      label.setAttribute("y", Math.min(Math.max(y, pad.top + 12), size.height - pad.bottom - 22));
      label.setAttribute("text-anchor", onRight ? "start" : "end");
    }
    parts.labelScr.textContent = `SCr ${values.creatinine.toFixed(1)}`;
    parts.labelScr.setAttribute("x", onRight ? x + 8 : x - 8);
    parts.labelScr.setAttribute("text-anchor", onRight ? "start" : "end");
  }

  function resize() {
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return;
    size = { width: Math.round(box.width), height: Math.round(box.height) };
    drawFrame();
    update();
  }

  // Drag across the chart to scrub creatinine.
  const scrub = (event) => {
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * size.width;
    const scr = Math.round(Math.min(LAB.maxScr, Math.max(LAB.minScr, toScr(x))) * 10) / 10;
    if (Number(inputs.creatinine.value) !== scr) {
      inputs.creatinine.value = String(scr);
      update();
    }
  };
  svg.addEventListener("pointerdown", (event) => {
    svg.setPointerCapture(event.pointerId);
    scrub(event);
  });
  svg.addEventListener("pointermove", (event) => {
    if (svg.hasPointerCapture(event.pointerId)) scrub(event);
  });
  form.addEventListener("input", update);
  form.addEventListener("submit", (event) => event.preventDefault());

  update();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(svg);
  else resize();
}

// Start-up runs last so every constant above (e.g. SCENARIOS) is defined.
initNav();
initReveal();
initStory();
initLab();
initDemo();
