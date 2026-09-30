"use client";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  addBookmarkAction,
  addHighlightAction,
  removeBookmarkAction,
  removeHighlightAction,
  updateHighlightAction,
} from "@/app/books/[id]/read/actions";
import { updateBookStatus } from "@/app/books/status-actions";
import { ERROR_TOAST, STATUS_TOASTS } from "@/lib/constants";
import type { HighlightColor, Rect } from "@/lib/reading";
import type { BookmarkInfo, BookStatus, HighlightInfo } from "@/lib/types";

/** Where a new highlight is: PDF (page + rects) or EPUB (page null, no rects, a CFI range). */
export type HighlightTarget = { page: number | null; rects: Rect[]; cfiRange?: string | null; text: string };

/**
 * Bookmarks and highlights of one book, shared by the PDF and EPUB readers: optimistic updates with
 * rollback and an error toast when the server action fails. Format-specific locations stay in the readers.
 */
export function useReaderAnnotations(bookId: string, initial: { bookmarks: BookmarkInfo[]; highlights: HighlightInfo[] }) {
  const [bookmarks, setBookmarks] = useState<BookmarkInfo[]>(initial.bookmarks);
  const [highlights, setHighlights] = useState<HighlightInfo[]>(initial.highlights);

  /** Removes `current` when there is one, otherwise bookmarks `location`. */
  const toggleBookmark = useCallback(
    async (current: BookmarkInfo | undefined, location: string, label?: string) => {
      if (current) {
        const removed = current;
        setBookmarks((prev) => prev.filter((b) => b.id !== removed.id));
        const res = await removeBookmarkAction({ id: bookId, bookmarkId: removed.id });
        if (!res.ok) {
          setBookmarks((prev) => (prev.some((b) => b.id === removed.id) ? prev : [...prev, removed]));
          toast.error(ERROR_TOAST);
        }
        return;
      }
      const res = await addBookmarkAction({ id: bookId, location, ...(label !== undefined ? { label } : {}) });
      if (res.ok) setBookmarks((prev) => (prev.some((b) => b.id === res.data.id) ? prev : [...prev, res.data]));
      else toast.error(ERROR_TOAST);
    },
    [bookId],
  );

  const removeBookmark = useCallback(
    async (bookmarkId: string) => {
      const removed = bookmarks.find((b) => b.id === bookmarkId);
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
      const res = await removeBookmarkAction({ id: bookId, bookmarkId });
      if (!res.ok) {
        if (removed) setBookmarks((prev) => [...prev, removed]);
        toast.error(ERROR_TOAST);
      }
    },
    [bookId, bookmarks],
  );

  /** Saves a new highlight (and its note, if any). `onAdded` runs once the highlight exists (e.g. clear the selection). */
  const addHighlight = useCallback(
    async (target: HighlightTarget, color: HighlightColor, note: string, onAdded?: () => void) => {
      const res = await addHighlightAction({ id: bookId, ...target, color });
      if (!res.ok) {
        toast.error(ERROR_TOAST);
        return;
      }
      onAdded?.();
      const trimmed = note.trim();
      setHighlights((prev) => [...prev, { ...res.data, note: trimmed || null }]);
      if (trimmed) {
        const upd = await updateHighlightAction({ id: bookId, highlightId: res.data.id, note: trimmed });
        if (!upd.ok) {
          setHighlights((prev) => prev.map((h) => (h.id === res.data.id ? { ...h, note: null } : h)));
          toast.error(ERROR_TOAST);
        }
      }
    },
    [bookId],
  );

  const updateHighlight = useCallback(
    async (highlightId: string, patch: { note?: string | null; color?: string }) => {
      const before = highlights.find((h) => h.id === highlightId);
      if (!before) return;
      setHighlights((prev) => prev.map((h) => (h.id === highlightId ? { ...h, ...patch } : h)));
      const res = await updateHighlightAction({ id: bookId, highlightId, ...patch });
      if (!res.ok) {
        setHighlights((prev) => prev.map((h) => (h.id === highlightId ? before : h)));
        toast.error(ERROR_TOAST);
      }
    },
    [bookId, highlights],
  );

  const removeHighlight = useCallback(
    async (highlightId: string) => {
      const removed = highlights.find((h) => h.id === highlightId);
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
      const res = await removeHighlightAction({ id: bookId, highlightId });
      if (!res.ok) {
        if (removed) setHighlights((prev) => [...prev, removed]);
        toast.error(ERROR_TOAST);
      }
    },
    [bookId, highlights],
  );

  return { bookmarks, highlights, toggleBookmark, removeBookmark, addHighlight, updateHighlight, removeHighlight };
}

/** The book's status as the reader knows it, and the explicit "Mark as finished" action. */
export function useFinishBook(bookId: string, initialStatus: BookStatus) {
  const [status, setStatus] = useState<BookStatus>(initialStatus);
  const markFinished = useCallback(async () => {
    const res = await updateBookStatus({ id: bookId, status: "finished" });
    if (res.ok) {
      setStatus("finished");
      toast.success(STATUS_TOASTS.finished);
    } else {
      toast.error(res.error);
    }
  }, [bookId]);
  return { status, markFinished };
}
