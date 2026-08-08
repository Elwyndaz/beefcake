# AGENTS.md — läs detta först

Beständigt projektminne för AI-agenter som arbetar i det här repot. Du har inget minne mellan sessioner. Den här filen är minnet. Läs den innan du rör en enda fil.

**Håll den uppdaterad.** Lär du dig något som en framtida session skulle slösa tid på att återupptäcka, skriv in det under "Minor som kostat tid" innan du rapporterar klart.

---

## Vad produkten är

Beefcake, en personlig träningslogg för styrketräning. Ersätter ett Excel-ark. Svenskt gränssnitt, bara kilo. Två användare i praktiken: Patrik på dator, hans tjej på mobil.

Live på https://orgutveckling.se/beefcake/ via GitHub Pages. Bas-sökväg `/beefcake/`. Push till `master` bygger och deployar automatiskt.

Ingen backend. All data ligger i webbläsarens IndexedDB.

## Stack

Vite 8 · Preact 10 · TypeScript strict · wouter · `idb` · Chart.js · vite-plugin-pwa. Cirka 2 000 rader källkod.

## Dokument som gäller

| Fil | Vad |
|---|---|
| `AGENTS.md` | Den här filen. Beständigt minne och hårda regler |
| `AUDIT.md` | Full genomlysning: buggar, UX, design, datamodell, säkerhet, roadmap P0–P3 |
| `MISTRAL-WORKPLAN.md` | Färdiga arbetsuppgifter med acceptanskriterier |
| `backlog.md` | Snabböversikt av vad som är byggt och vad som är kvar |
| `context.md` | Domänmodell och konventioner |

## Datamodell

```ts
Exercise         { id, name, muscleGroup?, equipment?, createdAt }
TemplateExercise { exerciseId, defaultSets, defaultReps, defaultWeight, order }
Template         { id, name, exercises: TemplateExercise[], updatedAt }
SessionExercise  { exerciseId, exerciseName, sets, reps, weight, order }
Session          { id, date (YYYY-MM-DD), templateId, templateName, exercises, createdAt }
ExerciseHistory  { id, date, exerciseId, exerciseName, sets, reps, weight, volume, sessionId }
```

`exerciseHistory` är en **denormaliserad kopia** av passens övningar och är det statistiken läser. Skriver du ett pass utan att skriva om dess historikrader blir graferna tyst fel. `createSession`, `updateSession` och `deleteSession` sköter det. Skriv aldrig till `sessions` direkt förbi dem.

Modellen har en känd begränsning: ett `sets`, ett `reps`, ett `weight` per övning. Den klarar inte olika vikt per set, kroppsvikt, kondition eller RIR. Se `AUDIT.md` avsnitt 8. Bygg inget som gör den svårare att byta.

## Hårda regler

1. **`src/db/seedData.ts` är genererad. Redigera den aldrig för hand.** Den innehåller 418 verkliga träningspass. Kör `python scripts/generate-seed.py` om den ska byggas om.
2. **Radera eller skriv aldrig om historisk träningsdata.** Inte i seed, inte i IndexedDB, inte i en migrering. Additivt eller inget.
3. **Excel-filen `C:\dev\Styrkepass v2.xlsx` öppnas bara för läsning.** Aldrig skrivning.
4. TypeScript strict. Ingen `any`. `npm run build` måste gå igenom.
5. Svenskt gränssnitt. Decimalkomma (12,5), mellanslag som tusentalsavgränsare (12 500). **Aldrig tankstreck.** Använd komma, kolon, parentes eller ny mening.
6. Desktop är den primära upplevelsen, mobilen ska ändå vara fullvärdig. Brytpunkter: mobil under 768 px, tablet 768–1199 px, desktop från 1200 px.
7. Minsta ändring som helt löser uppgiften. Inga refaktoreringar på vägen.
8. **Återställ aldrig en fil du blivit tillsagd att inte röra.** Ligger det okommitterade ändringar där är de någon annans pågående arbete. Lämna dem. Se nedan.

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
