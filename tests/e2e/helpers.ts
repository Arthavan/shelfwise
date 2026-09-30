/*
 * Shared helpers for the Shelfwise acceptance tests.
 *
 * data-testid values relied on (ARCHITECTURE.md D15; no visible hook exists for them):
 *   - stat-value : the value element inside each /stats stat card (region named by the card title)
 *
 * State contract: every test that depends on data starts with resetData(request, "demo" | "empty"),
 * which calls the guarded POST /api/test/reset hook (ARCHITECTURE.md §6.3). Workers = 1.
 */
import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { makePdf, numberedPages } from "./fixtures/make-pdf";

export type ResetMode = "demo" | "empty";

export async function resetData(request: APIRequestContext, mode: ResetMode): Promise<void> {
  const res = await request.post("/api/test/reset", { data: { mode } });
  expect(res.ok(), `POST /api/test/reset {mode: ${mode}} should succeed`).toBeTruthy();
}

/** Today in en-US medium format, e.g. "Sep 30, 2026". */
export function todayMedium(): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date());
}

/** Current month as the chart labels it, e.g. "Sep 2026". */
export function currentMonthLabel(): string {
  const now = new Date();
  const mon = new Intl.DateTimeFormat("en-US", { month: "short" }).format(now);
  return `${mon} ${now.getFullYear()}`;
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function isLibraryUrl(url: URL): boolean {
  return url.pathname === "/";
}

/** The list of book cards on the library page. */
export function bookList(page: Page): Locator {
  return page.getByRole("list", { name: "Books" });
}

/** Every book card on the library page. */
export function allCards(page: Page): Locator {
  return bookList(page).getByRole("article");
}

/** One book card, found by its title. */
export function card(page: Page, title: string): Locator {
  return page.getByRole("article", { name: title, exact: true });
}

/** A status tab, e.g. tab(page, "Reading") matches "Reading · 2". */
export function tab(page: Page, label: "All" | "Want to read" | "Reading" | "Finished", count?: number): Locator {
  if (count !== undefined) {
    return page.getByRole("tab", { name: `${label} · ${count}`, exact: true });
  }
  return page.getByRole("tab", { name: new RegExp(`^${label} · \\d+$`) });
}

export function toast(page: Page, text: string): Locator {
  return page.getByText(text, { exact: true });
}

/** From the library, open a book's detail page by clicking its card title. */
export async function openDetail(page: Page, title: string): Promise<void> {
  await page.goto("/");
  await card(page, title).getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
}

export async function setStatus(page: Page, title: string, label: "Want to read" | "Reading" | "Finished"): Promise<void> {
  await page.getByRole("combobox", { name: `Status for ${title}`, exact: true }).selectOption({ label });
}

export interface NewBook {
  title: string;
  author: string;
  status?: "Want to read" | "Reading" | "Finished";
  pages?: string;
  notes?: string;
}

/** Add a book through the form and wait until we are back on the library. */
export async function addBook(page: Page, book: NewBook): Promise<void> {
  await page.goto("/books/new");
  await page.getByRole("textbox", { name: "Title" }).fill(book.title);
  await page.getByRole("textbox", { name: "Author" }).fill(book.author);
  if (book.status) {
    await page.getByRole("combobox", { name: "Status", exact: true }).selectOption({ label: book.status });
  }
  if (book.pages) await page.getByRole("textbox", { name: "Pages" }).fill(book.pages);
  if (book.notes) await page.getByRole("textbox", { name: "Notes" }).fill(book.notes);
  await page.getByRole("button", { name: "Save book" }).click();
  await expect(page).toHaveURL(isLibraryUrl);
  await expect(toast(page, "Book added")).toBeVisible();
}

/** Numeric value of a /stats card ("2,210" -> 2210). */
export async function statNumber(page: Page, cardName: string): Promise<number> {
  const value = page.getByRole("region", { name: cardName, exact: true }).getByTestId("stat-value");
  await expect(value).toBeVisible();
  const text = (await value.textContent()) ?? "";
  return Number(text.replace(/,/g, "").trim());
}

/** On a book detail page: attach a generated PDF through the file input and wait for confirmation. */
export async function uploadPdf(page: Page, pages: string[], name = "sample.pdf"): Promise<void> {
  await page.getByTestId("book-file-input").setInputFiles({ name, mimeType: "application/pdf", buffer: makePdf(pages) });
  await expect(toast(page, "File attached")).toBeVisible();
}

/** Piranesi (Want to read in the demo data): attach a numbered-page PDF and open the reader on it. */
export async function openReader(page: Page, pages: number | string[] = 5, title = "Piranesi"): Promise<void> {
  await openDetail(page, title);
  await uploadPdf(page, typeof pages === "number" ? numberedPages(pages) : pages);
  await page.getByRole("link", { name: "Read", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveValue("1");
}
