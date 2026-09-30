"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { loadPdf } from "@/components/reader/pdf-loader";
import { ERROR_TOAST } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import type { BookFileInfo, ProgressInfo } from "@/lib/types";

interface UploadFileProps {
  bookId: string;
  file: BookFileInfo | null;
  fileMissing: boolean;
  progress: ProgressInfo | null;
}

/** Page count of a PDF, or null when it can't be read (encrypted, damaged): the server decides validity. */
async function readPageCount(file: File): Promise<number | null> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return null;
  const url = URL.createObjectURL(file);
  try {
    const pdf = await loadPdf(url);
    const n = pdf.numPages;
    await pdf.loadingTask.destroy();
    return n;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function UploadFile({ bookId, file, fileMissing }: UploadFileProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const chosen = input.files?.[0];
    if (!chosen) return;
    setPending(true);
    try {
      const pageCount = await readPageCount(chosen);
      const body = new FormData();
      body.append("file", chosen);
      if (pageCount !== null) body.append("pageCount", String(pageCount));
      const res = await fetch(`/api/books/${bookId}/file`, { method: "POST", body });
      if (res.ok) {
        toast.success("File attached");
        router.refresh();
      } else {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(json?.error ?? ERROR_TOAST);
      }
    } catch {
      toast.error(ERROR_TOAST);
    } finally {
      input.value = "";
      setPending(false);
    }
  }

  async function handleRemove(): Promise<boolean> {
    try {
      const res = await fetch(`/api/books/${bookId}/file`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(json?.error ?? ERROR_TOAST);
        return false;
      }
    } catch {
      toast.error(ERROR_TOAST);
      return false;
    }
    toast.success("File removed");
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-2">
      {file ? (
        <p className="break-words text-sm text-muted-foreground">
          {file.originalName} · {formatBytes(file.sizeBytes)}
        </p>
      ) : null}
      {fileMissing ? <p className="text-sm text-destructive">File missing — re-upload it to keep reading</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.epub,application/pdf,application/epub+zip"
        data-testid="book-file-input"
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
          <FileUp aria-hidden="true" />
          {pending ? "Uploading…" : file ? "Replace file" : "Upload PDF or EPUB"}
        </Button>
        {file ? (
          <ConfirmDialog
            destructive
            trigger={
              <Button type="button" variant="outline" size="sm" disabled={pending}>
                <Trash2 aria-hidden="true" />
                Remove file
              </Button>
            }
            title="Remove this file?"
            description="The file, your reading progress, bookmarks and highlights for this book will be deleted. The book stays in your library."
            confirmLabel="Remove"
            onConfirm={handleRemove}
          />
        ) : null}
      </div>
    </div>
  );
}
