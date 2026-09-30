/*
 * F5 Reading stats (AC-17 .. AC-21).
 * data-testid used (ARCHITECTURE.md D15):
 *   - stat-value : value element inside each stat card (the card is a region named by its title)
 */
import { expect, test } from "@playwright/test";
import { currentMonthLabel, resetData, setStatus, statNumber, toast } from "./helpers";

async function chartBars(page: import("@playwright/test").Page) {
  return page.getByRole("region", { name: "Finished per month" }).getByRole("img");
}

function countFromBarName(name: string | null): number {
  const m = /: (\d+) books?$/.exec(name ?? "");
  expect(m, `bar name "${name}" should end with ": N book(s)"`).not.toBeNull();
  return Number(m![1]);
}

test.describe("Reading stats", () => {
  test("AC-17: demo data stat cards show 12 / 3 / 2 / 7, 2,210 pages and 4.3 average", async ({ page, request }) => {
    await resetData(request, "demo");
    await page.goto("/stats");
    const value = (name: string) => page.getByRole("region", { name, exact: true }).getByTestId("stat-value");
    await expect(value("Total books")).toHaveText("12");
    await expect(value("Want to read")).toHaveText("3");
    await expect(value("Reading")).toHaveText("2");
    await expect(value("Finished")).toHaveText("7");
    await expect(value("Pages read")).toHaveText("2,210");
    await expect(value("Average rating")).toHaveText("4.3");
  });

  test("AC-18: the rating distribution lists 5 stars 3, 4 stars 3, 3 stars 1, 2 stars 0, 1 star 0", async ({ page, request }) => {
    await resetData(request, "demo");
    await page.goto("/stats");
    const distribution = page.getByRole("region", { name: "Rating distribution" });
    await expect(distribution).toBeVisible();
    for (const label of ["5 stars: 3", "4 stars: 3", "3 stars: 1", "2 stars: 0", "1 star: 0"]) {
      await expect(distribution.getByRole("listitem", { name: label, exact: true })).toBeVisible();
    }
  });

  test("AC-19: marking Piranesi Finished raises 'Finished' and 'Finished this year' by one", async ({ page, request }) => {
    await resetData(request, "demo");
    await page.goto("/stats");
    const finishedBefore = await statNumber(page, "Finished");
    const thisYearBefore = await statNumber(page, "Finished this year");

    await page.goto("/");
    await setStatus(page, "Piranesi", "Finished");
    await expect(toast(page, "Marked as finished")).toBeVisible();

    await page.goto("/stats");
    expect(await statNumber(page, "Finished")).toBe(finishedBefore + 1);
    expect(await statNumber(page, "Finished this year")).toBe(thisYearBefore + 1);
  });

  test("AC-20: the monthly chart has 12 bars, ends with the current month and counts a book finished today", async ({ page, request }) => {
    await resetData(request, "demo");
    await page.goto("/stats");
    const bars = await chartBars(page);
    await expect(bars).toHaveCount(12);
    const last = bars.last();
    const lastName = await last.getAttribute("aria-label");
    expect(lastName).toMatch(new RegExp(`^${currentMonthLabel()}:`));
    const before = countFromBarName(lastName);

    await page.goto("/");
    await setStatus(page, "Piranesi", "Finished");
    await expect(toast(page, "Marked as finished")).toBeVisible();

    await page.goto("/stats");
    const barsAfter = await chartBars(page);
    await expect(barsAfter).toHaveCount(12);
    const afterName = await barsAfter.last().getAttribute("aria-label");
    expect(afterName).toMatch(new RegExp(`^${currentMonthLabel()}:`));
    expect(countFromBarName(afterName)).toBe(before + 1);
  });

  test("AC-21: with no books /stats shows 'No stats yet' and 'Add a book' opens the form", async ({ page, request }) => {
    await resetData(request, "empty");
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "No stats yet" })).toBeVisible();
    await page.getByRole("link", { name: "Add a book", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/books/new");
  });
});
