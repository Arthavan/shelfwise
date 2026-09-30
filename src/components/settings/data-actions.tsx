"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ERROR_TOAST, TOAST } from "@/lib/constants";
import { deleteAllBooks, restoreDemoData } from "@/app/settings/actions";
import type { ActionResult } from "@/lib/types";

/** Runs a server action, toasts the outcome and tells the dialog whether to close. */
async function run(action: () => Promise<ActionResult<{ count: number }>>, success: string): Promise<boolean> {
  try {
    const result = await action();
    if (result.ok) {
      toast.success(success);
      return true;
    }
    toast.error(result.error);
  } catch {
    toast.error(ERROR_TOAST);
  }
  return false;
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function DataActions() {
  return (
    <div className="mt-2 divide-y">
      <Row title="Demo shelf" description="Replace all books with the 12 demo books and clear your reading goal.">
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              <RotateCcw aria-hidden="true" className="size-4" />
              Restore demo data
            </Button>
          }
          title="Restore demo data?"
          description="This replaces all your books with the 12 demo books and clears your reading goal."
          confirmLabel="Restore"
          onConfirm={() => run(restoreDemoData, TOAST.demoRestored)}
        />
      </Row>
      <Row title="Start fresh" description="Permanently remove every book. Your reading goal is kept.">
        <ConfirmDialog
          destructive
          trigger={
            <Button
              type="button"
              variant="outline"
              className="w-full text-destructive hover:bg-accent hover:text-destructive sm:w-auto"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Delete all books
            </Button>
          }
          title="Delete all books?"
          description="This permanently removes every book on your shelf. It can't be undone."
          confirmLabel="Delete all"
          onConfirm={() => run(deleteAllBooks, TOAST.allDeleted)}
        />
      </Row>
    </div>
  );
}
