import type { BookmarkInfo, BookStatus, FileFormat, HighlightInfo, ProgressInfo } from "@/lib/types";

/** Everything the reader needs, serialised from the server page. */
export interface ReaderData {
  bookId: string;
  title: string;
  format: FileFormat;
  fileUrl: string;
  pageCount: number | null;
  progress: ProgressInfo | null;
  bookmarks: BookmarkInfo[];
  highlights: HighlightInfo[];
  status: BookStatus;
}
