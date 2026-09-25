export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Wraps markup that is already safe so `html` does not escape it again. */
export function raw(markup) {
  return { __html: String(markup) };
}

/** Tagged template that escapes interpolated values unless wrapped in raw(). */
export function html(strings, ...values) {
  return raw(
    strings.reduce((out, chunk, index) => {
      if (index === 0) {
        return chunk;
      }
      return out + renderValue(values[index - 1]) + chunk;
    }, "")
  );
}

function renderValue(value) {
  if (value === null || value === undefined || value === false) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(renderValue).join("");
  }
  if (typeof value === "object" && "__html" in value) {
    return value.__html;
  }
  return escapeHtml(value);
}

export function setHtml(element, markup) {
  element.innerHTML = markup.__html ?? "";
}

let toastTimer = 0;
export function toast(message) {
  const element = $("#toast");
  if (!element) {
    return;
  }
  element.textContent = message;
  element.classList.remove("hidden");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element.classList.add("hidden"), 2200);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "visually-hidden";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export const storage = {
  get(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable (private mode); the app still works.
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore.
    }
  },
};
