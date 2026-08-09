---
schemaVersion: 1
status: active
currentGoal: Slutföra datamodellen med Exercise.kind för kroppsvikt, tid och distans
nextAction: Lägg till kind på Exercise i src/db/schema.ts och låt volymberäkningen hoppa över pass utan vikt, så de 95 konditionspassen slutar räknas som volym 0
blockers: []
reviewedAt: 2026-08-09
---

## Recent work

- `SetEntry[]` ersätter `sets`/`reps`/`weight` genom hela kedjan: schema, models, dataService, LogSession, SessionDetail, Templates. Legacy-typer och migreringsfunktioner kvar för gammal seed-struktur.
- Designsystem-refresh: tokens i `app.css`, Geist self-hostad, komponenterna i `src/components/` används i alla vyer.
- Inline mallhantering i logg- och redigeringsläge: "Spara som mall" i LogSession, "Spara övningarna till mallen" + "Spara som ny mall" i SessionDetail.
- Muskelgrupper: `MUSCLE_GROUP_MAP` (namn → grupp), backfill i `syncSeed`, nytt "Muskelgrupper"-kort i Statistik med volym per grupp.
- Data-tappning: `restoreFromLocalStorage()` i `syncSeed` (körs före render i `main.tsx`), `autoBackup()` efter varje mutation. Verifierat: wipe av IndexedDB → reload → alla pass tillbaka.
- Dokumenten städade 2026-08-09: `AUDIT.md`, `MISTRAL-WORKPLAN.md` och `DESIGN-AUDIT.md` raderade, öppna poster flyttade till `BACKLOG.md`, domänmodellen samlad i `CONTEXT.md`.

## Verification

- Live-URL svarar 200, https://orgutveckling.se/beefcake/.
- 419 pass, 1 522 historikrader, 0 dubbletter efter seed-synk. Andra körningen lade till noll.
- Verifierat i koden 2026-08-09: `undefined`-mallen filtreras i `syncSeed` (`dataService.ts:535`), heatmap-kortet har ett tomt tillstånd (`Stats.tsx:471`), `date-fns` används av chart-adaptern och `workbox-window` är borta.
- Responsiva skärmdumpar i `.playwright-shots/` för 390, 768, 1200 och 1600 px.

## Unresolved details

- `importAllData` rensar databasen innan den validerar filen.
- Race condition i mall-laddningen i LogSession, async-effekt utan avbrottsskydd.
- Inga tester och ingen linter.
- Spökpasset 2025-11-19 "Bröst, axlar & biceps" är kvar med flit.

## Resume here

Börja med nextAction ovan. `CONTEXT.md` har domänmodellen, `BACKLOG.md` resten av det öppna, `AGENTS.md` de hårda reglerna och minorna som redan kostat tid.
