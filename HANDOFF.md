---
schemaVersion: 1
status: active
currentGoal: Genomlysningens fem sista poster i chunkläge (A loggvyn och Hem, B statistik och Hem, C kroppsvikt), sedan Patriks ja eller nej på helheten
nextAction: Skärmbilder efter-2, rapportens "## Efter 2", dagsnoten, sedan Patriks ja eller nej på hela passet.
blockers:
  - Inga
reviewedAt: 2026-09-01
---

## Recent work

Andra passet 2026-09-01, chunkläge. **Chunk A klar** (`0f17c24`): Föregående-kolumnen kompakt på telefon (kg 56 px, 1 px cellpadding, mätt 336 av 340 px), "Nästa pass" på Hem pekar ut det program som väntat längst med dagar sedan under varje knapp. **Chunk B klar** (`09f2d15`): pass per vecka som HTML-staplar i Statistik, kortet "Denna vecka" på Hem med text och muskelgruppschips. **Chunk C klar:** kroppsvikt som egen store, valfri samling i snapshoten, inmatning i Inställningar, kurva i Statistik, Workern deployad med den delade valideringen.

Genomlysningens byggpass 2026-09-01 i chunkläge, 14 commits efter `4f36f07` (`68303eb` till `034b331`, inklusive den här docs-rättningen), alla pushade och byggda av Pages.

- **Backloggen**: de två parallella genomlysningsblocken sammanslagna till ett, 24 poster, P1 till P3. 16 av dem byggda i det här passet och markerade `[x]`, allt byggt står under Byggt.
- **Buggar och tokens**: passdetaljen på telefon visar övningarna som kort, streak-kortet läser `streak.ts` (`getCurrentStreak` borta), set- och anteckningsfält från tokens i mörkt läge, AA-färger i ljust läge, all hex utanför `:root` är tokens med mörk variant, `--radius-md` och `--border-strong` finns, kortlyft bara på klickbara kort, etiketter i bottennavigeringen.
- **Loggvyn**: "Som förra gången", RPE-bricka, plattor per sida som text (`equipment` via `EQUIPMENT_MAP`), anteckning i bannern, hopfälld datum/program-rad, Avbryt och Spara program under Slutför, telefonens settabell med sex kolumner och 44 px tryckytor. Cartman bara på Hem, avatar i navigeringen, latmasken i märkets text, "Nästa pass" först på Hem.
- **Statistik**: 30-dagarstal, 8 veckors set per muskelgrupp, frekvens som lista, kort på telefon, rekord per repsantal och valbart mått på övningssidan.
- **P3**: PR-märke på bocken med lång vibration, uppvärmning på ett tryck.

## Verification

- `npm test` 55 tester gröna (plates, exerciseMetrics, warmup nya), `npm run lint` och `npm run build` gröna.
- Chromium på 390×844 och 1440×900, ljust och mörkt: noll konsolfel, `scrollWidth - clientWidth = 0` på alla vyer, alla tryckytor i loggvyn minst 44 px utom settypsbrickan (32), första setraden på y=402 på telefon, PR-märke vid 999 kg, tre uppvärmningsset. Kontrast räknad ur tokens: 24 par, alla minst 4,5:1. Skärmbilderna "efter" ligger i vaulten under `Beefcake Designgenomlysning/efter/`.
- Cartman nivå 2 till 4 fortfarande bara enhetstestade. PR-märket och plattraden är testade i Chromium, inte på en telefon.

## Unresolved details

- Hela passet är byggt i chunkläge utan förhandsgodkännande; varje steg är en `git revert` bort. Beslut tagna åt Patrik står i dagsnoten och i rapportens "## Efter".
- Öppna genomlysningsposter: förra gången som placeholder per rad, "Nästa pass" som pekar ut ett pass, pass per vecka som stapel, veckosammanfattning på Hem, kroppsvikt.
- Ingen autentiserad POST mot Worker-valideringen mot produktions-D1 sedan `f3f1bb10`.
- Access-sessionen för `beefcake` är 1 månad sedan 2026-08-21.
- Spökpasset 2025-11-19 "Bröst, axlar & biceps" är kvar med flit.

## Resume here

Prova loggvyn på telefonen i gymmet innan något mer byggs på den. Vid "ändringen syns inte": rensa `workbox-precache-v2-.../beefcake/` eller hårduppdatera. De fem öppna genomlysningsposterna är nästa byggbara sak; två användare, Web Push och Cloudflare Pages med Access kräver beslut eller infrastruktur.
