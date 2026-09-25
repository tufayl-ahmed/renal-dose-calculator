import {
  getRecordVerification,
  listCandidateRecords,
  listCuratedRecords,
} from "../../src/curatedDoseRules.js";
import { normalizeDrugKey } from "../../src/drugNormalizer.js";

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
  return Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
}
