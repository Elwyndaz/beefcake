---
schemaVersion: 1
status: active
currentGoal: Slutföra produktionsverifieringen av D1-synk
nextAction: Verifiera att senaste testpasset finns kvar efter omladdning och ny Access-inloggning, kör sedan ett autentiserat stale-revision-anrop som ska ge 409
blockers:
  - Autentiserad webbläsarsession krävs för de två återstående livekontrollerna
reviewedAt: 2026-08-11
---

## Recent work

- D1 är nu sanningskälla. Klienten hämtar snapshot före seedning och använder IndexedDB som lokal cache.
- Snapshot-skrivning använder enkel `POST /api/snapshot` med `Content-Type: text/plain` och `credentials: include`. Det undviker Cloudflare Access 403 på CORS-preflight utan bypass eller Access-token i frontend.
- Worker validerar samma JSON-form som tidigare. En atomisk `INSERT ... SELECT` uppdaterar endast när `expectedRevision` fortfarande matchar, annars 409.
- Automatisk filbackup och automatisk filåterställning är borttagna. Export och import finns endast som manuell nödräddning i Inställningar. `BackupBanner` är borttagen.
- Månadsvyn ligger överst i Historik. Klick på en dag öppnar Logga pass med valt datum.
- Övningsrader i Logga pass kan ordnas genom dragning eller piltangenter.
- X/Twitter-symbolen är ersatt med ett vanligt stängkryss. Raderingsåtgärder använder papperskorg, även i Mallar, där bekräftelsedialogen är kvar.

## Verification

- `npm run build` och `npm run server:check` är gröna.
- Worker-version `8e006074-faf3-4d08-a643-adee1b0cd8a6` är deployad.
- En autentiserad produktionsklient skapade en faktisk D1-snapshot för Access-identiteten. Efter sparat testpass hade raden revision 6, 419 pass, payload 530 398 byte och `created_at` 2026-08-11T20:04:59.840Z.
- Anonyma GET och enkla POST omdirigeras till Access med korrekta CORS-headers. En preflightad skrivning stoppas av Access med 403 innan Workern.
- GitHub Pages är deployad genom commit `659fe4e`. Livebundlen innehåller POST/text/plain, synligt molnsynkfel, dragordning, datumlänk och nya papperskorgar.

## Unresolved details

- Användarverifiera att testpasset finns kvar efter omladdning samt efter utloggning och ny Access-inloggning.
- Verifiera ett autentiserat stale-revision-anrop mot live-API:t och dokumentera HTTP 409.
- Inga automatiserade tester eller linter finns.
- Race condition i mall-laddningen i LogSession, async-effekt utan avbrottsskydd.
- Spökpasset 2025-11-19 "Bröst, axlar & biceps" är kvar med flit.

## Resume here

Börja med de två återstående livekontrollerna ovan. Ändra inte synkarkitekturen och använd inte backupfil som normal återställningsväg.
