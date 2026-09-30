import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { expect, test, type Page } from "@playwright/test";

import { makeEpub } from "./fixtures/make-epub";
import { makePdf } from "./fixtures/make-pdf";
import { openDetail, openReader, resetData, toast } from "./helpers";

/*
 * A tiny file host on 127.0.0.1 in the test process. The app server (another process) fetches from it
 * over loopback, which the import route allows only because the webServer sets E2E_TEST_HOOKS=1.
 */
const PDF = makePdf(["Imported one", "Imported two", "Imported three"]);
const EPUB = makeEpub([{ title: "One", body: "Imported chapter text" }]);
let server: Server;
let origin: string;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0];
    if (path === "/files/Imported%20Book.pdf") res.writeHead(200, { "Content-Type": "application/pdf" }).end(PDF);
    else if (path === "/files/novel.epub") res.writeHead(200, { "Content-Type": "application/epub+zip" }).end(EPUB);
    else if (path === "/viewer.html") res.writeHead(200, { "Content-Type": "text/html" }).end(`<!doctype html><html><body>${"Viewer ".repeat(500)}</body></html>`);
    else if (path === "/protected.pdf") res.writeHead(403, { "Content-Type": "text/plain" }).end("Forbidden");
    else res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(async ({ request }) => {
  await resetData(request, "demo");
});

async function importLink(page: Page, url: string): Promise<void> {
  const field = page.getByRole("textbox", { name: "Link to a PDF or EPUB file" });
  if ((await field.count()) === 0) await page.getByRole("button", { name: "Import from link" }).click();
  await field.fill(url);
  await page.getByRole("button", { name: "Import", exact: true }).click();
}

test("imports a PDF from a link and reads it", async ({ page }) => {
  await openDetail(page, "The Hobbit");
  await importLink(page, `${origin}/files/Imported%20Book.pdf`);
  await expect(toast(page, "File attached")).toBeVisible();
  await expect(page.getByText("Imported Book.pdf")).toBeVisible();
  await page.getByRole("link", { name: "Read", exact: true }).click();
  await expect(page.getByText("Opening…")).toHaveCount(0);
  await expect(page.locator(".textLayer").getByText("Imported one")).toBeVisible();
});

test("imports an EPUB from a link", async ({ page }) => {
  await openDetail(page, "The Hobbit");
  await importLink(page, `${origin}/files/novel.epub`);
  await expect(toast(page, "File attached")).toBeVisible();
  await expect(page.getByText("novel.epub")).toBeVisible();
  await page.getByRole("link", { name: "Read", exact: true }).click();
  await expect(page.frameLocator("iframe").getByText("Imported chapter text")).toBeVisible();
});

test("explains links that are not a downloadable book file", async ({ page }) => {
  await openDetail(page, "The Hobbit");
  await importLink(page, `${origin}/viewer.html`);
  await expect(toast(page, "That link is a web page, not a PDF or EPUB file")).toBeVisible();

  await importLink(page, `${origin}/protected.pdf`);
  await expect(toast(page, "The site refused the download (it may only allow its own viewer)")).toBeVisible();

  await importLink(page, `${origin}/missing.pdf`);
  await expect(toast(page, "The site returned an error (HTTP 404)")).toBeVisible();

  await importLink(page, "http://169.254.169.254/latest/meta-data");
  await expect(toast(page, "That address isn't allowed")).toBeVisible();

  await importLink(page, "my book.pdf");
  await expect(toast(page, "Enter a full web address starting with http:// or https://")).toBeVisible();

  await expect(page.getByRole("link", { name: "Read", exact: true })).toHaveCount(0);
});

test("importing over a file with reading data asks first", async ({ page }) => {
  await openReader(page, 3);
  await page.getByRole("button", { name: "Add bookmark" }).click();
  await expect(page.getByRole("button", { name: "Remove bookmark", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Back to book" }).click();
  await expect(page.getByText("sample.pdf")).toBeVisible();

  const dialog = page.getByRole("alertdialog", { name: "Replace this file?" });
  await importLink(page, `${origin}/files/Imported%20Book.pdf`);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("sample.pdf")).toBeVisible();

  await importLink(page, `${origin}/files/Imported%20Book.pdf`);
  await dialog.getByRole("button", { name: "Replace file" }).click();
  await expect(toast(page, "File attached")).toBeVisible();
  await expect(page.getByText("Imported Book.pdf")).toBeVisible();
  await expect(page.getByText("sample.pdf")).toHaveCount(0);
});

test("the import route guards its input", async ({ page, request }) => {
  await openDetail(page, "The Hobbit");
  const id = page.url().split("/books/")[1];
  const url = `/api/books/${id}/import`;

  const notJson = await request.post(url, { headers: { "Content-Type": "text/plain" }, data: "https://example.com/a.pdf" });
  expect(notJson.status()).toBe(415);
  expect((await notJson.json()).ok).toBe(false);

  const crossOrigin = await request.post(url, { headers: { Origin: "https://evil.example" }, data: { url: `${origin}/files/novel.epub` } });
  expect(crossOrigin.status()).toBe(403);

  const oversized = await request.post(url, { data: { url: `https://example.com/${"a".repeat(10_000)}.pdf` } });
  expect(oversized.status()).toBe(413);
  expect(await oversized.json()).toEqual({ ok: false, error: "Request is too large" });

  const badBody = await request.post(url, { data: { link: 42 } });
  expect(badBody.status()).toBe(400);
  expect((await badBody.json()).error).toBe("Enter a full web address starting with http:// or https://");

  const missing = await request.post("/api/books/nope-not-a-book/import", { data: { url: `${origin}/files/novel.epub` } });
  expect(missing.status()).toBe(404);

  const metadata = await request.post(url, { data: { url: "http://169.254.169.254/latest/meta-data" } });
  expect(metadata.status()).toBe(400);
  const body = await metadata.json();
  expect(body).toEqual({ ok: false, error: "That address isn't allowed" });

  const ok = await request.post(url, { data: { url: `${origin}/files/novel.epub` } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ ok: true, format: "epub" });
});
