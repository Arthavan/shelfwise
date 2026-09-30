/*
 * F11 Yearly reading goal (AC-35).
 * data-testid used (ARCHITECTURE.md D15):
 *   - stat-value : value element inside each stat card (region named by its title)
 */
import { expect, test } from "@playwright/test";
import { currentYear, resetData, statNumber } from "./helpers";

test("AC-35: setting a goal of 24 shows '{n} of 24 books' and a progressbar with aria-valuemax 24", async ({ page, request }) => {
  await resetData(request, "demo");
  await page.goto("/stats");
  const finishedThisYear = await statNumber(page, "Finished this year");

  await page.getByRole("button", { name: "Set goal" }).click();
  const dialog = page.getByRole("dialog", { name: `Reading goal ${currentYear()}` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Books this year" }).fill("24");
  await dialog.getByRole("button", { name: "Save goal" }).click();
  await expect(dialog).toHaveCount(0);

  const goal = page.getByRole("region", { name: `Reading goal ${currentYear()}` });
  await expect(goal).toBeVisible();
  await expect(goal.getByText(`${finishedThisYear} of 24 books`)).toBeVisible();
  const bar = goal.getByRole("progressbar");
  await expect(bar).toHaveAttribute("aria-valuemax", "24");
  await expect(bar).toHaveAttribute("aria-valuenow", String(finishedThisYear));
});
