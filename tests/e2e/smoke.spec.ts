import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Shelfwise/);
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
});
