// Telegram Mini App support. The Telegram SDK is only loaded when the page is
// opened inside Telegram, so the regular web app makes no third-party requests.
let webApp = null;

export function isTelegramMiniApp() {
  const params = new URLSearchParams(window.location.search);
  return params.get("telegram") === "1" || params.has("tgWebAppData") || window.location.hash.includes("tgWebAppData");
}

export async function initTelegram() {
  if (!isTelegramMiniApp()) {
    return;
  }
  document.documentElement.classList.add("is-telegram");
  webApp = await loadSdk();
  if (!webApp) {
    return;
  }
  try {
    applyTheme();
    webApp.onEvent?.("themeChanged", applyTheme);
    webApp.ready?.();
    webApp.expand?.();
  } catch {
    // Methods vary between Telegram clients.
  }
}

export function haptic(type = "light") {
  try {
    if (["success", "error", "warning"].includes(type)) {
      webApp?.HapticFeedback?.notificationOccurred?.(type);
    } else {
      webApp?.HapticFeedback?.impactOccurred?.(type);
    }
  } catch {
    // Haptics are best-effort only.
  }
}

function loadSdk() {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.onload = () => resolve(window.Telegram?.WebApp || null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

function applyTheme() {
  const theme = webApp?.themeParams || {};
  const root = document.documentElement;
  root.dataset.theme = webApp?.colorScheme === "dark" ? "dark" : "light";
  const map = {
    "--bg": theme.bg_color,
    "--surface": theme.secondary_bg_color || theme.bg_color,
    "--text": theme.text_color,
    "--text-muted": theme.hint_color,
    "--border": theme.section_separator_color,
    "--primary": theme.button_color,
    "--on-primary": theme.button_text_color,
    "--link": theme.link_color,
  };
  Object.entries(map).forEach(([name, value]) => value && root.style.setProperty(name, value));
  try {
    webApp.setHeaderColor?.(theme.bg_color || "#ffffff");
    webApp.setBackgroundColor?.(theme.bg_color || "#ffffff");
  } catch {
    // Not every client supports colour methods.
  }
}
