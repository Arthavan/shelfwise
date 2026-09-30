// F10 Theme, responsive layout and system states (AC-33, AC-34). No test ids needed.
import { expect, test } from "@playwright/test";
import { resetData } from "./helpers";

test.describe("Theme", () => {
  test.use({ colorScheme: "light" });

  test("AC-33: 'Toggle theme' switches to dark and the choice survives a reload", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.setItem("theme", "light"));
    await page.reload();
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/\bdark\b/);

    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(html).toHaveClass(/\bdark\b/);

    await page.reload();
    await expect(page.getByRole("button", { name: "Toggle theme" })).toBeVisible();
    await expect(html).toHaveClass(/\bdark\b/);
  });
});

test.describe("Responsive layout at 375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("AC-34: / and /stats have no horizontal scroll and keep the nav links visible", async ({ page, request }) => {
    await resetData(request, "demo");
    for (const [path, heading] of [
      ["/", "Library"],
      ["/stats", "Stats"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
      const nav = page.getByRole("navigation", { name: "Main" });
      await expect(nav.getByRole("link", { name: "Library", exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Stats", exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `${path} scrollWidth`).toBeLessThanOrEqual(375);
    }
  });
});
