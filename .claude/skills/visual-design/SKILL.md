---
name: visual-design
description: Visual quality bar and concrete rules for making the app look like a polished commercial product. Use when designing, building UI, or reviewing screenshots in this repo.
---

# Visual quality bar

The target is "could be a funded startup's product": calm, confident, consistent.

## Rules that matter most
1. **One accent color.** Neutral grays for everything else; the accent marks the primary action and the current selection only.
2. **Spacing scale of 4px.** Use 4, 8, 12, 16, 24, 32, 48, 64. Section padding 24 to 32 on desktop, 16 on mobile. Never mix arbitrary values.
3. **Type scale, not ad hoc sizes.** Max three sizes on a screen plus a display size on landing/hero. Headings semibold, body regular, muted text for secondary info.
4. **Alignment.** Everything on a clear left edge; numbers right-aligned in tables; consistent card heights in grids.
5. **Hierarchy.** Each screen has one obvious primary action. Page header: title, one-line description, primary button on the right.
6. **Surfaces.** Background, card and popover tokens with 1px borders; shadows subtle (`shadow-sm`) and rare. Radius from the token everywhere.
7. **Empty states.** Centered icon in a muted circle, one-line title, one-line explanation, primary action.
8. **Loading.** Skeletons shaped like the content, not spinners, for page loads; inline spinners only inside buttons.
9. **Density.** Tables: 44 to 52px rows. Lists and cards breathe; do not cram.
10. **Mobile.** At 390px: single column, sidebar becomes a sheet/drawer, tables become cards or scroll horizontally inside their container, touch targets 44px, no horizontal page scroll.
11. **Dark mode.** Check contrast of muted text and borders; never pure black backgrounds (use the token).
12. **Micro-interactions.** `transition-colors` on hover, 150 to 200ms; focus-visible rings; toasts for results; optimistic updates where cheap.
13. **Real content.** Seed data with realistic names, dates and numbers; no lorem ipsum, no "Test 1".
14. **Icons.** lucide at 16px inline with text, 20px in nav; stroke width consistent.

## Common failures to catch
Default unstyled HTML controls, text touching container edges, misaligned baselines, inconsistent button sizes, too many colors, walls of text, giant empty areas on desktop, content clipped on mobile, low-contrast gray text, missing hover/focus states, layout shift when data loads.
