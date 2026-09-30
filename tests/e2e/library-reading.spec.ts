import { expect, test, type Page } from "@playwright/test";

import { numberedPages } from "./fixtures/make-pdf";
import { card, openDetail, openReader, resetData, toast, uploadPdf } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetData(request, "demo");
});

function continueRegion(page: Page) {
  return page.getByRole("region", { name: "Continue reading", exact: true });
}

/** Opens the book's reader, turns to `pageNo`, and goes back (Back flushes the progress save). */
async function readTo(page: Page, pageNo: number) {
  for (let i = 1; i < pageNo; i++) await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue(String(pageNo));
  await page.getByRole("link", { name: "Back to book" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("without files the library shows no reading UI", async ({ page }) => {
  await page.goto("/");
  await expect(card(page, "Piranesi")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Continue reading" })).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Read", exact: true })).toHaveCount(0);
});

test("a book read part-way shows progress, a Continue row and resumes", async ({ page }) => {
  await openReader(page);
  await readTo(page, 3);
  await page.goto("/");
  const region = continueRegion(page);
  await expect(region).toBeVisible();
  await expect(region.getByText("Piranesi")).toBeVisible();
  await expect(region.getByRole("link", { name: "Continue", exact: true })).toHaveAttribute("href", /\/books\/[^/]+\/read$/);
  await expect(card(page, "Piranesi").getByRole("progressbar", { name: "Reading progress" })).toHaveAttribute("aria-valuenow", "60");
  await card(page, "Piranesi").getByRole("link", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("3");
});

test("a book with a file but no progress offers Read and no Continue row entry", async ({ page }) => {
  await openDetail(page, "Piranesi");
  await uploadPdf(page, numberedPages(5));
  await page.goto("/");
  await expect(card(page, "Piranesi").getByRole("link", { name: "Read", exact: true })).toBeVisible();
  await expect(card(page, "Piranesi").getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Continue reading" })).toHaveCount(0);
});

test("finished books stay out of the row and the row is ordered by most recently read", async ({ page }) => {
  await openDetail(page, "The Hobbit");
  await uploadPdf(page, numberedPages(5));
  await page.goto("/");
  await expect(card(page, "The Hobbit").getByRole("link", { name: "Read", exact: true })).toBeVisible();
  await card(page, "The Hobbit").getByRole("link", { name: "Read", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("1");
  await expect(page.locator(".textLayer span").first()).toBeVisible();
  await readTo(page, 2);

  await openReader(page, 5, "Piranesi");
  await readTo(page, 2);
  await openReader(page, 5, "The Overstory");
  await readTo(page, 2);

  await page.goto("/");
  const region = continueRegion(page);
  await expect(region.getByText("The Hobbit")).toHaveCount(0);
  const titles = region.getByRole("listitem").locator("[data-continue-title]");
  await expect(titles).toHaveText(["The Overstory", "Piranesi"]);
  await expect(card(page, "The Hobbit").getByRole("link", { name: "Continue", exact: true })).toBeVisible();

  await page.goto("/?q=Piranesi");
  await expect(page.getByRole("heading", { name: "Continue reading" })).toHaveCount(0);
});

test("Settings shows storage used and Delete all books removes the files", async ({ page, request }) => {
  await openDetail(page, "Piranesi");
  await uploadPdf(page, numberedPages(5));
  const id = page.url().split("/books/")[1];
  expect((await request.get(`/api/books/${id}/file`)).status()).toBe(200);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Book files" })).toBeVisible();
  await expect(page.getByText(/Storage used: [1-9][\d.]* (KB|MB)/)).toBeVisible();

  await page.getByRole("button", { name: "Delete all books" }).click();
  await page.getByRole("alertdialog", { name: "Delete all books?" }).getByRole("button", { name: "Delete all" }).click();
  await expect(toast(page, "All books deleted")).toBeVisible();
  expect((await request.get(`/api/books/${id}/file`)).status()).toBe(404);
  await page.goto("/settings");
  await expect(page.getByText("Storage used: 0 B")).toBeVisible();
});
