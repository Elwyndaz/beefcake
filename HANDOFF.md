---
schemaVersion: 1
status: active
currentGoal: Verifiera beefcake-märket och statistikändringarna i produktion
nextAction: Pusha master, kör sedan ett riktigt pass på telefonen och kontrollera att Cartman stegas upp när kedjan börjar
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

## Verification

- `npm test` grön: 4 filer, 25 tester, varav 8 nya på `beefcakeStreak`. `npm run build` grön.
- Kört i Chrome mot dev-servern på seedad data (418 pass, senaste 2026-07-28), desktop 1440 px och mobil 390 px.
- Verifierat i webbläsaren: timern pinnad 24 px från toppen efter 464 px scroll, alla fyra avatarer laddar 320 × 320, märket visar nivå 1 med rätt text ("24 dagar sedan senaste passet"), barbell-ikonen läsbar vid 20 px, frekvensfiltret 2025 kapar nio mallar till fem och tar bort `undefined`, volymgrafen ritar en kurva på kvartalet, dagens datum och dagruta korrekta, ingen sidled-scroll i någon vy.
- Ikonvägarna kontrollerade i bygget: `/beefcake/favicon.ico` och manifestets `pwa-192x192.png` löser rätt under bas-sökvägen.

## Unresolved details

- Nivå 2 till 4 är bara verifierade genom enhetstesterna, inte visuellt: seedens senaste pass ligger 24 dagar bak så appen står på nivå 1.
- Molnsynkens nya knapp är inte körd mot riktig Access, bara mot ett felläge i dev.
- **Access-sessionen är det som gör inloggningen jobbig i grunden.** Höj sessionslängden i Cloudflare Zero Trust till en månad, då slutar bannern dyka upp: https://one.dash.cloudflare.com/ → Access → Applications → api.orgutveckling.se → Session Duration.
- Ingen linter finns fortfarande. Race condition i mall-laddningen i LogSession kvarstår. `datalist`-dubbletten i Templates.tsx kvarstår.
- Spökpasset 2025-11-19 "Bröst, axlar & biceps" är kvar med flit.

## Resume here

Allt är committat lokalt på `master`, **inget är pushat**. Pusha och kontrollera sedan i live-appen att Cartman byter nivå när kedjan startar, och att favicon syns i fliken och på hemskärmen.
