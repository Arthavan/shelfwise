-- AlterTable
ALTER TABLE "Book" ADD COLUMN "lastReadAt" DATETIME;

-- CreateTable
CREATE TABLE "BookFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookFile_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "bookId" TEXT NOT NULL PRIMARY KEY,
    "location" TEXT NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "zoom" REAL,
    "viewMode" TEXT NOT NULL DEFAULT 'page',
    "pageTheme" TEXT NOT NULL DEFAULT 'light',
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingProgress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "page" INTEGER,
    "rects" TEXT,
    "cfiRange" TEXT,
    "text" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Highlight_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BookFile_bookId_key" ON "BookFile"("bookId");

-- CreateIndex
CREATE INDEX "Bookmark_bookId_createdAt_idx" ON "Bookmark"("bookId", "createdAt");

-- CreateIndex
CREATE INDEX "Highlight_bookId_page_idx" ON "Highlight"("bookId", "page");

-- CreateIndex
CREATE INDEX "Book_lastReadAt_idx" ON "Book"("lastReadAt");
