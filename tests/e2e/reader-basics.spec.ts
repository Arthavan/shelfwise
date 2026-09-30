import { expect, test } from "@playwright/test";

import { numberedPages } from "./fixtures/make-pdf";
import { openDetail, resetData, uploadPdf } from "./helpers";

async function openReader(page: import("@playwright/test").Page, pages = 5) {
  await openDetail(page, "Piranesi");
  await uploadPdf(page, numberedPages(pages));
  await page.getByRole("link", { name: "Read", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("1");
}

test.beforeEach(async ({ request }) => {
  await resetData(request, "demo");
});

test("renders the first page text and turns pages with buttons and keys", async ({ page }) => {
  await openReader(page);
  await expect(page.getByText("Page 1 marker")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 marker")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("3");
  await page.keyboard.press("PageUp");
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("2");
  await page.getByRole("textbox", { name: "Page" }).fill("5");
  await page.getByRole("textbox", { name: "Page" }).press("Enter");
  await expect(page.getByText("Page 5 marker")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
});

test("resumes where you left off after a reload and from the detail page", async ({ page }) => {
  await openReader(page);
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 3 marker")).toBeVisible();
  await page.waitForTimeout(1500); // debounce
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("3");
  await page.getByRole("link", { name: "Back to book" }).click();
  await expect(page.getByRole("link", { name: /Continue reading \(p\. 3 of 5/ })).toBeVisible();
});

test("going back right after a page turn shows the new position on the detail page", async ({ page }) => {
  await openReader(page);
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("3");
  await page.getByRole("link", { name: "Back to book" }).click(); // no debounce wait
  await expect(page.getByRole("link", { name: /Continue reading \(p\. 3 of 5/ })).toBeVisible();
});

test("first open moves a Want to read book to Reading", async ({ page }) => {
  await openReader(page);
  await page.getByRole("link", { name: "Back to book" }).click();
  await expect(page.getByRole("combobox", { name: "Status for Piranesi" })).toHaveValue("reading");
});

test("offers Mark as finished on the last page and never applies it silently", async ({ page }) => {
  await openReader(page, 2);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("button", { name: "Mark as finished" })).toBeVisible();
  await page.getByRole("link", { name: "Back to book" }).click();
  await expect(page.getByRole("combobox", { name: "Status for Piranesi" })).toHaveValue("reading");
});

test("an unreadable PDF shows a clear message with a re-upload path", async ({ page }) => {
  await openDetail(page, "Piranesi");
  const truncated = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"); // valid magic, no pages
  await page.getByTestId("book-file-input").setInputFiles({ name: "broken.pdf", mimeType: "application/pdf", buffer: truncated });
  await page.getByRole("link", { name: "Read", exact: true }).click();
  // Next's route announcer is also role="alert", so pick ours by its text.
  await expect(page.getByRole("alert").filter({ hasText: "couldn't open this file" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to book" })).toBeVisible();
});
