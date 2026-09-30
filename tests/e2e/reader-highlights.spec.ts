import { expect, test, type Page } from "@playwright/test";

import { openReader, resetData } from "./helpers";

const pageInput = (page: Page) => page.getByRole("textbox", { name: "Page" });
const overlays = (page: Page) => page.locator("[data-highlight-id]");
const panel = (page: Page) => page.getByRole("complementary");

/** Select the text of a text-layer span the way a user would (triple-click), falling back to a Range. */
async function selectText(page: Page, text: string) {
  const span = page.locator(".textLayer span", { hasText: text }).first();
  await expect(span).toBeVisible();
  await span.click({ clickCount: 3 });
}

async function openHighlights(page: Page) {
  await page.getByRole("button", { name: "Toggle side panel" }).click();
  await page.getByRole("tab", { name: "Highlights" }).click();
}

async function goTo(page: Page, n: number) {
  await pageInput(page).fill(String(n));
  await pageInput(page).press("Enter");
  await expect(pageInput(page)).toHaveValue(String(n));
}

test.beforeEach(async ({ request }) => {
  await resetData(request, "demo");
});

async function addGreenHighlight(page: Page, text = "Page 1 marker") {
  await selectText(page, text);
  await page.getByRole("button", { name: "Highlight green" }).click();
  await expect(overlays(page).first()).toBeVisible();
}

test("selecting text offers colours; picking one adds a persistent highlight", async ({ page }) => {
  await openReader(page);
  await selectText(page, "Page 1 marker");
  for (const c of ["yellow", "green", "blue", "pink"]) {
    await expect(page.getByRole("button", { name: `Highlight ${c}` })).toBeVisible();
  }
  await page.getByRole("button", { name: "Highlight green" }).click();
  await expect(overlays(page).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Highlight green" })).toHaveCount(0);

  await page.reload();
  await expect(overlays(page).first()).toBeVisible();
  await openHighlights(page);
  const item = panel(page).getByRole("listitem").filter({ hasText: "Page 1 marker" });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("Page 1");
});

test("adding a note saves it with the highlight", async ({ page }) => {
  await openReader(page);
  await goTo(page, 2);
  await selectText(page, "Page 2 marker");
  await page.getByRole("button", { name: "Add note" }).click();
  await page.getByRole("textbox", { name: "Note" }).fill("why this matters");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(overlays(page).first()).toBeVisible();
  await openHighlights(page);
  await expect(panel(page).getByRole("textbox", { name: "Note" })).toHaveValue("why this matters");

  await page.reload();
  await openHighlights(page);
  await expect(panel(page).getByRole("textbox", { name: "Note" })).toHaveValue("why this matters");
});

test("clicking a highlight in the panel jumps to its page", async ({ page }) => {
  await openReader(page);
  await addGreenHighlight(page);
  await goTo(page, 3);
  await openHighlights(page);
  await panel(page).getByRole("button", { name: /Page 1 marker/ }).click();
  await expect(pageInput(page)).toHaveValue("1");
});

test("deleting a highlight removes the overlay and the list item", async ({ page }) => {
  await openReader(page);
  await addGreenHighlight(page);
  await openHighlights(page);
  await panel(page).getByRole("button", { name: "Delete highlight" }).click();
  await expect(overlays(page)).toHaveCount(0);
  await expect(panel(page).getByRole("listitem")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".textLayer span").first()).toBeVisible();
  await expect(overlays(page)).toHaveCount(0);
});

test("changing the colour in the panel recolours the overlay", async ({ page }) => {
  await openReader(page);
  await addGreenHighlight(page);
  const before = await overlays(page).first().evaluate((el) => getComputedStyle(el).backgroundColor);
  await openHighlights(page);
  await panel(page).getByRole("combobox", { name: "Highlight colour" }).selectOption("pink");
  await expect(overlays(page).first()).not.toHaveCSS("background-color", before);
  await page.reload();
  await openHighlights(page);
  await expect(panel(page).getByRole("combobox", { name: "Highlight colour" })).toHaveValue("pink");
});

test("scroll mode: selecting text on a later page highlights that page", async ({ page }) => {
  await openReader(page);
  await page.getByRole("combobox", { name: "View mode" }).selectOption("scroll");
  await goTo(page, 3);
  const span = page.locator("[data-page='3'] .textLayer span", { hasText: "Page 3 marker" });
  await expect(span).toBeVisible();
  await span.click({ clickCount: 3 });
  await page.getByRole("button", { name: "Highlight blue" }).click();
  await expect(page.locator("[data-page='3'] [data-highlight-id]").first()).toBeVisible();
});

test("a PDF without text offers no popover and explains why", async ({ page }) => {
  await openReader(page, [""]);
  await page.locator("[data-page]").click({ clickCount: 3, position: { x: 100, y: 90 } });
  await expect(page.getByRole("button", { name: "Highlight yellow" })).toHaveCount(0);
  await openHighlights(page);
  await expect(panel(page).getByText("no selectable text in this PDF")).toBeVisible();
});
