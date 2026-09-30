---
name: e2e-testing
description: How acceptance tests are written and run in the app pipeline (Playwright, AC ids in titles, independence, selectors). Use when writing or fixing tests in tests/e2e.
---

# Acceptance tests

- File per feature: `tests/e2e/<feature-slug>.spec.ts`.
- Title starts with the AC id: `test('AC-12: completed tasks move to Done', async ({ page }) => { ... })`. The pipeline greps these ids to prove coverage and to run a task's tests with `-g "AC-12|AC-13"`.
- Selectors, in order of preference: `getByRole(name)`, `getByLabel`, `getByPlaceholder`, `getByText`, then `getByTestId`.
- Create unique data per test (`const name = \`Project ${Date.now()}\``) so tests are independent and can run in parallel.
- Assert on what the user sees (`toBeVisible`, `toHaveText`, `toHaveURL`), never on implementation details.
- Use `await expect(...)` web-first assertions; never `waitForTimeout`.
- Auth: if the app has login, put a `login(page)` helper in `tests/e2e/helpers.ts` using the seed user from ARCHITECTURE.md.
- Mobile check where the spec says responsive: `test.use({ viewport: { width: 390, height: 844 } })` in a describe block.
