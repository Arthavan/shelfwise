"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteBook, restoreBook } from "@/app/books/delete-actions";
import { ERROR_TOAST } from "@/lib/constants";

interface DeleteBookButtonProps {
  bookId: string;
  title: string;
}

export function DeleteBookButton({ bookId, title }: DeleteBookButtonProps) {
  const router = useRouter();

  async function undo() {
    try {
      const result = await restoreBook({ id: bookId });
      if (result.ok) {
        toast.success("Book restored");
        router.refresh();
        return;
      }
      toast.error(result.error);
    } catch {
      toast.error(ERROR_TOAST);
    }
  }

  async function handleConfirm(): Promise<boolean> {
    try {
      const result = await deleteBook({ id: bookId });
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
    } catch {
      toast.error(ERROR_TOAST);
      return false;
    }
    // The Toaster lives in the root layout, so the toast survives the navigation.
    router.push("/");
    toast("Book deleted", { duration: 6000, action: { label: "Undo", onClick: () => void undo() } });
    return true;
  }

  return (
    <ConfirmDialog
      destructive
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 text-destructive hover:bg-accent hover:text-destructive sm:flex-none"
        >
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      }
      title={`Delete "${title}"?`}
      description="It will be removed from your library. You can undo this right after."
      confirmLabel="Delete"
      onConfirm={handleConfirm}
    />
  );
}
