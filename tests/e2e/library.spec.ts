// F2 Library with status tabs (AC-6 .. AC-9). No test ids needed.
import { expect, test } from "@playwright/test";
import { addBook, allCards, card, resetData, tab } from "./helpers";

test.describe("Library with status tabs", () => {
  test("AC-6: demo data shows 12 cards and the tab counts 12 / 3 / 2 / 7", async ({ page, request }) => {
    await resetData(request, "demo");
    await page.goto("/");
    await expect(allCards(page)).toHaveCount(12);
    await expect(tab(page, "All", 12)).toBeVisible();
    await expect(tab(page, "Want to read", 3)).toBeVisible();
    await expect(tab(page, "Reading", 2)).toBeVisible();
    await expect(tab(page, "Finished", 7)).toBeVisible();
  });

  test("AC-7: the Finished tab filters to 7 cards and updates the URL", async ({ page, request }) => {
    await resetData(request, "demo");
    await page.goto("/");
    await tab(page, "Finished", 7).click();
    await expect(page).toHaveURL(/status=finished/);
    await expect(allCards(page)).toHaveCount(7);
    await expect(card(page, "The Hobbit")).toBeVisible();
    await expect(card(page, "Piranesi")).toHaveCount(0);
  });

  test("AC-8: an empty library shows 'Your shelf is empty' and 'Add your first book' opens the form", async ({ page, request }) => {
    await resetData(request, "empty");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your shelf is empty" })).toBeVisible();
    await page.getByRole("link", { name: "Add your first book" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/books/new");
  });

  test("AC-9: an empty tab shows 'No books in Reading'", async ({ page, request }) => {
    await resetData(request, "empty");
    await addBook(page, { title: `Tab Test ${Date.now()}`, author: "Tab Author", status: "Want to read" });
    await tab(page, "Reading").click();
    await expect(page).toHaveURL(/status=reading/);
    await expect(page.getByText("No books in Reading")).toBeVisible();
  });
});
