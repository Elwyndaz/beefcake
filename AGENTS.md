# AGENTS.md — läs detta först

Beständigt projektminne för AI-agenter som arbetar i det här repot. Du har inget minne mellan sessioner. Den här filen är minnet. Läs den innan du rör en enda fil.

**Håll den uppdaterad.** Lär du dig något som en framtida session skulle slösa tid på att återupptäcka, skriv in det under "Minor som kostat tid" innan du rapporterar klart.

---

## De fyra dokumenten

| Fil | Innehåll | Ensam sanning om |
|---|---|---|
| `CONTEXT.md` | Vad produkten är, domänmodell, arkitektur, konventioner, säkerhetsläge | domänen |
| `BACKLOG.md` | Vad som är byggt och vad som är kvar, prioritetsmärkt | arbetet |
| `HANDOFF.md` | Mål, nästa steg, blockerare | läget just nu |
| `AGENTS.md` | Den här filen: hårda regler, minor som kostat tid, verifiering | hur man arbetar här |

**Läs `CONTEXT.md` innan du rör kod.** Datamodellen, rutterna och konventionerna står där och står bara där. Upprepa dem inte här, det var precis så båda filerna hann bli fel samtidigt.

Versalerna är ett krav: cockpiten (`cockpit.buildapp.se`) hämtar exakt `HANDOFF.md`, `CONTEXT.md` och `BACKLOG.md`, och GitHubs API är skiftlägeskänsligt. Döp dem inte till gemener. Uppdatera `HANDOFF.md`, inklusive `reviewedAt`, när du rapporterar klart.

## Hårda regler

1. **`src/db/seedData.ts` är genererad. Redigera den aldrig för hand.** Den innehåller alla verkliga träningspass. Kör `python scripts/generate-seed.py` om den ska byggas om.
2. **Radera eller skriv aldrig om historisk träningsdata.** Inte i seed, inte i IndexedDB, inte i en migrering. Additivt eller inget.
3. **Excel-filen `C:\dev\Styrkepass v2.xlsx` öppnas bara för läsning.** Aldrig skrivning.
4. TypeScript strict. Ingen `any`. `npm run build` måste gå igenom.
5. Svenskt gränssnitt och svenska konventioner, **aldrig tankstreck**. Se `CONTEXT.md`.
6. Minsta ändring som helt löser uppgiften. Inga refaktoreringar på vägen.
7. **Återställ aldrig en fil du blivit tillsagd att inte röra.** Ligger det okommitterade ändringar där är de någon annans pågående arbete. Lämna dem. Se nedan.

## Minor som kostat tid

- **Tillgångar i `public/` måste använda bas-URL:en.** `<use href="/icons.svg#x">` ger 404, appen ligger under `/beefcake/`. Använd `icon()` från `src/icons.ts`, som bygger sökvägen ur `import.meta.env.BASE_URL`. Gäller allt i `public/`.
- **`src/index.css` var Vite-mallens starter-CSS** och styrde hela layouten via `#app { width: 1126px; text-align: center }`. Raderad. Återinför den inte.
- **`seedIfEmpty` fanns och var fel.** Den körde bara mot tom databas, så befintliga installationer kunde aldrig få ny data. Ersatt av `syncSeed`, additiv och idempotent, matchar pass på `(datum, passnamn)` och övningar skiftlägesokänsligt. Matcha aldrig på `seed-N`-id, sekvensen numreras om så fort en övning tillkommer i källan.
- **Excel-arket har en tom mall längst ned i bladet** med `set = 0` och `=TODAY()` som datum, och den ligger i kolumn B medan riktig data ligger i kolumn A. Generatorn kräver datum i kolumn A och hoppar därför över den. Ändra inte det till "första kolumnen med ett datum".
- **Övningsnamn förekommer i olika skiftläge** ("Hantelrodd" och "hantelrodd"). De måste bli en övning, annars splittras historiken. Jämför på `name.trim().toLowerCase()`.
- **`.header` doldes inte när sidebaren infördes**, vilket gav en andra "Beefcake" och dubbel marginal. Döljs nu över 768 px.
- **Excel-import i webbläsaren är borttagen** (commit `410efd1`). `xlsx` 0.18.5 byggde en tom chunk under Vite 8. Återinför den inte. Seedning sker med skript, aldrig i klienten.
- **Chart.js-instanser hör hemma i `useRef`, inte `useState`.** Cleanup-funktioner stänger in gamla state-värden och diagram förstörs då inte.
- **`alert()`, `confirm()` och `prompt()` är förbjudna.** De blockerar hela appen och gör automatiserad testning omöjlig.
- **Ett spökpass finns med flit:** 2025-11-19 "Bröst, axlar & biceps" är en artefakt av `=TODAY()`-drift i arket. Passet är verkligt men fel daterat och finns redan under rätt datum. Patrik har valt att lämna det. Städa inte bort det.
- **`restoreFromLocalStorage()` anropas redan i `syncSeed()`, som körs i `main.tsx` före render.** Lägg aldrig till fler restore-anrop i komponenter, de race:ar med seedningen och dubbel-skriver databasen.
- **Muskelgrupper mappas via `MUSCLE_GROUP_MAP` i dataService.ts** (övningsnamn → grupp). `backfillMuscleGroups()` körs i `syncSeed` och fyller på de som saknas. Övningar utan mapping hamnar som "Övrigt" i statistik.
- **Verifieringsskärmdumpar i `.playwright-shots/` ska aldrig committas.** Ligger i .gitignore sedan 2026-08-09.
- **`createTemplate` räknar själv ut `order`**, men `updateTemplate` kräver att övningarna redan har `order`. Anropa aldrig `updateTemplate` med `Omit<TemplateExercise, 'order'>[]`.
- **`geist`-npm-paketet fungerar inte i Vite/Preact.** Det är byggt för Next.js och har `next` som peer-dependency. Variant-fonten ligger i `node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2` och är vendored till `src/assets/fonts/` med `@font-face` i app.css. Återställ det inte till en Google Fonts-länk, PWA:n ska fungera offline.
- **Button/Card/Stat/EmptyState/Field raderades en gång som "unused"** (`194249a`) och fick återskapas i design-sprinten 2026-08-09. De används av alla sidor nu. En komponent utan importer är inte automatiskt död.
- **Ett dokument som beskriver koden hinner bli fel.** AUDIT.md, MISTRAL-WORKPLAN.md och DESIGN-AUDIT.md var ögonblicksbilder som påstod saker som inte längre stämde, och två av dem hade var sin kopia av datamodellen. Raderade 2026-08-09. Skriv inte nya. Öppna poster hör hemma i `BACKLOG.md`, allt annat i git-historiken.
- **Wrangler kan försöka skriva logg utanför arbetsytan och ge `EPERM` i sandbox.** Sätt `WRANGLER_LOG_PATH` till en tillfällig fil i repot för kontroller, till exempel `.wrangler-verify.log`, och ta bort filen efteråt. Ett tillfälligt D1-fel `7403` har lösts genom `wrangler whoami` och omedelbar retry.

## Flera agenter i samma repo

Claude Code och Mistral arbetar ibland parallellt i samma arbetsträd. Får du en filgräns i uppgiften gäller den strikt:

- Öppna, ändra eller formatera **inte** filer utanför din lista.
- **Återställ dem inte heller.** `git checkout` eller `git restore` på en fil utanför din lista raderar någon annans pågående arbete. Det har redan hänt två gånger.
- Behöver uppgiften en ändring utanför din gräns: stanna och rapportera i stället för att göra den.
- Committa inte om du inte blivit ombedd. Lämna ändringarna i arbetsträdet för granskning.

## Så verifierar du

```
npm run build     # måste ge exit 0, inga TS-fel
npm run dev       # http://localhost:5173/beefcake/
```

Lösenordsgrinden hoppas över i utvecklingsläge via webbläsarkonsolen:

```js
sessionStorage.setItem('beefcake-auth','1'); location.reload()
```

Gå igenom alla rutter på 390 px, 768 px, 1200 px och 1600 px: `/beefcake/`, `/log`, `/templates`, `/stats`, `/settings`. Konsolen ska vara ren, ingen vågrät scroll på 390 px, alla tryckytor på mobil minst 44 × 44 px.

Databasen kan nollställas i DevTools under Application, IndexedDB, radera `beefcake-db`. Appen seedar om sig automatiskt vid omladdning.

## Så rapporterar du

Vilka filer du ändrade, vad du gjorde per uppgift, utfallet av `npm run build`, och allt du hittade men inte kunde åtgärda innanför din filgräns. Det sista är värdefullt, hoppa inte över det.
