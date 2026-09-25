export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function routeDisplayName(route) {
  if (route === "IV") {
    return "IV";
  }
  if (route === "ORAL") {
    return "Oral";
  }
  if (route === "SC") {
    return "Subcutaneous";
  }
  return "All routes";
}

export function selectedRouteDisplayName(route, fallbackRoute) {
  if (route === "IV" || route === "ORAL" || route === "SC") {
    return routeDisplayName(route);
  }
  return fallbackRoute || routeDisplayName(route);
}

export function routeSentenceName(route) {
  const label = routeDisplayName(route);
  return label === "IV" ? "IV" : label.toLowerCase();
}

export function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text, maxLength) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}…`;
}

export function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}

export function splitDoseAndFrequency(text) {
  const cleaned = compactText(text);
  if (/% of usual daily dose/i.test(cleaned)) {
    return {
      dose: cleaned,
      frequency: /after loading dose/i.test(cleaned)
        ? "after loading dose; then daily dose by indication"
        : "daily dose by indication",
    };
  }
  const mgPerDay = cleaned.match(/^(\d+(?:\.\d+)?\s*(?:to|-|–|—)\s*\d+(?:\.\d+)?\s*mg\/day)\s*;\s*(.+)$/i);
  if (mgPerDay) {
    return {
      dose: mgPerDay[1],
      frequency: mgPerDay[2],
    };
  }
  const repeatedEvery =
    cleaned.match(
      /\b(?:one-half\s+)?(?:recommended dose|\d+(?:\.\d+)?\s*(?:mg|g|mcg|units?))(?:\s+or\s+\d+(?:\.\d+)?\s*(?:mg|g|mcg|units?))?\s+every\s+\d+\s+hours?\b/gi
    ) || [];
  if (repeatedEvery.length > 1) {
    const doseParts = repeatedEvery
      .map((part) => part.match(/\b(?:one-half\s+)?(?:recommended dose|\d+(?:\.\d+)?\s*(?:mg|g|mcg|units?))\b/i)?.[0])
      .filter(Boolean);
    const frequencyParts = repeatedEvery.map((part) => part.match(/\bevery\s+\d+\s+hours?\b/i)?.[0]).filter(Boolean);
    const uniqueFrequencies = [...new Set(frequencyParts.map((part) => part.toLowerCase()))];
    if (doseParts.length > 1 && uniqueFrequencies.length === 1) {
      return {
        dose: [...new Set(doseParts)].join(" or "),
        frequency: frequencyParts[0],
      };
    }
  }

  const match = cleaned.match(
    /\b(every\s+\d+\s+hours?|once daily|twice daily|three times daily|daily|single dose|after dialysis|following dialysis|q\s*\d+\s*h)\b/i
  );
  if (!match) {
    return { dose: cleaned || "Review source", frequency: "By indication" };
  }
  return {
    dose: cleaned.slice(0, match.index).trim() || "Recommended dose",
    frequency: cleaned
      .slice(match.index)
      .replace(/\s+\b(?:CrCl|Clcr|Creatinine Clearance)\b\s*$/i, "")
      .trim(),
  };
}
