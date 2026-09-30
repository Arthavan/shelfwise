import { expect, test, type Page } from "@playwright/test";

import { openReader, resetData } from "./helpers";

const PAGES = ["Alpha zebra one", "Nothing here", "Zebra again and zebra twice", "The end"];

const pageInput = (page: Page) => page.getByRole("textbox", { name: "Page" });
const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Search in book" });

test.beforeEach(async ({ request }) => {
  await resetData(request, "demo");
});

test("/ opens search; hits navigate with wraparound and highlight the match", async ({ page }) => {
  await openReader(page, PAGES);
  await page.keyboard.press("/");
  await expect(searchBox(page)).toBeFocused();
  await expect(searchBox(page)).toHaveValue("");
  await searchBox(page).fill("zebra");
  await expect(page.getByText("3 results")).toBeVisible();
  await expect(pageInput(page)).toHaveValue("1");
  await expect(page.locator(".search-hit").first()).toBeVisible();

  await page.getByRole("button", { name: "Next result" }).click();
  await expect(pageInput(page)).toHaveValue("3");
  await page.getByRole("button", { name: "Next result" }).click();
  await expect(pageInput(page)).toHaveValue("3");
  await page.getByRole("button", { name: "Next result" }).click();
  await expect(pageInput(page)).toHaveValue("1");
  await page.getByRole("button", { name: "Previous result" }).click();
  await expect(pageInput(page)).toHaveValue("3");
});

test("typing in the search box does not turn pages", async ({ page }) => {
  await openReader(page, PAGES);
  await page.keyboard.press("/");
  await searchBox(page).fill("zebra");
  await expect(page.getByText("3 results")).toBeVisible();
  await searchBox(page).press("ArrowRight");
  await searchBox(page).press("b");
  await expect(pageInput(page)).toHaveValue("1");
  await expect(searchBox(page)).toHaveValue("zebrab");
});

test("clicking a hit in the list jumps to its page", async ({ page }) => {
  await openReader(page, PAGES);
  await page.getByRole("button", { name: "Search in book" }).click();
  await searchBox(page).fill("zebra");
  await expect(page.getByText("3 results")).toBeVisible();
  await page.getByRole("button", { name: /^Page 3:/ }).first().click();
  await expect(pageInput(page)).toHaveValue("3");
});

test("a term that is not present shows No results", async ({ page }) => {
  await openReader(page, PAGES);
  await page.keyboard.press("/");
  await searchBox(page).fill("quokka");
  await expect(page.getByText("No results")).toBeVisible();
});

test("regex characters are searched literally and do not crash", async ({ page }) => {
  await openReader(page, PAGES);
  await page.keyboard.press("/");
  await searchBox(page).fill("(");
  await expect(page.getByText("No results")).toBeVisible();
});

test("Escape closes search and clears highlighting", async ({ page }) => {
  await openReader(page, PAGES);
  await page.keyboard.press("/");
  await searchBox(page).fill("zebra");
  await expect(page.locator(".search-hit").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(searchBox(page)).toHaveCount(0);
  await expect(page.locator(".search-hit")).toHaveCount(0);
});

test("a PDF without text says search is unavailable", async ({ page }) => {
  await openReader(page, [""]);
  await page.keyboard.press("/");
  await searchBox(page).fill("anything");
  await expect(page.getByText("no selectable text in this PDF")).toBeVisible();
});
