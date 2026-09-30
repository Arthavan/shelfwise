import { expect, test } from "@playwright/test";

import { makePdf, numberedPages } from "./fixtures/make-pdf";
import { openDetail, openReader, resetData, toast, uploadPdf } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetData(request, "demo");
});

test("a book without a file offers Upload, and the file shows after attaching", async ({ page }) => {
  await openDetail(page, "The Hobbit");
  await expect(page.getByRole("link", { name: /^(Read|Continue reading)/ })).toHaveCount(0);
  await uploadPdf(page, numberedPages(3));
  await expect(page.getByText("sample.pdf")).toBeVisible();
  await expect(page.getByRole("link", { name: "Read", exact: true })).toBeVisible();
});

test("rejects a non-PDF file with a clear message", async ({ page }) => {
  await openDetail(page, "The Hobbit");
  await page.getByTestId("book-file-input").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("just some text") });
  await expect(toast(page, "That file isn't a PDF or EPUB")).toBeVisible();
  await expect(page.getByRole("link", { name: "Read", exact: true })).toHaveCount(0);
});

test("can remove the file", async ({ page }) => {
  await openDetail(page, "The Hobbit");
  await uploadPdf(page, numberedPages(4));
  await page.getByRole("button", { name: "Remove file" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(toast(page, "File removed")).toBeVisible();
  await expect(page.getByRole("link", { name: "Read", exact: true })).toHaveCount(0);
});

test("the file route serves byte ranges", async ({ page, request }) => {
  await openDetail(page, "The Hobbit");
  await uploadPdf(page, numberedPages(2));
  const id = page.url().split("/books/")[1];
  const full = await request.get(`/api/books/${id}/file`);
  expect(full.status()).toBe(200);
  expect(full.headers()["content-type"]).toBe("application/pdf");
  const part = await request.get(`/api/books/${id}/file`, { headers: { Range: "bytes=0-4" } });
  expect(part.status()).toBe(206);
  expect((await part.body()).toString()).toBe("%PDF-");
  const bad = await request.get(`/api/books/${id}/file`, { headers: { Range: "bytes=999999999-" } });
  expect(bad.status()).toBe(416);
  expect(makePdf(["x"]).length).toBeGreaterThan(0);
});

test("replacing a file that has bookmarks asks first: cancel keeps it, confirm replaces it", async ({ page }) => {
  await openReader(page, 3);
  await page.getByRole("button", { name: "Add bookmark" }).click();
  await expect(page.getByRole("button", { name: "Remove bookmark", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Back to book" }).click();
  await expect(page.getByText("sample.pdf")).toBeVisible();

  const input = page.getByTestId("book-file-input");
  const replacement = { name: "other.pdf", mimeType: "application/pdf", buffer: makePdf(["New one", "New two"]) };
  const dialog = page.getByRole("alertdialog", { name: "Replace this file?" });

  await input.setInputFiles(replacement);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("bookmarks and highlights");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("sample.pdf")).toBeVisible();

  await input.setInputFiles(replacement);
  await dialog.getByRole("button", { name: "Replace file" }).click();
  await expect(toast(page, "File attached")).toBeVisible();
  await expect(page.getByText("other.pdf")).toBeVisible();
  await expect(page.getByText("sample.pdf")).toHaveCount(0);

  // The new file starts fresh, so replacing it again needs no confirmation.
  await input.setInputFiles({ ...replacement, name: "third.pdf" });
  await expect(page.getByText("third.pdf")).toBeVisible();
  await expect(dialog).toHaveCount(0);
});
