import { z } from "zod";

import type { BookFormValues } from "@/lib/types";

/** Runs on the client (react-hook-form) and in every server action (D8). */
export const GOAL_ERROR = "Enter a whole number from 1 to 999";

const statusEnum = z.enum(["want", "reading", "finished"]);

const pagesField = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value === "") return;
    if (!/^\d+$/.test(value) || Number(value) < 1) {
      ctx.addIssue({ code: "custom", message: "Pages must be a positive whole number" });
    } else if (Number(value) > 100_000) {
      ctx.addIssue({ code: "custom", message: "Pages must be 100,000 or fewer" });
    }
  });

export const bookFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer"),
  author: z
    .string()
    .trim()
    .min(1, "Author is required")
    .max(120, "Author must be 120 characters or fewer"),
  status: statusEnum,
  pages: pagesField,
  notes: z.string().trim().max(2000, "Notes must be 2000 characters or fewer"),
  rating: z.number().int().min(1).max(5).nullable(),
});

/** Form values → DB fields: pages to number or null, empty notes to null. */
export function toBookData(values: BookFormValues): {
  title: string;
  author: string;
  pages: number | null;
  notes: string | null;
} {
  const pages = values.pages.trim();
  const notes = values.notes.trim();
  return {
    title: values.title.trim(),
    author: values.author.trim(),
    pages: pages === "" ? null : Number(pages),
    notes: notes === "" ? null : notes,
  };
}

export const idSchema = z.string().trim().min(1).max(64);

export const statusChangeSchema = z.object({ id: idSchema, status: statusEnum });

export const rateSchema = z.object({ id: idSchema, rating: z.number().int().min(1).max(5) });

export const goalSchema = z.object({
  target: z
    .union([z.string(), z.number()], { error: GOAL_ERROR })
    .transform((value, ctx) => {
      const text = typeof value === "number" ? String(value) : value.trim();
      const n = /^\d+$/.test(text) ? Number(text) : NaN;
      if (!Number.isInteger(n) || n < 1 || n > 999) {
        ctx.issues.push({ code: "custom", message: GOAL_ERROR, input: value });
        return z.NEVER;
      }
      return n;
    }),
});

export const resetSchema = z.object({ mode: z.enum(["demo", "empty"]).default("demo") });
