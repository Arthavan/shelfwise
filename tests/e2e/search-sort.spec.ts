// F8 Search and sort (AC-28 .. AC-30). No test ids needed.
import { expect, test } from "@playwright/test";
import { allCards, card, resetData } from "./helpers";

test.describe("Search and sort", () => {
  test.beforeEach(async ({ request }) => {
    await resetData(request, "demo");
  });

  test("AC-28: searching 'tolkien' syncs ?q= and leaves only The Hobbit", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search books" }).fill("tolkien");
    await expect(page).toHaveURL(/q=tolkien/);
    await expect(allCards(page)).toHaveCount(1);
    await expect(card(page, "The Hobbit")).toBeVisible();
  });

  test("AC-29: a search with no matches shows the empty message and 'Clear search' restores all 12 cards", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search books" }).fill("zzzz");
    await expect(page.getByText('No books match "zzzz"')).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(allCards(page)).toHaveCount(12);
    await expect(page).toHaveURL((url) => !url.searchParams.has("q"));
  });

  test("AC-30: sorting by 'Title (A–Z)' syncs ?sort=title and orders the cards alphabetically", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Sort by" }).selectOption({ label: "Title (A–Z)" });
    await expect(page).toHaveURL(/sort=title/);
    await expect(allCards(page).first()).toContainText("A Wizard of Earthsea");
    await expect(allCards(page).last()).toContainText("The Remains of the Day");
  });
});
