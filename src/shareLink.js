// Encodes a check (patient values + drugs) into a URL fragment and back.
// The fragment never reaches the server; it holds no names or identifiers.

const VERSION = 1;

export function encodeCheck({ patient, drugs, defaultRoute }) {
  const state = {
    v: VERSION,
    a: patient.age,
    s: patient.sex === "female" ? "f" : "m",
    w: patient.weight,
    h: patient.height ?? null,
    c: patient.creatinine,
    wb: patient.weightBasis || "actual",
    d: patient.dialysis || "none",
    u: patient.unstable ? 1 : 0,
    r: defaultRoute || "ORAL",
    dr: drugs.map((drug) => [drug.name, drug.route || ""]),
  };
  return `c=${toBase64Url(JSON.stringify(state))}`;
}

export function decodeCheck(hash) {
  const match = String(hash || "").match(/(?:^#?|&)c=([A-Za-z0-9_-]+)/);
  if (!match) {
    return null;
  }
  try {
    const state = JSON.parse(fromBase64Url(match[1]));
    if (state.v !== VERSION) {
      return null;
    }
    const number = (value) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : null);
    return {
      patient: {
        age: number(state.a),
        sex: state.s === "f" ? "female" : "male",
        weight: number(state.w),
        height: number(state.h),
        creatinine: number(state.c),
        weightBasis: ["ideal", "adjusted"].includes(state.wb) ? state.wb : "actual",
        dialysis: ["hd", "pd", "crrt"].includes(state.d) ? state.d : "none",
        unstable: state.u === 1,
      },
      defaultRoute: ["IV", "SC"].includes(state.r) ? state.r : "ORAL",
      drugs: (Array.isArray(state.dr) ? state.dr : [])
        .filter((entry) => Array.isArray(entry) && typeof entry[0] === "string" && entry[0].trim())
        .slice(0, 8)
        .map(([name, route]) => ({
          name: name.slice(0, 80),
          route: ["ORAL", "IV", "SC"].includes(route) ? route : "",
        })),
    };
  } catch {
    return null;
  }
}

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
