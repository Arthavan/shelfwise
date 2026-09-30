# Shelfwise: design

This file is the visual contract for the scaffolder, builders and the screenshot reviewer. It follows `.claude/skills/visual-design/SKILL.md`. Accessible names, copy and DOM structure come from ARCHITECTURE.md §5–§7. **Nothing here overrides a name or text defined there.** If a visual idea would change an accessible name, the name wins.

---

## 1. Direction

**Warm, quiet, literary.**

**Reference product: Things 3.** It has generous whitespace, one confident accent and nothing that shouts. Our twist is paper and ink: a warm off-white page, deep warm-brown ink, a serif for headings, and one terracotta accent. The terracotta is used only for the primary action, the current selection, stars, focus rings and chart bars.

What this means in practice:
- Flat surfaces with 1px borders. There are no shadows except on overlays (dialogs, toasts, native dropdowns).
- Neutrals are warm (hue 25–40), never blue-gray.
- Serif (Newsreader) for headings and book titles, and nothing else. All interface text uses Inter.
- Book covers are the only "colorful" objects on screen. They use muted book-cloth tones (oxblood, forest, navy, ochre, plum, teal, walnut, olive), so a grid of them looks like a real shelf, not a rainbow.

---

## 2. Tokens

**Format:** Tailwind v4 + shadcn/ui (new-york). Every color token is a complete `hsl(H S% L%)` value. This is the form shadcn uses for HSL themes on Tailwind v4, where `@theme inline` needs full colors. It is **not** the bare-channel v3 form. Opacity modifiers (`bg-primary/90`) work through Tailwind v4's color-mix.

Paste this block into `src/app/globals.css` **verbatim**, replacing everything `shadcn init` generated. If `tw-animate-css` is not installed yet, install it with `npm i tw-animate-css`.

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* ───────────── Light: paper and ink ───────────── */
:root {
  --radius: 0.625rem; /* 10px */

  --background: hsl(40 33% 97%);          /* warm paper */
  --foreground: hsl(25 18% 12%);          /* deep ink */

  --card: hsl(40 40% 99%);
  --card-foreground: hsl(25 18% 12%);
  --popover: hsl(40 40% 99%);
  --popover-foreground: hsl(25 18% 12%);

  --primary: hsl(16 62% 40%);             /* terracotta, the only accent */
  --primary-foreground: hsl(40 33% 98%);

  --secondary: hsl(36 24% 91%);
  --secondary-foreground: hsl(25 18% 12%);

  --muted: hsl(38 22% 93%);
  --muted-foreground: hsl(25 10% 38%);

  --accent: hsl(36 26% 91%);              /* neutral hover tint (shadcn "accent"), NOT the brand accent */
  --accent-foreground: hsl(25 18% 12%);

  --destructive: hsl(356 68% 44%);
  --destructive-foreground: hsl(40 33% 98%);

  --success: hsl(145 45% 30%);
  --success-foreground: hsl(40 33% 98%);

  --warning: hsl(38 92% 50%);             /* surface only; never as text on paper */
  --warning-foreground: hsl(25 40% 12%);

  --border: hsl(36 20% 88%);              /* decorative dividers and card edges */
  --input: hsl(30 8% 55%);                /* form-control borders, ≥3:1 on paper and card */
  --ring: hsl(16 62% 40%);

  /* Chart palette (only chart-1 is used by the app; 2–5 reserved) */
  --chart-1: hsl(16 62% 40%);
  --chart-2: hsl(152 30% 34%);
  --chart-3: hsl(38 75% 42%);
  --chart-4: hsl(215 35% 42%);
  --chart-5: hsl(320 22% 42%);

  /* Book-cloth cover tones (COVER_CLASSES bg-cover-1..8 + text-cover-foreground).
     They are the same in both themes on purpose (a book doesn't change color at night);
     .dark inherits these from :root. */
  --cover-1: hsl(356 42% 34%);            /* oxblood */
  --cover-2: hsl(152 30% 28%);            /* forest */
  --cover-3: hsl(215 38% 30%);            /* navy */
  --cover-4: hsl(36 60% 32%);             /* ochre */
  --cover-5: hsl(320 25% 32%);            /* plum */
  --cover-6: hsl(185 40% 26%);            /* teal */
  --cover-7: hsl(28 30% 30%);             /* walnut */
  --cover-8: hsl(80 20% 30%);             /* olive */
  --cover-foreground: hsl(40 40% 97%);
}

/* ───────────── Dark: warm charcoal, never pure black ───────────── */
.dark {
  --background: hsl(25 12% 9%);
  --foreground: hsl(40 25% 92%);

  --card: hsl(25 10% 12%);
  --card-foreground: hsl(40 25% 92%);
  --popover: hsl(25 10% 13%);
  --popover-foreground: hsl(40 25% 92%);

  --primary: hsl(18 65% 62%);
  --primary-foreground: hsl(25 12% 9%);

  --secondary: hsl(25 9% 18%);
  --secondary-foreground: hsl(40 25% 92%);

  --muted: hsl(25 9% 17%);
  --muted-foreground: hsl(35 12% 66%);

  --accent: hsl(25 10% 19%);
  --accent-foreground: hsl(40 25% 92%);

  --destructive: hsl(0 75% 70%);
  --destructive-foreground: hsl(25 12% 9%);

  --success: hsl(145 40% 55%);
  --success-foreground: hsl(25 12% 9%);

  --warning: hsl(38 85% 58%);
  --warning-foreground: hsl(25 30% 10%);

  --border: hsl(25 8% 21%);
  --input: hsl(30 6% 42%);
  --ring: hsl(18 65% 62%);

  --chart-1: hsl(18 65% 62%);
  --chart-2: hsl(152 32% 55%);
  --chart-3: hsl(40 75% 60%);
  --chart-4: hsl(215 45% 66%);
  --chart-5: hsl(320 28% 66%);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-cover-1: var(--cover-1);
  --color-cover-2: var(--cover-2);
  --color-cover-3: var(--cover-3);
  --color-cover-4: var(--cover-4);
  --color-cover-5: var(--cover-5);
  --color-cover-6: var(--cover-6);
  --color-cover-7: var(--cover-7);
  --color-cover-8: var(--cover-8);
  --color-cover-foreground: var(--cover-foreground);

  --radius-sm: calc(var(--radius) - 4px); /* 6px  – covers, small chips */
  --radius-md: calc(var(--radius) - 2px); /* 8px  – buttons, inputs, selects */
  --radius-lg: var(--radius);             /* 10px – cards, empty states */
  --radius-xl: calc(var(--radius) + 4px); /* 14px – dialogs */

  /* next/font exposes --font-inter / --font-newsreader (see §3). Do NOT name them
     --font-sans / --font-serif, or these lines become circular. */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-newsreader), ui-serif, Georgia, "Times New Roman", serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

@layer base {
  * {
    @apply border-border;
  }
  html {
    color-scheme: light;
  }
  html.dark {
    color-scheme: dark; /* native <select> popups, scrollbars and date UI follow the theme */
  }
  body {
    @apply bg-background text-foreground font-sans antialiased selection:bg-primary/20;
    text-rendering: optimizeLegibility;
  }
  h1,
  h2,
  h3 {
    text-wrap: balance;
  }
  input[type="search"]::-webkit-search-cancel-button {
    -webkit-appearance: none;
    appearance: none;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    ::before,
    ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

**Token usage rules**
- The "one warm accent" from the spec is `primary`. shadcn's `accent` token is a neutral hover tint only. Never use `bg-accent` to signal selection.
- `primary` as a text color is allowed on `background`, `card` and `muted` only (see §8).
- `warning` is a surface color only (with `warning-foreground` text). The app has no warning UI today; the token exists for completeness.
- `border` is for card edges and dividers. `input` is for form-control borders (inputs, selects, textarea, radio tiles, outline buttons) and empty-star outlines.
- Covers: `BookCover` uses `COVER_CLASSES[coverTone(title) - 1]`, i.e. `bg-cover-N text-cover-foreground`.

---

## 3. Typography

**Fonts (next/font/google, in `src/app/layout.tsx`):**

```ts
import { Inter, Newsreader } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", style: ["normal", "italic"] });
// <html lang="en" suppressHydrationWarning className={`${inter.variable} ${newsreader.variable}`}>
// <body className="min-h-dvh font-sans antialiased">
```

- **Inter**: all UI text, numbers (`tabular-nums` wherever numbers sit in columns or change: counts, stats, dates).
- **Newsreader** (variable, literary serif): page titles, section titles, book titles, empty-state titles and dialog titles.
- **Mono**: system stack, no webfont loaded. It is reserved; the UI currently has no monospace text.

**Type scale.** Use only these. Keep to at most three sizes per screen area; the stats dashboard adds the numeric size.

| Token | Family | Size / line height | Weight | Tracking | Tailwind classes | Used for |
|---|---|---|---|---|---|---|
| display | serif | 30/36 on phone, 36/40 at `sm+` | 500 | -0.02em | `font-serif text-3xl sm:text-4xl font-medium tracking-tight` | Book title h1 on the detail page |
| h1 | serif | 24/32 on phone, 30/36 at `sm+` | 500 | -0.01em | `font-serif text-2xl sm:text-3xl font-medium tracking-tight` | Page titles: Library, Add book, Edit book, Stats, Settings, not-found and error headings |
| h2 | serif | 20/28 | 500 | 0 | `font-serif text-xl font-medium` | Section titles (Finished per month, Rating distribution, Appearance, Your data, Details, Notes), empty-state titles, dialog titles |
| h3 | serif | 18/24 | 500 | 0 | `font-serif text-lg font-medium leading-6` | Book titles on cards (semantically `h2` per ARCHITECTURE; visually h3) and the title in "Your next read" |
| h4 | sans | 14/20 | 500 | 0 | `text-sm font-medium` | Stat-card titles (in `text-muted-foreground`), form labels, `dt`, settings row titles |
| numeric | sans | 30/36 | 600 | -0.01em | `text-3xl font-semibold tracking-tight tabular-nums` | Stat values (`data-testid="stat-value"`) |
| body | sans | 16/24; notes 16/26 | 400 | 0 | `text-base` (notes: `text-base leading-relaxed`) | Notes, empty-state explanations on large surfaces |
| small | sans | 14/20 | 400 (500 for buttons, tabs, nav) | 0 | `text-sm` | Authors, controls, descriptions, toasts, table-like rows |
| caption | sans | 12/16 | 500 | 0.01em | `text-xs font-medium` | Chart month labels and bar counts, notes character counter |
| mono | mono | 13/20 | 400 | 0 | `font-mono text-[13px]` | Reserved (unused) |

Rules:
- Headings are `font-medium` (500) serif. Newsreader at 600+ looks heavy. Sans emphasis is `font-medium` or `font-semibold` (numeric only).
- Secondary information (authors, descriptions, labels on stat cards, dates' labels) is `text-muted-foreground`.
- Form inputs use `text-base sm:text-sm` (16px on phones stops iOS zoom on focus).
- Long titles: card titles `line-clamp-2`; authors `truncate`. Detail title wraps freely (`break-words`).

---

## 4. Layout

### 4.1 App shell: a top bar, no sidebar

There are only three destinations, so there is no sidebar and no hamburger (ARCHITECTURE §5.6).

```
┌────────────────────────────────────────────────────────────────────────┐
│ [■ Shelfwise]  Library  Stats  Settings              [+ Add book] [☾] │  h-14, sticky
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   <main id="main">  container: max-w-5xl, px-4 sm:px-6 lg:px-8         │
│                     py-6 sm:py-8, pb-16                                │
└────────────────────────────────────────────────────────────────────────┘
```

**Container recipe** (used by the header inner row and `<main>`, so their left edges align):
`mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8` (1024px max, 960px usable at `lg`).

**SiteHeader:**
- The header is `sticky top-0 z-40 h-14 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70`.
- Its inner row is `container flex h-14 items-center gap-2`.
- The first focusable element is a skip link: `<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 rounded-md bg-card px-3 py-2 text-sm font-medium shadow-sm ring-2 ring-ring">Skip to content</a>`.
- **Brand**: a link to `/` with `aria-label="Shelfwise"`. It must never be named "Library", which collides with the nav link.
  - Classes: `inline-flex h-11 items-center gap-2 rounded-md pr-1 focus-visible:…`.
  - Contents: a `size-8 rounded-md bg-primary text-primary-foreground grid place-items-center` tile holding `BookOpen` at 18px (`size-[18px]`, aria-hidden), plus the wordmark `<span class="hidden sm:inline font-serif text-lg font-medium">Shelfwise</span>`.
- **MainNav** is `<nav aria-label="Main">` with `ml-1 sm:ml-4 flex items-stretch self-stretch`. Each link:
  - `relative inline-flex h-14 items-center px-2 sm:px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-md`
  - Active (`aria-current="page"`) adds `text-foreground` and an underline: `after:absolute after:inset-x-2 sm:after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary`.
  - "Library" is active on `/` only. Stats and Settings are active on their own paths. Book pages activate nothing.
- **Right cluster** is `ml-auto flex items-center gap-1`:
  - "Add book" is a **link** styled as a primary button.
    - `sm+`: `h-9 px-3 gap-1.5` with the `Plus` icon (16px) and the text "Add book".
    - `<sm`: icon-only `size-11` with `aria-label="Add book"`. The text is not rendered, so the name comes from `aria-label`. Put `aria-label="Add book"` on the link at every size so the name stays identical.
  - "Toggle theme" is a ghost icon button, `size-11 sm:size-10`. It renders both icons and lets CSS pick, so there is no hydration mismatch: `<Moon class="size-5 dark:hidden"/>` and `<Sun class="size-5 hidden dark:block"/>`, both aria-hidden.

**Width budget at 375px** (must not scroll horizontally): 343px usable = brand 44 + nav ≈ 186 (64 + 50 + 72) + add 44 + toggle 44 + gaps ≈ 12 → **≈ 330px**. Do not add anything else to the header.

**Toaster** (in the root layout): `<Toaster position="bottom-right" />`. Sonner goes full-width bottom automatically on phones.

### 4.2 Page header pattern (every page)

```
<header class="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div class="min-w-0">
    <h1 class="h1-classes">Library</h1>
    <p class="mt-1 text-sm text-muted-foreground">One-line description</p>
  </div>
  <!-- optional right slot: the page's primary action, if it has its own -->
</header>
```

Descriptions (exact copy):
- Library: "Everything you want to read, are reading and have finished."
- Add book: "Save a book to your shelf."
- Edit book: "Update the details and save your changes."
- Stats: "Your reading at a glance."
- Settings: "Appearance and your data."

**Never render a second "Add book" link** on any page. The header owns it, and a duplicate would break `getByRole("link", { name: "Add book" })`. Empty states use "Add your first book" or "Add a book" exactly as specified.

### 4.3 Spacing scale (4px base, no other values)

| Step | px | Tailwind | Use |
|---|---|---|---|
| 1 | 4 | `1` | icon–text nudge, tight stacks |
| 2 | 8 | `2` | gap in button groups, label→input |
| 3 | 12 | `3` | stat-grid gap on phone, list row gaps |
| 4 | 16 | `4` | card padding (phone), grid gap, page padding (phone) |
| 6 | 24 | `6` | card padding (desktop), section gaps, form field gaps |
| 8 | 32 | `8` | page padding (desktop), page header → content |
| 12 | 48 | `12` | empty-state vertical padding (phone) |
| 16 | 64 | `16` | empty-state vertical padding (desktop), page bottom padding |

Fixed sizes also sit on the 4px grid: covers 56×84, 64×96, 80×120, 160×240; controls 36, 40 and 44.

### 4.4 Breakpoints and grids

Use the Tailwind defaults: `sm` 640, `md` 768, `lg` 1024.

| Region | <640 (phone, 375–390) | 640–1023 | ≥1024 |
|---|---|---|---|
| Library grid | 1 column | 2 columns | 3 columns |
| Stats cards | 2 columns | 4 columns (`md+`); 2 columns at `sm` | 4 columns |
| Chart + distribution | stacked | stacked | `lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]` |
| Detail hero | cover 80×120 beside title; controls full width below | cover 160×240 in the left column; everything else in the right column | same |
| Detail body (Details + Notes) | stacked | stacked | `md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]` |
| Forms | full width | `max-w-xl` | `max-w-xl` |
| Settings | full width | `max-w-2xl` | `max-w-2xl` |

Library grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`. Cards stretch to equal height per row (the grid default) and use `h-full`.

### 4.5 Collapse at 390px (and 375px)

- **Header**: brand icon only; the three nav links stay as text; "Add book" becomes an icon; the toggle stays.
- **Page padding**: 16px. Section padding inside cards: 16px.
- **Status tabs**: a single row inside `-mx-4 px-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`. The row scrolls **inside its own container**, never the page. With demo data all four tabs are ≈360px, so the last tab may peek past the edge; that hint of scrolling is intended.
- **Toolbar**: search full width, then the sort select full width below it (`flex flex-col gap-2 sm:flex-row sm:items-center`). The "Sort by" label is `sr-only` below `sm`.
- **Book cards**: one column, horizontal layout (cover left, text right). The card is never narrower than ≈343px.
- **Pick-my-next-read strip**: the text sits above the button; the button is `w-full`.
- **Stats**: 2-column stat grid (≈165px cells). The chart has 12 bars at ≈22px each. Month labels become single letters (`<span class="sm:hidden">S</span><span class="hidden sm:inline">Sep</span>`, all aria-hidden). Nothing may overflow 343px.
- **Detail**: an 80×120 cover beside the title and author. Status, rating and actions are full width below; Edit and Delete are `flex-1` each.
- **Forms**: Status and Pages stack. Buttons stack full width, primary on top (`flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`).
- **Dialogs**: `w-[calc(100%-2rem)]` (shadcn default) with footer buttons stacked full width, primary on top.
- **Touch targets**: every interactive element is ≥44px tall below `sm` (see §5.1 sizes).

---

## 5. Components

### 5.1 shadcn/ui inventory

Install: `button input textarea label form dialog alert-dialog radio-group skeleton sonner`. Handwritten: `native-select.tsx`.

| Need | Component | Notes |
|---|---|---|
| All buttons and button-styled links | `Button` (with `asChild` + `Link` for links) | Sizes below |
| Text fields | `Input`, `Textarea` | `bg-card border-input` |
| Status, Sort | `native-select.tsx` (a shadcn-styled `<select>`) | **Not** Radix Select (ARCHITECTURE §7) |
| Add/Edit form | `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` | Wires `aria-describedby` and `aria-invalid` |
| Theme choice | `RadioGroup`, `RadioGroupItem`, `Label` | Tiles, §6.6 |
| Pick next read, goal editor | `Dialog` | role `dialog` |
| Delete, Delete all, Restore | `AlertDialog` via `common/confirm-dialog.tsx` | role `alertdialog` |
| Loading | `Skeleton` | Change its default `bg-accent` to **`bg-muted`** |
| Feedback | `Sonner` `Toaster` | §5.8 |
| Status tabs | Hand-rolled `role="tablist"` of `Link role="tab"` | **Not** shadcn Tabs |
| Goal progress | Hand-rolled `div role="progressbar"` | **Not** Radix Progress |
| Cards and surfaces | Plain elements with the surface recipe | Do **not** use shadcn `Card` (its built-in `py-6 gap-6` fights our spacing) |

**Surface recipe**: `rounded-lg border bg-card text-card-foreground`, padding `p-4 sm:p-6` (sections) or `p-4` (book cards, stat cards on phones). No shadow.

**Focus ring (override the shadcn default everywhere).** shadcn v4 ships `focus-visible:ring-[3px] focus-visible:ring-ring/50`, which halves the ring's contrast. Replace it in `button`, `input`, `textarea`, `radio-group`, `native-select` and every hand-rolled link with:

```
focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
```

Inside cards use `ring-offset-card`. For full-height nav links use `ring-inset` with no offset. `outline-hidden` keeps a real outline in Windows forced-colors mode.

**Button sizes** (update `buttonVariants`):

| size | classes | Where |
|---|---|---|
| `default` | `h-11 sm:h-10 px-4 gap-2 text-sm font-medium rounded-md` | Form submit/cancel, dialog buttons, empty-state actions |
| `sm` | `h-11 sm:h-9 px-3 gap-1.5 text-sm font-medium rounded-md` | Header "Add book", detail Edit/Delete, Set/Edit goal, Pick my next read, settings rows |
| `icon` | `size-11 sm:size-10 rounded-md` | Toggle theme, header Add book below `sm` |
| `icon-sm` | `size-11 sm:size-9 rounded-md` | Clear rating on cards, star buttons |

Icons: lucide at 16px (`size-4`) inside buttons and inline with text, 20px (`size-5`) for the theme toggle and stars at `md`. Always `aria-hidden`. Default stroke width everywhere.

### 5.2 Button hierarchy

At most one solid primary per view, not counting the global header "Add book".

| Level | Variant | Classes | Used for |
|---|---|---|---|
| Primary | `default` | `bg-primary text-primary-foreground hover:bg-primary/90` | Save book, Save changes, Save goal, Start reading, Restore (in its dialog), Add your first book, Add a book, Back to library (not-found), Try again, header Add book |
| Secondary | `outline` | `border border-input bg-card hover:bg-accent hover:text-accent-foreground` | Edit, Cancel, Set goal, Edit goal, Pick my next read, Pick another, Clear search, View all books, Restore demo data |
| Tertiary | `ghost` | `hover:bg-accent hover:text-accent-foreground` | Toggle theme, Clear rating, Back to library (detail page, `-ml-3` so its text aligns with the left edge) |
| Danger (trigger) | `outline` + `text-destructive hover:text-destructive hover:bg-accent` | same border | "Delete" on detail, "Delete all books", "Remove goal" (ghost variant) |
| Danger (confirm) | `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | Only the confirm button of a destructive AlertDialog: "Delete", "Delete all" |

Disabled: `disabled:pointer-events-none disabled:opacity-50`. Pending submit buttons read "Saving…" and keep their width (`min-w-28`), so the label swap doesn't shift the layout.

### 5.3 Native select (Status, Sort)

`native-select.tsx` wraps the select in `relative`:
- The select: `h-11 sm:h-9 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-9 text-base sm:text-sm text-foreground transition-colors duration-150 hover:border-foreground/40 disabled:opacity-50` plus the focus ring.
- A `ChevronDown` sits at `pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground`, aria-hidden.
- `color-scheme: dark` (set in globals) makes the option popup dark in dark mode.

**StatusSelect** adds a leading 8px status dot (aria-hidden, `absolute left-3 top-1/2 -translate-y-1/2 size-2 rounded-full`), and the select gets `pl-8`:
- want: `ring-1 ring-inset ring-muted-foreground` (hollow)
- reading: `bg-primary`
- finished: `bg-success`

The dot follows the optimistic value. The select is **only** labelled by `aria-label="Status for {title}"`. Never add a visible `<label>` to it, because that would change its name.

### 5.4 Form pattern (Add and Edit)

- The page holds a surface card: `max-w-xl rounded-lg border bg-card p-4 sm:p-6`. The form is `noValidate` with `space-y-6`.
- Each field is a `FormItem` with `space-y-2`, containing:
  - `FormLabel` (`text-sm font-medium`),
  - the control,
  - then `FormMessage` (`text-sm text-destructive`) **or**, when valid, an optional helper line (`text-sm text-muted-foreground`).
- **Optional fields**: the label text stays exactly "Pages" / "Notes". Put "Optional" in a sibling span on the label row, **outside** the `<label>`: `<div class="flex items-baseline justify-between"><FormLabel>Pages</FormLabel><span class="text-xs text-muted-foreground">Optional</span></div>`.
- Fields in order:
  1. Title (full width, `autoFocus` on /books/new only).
  2. Author (full width).
  3. `grid gap-6 sm:grid-cols-2`: Status (native select, a visible `<label>` "Status" is correct here) | Pages (`inputMode="numeric"`, placeholder "e.g. 320").
  4. Notes: textarea `min-h-32` (rows 5), `resize-y`, placeholder "What stood out, who recommended it…". A counter `{n} / 2000` sits right-aligned below it in `text-xs text-muted-foreground tabular-nums`, aria-hidden.
  5. The Rating fieldset (when Status = Finished), §5.5. It enters with `animate-in fade-in-0 duration-150`.
- **Invalid field**: `aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive`. On submit RHF focuses the first invalid field (`shouldFocusError` stays true).
- **Action row**: `flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end`. It holds Cancel (outline link) and Save (primary). The primary is rightmost on desktop and on top on phones.

### 5.5 Stars

Filled star: `Star` with `fill-primary text-primary`. Empty star: `Star` with `text-input` (outline only, no fill). Stars are always icons, never characters.

**RatingControl (card: `sm`, detail: `md`).** Both states render the same two rows, so rating or clearing never changes the card height.

Unrated:
```
<div role="group" aria-labelledby="rate-{id}">
  <div class="flex items-baseline justify-between">
    <span id="rate-{id}" class="text-sm font-medium">Rate this book</span>
    <span class="text-sm text-muted-foreground">Not rated</span>
  </div>
  <div class="-ml-2.5 flex">   <!-- aligns the first star glyph with the text edge -->
    5 × <button aria-label="Rate N star(s)" class="size-11 sm:size-9 grid place-items-center rounded-md …focus">
          <Star class="size-5 text-input transition-colors duration-150"/>
        </button>
  </div>
</div>
```
Hover and focus preview: while star N is hovered or focused, stars 1…N switch to `fill-primary/25 text-primary`. Implement this with a `data-preview` index in state and no layout change.

Rated:
```
<div>
  <span class="text-sm font-medium text-muted-foreground" aria-hidden="true">Your rating</span>
  <div class="flex items-center justify-between">
    <div role="img" aria-label="Rated N out of 5" class="flex gap-0.5">5 × <Star size-4 (sm) | size-5 (md) aria-hidden/></div>
    card:   <Button variant="ghost" size="icon-sm" aria-label="Clear rating"><X class="size-4"/></Button>
    detail: <Button variant="ghost" size="sm">Clear rating</Button>
  </div>
</div>
```
The "Your rating" caption is aria-hidden so the only text is the stars' `aria-label` (ARCHITECTURE D1). The row height matches the unrated star row (`min-h-11 sm:min-h-9`).

**RatingInput (form)**: `<fieldset>` with `<legend class="text-sm font-medium mb-2">Rating</legend>`. It uses the same 5 buttons (`type="button"`, `aria-pressed`). Pressed stars and every star below them are `fill-primary text-primary`. "Clear rating" is a ghost `sm` button to the right, shown only when a value is set.

### 5.6 Book cover (`book-cover.tsx`)

```
<div aria-hidden="true"
     class="relative grid shrink-0 place-items-center overflow-hidden rounded-l-[3px] rounded-r-sm
            {COVER_CLASSES[tone-1]} font-serif font-medium select-none
            ring-1 ring-inset ring-black/10 dark:ring-white/10 {size}">
  <span class="absolute inset-y-0 left-0 w-1.5 bg-black/15"></span>   <!-- spine -->
  <span class="absolute inset-x-3 top-3 h-px bg-current opacity-30"></span>     <!-- top rule -->
  <span class="absolute inset-x-3 bottom-3 h-px bg-current opacity-30"></span>  <!-- bottom rule -->
  {initials}
</div>
```

| size | box | initials |
|---|---|---|
| `sm` (card) | `w-14 h-21 sm:w-16 sm:h-24` | `text-lg sm:text-xl` |
| `md` (next-read dialog) | `w-16 h-24` | `text-xl` |
| `lg` (detail) | `w-20 h-30 sm:w-40 sm:h-60` | `text-2xl sm:text-5xl` |

Top and bottom rules: `inset-x-2 top-2 / bottom-2` at `sm`, `inset-x-3 top-3 / bottom-3` at `md` and `lg`. Initials are `tracking-wide`.

### 5.7 Lists and cards

**Book card** (`book-card.tsx`):
```
<article aria-labelledby="book-{id}-title"
         class="flex h-full gap-4 rounded-lg border bg-card p-4 transition-colors duration-150 hover:border-foreground/20">
  <BookCover size="sm"/>
  <div class="flex min-w-0 flex-1 flex-col">
    <h2 id="book-{id}-title" class="font-serif text-lg font-medium leading-6 line-clamp-2">
      <Link href="/books/{id}" class="rounded-sm underline-offset-4 decoration-primary/60 hover:underline focus-visible:… ring-offset-card">{title}</Link>
    </h2>
    <p class="mt-1 truncate text-sm text-muted-foreground">{author}</p>
    <div class="mt-auto space-y-3 pt-4">
      <StatusSelect/>
      {finished && <RatingControl size="sm"/>}
    </div>
  </div>
</article>
```
The title link is the only link. The whole card is **not** clickable, because it contains controls.

**Status tabs**:
- Container: `role="tablist" aria-label="Filter by status"`, classes `flex gap-1 border-b` inside the scroll wrapper (§4.5).
- Tab: `relative inline-flex h-11 shrink-0 items-center whitespace-nowrap px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground`.
- Selected (`aria-selected="true"`): `text-foreground` plus the underline `after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary`.
- Content is `{label}<span class="text-muted-foreground tabular-nums">{" · "}{count}</span>`. The accessible name must be exactly `All · 12`, with U+00B7 and single spaces; no extra whitespace in the JSX.

**Toolbar**:
- Search: `relative flex-1 sm:max-w-sm`, with `Search` (16px) at `absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground`. The `Input type="search"` has `pl-9 h-11 sm:h-10`.
- **No inline clear (×) button.** It would duplicate the "Clear search" button name.
- Sort: `flex items-center gap-2 sm:ml-auto`, containing `<label for="sort" class="sr-only sm:not-sr-only text-sm text-muted-foreground whitespace-nowrap">Sort by</label>` and a native select `sm:w-44`.

**Definition rows** (detail "Details"):
- `<dl class="divide-y">`. Each row is `<div class="flex items-baseline justify-between gap-4 py-3">`, containing `<dt class="text-sm text-muted-foreground">` + `{" "}` + `<dd class="text-sm font-medium tabular-nums text-right">`.
- The literal space is required (ARCHITECTURE §5.3); flex hides it visually.
- Numbers and dates are right-aligned.

**Stat card**:
- `<section aria-labelledby="stat-{key}" class="flex min-h-32 flex-col justify-between gap-3 rounded-lg border bg-card p-4 sm:p-5">`.
- Top row: `flex items-start justify-between`, holding `<h2 id=… class="text-sm font-medium text-muted-foreground">{title}</h2>` and an icon `size-4 text-muted-foreground` (aria-hidden).
- Bottom: `<p data-testid="stat-value" class="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>`.
- Icons: Total books `Library`, Want to read `Bookmark`, Reading `BookOpen`, Finished `BookCheck`, Finished this year `CalendarCheck`, Pages read `FileText`, Average rating `Star`.

### 5.8 Empty states (`common/empty-state.tsx`)

```
<div class="flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center sm:py-16">
  <div class="grid size-12 place-items-center rounded-full bg-muted">
    <Icon class="size-6 text-muted-foreground" aria-hidden/>
  </div>
  <h2 class="mt-4 font-serif text-xl font-medium">{title}</h2>
  <p class="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
  <div class="mt-6">{action}</div>
</div>
```
Every empty state has an icon, one title line, one explanation line and exactly one action. The copy is in §6.

### 5.9 Skeletons

- Use `Skeleton` (`bg-muted animate-pulse rounded-md`) inside the **same** surface chrome as the real content (same border, padding, radius and grid). Real content then replaces skeletons with no jump.
- No spinners for page loads. The only spinner allowed is `Loader2 class="size-4 animate-spin"` inside a pending submit button, before "Saving…".
- Skeleton widths are fixed literals, never random (no hydration mismatch).

Library skeleton, card skeleton:
```
<div class="flex gap-4 rounded-lg border bg-card p-4">
  <Skeleton class="w-14 h-21 sm:w-16 sm:h-24 rounded-sm"/>
  <div class="flex flex-1 flex-col"><Skeleton class="h-5 w-3/4"/><Skeleton class="mt-2 h-4 w-1/2"/>
    <Skeleton class="mt-auto h-11 sm:h-9 w-full"/></div>
</div>
```

### 5.10 Toasts (sonner)

- Configure `<Toaster position="bottom-right" toastOptions={{ classNames: {...} }} />` with these classes:
  - `toast`: `bg-popover text-popover-foreground border border-border rounded-lg shadow-md font-sans`
  - `title`: `text-sm font-medium`
  - `description`: `text-sm text-muted-foreground`
  - `actionButton`: `!bg-primary !text-primary-foreground !rounded-md !h-8 !px-3 !text-sm !font-medium`
  - `icon`: `[&_svg]:size-4`
  - `success`: `[&_[data-icon]]:text-success`
  - `error`: `[&_[data-icon]]:text-destructive`
- `richColors` stays **off**, because we want calm, neutral toasts.
- Durations: 4000ms default, 6000ms for "Book deleted" (with "Undo").
- Use `toast.success` for positive results, `toast.error` for "Couldn't save changes. Try again.", and plain `toast(…)` for "Book deleted".
- Copy is exactly as in ARCHITECTURE §6.4.

### 5.11 Confirmation dialogs

- `AlertDialogContent`: `rounded-xl border bg-popover p-6 shadow-lg sm:max-w-md`.
- Title: `font-serif text-xl font-medium`. Description: `text-sm text-muted-foreground`.
- Footer: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`. It holds Cancel (`outline`) and the confirm button: `destructive` for Delete / Delete all, `default` for Restore.
- Focus lands on **Cancel** when the dialog opens (Radix AlertDialog default) and returns to the trigger on close.
- While the action runs, the confirm button is disabled and shows the `Loader2` spinner. Keep the dialog open until the action resolves, then close it.
- Overlay: `bg-foreground/40 dark:bg-black/60`, with no blur.

---

## 6. Screens

### 6.1 Library `/`

Regions, top to bottom:
1. Page header: h1 "Library" and its description. No right slot.
2. Status tabs: "All · N", "Want to read · N", "Reading · N", "Finished · N", with the underline under the active tab.
3. Toolbar (`mt-4`): the "Search books" searchbox on the left and "Sort by" on the right (§5.7).
4. Pick-next strip (`mt-4`, Want to read tab only, when want > 0):
   - `flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between`.
   - Text on the left: "Can't decide what to read next?" in `text-sm text-muted-foreground`.
   - An outline `sm` button on the right: `Shuffle` icon + "Pick my next read", `w-full sm:w-auto`.
5. Content (`mt-6`): the book grid, 1/2/3 columns.

**Primary action:** the header "Add book". On this page, the per-card status select is the main interaction.

**Populated (demo):** 12 cards in "Recently added" order (Piranesi first). Want and reading cards show cover, title, author and status select. Finished cards also show the rating row, and all 7 finished demo books are rated.

**Empty states** (the precedence is fixed by ARCHITECTURE §5.1):

| Case | Icon | Title (h2) | Line | Action |
|---|---|---|---|---|
| Library empty | `BookOpen` | Your shelf is empty | Add the books you want to read, are reading or have finished. | Primary link "Add your first book" (`Plus`) → `/books/new` |
| Search, no match | `Search` | `No books match "{q}"` | Try a different title or author. | Outline button "Clear search" |
| Tab empty (want) | `Bookmark` | No books in Want to read | Save a book you'd like to read next. | Outline link "View all books" → the all-tab href |
| Tab empty (reading) | `BookOpen` | No books in Reading | Set a book to Reading when you start it. | same |
| Tab empty (finished) | `BookCheck` | No books in Finished | Finished books and their ratings appear here. | same |

The tabs and toolbar stay visible above every empty state, including "Library empty" (where every tab shows 0), exactly as ARCHITECTURE §5.1 renders them. Do not hide them conditionally.

**Loading:** skeletons for the h1 (`h-8 w-32`), the description (`h-4 w-72`), a tab row (4 × `h-4` at widths 56/112/80/84 on a 44px-tall row with `border-b`), the toolbar (`h-11 sm:h-10` search + sort) and 6 card skeletons.

**"Your next read" dialog** (`Dialog`, `sm:max-w-md`, `rounded-xl p-6`):
- Title "Your next read" (h2 style), with the description "A random pick from your Want to read list."
- Body: `flex gap-4 items-center rounded-lg border bg-card p-4`, holding a `md` cover and `<h3 class="font-serif text-lg font-medium">{title}</h3>` + `<p class="text-sm text-muted-foreground">{author}</p>`. When "Pick another" runs, the body cross-fades (`animate-in fade-in-0 duration-150`, keyed by id).
- Footer: "Pick another" (outline, `Shuffle`, disabled when there is 1 candidate) and "Start reading" (primary, `BookOpen`).

### 6.2 Add book `/books/new`

Regions:
1. Page header: h1 "Add book" and its description.
2. Form card (`max-w-xl`): Title, Author, Status | Pages, Notes, then Rating (only when Finished).
3. Action row: "Cancel" (outline link → `/`) and **"Save book" (primary)**.

**Primary action:** Save book.

**Empty (initial):** blank fields; Status is "Want to read"; there is no rating fieldset; the Title field is focused.

**Error state:** each invalid field has a destructive border and its message directly under it ("Title is required", …). Nothing else moves; the messages take the helper-line slot.

**Pending:** the button shows a spinner and "Saving…", and is disabled. Fields stay editable-looking but the submit can't fire twice.

**Loading:** static page, so no skeleton is needed.

### 6.3 Edit book `/books/[id]/edit`

The same layout as Add book, with these differences:
- h1 "Edit book" with the description "Update the details and save your changes."
- The fields are prefilled. The rating fieldset shows the current rating when Finished.
- Buttons: "Cancel" (outline link → `/books/{id}`) and **"Save changes" (primary)**.
- Loading (`edit/loading.tsx`): h1 skeleton, then a form card with 5 label/field skeleton pairs (`h-4 w-16` + `h-11 sm:h-10 w-full`; the Notes field is `h-32`), and the action row with two button skeletons.
- An unknown id shows the Book not found page (§6.7).

### 6.4 Book detail `/books/[id]`

Regions, top to bottom:
1. "Back to library": ghost `sm` link (`ArrowLeft` + text, `-ml-3`), `mb-4`.
2. **Hero**: `grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-8`.
   - Cover `lg`: column 1, `sm:row-span-2`.
   - Title block (column 2): h1 **display** style (the book title), then `mt-1 text-base text-muted-foreground` author.
   - Controls block (`col-span-2 sm:col-span-1 sm:col-start-2`, `space-y-4 sm:max-w-sm`):
     - the StatusSelect (full width),
     - the RatingControl `md` (finished only),
     - an action row `flex gap-2` with "Edit" (outline `sm`, `Pencil`, link to edit) and "Delete" (danger trigger `sm`, `Trash2`). Both are `flex-1 sm:flex-none`.
3. **Body** (`mt-8 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]`), two surfaces:
   - "Details": h2 + `dl` rows Pages, Added on, Started on, Finished on. Unset values show "—", and pages without a value show "—".
   - "Notes": h2 + `whitespace-pre-wrap text-base leading-relaxed`. With no notes it shows `text-sm text-muted-foreground` "No notes yet".

**Primary action:** changing status. Edit is secondary and Delete is danger. There is no solid primary on this page.

**Populated (demo Hobbit):** a cloth-tone cover with "TH", title "The Hobbit", J.R.R. Tolkien, status Finished, 5 filled stars + "Clear rating", Pages 310, all three dates set, and the note "Reread before winter. Still perfect."

**Want book:** there is no rating block, and "Started on —" and "Finished on —" show.

**Delete dialog:**
- Title `Delete "{title}"?`.
- Description: "It will be removed from your library. You can undo this right after."
- Buttons: Cancel and **Delete** (destructive).

**Loading:**
- The back-link skeleton (`h-4 w-28`).
- Hero skeletons: a cover-sized block, a title (`h-9 w-2/3`), an author (`h-5 w-1/3`), a select (`h-11 sm:h-9 w-full sm:max-w-sm`) and two button skeletons.
- Two body surfaces with 4 row skeletons and 3 line skeletons.

### 6.5 Stats `/stats`

Regions, top to bottom:
1. Page header: h1 "Stats" and its description. No right slot.
2. **Stat grid**: `grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4`. The 7 stat cards appear in order (Total books, Want to read, Reading, Finished, Finished this year, Pages read, Average rating). The **GoalCard is the 8th cell**, completing a 4×2 grid on desktop and 2×4 on phones. The DOM order still matches ARCHITECTURE: the stat cards, then the goal.
3. **Charts row** (`mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`):
   - **Finished per month**: a surface `p-4 sm:p-6`.
     - Header row: h2 "Finished per month" + `text-xs text-muted-foreground` "Last 12 months" on the right.
     - Chart: `<ol class="mt-6 flex h-40 items-end gap-1 sm:gap-2">`. Each `<li class="flex min-w-0 flex-1 flex-col items-center gap-2">` holds:
       - a count label (`text-xs tabular-nums text-muted-foreground`, aria-hidden, omitted for 0),
       - the bar track `flex h-28 w-full items-end justify-center`,
       - the bar `<div role="img" aria-label="Sep 2026: 1 book" class="w-full max-w-8 rounded-t-sm bg-chart-1">`. Its height is `count / max * 100%`, and 0 renders as `h-1 bg-input`.
       - Below the bar, the month label (`text-xs text-muted-foreground`, aria-hidden). The current month's label is `text-foreground font-medium`.
       - Heights are inline `style={{ height: "…%" }}`.
   - **Rating distribution**: a surface `p-4 sm:p-6`, h2, then `<ul class="mt-6 space-y-3">`. Each `<li aria-label="5 stars: 3" class="grid grid-cols-[4rem_minmax(0,1fr)_2rem] items-center gap-3">`:
     - label `text-sm` "5 stars",
     - a track `h-2 rounded-full bg-muted` with the fill `h-2 rounded-full bg-chart-1` at `count / maxCount * 100%` (0 → no fill),
     - the count `text-sm tabular-nums text-right`.

**GoalCard** (region "Reading goal {year}", same surface and `min-h-32` as the stat cards, `flex flex-col justify-between gap-3`):
- Title: `text-sm font-medium text-muted-foreground` "Reading goal 2026" + a `Target` icon.
- No goal: `text-sm text-muted-foreground` "No goal set yet", then an outline `sm` "Set goal" at `w-full sm:w-auto` (self-start).
- With goal:
  - `<p class="text-base font-medium tabular-nums">6 of 24 books</p>` (one text node),
  - the progressbar (`role="progressbar" aria-label="Reading goal progress"`): track `h-2 rounded-full bg-muted overflow-hidden`, fill `h-full rounded-full bg-primary transition-[width] duration-200`, capped at 100% visually,
  - then an outline `sm` "Edit goal".

**Goal dialog** (`Dialog sm:max-w-sm`):
- Title "Reading goal 2026". Description: "How many books do you want to finish this year?"
- Field: a visible label "Books this year" with an `Input inputMode="numeric"` and the error below it.
- Footer: "Remove goal" (ghost, destructive text, left-aligned via `sm:mr-auto`, only when a goal exists), "Cancel" (outline) and **"Save goal"** (primary).

**Primary action:** Set goal / Edit goal. It is outline-styled, because the page is a read-only dashboard with no solid primary.

**Populated (demo):** 12 / 3 / 2 / 7 / (6 in September) / 2,210 / 4.3. The chart has terracotta bars at 7 months with 4px stubs elsewhere, and the current month is last and highlighted. Distribution bars: 3, 3, 1, 0, 0.

**Empty (no books):** the page header, then the empty state: `BarChart3` icon, "No stats yet", "Add a few books and your stats will show up here.", and the primary link "Add a book" → `/books/new`. There is no grid and no chart.

**Loading:** header skeletons, then 8 cells with the same surface and `min-h-32`, each a `h-4 w-24` + `h-8 w-16`. The chart surface has 12 bar skeletons at fixed heights `[40,65,30,80,55,20,70,45,60,35,75,50]%`, and the distribution surface has 5 row skeletons.

### 6.6 Settings `/settings`

The page is `max-w-2xl`. Regions:
1. Page header: h1 "Settings" and its description.
2. **Appearance** (a surface, `p-4 sm:p-6`):
   - h2 "Appearance", then the line "Choose how Shelfwise looks on this device."
   - `RadioGroup aria-label="Theme"` as `mt-4 grid gap-2 sm:grid-cols-3`.
   - Each option is a `Label htmlFor` tile:
     - `flex h-11 cursor-pointer items-center gap-3 rounded-md border border-input bg-card px-3 text-sm font-medium transition-colors duration-150 hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5`
     - contents: the `RadioGroupItem` (checked dot `bg-primary`), an icon (`Sun` / `Moon` / `Monitor`, 16px, muted) and the text "Light" / "Dark" / "System".
   - Before mount the group is disabled but **not dimmed** (`data-[disabled]:opacity-100`), so there is no flash.
3. **Your data** (a surface, `mt-6`): h2 "Your data", then `divide-y` rows (`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between`, first row `pt-4`). Each row has a title and description on the left and a button on the right (`w-full sm:w-auto`):
   - Row 1: title "Demo shelf"; description "Replace all books with the 12 demo books and clear your reading goal."; button outline "Restore demo data" (`RotateCcw`).
   - Row 2: title "Start fresh"; description "Permanently remove every book. Your reading goal is kept."; button danger trigger "Delete all books" (`Trash2`).
   - Row titles are deliberately **not** "Restore demo data" / "Delete all books", so the button names stay unique on the page.
4. Dialogs:
   - "Restore demo data?": "This replaces all your books with the 12 demo books and clears your reading goal." Buttons: Cancel and **Restore** (primary).
   - "Delete all books?": "This permanently removes every book on your shelf. It can't be undone." Buttons: Cancel and **Delete all** (destructive).

**Primary action:** none solid. The page is preferences plus two guarded operations. There are no empty or loading states (static page). With no books the page looks the same.

### 6.7 Not found (`/nope`, `/books/does-not-exist`)

Directly under the header, inside `<main>`, a centered empty state (`mt-8 sm:mt-16`, no dashed border, so use `border-0`):
- **Page not found**: icon `Compass`, h1-sized serif title "Page not found", the line "That page doesn't exist or has moved.", and the primary link "Back to library" (`ArrowLeft`).
- **Book not found**: icon `BookX`, "Book not found", "It may have been deleted, or the link is wrong.", and the primary link "Back to library".

Here the title is the page's `h1` (not h2), using the h1 classes.

### 6.8 Error boundary

The same centered pattern:
- The icon `TriangleAlert` in `text-destructive` on a `bg-muted` circle.
- h1 "Something went wrong" and the line "This page didn't load. Your books are still here."
- The primary button "Try again" (`RotateCcw`).
- `global-error.tsx` repeats this with inline-safe classes inside its own `<html><body class="font-sans bg-background text-foreground">`.

---

## 7. Motion and polish

- **Durations:** 150ms for color, border and opacity (`transition-colors duration-150`). 200ms for dialogs (the shadcn `fade-in-0 zoom-in-95` defaults, set to `duration-200`) and for the goal bar width. Nothing moves longer than 200ms. There is no bounce and no stagger.
- **Hover** (pointer devices only, via `hover:`):
  - Buttons: primary `bg-primary/90`; outline and ghost `bg-accent`.
  - Book card: the border goes to `border-foreground/20`, with no lift and no shadow.
  - Title link: underline in `decoration-primary/60`.
  - Nav and tab links: `text-muted-foreground` → `text-foreground`.
  - Selects: the border goes to `foreground/40`.
  - Stars: the preview fill (§5.5).
- **Focus**: every interactive element uses the §5.1 ring (2px `ring` + 2px offset). It is always visible on keyboard focus (`focus-visible`) and never removed. Test by tabbing through each screen: header → tabs → toolbar → each card's title, status, stars.
- **Optimistic feedback**: the status dot, select value and stars update instantly. A failure reverts them and shows the error toast. Pending inline controls are `disabled` **without** dimming the whole card; only the control itself gets `opacity-50`.
- **No layout shift:**
  - The header has a fixed height, and the theme icons are CSS-switched.
  - Fonts use `next/font`, whose `adjustFontFallback` default keeps metrics close.
  - Skeletons use the same chrome as the content, and the two rating states have equal height.
  - Submit labels have `min-w-28`. Form errors appear under fields; they push later content down, which is expected and user-triggered, but they never re-layout earlier content.
  - Tab counts use `tabular-nums`. Chart bars are drawn at final height (no grow animation).
- **Reduced motion**: globals.css collapses all animations and transitions, and skeletons stop pulsing.
- **Details that make it premium:**
  - `text-wrap: balance` on headings, and `tabular-nums` on every number.
  - Real em dash "—" for empty values. Straight quotes where the spec demands them (`No books match "{q}"`, `Delete "{title}"?`).
  - The en dash in "Title (A–Z)".
  - Selection color `primary/20`.
  - `color-scheme` follows the theme, so native select popups are themed.

---

## 8. Accessibility

### 8.1 Contrast (WCAG 2.2 AA)

Ratios are computed from the token values above (sRGB relative luminance). Text must reach ≥4.5:1; UI parts and graphics must reach ≥3:1.

**Light**

| Pair | Ratio | Req. |
|---|---|---|
| foreground / background | 15.6 | 4.5 ✅ |
| foreground / card, popover | 16.2 | 4.5 ✅ |
| foreground / muted | 14.3 | 4.5 ✅ |
| foreground / secondary, accent | 13.7 | 4.5 ✅ |
| muted-foreground / background | 5.8 | 4.5 ✅ |
| muted-foreground / card | 6.0 | 4.5 ✅ |
| muted-foreground / muted | 5.3 | 4.5 ✅ |
| muted-foreground / accent (hover) | 5.1 | 4.5 ✅ |
| primary-foreground / primary (buttons, toast action) | 5.7 | 4.5 ✅ |
| primary text / background · card · muted | 5.5 · 5.8 · 5.1 | 4.5 ✅ |
| destructive-foreground / destructive | 5.9 | 4.5 ✅ |
| destructive text (errors, danger buttons) / background · card · accent | 5.8 · 6.0 · 4.9 | 4.5 ✅ |
| success-foreground / success · success / background | 5.8 · 5.7 | 4.5 ✅ |
| warning-foreground / warning | 7.7 | 4.5 ✅ |
| cover-foreground / cover-1…8 (lowest: cover-4 ochre) | 5.7 – 8.8 | 4.5 ✅ |
| ring / background · card | 5.5 · 5.8 | 3 ✅ |
| input border / background · card | 3.1 · 3.2 | 3 ✅ |
| chart-1 bars, filled stars / card | 5.8 | 3 ✅ |
| empty star (input) / card | 3.2 | 3 ✅ |

**Dark**

| Pair | Ratio | Req. |
|---|---|---|
| foreground / background | 15.2 | 4.5 ✅ |
| foreground / card · popover | 14.1 · 13.7 | 4.5 ✅ |
| foreground / muted · accent | 12.0 · 11.1 | 4.5 ✅ |
| muted-foreground / background · card | 7.8 · 7.2 | 4.5 ✅ |
| muted-foreground / muted · accent · popover | 6.1 · 5.7 · 7.0 | 4.5 ✅ |
| primary-foreground / primary | 6.5 | 4.5 ✅ |
| primary text / background · card · muted · accent | 6.5 · 6.0 · 5.1 · 4.7 | 4.5 ✅ |
| destructive-foreground / destructive | 6.5 | 4.5 ✅ |
| destructive text / background · card · accent | 6.5 · 6.0 · 4.7 | 4.5 ✅ |
| success / background · success-foreground / success | 7.6 · 7.6 | 4.5 ✅ |
| warning-foreground / warning | 8.8 | 4.5 ✅ |
| cover-foreground / cover-1…8 | 5.7 – 8.8 | 4.5 ✅ |
| ring / background · card | 6.5 · 6.0 | 3 ✅ |
| input border / background · card | 3.4 · 3.2 | 3 ✅ |
| chart-1, filled stars / card | 6.0 | 3 ✅ |
| empty star (input) / card | 3.2 | 3 ✅ |

Rules that keep these guarantees:
- Never put `primary`, `destructive` or `muted-foreground` text on a tinted surface not listed above (for example `bg-primary/10`).
- Never lower text opacity: no `text-foreground/60` or `text-muted-foreground/70`. Opacity is allowed only on decorative borders and on disabled controls (disabled controls are exempt).
- `border` (decorative) is exempt. Every control boundary uses `input`.
- Placeholder text uses `placeholder:text-muted-foreground` (≥5.8 light, ≥7.2 dark on card).

### 8.2 Targets, labels, semantics

- **Touch targets**: every button, link-button, select, input, tab, nav link, star and radio tile is ≥44×44 below `sm` (`h-11` / `size-11`). On desktop they are ≥36px. Inline text links (card titles) get a line-height of 24px and are spaced so neighbours don't overlap.
- **Labels on every input**:
  - Form fields have visible `<label>`s. "Optional" sits outside the label.
  - The Search input uses `aria-label="Search books"`; the icon and placeholder are extra, not the label.
  - Sort has a `<label>` (visually hidden below `sm`).
  - Status selects use `aria-label="Status for {title}"`.
  - The goal input has a visible label "Books this year".
  - Theme radios are labelled by their tile text.
  - Icon-only buttons (Toggle theme, Add book on phones, Clear rating on cards) have `aria-label`s.
- **Errors**: shown as text under the field (never color alone), with `aria-invalid="true"` and `aria-describedby` → message id.
- **Structure**:
  - One `h1` per page. Landmarks: `header` (banner), `nav "Main"`, `main#main`.
  - Skip link first. `<html lang="en">`.
  - Card titles are `h2` inside `article`s named by them.
- **State is never conveyed by color alone**:
  - The status dot always sits next to the status text.
  - The selected tab uses underline plus weight and color, and `aria-selected`.
  - Nav uses `aria-current`.
  - Stars have text names.
  - Chart bars have text names, and counts are also printed.
- **Dialogs**: Radix focus trap. Focus goes to Cancel in AlertDialogs, returns to the trigger on close, and Esc closes.
- **Toasts**: sonner's live region announces them. The "Undo" action is a real button reachable by keyboard for the full 6 seconds (sonner pauses on hover and focus).
- **Motion**: `prefers-reduced-motion` respected (§7).
- **Zoom and reflow**: at 375px and at 200% zoom on desktop, nothing clips and there is no page-level horizontal scroll. Only the tab row scrolls inside itself.

---

## 9. Reviewer checklist (screenshots)

1. Paper off-white background (light) or warm charcoal (dark). Never pure white page chrome or pure black.
2. Terracotta appears only on: header Add book, primary buttons, the active tab and nav underline, stars, chart bars, the goal bar, focus rings, the "reading" status dot and the brand tile.
3. Headings and book titles are serif; everything else is Inter.
4. Covers are muted book-cloth tones with serif initials, a spine shadow and thin rules.
5. Every empty state is centered in a dashed surface with an icon circle, one title, one line and one action.
6. At 390px: nav text links are visible, there is no horizontal scroll, cards are single-column, the stats grid is 2-column, the chart fits, and buttons are 44px tall.
7. Focus rings are clearly visible on every control in both themes.
8. Numbers use tabular figures. Dates look like "Sep 30, 2026". Empty values show "—".
