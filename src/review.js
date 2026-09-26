import { toCsv } from "./csv.js";
import { joinDoseText } from "./doseText.js";
import {
  curatedRecordId,
  getRecordVerification,
  listCandidateRecords,
  listCuratedRecords,
} from "./curatedDoseRules.js";
import { formatRuleBand, formatVariants, contextLabel, recordToReviewRow, REVIEW_HEADER } from "./ruleReview.js";
import { $, html, setHtml, storage, toast } from "./ui/dom.js";
import { initTheme } from "./ui/theme.js";

const DECISIONS_KEY = "renal-review-decisions";
const REVIEWER_KEY = "renal-review-reviewer";
const PAGE_SIZE = 40;

initTheme();

const records = [
  ...listCuratedRecords().map((record) => ({ record, kind: "curated" })),
  ...listCandidateRecords().map((record) => ({ record, kind: "candidate" })),
].map((entry) => ({
  ...entry,
  id: curatedRecordId(entry.record),
  verification: getRecordVerification(entry.record),
}));

let decisions = storage.get(DECISIONS_KEY, {});
const reviewerInput = $("#reviewer");
reviewerInput.value = storage.get(REVIEWER_KEY, "");
reviewerInput.addEventListener("input", () => storage.set(REVIEWER_KEY, reviewerInput.value.trim()));
$("#review-search").addEventListener("input", render);
$("#review-filter").addEventListener("change", render);
$("#export-decisions").addEventListener("click", exportDecisions);
$("#clear-decisions").addEventListener("click", () => {
  if (window.confirm("Clear every decision saved in this browser? Exported CSV files are not affected.")) {
    decisions = {};
    storage.set(DECISIONS_KEY, decisions);
    render();
  }
});

$("#review-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-decide]");
  const card = event.target.closest("[data-record-id]");
  if (!button || !card) {
    return;
  }
  const id = card.dataset.recordId;
  const decision = button.dataset.decide;
  if (decision === "clear") {
    delete decisions[id];
  } else {
    const reviewer = reviewerInput.value.trim();
    if (!reviewer) {
      toast("Enter your reviewer name first");
      reviewerInput.focus();
      return;
    }
    decisions[id] = {
      decision,
      reviewer,
      date: new Date().toLocaleDateString("en-CA"),
      notes: card.querySelector("textarea").value.trim(),
    };
  }
  storage.set(DECISIONS_KEY, decisions);
  render();
});

$("#review-list").addEventListener("change", (event) => {
  const textarea = event.target.closest("textarea");
  const card = event.target.closest("[data-record-id]");
  if (textarea && card && decisions[card.dataset.recordId]) {
    decisions[card.dataset.recordId].notes = textarea.value.trim();
    storage.set(DECISIONS_KEY, decisions);
  }
});

render();

function render() {
  const query = $("#review-search").value.trim().toLowerCase();
  const filter = $("#review-filter").value;
  const visible = records.filter((entry) => matchesFilter(entry, filter) && matchesQuery(entry, query));
  const decidedCount = Object.keys(decisions).length;
  const verifiedCount = records.filter((entry) => entry.verification.status === "verified").length;
  $("#review-counts").textContent =
    `${records.length} records · ${verifiedCount} verified · ${decidedCount} decided here, not yet exported · showing ${visible.length}`;
  $("#export-decisions").disabled = decidedCount === 0;

  setHtml($("#review-list"), html`${visible.slice(0, PAGE_SIZE).map(renderRecord)}`);
  const more = $("#review-more");
  more.classList.toggle("hidden", visible.length <= PAGE_SIZE);
  more.textContent = `Showing the first ${PAGE_SIZE} of ${visible.length}. Search to narrow the list.`;
}

function matchesFilter(entry, filter) {
  const decided = Boolean(decisions[entry.id]);
  if (filter === "todo") return !decided && entry.verification.status !== "verified";
  if (filter === "decided") return decided;
  if (filter === "verified") return entry.verification.status === "verified";
  if (filter === "candidate") return entry.kind === "candidate";
  return true;
}

function matchesQuery(entry, query) {
  if (!query) {
    return true;
  }
  const { record } = entry;
  return [record.drugName, record.searchTerm, ...(record.aliases || [])].some((name) =>
    String(name).toLowerCase().includes(query)
  );
}

function renderRecord(entry) {
  const { record, verification, kind, id } = entry;
  const decision = decisions[id];
  return html`
    <article class="review-card card" data-record-id="${id}" data-decision="${decision?.decision || ""}">
      <header class="review-card-head">
        <div>
          <h2>${record.drugName}</h2>
          <p class="dose-meta">
            ${record.routes.join(", ")}
            <span class="badge" data-tone="${kind === "candidate" ? "info" : "neutral"}">
              ${kind === "candidate" ? "Auto-extracted" : "Hand-curated"}
            </span>
            <span class="badge" data-tone="${verification.status === "verified" ? "good" : "neutral"}">
              ${verification.status}${verification.verifiedBy ? ` · ${verification.verifiedBy}` : ""}
            </span>
            <code>${id}</code>
          </p>
        </div>
        ${
          decision
            ? html`<span class="decision" data-tone="${decision.decision === "verified" ? "good" : "danger"}">
                ${decision.decision} by ${decision.reviewer}
              </span>`
            : ""
        }
      </header>

      <table class="band-table">
        <thead>
          <tr>
            <th scope="col">Band</th>
            <th scope="col">Dose</th>
          </tr>
        </thead>
        <tbody>
          ${record.rules.map(
            (rule) =>
              html`<tr>
                <td>${formatRuleBand(rule)}</td>
                <td>${formatVariants(rule.variants)}</td>
              </tr>`
          )}
        </tbody>
      </table>

      ${
        record.structured
          ? html`<details class="dose-more">
              <summary>
                Structured rules (dialysis / indication / product)
                <span class="count">${record.structured.rules.length}</span>
              </summary>
              <table class="band-table">
                <tbody>
                  ${record.structured.rules.map(
                    (rule) =>
                      html`<tr>
                        <td>${formatRuleBand(rule)}</td>
                        <td>${contextLabel(rule)}</td>
                        <td>${joinDoseText(rule.dose, rule.interval)}</td>
                      </tr>`
                  )}
                </tbody>
              </table>
            </details>`
          : ""
      }

      <p class="review-note">${record.indicationNote}</p>
      ${
        record.extraction
          ? html`<p class="tier-note">
              Extracted by ${record.extraction.method} from
              “${record.extraction.labelTitle}”${
                record.extraction.labelEffectiveTime ? ` (label ${record.extraction.labelEffectiveTime})` : ""
              }.
            </p>`
          : ""
      }

      <label class="field review-notes">
        <span class="field-label">Notes</span>
        <textarea rows="2" placeholder="What needs fixing, if anything">${decision?.notes || ""}</textarea>
      </label>

      <div class="dose-actions">
        <a class="button button-tonal button-small" href="${record.sourceUrl}" target="_blank" rel="noreferrer"
          >Open DailyMed label</a
        >
        <button class="button button-primary button-small" type="button" data-decide="verified">Verify</button>
        <button class="button button-text button-small" type="button" data-decide="retired">Retire</button>
        ${decision ? html`<button class="button button-text button-small" type="button" data-decide="clear">Undo</button>` : ""}
      </div>
    </article>
  `;
}

function exportDecisions() {
  const rows = records
    .filter((entry) => decisions[entry.id])
    .map((entry) => recordToReviewRow(entry.record, entry, decisions[entry.id]));
  const blob = new Blob([`\uFEFF${toCsv([REVIEW_HEADER, ...rows])}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `rule-review-${new Date().toLocaleDateString("en-CA")}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  toast(`Exported ${rows.length} decision(s)`);
}
