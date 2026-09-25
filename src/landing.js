import { initTheme } from "./ui/theme.js";

// Telegram Mini App launches and shared check links (#c=...) belong in the
// calculator, not on the landing page.
const params = new URLSearchParams(window.location.search);
if (params.get("telegram") === "1" || params.has("tgWebAppData") || /(^#|&)(c=|tgWebAppData)/.test(window.location.hash)) {
  window.location.replace(`/app/${window.location.search}${window.location.hash}`);
}

initTheme();
