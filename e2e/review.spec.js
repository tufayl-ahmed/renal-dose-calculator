import { readFile } from "node:fs/promises";
import { parseCsv, rowsToObjects } from "../src/csv.js";
import { expect, test } from "./fixtures.js";

test("reviewer can verify a record and export an importable CSV", async ({ page }) => {
  await page.goto("/review.html");
  await expect(page.locator(".review-card").first()).toBeVisible();

  await page.fill("#review-search", "sitagliptin");
  const card = page.locator(".review-card", { hasText: "Sitagliptin" }).first();
  await card.getByRole("button", { name: "Verify" }).click();
  await expect(page.locator("#toast")).toHaveText("Enter your reviewer name first");

  await page.fill("#reviewer", "Test Reviewer");
  await card.locator("textarea").fill("Checked against label");
  await card.getByRole("button", { name: "Verify" }).click();
  await page.selectOption("#review-filter", "decided");
  await expect(page.locator(".review-card")).toHaveCount(1);
  await expect(page.locator(".review-card .decision")).toContainText("verified by Test Reviewer");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export decisions (CSV)" }).click();
  const download = await downloadPromise;
  const rows = rowsToObjects(parseCsv(await readFile(await download.path(), "utf8")));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    id: "sitagliptin:ORAL",
    decision: "verified",
    reviewer: "Test Reviewer",
    notes: "Checked against label",
  });
  expect(rows[0].review_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  await page.reload();
  await page.selectOption("#review-filter", "decided");
  await expect(page.locator(".review-card")).toHaveCount(1);
});
