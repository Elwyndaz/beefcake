# Beefcake — Handoff

## Current State
Projekt initierat: Vite + Preact + TS + PWA struktur på plats.
Mapstruktur skapad: src/{db,models,services,components,pages,utils,workers}
context.md, backlog.md skapade.

## Next Steps (Priority Order)
1. **DB Schema & Init** (`src/db/schema.ts`, `src/db/init.ts`) — definiera stores, öppna DB, migration helper
2. **Models** (`src/models/index.ts`) — TypeScript interfaces för Template, Exercise, Session, ExerciseHistory
3. **Migration Script** (`src/db/migrateFromExcel.ts`) — läs Excel, skriv till DB (körs en gång i devtools)
4. **Services** — templateService, exerciseService, sessionService, statsService, reminderService
5. **Router & Layout** — wouter eller preact-router, header/nav, responsiv layout
6. **Pages** — Home (dashboard), LogSession, Templates, Stats, Settings
7. **Components** — återanvändbara UI-komponenter
8. **PWA Config** — vite.config.ts med vite-plugin-pwa, manifest
9. **Deploy** — Cloudflare Pages setup

## Key Decisions Locked
- Desktop-first, PWA, offline-first
- Cloudflare Pages hosting
- IndexedDB via `idb`
- kg only, svenska UI
- Template = pass-typ (en entitet)
- Local-first, export/import JSON+CSV
- Reminder: in-app toast vid start (>3 dagar)

## Files to Watch
- `context.md` — domain & tech overview
- `backlog.md` — prioritized task list
- `src/db/schema.ts` — DB definition
- `vite.config.ts` — PWA config