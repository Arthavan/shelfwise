import { expect, test, type Page } from "@playwright/test";

import { makeEpub } from "./fixtures/make-epub";
import { openDetail, resetData, toast } from "./helpers";

const CHAPTERS = [
  { title: "One", body: "Alpha chapter text" },
  { title: "Two", body: "Beta chapter text" },
  { title: "Three", body: "Gamma" },
];

const frame = (page: Page) => page.frameLocator("iframe");
const panel = (page: Page) => page.getByRole("complementary");
const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Search in book" });

/** Piranesi (Want to read in the demo data): attach a generated EPUB and open the reader on it. */
async function openEpub(page: Page, buffer = makeEpub(CHAPTERS)) {
  await openDetail(page, "Piranesi");
  await page.getByTestId("book-file-input").setInputFiles({ name: "sample.epub", mimeType: "application/epub+zip", buffer });
  await expect(toast(page, "File attached")).toBeVisible();
  await expect(page.getByText("sample.epub")).toBeVisible();
  await page.getByRole("link", { name: "Read", exact: true }).click();
  await expect(frame(page).getByText("Alpha chapter text")).toBeVisible();
}

async function openPanelTab(page: Page, name: "Contents" | "Bookmarks" | "Highlights") {
  if ((await panel(page).count()) === 0) await page.getByRole("button", { name: "Toggle side panel" }).click();
  await panel(page).getByRole("tab", { name }).click();
}

test.beforeEach(async ({ request }) => {
  await resetData(request, "demo");
});

test("opens an EPUB, turns pages with buttons and keys, and marks the book as Reading", async ({ page }) => {
  await openEpub(page);
  // EPUB toolbar: no page field and no zoom, a percent readout and text size instead.
  await expect(page.getByRole("textbox", { name: "Page" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Zoom in" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Larger text" })).toBeVisible();
  await expect(page.getByTestId("reader-percent")).toBeVisible();

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(frame(page).getByText("Beta chapter text")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(frame(page).getByText("Alpha chapter text")).toBeVisible();
  // Key presses inside the book's iframe turn pages too.
  await frame(page).getByText("Alpha chapter text").click();
  await page.keyboard.press("ArrowRight");
  await expect(frame(page).getByText("Beta chapter text")).toBeVisible();

  await page.getByRole("link", { name: "Back to book" }).click();
  await expect(page.getByRole("combobox", { name: "Status for Piranesi" })).toHaveValue("reading");
});

test("resumes at the same chapter after a reload and shows the percent on the detail page", async ({ page }) => {
  await openEpub(page);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(frame(page).getByText("Beta chapter text")).toBeVisible();
  await expect(page.getByTestId("reader-percent")).not.toHaveText("0%");
  await page.waitForTimeout(1500); // debounce
  await page.reload();
  await expect(frame(page).getByText("Beta chapter text")).toBeVisible();
  await expect(frame(page).getByText("Alpha chapter text")).toHaveCount(0);
  await page.getByRole("link", { name: "Back to book" }).click();
  const link = page.getByRole("link", { name: /^Continue reading \(\d+%\)$/ });
  await expect(link).toBeVisible();
  const percent = Number(/\((\d+)%\)/.exec((await link.textContent()) ?? "")?.[1]);
  expect(percent).toBeGreaterThan(0);
});

test("the Contents tab lists the chapters and jumps to one", async ({ page }) => {
  await openEpub(page);
  await openPanelTab(page, "Contents");
  for (const t of ["One", "Two", "Three"]) {
    await expect(panel(page).getByRole("button", { name: t, exact: true })).toBeVisible();
  }
  await panel(page).getByRole("button", { name: "Three", exact: true }).click();
  await expect(frame(page).getByText("Gamma")).toBeVisible();
});

test("bookmarks toggle, persist and jump back", async ({ page }) => {
  await openEpub(page);
  await page.getByRole("button", { name: "Add bookmark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove bookmark", exact: true })).toBeVisible();
  await openPanelTab(page, "Bookmarks");
  await expect(panel(page).getByRole("listitem")).toHaveCount(1);
  await expect(panel(page).getByRole("listitem")).toContainText("One");

  await page.reload();
  await expect(frame(page).getByText("Alpha chapter text")).toBeVisible();
  await openPanelTab(page, "Contents");
  await panel(page).getByRole("button", { name: "Three", exact: true }).click();
  await expect(frame(page).getByText("Gamma")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add bookmark", exact: true })).toBeVisible();
  await openPanelTab(page, "Bookmarks");
  await expect(panel(page).getByRole("listitem")).toHaveCount(1);
  await panel(page).getByRole("button", { name: /One/ }).first().click();
  await expect(frame(page).getByText("Alpha chapter text")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove bookmark", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Remove bookmark", exact: true }).click();
  await expect(panel(page).getByRole("listitem")).toHaveCount(0);
});

test("selecting text adds a highlight that persists and is listed", async ({ page }) => {
  await openEpub(page);
  await frame(page).getByText("Alpha chapter text").click({ clickCount: 3 });
  await page.getByRole("button", { name: "Highlight green" }).click();
  await expect(page.getByRole("button", { name: "Highlight green" })).toHaveCount(0);
  await expect(page.locator("g.hl").first()).toBeAttached();

  await page.reload();
  await expect(frame(page).getByText("Alpha chapter text")).toBeVisible();
  await expect(page.locator("g.hl").first()).toBeAttached();
  await openPanelTab(page, "Highlights");
  const item = panel(page).getByRole("listitem").filter({ hasText: "Alpha chapter text" });
  await expect(item).toHaveCount(1);

  // Jump from the list, then delete.
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(frame(page).getByText("Beta chapter text")).toBeVisible();
  await item.getByRole("button", { name: /Alpha chapter text/ }).click();
  await expect(frame(page).getByText("Alpha chapter text")).toBeVisible();
  await item.getByRole("button", { name: "Delete highlight" }).click();
  await expect(panel(page).getByRole("listitem")).toHaveCount(0);
  await expect(page.locator("g.hl")).toHaveCount(0);
});

test("search lists a hit and jumps to it", async ({ page }) => {
  await openEpub(page);
  await page.keyboard.press("/");
  await expect(searchBox(page)).toBeFocused();
  await searchBox(page).fill("Beta");
  await expect(page.getByText("1 result", { exact: true })).toBeVisible();
  await expect(frame(page).getByText("Beta chapter text")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(frame(page).getByText("Gamma")).toBeVisible();
  await page.getByRole("button", { name: /^Two:.*Beta/ }).click();
  await expect(frame(page).getByText("Beta chapter text")).toBeVisible();
  await searchBox(page).fill("quokka");
  await expect(page.getByText("No results")).toBeVisible();
});

test("the page theme applies inside the book and is remembered", async ({ page }) => {
  await openEpub(page);
  const bg = () => frame(page).locator("body").evaluate((el) => getComputedStyle(el).backgroundColor);
  const before = await bg();
  await page.getByRole("combobox", { name: "Page theme" }).selectOption("dark");
  await expect.poll(bg).not.toBe(before);
  const dark = await bg();
  await page.waitForTimeout(1500); // debounce
  await page.reload();
  await expect(frame(page).getByText("Alpha chapter text")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Page theme" })).toHaveValue("dark");
  await expect.poll(bg).toBe(dark);
});

test("text size and scroll mode apply and are remembered", async ({ page }) => {
  await openEpub(page);
  const size = () => frame(page).locator("body").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const before = await size();
  await page.getByRole("button", { name: "Larger text" }).click();
  await page.getByRole("button", { name: "Larger text" }).click();
  await expect.poll(size).toBeGreaterThan(before);
  await page.getByRole("combobox", { name: "View mode" }).selectOption("scroll");
  await expect(frame(page).getByText("Alpha chapter text")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(frame(page).getByText("Beta chapter text")).toBeVisible();
  await page.waitForTimeout(1500); // debounce
  await page.reload();
  await expect(frame(page).getByText("Beta chapter text")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "View mode" })).toHaveValue("scroll");
  await expect.poll(size).toBeGreaterThan(before);
});

test("an unreadable EPUB shows a clear message", async ({ page }) => {
  await openDetail(page, "Piranesi");
  const broken = Buffer.concat([Buffer.from("PK\x03\x04" + "\0".repeat(26) + "mimetypeapplication/epub+zip", "latin1"), Buffer.alloc(64, 7)]);
  await page.getByTestId("book-file-input").setInputFiles({ name: "broken.epub", mimeType: "application/epub+zip", buffer: broken });
  await expect(toast(page, "File attached")).toBeVisible();
  await page.getByRole("link", { name: "Read", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "couldn't open this file" })).toBeVisible();
  await page.getByRole("link", { name: "Back to book" }).click();
  await expect(page.getByRole("combobox", { name: "Status for Piranesi" })).toHaveValue("want");
});
