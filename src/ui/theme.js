import { $, storage } from "./dom.js";

const KEY = "renal-dose-theme";
const ORDER = ["system", "light", "dark"];

export function initTheme() {
  apply(storage.get(KEY, "system"));
  $("#theme-toggle")?.addEventListener("click", () => {
    const current = document.documentElement.dataset.themePreference || "system";
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    storage.set(KEY, next);
    apply(next);
  });
}

function apply(preference) {
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  if (preference === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }
  const button = $("#theme-toggle");
  if (button) {
    const label = `Theme: ${preference}`;
    button.setAttribute("aria-label", label);
    button.title = label;
  }
}
