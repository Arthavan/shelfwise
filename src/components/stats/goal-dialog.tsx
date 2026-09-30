"use client";

import { useId, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { clearReadingGoal, setReadingGoal } from "@/app/stats/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ERROR_TOAST, TOAST } from "@/lib/constants";

interface GoalDialogProps {
  year: number;
  /** Current target, or null when no goal is set. */
  target: number | null;
}

/** Dialog editor for the yearly reading goal (DESIGN §6.5). */
export function GoalDialog({ year, target }: GoalDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "remove" | null>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hasGoal = target !== null;

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (next) {
      setValue(target === null ? "" : String(target));
      setError(null);
    }
    setOpen(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending("save");
    try {
      const result = await setReadingGoal({ target: value });
      if (result.ok) {
        toast.success(TOAST.goalSaved);
        setOpen(false);
      } else if (result.fieldErrors?.target) {
        setError(result.fieldErrors.target);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(ERROR_TOAST);
    } finally {
      setPending(null);
    }
  }

  async function handleRemove() {
    if (pending) return;
    setPending("remove");
    try {
      const result = await clearReadingGoal();
      if (result.ok) {
        toast.success(TOAST.goalRemoved);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(ERROR_TOAST);
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full self-start sm:w-auto">
          {hasGoal ? "Edit goal" : "Set goal"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{`Reading goal ${year}`}</DialogTitle>
            <DialogDescription>How many books do you want to finish this year?</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={inputId}>Books this year</Label>
            <Input
              id={inputId}
              name="target"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              disabled={pending !== null}
            />
            {error ? (
              <p id={errorId} className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            {hasGoal ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 px-4 text-sm text-destructive hover:text-destructive sm:mr-auto sm:h-10"
                disabled={pending !== null}
                onClick={handleRemove}
              >
                {pending === "remove" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                Remove goal
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled={pending !== null} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending !== null}>
              {pending === "save" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {pending === "save" ? "Saving…" : "Save goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
