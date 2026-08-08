# Beefcake — Backlog

Den fullständiga analysen och prioriteringen ligger i `AUDIT.md`. Färdiga arbetsuppgifter att lämna över ligger i `MISTRAL-WORKPLAN.md`. Den här filen är bara en snabböversikt.

## Byggt och i drift

- IndexedDB-schema med fyra stores (templates, exercises, sessions, exerciseHistory)
- Template CRUD
- Övningskatalog med id, seedad ur historiken
- Logga pass: välj mall, förifyllda värden, spara
- Statistik: volym per övning, frekvens per mall, 30-dagarsaktivitet, PR-lista
- Påminnelse: kontroll vid appstart, mer än 3 dagar
- Export JSON och CSV, import JSON
- PWA med service worker och offline
- Lösenordsgrind (klientsida)
- Deploy via GitHub Actions till GitHub Pages, live på orgutveckling.se/beefcake
- All historisk träningsdata inbakad som seed i `src/db/seedData.ts`

Excel-importen i webbläsaren är **borttagen** (commit `410efd1`). `xlsx` 0.18.5 producerade en tom chunk under Vite 8. Återinför den inte; seedning sker med ett skript vid byggtid.

## P0 — kritiskt

- [ ] Automatisk backup: JSON-export till fil, plus varning om ingen export gjorts på 30 dagar
- [ ] Importera de 72 saknade passen (2025-11-19 → 2026-07-28) från `C:\dev\Styrkepass v2.xlsx`, idempotent, matchad på naturlig nyckel
- [ ] Datamodell: `SetEntry[]` istället för `sets`/`reps`/`weight`, plus `Exercise.kind` för kroppsvikt, tid och distans
- [ ] Historiksida med detaljvy, redigera, radera och upprepa
- [ ] Ta bort `alert()` vid appstart, ersätt med banner
- [ ] Städa `undefined`-mallen ur datan
- [ ] Gör `createSession` atomär, en transaktion istället för tre

## P1 — hög påverkan

- [ ] Radera `src/index.css` (Vite-mallens starter-CSS styr fortfarande layouten)
- [ ] Visa "förra gången" per övning på loggningssidan
- [ ] Autosave av påbörjat pass
- [ ] Dashboard med "nästa pass" som primär handling
- [ ] Loggningsformuläret som tabell på desktop, kort på mobil
- [ ] Statistik som svarar på rätt frågor: estimerat 1RM, tonnage per vecka, streak, periodfilter
- [ ] Övningssida med progression
- [ ] Fixa race conditions och Chart.js-läckor

## P2 — polish

- [ ] Designsystem: tokens och sex komponenter, mörkt läge
- [ ] Desktop: sidebar och tvåkolumnslayout
- [ ] Mobil: bottennavigering, kort istället för tabeller, 44 px tryckytor
- [ ] Loading- och empty states överallt
- [ ] Undo vid radering
- [ ] Lazy-ladda Chart.js
- [ ] Tester (Vitest) och ESLint, båda i CI
- [ ] Ta bort dubbel manifest-länk i `index.html`

## P3 — senare

- [ ] Web Push-påminnelser
- [ ] Kortkommandon på desktop
- [ ] Tvåanvändarstöd, om det verkligen behövs
- [ ] Cloudflare Pages med Access istället för GitHub Pages
- [ ] RIR/RPE och anteckningar i gränssnittet

## Bygg inte

Program-motor (5×5, GZCL) · flerspråkighet · sociala funktioner och delade mallar · AI-förslag på vikter · egen backend enbart för synk · Excel-import i webbläsaren · trettio diagram.
