import { addDrug, calculate, expect, fillPatient, test } from "./fixtures.js";

test.beforeEach(async ({ page, api: _api }) => {
  await page.goto("/");
});

test("kidney function updates as you type", async ({ page }) => {
  await fillPatient(page);
  await expect(page.locator("#crcl-value")).toHaveText("52.6");
  await expect(page.locator("#egfr-value")).toHaveText("53.4");
  await expect(page.locator("#ckd-tag")).toHaveText("CKD G3a");
  await expect(page.locator("#gauge-marker")).toBeVisible();

  await page.fill("#height", "175");
  await expect(page.locator("#ibw-value")).toHaveText("70.5 kg");
  await expect(page.locator("#bmi-value")).toHaveText("25.5 kg/m²");
});

test("invalid and missing fields are explained", async ({ page }) => {
  await page.fill("#age", "12");
  await expect(page.locator("#age-error")).toContainText("Adults only");
  await calculate(page);
  await expect(page.locator("#form-error")).toBeVisible();
  await expect(page.locator("#weight-error")).toHaveText("Required");
});

test("quick entry fills the form and checks several drugs", async ({ page, api }) => {
  await page.fill("#quick-input", "82 F 55 kg 1.6 apixaban, meropenem IV, zzqxnotadrug");
  await page.press("#quick-input", "Enter");

  await expect(page.locator("#age")).toHaveValue("82");
  await expect(page.locator(".chip")).toHaveCount(3);
  await expect(page.locator(".chip").nth(1)).toContainText("IV");

  const cards = page.locator(".dose-card");
  await expect(cards).toHaveCount(3);
  const apixaban = cards.filter({ hasText: "Apixaban" });
  await expect(apixaban.locator(".dose-value strong")).toHaveText("2.5 mg");
  await expect(apixaban).toContainText("3 of 3");
  await expect(apixaban.locator(".badge")).toHaveText("Curated · draft");

  const meropenem = cards.filter({ hasText: "Meropenem" });
  await expect(meropenem.locator(".badge")).toHaveText("Clinician-verified");
  await expect(meropenem.locator(".dose-band strong")).toHaveText("10-25");
  await expect(meropenem.locator(".decision")).toHaveText("Adjust dose");

  await expect(cards.filter({ hasText: "zzqxnotadrug" }).locator(".decision")).toHaveText("Not found");
  await expect(page.locator("#dose-summary li")).toHaveCount(3);
  expect(api.requests.map((body) => body.route).sort()).toEqual(["IV", "ORAL", "ORAL"]);
});

test("changing indication re-checks only that drug", async ({ page, api }) => {
  await fillPatient(page, { age: "70", sex: "female", weight: "60", creatinine: "2.8" });
  await page.locator(".segmented input[name=route][value=SC] + span").click();
  await addDrug(page, "enoxaparin");
  await calculate(page);

  const card = page.locator(".dose-card", { hasText: "Enoxaparin" });
  await expect(card.locator(".dose-value strong")).toHaveText("30 mg");
  await expect(card.locator(".needs-choice")).toBeVisible();

  const before = api.requests.length;
  await card.locator("select[data-control=indication]").selectOption("dvt-treatment");
  await expect(card.locator(".dose-value strong")).toHaveText("1 mg/kg");
  expect(api.requests.length).toBe(before + 1);
  expect(api.requests.at(-1).indication).toBe("dvt-treatment");
});

test("drug route can be switched from the chip", async ({ page, api }) => {
  await fillPatient(page);
  await addDrug(page, "meropenem");
  await calculate(page);
  await expect(page.locator(".dose-card .decision")).toHaveText("Not found");

  await page.locator(".chip-route").click();
  await expect(page.locator(".chip-route")).toHaveText("IV");
  await expect(page.locator(".dose-card .badge")).toHaveText("Clinician-verified");
  expect(api.requests.at(-1).route).toBe("IV");
});

test("autocomplete works with the keyboard", async ({ page }) => {
  await page.fill("#drug-input", "piptaz");
  await expect(page.locator("#drug-suggestions")).toBeVisible();
  await expect(page.locator("#drug-input")).toHaveAttribute("aria-expanded", "true");
  await page.press("#drug-input", "Enter");
  await expect(page.locator(".chip")).toHaveCount(1);
  await expect(page.locator(".chip-name")).toContainText(/piperacillin/i);
  await page.press("#drug-input", "Backspace");
  await expect(page.locator(".chip")).toHaveCount(0);
});

test("service errors offer a retry and a DailyMed search", async ({ page, api }) => {
  api.fail = true;
  await fillPatient(page);
  await addDrug(page, "meropenem");
  await calculate(page);
  const card = page.locator(".dose-card");
  await expect(card).toContainText("Couldn't get renal dosing", { timeout: 20_000 });
  await expect(card.getByRole("link", { name: "Search DailyMed" })).toHaveAttribute("href", /dailymed/);

  api.fail = false;
  await card.getByRole("button", { name: "Try again" }).click();
  await expect(card.locator(".decision")).toHaveText("Not found");
});

test("recent checks can be reopened", async ({ page }) => {
  await fillPatient(page);
  await addDrug(page, "sitagliptin");
  await calculate(page);
  await expect(page.locator(".dose-card .dose-value strong")).toHaveText("100 mg once daily");

  await page.reload();
  await page.locator("#recent-list button").first().click();
  await expect(page.locator("#age")).toHaveValue("72");
  await expect(page.locator(".dose-card .dose-value strong")).toHaveText("100 mg once daily");
});

test("reset clears everything", async ({ page }) => {
  await fillPatient(page);
  await addDrug(page, "sitagliptin");
  await calculate(page);
  await expect(page.locator(".dose-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.locator("#crcl-value")).toHaveText("—");
  await expect(page.locator(".dose-card")).toHaveCount(0);
  await expect(page.locator("#dose-empty")).toBeVisible();
});

test("copy summary includes the drug and disclaimer", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await fillPatient(page);
  await addDrug(page, "sitagliptin");
  await calculate(page);
  await expect(page.locator(".dose-card .dose-value strong")).toHaveText("100 mg once daily");
  await page.locator("#copy-all").click();
  await expect(page.locator("#toast")).toHaveText("Copied summary");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("Sitagliptin");
  expect(text).toContain("not for prescribing");
});

test("theme toggle cycles system, light and dark", async ({ page }) => {
  const toggle = page.locator("#theme-toggle");
  await expect(toggle).toHaveAttribute("aria-label", "Theme: system");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("page has no horizontal overflow and no console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.reload();
  await page.fill("#quick-input", "82 F 55 kg 1.6 apixaban, meropenem IV");
  await page.press("#quick-input", "Enter");
  await expect(page.locator(".dose-card .badge")).toHaveCount(2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("print hides the form and keeps results", async ({ page }) => {
  await fillPatient(page);
  await addDrug(page, "sitagliptin");
  await calculate(page);
  await expect(page.locator(".dose-card .dose-value strong")).toHaveText("100 mg once daily");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#renal-form")).toBeHidden();
  await expect(page.locator(".dose-card")).toBeVisible();
  await expect(page.locator(".app-footer")).toContainText("not for prescribing");
});

test("works offline after the first visit", async ({ page, context, api, browserName }) => {
  test.skip(browserName !== "chromium");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  api.offline = true;
  await page.reload();
  await expect(page.locator("#net-status-label")).toHaveText("Offline");
  await fillPatient(page);
  await expect(page.locator("#crcl-value")).toHaveText("52.6");
  await addDrug(page, "meropenem");
  await calculate(page);
  await expect(page.locator(".dose-card")).toContainText("offline", { timeout: 20_000 });
  await context.setOffline(false);
});

test("creatinine unit toggle converts between mg/dL and µmol/L", async ({ page }) => {
  await fillPatient(page);
  await page.locator("#scr-unit").click();
  await expect(page.locator("#scr-unit")).toHaveText("µmol/L");
  await expect(page.locator("#creatinine")).toHaveValue("124");
  await expect(page.locator("#crcl-value")).toHaveText("52.6");
  await page.locator("#scr-unit").click();
  await expect(page.locator("#creatinine")).toHaveValue("1.4");
});

test("weight for CrCl can use ideal or adjusted weight", async ({ page }) => {
  await fillPatient(page, { weight: "110", height: "175" });
  await expect(page.locator("#crcl-value")).toHaveText("74.2");
  await page.locator(".segmented input[name=weightBasis][value=ideal] + span").click();
  await expect(page.locator("#crcl-value")).toHaveText("47.6");
  await page.locator(".segmented input[name=weightBasis][value=adjusted] + span").click();
  await expect(page.locator("#crcl-value")).toHaveText("58.2");
  await expect(page.locator("#kidney-notes")).toContainText("CrCl by weight");
});

test("dialysis status changes the guidance and is explained", async ({ page, api }) => {
  await fillPatient(page, { creatinine: "7.5" });
  await page.selectOption("#dialysis", "hd");
  await expect(page.locator("#kidney-alert")).toContainText("hemodialysis");
  await page.locator(".segmented input[name=route][value=IV] + span").click();
  await addDrug(page, "cefepime");
  await addDrug(page, "meropenem");
  await calculate(page);

  const cefepime = page.locator(".dose-card", { hasText: "Cefepime" });
  await expect(cefepime).toContainText("hemodialysis rule is shown");
  const meropenem = page.locator(".dose-card", { hasText: "Meropenem" });
  await expect(meropenem.locator(".decision")).toHaveText("Review for dialysis");
  expect(api.requests.every((body) => body.dialysis === "hd")).toBe(true);
});

test("unstable creatinine warns on the kidney card and every drug", async ({ page }) => {
  await fillPatient(page);
  await page.locator("#unstable").check();
  await expect(page.locator("#kidney-alert")).toContainText("Creatinine not stable");
  await addDrug(page, "sitagliptin");
  await calculate(page);
  await expect(page.locator(".dose-card")).toContainText("Consider the next lower band");
});

test("share link reopens the same check", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await fillPatient(page, { weight: "110", height: "175" });
  await page.locator(".segmented input[name=weightBasis][value=adjusted] + span").click();
  await addDrug(page, "sitagliptin");
  await calculate(page);
  await expect(page.locator(".dose-card .dose-value strong")).toHaveText("100 mg once daily");

  await page.locator("#share").click();
  await expect(page.locator("#toast")).toHaveText("Link copied");
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/#c=[A-Za-z0-9_-]+$/);

  const other = await context.newPage();
  await other.goto(link);
  await expect(other.locator("#weight")).toHaveValue("110");
  await expect(other.locator("#crcl-value")).toHaveText("58.2");
  await expect(other.locator(".chip")).toHaveCount(1);
  expect(other.url()).not.toContain("#c=");
});

test("dose guidance appears as soon as details and a drug are entered, without pressing Calculate", async ({
  page,
}) => {
  await fillPatient(page, { age: "65", weight: "70", creatinine: "2" });
  await expect(page.locator("#crcl-value")).toHaveText("36.5");
  await page.locator(".segmented input[name=route][value=IV] + span").click();
  await addDrug(page, "meropenem");
  const card = page.locator(".dose-card");
  await expect(card.locator(".dose-band strong")).toHaveText("26-50");
  await expect(card.locator(".badge")).toHaveText("Clinician-verified");

  // Editing creatinine refreshes the dose after typing pauses.
  await page.fill("#creatinine", "4");
  await expect(card.locator(".dose-band strong")).toHaveText("10-25");

  // Incomplete details drop the old answer instead of showing it.
  await page.fill("#creatinine", "");
  await expect(card).toContainText("enter age, weight and creatinine");
  await expect(card.locator(".dose-value")).toHaveCount(0);
});

test("a drug added before the patient details is checked once they are complete", async ({ page }) => {
  await addDrug(page, "sitagliptin");
  await expect(page.locator(".dose-card")).toContainText("enter age, weight and creatinine");
  await fillPatient(page);
  await expect(page.locator(".dose-card .dose-value strong")).toHaveText("100 mg once daily");
});
