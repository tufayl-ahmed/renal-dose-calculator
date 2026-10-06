// Polls the live dose API right after a deploy and reports how long it takes
// for curated drugs to answer correctly. Exits non-zero if they are still
// wrong after the time limit.
//
//   node scripts/poll-after-deploy.mjs [--url=https://…] [--seconds=90] [--quiet]
const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")));
const BASE = args.url || "https://renal-dose-calculator-3fl.pages.dev";
const LIMIT_MS = Number(args.seconds || 90) * 1000;
const INTERVAL_MS = 2000;

const CHECKS = [
  { drug: "lorlatinib", route: "ORAL", crcl: 22, expect: /75 mg/ },
  { drug: "simvastatin", route: "ORAL", crcl: 20, expect: /5 mg/ },
];

const started = Date.now();
let firstGood = null;
let lastLine = "";
while (Date.now() - started < LIMIT_MS) {
  const results = await Promise.all(CHECKS.map(check));
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const line = results.map((r) => `${r.drug}: ${r.ok ? "ok" : r.summary}`).join(" | ");
  if (line !== lastLine || !args.quiet) {
    console.log(`${elapsed.padStart(5)}s  ${line}`);
    lastLine = line;
  }
  if (results.every((r) => r.ok)) {
    firstGood = elapsed;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
}

if (firstGood === null) {
  console.error(`Curated answers still wrong after ${LIMIT_MS / 1000}s.`);
  process.exit(1);
}
console.log(`Correct answers after ${firstGood}s.`);

async function check({ drug, route, crcl, expect }) {
  const body = { drug, route, crcl, egfr: crcl, age: 60, sex: "male", weight: 70, creatinine: 2, debug: true };
  try {
    const response = await fetch(`${BASE}/api/renal-dose/assist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // Not JSON (an HTML error page, for example).
    }
    const result = data?.result || {};
    const ok = response.ok && expect.test(result.dose || "");
    const diag = data?.debug ? ` stage=${data.debug.stage} errors=${JSON.stringify(data.debug.errors)}` : "";
    const summary = `HTTP ${response.status} mode=${data?.sourceMode || "-"} status=${result.status || "-"} name=${result.drugName || "-"} dose="${String(result.dose || text.slice(0, 60)).slice(0, 40)}"${diag}`;
    return { drug, ok, summary };
  } catch (error) {
    return { drug, ok: false, summary: `network error: ${error.message}` };
  }
}
