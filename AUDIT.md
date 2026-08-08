# Beefcake — Audit och plan

Datum: 2026-08-08. Granskat: hela repot (2 024 rader källkod), IndexedDB-schemat, seed-datan, båda Excel-filerna, git-historiken, bygget och appen körd live i webbläsare på desktop (1600 px) och mobil (390 px).

---

## 1. Executive summary

Beefcake är en **lokal, enanvändar-träningslogg** som lagrar allt i webbläsarens IndexedDB. Den fungerar. Den är inte en produkt.

Tre saker överskuggar allt annat:

1. **Det finns ingen historiksida och ingen redigering.** Du kan skapa pass men aldrig se, ändra eller radera ett. `updateSession` och `deleteSession` finns i koden men anropas från noll ställen. Excel kunde det här. Appen kan det inte. Det ensamt gör appen sämre än arket den ersätter.
2. **All data ligger i en enda webbläsares IndexedDB, utan backup och utan synk.** Rensar du webbläsardata är 347 pass borta. Du på datorn och din tjej på mobilen får två helt separata databaser som aldrig möts, och hennes telefon seedas dessutom med *dina* 347 pass. Det här är en produktdesignfråga, inte en bugg, och den måste besvaras innan något annat byggs.
3. **72 träningspass saknas i appen, men ingenting är förlorat.** Seeden byggdes mot en äldre ögonblicksbild av Excel-arket. Källfilen `C:\dev\Styrkepass v2.xlsx` går fram till 2026-07-28 och innehåller 341 rader som appen aldrig fick. Den historiska datan i appen är samtidigt verifierat orörd: exakt 1 176 rader till och med 2025-11-19 i båda. Se avsnitt 3.

Utöver det: startsidans CSS är fortfarande Vite-mallens starter-CSS, appen är låst till 1 126 px mitt på skärmen, en `alert()` blockerar varje appstart, och en mall heter bokstavligen "undefined".

Migreringsmaskineriet däremot är **bra**. Referensintegriteten är 100 %, inga id-kollisioner finns, och varje rad den fick in kom in korrekt. Den kördes bara mot fel fil. Logiken behöver inte skrivas om, den behöver köras om, idempotent.

---

## 2. Vad produkten faktiskt är

### A. Kärnfunktion

> Beefcake är en offline-först loggbok där ett *pass* är en mall av övningar, och varje övning loggas som en enda rad: set × reps × vikt. Statistiken räknar volym per övning över tid.

Den viktigaste användaruppgiften, formulerad ur den faktiska implementationen:

> "Jag vill öppna appen, välja mallen för dagens pass, se vad jag lyfte förra gången, justera vikterna, och spara. Sedan vill jag kunna se att jag blir starkare."

Halva den meningen finns inte i appen idag. Du ser aldrig vad du lyfte förra gången på den sida där du behöver det.

### B. Användarflödet som det är idag

| Steg | Vad som händer | Problem |
|---|---|---|
| 1. Öppnar appen | Lösenordsruta | Rimlig |
| 2. Efter 1 sekund | `alert()` blockerar hela appen | Modal dialog, måste klickas bort, varje gång |
| 3. Dashboard | 3 sifferkort + 5 senaste pass | Ingen primär handling, "Logga nytt" är en liten knapp längst ner till höger |
| 4. Logga pass | Väljer mall i en dropdown | Mallen är förvald till den *senast uppdaterade*, inte den du logiskt ska köra |
| 5. Ser övningar | 13 identiska formulärrader | Etiketterna Övning/Set/Reps/Vikt upprepas 13 gånger. Ingen gruppering, ingen ordning, ingen referens till förra gången |
| 6. Registrerar set | Skriver in tre siffror per övning | Du anger *antal* set, inte enskilda set. Kan inte logga 5 set med olika vikt |
| 7. Ändrar | Skriver om siffran | Ingen autosave. Byter du sida är allt borta |
| 8. Avslutar | Klickar "Spara pass" | Allt-eller-inget. Ingen bekräftelse på vad som sparades |
| 9. Ser resultat | Formuläret töms, en toast i 2 sekunder | Du kan inte öppna passet du just sparade |
| 10. Statistik | 4 kort | Ett av dem är tomt, ett innehåller "undefined" |
| 11. Historiska pass | **Finns inte** | Enda vägen till gammal data är Export CSV |

Var användaren tänker för mycket, klickar för mycket, eller kan göra fel:

- **Måste komma ihåg sina vikter själv.** Appen har 1 176 historikrader och visar noll av dem när du loggar. Varför ska användaren göra det själv?
- **Kan logga samma pass två gånger samma dag utan varning.** Ingen dubblettkontroll.
- **Kan spara ett pass med 0 set eller 0 kg utan varning.** 16 sådana finns redan i datan.
- **Kan inte ångra någonting.** Ingen undo, ingen redigering, ingen radering.
- **Vet inte om något sparades.** Toasten är borta efter 2 sekunder och passet syns ingenstans.

---

## 3. Data: var de senaste passen fanns

**Löst.** Källan är `C:\dev\Styrkepass v2.xlsx`, med data fram till 2026-07-28. Appens seed byggdes mot en äldre ögonblicksbild som stannade vid 2025-11-19, och det är hela förklaringen till de saknade passen.

### Vad som saknades i appen

| | Appens seed | Rätt Excel-fil | Skillnad |
|---|---|---|---|
| Datarader | 1 176 | 1 517 | **+341** |
| Distinkta datum | 232 | 302 | **+70** |
| Pass, (datum, passtyp) | 347 | 419 | **+72** |
| Sista pass | 2025-11-19 | **2026-07-28** | 8 månader |

**72 träningspass saknas i appen**, fördelade så här:

| Månad | Nya rader |
|---|---|
| 2025-11 (efter den 19:e) | 16 |
| 2025-12 | 58 |
| 2026-01 | 59 |
| 2026-02 | 32 |
| 2026-03 | 71 |
| 2026-04 | 20 |
| 2026-05 | 38 |
| 2026-06 | 22 |
| 2026-07 | 25 |

### Den historiska datan är intakt

Detta är det viktiga: jag jämförde de två filerna rad för rad, positionellt.

- Rader daterade till och med 2025-11-19 i den nya filen: **1 176**. Exakt samma antal som seeden. Ingenting har flyttats, raderats eller skrivits om i den gamla historiken.
- 1 169 av 1 177 ledande rader är teckenidentiska. De 8 som skiljer är förbättringar du själv gjort: `hantelrodd` heter numera `Hantelrodd`, och de sex rader som hade `=TODAY()` i datumkolumnen har fått fasta datum.
- **Noll `=TODAY()`-formler kvar i datumkolumnen.** Den fällan är stängd.

Slutsatsen från förra granskningen står alltså kvar där det räknas: **migreringen tappade ingen data.** Den kördes bara mot fel fil.

### Vad som är nytt i datan och som kräver hantering

| Fynd | Antal | Betydelse |
|---|---|---|
| Nya övningar utanför katalogen | 4 | `Benspark`, `Benspark baksida`, `Hantelrodd`, `Hip-thrusts` |
| Ny passtyp | 1 | `Rygg & biceps` (skild från `Rygg, ben & mage`) |
| Rader utan vikt | 23 | Kroppsvikts- eller konditionsövningar, se avsnitt 8 |
| Rader med `set` = 0 eller tomt | 11 | Ofullständigt ifyllda |
| Rader utan passnamn | 1 | Blir en `undefined`-mall om det inte städas |
| `Hantelrodd` vs `hantelrodd` | — | Måste mappas till **samma** övning, annars splittras historiken på två poster |

### Varför en ny seed inte räcker

Det går inte att bara generera om `seedData.ts`. `seedIfEmpty()` i `dataService.ts:274` kör **bara om `sessions`-tabellen är helt tom**. Din webbläsare har redan 347 pass, alltså skulle en ny seed aldrig laddas. Uppdateringen måste bli en **upsert som lägger till det som saknas**, inte en seed som ersätter allt.

Och den får inte matcha på id. Om seed-generatorn körs mot den nya filen numreras `seed-N` om, eftersom fyra nya övningar och en ny passtyp skjuter in sig i sekvensen. Matchningen måste ske på naturlig nyckel: `(datum, passnamn)` för ett pass och `(datum, övningsnamn, passnamn)` för en historikrad. Då kan importen köras om hur många gånger som helst utan att skapa dubbletter.

### Källfilen

`C:\dev\Styrkepass v2.xlsx` (sha256 `10a1d9e8…`, data till 2026-07-28) är källan. Den är den enda fil någon import ska läsa.

Den första granskningen kördes mot `Styrkepass v2 - kopia.xlsx`, en ögonblicksbild från 2025-11-19 som låg kvar i samma mapp. Den är nu borta. Lärdomen för nästa gång: kontrollera datumet på den **senaste raden i datan**, inte filens tidsstämpel och inte att två kopior är identiska. Två filer kan vara byte-identiska och båda vara nio månader gamla.

### Fälla som fortfarande finns i arket

Längst ned i `Träningsdata` ligger din **tomma mall**, numera daterad 2026-08-08 via `=TODAY()`, med `set = 0`. Den ligger i kolumn B medan riktig data ligger i kolumn A. Varje import måste läsa datum ur **kolumn A** och därmed automatiskt hoppa över mallblocket. Den gamla migreringen gjorde rätt, men av en slump snarare än av design. Gör det medvetet den här gången.

**Rör aldrig Excel-filerna annat än läsning.**

---

## 4. Kritiska buggar och funktionella brister

Sorterade efter verklig påverkan, inte efter hur lätta de är att fixa.

### K1. Ingen historik, ingen redigering, ingen radering
`updateSession`, `deleteSession`, `getSession`, `getSessionsByTemplate` finns i `dataService.ts` men anropas från **noll** komponenter. Det finns ingen route för ett enskilt pass. Sparar du fel vikt är den fel för alltid. Detta är den enskilt största regressionen mot Excel.

### K2. Data lever i en webbläsare, utan backup
`seedIfEmpty()` i `dataService.ts:274` kör bara om `sessions`-tabellen är helt tom. Två konsekvenser:
- Har du någon gång loggat ett pass i appen på en enhet får den enheten **aldrig** dina 347 historiska pass.
- Ny enhet med tom databas får hela din historik, även om det är din tjejs telefon.

Rensad webbläsardata, ny telefon, privat fönster: allt borta. Enda skyddet är att du manuellt klickar Export JSON.

### K3. `alert()` blockerar varje appstart
`app.tsx:31`. En modal systemdialog 1 sekund efter start, varje gång, på alla enheter. Den blockerar hela renderingen tills den klickas bort. Den gjorde till och med att den automatiska testningen hängde.

### K4. Mallen som heter "undefined"
9 rader i Excel saknar passnamn. De blev en mall med namnet `undefined` och 3 pass. Syns i statistikens frekvensdiagram som en stapel märkt "undefined".

### K5. Heatmap-kortet är helt tomt
`Stats.tsx:66` renderar bara diagrammet om `heatmapData.length > 0`. Du har inte tränat på 30 dagar, alltså är arrayen tom, alltså ritas ingenting. Kortet står tomt utan text. Ett tomt aktivitetsdiagram ska visa 30 tomma dagar, inte ingenting.

### K6. Kondition förorenar all volymstatistik
95 av 347 pass är "Kondition" med vikt 0 och därmed volym 0. De räknas som fullvärdiga pass i "Totala pass" men bidrar 0 kg till volymen. Datamodellen kan inte representera tid eller distans, bara set × reps × vikt.

### K7. Kroppsviktsövningar är matematiskt fel
Armhävningar, dips och chins loggas med vikt 0 eller med *tilläggsvikten*. I ditt gamla ark stod "KV" för kroppsvikt. Volymgrafen för Armhävningar faller till 0 i slutet, vilket ser ut som att du tappade all styrka. Det gjorde du inte, det är modellen som saknar begreppet kroppsvikt.

### K8. Chart.js-instanser läcker och tävlar
`Stats.tsx:42–76`. Tre `useEffect` med cleanup som läser diagrammet från `useState`. Cleanup-funktionen stänger in det *gamla* state-värdet, som är `null` första gången. Resultat: diagram förstörs inte alltid vid byte, och `loadVolumeChart` kan hinna köra mot en canvas som redan har en instans. Chart-instanser hör hemma i `useRef`, inte `useState`.

### K9. Race condition i mall-laddningen
`LogSession.tsx:36–42`. En `useEffect` med `[selectedTemplateId, templates]` anropar en async-funktion utan avbrottsskydd. Byter du mall snabbt kan ett äldre svar skriva över ett nyare.

### K10. `createSession` är inte atomär
`dataService.ts:108–147`. Passet skrivs i en transaktion, historiken i en annan, malluppdateringen i en tredje. Kraschar det mittemellan får du ett pass utan historik, och statistiken blir tyst fel. Alla fyra skrivningar hör hemma i **en** transaktion.

### K11. `parseFloat(...) || 0` sväljer fel
`LogSession.tsx:107` och `Templates.tsx:111`. Tömmer du viktfältet blir vikten 0, inte "tomt". Skriver du "abc" blir det 0. Kombinerat med att 0 är en giltig vikt går fel inte att skilja från avsikt.

### K12. Dubbletter av övningsnamn kan krascha sparandet
`schema.ts:96` sätter ett **unikt** index på övningsnamn. `getOrCreateExercise` slår upp på exakt namn. Skriver du "Bänk " med mellanslag eller "bänk" skapas en ny övning, och statistiken splittras på två poster. Skriver du in ett namn som redan finns med annan capitalisering får du en avvisad transaktion.

### K13. Ingen dubblettkontroll på pass
Inget hindrar två identiska pass samma datum. Trycker du "Spara" två gånger får du två pass.

### K14. Datum saknar år i gränssnittet
Dashboarden visar "ons 19 nov." Det är nio månader sedan. Utan årtal ser det ut som förra veckan.

### K15. Manifest-fel i konsolen
`Manifest: Line: 1, column: 1, Syntax error` i dev. `index.html` länkar `/manifest.webmanifest` samtidigt som vite-plugin-pwa injicerar sin egen. Dubbel manifest-länk.

### K16. Ingen loading state någonstans
Alla sidor renderar tomma tabeller och `0` i sifferkorten innan datan kommit. Du ser "Totala pass: 0" i en bråkdel av en sekund, varje gång.

### K17. Felhantering är `alert()` och `console.error`
`LogSession.tsx:84`, `Settings.tsx:43`. Ett misslyckat sparande ger en systemdialog utan detaljer, och formuläret ligger kvar i okänt tillstånd.

### K18. Ingen validering vid import
`importAllData` gör `JSON.parse` och skriver rakt in i databasen efter att först ha **rensat allt**. En trasig fil raderar din data och lämnar tomt. Ingen schemakontroll, ingen backup före.

### K19. Död kod och oanvända beroenden
Döda funktioner: `updateSession`, `deleteSession`, `getSession`, `getSessionsByTemplate`, `searchExercises`, `getExercise`, `formatReminderMessage`. Oanvända paket: `date-fns`, `workbox-window`. `backlog.md` har 16 obockade rutor som alla är byggda. `handoff.md` beskriver en Excel-import som är borttagen.

---

## 5. UX-problem

För varje: problem, varför det är ett problem, bättre lösning, nytta.

### U1. Dashboarden har ingen primär handling
**Problem:** Tre sifferkort överst, "Logga nytt" är en liten knapp längst ner till höger i ett annat kort.
**Varför:** Du öppnar appen för att träna, inte för att läsa siffran 347. Den viktigaste handlingen är den minst synliga saken på sidan.
**Lösning:** Överst ett stort "Starta pass"-block som redan vet vilket pass som står på tur, baserat på rotationen i din historik, med undertexten "Senast: ons 12 nov, 4 710 kg". Sekundärt: välj annat pass.
**Nytta:** Ett klick från öppning till loggning, utan att välja i en dropdown.

### U2. Du ser aldrig vad du lyfte förra gången
**Problem:** Loggningssidan visar mallens standardvärden. Appen har 1 176 historikrader och visar noll av dem.
**Varför:** Det är hela poängen med progressiv överbelastning. Utan referens gissar du.
**Lösning:** Varje övningsrad visar "Förra: 3 × 12 @ 60 kg (12 nov)" som grå text, och ett klick fyller i det.
**Nytta:** Det tar bort det enda du faktiskt behöver minnas.

### U3. Formuläret upprepar etiketter 13 gånger
**Problem:** "Övning / Set / Reps / Vikt (kg)" står ovanför varje rad. Med 13 övningar är det 52 etiketter.
**Varför:** Rent visuellt brus som gör sidan tre gånger så lång som den behöver vara.
**Lösning:** På desktop: en tabell med en rubrikrad. På mobil: kort med etiketter kvar, eftersom kolumner inte fungerar där.
**Nytta:** Hela passet ryms på en skärm på desktop.

### U4. "Ta bort" är den mest framträdande knappen
**Problem:** Röd `btn-danger` på varje rad. Layouten är dessutom trasig: `.grid-4` med fem barn gör att knappen hamnar på egen rad, centrerad, under övningsnamnet.
**Varför:** Den mest destruktiva handlingen drar ögat mest, och den ser ut som ett misstag.
**Lösning:** Diskret ikonknapp längst till höger i raden, med undo i en toast efteråt.
**Nytta:** Färre felklick, mindre visuellt kaos.

### U5. Ingen autosave
**Problem:** Halvifyllt pass, du byter flik eller telefonen låser sig, allt är borta.
**Varför:** Man loggar *under* passet, inte efter. Appen antar tvärtom.
**Lösning:** Skriv utkastet till IndexedDB vid varje ändring. Öppnar du appen igen: "Du har ett påbörjat pass från 17:32, fortsätt?"
**Nytta:** Appen blir användbar i gymmet, inte bara vid köksbordet.

### U6. Man loggar antal set, inte set
**Problem:** Ett fält "Set = 5" plus ett fält "Reps = 10". Det finns inget sätt att säga att set 4 gick tyngre eller att sista setet bara blev 8 reps.
**Varför:** Det här är Excel-modellen, och den är den verkliga begränsningen i produkten. Se avsnitt 8.
**Lösning:** Set som lista, med en "kopiera förra setet"-knapp så vanligtvis lika set fortfarande går snabbt.
**Nytta:** Loggen blir sann istället för ungefärlig.

### U7. Ingen väg tillbaka till ett pass
**Problem:** Sparat pass försvinner ur gränssnittet.
**Varför:** Man vill se vad man gjorde, och ibland rätta.
**Lösning:** Historiksida med filtrering på mall och period, och en detaljsida per pass med redigering, radering och "upprepa detta pass".
**Nytta:** Löser K1, U2 och "copy last workout" på en gång.

### U8. Mallar och pass blandas ihop
**Problem:** "Mall" i appen betyder både övningsprogram och passtyp. Statistiken heter "Frekvens per pass" men grupperar på mallnamn.
**Varför:** Otydligt vokabulär gör att man inte litar på siffrorna.
**Lösning:** Bestäm ett ord. Förslag: *Pass* är något du gjorde, *Program* är mallen. Byt genomgående.

### U9. Navigeringen är fem likvärdiga länkar
**Problem:** Hem, Logga pass, Mallar, Statistik, Inställningar. Alla lika viktiga enligt designen. På mobil radbryts de till två rader.
**Varför:** "Inställningar" används en gång i halvåret och tar lika mycket plats som "Logga pass".
**Lösning:** Desktop: sidebar med Hem / Träna / Historik / Statistik, och inställningar som ikon längst ner. Mobil: bottennavigering med fyra ikoner.

### U10. Inga tomma tillstånd som hjälper
**Problem:** Tomt heatmap-kort utan text. Tom PR-tabell utan text.
**Lösning:** Varje tomt tillstånd säger vad som saknas och vad man gör åt det.

---

## 6. Design

Nuvarande design är inte "tråkig". Den är **oavsiktlig**.

### D1. Vite-mallens CSS ligger kvar och styr layouten
`src/index.css` är fortfarande startmallen från `npm create preact`. Den importeras i `main.tsx` och innehåller:

```css
#app { width: 1126px; text-align: center; border-inline: 1px solid var(--border); }
```

Det här är orsaken till att:
- hela appen sitter i en 1 126 px bred kolumn mitt på en 1600 px skärm, med synliga lodräta streck i kanterna,
- alla rubriker och sifferkort är centrerade medan tabellcellerna är vänsterställda,
- det ser ut som en dokumentmall snarare än en app.

Filen definierar dessutom `--bg`, `--text`, `--border` och `--accent` med **samma namn** som `app.css`, plus ett `prefers-color-scheme: dark`-block som råkar vara dött bara för att importordningen är som den är. Det är en tickande bomb.

**Åtgärd: radera `src/index.css`, flytta `body { margin: 0 }` till `app.css`.** Detta är den enskilt största visuella förbättringen per rad kod i hela projektet.

### D2. Färgsystemet är Bootstrap-grått
`--primary: #2c3e50` (mörk skiffer) och `--accent: #e74c3c` (tegelröd) är Flat UI-paletten från 2013. Den läser som internt admin. En träningsapp ska kännas fysisk: djup bakgrund, en enda hög-energifärg som *bara* används för handling och rekord, och tydligt tunga siffror.

### D3. Ingen typografisk hierarki
Allt är `system-ui` i tre storlekar. Siffror är samma font som brödtext, och `font-variant-numeric: tabular-nums` saknas, så vikter i en kolumn hoppar i sidled.

### D4. Ingen mörkt läge trots att `color-scheme: light dark` deklareras
`index.css` säger att appen stödjer båda. `app.css` implementerar bara ljust. Ett gym är sällan välbelyst och telefonen står oftast i mörkt läge.

### D5. Inga design tokens värda namnet
`--spacing: 16px` och `--spacing-lg: 24px` är hela skalan. Två steg räcker inte, och resten löses med inline-`style`-attribut, som förekommer på 20-plus ställen i JSX:en.

### D6. Charts ärver ingenting
Chart.js-färgerna är hårdkodade hex mitt i `Stats.tsx`. Byter du tema följer inte diagrammen med.

### Vad ett designsystem här faktiskt behöver vara

Inte ett bibliotek. En fil med tokens (färg, 6-stegs spacing-skala, typskala, radie, skugga, motion) och sex komponenter: `Button`, `Card`, `Stat`, `Table`, `Field`, `EmptyState`. Allt annat är för tidigt.

---

## 7. Desktop och mobil

Idag är appen varken desktop-först eller mobil-först. Den är **bredd-agnostisk och därmed dålig på båda**.

**Desktop (1600 px):** 30 % av skärmen används. Ingen sidebar, ingen tvåkolumnslayout, inga hover-tillstånd bortom knappar, inga kortkommandon. Statistiken har fyra kort i ett 2×2-rutnät där två av dem är tomma eller trasiga.

**Mobil (390 px):** Navigeringen radbryts till två rader. De tre sifferkorten staplas och tar 700 px vertikalt innan något handlingsbart syns. Tabellen på dashboarden svämmar över i sidled så "Total volym" är avklippt. Navigeringslänkarna är cirka 30 px höga, under de 44 px som krävs för säkra tryckytor. Ingen sticky-knapp för den primära handlingen.

**Vad som bör gälla:**

| | Desktop | Tablet | Mobil |
|---|---|---|---|
| Navigering | Sidebar, alltid synlig | Sidebar kollapsad till ikoner | Bottennavigering, 4 ikoner |
| Loggning | Tabell, en rad per övning, förra gången i egen kolumn | Tabell utan förra-gången-kolumn | Ett kort per övning, ett i taget, sticky "Nästa" |
| Dashboard | 2 kolumner: starta pass + graf till vänster, historik till höger | 1 kolumn, graf kvar | 1 kolumn, graf under historik |
| Statistik | 3 diagram samtidigt + tabell | 2 diagram | 1 diagram i taget, med flikar |
| Tabeller | Riktiga tabeller | Tabeller | Kort |

---

## 8. Övningsmodellen: den verkliga tekniska skulden

Detta är projektets viktigaste arkitekturfråga.

Nuvarande modell (`schema.ts:26`):

```ts
interface SessionExercise { exerciseId, exerciseName, sets, reps, weight, order }
```

Ett heltal `sets`, ett heltal `reps`, ett tal `weight`. Det är Excel-raden, en till en.

**Vad modellen klarar:** vanliga viktövningar där alla set är identiska.

**Vad den inte klarar, och aldrig kan klara utan schemaändring:**

| Behov | Går det? | Varför inte |
|---|---|---|
| Set med olika vikt (5/5/3, pyramid, dropset) | Nej | Ett enda `weight`-fält |
| Set med olika reps (sista setet till failure) | Nej | Ett enda `reps`-fält |
| Kroppsvikt | Nej | `weight = 0` ger volym 0. 153 rader drabbade |
| Kroppsvikt + tilläggsvikt (chins +20 kg) | Fel | Lagras som 20 kg, volymen blir helt fel |
| Kondition: tid eller distans | Nej | 95 pass har volym 0 |
| RIR / RPE | Nej | Fältet finns inte |
| Uppvärmningsset vs arbetsset | Nej | Ingen typ på set |
| Superset | Nej | Ingen gruppering |
| AMRAP | Nej | Ingen markering |
| Anteckning per övning eller pass | Nej | Fältet finns inte |

**Rekommendation:** byt `SessionExercise` till att äga en `sets: SetEntry[]`, där `SetEntry` är `{ reps, weight, type: 'work' | 'warmup', rir?, done? }`, och lägg till `kind: 'weight' | 'bodyweight' | 'time' | 'distance'` på `Exercise` samt `bodyweightKg` på `SetEntry` för kroppsviktsövningar. Volym blir då en summa över set istället för en produkt, och kondition kan sluta ljuga.

Det här är en **migrering av 1 176 rader**, inte en refaktorering. Den befintliga datan konverteras rakt av: `sets: 3, reps: 12, weight: 60` blir tre identiska `SetEntry`. Ingen information går förlorad, och gammal data blir automatiskt korrekt.

**Detta bör göras tidigt.** Varje sida som byggs mot den gamla modellen måste byggas om annars. Det är därför datamodellen ligger före UX i implementationsordningen.

---

## 9. Statistik

Fyra kort idag. Ett är trasigt, ett innehåller "undefined", och alla svarar på fel frågor.

**Frågorna som faktiskt betyder något:**

1. Tränar jag regelbundet? → pass per vecka de senaste 12 veckorna, med ett streak-tal
2. Blir jag starkare? → estimerat 1RM per basövning över tid, inte volym
3. Vilka övningar utvecklas? → en lista sorterad på procentuell förändring de senaste 8 veckorna
4. Har volymen ändrats? → total tonnage per vecka, kondition exkluderad
5. När tränade jag senast? → hör hemma på dashboarden, inte i statistiken

**Konkreta fel i nuvarande statistik:**
- Volymgrafens x-axel är en **kategoriaxel**, inte en tidsaxel. 2024-06-09 och 2024-12-04 ligger lika långt isär som två pass i samma vecka. Grafen ljuger om tempot.
- PR-listan är osorterad (Map-ordning) och godtyckligt kapad till 10.
- "Max vikt" som PR ignorerar reps. 1 rep på 100 kg och 12 rep på 100 kg är samma PR.
- Ingen periodfiltrering någonstans.
- Estimerat 1RM finns inte, trots att det är det enda måttet som faktiskt svarar på "blir jag starkare".

---

## 10. Notifikationer och Power Automate

**Läget:** Power Automate-integrationen finns inte i repot. Noll träffar på `power automate`, `webhook`, `flow.microsoft`, `smtp` eller `mailto` i hela källkoden. Flödet läste `Senaste pass`-bladet i Excel-filen och mejlade dig. När du slutade uppdatera Excel slutade flödet fungera, oavsett om det är påslaget.

**Vad appen har istället:** `reminderService.ts`, som räknar dagar sedan senaste pass och visar en `alert()`. Logiken är korrekt och tidszonssäker (den jämför lokal midnatt, inte UTC). Presentationen är fel.

**Bedömning, utan att föreslå ombyggnad i onödan:**

- Behåll `reminderService`-logiken. Den är 30 rader och den är rätt.
- Byt `alert()` mot ett diskret banner på dashboarden. Det löser 90 % av värdet till nästan noll kostnad.
- **Behåll inte Power Automate.** Det körde mot en Excel-fil som inte längre uppdateras, det kräver att OneDrive-filen lever kvar, och det är en beroendekedja utanför appen för en enda notis.
- Vill du ha en påminnelse som når dig när appen är stängd är rätt lösning en **Web Push-notis via service workern**, som redan finns i projektet (Workbox). Det kräver ingen server om du använder en enkel push-tjänst, men det kräver notisbehörighet på varje enhet. Det är P2, inte P0.

---

## 11. Excel: vad som gick förlorat i översättningen

**Vad Excel kunde som appen inte kan:**

| Excel | Appen |
|---|---|
| Se och redigera vilken rad som helst direkt | Ingen historik, ingen redigering |
| Pivottabell och slicers, dela upp datan hur du vill | Fyra fasta diagram |
| Klistra in mallen och fylla i under passets gång | Allt-eller-inget-formulär |
| Kolumnen "Värde på pass" som räknade unika pass | Motsvarigheten saknas |
| Filtrera på övning med tidslinje-slicer | Ingen filtrering alls |

**Vad appen gör bättre:**
- Övningskatalog med id, så namnbyte inte splittrar historiken
- Automatisk volymberäkning per rad
- Fungerar på mobil
- Ingen risk för `=TODAY()`-datum som glider

**Vad som saknas från Excel-datan i appen:** ingenting av lyftdatan. Kolumnerna `Total antal reps` och `Total vikt lyft` är beräknade och räknas om i appen. `Värde på pass` var en 1/0-flagga för "första raden i ett pass", vilket appens sessionsgruppering ersätter.

**Import och export framåt:**
- **Export till CSV: behåll.** Den finns och den fungerar. Den är din verkliga backup så länge det inte finns något bättre.
- **Import från Excel: bygg inte.** Den togs bort av goda skäl (paketet `xlsx` byggde en tom chunk under Vite 8) och behovet är engångs och redan löst.
- **Import från JSON: behåll men gör den säker.** Idag rensar den allt innan den validerar. Se K18.
- **Behöver du seeda om från Excel** görs det med ett Node- eller Python-skript som genererar `seedData.ts`, körd manuellt, aldrig i webbläsaren. Originalfilerna öppnas skrivskyddat.

---

## 12. Säkerhet

| # | Fynd | Klass | Kommentar |
|---|---|---|---|
| S1 | Lösenordsgrinden är enbart klientsida | **High** | `AUTH_HASH` ligger i `src/config.ts`, buntas i JS-filen och laddas ner av alla. Att kringgå grinden kräver att man skriver `sessionStorage.setItem('beefcake-auth','1')` i konsolen. Jag gjorde exakt det under den här granskningen |
| S2 | SHA-256 utan salt, en iteration | **High** | Hashen `d2776709…` går att köra mot en ordlista på sekunder. Är lösenordet återanvänt någon annanstans är det ett verkligt problem |
| S3 | All träningsdata är oskyddad lokalt | **Medium** | IndexedDB är okrypterat. Alla med tillgång till webbläsarprofilen läser allt. Rimligt för träningsdata, men värt att veta |
| S4 | `importAllData` raderar före validering | **Medium** | Trasig fil ger tom databas. Datatapp, inte intrång, men samma effekt för dig |
| S5 | Ingen CSP | **Medium** | GitHub Pages ignorerar `_headers`. Känd begränsning, se din vault-not om säkerhetsheaders |
| S6 | `noindex` + `robots.txt` | Låg, korrekt | Rätt gjort |
| S7 | Beroenden | Låg, rent | `npm audit`: 0 sårbarheter |
| S8 | XSS | Låg | Preact escapar allt, ingen `dangerouslySetInnerHTML` någonstans. Rent |
| S9 | Ingen användarisolering | **Medium** som produkt | Det finns inget användarbegrepp. Din tjejs pass och dina hamnar i samma databas om ni delar enhet, och i två skilda databaser om ni inte gör det |

**Om S1 och S2, rakt ut:** grinden hindrar en nyfiken förbipasserande, inget mer. Vill du ha riktigt skydd måste appen bakom en server som gör autentiseringen, till exempel Cloudflare Access framför Cloudflare Pages. Det är samma flytt du redan har i backloggen. Behöver du inte riktigt skydd är den nuvarande grinden ärligt talat tillräcklig, men sluta då återanvända lösenordet.

**Jag har inte ändrat något säkerhetsrelaterat.**

---

## 13. Teknisk kvalitet

**Fungerar:**
- `tsc -b` går igenom rent, `strict` är på, inga `any` kvar utom två i `updateExercise`-hjälparna
- `npm run build` bygger på 424 ms
- `npm audit`: 0 sårbarheter
- Bygget är litet: 93 kB gzip huvudchunk, 18 kB seed-chunk
- IndexedDB-schemat har vettiga index på alla tabeller
- PWA/Workbox genererad korrekt, 12 precachade filer

**Fungerar inte:**
- **Inga tester.** Noll. Ingen testrunner installerad
- **Ingen linter.** Ingen ESLint-konfiguration finns
- **Ingen felrapportering.** `console.error` är hela strategin
- CI bygger men kör varken typecheck som separat steg, lint eller tester
- 20-plus inline-`style`-attribut i JSX
- `Home.tsx:16–27` hämtar senaste passdatum två gånger, en gång via `getAllSessions()` och en gång via `getLatestSessionDate()` som internt gör om samma anrop. Fyra läsningar av hela sessionstabellen vid varje sidladdning
- `getAllSessions()` läser **alla** 347 pass och sorterar i minnet varje gång, för att visa 5. Med 5 000 pass blir det märkbart
- 268 kB huvudchunk är nästan bara Chart.js. Det bör vara en lazy-laddad chunk som bara statistiksidan drar in

---

## 14. Produktanalys

### What sucks

1. Ingen historiksida. Sparat pass är osynligt för alltid
2. Kan inte redigera eller radera ett pass
3. `alert()` blockerar varje appstart
4. Vite-mallens CSS styr fortfarande layouten
5. Appen använder 30 % av en desktopskärm
6. Du ser aldrig vad du lyfte förra gången när du loggar
7. Ingen autosave, halvfärdigt pass går förlorat
8. Kan inte logga set med olika vikt
9. Kroppsvikt och kondition ger volym 0, vilket förstör statistiken
10. En mall heter "undefined"
11. Heatmap-kortet är tomt utan förklaring
12. Volymgrafens tidsaxel är inte en tidsaxel
13. Ingen backup, ingen synk, allt i en webbläsare
14. Mobilnavigeringen radbryts, tabellen svämmar över, tryckytorna är för små
15. Ingen loading state, siffror hoppar från 0
16. Ingen undo någonstans
17. Ingen periodfiltrering i statistiken
18. Estimerat 1RM finns inte, trots att det är måttet som svarar på "blir jag starkare"
19. Formuläret upprepar samma fyra etiketter 13 gånger
20. Inga tester, ingen linter

### What is good

- **Migreringen.** 1 176 av 1 176 rader, 100 % referensintegritet. Rör den inte
- **Datamodellens grund.** Fyra tabeller med rätt index. Övningskatalog med id är rätt beslut
- **Offline-först.** IndexedDB plus Workbox är rätt arkitektur för det här
- **Storleken.** 2 024 rader kod, 93 kB gzip. Det finns inget ramverksträsk att gräva sig ur
- **TypeScript strict** är redan på och bygget är rent
- **`reminderService`-logiken** är tidszonssäker och korrekt
- **Ingen backend att underhålla.** Behåll det så länge det går

### Biggest opportunities

Sorterade på förbättring per utvecklingstimme:

1. **Radera `index.css`** (5 minuter, förändrar hela intrycket)
2. **Byt `alert()` mot ett banner** (20 minuter)
3. **Historiksida med detalj och redigering** (störst funktionell vinst i hela listan)
4. **Visa "förra gången" på loggningssidan** (den enda funktionen som gör appen bättre än Excel i praktiken)
5. **Set som lista i datamodellen** (låser upp allt framtida, och blir dyrare ju längre du väntar)
6. **Automatisk backup till fil** (tar bort den enda verkliga katastrofrisken)

### Do not build

- **Program-motor med 5×5 och GZCL.** Du kör inte det programmet
- **Flerspråkighet.** Två användare, båda svenskar
- **Sociala funktioner, delade mallar.** Nej
- **AI-förslag på vikter.** Din historik ger dig svaret utan en modell
- **Egen backend enbart för synk.** Om synk verkligen behövs, se P1 i roadmapen, men börja inte där
- **Excel-import.** Den är gjord, engångs, och kostade redan en dags felsökning
- **30 diagram.** Fem som svarar på fem frågor slår trettio som svarar på inga
- **Rest timer**, om du inte faktiskt vilar på klocka. Vet du inte: bygg inte
- **Superset och dropsets i gränssnittet.** Se till att *modellen* klarar dem, bygg inte UI:t förrän du behöver det

---

## 15. AAA-produktvision

### Dashboard
Överst, halva skärmen: **Nästa pass**. Appen har räknat ut vilket program som står på tur ur din rotation. En stor knapp "Starta Bröst, axlar & biceps", med "senast onsdag 12 nov, 6 övningar, 4 710 kg" under. Bredvid: en liten länk "annat pass".

Under, tvåkolumn på desktop: till vänster ett stapeldiagram över pass per vecka de senaste 12 veckorna med streak-tal. Till höger de fem senaste passen som klickbara rader.

Har du inte tränat på över tre dagar: ett lugnt banner högst upp, inte en dialog. Din formulering får sitta kvar, men i ett banner du kan klicka bort.

### Workout
En sida per pass, inte ett formulär. Överst passets namn och en progressindikator "3 av 6 övningar". Övningen du är på är expanderad, resten är sammanslagna rader.

Per övning: namn, "förra: 3 × 12 @ 60 kg", och en lista set. Set 1 är förifyllt med förra gångens värden. Du ändrar vikten om du ändrade den, trycker på bocken, och nästa set fylls i från det du just gjorde. "+ set" lägger till, svep eller ikon tar bort med undo.

Allt sparas löpande. Stänger du appen mitt i finns passet kvar som utkast. "Avsluta pass" summerar: total volym, nya PR markerade, och en knapp som tar dig till passet i historiken.

Desktop får hela passet som en tabell med förra gången i egen kolumn, plus tangentbordsnavigering med tab mellan fälten och enter för att bocka av setet. Mobil får en övning i taget med en sticky "Klart, nästa övning".

### Exercise
Klick på ett övningsnamn var som helst öppnar övningssidan: graf över estimerat 1RM och arbetsvikt över tid, alla PR, och varje gång du kört den. Detta är sidan som besvarar "utvecklas jag i bänkpress".

### History
En lista grupperad per månad, filtrerbar på program och period. Varje rad: datum, program, antal övningar, volym, och PR-markering om något sattes. Klick öppnar passet med redigering, radering och **"Kör detta pass igen"**, som skapar dagens pass förifyllt med exakt de vikterna.

### Statistics
Fem saker, i den ordningen: pass per vecka med streak. Tonnage per vecka, kondition exkluderad. Estimerat 1RM per basövning. Övningar sorterade på utveckling de senaste 8 veckorna. PR-tabellen, komplett och sorterbar. Periodväljare högst upp som gäller allt.

### Settings
Export JSON och CSV. Import med validering och automatisk säkerhetskopia före. Automatisk export till nedladdningsmappen var N:e pass. Tema. Påminnelsetröskel i dagar, som idag är hårdkodad till 3. Radera all data, kvar som den är.

### Notifications
Banner i appen som första steg. Web Push via service workern som steg två, om du faktiskt vill bli påmind när appen är stängd. Power Automate pensioneras.

---

## 16. Roadmap

### P0 — Kritiskt

| # | Problem | Lösning | Storlek | Impact | Beroenden | Modell |
|---|---|---|---|---|---|---|
| P0-1 | 72 pass (2025-11-19 → 2026-07-28) saknas i appen | Idempotent upsert-import från `C:\dev\Styrkepass v2.xlsx`, matchad på naturlig nyckel, plus mappning av `Hantelrodd`/`hantelrodd` och de 4 nya övningarna | M | Hög | P0-2 | Claude |
| P0-2 | Ingen backup, allt i en webbläsare | Automatisk JSON-export till fil var 5:e sparat pass, plus varning om ingen export gjorts på 30 dagar | S | Hög | Inga | Claude |
| P0-3 | Ingen historik, ingen redigering | Historiksida + detaljsida med redigera, radera, upprepa | L | Hög | P0-5 | Claude |
| P0-4 | `alert()` blockerar appstart | Banner på dashboarden | S | Medel | Inga | Mistral |
| P0-5 | Datamodellen klarar inte set, kroppsvikt, kondition | `SetEntry[]`, `Exercise.kind`, migrering av 1 176 rader | L | Hög | Inga | Claude |
| P0-6 | Mall "undefined" och 3 pass | Datastädning i seed-generatorn, aldrig i befintlig databas | S | Låg | Inga | Claude |
| P0-7 | `createSession` inte atomär | En transaktion för alla fyra skrivningar | S | Medel | P0-5 | Claude |

**Acceptance P0:** ett pass kan loggas, hittas igen, redigeras och raderas. Set kan ha olika vikt. Kondition räknas inte som 0 kg volym. En backupfil finns på disk. Ingen dialog vid start.

### P1 — Hög påverkan

| # | Problem | Lösning | Storlek | Impact | Beroenden | Modell |
|---|---|---|---|---|---|---|
| P1-1 | Vite-mallens CSS styr layouten | Radera `index.css` | S | Hög | Inga | Mistral |
| P1-2 | Du ser aldrig förra gången | "Förra: 3 × 12 @ 60 kg" per övning, klick fyller i | M | Hög | P0-5 | Claude |
| P1-3 | Ingen autosave | Utkast i IndexedDB, återuppta vid start | M | Hög | P0-5 | Claude |
| P1-4 | Dashboarden har ingen primär handling | "Nästa pass"-block med föreslaget program | M | Hög | P0-3 | Claude |
| P1-5 | Loggningsformuläret är 13 identiska rader | Tabell på desktop, kort på mobil, en header | M | Hög | P0-5 | Mistral |
| P1-6 | Statistiken svarar på fel frågor | Estimerat 1RM, tonnage per vecka, streak, periodfilter | L | Hög | P0-5 | Mistral |
| P1-7 | Ingen övningssida | Progression per övning | M | Medel | P1-6 | Mistral |
| P1-8 | Race conditions och chart-läckor | `useRef` för chart-instanser, abort-flagga i async-effekter | S | Medel | Inga | Claude |

### P2 — Premium polish

| # | Problem | Lösning | Storlek | Impact | Beroenden | Modell |
|---|---|---|---|---|---|---|
| P2-1 | Ingen visuell identitet | Design tokens + 6 komponenter, mörkt läge | L | Hög | P1-1 | Mistral |
| P2-2 | Desktop använder 30 % av skärmen | Sidebar + tvåkolumnslayout | M | Hög | P2-1 | Mistral |
| P2-3 | Mobilen är en smal desktop | Bottennavigering, kort istället för tabeller, 44 px tryckytor, sticky action | M | Hög | P2-1 | Mistral |
| P2-4 | Inga loading- och empty states | Skeletons och riktiga tomma tillstånd överallt | M | Medel | P2-1 | Mistral |
| P2-5 | Ingen undo | Toast med ångra på radera | S | Medel | P0-3 | Mistral |
| P2-6 | Chart.js i huvudchunken | Lazy-ladda statistiksidan | S | Låg | Inga | Mistral |
| P2-7 | Inga tester, ingen linter | Vitest på dataService och statistikberäkningar, ESLint, båda i CI | M | Medel | P0-5 | Claude |
| P2-8 | Manifest-fel i konsolen | Ta bort dubbel manifest-länk i `index.html` | S | Låg | Inga | Mistral |

### P3 — Kan vänta

| # | Sak | Storlek | Modell |
|---|---|---|---|
| P3-1 | Web Push-påminnelser | M | Claude |
| P3-2 | Kortkommandon på desktop | S | Mistral |
| P3-3 | Tvåanvändarstöd, om ni verkligen behöver det | XL | Claude |
| P3-4 | Cloudflare Pages + Access istället för GitHub Pages | M | Claude |
| P3-5 | RIR/RPE och anteckningar i gränssnittet | M | Mistral |
| P3-6 | Städa `backlog.md` och `handoff.md`, ta bort `date-fns` och `workbox-window` | S | Mistral |

---

## 17. Implementationsordning

Ordningen styrs av ett enda beroende: **datamodellen bestämmer varje sida som rör pass.** Bygger du UX först får du bygga det två gånger.

1. **Backup först** (P0-2). Innan någon kod rör databasen: ta en Export JSON manuellt från appen, och bygg sedan den automatiska backupen. Billig försäkring
2. **Importera de 72 saknade passen** (P0-1). Idempotent upsert från `C:\dev\Styrkepass v2.xlsx`. Görs före datamodellsbytet, så att modellkonverteringen bara behöver köras en gång, över hela materialet
3. **Datamodellen** (P0-5, P0-6, P0-7). Set som lista, övningstyper, en transaktion, städad seed. Migrering av befintliga 1 176 rader i samma steg, verifierad med räkning före och efter
4. **Historik och redigering** (P0-3). Först nu går det att se att steg 3 blev rätt. Det här steget är också det som gör appen bättre än Excel
5. **Radera `index.css` och alert-bannret** (P1-1, P0-4). Två små ändringar som förändrar hur allt känns. Gör dem här för att resten av arbetet ska ske mot en ärlig layout
6. **Loggningsupplevelsen** (P1-2, P1-3, P1-5). Förra gången, autosave, riktig tabell. Kärnan i produkten
7. **Dashboarden** (P1-4). Kräver att historiken och loggningen finns för att kunna föreslå nästa pass
8. **Statistiken** (P1-6, P1-7). Kräver den nya datamodellen för att kunna räkna rätt på kroppsvikt och kondition
9. **Designsystemet** (P2-1). Nu, inte tidigare. Du vet vilka komponenter som faktiskt behövs först när alla sidor finns
10. **Desktop- och mobil-layout** (P2-2, P2-3). Bygger på tokens från steg 9
11. **Polish** (P2-4, P2-5, P2-6, P2-8)
12. **Tester och lint i CI** (P2-7). Sist av praktiska skäl, men skriv testerna för dataService redan i steg 3 medan logiken är färsk i huvudet
13. **P3 efter behov**

**Beroendekedjan i en mening:** backup → import av saknad data → datamodell → historik → utseende → loggning → dashboard → statistik → designsystem → responsivitet → polish → tester.

---

## 18. Vem gör vad

### Claude Code
Allt som kräver att man håller hela repot i huvudet samtidigt:
- **P0-5 datamodellsmigreringen.** Rör schema, dataService, seed-generatorn, alla fyra sidor och 1 176 befintliga rader på en gång. Ett fel här är tyst och permanent
- **P0-3 historik och redigering.** Ny routing, nya queries, redigeringsflöde som måste hålla ihop `sessions` och `exerciseHistory`
- **P0-2 backup**, för att den måste vara bevisat korrekt
- **P0-7 transaktioner** och **P1-8 race conditions**, klassiska svårfelsökta buggar
- **P1-2, P1-3, P1-4**, alla tre läser historik och skriver utkast, alltså tvärs igenom lagren
- **P2-7 testinfrastruktur**

### Mistral
Allt som är avgränsat och verifierbart mot en tydlig specifikation:
- **P1-1** radera `index.css`, mekaniskt
- **P0-4** alert till banner
- **P1-5** formulär till tabell och kort
- **P1-6, P1-7** statistiksidor, givet att beräkningarna specificeras
- **P2-1, P2-2, P2-3, P2-4** hela designsystemet och responsiviteten. Det här är Mistrals bästa användningsområde här: mycket CSS och många komponenter, litet blast radius
- **P2-5, P2-6, P2-8, P3-2, P3-5, P3-6**

### Manuellt av dig
- **Verifiera importen med egna ögon** efter steg 2. Öppna tre pass från våren 2026 som du minns och kontrollera vikterna
- **Verifiera datamigreringen med egna ögon** efter steg 3. Öppna tre pass du minns och kontrollera vikterna. En automatisk räkning kan stämma medan innehållet är fel
- **Ta en export innan varje P0-steg.** Trettio sekunders arbete, tar bort hela kategorin "vi förstörde datan"
- **Testa loggningen i gymmet**, inte vid skrivbordet. Halva UX-problemen syns bara med svettiga händer och telefonen i ena handen
- **Låt din tjej logga ett pass utan hjälp** och titta på var hon fastnar. Du kan inte se de problemen själv
- **Bestäm om appen ska vara en eller två användare.** Det är produktbeslutet med störst konsekvens i hela listan

---

## 19. Skulle jag ta betalt för det här?

Nej, inte idag, av tre skäl:

1. **Du kan inte se det du sparat.** En loggbok där posterna försvinner är inte en loggbok
2. **Data kan försvinna utan förvarning.** En rensad webbläsare, en ny telefon, ett privat fönster
3. **Modellen kan inte beskriva träning.** Set som inte kan skilja sig åt, kroppsvikt som väger noll, kondition som volym noll

Alla tre är fixade efter P0 och P1. Efter det är svaret ja för en app i den här kategorin, och den kommer inte att kännas som ett Excel-ark i en webbläsare.
