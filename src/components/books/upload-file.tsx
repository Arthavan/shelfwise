"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadPdf } from "@/components/reader/pdf-loader";
import { ERROR_TOAST } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import type { BookFileInfo } from "@/lib/types";

interface UploadFileProps {
  bookId: string;
  file: BookFileInfo | null;
  fileMissing: boolean;
  /** The book has a reading position, bookmarks or highlights, which replacing the file deletes. */
  hasReadingData: boolean;
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

/** A new file waiting for the replace confirmation: a file from disk or a link to import. */
type Replacement = { kind: "upload"; file: File } | { kind: "link"; url: string };

export function UploadFile({ bookId, file, fileMissing, hasReadingData }: UploadFileProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"upload" | "import" | null>(null);
  /** A replacement chosen while the book has reading data: held until the user confirms. */
  const [replacement, setReplacement] = useState<Replacement | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const linkId = useId();

  function clearInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.currentTarget.files?.[0];
    if (!chosen) return;
    if (file && hasReadingData) setReplacement({ kind: "upload", file: chosen });
    else void upload(chosen);
  }

  function handleImportSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = link.trim();
    if (file && hasReadingData) setReplacement({ kind: "link", url });
    else void importLink(url);
  }

  /** Shows the outcome of an upload or import response. */
  async function report(res: Response): Promise<boolean> {
    if (res.ok) {
      toast.success("File attached");
      router.refresh();
      return true;
    }
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    toast.error(json?.error ?? ERROR_TOAST);
    return false;
  }

  async function importLink(url: string) {
    setPending("import");
    try {
      const res = await fetch(`/api/books/${bookId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (await report(res)) {
        setLink("");
        setLinkOpen(false);
      }
    } catch {
      toast.error(ERROR_TOAST);
    } finally {
      setPending(null);
    }
  }

  async function upload(chosen: File) {
    setPending("upload");
    try {
      const pageCount = await readPageCount(chosen);
      const body = new FormData();
      body.append("file", chosen);
      if (pageCount !== null) body.append("pageCount", String(pageCount));
      const res = await fetch(`/api/books/${bookId}/file`, { method: "POST", body });
      await report(res);
    } catch {
      toast.error(ERROR_TOAST);
    } finally {
      clearInput();
      setPending(null);
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
      <ConfirmDialog
        destructive
        open={replacement !== null}
        onOpenChange={(open) => {
          if (open) return;
          setReplacement(null);
          clearInput();
        }}
        title="Replace this file?"
        description="Replacing the file removes your reading position, bookmarks and highlights for this book."
        confirmLabel="Replace file"
        onConfirm={async () => {
          if (replacement?.kind === "upload") await upload(replacement.file);
          else if (replacement?.kind === "link") await importLink(replacement.url);
          return true;
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending !== null} onClick={() => inputRef.current?.click()}>
          <FileUp aria-hidden="true" />
          {pending === "upload" ? "Uploading…" : file ? "Replace file" : "Upload PDF or EPUB"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending !== null}
          aria-expanded={linkOpen}
          aria-controls={`${linkId}-form`}
          onClick={() => setLinkOpen((open) => !open)}
        >
          <Link2 aria-hidden="true" />
          Import from link
        </Button>
        {file ? (
          <ConfirmDialog
            destructive
            trigger={
              <Button type="button" variant="outline" size="sm" disabled={pending !== null}>
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
      {linkOpen ? (
        <form id={`${linkId}-form`} noValidate className="space-y-2" onSubmit={handleImportSubmit}>
          <Label htmlFor={linkId}>Link to a PDF or EPUB file</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={linkId}
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://example.com/book.pdf"
              className="min-w-0 flex-1 basis-60"
              value={link}
              disabled={pending !== null}
              onChange={(event) => setLink(event.currentTarget.value)}
              autoFocus
            />
            <Button type="submit" size="sm" disabled={pending !== null || link.trim() === ""}>
              {pending === "import" ? "Importing…" : "Import"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Use a direct link to the file. Pages that only show the book in their own viewer can&apos;t be imported.</p>
        </form>
      ) : null}
    </div>
  );
}
