# Mistral Work Plan — Beefcake

Copy one task at a time into Mistral. Each task is self-contained: it repeats the project context so you never have to explain the app twice. Tasks are written in English (coding models do better with it); all user-facing strings in the app stay Swedish.

**Do the tasks in the numbered order.** Dependencies are stated per task.

---

## Shared context — paste this above any task

```
PROJECT: Beefcake, a personal strength-training log. Swedish UI, kg only.
Deployed at https://orgutveckling.se/beefcake/ (GitHub Pages, base path /beefcake/).

STACK: Vite 8 + Preact 10 + TypeScript (strict) + wouter (routing) +
IndexedDB via `idb` + Chart.js + vite-plugin-pwa (Workbox). No backend.
All data lives client-side in IndexedDB. ~2000 lines of source total.

LAYOUT OF THE REPO:
  src/main.tsx              entry, seeds DB then renders
  src/app.tsx               Router + header nav + 5 routes
  src/app.css               all app styling
  src/index.css             LEFTOVER Vite starter CSS (see Task 1)
  src/config.ts             AUTH_HASH for the password gate
  src/components/PasswordGate.tsx
  src/db/schema.ts          IndexedDB schema + types (Exercise, Template, Session, ExerciseHistory)
  src/db/seedData.ts        GENERATED, 347 sessions of real history. NEVER EDIT BY HAND.
  src/models/index.ts       re-exports from db/schema
  src/services/dataService.ts   all DB reads/writes + stats
  src/services/reminderService.ts
  src/pages/{Home,LogSession,Templates,Stats,Settings}.tsx

DATA MODEL (current):
  Exercise         { id, name, muscleGroup?, equipment?, createdAt }
  TemplateExercise { exerciseId, defaultSets, defaultReps, defaultWeight, order }
  Template         { id, name, exercises: TemplateExercise[], updatedAt }
  SessionExercise  { exerciseId, exerciseName, sets, reps, weight, order }
  Session          { id, date (YYYY-MM-DD), templateId, templateName, exercises: SessionExercise[], createdAt }
  ExerciseHistory  { id, date, exerciseId, exerciseName, sets, reps, weight, volume, sessionId }

HARD RULES — these apply to EVERY task:
1. NEVER modify src/db/seedData.ts. It holds 347 real workouts (2024-01-01 to
   2025-11-19) and is the only copy in the repo. It is generated, not authored.
2. NEVER write a migration or script that deletes, rewrites or reorders rows in
   the `sessions` or `exerciseHistory` object stores unless the task explicitly
   says so.
3. Keep TypeScript strict. No `any`. `npm run build` must stay green.
4. Swedish UI text. Swedish number conventions: decimal comma (12,5), space as
   thousands separator (12 500). Never use an em-dash in Swedish text.
5. Desktop is the primary experience; mobile must still be first-class, not a
   narrowed desktop. Breakpoints: mobile <768px, tablet 768-1199px, desktop >=1200px.
6. Make the smallest change that fully solves the task. Do not refactor
   surrounding code that the task does not require.

VERIFY EVERY TASK WITH:
  npm run build      (must exit 0, no TS errors)
  npm run dev        then open http://localhost:5173/beefcake/
  To skip the password gate in dev, run in the browser console:
    sessionStorage.setItem('beefcake-auth','1'); location.reload()
```

---

## Task 1 — Delete the leftover Vite starter CSS

**Context**
`src/index.css` is the untouched CSS from the `npm create preact` template. It is still imported by `src/main.tsx` and it currently controls the app's layout. `src/app.css` is the real stylesheet.

**Problem**
`src/index.css` contains:
```css
#app { width: 1126px; text-align: center; border-inline: 1px solid var(--border); }
```
This locks the entire app into a 1126 px column centred on the screen with visible vertical border lines, and centres all inherited text. On a 1600 px display roughly 30 % of the width is used. It also redefines `--bg`, `--text`, `--border` and `--accent`, the same variable names `app.css` uses, plus a `prefers-color-scheme: dark` block that currently happens to be dead only because of import order.

**Files to inspect**
- `src/index.css` (to be deleted)
- `src/main.tsx` (imports it on line 2)
- `src/app.css` (the keeper)

**Desired outcome**
1. Delete `src/index.css`.
2. Remove its import from `src/main.tsx`.
3. Move only what is genuinely needed into `src/app.css`: `body { margin: 0 }` and `color-scheme: light` on `:root`. Everything else in `index.css` goes.
4. Give `.main` in `app.css` a wider ceiling: `max-width: 1400px`.

**Constraints**
- Do not touch any other rule in `app.css`.
- Do not introduce a CSS framework or preprocessor.
- Do not start redesigning. This task only removes the starter CSS.

**Acceptance criteria**
- `src/index.css` no longer exists and nothing imports it.
- On a 1600 px viewport the app fills up to 1400 px with no vertical border lines.
- Page headings, stat cards and nav are left-aligned, not centred.
- `npm run build` exits 0.

**Verification**
Run the dev server at 1600 px and at 390 px. Compare against the pre-change layout. Nothing should be centred that was not deliberately centred by `app.css`.

**Dependencies:** none. Do this first.

---

## Task 2 — Replace the blocking alert with a dashboard banner

**Context**
`src/app.tsx` lines 28-34 call `checkReminder()` on mount and, one second later, fire a native `alert()` if it has been more than three days since the last workout. `src/services/reminderService.ts` computes the day difference correctly and is timezone-safe. Only the presentation is wrong.

**Problem**
A native `alert()` is a modal system dialog. It blocks the whole app on every single start until dismissed, on every device. It cannot be styled, it cannot be dismissed with a click elsewhere, and it blocks automated testing.

**Files to inspect**
- `src/app.tsx` (remove the alert)
- `src/services/reminderService.ts` (keep the logic, it is correct)
- `src/pages/Home.tsx` (where the banner goes)
- `src/app.css` (banner styling)

**Desired outcome**
1. Remove the `alert()` and the `setTimeout` from `app.tsx` entirely.
2. On the Home page, call `checkReminder()` and, when `show` is true, render a banner at the top of the page, above the page title.
3. Banner text: `Du har inte tränat på {daysSince} dagar. Den jävla latmasken.`
4. The banner has a dismiss button (×). Dismissal is stored in `sessionStorage` under the key `beefcake-reminder-dismissed` so it does not reappear during the same session.
5. Style: accent-coloured left border, muted background, not a full-width alarm bar.

**Constraints**
- Do not change the three-day threshold or the date maths in `reminderService.ts`.
- Do not add a toast/notification library. This is one element.
- No `alert()`, `confirm()` or `prompt()` may be introduced anywhere in this task.

**Acceptance criteria**
- Loading any page produces no system dialog.
- With the seeded data (last workout 2025-11-19) the Home page shows the banner with the correct day count.
- Clicking × hides it; reloading the page keeps it hidden; opening a new tab shows it again.
- `npm run build` exits 0.

**Verification**
Open the app. No dialog should appear on any route. Check the day count against `(today − 2025-11-19)`.

**Dependencies:** none.

---

## Task 3 — Turn the workout form into a table on desktop and cards on mobile

**Context**
`src/pages/LogSession.tsx` renders the exercises of the selected template as a form. Each exercise is one `div.grid.grid-4` containing four labelled inputs plus a "Ta bort" button.

**Problem**
Three separate issues:
1. The labels "Övning / Set / Reps / Vikt (kg)" are repeated above every single exercise row. A 13-exercise template renders 52 labels.
2. `.grid-4` is given five children, so the fifth (the remove button) wraps onto its own row and renders centred under the exercise name. The layout is visibly broken.
3. The remove button uses `btn-danger`, making the most destructive action the most visually prominent element on the page.

**Files to inspect**
- `src/pages/LogSession.tsx`
- `src/app.css`

**Desired outcome**
Desktop and tablet (>=768px): render the exercises as a real `<table>`. One header row with `Övning | Set | Reps | Vikt (kg) | ` (last column empty). One `<tr>` per exercise. Inputs sit inside the cells without their own labels. The remove control is a small icon-style button in the last column, using muted colours, turning red only on hover.

Mobile (<768px): render one card per exercise. Keep the labels inside the card, since there is no header row to inherit from. Remove control top-right of the card.

**Constraints**
- Do not change any save logic, state shape or the `FormExercise` interface.
- Do not change the `handleSave`, `addExercise`, `removeExercise` or `updateExercise` functions.
- Inputs must remain `type="number"` with the existing min/max/step attributes, and the exercise name input must keep its `list="exercise-suggestions"` datalist.
- The datalist is currently duplicated once per row (same `id` repeated 13 times, which is invalid HTML). Render it exactly once, outside the loop.
- Touch targets on mobile must be at least 44×44 px.

**Acceptance criteria**
- At 1600 px: one header row, 13 body rows, nothing wraps, the remove button sits in its own column.
- At 390 px: 13 cards, no horizontal scrolling anywhere on the page.
- Exactly one `<datalist id="exercise-suggestions">` exists in the DOM.
- Selecting a template still fills in the values; saving still works.
- `npm run build` exits 0.

**Verification**
Select the "Bröst, axlar & biceps" template (13 exercises) at both widths. Save a test workout, then delete it afterwards from Settings → the browser DevTools, or simply do not save.

**Dependencies:** Task 1 (otherwise you are laying out inside a 1126 px centred box).

---

## Task 4 — Fix the statistics page: charts that do not lie

**Context**
`src/pages/Stats.tsx` renders four cards: volume over time per exercise, frequency per template, a 30-day activity chart, and a PR table. The stats functions live in `src/services/dataService.ts` (`getVolumeOverTime`, `getFrequencyPerTemplate`, `getHeatmapData`, `getPRs`).

**Problem**
1. **The activity card renders nothing at all.** Line 66: the chart is only built when `heatmapData.length > 0`. The user's last workout was 2025-11-19, so the array is empty and the card is a blank white box with no explanation.
2. **The volume chart's x-axis is a category axis**, so 2024-06-09 and 2024-12-04 sit the same distance apart as two sessions in the same week. The chart misrepresents time.
3. **Chart instances are stored in `useState`.** The `useEffect` cleanups close over the state value from the render in which the effect ran, which is `null` the first time. Charts therefore are not reliably destroyed, and a new chart can be constructed on a canvas that already has one.
4. **The PR table is unsorted** (Map insertion order) and arbitrarily sliced to the first 10.
5. **PR dates wrap onto two lines**, e.g. `70 kg (2024-` / `10-31)`.

**Files to inspect**
- `src/pages/Stats.tsx`
- `src/services/dataService.ts` (`getHeatmapData`, `getPRs`)
- `src/app.css`

**Desired outcome**
1. The activity chart always renders 30 bars, one per day, zero-height for days with no session. Never a blank card. If there are no sessions at all in the database, render an empty state with the text `Inga pass registrerade än.`
2. The volume chart uses a **time-based x-axis**. Chart.js needs an adapter for this; use `chartjs-adapter-date-fns`, which pairs with `date-fns` (already a dependency, currently unused). Add only that one adapter package.
3. Move all three chart instances from `useState` to `useRef`. Each effect destroys the previous instance via the ref before creating a new one, and the cleanup destroys on unmount.
4. Sort the PR table by exercise name, show all rows, and keep the existing `max-height: 300px; overflow-y: auto` scroll container.
5. PR dates: format as `19 nov 2025` and add `white-space: nowrap` so they never wrap.
6. Add `font-variant-numeric: tabular-nums` to every table cell containing a number, so columns of weights line up.

**Constraints**
- Do not change what the stats *mean*. This task fixes correctness and presentation, not the choice of metrics.
- Do not add any chart library other than the `chartjs-adapter-date-fns` adapter.
- Do not modify `getVolumeOverTime` or `getFrequencyPerTemplate`.
- Leave the "undefined" template name alone: it comes from the source data and is fixed elsewhere.

**Acceptance criteria**
- The activity card shows 30 bars with the seeded data, all at zero.
- The volume chart's x-axis spacing is proportional to real elapsed time.
- Switching the exercise dropdown ten times in a row leaves exactly one chart instance alive (check `Chart.instances` in the console).
- The PR table is alphabetical, complete, and no date wraps.
- `npm run build` exits 0.

**Verification**
Open `/beefcake/stats`. Cycle the exercise dropdown repeatedly and watch for flicker, duplicate canvases or console errors. There must be none.

**Dependencies:** Task 1.

---

## Task 5 — Design tokens and a small component set

**Context**
`src/app.css` styles everything with a flat list of class names. There are over twenty inline `style="..."` attributes scattered through the JSX. The palette (`--primary: #2c3e50`, `--accent: #e74c3c`) is the Flat UI palette from 2013 and reads as an internal admin tool.

**Problem**
There is no shared visual language, no dark mode, a two-step spacing scale, and no reusable components, so every new page reinvents its own spacing and colour decisions.

**Files to inspect**
- `src/app.css` (rewrite the token layer, keep the component classes working)
- All five files in `src/pages/` and `src/components/PasswordGate.tsx` (source of the inline styles)

**Desired outcome**
1. A token block at the top of `app.css`:
   - **Colour:** a dark, low-chroma surface palette (background, raised surface, border), one high-energy accent used *only* for primary actions and personal records, plus success/warning/danger. Semantic names (`--surface`, `--surface-raised`, `--accent`, `--text`, `--text-muted`), never colour names.
   - **Spacing:** a 6-step scale, `--space-1` through `--space-6`, on a 4 px base.
   - **Type:** a 6-step scale, `--text-xs` through `--text-2xl`, plus `--font-numeric` with `font-variant-numeric: tabular-nums`.
   - **Radius, shadow, motion:** three values each, no more.
2. Both themes. Define the full light palette on bare `:root`. Redefine only the changed tokens inside `@media (prefers-color-scheme: dark)`. Every colour must have a definition on bare `:root`; none may exist only inside a media query.
3. Six components as Preact components in `src/components/`: `Button`, `Card`, `Stat`, `Table`, `Field`, `EmptyState`. Each is a thin wrapper over the tokens, each takes `children` and a small typed props object. No more than 40 lines apiece.
4. Replace every inline `style="..."` attribute in the pages with a token-based class or one of the six components.

**Constraints**
- Do not add Tailwind, styled-components, CSS-in-JS or any styling dependency. Plain CSS with custom properties.
- Do not change any page's information architecture. This is a visual and structural refactor only, so every page must still show exactly the same data as before.
- Aim for premium, sporty, focused and fast. Avoid the generic AI-SaaS look: no gradient hero, no glassmorphism, no purple-to-pink.
- Contrast must meet WCAG AA (4.5:1 for body text) in both themes.

**Acceptance criteria**
- Zero `style="..."` attributes remain in `src/pages/` and `src/components/`.
- Toggling the OS between light and dark changes the app coherently, with no unreadable text and no white flash.
- Every page renders the same data as before the change.
- `npm run build` exits 0.

**Verification**
Screenshot all five pages in light and dark at 1600 px and 390 px. Check contrast with the browser's built-in accessibility inspector.

**Dependencies:** Tasks 1, 3, 4. Do this *after* the pages are structurally correct, so you are styling the final structure and not the old one.

---

## Task 6 — Desktop sidebar and mobile bottom navigation

**Context**
`src/app.tsx` renders a sticky header with an `<h1>` and five equally weighted nav links: Hem, Logga pass, Mallar, Statistik, Inställningar.

**Problem**
On desktop the horizontal header wastes the vertical axis and gives Settings the same visual weight as the primary action. On mobile the five links wrap to two rows, and each link is roughly 30 px tall, below the 44 px minimum for touch targets.

**Files to inspect**
- `src/app.tsx`
- `src/app.css`

**Desired outcome**
Desktop (>=1200px): a fixed left sidebar, 240 px wide. Wordmark at the top, then the primary items, then Inställningar pinned to the bottom, visually separated. The active item is clearly marked. Content occupies the remaining width.

Tablet (768-1199px): the same sidebar collapsed to a 64 px icon rail, with labels on hover.

Mobile (<768px): a fixed bottom navigation bar with four items and icons, Inställningar moved into a header icon at the top right. Each target at least 44×44 px. Respect `env(safe-area-inset-bottom)` so it clears the iPhone home indicator.

**Constraints**
- Keep wouter routing and the existing `NavLink` active-state logic unchanged.
- Do not add an icon library. `public/icons.svg` already exists; use an inline SVG sprite.
- The visual identity must be the same across all three layouts. Same tokens, same accent, same type scale.

**Acceptance criteria**
- No horizontal scrolling at 390 px, 768 px, 1200 px or 1600 px.
- Every touch target on mobile is at least 44×44 px, measured in DevTools.
- The active route is unambiguous in all three layouts.
- `npm run build` exits 0.

**Verification**
Walk every route at all four widths. Check that the bottom bar does not cover page content by adding matching bottom padding to `.main` on mobile.

**Dependencies:** Task 5 (needs the tokens).

---

## Task 7 — Loading and empty states everywhere

**Context**
Every page fetches from IndexedDB inside a `useEffect` and renders immediately with initial state. `Home.tsx` shows `0` in all three stat cards before the data arrives.

**Problem**
The user sees "Totala pass: 0" flash on every load, tables render empty then jump, and several empty states either say nothing at all or offer no next step.

**Files to inspect**
- All five files in `src/pages/`
- `src/components/EmptyState.tsx` (from Task 5)

**Desired outcome**
1. Every page tracks a `loading` state and renders a skeleton, meaning grey placeholder blocks matching the final layout's dimensions, not a spinner.
2. Every list, table and chart has an empty state with a heading, one line of explanation and, where an action makes sense, a button. Swedish text.
3. Every data fetch has a `catch` that renders an error state with a "Försök igen" button. No silent `console.error`.

**Constraints**
- Skeletons must match the real content's dimensions so nothing shifts when data arrives (no layout shift).
- Do not add a skeleton library. This is a few CSS rules and a shimmer keyframe.
- Do not change any data-fetching logic beyond adding the loading and error state.

**Acceptance criteria**
- Throttling the network and CPU in DevTools shows a skeleton on every page, never a `0` or an empty table.
- Cumulative Layout Shift stays at 0 when data lands.
- Every empty and error state has Swedish text and, where relevant, an action.
- `npm run build` exits 0.

**Verification**
Test with the seeded database, and again with a cleared database (DevTools → Application → IndexedDB → delete `beefcake-db`, then reload; the app re-seeds automatically).

**Dependencies:** Task 5.

---

## Task 8 — Housekeeping

**Context**
Leftovers from the build-out phase.

**Problem**
- `date-fns` and `workbox-window` are in `package.json` but imported nowhere. (After Task 4, `date-fns` *is* used by the chart adapter, so re-check before removing.)
- `index.html` links `/manifest.webmanifest` while vite-plugin-pwa injects its own, producing `Manifest: Line: 1, column: 1, Syntax error` in the console.
- `backlog.md` lists 16 unchecked items that are all built.
- `handoff.md` documents an Excel import feature that was removed in commit 410efd1.
- Dead exports in `dataService.ts`: `searchExercises`, `getExercise`, `getSessionsByTemplate`. Dead export in `reminderService.ts`: `formatReminderMessage`.
- Chart.js sits in the main bundle (268 kB) although only the Stats page uses it.

**Files to inspect**
`package.json`, `index.html`, `backlog.md`, `handoff.md`, `src/services/dataService.ts`, `src/services/reminderService.ts`, `src/app.tsx`

**Desired outcome**
1. Remove `workbox-window`. Remove `date-fns` **only if** Task 4 did not end up using it.
2. Remove the duplicate `<link rel="manifest">` from `index.html`.
3. Rewrite `backlog.md` to reflect what is actually open; delete `handoff.md` (it is superseded by `AUDIT.md`).
4. Delete the four dead exports listed above. **Do not delete `updateSession`, `deleteSession` or `getSession`** — they are unused today but a planned history page will call them.
5. Lazy-load the Stats page with a dynamic `import()` so Chart.js leaves the main chunk.

**Constraints**
- Verify each "dead" function really has zero callers before deleting: `grep -rn "functionName" src/`.
- The lazy-loaded route must show a loading fallback, not a blank screen.

**Acceptance criteria**
- `npm run build` exits 0 and the main chunk is meaningfully smaller than 268 kB.
- No manifest error in the browser console.
- No unused dependency remains in `package.json`.
- Navigating to `/beefcake/stats` still works, with a brief loading state.

**Verification**
Compare `npm run build` chunk sizes before and after. Open every route and confirm a clean console.

**Dependencies:** Task 4.

---

## Not for Mistral

These stay with Claude Code because they touch the whole repo at once and a mistake is silent and permanent:

- **The data-model migration** (sets as a list, exercise kinds, converting 1 176 existing history rows)
- **The history page** with edit, delete and repeat
- **Autosave and draft workouts**
- **The "last time" prefill** on the workout page
- **The dashboard's next-workout suggestion**
- **Automatic backup export**
- **Transaction atomicity in `createSession`**
- **Test infrastructure**
