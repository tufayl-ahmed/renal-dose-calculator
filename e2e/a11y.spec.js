import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures.js";

const pages = [
  { name: "landing", path: "/" },
  { name: "calculator with results", path: "/app/", setup: true },
  { name: "review page", path: "/review.html" },
];

for (const scheme of ["light", "dark"]) {
  for (const target of pages) {
    test(`${target.name} has no accessibility violations (${scheme})`, async ({ page, api: _api }) => {
      // Check settled colours: mid-animation opacity would skew contrast.
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(target.path);
      if (target.setup) {
        await page.locator(".example-chip").nth(1).click();
        await expect(page.locator(".dose-card .badge")).toHaveCount(2);
        await page.locator(".dose-more summary").first().click();
      }
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const summary = results.violations.map(
        (violation) =>
          `${violation.id}: ${violation.help} (${violation.nodes.length}) → ${violation.nodes
            .slice(0, 3)
            .map((node) => node.target.join(" "))
            .join(" | ")}`
      );
      expect(summary).toEqual([]);
    });
  }
}
