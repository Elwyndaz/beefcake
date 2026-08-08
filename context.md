# Beefcake — Context

## Project Overview
Träningsapp (PWA) som ersätter Excel-ark för styrketräning. Desktop-first, mobil-fungerande, offline-first.

## Core Domain
- **Template** = färdigt pass (namn + lista av övningar med standard set/reps/vikt)
- **Exercise** = övningsnamn + valfri metadata (muskelgrupp, utrustning)
- **Session** = datum + vald template + för varje övning: faktiska set/reps/vikt (kan avvíka från template)
- **History** = alla sessionsrader denormaliserade för grafer/statistik

## Key Features (MVP)
1. Logga pass: välj template → förifyllda övningar → justera set/reps/vikt → spara
2. Mallhantering: CRUD för templates, "minns" senaste vikt/set/reps per övning
3. Statistik: volym/övning över tid, frekvens per template, heatmap, PR-lista
4. Påminnelse: lokal check vid app-start om >3 dagar sedan senaste pass
5. Export/import: JSON (hela DB) + CSV (platt sessionslista)
6. Migration: seed genererad ur `C:\dev\Styrkepass v2.xlsx` vid byggtid, laddas av `seedIfEmpty()`

## Status

Se `AUDIT.md` för full genomlysning och prioriterad roadmap, `backlog.md` för snabböversikt och `MISTRAL-WORKPLAN.md` för färdiga arbetsuppgifter.

Två saker att känna till innan man rör datan:
- Excel-import i webbläsaren är borttagen (commit `410efd1`). Seedning sker med skript vid byggtid, aldrig i klienten.
- `seedIfEmpty()` kör bara mot tom databas. Uppdateringar av datan måste ske som idempotent upsert på naturlig nyckel, inte som ny seed.

## Tech Stack
- Vite + Preact + TypeScript
- IndexedDB via `idb` (wrapper)
- Chart.js för grafer
- date-fns för datumhantering
- vite-plugin-pwa (Workbox) för offline/PWA
- Cloudflare Pages deployment

## Data Model (IndexedDB stores)
- `templates` — { id, name, exercises: [{ exerciseId, defaultSets, defaultReps, defaultWeight, order }], updatedAt }
- `exercises` — { id, name, muscleGroup?, equipment?, createdAt }
- `sessions` — { id, date (ISO), templateId, templateName, exercises: [{ exerciseId, exerciseName, sets, reps, weight, order }], createdAt }
- `exerciseHistory` — denormaliserad: { id, date, exerciseId, exerciseName, sets, reps, weight, volume, sessionId }

## Reminder Logic
- Vid app-start: läs senaste session.date → om diff > 3 dagar → visa toast/notis

## Progressive Overload (future)
- Template kan kopplas till program (5x5, GZCL, etc.)
- Program-motor föreslår nästa vikt/reps baserat på history

## Conventions
- Swedish UI, kg only
- Desktop-first CSS (min-width breakpoints uppåt)
- Strict TS: no `any`, explicit return types, throw on error
- Functions: succeed or throw (no ambiguous returns)