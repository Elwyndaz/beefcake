---
schemaVersion: 1
status: active
currentGoal: Verifiera det nya passflödet i produktion efter deploy
nextAction: Kör ett riktigt pass på telefonen mot live-appen och bekräfta att avbockning, flytande vilotimer och återupptagning fungerar med D1-synk påslagen
blockers:
  - Sju commitar ligger opushade lokalt, push och deploy är inte godkända än
reviewedAt: 2026-08-17
---

## Recent work

- Aktivt pass sparas löpande i object storen `activeWorkout` och kan återupptas från Hem eller loggvyn. Ett avbockat set överlever omladdning, verifierat i webbläsaren.
- Avbockning av ett set startar vilotimern via `beefcake-start-timer`. Timern ligger som panel på desktop och som flytande rad ovanför bottennavigeringen på telefon medan den räknar ner.
- Setraden har typbadge, föregående resultat, snabbsteg ±2,5 kg och ±1 rep samt plattkalkylator.
- Nya set förifylls med vikt och reps från förra genomförandet av övningen, inte mallens standardvärden.
- Övningssidan `/exercises/:id` finns och nås från PR-listan, övningsväljaren i Statistik och varje övningsrad i passdetaljen.
- Statistik har "Set per muskelgrupp denna vecka" mot bandet 10 till 20 set.
- Volymformeln fanns i nio kopior i sex filer och ligger nu i `src/lib/volume.ts`. Vikt och set formateras genom `src/lib/format.ts` med decimalkomma.
- Vitest tillagt, 17 tester på `src/lib/`. `npm test` kör före `npm run build` i deploy-workflowen.

## Verification

- `npm test` grön (3 filer, 17 tester). `npm run build` grön.
- Körd i Chrome mot dev-servern med påhittad testdata i en separat origin, inte mot riktig träningsdata.
- Verifierat i webbläsaren: prefill från förra passet, avbockning som startar timern, autosparat pass efter reload, övningssidans 1RM (105 kg för 82,5 × 8) och historiktabell, hypertrofikortets tre band, mobil 390 px utan sidled-scroll, desktop 1440 px oförändrad.
- Två buggar hittade och åtgärdade under körningen: diagrammen i Statistik ritades aldrig när canvas monterades efter skelettvyn, och loggvyns grid tvingade fram horisontell scroll på telefon.

## Unresolved details

- Inget av detta är verifierat mot produktion eller mot riktig D1-synk. Testdatan låg i en egen dev-origin.
- Ingen linter finns fortfarande.
- Race condition i mall-laddningen i LogSession, async-effekt utan avbrottsskydd, kvarstår.
- `datalist id="template-exercise-suggestions"` renderas fortfarande en gång per övningsrad i Templates.tsx.
- Spökpasset 2025-11-19 "Bröst, axlar & biceps" är kvar med flit.

## Resume here

Sju commitar ligger lokalt på `master` utan push. Deploy sker vid push, så gaten är fortfarande stängd. Efter push: kör ett riktigt pass på telefonen och kontrollera att passet hamnar i D1.
