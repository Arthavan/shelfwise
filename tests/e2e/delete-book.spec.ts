// F7 Delete with confirmation and undo (AC-25 .. AC-27). No test ids needed.
import { expect, test } from "@playwright/test";
import { allCards, card, isLibraryUrl, openDetail, resetData, toast } from "./helpers";

async function openDeleteDialog(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: 'Delete "Educated"?' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Delete with confirmation and undo", () => {
  test.beforeEach(async ({ request }) => {
    await resetData(request, "demo");
  });

  test("AC-25: cancelling the delete dialog keeps the book", async ({ page }) => {
    await openDetail(page, "Educated");
    const dialog = await openDeleteDialog(page);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Educated", exact: true })).toBeVisible();
  });

  test("AC-26: confirming delete returns to / with a 'Book deleted' toast, an 'Undo' button and no Educated card", async ({ page }) => {
    await openDetail(page, "Educated");
    const dialog = await openDeleteDialog(page);
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page).toHaveURL(isLibraryUrl);
    await expect(toast(page, "Book deleted")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(allCards(page)).toHaveCount(11);
    await expect(card(page, "Educated")).toHaveCount(0);
  });

  test("AC-27: 'Undo' restores Educated with its Finished status and 3-star rating", async ({ page }) => {
    await openDetail(page, "Educated");
    const dialog = await openDeleteDialog(page);
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(toast(page, "Book deleted")).toBeVisible();
    await expect(card(page, "Educated")).toHaveCount(0);

    await page.getByRole("button", { name: "Undo" }).click();

    const educated = card(page, "Educated");
    await expect(educated).toBeVisible();
    await expect(educated.getByRole("combobox", { name: "Status for Educated" })).toHaveValue("finished");
    await expect(educated.getByRole("img", { name: "Rated 3 out of 5" })).toBeVisible();
  });
});
