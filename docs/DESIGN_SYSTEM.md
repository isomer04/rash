# Design System

Two things live here:

1. **A reusable method** for deriving a visual direction that doesn't read as templated — portable to any project.
2. **"Ruled Ledger"**, the worked example this repo implements, with every token value.

To reuse this elsewhere: work Part 1 for your own product, use Part 2 as a rejection checklist, and lift Part 3's structure (not necessarily its values) as the shape your token layer should take. Token names are namespaced `--rash-*` here; rename to `--<yourprefix>-*` and nothing else changes.

---

## Part 1 — Method: deriving a direction

The goal is a direction you can *defend*, where every value traces to a reason. Six steps.

### 1. Survey the field, against a fixed rubric

Pick 12–15 products in your category, plus 2–3 outside it that your category imitates. Score each on the same axes: **palette / typography / layout density / motion / chrome**.

Two rules that keep this honest:

- **Cite a source per row** — the product's own marketing site, help centre, release notes, a published design extraction, or a review. Not a screenshot you eyeballed.
- **Write "not described" when no source covers a cell.** Do not invent it. An aggregate built partly from guesses is worse than a smaller honest one.

Record palette as a *family* (paper / cream / white / navy / coal) plus a count of saturated accents, rather than sampled hex. You want the shape of the field, not its colors — and sampling hex is how you accidentally copy.

### 2. Extract convergences

What does nearly everyone do? These are the category's genuine conventions. From the fintech survey behind this repo:

- Light default; dark added later as an opt-in preference. Two themes, never three.
- **One** saturated action color, almost always blue.
- Green up / red down, and nothing else competes for saturation.
- Tabular, right-aligned figures on money. Never proportional.
- An 11–12px uppercase eyebrow above figures and section headings.
- Flat-with-hairlines has already displaced the drop shadow.
- ~36px rows on a 4px base.

Convergences are not automatically wrong — most encode real usability. The point is knowing which ones you're keeping *deliberately*.

### 3. Find the divergences

Where does the field genuinely disagree? Those axes are already contested, so moving along one is cheap and buys little distinctiveness. In this survey: base hue, density (which splits by audience, not fashion), and chart palette.

### 4. Name the template tells

The failure mode is looking machine-generated. Catalogue the fingerprints explicitly so you can reject them by name — see Part 2.

### 5. Pick exactly ONE divergence axis

This is the whole method. **Choose a single axis, take it further than anyone in the survey, and derive everything else from it.** A design that diverges on five axes is noise; one that diverges on one is a position.

Here the axis was **chrome**: where every surveyed product separates information by putting it in a *container* (a card at 8–12px radius, lifted by shadow or outlined by hairline), this system separates with **rules** — a horizontal hairline, a vertical hairline, a change of weight, a change of alignment.

Watch how the rest *follows* rather than being chosen:

- Rules do the separating → the tinted-card-on-tinted-page tone shift stops being load-bearing → the base needn't be warm cream → **achromatic grey that competes with nothing**.
- Actions are found by weight and position, not by being the one colored object in a box → the accent needn't be a hue → **the accent becomes ink**.
- Chrome spends no saturation → **all saturation is freed for meaning** (gain, loss, running, warning).
- An ink link isn't distinguishable by hue → **links carry a 1px rule** — the same mechanism the whole direction runs on.

Name the direction after its mechanism. When someone asks why a panel has no radius, the answer should be a rule, not a preference.

### 6. Encode scales, then write an originality statement

Every value gets a token and a reason. Then state plainly: what was copied (nothing), what was adopted-with-departure (list it per characteristic), and where competitor values appear as *observations* versus in your token layer. Adoption recorded per characteristic beats a blanket claim of independence.

---

## Part 2 — The default-detector

Reject these by name. Two lists.

**Generic-web-template tells:**

| Tell | Why it reads as unconsidered |
|---|---|
| `bg-gray-50` page + `bg-white` cards + `shadow-sm rounded-lg` | The untouched framework default |
| `system-ui` fallback stack | Means no font was ever actually chosen |
| Emoji as feature icons | Placeholder art that shipped |
| `bg-gradient-to-br from-blue-50` hero | Ships with every starter |
| `text-5xl font-bold` headline | The default size ramp, unexamined |
| Framework logos left in `public/` | Nobody swept the directory |

**AI-tooling fingerprints** — the defaults generative design tools converge on:

| Fingerprint | Constraint if you keep it |
|---|---|
| Teal-adjacent accent on every CTA, focus ring and chart fill | Don't. It's the single most catalogued tell |
| Animated status dot in the nav signalling "live" by reflex | Permit **only** while a job actually holds a non-terminal status, and only on that indicator — never on a card, never in nav, never at idle |
| Serif headline over sans body | Rare in fintech, but the *most* predictable AI output. If your failure mode is looking machine-generated, the AI default outweighs the category rarity |
| 4px colored rule left of every card | Reserve for exactly one role (severity). A third use needs a new role, not a new rule |
| Three-column feature grid as section two | Replace with your own idiom |
| Container soup — pills in cards in cards, 24/24/24 padding | Cap nesting depth at 2. A card may contain a table; it may not contain a card |
| Default icon library | Hand-author inline SVG on a fixed box at a fixed stroke |

The underlying trap: models converge on generic, on-distribution output. Naming the fingerprint is what lets you refuse it.

---

## Part 3 — Worked example: "Ruled Ledger"

A ruled sheet, not a stack of cards. Max radius anywhere except the avatar is 4px. Containers survive only where something genuinely floats — modal, popover, toast — and those are the only places a blurred shadow is permitted.

### 3.1 Palette — light

Achromatic drafting grey: R=G=B on every neutral, so nothing in chrome carries a hue and every hue on the page means something. Deliberately distinct from `#F9FAFB` (framework default), `#F6F5F2` (the category's warm-cream default), and `#FFFFFF`.

| Token | Value | Contrast | Role |
|---|---|---|---|
| `--rash-surface` | `#F1F1F1` | — | page |
| `--rash-surface-raised` | `#FAFAFA` | — | ruled block, table head, nav |
| `--rash-surface-sunken` | `#E6E6E6` | — | wells, zebra rows, code |
| `--rash-surface-overlay` | `rgb(20 20 20 / 0.58)` | — | scrim |
| `--rash-text` | `#141414` | 16.3:1 | primary |
| `--rash-text-secondary` | `#454545` | 8.5:1 | secondary |
| `--rash-text-muted` | `#666666` | 5.1:1 | muted |
| `--rash-text-inverse` | `#F7F7F7` | 15.9:1 | on dark fills |
| `--rash-border` | `#D4D4D4` | 1.31:1 | decorative hairline only |
| `--rash-border-strong` | `#868686` | 3.22:1 | control boundary, rule of record |
| `--rash-accent` | `#17212B` | 14.4:1 | ink, one step cooler than text ink |
| `--rash-accent-hover` | `#0D141B` | 16.9:1 | |
| `--rash-accent-fg` | `#FFFFFF` | 16.3:1 | |
| `--rash-accent-soft` | `color-mix(in oklab, #17212B 6%, #FAFAFA)` | 14.6:1 | |
| `--rash-agent` | `#6A3D7A` | 7.3:1 | the one saturated voice in chrome |
| `--rash-agent-fg` | `#FFFFFF` | 8.1:1 | |
| `--rash-agent-soft` | `color-mix(in oklab, #6A3D7A 10%, #FAFAFA)` | 13.9:1 | |
| `--rash-positive` | `#12704F` | 5.4:1 | |
| `--rash-negative` | `#B4231F` | 5.8:1 | |
| `--rash-warning` | `#8A5D06` | 5.1:1 | warning as text |
| `--rash-warning-fill` | `#F0B429` | 9.0:1 vs fg | fill + dark foreground |
| `--rash-warning-fg` | `#2A1F05` | — | |
| `--rash-focus` | `#17212B` | 14.4:1 | 2px offset in surface color, so the ring survives on an ink-filled control |
| `--rash-shadow` | `#141414` | — | float/overlay only |

Each `*-soft` is `color-mix(in oklab, <role> N%, <raised>)`. Using `color-mix` rather than a parallel set of channel triples means each color has exactly one representation and a contrast script sees every variant.

### 3.2 Palette — dark

Achromatic coal, **not** blue-black — `#0f0f14` and its neighbourhood is the reference dark theme of the entire data-dense field. Elevation reads through lightness; the accent inverts to paper, so the primary action is again the maximum-contrast surface. Dark is a peer, not a skin.

| Token | Value | Contrast |
|---|---|---|
| `--rash-surface` | `#121212` | — |
| `--rash-surface-raised` | `#1A1A1A` | — |
| `--rash-surface-sunken` | `#0C0C0C` | — |
| `--rash-surface-overlay` | `rgb(0 0 0 / 0.66)` | — |
| `--rash-text` | `#EDEDED` | 16.0:1 |
| `--rash-text-secondary` | `#B3B3B3` | 8.9:1 |
| `--rash-text-muted` | `#8A8A8A` | 5.4:1 |
| `--rash-text-inverse` | `#121212` | 16.0:1 |
| `--rash-border` | `#2B2B2B` | 1.32:1 |
| `--rash-border-strong` | `#6E6E6E` | 3.67:1 |
| `--rash-accent` | `#EDEDED` | 16.0:1 — paper |
| `--rash-accent-hover` | `#FFFFFF` | 17.9:1 |
| `--rash-accent-fg` | `#121212` | 16.0:1 |
| `--rash-agent` | `#C79BD8` | 8.0:1 |
| `--rash-positive` | `#4ED09A` | 9.6:1 |
| `--rash-negative` | `#FF8078` | 7.7:1 |
| `--rash-warning` | `#F0B429` | 9.6:1 |
| `--rash-focus` | `#EDEDED` | 16.0:1 |
| `--rash-shadow` | `#000000` | — overlays deepen rather than wash out |

### 3.3 Chart series

Ordered for adjacent separation, each ≥ 3:1 on its surface. Slot 1 is graphite ink rather than the field's blue, so the primary series reads as the ledger's own line; saturated hues begin at slot 2.

| Slot | Light | Dark | Name |
|---|---|---|---|
| 1 | `#2E3A46` | `#C8CDD3` | graphite ink |
| 2 | `#6A3D7A` | `#C79BD8` | plum |
| 3 | `#12704F` | `#4ED09A` | moss |
| 4 | `#8A5D06` | `#F0B429` | bronze |
| 5 | `#3E6C8E` | `#79B4D8` | steel |
| 6 | `#8C3B5C` | `#F0899F` | garnet |

### 3.4 Type scale

Nine steps, one notch denser than framework defaults. Each carries a paired line-height.

| Token | Size | Line height | Use |
|---|---|---|---|
| `--text-2xs` | 11px, `0.08em` tracking, uppercase | 1rem | Eyebrows, stat labels, table headers — **the only uppercase in the system** |
| `--text-xs` | 12px | 1.1rem | Metadata, footnotes |
| `--text-sm` | 13px | 1.25rem | Dense table body |
| `--text-base` | 15px | 1.45rem | Body |
| `--text-lg` | 17px | 1.55rem | Card and section titles |
| `--text-xl` | 21px | 1.75rem | Section headings, wordmark |
| `--text-2xl` | 26px | 2rem | Page titles |
| `--text-3xl` | 34px | 2.25rem | Stat values |
| `--text-display` | `clamp(2rem, 3.4vw, 3rem)` | 1.06 | Hero only |

Keeping uppercase to exactly one step is what makes it a *structural* signal instead of decoration. Buttons, nav and badges stay sentence case.

**Faces** — three, one family, so no seam exists between prose, heading and figure:

| Role | Face | Why |
|---|---|---|
| Display | IBM Plex Sans Condensed | Carries hero and page titles by *width and weight* rather than by switching family. Reads as a broadsheet masthead and sidesteps the serif-headline fingerprint. Used at `2xl`+ only, weight 600, `-0.02em` |
| Text | IBM Plex Sans | Unambiguous `1`/`l`/`I`, genuine tabular figures, holds up at 13px. Not Inter — flagged as an overused default |
| Mono | IBM Plex Mono | Metrically matched to Plex Sans, so a figure column sits beside prose with no visible seam. **This match is why all three are chosen together** |

### 3.5 Spacing

| Token | Value | Use |
|---|---|---|
| `--spacing-hair` | 1px | Hairline offsets, focus-ring offset |
| `--spacing-tight` | 0.375rem | Badge and chip padding |
| `--spacing-snug` | 0.5rem | Dense cells, input padding |
| `--spacing-base` | 1rem | Default rhythm |
| `--spacing-loose` | 1.25rem | Ruled-block and card padding |
| `--spacing-section` | 2rem | Between sections |
| `--spacing-page` | 3rem | Page top and bottom |

Shell: 1240px max width, 20px gutters, 4px base. Rows 32px default / 28px compact, against the ~36px reference systems specify. Density is a prop on the table primitive, not a settings screen.

### 3.6 Radius, elevation, motion

**Radius** — the divergence axis, quantified. Everything inside a 0–4px band except the pill.

| Token | Value | Use |
|---|---|---|
| `--radius-none` | 0 | Tables, cells, dividers, rules, ruled blocks |
| `--radius-xs` | 1px | Badges, chips, swatches |
| `--radius-sm` | 2px | Buttons, inputs, selects |
| `--radius-md` | 3px | Cards and panels |
| `--radius-lg` | 4px | Modals, popovers, toasts |
| `--radius-pill` | 999px | Avatar and dot shape signal only — **never a button** |

**Elevation** — four compositions; only the last two carry blur.

| Token | Composition | Use |
|---|---|---|
| `--shadow-hairline` | `0 0 0 1px var(--rash-border)` | Any outlined surface |
| `--shadow-raise` | `0 0 0 1px border, 0 1px 0 0 border` | Cards. Hard 1px offset, **no blur** — a sheet on a sheet, not a lift |
| `--shadow-float` | hairline-strong + `0 6px 16px -8px` @30% | Popovers, dropdowns, toasts |
| `--shadow-overlay` | hairline-strong + `0 24px 56px -16px` @45% | Modals |

**Motion** — interaction durations in a 120–400ms band; loops capped at 2000ms.

| Token | Value | Use |
|---|---|---|
| `--duration-quick` | 120ms | Hover, small state changes |
| `--duration-base` | 180ms | Focus, theme transition, toast entry |
| `--duration-slow` | 280ms | Panel and page entry |
| `--duration-loop` | 1600ms | Looping indicators |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entry |
| `--ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | Loops |

`fade-rise` travels 4px, not 8px — *a direction with no card lift should not have content that lifts either.* Under `prefers-reduced-motion: reduce`, every animation collapses to 1ms and each animated state falls back to a static signal.

---

## Part 4 — Implementation

### Three-tier tokens

1. **Tier 1 — role variables** (`--rash-*`): the only place a color literal appears.
2. **Tier 2 — `@theme inline`**: binds roles to framework utility names.
3. **Tier 3 — migration aliases**: let old class names keep working during a redesign.

### Theme resolution without `dark:` duplication

Light is the base `:root` block, so an attribute-less document still renders. Both themes are written as `:root[data-theme="…"]` — specificity (0,2,0) outranks base `:root` (0,1,0) regardless of source order, and the two cannot collide because only one attribute value matches at a time.

```css
@custom-variant dark (&:where(:root[data-theme="dark"] *));
```

Keep that variant as an **escape hatch only**. One utility should resolve in both themes via tokens; every use of a `dark:` prefix should carry a comment justifying why a token couldn't express the difference.

### The figure utility

A single `num` utility applies mono + tabular figures + right alignment, so the treatment cannot drift per call site. Apply it to counts and percentages too, not only currency. `num-left` for the left-aligned case.

### Verification worth automating

- A contrast script that re-checks every declared pairing at build time and is the authority if it disagrees with the docs.
- A grep gate for the Part 2 tells — framework logos, `system-ui`, emoji icons, banned utility combinations.

---

## Part 5 — Originality checklist

Before shipping, confirm each:

- [ ] No image, icon, font, logo, stylesheet, or CSS fragment copied from any surveyed product.
- [ ] Every color derived from a stated contrast budget, not sampled from a screenshot or lifted from a published palette.
- [ ] Competitor hex values appear **only** as observations in the survey — never in the token layer.
- [ ] Fonts open-licensed and loaded at build time; no font binary committed.
- [ ] Logomark, wordmark, favicon and icon set hand-authored; no icon library, no traced mark.
- [ ] Adoption recorded **per characteristic** with a stated departure for each, rather than as a blanket independence claim.
- [ ] The systems you borrowed most from are named and linked, then diverged from on your stated axis.

That last pair is what makes the result defensible. "We took Mercury's hairline discipline and removed the container as well as the shadow" is a design argument. "It's original" is not.
