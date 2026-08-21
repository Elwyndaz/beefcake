# Beefcake — kontext

Personlig träningslogg för styrketräning, ersätter ett Excel-ark. Svenskt gränssnitt, bara kilo. Två användare i praktiken: Patrik på dator, hans tjej på mobil. D1 är sanningskälla och IndexedDB är lokal cache.

Live på https://orgutveckling.se/beefcake/ (GitHub Pages, bas-sökväg `/beefcake/`). Push till `master` bygger och deployar. Server-API:t är deployat som `https://api.orgutveckling.se` och använder D1 med Cloudflare Access.

**Den här filen äger domänmodellen och konventionerna.** Upprepa dem inte i andra filer, länka hit. `AGENTS.md` beskriver hur man arbetar i repot, `BACKLOG.md` vad som är kvar, `HANDOFF.md` var arbetet står just nu.

## Kärnuppgiften

> Öppna appen, välj dagens pass, se vad du lyfte förra gången, justera vikterna, spara. Sedan se att du blir starkare.

## Begrepp

- **Exercise** är en övning i katalogen. Har id, så ett namnbyte inte splittrar historiken.
- **Template** är ett färdigt pass: namn plus lista av övningar med standardvärden.
- **Session** är ett genomfört pass: datum, mall, och per övning de set som faktiskt kördes.
- **ExerciseHistory** är en denormaliserad kopia av passens övningar. Det är den statistiken läser.

Ordet **mall** används både om övningsprogram och passtyp i gränssnittet. Det är känt otydligt, se `BACKLOG.md`.

## Datamodell

Fem object stores i IndexedDB `beefcake-db`. Typerna bor i `src/db/schema.ts` och återexporteras via `src/models/index.ts`.

```ts
SetEntry         { sets, reps, weight }
ExerciseKind     'weight' | 'bodyweight' | 'time' | 'distance'
Exercise         { id, name, kind?, muscleGroup?, equipment?, createdAt }
TemplateExercise { exerciseId, defaultSetEntry: SetEntry, order }
Template         { id, name, exercises: TemplateExercise[], updatedAt }
SessionExercise  { exerciseId, exerciseName, setEntries: SetEntry[], order }
Session          { id, date (YYYY-MM-DD), templateId, templateName, exercises: SessionExercise[], createdAt }
ExerciseHistory  { id, date, exerciseId, exerciseName, setEntries: SetEntry[], volume, sessionId }
ActiveSetEntry   SetEntry plus { completed?, type?: 'normal'|'warmup'|'drop'|'failure', rpe? }
ActiveWorkout    { id, date, templateId, templateName, exercises: ActiveExercise[], startTime, updatedAt }
```

`setEntries` är en lista, så olika vikt eller reps per set fungerar. `Legacy*`-typerna och `migrate*`-funktionerna i `src/models/` konverterar gammal seed-struktur och får inte tas bort så länge `seedData.ts` har den gamla formen.

`activeWorkout` håller **ett** påbörjat pass, sparat vid varje ändring i loggvyn. Det är utkastet, inte ett pass: det blir en `Session` först när passet slutförs, och rensas då.

Volym räknas alltid genom `src/lib/volume.ts`. Vikt 0 betyder kroppsvikt eller kondition och ger volym 0. Skriv aldrig `sets * reps * weight` på nytt ställe.

**Skriv aldrig till `sessions` direkt.** `createSession`, `updateSession` och `deleteSession` håller ihop passet och dess historikrader i en transaktion. Skriver du ett pass utan att skriva om historiken blir graferna tyst fel.

## Data och seed

- **All träningsdata är verklig**, från 2024 till 2026-07-28. Radera eller skriv aldrig om historisk data, varken i seed, i IndexedDB eller i en migrering. Additivt eller inget.
- `src/db/seedData.ts` är **genererad**, aldrig handredigerad. Bygg om med `python scripts/generate-seed.py`.
- Källan är `C:\dev\Styrkepass v2.xlsx` och den öppnas **bara för läsning**.
- `syncSeed()` är additiv och idempotent. Den matchar pass på `(datum, passnamn)` och övningar på gemener. Matcha aldrig på `seed-N`-id, sekvensen numreras om så fort en övning tillkommer i källan.
- Ett spökpass 2025-11-19 "Bröst, axlar & biceps" finns med flit, en artefakt av `=TODAY()`-drift i arket. Städa inte bort det.
- Seeden innehåller 33 övningar, 9 mallar och 418 pass. Mallen med namnet `undefined` filtreras bort i `syncSeed`, så åtta laddas.

## Lagring och nödräddning

D1 lagrar versionsnumrerade snapshots per Access-identitet och är sanningskälla. Klienten hämtar serverns snapshot före seedning och använder IndexedDB som lokal cache. Efter varje mutation synkar `autoBackup()` snapshoten till D1.

- Skrivning använder enkel `POST` med `Content-Type: text/plain` och `credentials: include`, eftersom Cloudflare Access stoppar CORS-preflight utan Access-cookie.
- Skrivning kräver senaste revision, så en gammal klient får 409 i stället för att skriva över nyare data.
- Synkfel visas beständigt i appen och får inte sväljas av `autoBackup()`.
- Export och import av JSON är endast manuell nödräddning i Inställningar. Filbackup används aldrig automatiskt.

## Beefcake-nivån

Cartman i headern speglar träningskedjan. `src/lib/streak.ts` äger regeln: ett glapp på över **tre dagar** bryter kedjan och sätter nivå 1, annars stegas nivån upp med kedjans längd (1-3 pass ger 2, 4-9 ger 3, 10 eller fler ger 4). Takten motsvarar "varannan dag", ungefär fyra pass i veckan.

Avatarerna i `src/assets/beefcake/` och ikonerna `favicon.ico`, `apple-touch-icon.png` och `pwa-*.png` i `public/` är **genererade**, aldrig handredigerade. Originalen ligger i `assets-source/` och byggs om med `python scripts/generate-beefcake-assets.py`. Favicon är huvudet ur `beefcake3.jpg`.

## Muskelgrupper

`MUSCLE_GROUP_MAP` i `dataService.ts` mappar övningsnamn till muskelgrupp. `backfillMuscleGroups()` körs i `syncSeed` och fyller på det som saknas. Övningar utan mappning visas som "Övrigt" i statistiken. Gruppen härleds ur namnet, den väljs aldrig av användaren vid loggning.

## Arkitektur

Vite 8 · Preact 10 · TypeScript strict · wouter · `idb` · Chart.js (lazy) · vite-plugin-pwa (Workbox) · Cloudflare Worker · D1 · Access. Cirka 2 000 rader klientkod.

```
src/main.tsx              entry, syncSeed sedan render
src/app.tsx               Router, navigering, rutter
src/app.css               all styling, tokens överst
src/components/           Button, Card, Stat, EmptyState, Field, PasswordGate, RestTimer, PlateCalculator, CloudSyncStatus, BeefcakeBadge
src/db/schema.ts          IndexedDB-schema och typer
src/db/seedData.ts        GENERERAD, all träningshistorik
src/lib/date.ts           all datumhantering, tidszonssäker. Använd den, aldrig new Date() rakt av
src/lib/format.ts         vikt och set som text, svensk notation
src/lib/volume.ts         volymformeln, enda stället
src/lib/hypertrophy.ts    set per vecka mot bandet 10-20
src/lib/streak.ts         beefcake-nivån ur passdatumen
src/assets/beefcake/      GENERERADE avatarer, se assets-source/ och scripts/
src/services/dataService.ts   alla läsningar, skrivningar och statistik
src/services/timerService.ts  vilotimerns presets, notiser och start-event
server/src/index.ts         Access-skyddat snapshot-API med revisionslås
server/migrations/          D1-schema för versionsnumrerade snapshots
src/pages/                Home, LogSession, Templates, History, SessionDetail, ExerciseDetail, Stats, Settings
```

Rutter: `/` · `/log` (stödjer `?from=<sessionId>`, `?template=<namn>` och `?date=<YYYY-MM-DD>`) · `/templates` · `/history` · `/history/:id` · `/exercises/:id` · `/stats` · `/settings`.

Loggvyn startar timern genom att skicka `beefcake-start-timer` på `window`; `RestTimer` lyssnar. Det håller avbockning och timer i olika komponenter utan delad state.

## Konventioner

- TypeScript strict, ingen `any`, funktioner lyckas eller kastar.
- Svenskt gränssnitt. Decimalkomma (12,5), mellanslag som tusentalsavgränsare (12 500), **aldrig tankstreck**.
- Desktop är den primära upplevelsen, mobilen ska ändå vara fullvärdig. Brytpunkter: mobil under 768 px, tablet 768 till 1199 px, desktop från 1200 px. Tryckytor på mobil minst 44 × 44 px.
- Alla vyer byggs med komponenterna i `src/components/`, aldrig ad-hoc `class="card"`.
- Färger kommer alltid från tokens i `app.css`. Hårdkodad hex i `.tsx` är förbjudet, Chart.js läser via `getCSSVar()` i Stats.tsx. Nya tokens dokumenteras med kommentar i `app.css`.
- Typografi: Geist, self-hostad. Rubriker 800 med `-0.02em`, brödtext `line-height: 1.7`, `tabular-nums` på allt numeriskt.
- `alert()`, `confirm()` och `prompt()` är förbjudna. De blockerar appen och gör automatiserad testning omöjlig.
- Minsta ändring som helt löser uppgiften. Inga refaktoreringar på vägen.
- `npm test` (Vitest) täcker de rena beräkningarna i `src/lib/`. Den kör före `npm run build` i deploy-workflowen, så ett rött test stoppar deployen.

## Säkerhet, känt och accepterat

Lösenordsgrinden är enbart klientsida: `AUTH_HASH` ligger i bundlen, SHA-256 utan salt. Upplåsningen sparas i `localStorage`, inte `sessionStorage`, så grinden inte kräver lösenordet i varje ny flik. Den hindrar en nyfiken förbipasserande, inget mer. Riktigt skydd kräver en server framför appen, till exempel Cloudflare Access, vilket ligger i `BACKLOG.md`. Återanvänd inte lösenordet någon annanstans. IndexedDB är okrypterat, och GitHub Pages kan inte sätta CSP-headers.
