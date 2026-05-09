const AGE_LABELS = new Set(["age", "aged", "year", "years", "yr", "yrs", "yo"]);
const SEX_LABELS = new Set(["sex", "gender"]);
const WEIGHT_LABELS = new Set(["weight", "wt", "kg", "kgs"]);
const HEIGHT_LABELS = new Set(["height", "ht", "cm"]);
const DRUG_LABELS = new Set(["drug", "medicine", "medication", "med", "rx"]);
const ROUTE_LABELS = new Set(["route", "routes"]);
const FILLER_LABELS = new Set(["optional", "required", "enter", "value"]);
const CREATININE_LABELS = new Set([
  "scr",
  "s",
  "s.",
  "s.cr",
  "s.creatinine",
  "s.creat",
  "screat",
  "creat",
  "creatinine",
  "serumcreatinine",
  "serum-creatinine",
  "cr",
  "mg/dl",
  "mgdl",
]);

export function parseQuickInput(value) {
  const tokens = tokenize(value);
  if (!tokens.length) {
    return null;
  }

  const result = {
    age: "",
    sex: "male",
    creatinine: "",
    weight: "",
    height: "",
    drug: "",
    route: "ALL",
  };
  const used = new Set();

  parseDirectTokens(tokens, used, result);
  parseLabelNeighbors(tokens, used, result);
  parseFallbackNumbers(tokens, used, result);

  result.drug = tokens
    .filter((token, index) => !used.has(index) && !isIgnorableToken(token.lower))
    .map((token) => token.clean)
    .join(" ")
    .trim();

  return result;
}

function tokenize(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .map((raw) => {
      const clean = raw.replace(/^[,;:()]+|[,;:()]+$/g, "");
      return {
        raw,
        clean,
        lower: clean.toLowerCase(),
      };
    })
    .filter((token) => token.clean.length > 0);
}

function parseDirectTokens(tokens, used, result) {
  tokens.forEach((token, index) => {
    if (isMale(token.lower)) {
      result.sex = "male";
      used.add(index);
      return;
    }
    if (isFemale(token.lower)) {
      result.sex = "female";
      used.add(index);
      return;
    }
    if (isIvRoute(token.lower)) {
      result.route = "IV";
      used.add(index);
      return;
    }
    if (isOralRoute(token.lower)) {
      result.route = "ORAL";
      used.add(index);
      return;
    }
    if (isAllRoute(token.lower)) {
      result.route = "ALL";
      used.add(index);
      return;
    }

    const compactSex = token.lower.match(/^(\d{2,3})(m|f)$/i);
    if (compactSex) {
      assignNumber(result, "age", Number(compactSex[1]));
      result.sex = compactSex[2].toLowerCase() === "f" ? "female" : "male";
      used.add(index);
      return;
    }

    const attachedLabel = token.lower.match(
      /^(age|aged|wt|weight|scr|screat|s\.creat|s\.creatinine|creat|creatinine|cr|ht|height)(\d+(?:\.\d+)?)(?:mg\/?dl|kg|kgs|cm|y|yr|yrs)?$/
    );
    if (attachedLabel) {
      const field = fieldForLabel(attachedLabel[1]);
      if (field && assignNumber(result, field, Number(attachedLabel[2]))) {
        used.add(index);
      }
      return;
    }

    const attachedUnit = token.lower.match(/^(\d+(?:\.\d+)?)(mg\/?dl|mgdl|kg|kgs|cm|y|yr|yrs|yo)$/);
    if (attachedUnit) {
      const field = fieldForLabel(attachedUnit[2]);
      if (field && assignNumber(result, field, Number(attachedUnit[1]))) {
        used.add(index);
      }
    }
  });
}

function parseLabelNeighbors(tokens, used, result) {
  tokens.forEach((token, index) => {
    if (used.has(index)) {
      return;
    }
    const field = fieldForLabel(token.lower);
    if (!field) {
      return;
    }

    const nextIndex = findNearestNumber(tokens, used, index, 1);
    if (nextIndex >= 0 && assignNumber(result, field, numberValue(tokens[nextIndex].clean))) {
      used.add(index);
      used.add(nextIndex);
      return;
    }

    const previousIndex = findNearestNumber(tokens, used, index, -1);
    if (previousIndex >= 0 && assignNumber(result, field, numberValue(tokens[previousIndex].clean))) {
      used.add(index);
      used.add(previousIndex);
    }
  });
}

function parseFallbackNumbers(tokens, used, result) {
  const remaining = tokens
    .map((token, index) => ({ token, index, value: numberValue(token.clean) }))
    .filter((item) => !used.has(item.index) && Number.isFinite(item.value));

  const unlabelled = remaining.map((item) => item.value);
  const hasAnyExplicitClinicalValue = Boolean(result.age || result.creatinine || result.weight || result.height);
  if (!hasAnyExplicitClinicalValue && unlabelled.length >= 3) {
    assignNumber(result, "age", unlabelled[0]);
    assignNumber(result, "creatinine", unlabelled[1]);
    assignNumber(result, "weight", unlabelled[2]);
    if (unlabelled.length >= 4) {
      assignNumber(result, "height", unlabelled[3]);
    }
    remaining.slice(0, 4).forEach((item) => used.add(item.index));
    return;
  }

  const creatinineCandidate = remaining.find(
    (item) => !result.creatinine && item.value >= 0.1 && item.value <= 25 && /\./.test(item.token.clean)
  );
  if (creatinineCandidate && assignNumber(result, "creatinine", creatinineCandidate.value)) {
    used.add(creatinineCandidate.index);
  }

  const heightCandidate = remaining.find(
    (item) => !used.has(item.index) && !result.height && item.value >= 100 && item.value <= 230
  );
  if (heightCandidate && assignNumber(result, "height", heightCandidate.value)) {
    used.add(heightCandidate.index);
  }

  const left = remaining.filter((item) => !used.has(item.index));
  if (!result.age && !result.weight && left.length >= 2) {
    const [first, second] = left;
    const orderedLooksLikeAgeWeight =
      isValidFieldValue("age", first.value) && isValidFieldValue("weight", second.value);
    if (orderedLooksLikeAgeWeight) {
      assignNumber(result, "age", first.value);
      assignNumber(result, "weight", second.value);
      used.add(first.index);
      used.add(second.index);
      return;
    }
  }

  for (const item of left) {
    if (!result.age && assignNumber(result, "age", item.value)) {
      used.add(item.index);
      continue;
    }
    if (!result.weight && assignNumber(result, "weight", item.value)) {
      used.add(item.index);
      continue;
    }
    if (!result.creatinine && assignNumber(result, "creatinine", item.value)) {
      used.add(item.index);
    }
  }
}

function findNearestNumber(tokens, used, labelIndex, direction) {
  const candidateIndex = labelIndex + direction;
  if (candidateIndex < 0 || candidateIndex >= tokens.length || used.has(candidateIndex)) {
    return -1;
  }
  return Number.isFinite(numberValue(tokens[candidateIndex].clean)) ? candidateIndex : -1;
}

function fieldForLabel(label) {
  if (AGE_LABELS.has(label)) {
    return "age";
  }
  if (WEIGHT_LABELS.has(label)) {
    return "weight";
  }
  if (HEIGHT_LABELS.has(label)) {
    return "height";
  }
  if (CREATININE_LABELS.has(label)) {
    return "creatinine";
  }
  return "";
}

function assignNumber(result, field, value) {
  if (!Number.isFinite(value) || !isValidFieldValue(field, value) || result[field]) {
    return false;
  }
  result[field] = value;
  return true;
}

function isValidFieldValue(field, value) {
  if (field === "age") {
    return value >= 18 && value <= 120;
  }
  if (field === "creatinine") {
    return value >= 0.1 && value <= 25;
  }
  if (field === "weight") {
    return value >= 20 && value <= 300;
  }
  if (field === "height") {
    return value >= 100 && value <= 230;
  }
  return false;
}

function numberValue(value) {
  return /^\d+(?:\.\d+)?$/.test(String(value || "")) ? Number(value) : NaN;
}

function isMale(value) {
  return /^(?:m|male|man)$/i.test(value);
}

function isFemale(value) {
  return /^(?:f|female|woman)$/i.test(value);
}

function isIvRoute(value) {
  return /^(?:iv|i\.v\.|intravenous)\d*$/i.test(value);
}

function isOralRoute(value) {
  return /^(?:po|oral|tablet|tab|capsule|cap)\d*$/i.test(value);
}

function isAllRoute(value) {
  return /^(?:all|any)$/i.test(value);
}

function isIgnorableToken(value) {
  return (
    AGE_LABELS.has(value) ||
    SEX_LABELS.has(value) ||
    WEIGHT_LABELS.has(value) ||
    HEIGHT_LABELS.has(value) ||
    CREATININE_LABELS.has(value) ||
    DRUG_LABELS.has(value) ||
    ROUTE_LABELS.has(value) ||
    FILLER_LABELS.has(value) ||
    isMale(value) ||
    isFemale(value) ||
    isIvRoute(value) ||
    isOralRoute(value) ||
    isAllRoute(value)
  );
}
