# Beefcake — backlog

Öppna poster märks `[P0]` till `[P3]` i raden, det är så cockpiten räknar prioritet. Domänmodell och konventioner ligger i `CONTEXT.md`, nuläget i `HANDOFF.md`.

## Öppet

- [x] `[P0]` Koppla Cloudflare Access-applikation till `api.orgutveckling.se` och verifiera en riktig synk från produktionsklienten
- [x] `[P0]` `Exercise.kind` för kroppsvikt, tid och distans. 95 konditionspass har volym 0 och kroppsviktsövningar räknas fel
- [x] `[P1]` Autosave av påbörjat pass, utkast i IndexedDB som går att återuppta
- [x] `[P1]` `importAllData` validerar toppnivån före rensning. En trasig JSON tömmer inte längre databasen
- [x] `[P1]` Övningssida med progression, estimerat 1RM och arbetsvikt över tid per övning
- [ ] `[P2]` ESLint i CI. Vitest finns och kör före build, linter saknas fortfarande
- [ ] `[P2]` Race condition i mall-laddningen i LogSession, async-effekt utan avbrottsskydd
- [ ] `[P2]` `<datalist id="template-exercise-suggestions">` renderas en gång per övningsrad i Templates.tsx. Samma id upprepas, ogiltig HTML. Rendera den en gång utanför loopen
- [ ] `[P2]` Bestäm vokabulär: *pass* är något du gjorde, *program* är mallen. Byt genomgående
- [ ] `[P3]` Web Push-påminnelser via service workern
- [ ] `[P3]` Kortkommandon på desktop
- [ ] `[P3]` Cloudflare Pages med Access istället för GitHub Pages, riktig autentisering
- [ ] `[P3]` RIR/RPE och anteckningar i gränssnittet
- [ ] `[P3]` Tvåanvändarstöd, om det verkligen behövs. Största produktbeslutet i listan

## Byggt

- Aktivt pass: autosparat utkast i `activeWorkout`, återupptas från Hem eller loggvyn, avbockning per set som startar vilotimern
- Set-typer (uppvärmning, drop, failure), snabbsteg ±2,5 kg och ±1 rep, plattkalkylator per set
- Förifyllning från förra passets faktiska vikter och reps, med föregående set synligt per rad
- Övningssida `/exercises/:id` med 1RM- och volymkurva, rekord och alla tidigare genomföranden
- Set per muskelgrupp och vecka mot hypertrofibandet 10 till 20 set
- Vitest på volym-, format- och hypertrofiberäkningarna, kör före build i CI
- Datamodell med `SetEntry[]`, olika vikt och reps per set, migrering av all befintlig data
- `ExerciseKind` typ och volymberäkning som hoppar över vikt 0 för konditionspass
- Snabbvals-CTA:er på förstasidan för de 2-3 senaste passen
- Historiksida med detaljvy, redigering, radering, undo och "kör igen"
- Dashboard med nästa pass som primär handling, "förra gången" per övning vid loggning
- Statistik: estimerat 1RM, tonnage per vecka, streak, periodfilter, tidsaxel, PR-lista
- Designsystem: tokens, sex komponenter, mörkt läge, Geist self-hostad, sidebar på desktop, bottennavigering på mobil
- Loading- och empty states, lazy-laddad Chart.js, atomära skrivningar i createSession och deletes
- D1-snapshot per Access-identitet som sanningskälla, IndexedDB som lokal cache samt manuell JSON-export och import för nödräddning
- Inline mallhantering: spara aktuella övningar som ny mall från loggvyn och från passdetaljens redigeringsläge
- Muskelgrupper per övning, härledda ur namnet, med volym per grupp i statistiken. Återställs automatiskt om databasen töms (verifierat med wipe + reload)
- Muskelgrupper på övningar (auto-mappade från övningsnamn), volym per muskelgrupp i Statistik
- Inline mallhantering i logg- och redigeringsläge: spara övningarna som ny mall, eller spara till befintlig mall
- All träningsdata seedad ur Excel, additivt och idempotent via `syncSeed()`
- PWA med service worker och offline, lösenordsgrind, deploy via GitHub Actions till Pages

## Bygg inte

Program-motor (5×5, GZCL) · flerspråkighet · sociala funktioner och delade mallar · AI-förslag på vikter · egen backend enbart för synk · Excel-import i webbläsaren (borttagen i `410efd1`, `xlsx` 0.18.5 gav tom chunk under Vite 8) · trettio diagram · rest timer om du inte faktiskt vilar på klocka · superset och dropsets i gränssnittet, se bara till att modellen klarar dem.

## Captured

- [ ] [P2] [Wish] Om man har startat timer ska man få en promt/ruta med är du säker på att du vill lämna sidan du har en timer på?

- [ ] [P2] [Wish] göra vanlig sån firebase-inlogg

- [ ] [P2] [Wish] det ska gå att ha 0 i antalet set i övningen när man är inne på logga pass, det är så jag använder den, att alla börjar på 0 så klickar jag mig upp löpande under passet. Alla pass borde börja så förutom om man är inne och redigerar ett gammalt pass
