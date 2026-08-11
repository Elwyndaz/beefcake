---
schemaVersion: 1
status: active
currentGoal: Slutföra säker serverlagring för träningspass
nextAction: Koppla Access-applikation till beefcake-api och verifiera produktionssynk med ett nytt pass
blockers:
  - Access-applikationen täcker ännu inte Beefcake-API:ts, så produktionssynken är inte användarverifierad
reviewedAt: 2026-08-11
---

## Recent work

- Cloudflare Worker `beefcake-api` deployad till `https://api.orgutveckling.se` som Custom Domain, med Access-validering och D1-databasen `beefcake`.
- D1-migration `0001_snapshots.sql` applicerad remote. Snapshot-API:t kräver per-användare revision och avvisar gamla skrivningar med 409.
- Frontendens cloud sync använder IndexedDB som offline-cache och serverrevision som versionslås. GitHub Pages-builden får API-adressen via workflow-env.
- Lokal filbackup flyttad från träningsdata i LocalStorage till vald JSON-fil med serialiserad skrivkö.

- `ExerciseKind` typ tillagd i schema.ts (`'weight' | 'bodyweight' | 'time' | 'distance'`), `Exercise.kind` som optional field
- Volymberäkning uppdaterad i createSession, updateSession, syncSeed, getWeeklyTonnage, History.tsx och SessionDetail.tsx för att hoppa över setEntries med vikt 0
- Snabbvals-CTA:er på förstasidan för att välja bland de 2-3 senaste passen
- `SetEntry[]` ersätter `sets`/`reps`/`weight` genom hela kedjan: schema, models, dataService, LogSession, SessionDetail, Templates. Legacy-typer och migreringsfunktioner kvar för gammal seed-struktur.
- Designsystem-refresh: tokens i `app.css`, Geist self-hostad, komponenterna i `src/components/` används i alla vyer.
- Inline mallhantering i logg- och redigeringsläge: "Spara som mall" i LogSession, "Spara övningarna till mallen" + "Spara som ny mall" i SessionDetail.
- Muskelgrupper: `MUSCLE_GROUP_MAP` (namn → grupp), backfill i `syncSeed`, nytt "Muskelgrupper"
- Data-tappning: vald JSON-fil återställs i `syncSeed` före render i `main.tsx`, `autoBackup()` skriver filbackup och försöker server-synka efter varje mutation. Verifierat: wipe av IndexedDB → reload → alla pass tillbaka när backupfilen är tillgänglig.
- Dokumenten städade 2026-08-09: `AUDIT.md`, `MISTRAL-WORKPLAN.md` och `DESIGN-AUDIT.md` raderade, öppna poster flyttade till `BACKLOG.md`, domänmodellen samlad i `CONTEXT.md`.

## Verification

- Live-URL svarar 200, https://orgutveckling.se/beefcake/.
- 419 pass, 1 522 historikrader, 0 dubbletter efter seed-synk. Andra körningen lade till noll.
- Verifierat i koden 2026-08-09: `undefined`-mallen filtreras i `syncSeed` (`dataService.ts:535`), heatmap-kortet har ett tomt tillstånd (`Stats.tsx:471`), `date-fns` används av chart-adaptern och `workbox-window` är borta.
- Bygget grönt (`npm run build` exit 0) och deployen lyckad 2026-08-09 19:45, verifierad med `gh run list`.
- Responsivt verifierat på 390, 768, 1200 och 1600 px med skärmdumpar i `.playwright-shots/`. Den mappen är lokal och gitignorerad, dumparna finns inte i repot.
- `npm run build` grönt efter cloud sync-integrationen.
- `npm run server:check` grönt med D1-bindning och Access-vars.
- Remote D1 innehåller `snapshots` och migrations-tabell. Anonymt API-anrop svarar 401 `unauthenticated`.

## Unresolved details

- Access-applikationen måste täcka `api.orgutveckling.se` och frontend måste därefter verifieras med en riktig inloggad synk. Backend är deployad men denna sista användarverifiering är inte gjord.

- `importAllData` rensar databasen innan den validerar filen.
- Race condition i mall-laddningen i LogSession, async-effekt utan avbrottsskydd.
- Inga tester och ingen linter.
- Spökpasset 2025-11-19 "Bröst, axlar & biceps" är kvar med flit.

## Current checkpoint

Cloudflare Access-applikationen now protects `api.orgutveckling.se`. An unauthenticated request returns 302 to the Access login. The remaining verification is one authenticated client sync, followed by the frontend deployment.

## Resume here

Börja med nextAction ovan. `CONTEXT.md` har domänmodellen, `BACKLOG.md` resten av det öppna, `AGENTS.md` de hårda reglerna och minorna som redan kostat tid.
