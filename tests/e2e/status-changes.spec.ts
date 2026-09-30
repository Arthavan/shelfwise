// F3 Quick status changes (AC-10 .. AC-12). No test ids needed.
import { expect, test } from "@playwright/test";
import { card, openDetail, resetData, setStatus, tab, todayMedium, toast } from "./helpers";

test.describe("Quick status changes", () => {
  test.beforeEach(async ({ request }) => {
    await resetData(request, "demo");
  });

  test("AC-10: moving Piranesi to Reading toasts, updates the card and the tab counts", async ({ page }) => {
    await page.goto("/");
    await setStatus(page, "Piranesi", "Reading");
    await expect(toast(page, "Moved to Reading")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Status for Piranesi" })).toHaveValue("reading");
    await expect(tab(page, "Want to read", 2)).toBeVisible();
    await expect(tab(page, "Reading", 3)).toBeVisible();
  });

  test("AC-11: marking Middlemarch Finished toasts and offers 'Rate this book' with 'Rate 5 stars'", async ({ page }) => {
    await page.goto("/");
    await setStatus(page, "Middlemarch", "Finished");
    await expect(toast(page, "Marked as finished")).toBeVisible();
    const middlemarch = card(page, "Middlemarch");
    await expect(middlemarch.getByText("Rate this book")).toBeVisible();
    await expect(middlemarch.getByRole("button", { name: "Rate 5 stars" })).toBeVisible();
  });

  test("AC-12: a book finished today shows today's date on 'Finished on'", async ({ page }) => {
    await page.goto("/");
    await setStatus(page, "Middlemarch", "Finished");
    await expect(toast(page, "Marked as finished")).toBeVisible();
    await openDetail(page, "Middlemarch");
    await expect(page.getByText(`Finished on ${todayMedium()}`)).toBeVisible();
  });
});
