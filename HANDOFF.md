---
schemaVersion: 1
status: active
currentGoal: Slutföra datamodellen med Exercise.kind för kroppsvikt, tid och distans
nextAction: Lägg till kind på Exercise i src/db/schema.ts och låt volymberäkningen hoppa över pass utan vikt, så de 95 konditionspassen slutar räknas som volym 0
blockers: []
reviewedAt: 2026-08-09
---

## Recent work

- `SetEntry[]` ersätter `sets`/`reps`/`weight` i schema, models, LogSession, SessionDetail och Templates. Legacy-typer och migreringsfunktioner finns kvar för gammal seed-data.
- Designsystem-refresh: tokens i `app.css`, Geist self-hostad i `src/assets/fonts`, komponenterna i `src/components/` används överallt. Se `DESIGN-AUDIT.md`.
- Seed genereras ur Excel med `scripts/generate-seed.py`, `syncSeed()` är additiv och idempotent.
- Live på https://orgutveckling.se/beefcake/ via GitHub Actions till Pages.

## Verification

- Live-URL svarar 200 (2026-08-09).
- 419 pass, 1 522 historikrader, 0 dubbletter efter seed-synk, andra körningen lade till noll.
- Responsiva skärmdumpar i `.playwright-shots/` för 390, 768, 1200 och 1600 px.

## Unresolved details

- Okommitterat arbete i `src/app.tsx` och `src/services/dataService.ts`: muskelgruppskarta och `restoreFromLocalStorage()`.
- Heatmap-kortet i Stats renderar ingenting när inga pass finns senaste 30 dagarna.
- Frekvensdiagrammet visar en stapel märkt "undefined", mallen med tomt namn är inte städad.
- Spökpasset 2025-11-19 "Bröst, axlar & biceps" är kvar med flit.
- Inga tester och ingen linter i CI.

## Resume here

Börja med nextAction ovan. `BACKLOG.md` har snabböversikten, `AUDIT.md` hela genomlysningen, `AGENTS.md` de hårda reglerna för arbetsdelningen med Mistral.
