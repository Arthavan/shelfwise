---
name: web-stack
description: Conventions for the app pipeline's default web stack (Next.js App Router, TypeScript, Tailwind, shadcn/ui, Prisma + SQLite, zod, Vitest, Playwright). Use when architecting, scaffolding or building an app in this repo.
---

# Default web stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (latest stable), App Router, `src/` dir | Server components by default; `"use client"` only where interaction needs it |
| Language | TypeScript, `strict: true` | No `any`; shared types in `src/lib/types.ts` |
| Styling | Tailwind CSS + shadcn/ui | Tokens from DESIGN.md as CSS variables; `cn()` helper; no inline styles |
| Icons | lucide-react | One icon family only |
| Data | Prisma + SQLite (`file:./dev.db`) | Schema stays Postgres-compatible (no SQLite-only types) |
| Mutations | Server actions in `src/app/**/actions.ts` | Validate every input with zod; return `{ ok: true, data } \| { ok: false, error }`; `revalidatePath` after writes |
| Forms | react-hook-form + zod resolver, shadcn `Form` | Inline field errors, disabled submit while pending |
| Feedback | shadcn `sonner` toasts | Success and error on every mutation |
| Theme | next-themes, class strategy | Light, dark, system |
| Auth (only if spec needs it) | Auth.js credentials provider or a small session-cookie implementation with bcrypt | Check the session in every server action and protected page |
| Unit tests | Vitest | For pure logic in `src/lib` |
| E2E | Playwright, chromium | `tests/e2e`, webServer in config |

## Layout
```
src/app/(routes)          pages and layouts
src/app/**/actions.ts     server actions
src/components/ui         shadcn components (generated)
src/components/<feature>  feature components
src/lib                   db client, types, utils, validation schemas
prisma/                   schema.prisma, seed.ts
tests/e2e                 Playwright specs
```

## Rules
- Pages fetch data in server components via `src/lib/db.ts` (singleton Prisma client).
- Every list has: empty state, loading skeleton (`loading.tsx`), error boundary (`error.tsx`), and a sensible sort.
- Every destructive action has a confirmation dialog.
- Dates via `Intl.DateTimeFormat`; numbers via `Intl.NumberFormat`.
- Accessibility: every input has a label, every icon-only button has `aria-label`, focus rings visible.
- No new dependencies after scaffold unless you are the scaffolder.
