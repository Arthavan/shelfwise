// F4 Rate finished books (AC-13 .. AC-16). No test ids needed.
import { expect, test } from "@playwright/test";
import { card, openDetail, resetData, setStatus, toast } from "./helpers";

test.describe("Rate finished books", () => {
  test.beforeEach(async ({ request }) => {
    await resetData(request, "demo");
  });

  test("AC-13: rating an unrated finished book with 4 stars toasts, shows 'Rated 4 out of 5' and survives a reload", async ({ page }) => {
    await page.goto("/");
    await setStatus(page, "Middlemarch", "Finished");
    await expect(toast(page, "Marked as finished")).toBeVisible();

    const middlemarch = card(page, "Middlemarch");
    await expect(middlemarch.getByText("Not rated")).toBeVisible();
    await middlemarch.getByRole("button", { name: "Rate 4 stars" }).click();

    await expect(toast(page, "Rated 4 out of 5")).toBeVisible();
    await expect(middlemarch.getByRole("img", { name: "Rated 4 out of 5" })).toBeVisible();

    await page.reload();
    await expect(card(page, "Middlemarch").getByRole("img", { name: "Rated 4 out of 5" })).toBeVisible();
  });

  test("AC-14: Piranesi (Want to read) has no rating controls on its card or detail page", async ({ page }) => {
    await page.goto("/");
    const piranesi = card(page, "Piranesi");
    await expect(piranesi).toBeVisible();
    await expect(piranesi.getByRole("button", { name: "Rate 1 star" })).toHaveCount(0);
    await expect(piranesi.getByText("Rate this book")).toHaveCount(0);

    await openDetail(page, "Piranesi");
    await expect(page.getByRole("button", { name: "Rate 1 star" })).toHaveCount(0);
    await expect(page.getByText("Rate this book")).toHaveCount(0);
  });

  test("AC-15: 'Clear rating' on The Hobbit replaces 'Rated 5 out of 5' with 'Not rated'", async ({ page }) => {
    await openDetail(page, "The Hobbit");
    await expect(page.getByRole("img", { name: "Rated 5 out of 5" })).toBeVisible();
    await page.getByRole("button", { name: "Clear rating" }).click();
    await expect(page.getByRole("img", { name: "Rated 5 out of 5" })).toHaveCount(0);
    await expect(page.getByText("Not rated")).toBeVisible();
  });

  test("AC-16: leaving Finished and coming back clears Dune's rating", async ({ page }) => {
    await openDetail(page, "Dune");
    await expect(page.getByRole("img", { name: "Rated 4 out of 5" })).toBeVisible();

    await setStatus(page, "Dune", "Reading");
    await expect(toast(page, "Moved to Reading")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Status for Dune" })).toHaveValue("reading");

    await setStatus(page, "Dune", "Finished");
    await expect(toast(page, "Marked as finished")).toBeVisible();
    await expect(page.getByText("Not rated")).toBeVisible();
    await expect(page.getByRole("img", { name: "Rated 4 out of 5" })).toHaveCount(0);
  });
});
