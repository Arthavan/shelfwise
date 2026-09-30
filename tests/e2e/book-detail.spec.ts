// F6 Book detail and edit (AC-22 .. AC-24). No test ids needed.
import { expect, test } from "@playwright/test";
import { card, isLibraryUrl, openDetail, resetData, toast } from "./helpers";

test.describe("Book detail and edit", () => {
  test.beforeEach(async ({ request }) => {
    await resetData(request, "demo");
  });

  test("AC-22: clicking the 'Circe' card title opens its detail page", async ({ page }) => {
    await page.goto("/");
    await card(page, "Circe").getByRole("link", { name: "Circe", exact: true }).click();
    await expect(page).toHaveURL((url) => /^\/books\/[^/]+$/.test(url.pathname));
    await expect(page.getByRole("heading", { level: 1, name: "Circe", exact: true })).toBeVisible();
    await expect(page.getByText("Madeline Miller", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Status for Circe" })).toHaveValue("finished");
    await expect(page.getByText("Added on")).toBeVisible();
  });

  test("AC-23: editing Circe's title saves, toasts 'Changes saved' and returns to the detail page", async ({ page }) => {
    await openDetail(page, "Circe");
    const detailPath = new URL(page.url()).pathname;
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === `${detailPath}/edit`);

    const title = page.getByRole("textbox", { name: "Title" });
    await expect(title).toHaveValue("Circe");
    await title.fill("Circe (Reread)");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page).toHaveURL((url) => url.pathname === detailPath);
    await expect(toast(page, "Changes saved")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Circe (Reread)", exact: true })).toBeVisible();
  });

  test("AC-24: an unknown book id shows 'Book not found' and 'Back to library' returns to /", async ({ page }) => {
    await page.goto("/books/does-not-exist");
    await expect(page.getByRole("heading", { name: "Book not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to library" }).click();
    await expect(page).toHaveURL(isLibraryUrl);
  });
});
