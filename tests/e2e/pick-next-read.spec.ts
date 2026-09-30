// F12 Pick my next read (AC-36). No test ids needed.
import { expect, test } from "@playwright/test";
import { resetData, tab, toast } from "./helpers";

test("AC-36: 'Pick my next read' offers a Want to read book and 'Start reading' moves it to Reading", async ({ page, request }) => {
  await resetData(request, "demo");
  await page.goto("/");
  await tab(page, "Want to read", 3).click();
  await expect(page).toHaveURL(/status=want/);

  await page.getByRole("button", { name: "Pick my next read" }).click();
  const dialog = page.getByRole("dialog", { name: "Your next read" });
  await expect(dialog).toBeVisible();
  const picked = (await dialog.getByRole("heading", { level: 3 }).textContent())?.trim() ?? "";
  expect(["Piranesi", "The Overstory", "Braiding Sweetgrass"]).toContain(picked);

  await dialog.getByRole("button", { name: "Start reading" }).click();
  await expect(toast(page, "Moved to Reading")).toBeVisible();
  await expect(tab(page, "Want to read", 2)).toBeVisible();
});
