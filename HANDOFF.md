---
schemaVersion: 1
status: active
currentGoal: Härdning efter genomlysningen, chunk D till F. D och E klara (Worker behåller kroppsvikt, datumtester, tablet- och a11y-svep). Kvar: F uppdateringsbanner för PWA:n
nextAction: Chunk F enligt prompten i dagsnoten 2026-09-01 session 12. Parallellt: prova loggvyn och kroppsvikten på telefonen.
blockers:
  - Inga
reviewedAt: 2026-09-01
---

## Recent work

Tredje passet 2026-09-01, chunkläge. **Chunk D klar**: Workern kopierar senaste revisionens `bodyWeight` när en klient POST:ar utan fältet (tom lista respekteras), tvåklientstestet har fallet, Worker deployad som `40e6fc76`. `isoWeek` flyttad till `src/lib/date.ts`, `mondayISO(weeksAgo, fromISO)` testbar med fasta datum, `src/lib/date.test.ts` ny (68 tester totalt). **Chunk E klar**: tablet-svep på 768×1024 och 1024×768 hittade att settabellen klippte kolumnen Ta bort bakom en inre sidled-scroll (619 px tabell i 574 px kort); tabletbrytpunkten fick telefonens kompakta Föregående och inga stegknappar, plattraden 44 px. Roller på stapellistan och chipsen, aria-label på Föregående-cellen, fokus till kg-fältet efter Spara. Åtta skärmbilder `-tablet` och `-tablet-liggande` i `efter-2/`.

Andra passet 2026-09-01, chunkläge. **Chunk A klar** (`0f17c24`): Föregående-kolumnen kompakt på telefon (kg 56 px, 1 px cellpadding, mätt 336 av 340 px), "Nästa pass" på Hem pekar ut det program som väntat längst med dagar sedan under varje knapp. **Chunk B klar** (`09f2d15`): pass per vecka som HTML-staplar i Statistik, kortet "Denna vecka" på Hem med text och muskelgruppschips. **Chunk C klar** (`4408e64`): kroppsvikt som egen store, valfri samling i snapshoten, inmatning i Inställningar, kurva i Statistik, Workern deployad som `16aa6c7d` med den delade valideringen. Alla tre pushade, Pages grön.

Genomlysningens byggpass 2026-09-01 i chunkläge, 14 commits efter `4f36f07` (`68303eb` till `034b331`, inklusive den här docs-rättningen), alla pushade och byggda av Pages.

- **Backloggen**: de två parallella genomlysningsblocken sammanslagna till ett, 24 poster, P1 till P3. 16 av dem byggda i det här passet och markerade `[x]`, allt byggt står under Byggt.
- **Buggar och tokens**: passdetaljen på telefon visar övningarna som kort, streak-kortet läser `streak.ts` (`getCurrentStreak` borta), set- och anteckningsfält från tokens i mörkt läge, AA-färger i ljust läge, all hex utanför `:root` är tokens med mörk variant, `--radius-md` och `--border-strong` finns, kortlyft bara på klickbara kort, etiketter i bottennavigeringen.
- **Loggvyn**: "Som förra gången", RPE-bricka, plattor per sida som text (`equipment` via `EQUIPMENT_MAP`), anteckning i bannern, hopfälld datum/program-rad, Avbryt och Spara program under Slutför, telefonens settabell med sex kolumner och 44 px tryckytor. Cartman bara på Hem, avatar i navigeringen, latmasken i märkets text, "Nästa pass" först på Hem.
- **Statistik**: 30-dagarstal, 8 veckors set per muskelgrupp, frekvens som lista, kort på telefon, rekord per repsantal och valbart mått på övningssidan.
- **P3**: PR-märke på bocken med lång vibration, uppvärmning på ett tryck.

## Verification

- Tredje passet: 68 tester, lint, build, `server:check` gröna. Chromium 768×1024 och 1024×768 ljust: railen synlig, noll sidled-scroll på dokumentet och i settabellens kort, volymkurvan 576 respektive 376 px bred, alla tryckytor i de nya ytorna minst 44 px, Escape på alla fyra sidorna utan fel, fokus i kg-fältet efter Spara verifierat. Kvar under 44 px på tablet, utanför de nya ytorna: settypsbrickan 32 (dokumenterat undantag), RPE-brickan 44×38, plattkalkylatorknappen 36, anteckningsfältet 38 högt, övningslänkarna i statistiktabellerna 19 px höga (textlänkar).
- Andra passet: `npm test` 60 tester gröna (formatSetCompact, kroppsvikt i validering och Worker nya), `npm run lint`, `npm run build` och `server:check` gröna. Chromium 390×844 och 1440×900, ljust och mörkt: noll konsolfel, noll sidled-scroll, settabellen 336 av 340 px, tryckytor i loggvyn och Inställningar minst 44 px utom settypsbrickan. Kroppsviktsflödet (två värden, ladda om, kurva, export, töm, import) kört grönt. Skärmbilder i vaulten under `Beefcake Designgenomlysning/efter-2/`. Inga nya färger, kontrasten oförändrad (24 par, minst 4,5:1).
- Första passet: 55 tester, samma Chromium-metod, skärmbilder under `efter/`.
- Cartman nivå 2 till 4 fortfarande bara enhetstestade. PR-märket, plattraden och kroppsviktsinmatningen är testade i Chromium, inte på en telefon.

## Unresolved details

- Båda passen godkända av Patrik 2026-09-01 ("ja" på helheten). Beslut tagna åt Patrik står i dagsnoten och i rapportens "## Efter" och "## Efter 2".
- Alla genomlysningsposter är byggda. Kvar i backloggen: Web Push, Cloudflare Pages med Access, tvåanvändarstöd.
- Workern behåller kroppsvikten vid skrivning utan fältet sedan `40e6fc76` (chunk D). Testat i tvåklientstestet, inte mot produktions-D1.
- Ingen autentiserad POST mot produktions-D1 sedan `f3f1bb10`; `16aa6c7d` och `40e6fc76` är bara testade via tvåklientstestet.
- Access-sessionen för `beefcake` är 1 månad sedan 2026-08-21.
- Spökpasset 2025-11-19 "Bröst, axlar & biceps" är kvar med flit.

## Resume here

Prova loggvyn och kroppsvikten på telefonen innan något mer byggs. Vid "ändringen syns inte": rensa `workbox-precache-v2-.../beefcake/` eller hårduppdatera; IndexedDB uppgraderas till version 4 automatiskt. Två användare, Web Push och Cloudflare Pages med Access kräver beslut eller infrastruktur.
