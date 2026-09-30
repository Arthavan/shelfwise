// F9 Demo data and settings (AC-31, AC-32). No test ids needed.
import { expect, test } from "@playwright/test";
import { allCards, card, resetData, toast } from "./helpers";

test.describe("Demo data and settings", () => {
  test("AC-31: 'Delete all books' with confirmation empties the library", async ({ page, request }) => {
    await resetData(request, "demo");
    await page.goto("/settings");
    await page.getByRole("button", { name: "Delete all books" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Delete all books?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete all" }).click();

    await expect(toast(page, "All books deleted")).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your shelf is empty" })).toBeVisible();
  });

  test("AC-32: 'Restore demo data' with confirmation brings back the 12 demo books", async ({ page, request }) => {
    await resetData(request, "empty");
    await page.goto("/settings");
    await page.getByRole("button", { name: "Restore demo data" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Restore demo data?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Restore", exact: true }).click();

    await expect(toast(page, "Demo data restored")).toBeVisible();
    await page.goto("/");
    await expect(allCards(page)).toHaveCount(12);
    await expect(card(page, "The Hobbit")).toBeVisible();
  });
});
