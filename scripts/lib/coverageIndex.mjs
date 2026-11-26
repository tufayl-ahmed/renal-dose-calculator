import { getRecordVerification, listCandidateRecords, listCuratedRecords } from "../../src/curatedDoseRules.js";
import { baseDrugKey, normalizeDrugKey } from "../../src/drugNormalizer.js";
import { NON_SYSTEMIC_DRUGS } from "../../src/data/nonSystemicDrugs.js";

const RANK = { v: 3, c: 2, e: 1 };

export function buildCoverageIndex() {
  const index = {};
  const add = (record, status) => {
    const names = [record.drugName, record.searchTerm, ...(record.aliases || [])];
    for (const key of new Set(names.map(normalizeDrugKey).filter(Boolean))) {
      const entry = index[key] || { s: status, r: [] };
      if (RANK[status] > RANK[entry.s]) {
        entry.s = status;
      }
      entry.r = [...new Set([...entry.r, ...record.routes])].sort();
      index[key] = entry;
    }
  };
  for (const record of listCuratedRecords()) {
    const verification = getRecordVerification(record);
    if (verification.status !== "retired") {
      add(record, verification.status === "verified" ? "v" : "c");
    }
  }
  for (const record of listCandidateRecords()) {
    const verification = getRecordVerification(record);
    if (verification.status !== "retired") {
      add(record, verification.status === "verified" ? "v" : "e");
    }
  }
  // Salt-free names ("olmesartan" for "Olmesartan Medoxomil") as a fallback;
  // an exact name always keeps its own entry.
  const exact = new Set(Object.keys(index));
  const addBase = (record, status) => {
    const names = [record.drugName, record.searchTerm, ...(record.aliases || [])];
    for (const key of new Set(names.map(baseDrugKey).filter(Boolean))) {
      if (exact.has(key)) {
        continue;
      }
      const entry = index[key] || { s: status, r: [] };
      if (RANK[status] > RANK[entry.s]) {
        entry.s = status;
      }
      entry.r = [...new Set([...entry.r, ...record.routes])].sort();
      index[key] = entry;
    }
  };
  for (const record of listCuratedRecords()) {
    const verification = getRecordVerification(record);
    if (verification.status !== "retired") {
      addBase(record, verification.status === "verified" ? "v" : "c");
    }
  }
  for (const record of listCandidateRecords()) {
    const verification = getRecordVerification(record);
    if (verification.status !== "retired") {
      addBase(record, verification.status === "verified" ? "v" : "e");
    }
  }
  // Drugs the live lookup found only in topical/eye/inhaled forms with no
  // kidney text. A rule record for the same name, or its salt-free name
  // ("Timolol Maleate" -> oral timolol), always wins.
  for (const name of NON_SYSTEMIC_DRUGS) {
    const parts = name.split(";").map((part) => part.trim());
    for (const query of [parts.join(" and "), [...parts].reverse().join(" and ")]) {
      const key = normalizeDrugKey(query);
      if (key && !index[key] && !index[baseDrugKey(query)]) {
        index[key] = { s: "n", r: [] };
      }
    }
  }
  return Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
}
