---
schemaVersion: 1
status: active
currentGoal: Få Patriks ja eller nej på seedändringen, nollsetstarten och vokabulärbytet, sedan verifiera i det verkliga dator- och mobilflödet
nextAction: Öppna Beefcake på datorn och mobilen. Radera ett gammalt seedat pass på datorn, ladda om båda, passet ska förbli borta. Logga ett pass från noll set på mobilen med RPE och en anteckning, öppna det i Historik. Kontrollera hemskärmsikonen.
blockers:
  - Inga
reviewedAt: 2026-09-01
---

## Recent work

Två chunkomgångar 2026-09-01, alla commits pushade och live via Pages, Workern deployad som `f3f1bb10`.

- **Seeden körs bara i en tom databas** (`syncSeed()` i `dataService.ts`). Tvåklientstestet visade att den additiva seeden vid varje uppstart återupplivade varje raderat seedpass. Verifierat i webbläsaren: radera `seed-s-417`, ladda om, passet borta. **Ändrar beslutet i `AGENTS.md` om additiv seed**, väntar på Patriks ja eller nej.
- **Tvåklientstest** `server/src/twoClients.test.ts`: riktig `dataService` och `cloudSyncService` per klient (egna modulinstanser och egen `IDBFactory` från fake-indexeddb), riktig Worker-handler mot en D1-attrapp som kan de tre SQL-satserna i `index.ts`. Täcker seed till revision 1, andra klient läser från D1, serverradering mot stale cache, revisionskonflikt, fail-closed utan känd revision, återhämtning via omläsning, samt 409 från Workern.
- **`validateSnapshot()`** i `src/lib/importValidation.ts` kontrollerar hela domänmodellen och delas av JSON-importen och Worker-API:t. Kört mot hela seedade datasetet: går igenom.
- **Logga pass börjar på noll set** per övning. "+ Lägg till set" förifylls från samma plats i förra passet. Set kan tas bort ner till noll, Slutför är avstängd utan set, övningar utan set sparas inte. "Kör igen" kopierar fortfarande passets set. Slutför och Avbryt navigerar med wouter.
- **Program i stället för mall** i hela gränssnittet (backloggens P2). Koden heter fortfarande `Template`, routen `/templates`.
- **RPE per set och anteckning per övning** i loggvyn. `SetEntry.rpe?` (5 till 10) och `SessionExercise.notes?`, båda valfria, validerade i `validateSnapshot`. Passdetaljen visar "@8,5" efter setet och anteckningen under övningsnamnet, och redigeringsläget bär anteckningen genom Spara. På telefon krymptes settabellen (2 px cellpadding, smalare fält, dolda spinnrar) så RPE-kolumnen ryms utan sidled-scroll.
- **Kortkommandon i loggvyn**: Ctrl+Enter (Cmd+Enter) slutför, Escape stänger avbrytdialog, plattkalkylator och programsparning.
- **Mallbytets kapplöpning** spärrad i `loadTemplateIntoExercises`. **Vilotimern frågar innan sidan lämnas** när den går. **Datalisten** i programformuläret renderas en gång. **ESLint** i `npm run lint` och CI.

## Verification

- `npm test` grön: 7 filer, 40 tester. `npm run lint`, `tsc -b`, `npm run build`, `npm run server:check` gröna.
- Kört i Chromium mot dev-servern med seedad data på 1440 och 390 px: noll set vid start, förifyllning från förra passet, borttagning ner till noll, mallbyte, timerspärr, raderat seedpass borta efter omladdning, RPE 8,5 och anteckning sparade i passet och visade i passdetaljen, settabellen 0 px overflow på 390 px, Escape stänger dialogen, Ctrl+Enter sparar (420 till 421 pass) och landar på Historik.
- Cartman nivå 2 ("På gång") sedd i webbläsaren efter testpassen. Nivå 3 och 4 är fortfarande bara enhetstestade.
- Pages-pipeline grön på `8b365f1` (`33525389742`), senare commits `121a90e`, `69a22aa`, `663c2e8` kör samma pipeline. Worker `beefcake-api` deployad som `f3f1bb10-03fb-44e2-afc9-2ac7834a4c14`.

## Unresolved details

- Seedändringen, nollsetstarten och vokabulärbytet är byggda i chunkläge utan förhandsgodkännande. Var och en är en `git revert` bort.
- Ingen autentiserad POST mot Worker-valideringen mot produktions-D1. Valideringen är kontrollerad mot det seedade datasetet.
- Nivå 3 och 4 på märket bara enhetstestade.
- Web Push, Cloudflare Pages med Access och tvåanvändarstöd ligger kvar som P3. Captured: firebase-inlogg, delvis löst.
- Access-sessionen för `beefcake` är 1 månad sedan 2026-08-21.
- Spökpasset 2025-11-19 "Bröst, axlar & biceps" är kvar med flit.

## Resume here

Backloggen är tom på allt som går att bygga utan ett beslut från Patrik. Kvar är P3-posterna som kräver infrastruktur (Web Push, Cloudflare Pages med Access) eller produktbeslut (två användare).

Kvar att kontrollera med egna ögon på riktig data: radera ett seedat pass på datorn och se att mobilen inte får tillbaka det, logga ett pass från noll set med RPE och anteckning på mobilen, hemskärmsikonen. Vid "ändringen syns inte": rensa `workbox-precache-v2-.../beefcake/` eller hårduppdatera innan felsökning.
