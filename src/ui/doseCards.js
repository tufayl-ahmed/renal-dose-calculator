import { buildDoseView } from "../doseView.js";
import { normalizeDrugQuery } from "../drugNormalizer.js";
import { buildDailyMedSearchUrl, requestLlmDoseAssist } from "../llmDoseAssist.js";
import { $, html, raw, setHtml } from "./dom.js";

const MAX_PARALLEL = 3;

/**
 * Renders one card per drug and runs the lookups (at most MAX_PARALLEL at a
 * time). Each entry keeps its own dosing context (dialysis/indication/product).
 */
export function createDoseCards({ onResult }) {
  const listElement = $("#dose-list");
  const summaryElement = $("#dose-summary");
  const emptyElement = $("#dose-empty");
  /** @type {Map<number, any>} */
  const entries = new Map();
  let patient = null;
  let generation = 0;
  let running = 0;
  const queue = [];

  listElement.addEventListener("change", (event) => {
    const select = event.target.closest("select[data-control]");
    const card = event.target.closest("[data-drug-id]");
    if (!select || !card) {
      return;
    }
    const entry = entries.get(Number(card.dataset.drugId));
    if (entry) {
      entry.context = { ...entry.context, [select.dataset.control]: select.value };
      schedule(entry);
    }
  });
  listElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action=retry]");
    const card = event.target.closest("[data-drug-id]");
    if (button && card) {
      const entry = entries.get(Number(card.dataset.drugId));
      if (entry) {
        schedule(entry);
      }
    }
  });

  function sync(drugs, nextPatient) {
    const patientChanged = nextPatient && JSON.stringify(nextPatient) !== JSON.stringify(patient);
    if (nextPatient) {
      patient = nextPatient;
    }
    if (patientChanged) {
      generation += 1;
    }
    const ids = new Set(drugs.map((drug) => drug.id));
    for (const id of entries.keys()) {
      if (!ids.has(id)) {
        entries.get(id).element?.remove();
        entries.delete(id);
      }
    }
    for (const drug of drugs) {
      const existing = entries.get(drug.id);
      if (!existing) {
        const entry = { drug, context: {}, state: "idle", view: null, element: null, generation: -1 };
        entries.set(drug.id, entry);
        if (patient) {
          schedule(entry);
        } else {
          renderEntry(entry);
        }
      } else if (existing.drug.route !== drug.route) {
        existing.drug = drug;
        existing.context = {};
        if (patient) {
          schedule(existing);
        } else {
          renderEntry(existing);
        }
      } else if (patient && (patientChanged || existing.state === "idle")) {
        schedule(existing);
      }
    }
    renderFrame();
  }

  function schedule(entry) {
    entry.state = "loading";
    entry.generation = generation;
    entry.token = Symbol("lookup");
    renderEntry(entry);
    queue.push(entry);
    pump();
  }

  function pump() {
    while (running < MAX_PARALLEL && queue.length) {
      const entry = queue.shift();
      if (!entries.has(entry.drug.id) || entry.state !== "loading") {
        continue;
      }
      running += 1;
      lookup(entry).finally(() => {
        running -= 1;
        pump();
      });
    }
  }

  async function lookup(entry) {
    const token = entry.token;
    const values = { ...patient, drug: entry.drug.name, route: entry.drug.route };
    try {
      const normalizedDrug = await normalizeDrugQuery(entry.drug.name);
      const assist = await requestLlmDoseAssist({
        ...values,
        normalizedDrug,
        dialysis: entry.context.dialysis || "none",
        indication: entry.context.indication || "any",
        formulation: entry.context.formulation || "any",
      });
      if (entry.token !== token) {
        return;
      }
      entry.view = buildDoseView(assist, values);
      entry.state = "done";
    } catch (error) {
      if (entry.token !== token) {
        return;
      }
      entry.state = "error";
      entry.error = navigator.onLine === false ? "You are offline. Dose lookup needs a connection." : error.message;
    }
    renderEntry(entry);
    renderFrame();
    onResult?.(entry);
  }

  function renderEntry(entry) {
    if (!entry.element) {
      entry.element = document.createElement("article");
      entry.element.className = "dose-card";
      entry.element.dataset.drugId = String(entry.drug.id);
      listElement.append(entry.element);
    }
    const markup =
      entry.state === "idle"
        ? renderIdle(entry)
        : entry.state === "done"
          ? renderResult(entry)
          : entry.state === "error"
            ? renderError(entry)
            : renderLoading(entry);
    entry.element.dataset.state = entry.state;
    entry.element.dataset.tone = entry.view && entry.state === "done" ? entry.view.decision.tone : "neutral";
    setHtml(entry.element, markup);
  }

  function renderFrame() {
    const all = [...entries.values()];
    emptyElement.classList.toggle("hidden", all.length > 0);
    // Keep cards in chip order.
    all.forEach((entry) => entry.element && listElement.append(entry.element));
    const done = all.filter((entry) => entry.state === "done");
    summaryElement.classList.toggle("hidden", all.length < 2);
    setHtml(
      summaryElement,
      html`<ul>
        ${all.map(
          (entry) => html`
            <li>
              <a href="#dose-card-${entry.drug.id}">${entry.view?.drugName || entry.drug.name}</a>
              ${
                entry.state === "done"
                  ? html`<span class="decision" data-tone="${entry.view.decision.tone}"
                        >${entry.view.decision.label}</span
                      >
                      <span class="summary-dose"
                        >${[entry.view.dose, entry.view.frequency].filter(Boolean).join(" · ")}</span
                      >`
                  : entry.state === "error"
                    ? html`<span class="decision" data-tone="neutral">Unavailable</span>`
                    : html`<span class="decision" data-tone="neutral">Checking…</span>`
              }
            </li>
          `
        )}
      </ul>`
    );
    $("#copy-all").disabled = done.length === 0;
    $("#print").disabled = done.length === 0;
  }

  return {
    sync,
    /** Drops the patient so cards wait for a valid calculation again. */
    reset() {
      patient = null;
      generation += 1;
      entries.forEach((entry) => entry.element?.remove());
      entries.clear();
      queue.length = 0;
      renderFrame();
    },
    views() {
      return [...entries.values()].filter((entry) => entry.state === "done").map((entry) => entry.view);
    },
    hasPatient: () => Boolean(patient),
  };
}

function renderIdle(entry) {
  return html`
    <div class="dose-card-inner" id="dose-card-${entry.drug.id}">
      <header class="dose-head">
        <div>
          <h3>${entry.drug.name}</h3>
          <p class="dose-meta">${routeLabel(entry.drug.route)} · waiting for patient details</p>
        </div>
      </header>
    </div>
  `;
}

function renderLoading(entry) {
  return html`
    <div class="dose-card-inner" id="dose-card-${entry.drug.id}">
      <header class="dose-head">
        <div>
          <h3>${entry.drug.name}</h3>
          <p class="dose-meta">${routeLabel(entry.drug.route)} · checking renal dosing…</p>
        </div>
        <span class="spinner" aria-label="Loading"></span>
      </header>
      <div class="skeleton-lines" aria-hidden="true"><span></span><span></span><span></span></div>
    </div>
  `;
}

function renderError(entry) {
  return html`
    <div class="dose-card-inner" id="dose-card-${entry.drug.id}">
      <header class="dose-head">
        <div>
          <h3>${entry.drug.name}</h3>
          <p class="dose-meta">${routeLabel(entry.drug.route)}</p>
        </div>
        <span class="decision" data-tone="neutral">Unavailable</span>
      </header>
      <p class="dose-error">Couldn't get renal dosing: ${entry.error}</p>
      <div class="dose-actions">
        <button class="button button-tonal button-small" type="button" data-action="retry">Try again</button>
        <a
          class="button button-text button-small"
          href="${buildDailyMedSearchUrl(entry.drug.name)}"
          target="_blank"
          rel="noreferrer"
        >
          Search DailyMed
        </a>
      </div>
    </div>
  `;
}

function renderResult(entry) {
  const view = entry.view;
  const table = view.rows.length
    ? html`
        <details class="dose-more">
          <summary>Renal dose table <span class="count">${view.rows.length}</span></summary>
          <table class="band-table">
            <thead>
              <tr>
                <th scope="col">${view.metric}</th>
                <th scope="col">Label guidance</th>
              </tr>
            </thead>
            <tbody>
              ${view.rows.map(
                (row) => html`
                  <tr class="${row.selected ? "is-selected" : ""}" aria-current="${row.selected ? "true" : "false"}">
                    <td>${cleanRowBand(row.band)}</td>
                    <td>${row.recommendation}</td>
                  </tr>
                `
              )}
            </tbody>
          </table>
        </details>
      `
    : "";

  return html`
    <div class="dose-card-inner" id="dose-card-${entry.drug.id}">
      <header class="dose-head">
        <div>
          <h3>${view.drugName}</h3>
          <p class="dose-meta">
            ${view.routeLabel || routeLabel(entry.drug.route)}
            <span class="badge" data-tone="${view.tier.tone}" title="${view.tier.description}">${view.tier.label}</span>
          </p>
        </div>
        <span class="decision" data-tone="${view.decision.tone}">${view.decision.label}</span>
      </header>

      <div class="dose-main">
        ${
          view.band
            ? html`<div class="dose-band">
                <span>${view.metric} band</span>
                <strong>${view.band}</strong>
              </div>`
            : ""
        }
        <div class="dose-value">
          <strong>${view.dose || "See source"}</strong>
          ${view.frequency ? html`<span>${view.frequency}</span>` : ""}
        </div>
      </div>

      ${renderContextControls(view, entry.context)}
      ${
        view.cautions.length
          ? html`<ul class="cautions">
              ${view.cautions.map((caution) => html`<li>${caution}</li>`)}
            </ul>`
          : ""
      }
      <p class="tier-note">${view.tier.description}</p>
      ${table} ${renderSource(view)}

      <div class="dose-actions">
        ${
          view.sourceUrl
            ? html`<a
                class="button button-tonal button-small"
                href="${view.sourceUrl}"
                target="_blank"
                rel="noreferrer"
              >
                Open DailyMed label
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M7 17 17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              </a>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderContextControls(view, context) {
  const options = view.options;
  if (!options) {
    return "";
  }
  const controls = [
    ["dialysis", "Dialysis", options.dialysis],
    ["indication", "Indication", options.indications],
    ["formulation", "Product", options.formulations],
  ].filter(([, , list]) => Array.isArray(list) && list.length > 1);
  if (!controls.length) {
    return "";
  }
  const selected = view.selectedControls || {};
  return html`
    <div class="context-controls">
      ${controls.map(
        ([key, label, list]) => html`
          <label class="context-field">
            <span
              >${label}${!context[key] && view.defaultedControls.includes(key) ? raw(' <em class="needs-choice">choose</em>') : ""}</span
            >
            <select data-control="${key}">
              ${list.map(
                (option) =>
                  html`<option
                    value="${option.value}"
                    ${raw(option.value === (context[key] || selected[key]) ? "selected" : "")}
                  >
                    ${option.label}
                  </option>`
              )}
            </select>
          </label>
        `
      )}
    </div>
  `;
}

function renderSource(view) {
  const label = view.source.label;
  const sections = view.source.sections;
  if (!label && !sections.length && !view.source.heading) {
    return "";
  }
  return html`
    <details class="dose-more">
      <summary>Source evidence</summary>
      <dl class="source-meta">
        ${
          view.source.heading
            ? html`<div>
                <dt>Section</dt>
                <dd>${view.source.heading}</dd>
              </div>`
            : ""
        }
        ${
          label?.title
            ? html`<div>
                <dt>Product</dt>
                <dd>${[label.title, label.genericName].filter(Boolean).join(" · ")}</dd>
              </div>`
            : ""
        }
        ${
          label?.effectiveTime
            ? html`<div>
                <dt>Label updated</dt>
                <dd>${formatLabelDate(label.effectiveTime)}</dd>
              </div>`
            : ""
        }
        ${
          view.verification?.verifiedBy
            ? html`<div>
                <dt>Verified by</dt>
                <dd>${view.verification.verifiedBy} (${view.verification.verifiedOn})</dd>
              </div>`
            : ""
        }
      </dl>
      ${sections.map(
        (section) => html`
          <div class="source-section">
            <h4>${section.heading}</h4>
            <p>${section.text}</p>
          </div>
        `
      )}
    </details>
  `;
}

function cleanRowBand(band) {
  return String(band || "")
    .replace(/^(?:CrCl|eGFR)\s*/i, "")
    .replace(/\s*mL\/min(?:\/1\.73\s*m2)?$/i, "");
}

function formatLabelDate(value) {
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : value;
}

function routeLabel(route) {
  return { IV: "IV", SC: "Subcutaneous" }[route] || "Oral";
}
