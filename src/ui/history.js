import { $, html, setHtml, storage } from "./dom.js";

const KEY = "renal-dose-recent-v3";
const MAX = 6;

export function createHistory({ onSelect }) {
  const list = $("#recent-list");
  $("#clear-recent").addEventListener("click", () => {
    storage.remove(KEY);
    render();
  });
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-index]");
    if (button) {
      const item = read()[Number(button.dataset.index)];
      if (item) {
        onSelect(item);
      }
    }
  });
  render();

  function read() {
    const items = storage.get(KEY, []);
    return Array.isArray(items) ? items : [];
  }

  function render() {
    const items = read();
    $("#recent").classList.toggle("hidden", items.length === 0);
    setHtml(
      list,
      html`${items.map(
        (item, index) => html`
          <li>
            <button type="button" data-index="${index}">
              <span class="recent-patient"
                >${item.patient.age} ${item.patient.sex === "female" ? "F" : "M"} · ${item.patient.weight} kg · SCr
                ${item.patient.creatinine}</span
              >
              <span class="recent-drugs"
                >${item.drugs.length ? item.drugs.map((drug) => drug.name).join(", ") : "No drugs"} · CrCl
                ${Number(item.crcl).toFixed(0)}</span
              >
            </button>
          </li>
        `
      )}`
    );
  }

  return {
    add({ patient, drugs, crcl }) {
      const entry = {
        patient: {
          age: patient.age,
          sex: patient.sex,
          weight: patient.weight,
          height: patient.height,
          creatinine: patient.creatinine,
        },
        drugs: drugs.map((drug) => ({ name: drug.name, route: drug.route })),
        crcl,
      };
      const key = JSON.stringify([entry.patient, entry.drugs]);
      const next = [entry, ...read().filter((item) => JSON.stringify([item.patient, item.drugs]) !== key)].slice(
        0,
        MAX
      );
      storage.set(KEY, next);
      render();
    },
  };
}
