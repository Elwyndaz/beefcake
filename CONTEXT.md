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
SetEntry         { sets, reps, weight, rpe? }
ExerciseKind     'weight' | 'bodyweight' | 'time' | 'distance'
Exercise         { id, name, kind?, muscleGroup?, equipment?, createdAt }
TemplateExercise { exerciseId, defaultSetEntry: SetEntry, order }
Template         { id, name, exercises: TemplateExercise[], updatedAt }
SessionExercise  { exerciseId, exerciseName, setEntries: SetEntry[], order, notes? }
Session          { id, date (YYYY-MM-DD), templateId, templateName, exercises: SessionExercise[], createdAt }
ExerciseHistory  { id, date, exerciseId, exerciseName, setEntries: SetEntry[], volume, sessionId }
ActiveSetEntry   SetEntry plus { completed?, type?: 'normal'|'warmup'|'drop'|'failure' }
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
- `syncSeed()` körs bara i en tom databas (sedan 2026-09-01). Den var additiv vid varje uppstart, men med D1 som sanningskälla kom varje raderat seedpass tillbaka nästa gång appen laddades. Ny seeddata läses in en gång via en tömd klient och sprids sedan via D1. Matchningen inne i seeden är kvar: pass på `(datum, passnamn)`, övningar på gemener, aldrig på `seed-N`-id.
- Ett spökpass 2025-11-19 "Bröst, axlar & biceps" finns med flit, en artefakt av `=TODAY()`-drift i arket. Städa inte bort det.
- Seeden innehåller 33 övningar, 9 mallar och 418 pass. Mallen med namnet `undefined` filtreras bort i `syncSeed`, så åtta laddas.

## Lagring och nödräddning

D1 lagrar versionsnumrerade snapshots per Access-identitet och är sanningskälla. Klienten hämtar serverns snapshot före seedning och använder IndexedDB som lokal cache. Efter varje mutation synkar `syncCloudData()` snapshoten till D1. Workern och JSON-importen validerar hela domänmodellen med samma `validateSnapshot()` i `src/lib/importValidation.ts`, inklusive att varje historikrad pekar på ett pass som finns.

- Skrivning använder enkel `POST` med `Content-Type: text/plain` och `credentials: include`, eftersom Cloudflare Access stoppar CORS-preflight utan Access-cookie.
- Skrivning kräver senaste revision, så en gammal klient får 409 i stället för att skriva över nyare data.
- Synkfel visas beständigt i appen och får inte sväljas av `autoBackup()`.
- Export och import av JSON är endast manuell nödräddning i Inställningar. Filbackup används aldrig automatiskt.

## Beefcake-nivån

Cartman speglar träningskedjan. I full storlek med statustexten bara på Hem (sedan 2026-09-01), på övriga sidor som 40 px avatar i headern, sidebaren och railen. `src/lib/streak.ts` äger regeln, och är det enda stället: ett glapp på över **tre dagar** bryter kedjan och sätter nivå 1, annars stegas nivån upp med kedjans längd (1-3 pass ger 2, 4-9 ger 3, 10 eller fler ger 4). Takten motsvarar "varannan dag", ungefär fyra pass i veckan. Streak-kortet i Statistik och alla andra läsningar går genom samma funktion.

`beefcakeStatusText()` returnerar två rader: nivåns namn och förklaringen. Radbrytningen är en del av formatet, texten renderas med `white-space: pre-line`. Påminnelsen om latmasken efter mer än tre dagar bor i nivå 1-textens andra rad; det finns ingen separat banner.

Avatarerna i `src/assets/beefcake/` och ikonerna `favicon.ico`, `apple-touch-icon.png` och `pwa-*.png` i `public/` är **genererade**, aldrig handredigerade. Originalen ligger i `assets-source/` och byggs om med `python scripts/generate-beefcake-assets.py`. Favicon är huvudet ur `beefcake3.jpg`.

## Muskelgrupper

`MUSCLE_GROUP_MAP` och `EQUIPMENT_MAP` i `dataService.ts` mappar övningsnamn till muskelgrupp respektive stång (`skivstång` 20 kg, `ez-stång` 10 kg, stångvikterna i `src/lib/plates.ts`). `backfillExerciseMeta()` körs i `syncSeed` och fyller på det som saknas, aldrig över ett satt värde. Övningar utan mappning visas som "Övrigt" i statistiken och får ingen plattrad i loggvyn. Både grupp och utrustning härleds ur namnet, de väljs aldrig av användaren vid loggning.

## Arkitektur

Vite 8 · Preact 10 · TypeScript strict · wouter · `idb` · Chart.js (lazy) · vite-plugin-pwa (Workbox) · Cloudflare Worker · D1 · Access. Cirka 2 000 rader klientkod.

```
src/main.tsx              entry, syncSeed sedan render
src/app.tsx               Router, navigering, rutter
src/app.css               all styling, tokens överst
src/components/           Button, Card, Stat, EmptyState, Field, PasswordGate, RestTimer, PlateCalculator, CloudSyncStatus, BeefcakeBadge (märke, avatar, useBeefcakeStreak)
src/db/schema.ts          IndexedDB-schema och typer
src/db/seedData.ts        GENERERAD, all träningshistorik
src/lib/date.ts           all datumhantering, tidszonssäker. Använd den, aldrig new Date() rakt av
src/lib/format.ts         vikt och set som text, svensk notation
src/lib/volume.ts         volymformeln, enda stället
src/lib/hypertrophy.ts    set per vecka mot bandet 10-20
src/lib/streak.ts         beefcake-nivån ur passdatumen
src/lib/plates.ts         skivor per sida och stångvikt per utrustning
src/lib/exerciseMetrics.ts Epley-1RM, grafens mått per genomförande, rekord per repsantal
src/lib/warmup.ts         uppvärmningsset ur första arbetssetet
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
- Desktop är den primära upplevelsen, mobilen ska ändå vara fullvärdig. Brytpunkter: mobil under 768 px, tablet 768 till 1199 px, desktop från 1200 px. Tryckytor på mobil minst 44 × 44 px; enda undantaget är settypsbrickan i loggvyn (32 px, trycks sällan). Tabeller som inte ryms på telefon renderas som kort med `.history-list-cards` och `.history-list-table`, aldrig med sidled-scroll.
- Loggvyn på telefon: inga stegknappar, inget tangentbordsbyte (`inputMode` decimal på kg, numeric på reps), RPE som bricka, plattor som text under tabellen. Vilotimern är det enda som får `--font-mono`.
- Alla vyer byggs med komponenterna i `src/components/`, aldrig ad-hoc `class="card"`.
- Färger kommer alltid från tokens i `app.css`, också utanför `:root`: settypsbrickor, timern och plattkalkylatorn har egna tokens med mörk variant, `--on-accent` för text på fyllda ytor. Hårdkodad hex i `.tsx` är förbjudet (undantag: skivornas IPF-färger i PlateCalculator, en fysisk egenskap), Chart.js läser via `getCSSVar()`. Ljust läge är AA-räknat 2026-09-01: text, muted, accent, success, warning och danger håller minst 4,5:1 mot surface och surface-raised. Nya tokens dokumenteras med kommentar i `app.css`.
- Typografi: Geist, self-hostad. Rubriker 800 med `-0.02em`, brödtext `line-height: 1.7`, `tabular-nums` på allt numeriskt. Geist Mono bara i vilotimerns siffror.
- `.card` är stilla; lyft vid hover hör bara till klickbara kort (`.history-card`).
- `alert()`, `confirm()` och `prompt()` är förbjudna. De blockerar appen och gör automatiserad testning omöjlig.
- Minsta ändring som helt löser uppgiften. Inga refaktoreringar på vägen.
- `npm test` (Vitest) täcker de rena beräkningarna i `src/lib/`. Den kör före `npm run build` i deploy-workflowen, så ett rött test stoppar deployen.

## Säkerhet, känt och accepterat

Lösenordsgrinden är enbart klientsida: `AUTH_HASH` ligger i bundlen, SHA-256 utan salt. Upplåsningen sparas i `localStorage`, inte `sessionStorage`, så grinden inte kräver lösenordet i varje ny flik. Den hindrar en nyfiken förbipasserande, inget mer. Riktigt skydd kräver en server framför appen, till exempel Cloudflare Access, vilket ligger i `BACKLOG.md`. Återanvänd inte lösenordet någon annanstans. IndexedDB är okrypterat, och GitHub Pages kan inte sätta CSP-headers.
