---
schemaVersion: 1
status: active
currentGoal: Se att Cartman stegas upp när träningskedjan startar
nextAction: Kör ett riktigt pass på telefonen mot liveappen och kontrollera att märket går från nivå 1 till 2 och att hemskärmsikonen blir Cartman
blockers:
  - Inga
reviewedAt: 2026-08-21
---

## Recent work

- **Beefcake-märket** i headern: fyra Cartman-nivåer efter träningskedjan. Regeln bor i `src/lib/streak.ts`, glapp över tre dagar bryter kedjan. Syns i sidopanelen, i skenan och längst till höger i mobilheadern, på varje sida.
- **Favicon och PWA-ikoner** genererade ur huvudet i `beefcake3.jpg`. Platshållar-SVG:erna borttagna. Originalen ligger i `assets-source/`, allt byggs om med `python scripts/generate-beefcake-assets.py`.
- **Vilotimern följer scrollen** på desktop. Sticky fungerade inte eftersom `align-items: start` krympte grid-kolumnen till timerns egen höjd, `align-self: stretch` ger den hela radens höjd.
- **Signalen** när tiden är slut: tolv klanger istället för fyra, tre toner istället för två, triangelvåg istället för sinus, gain 0,09 till 0,16. Cirka 18 sekunder istället för 6.
- **Plattkalkylatorns ikon** är en riktig `barbell-icon` i spriten, inte emojin 🎛️.
- **Slutför pass** finns bara längst ned i aktivt pass. Knappen uppe i huvudet togs bort, Avbryt är kvar.
- **Inloggningen**: lösenordsgrinden ligger i `localStorage`, och synkbannern öppnar Access-inloggningen och laddar om av sig själv när fliken får fokus igen.
- **Statistik**: Set per muskelgrupp denna vecka flyttad högst upp till vänster. Volym över tid och PR-listan sorterar mest tränade övningar senaste kvartalet först (`getExerciseTrainingCounts`). Volymperioden startar på Kvartal, Månad gav tom graf efter en veckas vila. Frekvens per pass har periodfilter: totalt, senaste månaden, kvartalet, 12 månaderna och varje kalenderår med pass. Spökmallen `undefined` filtreras bort ur frekvensen.
- **Kalendern** har en ruta med dagens datum plus "Gå till denna månad", och dagens ruta är ramad.
- **Manifest-buggen (hittad vid livekontrollen):** `index.html` hade två `<link rel="manifest">`. Den handskrivna låg först och pekade på `/manifest.webmanifest` i domänroten, alltså 404 under `/beefcake/`. Webbläsaren tar den första, så manifestet lästes aldrig och PWA-ikonerna slog aldrig igenom. vite-plugin-pwa injicerar redan en korrekt tagg; den handskrivna är borttagen. Tankestrecket i meta-beskrivningen bytt mot kolon.

## Verification

- `npm test` grön: 4 filer, 25 tester, varav 8 nya på `beefcakeStreak`. `npm run build` grön.
- Kört i Chrome mot dev-servern på seedad data (418 pass, senaste 2026-07-28), desktop 1440 px och mobil 390 px.
- Verifierat i webbläsaren: timern pinnad 24 px från toppen efter 464 px scroll, alla fyra avatarer laddar 320 × 320, märket visar nivå 1 med rätt text ("24 dagar sedan senaste passet"), barbell-ikonen läsbar vid 20 px, frekvensfiltret 2025 kapar nio mallar till fem och tar bort `undefined`, volymgrafen ritar en kurva på kvartalet, dagens datum och dagruta korrekta, ingen sidled-scroll i någon vy.
- Ikonvägarna kontrollerade i bygget: `/beefcake/favicon.ico` och manifestets `pwa-192x192.png` löser rätt under bas-sökvägen.
- **Livekontroll efter deploy** (körningarna `32512378225` och `32513185476`, båda gröna): `favicon.ico` och `apple-touch-icon.png` svarar 200, de gamla `pwa-*.svg` svarar 404, bundlen innehåller `BEEFCAAAAKE`, `beefcake-badge` och `barbell-icon`, Stats-chunken innehåller periodfiltret, alla fyra avatarer svarar 200. Exakt en `<link rel="manifest">` med rätt bas-sökväg, manifestets båda PNG-ikoner 200, inget tankestreck kvar i HTML:en. Kvarvarande konsolfel i den automatiserade webbläsaren är bara den uteblivna Access-cookien.
- **Service workern serverade gammal HTML** vid första livekontrollen efter deployen. Manifest-fixen syntes i `curl` men inte i webbläsaren förrän precachen rensats. Vid framtida "ändringen syns inte": rensa `workbox-precache-v2-.../beefcake/` eller hårduppdatera innan du felsöker koden.

## Unresolved details

- Nivå 2 till 4 är bara verifierade genom enhetstesterna, inte visuellt: seedens senaste pass ligger 24 dagar bak så appen står på nivå 1.
- Molnsynkens nya knapp är inte körd mot riktig Access, bara mot ett felläge i dev.
- Access-sessionen för applikationen `beefcake` är satt till **1 månad** (2026-08-21). Den nya längden gäller från nästa inloggning, så en sista inloggning mot API:t krävs.
- Ingen linter finns fortfarande. Race condition i mall-laddningen i LogSession kvarstår. `datalist`-dubbletten i Templates.tsx kvarstår.
- Spökpasset 2025-11-19 "Bröst, axlar & biceps" är kvar med flit.

## Resume here

Allt är pushat och deployat. Kvar att se med egna ögon: att märket byter nivå när kedjan startar, och att hemskärmsikonen blir Cartman nu när manifestet faktiskt laddas. Lägg till appen på hemskärmen på nytt, den gamla genvägen bär kvar sin gamla ikon.

`https://orgutveckling.se/beefcake/favicon.svg` svarar fortfarande 200 från Cloudflares kant (`cf-cache-status: HIT`, `max-age=14400`). Filen är borta ur repot och ingenting pekar på den; cachen släpper av sig själv.
