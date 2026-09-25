import { expect, test } from "./fixtures.js";

test("landing page leads into the calculator", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Renal dosing");
  await page.getByRole("link", { name: "Start a dose check" }).first().click();
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.locator("#renal-form")).toBeVisible();
});

test("Telegram launches and shared links skip the landing page", async ({ page }) => {
  await page.goto("/?telegram=1");
  await expect(page).toHaveURL(/\/app\/\?telegram=1$/);

  await page.goto("/#c=abc");
  await expect(page).toHaveURL(/\/app\/#c=abc$/);
});

test("example patients in the empty state run a check", async ({ page, api: _api }) => {
  await page.goto("/app/");
  await page.locator(".example-chip").first().click();
  await expect(page.locator("#age")).toHaveValue("72");
  await expect(page.locator(".dose-card")).toHaveCount(2);
  await expect(page.locator(".dose-card .badge").first()).toBeVisible();
});
