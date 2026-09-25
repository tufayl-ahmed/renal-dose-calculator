import { $, html, setHtml } from "./dom.js";

const MAX_DRUGS = 8;
const COVERAGE_BADGES = {
  verified: { label: "Verified", tone: "good" },
  curated: { label: "Curated", tone: "info" },
  extracted: { label: "Auto-extracted", tone: "info" },
};
let nextId = 1;
// The 2,000-drug list is only downloaded when the drug box is first used.
let autocompleteModule = null;
function loadAutocomplete() {
  autocompleteModule ||= import("../drugAutocomplete.js");
  return autocompleteModule;
}

/**
 * Chip-style multi-drug input with a keyboard-accessible autocomplete.
 * Owns the list of { id, name, route } entries; `route` is "" to follow the
 * form's default route.
 */
export function createDrugInput({ onChange, getDefaultRoute }) {
  const input = $("#drug-input");
  const list = $("#drug-suggestions");
  const chips = $("#drug-chips");
  let drugs = [];
  let suggestions = [];
  let active = -1;

  input.addEventListener("input", () => {
    if (/[,;]$/.test(input.value)) {
      commitTyped();
      return;
    }
    refresh();
  });
  input.addEventListener("focus", refresh);
  input.addEventListener("pointerenter", loadAutocomplete, { once: true });
  input.addEventListener("keydown", handleKeydown);
  input.addEventListener("blur", () => window.setTimeout(close, 120));
  list.addEventListener("mousedown", (event) => event.preventDefault());
  list.addEventListener("click", (event) => {
    const option = event.target.closest("[data-index]");
    if (option) {
      choose(Number(option.dataset.index));
    }
  });
  chips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-id]");
    if (!chip) {
      return;
    }
    const id = Number(chip.dataset.id);
    if (event.target.closest("[data-action=remove]")) {
      remove(id);
    } else if (event.target.closest("[data-action=route]")) {
      toggleRoute(id);
    }
  });
  $("#drug-chip-input").addEventListener("click", (event) => {
    if (event.target === event.currentTarget || event.target === chips) {
      input.focus();
    }
  });

  function handleKeydown(event) {
    const open = !list.classList.contains("hidden");
    if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      setActive((active + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setActive((active - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      if (!input.value.trim()) {
        return; // Let Enter submit the form.
      }
      event.preventDefault();
      if (open && active >= 0) {
        choose(active);
      } else {
        commitTyped();
      }
    } else if (event.key === "Escape") {
      close();
    } else if (event.key === "Backspace" && !input.value && drugs.length) {
      remove(drugs.at(-1).id);
    }
  }

  async function refresh() {
    const query = input.value.trim();
    const { getDrugAutocompleteSuggestions } = await loadAutocomplete();
    if (input.value.trim() !== query) {
      return; // A newer keystroke will refresh.
    }
    suggestions = query.length >= 1 ? getDrugAutocompleteSuggestions(query, { limit: 8 }) : [];
    if (query.length >= 2 && !suggestions.some((item) => item.value.toLowerCase() === query.toLowerCase())) {
      suggestions.push({ label: `Use “${query}”`, value: query, description: "Search DailyMed with the typed name" });
    }
    active = suggestions.length ? 0 : -1;
    render();
  }

  function render() {
    const open = suggestions.length > 0;
    list.classList.toggle("hidden", !open);
    input.setAttribute("aria-expanded", String(open));
    setHtml(
      list,
      html`${suggestions.map(
        (item, index) => html`
          <li id="drug-option-${index}" role="option" aria-selected="${String(index === active)}" data-index="${index}">
            <span class="suggestion-main">
              <strong>${item.label}</strong>
              ${
                item.coverage
                  ? html`<span class="badge" data-tone="${COVERAGE_BADGES[item.coverage.status].tone}"
                      >${COVERAGE_BADGES[item.coverage.status].label}</span
                    >`
                  : ""
              }
            </span>
            <span>${item.description || ""}</span>
          </li>
        `
      )}`
    );
    if (active >= 0) {
      input.setAttribute("aria-activedescendant", `drug-option-${active}`);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function setActive(index) {
    active = index;
    render();
    $(`#drug-option-${index}`)?.scrollIntoView({ block: "nearest" });
  }

  function close() {
    suggestions = [];
    active = -1;
    render();
  }

  function choose(index) {
    const item = suggestions[index];
    if (item) {
      add(item.value);
    }
  }

  function commitTyped() {
    const value = input.value.replace(/[,;]+$/, "").trim();
    if (value) {
      add(value);
    }
  }

  function add(name, route = "") {
    input.value = "";
    close();
    const key = name.toLowerCase();
    const existing = drugs.find((drug) => drug.name.toLowerCase() === key);
    if (existing) {
      if (route) {
        existing.route = route;
        renderChips();
        onChange({ type: "update", drug: existing });
      }
      return;
    }
    if (drugs.length >= MAX_DRUGS) {
      return;
    }
    const drug = { id: nextId++, name, route };
    drugs = [...drugs, drug];
    renderChips();
    onChange({ type: "add", drug });
  }

  function remove(id) {
    const drug = drugs.find((item) => item.id === id);
    drugs = drugs.filter((item) => item.id !== id);
    renderChips();
    input.focus();
    onChange({ type: "remove", drug });
  }

  function toggleRoute(id) {
    const drug = drugs.find((item) => item.id === id);
    if (!drug) {
      return;
    }
    const order = ["ORAL", "IV", "SC"];
    drug.route = order[(order.indexOf(effectiveRoute(drug)) + 1) % order.length];
    renderChips();
    onChange({ type: "update", drug });
  }

  function effectiveRoute(drug) {
    return drug.route || getDefaultRoute();
  }

  function renderChips() {
    setHtml(
      chips,
      html`${drugs.map(
        (drug) => html`
          <li class="chip" data-id="${drug.id}">
            <span class="chip-name">${drug.name}</span>
            <button
              type="button"
              class="chip-route"
              data-action="route"
              aria-label="Route for ${drug.name}: ${routeLabel(effectiveRoute(drug))}. Switch route"
            >
              ${routeLabel(effectiveRoute(drug))}
            </button>
            <button type="button" class="chip-remove" data-action="remove" aria-label="Remove ${drug.name}">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </li>
        `
      )}`
    );
    input.placeholder = drugs.length ? "Add another drug" : "Add a drug — name, brand or shorthand";
  }

  return {
    get drugs() {
      return drugs.map((drug) => ({ ...drug, route: effectiveRoute(drug) }));
    },
    add,
    /** Adds any text still typed in the box as a drug. */
    commitPending: commitTyped,
    set(list) {
      drugs = [];
      renderChips();
      list.forEach((drug) => {
        drugs.push({ id: nextId++, name: drug.name, route: drug.route || "" });
      });
      renderChips();
    },
    clear() {
      drugs = [];
      input.value = "";
      close();
      renderChips();
    },
    refreshRoutes: renderChips,
  };
}

function routeLabel(route) {
  return { IV: "IV", SC: "SC" }[route] || "Oral";
}
