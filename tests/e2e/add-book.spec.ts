// F1 Add a book (AC-1 .. AC-5). No test ids needed.
import { expect, test } from "@playwright/test";
import { allCards, isLibraryUrl, resetData, toast } from "./helpers";

test.describe("Add a book", () => {
  test.beforeEach(async ({ request }) => {
    await resetData(request, "demo");
  });

  test("AC-1: 'Add book' opens /books/new with Title, Author, Status, Pages and Notes fields", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Add book" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/books/new");
    await expect(page.getByRole("textbox", { name: "Title" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Author" })).toBeVisible();
    const status = page.getByRole("combobox", { name: "Status", exact: true });
    await expect(status).toBeVisible();
    await expect(status).toHaveValue("want"); // option label "Want to read"
    await expect(status.getByRole("option", { name: "Want to read" })).toBeAttached();
    await expect(page.getByRole("textbox", { name: "Pages" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Notes" })).toBeVisible();
  });

  test("AC-2: saving an empty form shows 'Title is required' and 'Author is required'", async ({ page }) => {
    await page.goto("/books/new");
    await page.getByRole("button", { name: "Save book" }).click();
    await expect(page.getByText("Title is required")).toBeVisible();
    await expect(page.getByText("Author is required")).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === "/books/new");
  });

  test("AC-3: saving a valid Reading book returns to the library with a 'Book added' toast and the new card first", async ({ page }) => {
    await page.goto("/books/new");
    await page.getByRole("textbox", { name: "Title" }).fill("The Left Hand of Darkness");
    await page.getByRole("textbox", { name: "Author" }).fill("Ursula K. Le Guin");
    await page.getByRole("combobox", { name: "Status", exact: true }).selectOption({ label: "Reading" });
    await page.getByRole("button", { name: "Save book" }).click();

    await expect(page).toHaveURL(isLibraryUrl);
    await expect(toast(page, "Book added")).toBeVisible();
    const first = allCards(page).first();
    await expect(first).toContainText("The Left Hand of Darkness");
    await expect(first).toContainText("Ursula K. Le Guin");
    await expect(first.getByRole("combobox", { name: "Status for The Left Hand of Darkness" })).toHaveValue("reading");
  });

  test("AC-4: Pages '0' shows 'Pages must be a positive whole number' and stays on the form", async ({ page }) => {
    await page.goto("/books/new");
    await page.getByRole("textbox", { name: "Title" }).fill("Pages Validation Book");
    await page.getByRole("textbox", { name: "Author" }).fill("Some Author");
    await page.getByRole("textbox", { name: "Pages" }).fill("0");
    await page.getByRole("button", { name: "Save book" }).click();
    await expect(page.getByText("Pages must be a positive whole number")).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === "/books/new");
  });

  test("AC-5: the Rating group appears only while Status is Finished", async ({ page }) => {
    await page.goto("/books/new");
    const status = page.getByRole("combobox", { name: "Status", exact: true });
    const rating = page.getByRole("group", { name: "Rating" });
    await expect(rating).toHaveCount(0);

    await status.selectOption({ label: "Finished" });
    await expect(rating).toBeVisible();
    for (let n = 1; n <= 5; n++) {
      await expect(rating.getByRole("button", { name: n === 1 ? "Rate 1 star" : `Rate ${n} stars` })).toBeVisible();
    }

    await status.selectOption({ label: "Want to read" });
    await expect(rating).toHaveCount(0);
  });
});
