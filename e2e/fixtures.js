import { test as base, expect } from "@playwright/test";
import { resolveCandidatePayload } from "../server/renalDose/candidates.js";
import { resolveCuratedPayload } from "../server/renalDose/curated.js";
import { sanitizePatient } from "../server/renalDose/results.js";

/**
 * Serves /api/renal-dose/assist from the real curated-rule pipeline in Node,
 * so tests are deterministic and need no network. Drugs without a curated
 * record get a "not found" response. `api.requests` records request bodies.
 */
export const test = base.extend({
  api: async ({ page }, use) => {
    const api = { requests: [], fail: false, offline: false };
    await page.route("**/api/renal-dose/assist", async (route) => {
      const body = route.request().postDataJSON();
      api.requests.push(body);
      if (api.offline) {
        await route.abort("internetdisconnected");
        return;
      }
      if (api.fail) {
        await route.fulfill({ status: 500, body: "{}" });
        return;
      }
      const patient = sanitizePatient(body);
      const payload = resolveCuratedPayload(patient) ||
        resolveCandidatePayload(patient) || {
          result: {
            status: "not_found",
            drugName: body.drug,
            route: body.route,
            renalMetricUsed: "crcl",
            renalBand: "",
            dose: "Drug label not found",
            frequency: "Review DailyMed source",
            importantCautions: [],
            sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=x",
          },
          sourceMode: "not-found",
        };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
    });
    await use(api);
  },
});

export { expect };

export async function fillPatient(
  page,
  { age = "72", sex = "male", weight = "78", creatinine = "1.4", height = "" } = {}
) {
  await page.fill("#age", age);
  await page.locator(`.segmented input[name=sex][value=${sex}] + span`).click();
  await page.fill("#weight", weight);
  if (height) {
    await page.fill("#height", height);
  }
  await page.fill("#creatinine", creatinine);
}

export async function addDrug(page, name) {
  await page.fill("#drug-input", name);
  await page.press("#drug-input", "Enter");
}

export async function calculate(page) {
  await page.getByRole("button", { name: "Calculate" }).first().click({ force: true });
}
