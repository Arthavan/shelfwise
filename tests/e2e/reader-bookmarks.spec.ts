import { expect, test, type Page } from "@playwright/test";

import { openReader, resetData } from "./helpers";

const pageInput = (page: Page) => page.getByRole("textbox", { name: "Page" });

async function openPanel(
  page: Page,
  tabName: "Contents" | "Bookmarks" | "Highlights",
) {
  await page.getByRole("button", { name: "Toggle side panel" }).click();
  await page.getByRole("tab", { name: tabName }).click();
}

test.beforeEach(async ({ request }) => {
  await resetData(request, "demo");
});

test("b and the toolbar button add bookmarks; the panel lists them and jumps", async ({
  page,
}) => {
  await openReader(page);
  await page.keyboard.press("b");
  await expect(
    page.getByRole("button", { name: "Remove bookmark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await openPanel(page, "Bookmarks");
  const panel = page.getByRole("complementary");
  await expect(
    panel.getByRole("listitem").filter({ hasText: "Page 1" }),
  ).toHaveCount(1);

  await pageInput(page).fill("4");
  await pageInput(page).press("Enter");
  await expect(pageInput(page)).toHaveValue("4");
  await page.getByRole("button", { name: "Add bookmark" }).click();
  await expect(panel.getByRole("listitem")).toHaveCount(2);

  await panel.getByRole("button", { name: "Page 1", exact: true }).click();
  await expect(pageInput(page)).toHaveValue("1");
});

test("bookmarks persist across reload and can be removed from the panel", async ({
  page,
}) => {
  await openReader(page);
  await page.keyboard.press("b");
  await expect(
    page.getByRole("button", { name: "Remove bookmark", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("button", { name: "Add bookmark" }).click();
  await expect(
    page.getByRole("button", { name: "Remove bookmark", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  await page.reload();
  await openPanel(page, "Bookmarks");
  const panel = page.getByRole("complementary");
  await expect(panel.getByRole("listitem")).toHaveCount(2);
  await panel
    .getByRole("button", { name: "Remove bookmark on page 1" })
    .click();
  await expect(panel.getByRole("listitem")).toHaveCount(1);
  await page.reload();
  await openPanel(page, "Bookmarks");
  await expect(
    page.getByRole("complementary").getByRole("listitem"),
  ).toHaveCount(1);
});

test("toggling b twice does not duplicate a bookmark", async ({ page }) => {
  await openReader(page);
  await openPanel(page, "Bookmarks");
  const panel = page.getByRole("complementary");
  await expect(
    panel.getByText("No bookmarks yet. Press B to add one."),
  ).toBeVisible();
  await page.keyboard.press("b");
  await expect(panel.getByRole("listitem")).toHaveCount(1);
  await page.keyboard.press("b");
  await expect(panel.getByRole("listitem")).toHaveCount(0);
  await page.keyboard.press("b");
  await expect(panel.getByRole("listitem")).toHaveCount(1);
});

test("b is ignored while typing in the page field", async ({ page }) => {
  await openReader(page);
  await pageInput(page).focus();
  await page.keyboard.press("b");
  await expect(
    page.getByRole("button", { name: "Add bookmark" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("theme, zoom and view mode controls work and persist", async ({
  page,
}) => {
  await openReader(page);
  const canvas = page.locator("canvas").first();
  await page
    .getByRole("combobox", { name: "Page theme" })
    .selectOption("sepia");
  await expect(canvas).toHaveCSS("filter", /sepia/);
  await page.getByRole("combobox", { name: "Page theme" }).selectOption("dark");
  await expect(canvas).toHaveCSS("filter", /invert/);

  await expect(page.getByText("125%")).toBeVisible();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText("150%")).toBeVisible();

  await page
    .getByRole("combobox", { name: "View mode" })
    .selectOption("scroll");
  await expect(page.locator("[data-page-slot]")).toHaveCount(5);
  await page.getByRole("combobox", { name: "View mode" }).selectOption("page");
  await expect(page.locator("[data-page]")).toHaveCount(1);

  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Page theme" })).toHaveValue(
    "dark",
  );
  await expect(page.getByText("150%")).toBeVisible();
});

test("scroll mode: End reaches the last page and offers Mark as finished", async ({
  page,
}) => {
  await openReader(page);
  await page
    .getByRole("combobox", { name: "View mode" })
    .selectOption("scroll");
  await expect(pageInput(page)).toHaveValue("1");
  await page.keyboard.press("End");
  await expect(pageInput(page)).toHaveValue("5");
  await expect(
    page.getByRole("button", { name: "Mark as finished" }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  await expect(pageInput(page)).toHaveValue("5"); // does not bounce back
});

test("stale text-layer spans do not linger after a page turn", async ({
  page,
}) => {
  await openReader(page);
  await expect(page.getByText("Page 1 marker")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 marker")).toBeVisible();
  await expect(page.getByText("Page 1 marker")).toHaveCount(0);
});

test("Contents tab says so when the PDF has no outline", async ({ page }) => {
  await openReader(page);
  await openPanel(page, "Contents");
  await expect(
    page.getByText("This PDF has no table of contents"),
  ).toBeVisible();
});
