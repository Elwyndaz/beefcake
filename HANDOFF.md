---
schemaVersion: 1
status: active
currentGoal: Få Patriks ja eller nej på seedändringen och nollsetstarten, sedan verifiera dataintegritetsfixen i det verkliga dator- och mobilflödet
nextAction: Öppna Beefcake på datorn och mobilen. Radera ett gammalt seedat pass på datorn, ladda om båda, passet ska förbli borta. Logga ett pass från noll set på mobilen. Kontrollera därefter Cartman nivå 2 samt hemskärmsikonen.
blockers:
  - Inga
reviewedAt: 2026-09-01
---

## Recent work

- **Seeden körs bara i en tom databas** (`syncSeed()` i `dataService.ts`). Tvåklientstestet visade att den additiva seeden vid varje uppstart återupplivade varje raderat seedpass, eftersom seeden inte visste att D1 hade raderat det. Verifierat i webbläsaren: radera `seed-s-417`, ladda om, 418 pass och passet borta. **Ändrar beslutet i `AGENTS.md` om additiv seed**, väntar på Patriks ja eller nej.
- **Tvåklientstest** `server/src/twoClients.test.ts`: riktig `dataService` och `cloudSyncService` per klient (egna modulinstanser och egen `IDBFactory` från fake-indexeddb), riktig Worker-handler mot en D1-attrapp som kan de tre SQL-satserna i `index.ts`. Täcker seed till revision 1, andra klient läser från D1, serverradering mot stale cache, revisionskonflikt (klienten stoppar före POST), fail-closed utan känd revision, återhämtning via omläsning, samt 409 från Workern på förlegad revision.
- **`validateSnapshot()`** i `src/lib/importValidation.ts` kontrollerar hela domänmodellen (fält, typer, icke-negativa tal, `ExerciseKind`, historik som pekar på ett pass som finns) och delas av JSON-importen och Worker-API:t. Kört mot hela seedade datasetet i webbläsaren och genom Workern i testet: går igenom.
- **Logga pass börjar på noll set** per övning, som Patrik använder den. "+ Lägg till set" förifylls från samma plats i förra passet, annars förra passets sista set, annars föregående rad. Set kan tas bort ner till noll, Slutför är avstängd utan set, övningar utan set sparas inte. "Kör igen" kopierar fortfarande passets set. Slutför och Avbryt navigerar med wouter i stället för `window.location.href`.
- **Mallbytets kapplöpning**: spärren ligger nu i `loadTemplateIntoExercises`, efter väntan på förra gången, så varje anropare täcks.
- **Vilotimern frågar innan sidan lämnas** när den går: `beforeunload` för flik och omladdning, klickfångare i capture-fasen för appens egna länkar. Pausad eller klar timer frågar inte.
- **Datalisten i mallformuläret** renderas en gång utanför loopen.
- **ESLint** (`eslint` + `typescript-eslint`, rekommenderade regler utan typinformation) i `npm run lint` och i CI före bygget. Tre befintliga fynd rättade: `indexes: {}` i schemat, oanvänd import i chart.js-shimmen, genererad `worker-configuration.d.ts` ignoreras.

## Verification

- `npm test` grön: 7 filer, 39 tester. `npm run lint` grön. `tsc -b` grön. `npm run build` grön. `npm run server:check` grön (46,5 KiB).
- Kört i Chromium mot dev-servern med seedad data (418 pass): noll set vid start, tre tillägg förifyllda 27,5 kg × 10 från förra Benböj, tre borttagningar ner till noll, Slutför avstängd vid noll och aktiv vid ett set, snabbt mallbyte ger samma resultat som långsamt, timerspärren stoppar navigering vid nej och släpper vid ja, Slutför sparar (419 pass) och landar på Historik utan omladdning, raderat seedpass förblir borta efter omladdning.
- GitHub Pages-pipeline `33525389742` grön på `8b365f1` med test, lint, Worker dry-run, bygge och deploy. Livebundeln `index-BIaJSw_k.js` innehåller både timerfrågan och valideringstexten.
- Worker `beefcake-api` deployad som version `ed2dfd8b-e75e-45f1-8279-2f4337ec12af`. `/api/health` svarar med Access-redirect utan cookie.

## Unresolved details

- Seedändringen och nollsetstarten är byggda i chunkläge utan förhandsgodkännande. Båda är en `git revert` bort.
- Ingen autentiserad POST mot den nya Worker-valideringen är körd mot produktions-D1. Valideringen är kontrollerad mot det seedade datasetet, som är samma data minus passen sedan 2026-07-28.
- Nivå 2 till 4 på märket är bara verifierade genom enhetstesterna. Seedens senaste pass ligger i juli så appen står på nivå 1.
- Vokabulären pass/program (P2) är ett beslut, inte taget. Web Push, kortkommandon, Cloudflare Pages med Access, RIR/RPE och tvåanvändarstöd ligger kvar som P3.
- Access-sessionen för `beefcake` är 1 månad sedan 2026-08-21.
- Spökpasset 2025-11-19 "Bröst, axlar & biceps" är kvar med flit.

## Resume here

Allt från 2026-09-01 är pushat och live: klienten via Pages på `8b365f1`, Workern som `ed2dfd8b`. Källcommits: `cb687c6`, `881a0b2`, `5140cee`, `e3d1070`, `ecf0947`, seedfixen och testet i de två sista.

Kvar att kontrollera med egna ögon på riktig data: radera ett seedat pass på datorn och se att mobilen inte får tillbaka det efter omladdning, logga ett pass från noll set på mobilen, märkets nivå när kedjan startar, hemskärmsikonen. Vid "ändringen syns inte": rensa `workbox-precache-v2-.../beefcake/` eller hårduppdatera innan felsökning.
