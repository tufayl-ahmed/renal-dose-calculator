import { $ } from "./dom.js";

let deferredPrompt = null;

export function initPwa() {
  updateStatus();
  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallButton();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    updateInstallButton();
    updateStatus();
  });
  $("#install-app")?.addEventListener("click", promptInstall);

  if (import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // The app works without offline support if a browser blocks service workers.
      });
    });
  }
}

async function promptInstall() {
  if (!deferredPrompt) {
    return;
  }
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  updateInstallButton();
  promptEvent.prompt();
  try {
    await promptEvent.userChoice;
  } catch {
    // Some browsers do not expose userChoice.
  }
  updateStatus();
}

function updateInstallButton() {
  $("#install-app")?.classList.toggle("hidden", !deferredPrompt || isStandalone());
}

function updateStatus() {
  const pill = $("#net-status");
  if (!pill) {
    return;
  }
  const offline = navigator.onLine === false;
  pill.dataset.state = offline ? "offline" : isStandalone() ? "installed" : "online";
  $("#net-status-label").textContent = offline ? "Offline" : isStandalone() ? "Installed" : "Online";
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
