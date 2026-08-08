"""Genererar src/db/seedData.ts ur Excel-arket.

Kör:  python scripts/generate-seed.py

Läser ENDAST. Rör aldrig Excel-filen.

Två fällor i arket som den här koden hanterar medvetet:

1. Längst ned i bladet ligger den tomma mallen som Patrik klistrar in inför ett
   pass. Den har set = 0 och `=TODAY()` som datum, och den ligger i kolumn B
   medan riktig data ligger i kolumn A. Vi läser datum ur kolumn A, alltså
   hoppas mallblocket över automatiskt. Ändra inte det till "första kolumnen
   som råkar innehålla ett datum".

2. Övningsnamn förekommer i olika skiftläge ("hantelrodd" och "Hantelrodd").
   De ska bli EN övning, annars splittras historiken. Vi matchar på
   name.strip().lower() och behåller den variant som förekommer flest gånger.
"""

import datetime
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl

SRC = Path(r"C:\dev\Styrkepass v2.xlsx")
# Andra argumentet skriver någon annanstans än i repot, för torrkörning.
OUT = (
    Path(sys.argv[1])
    if len(sys.argv) > 1
    else Path(__file__).resolve().parent.parent / "src" / "db" / "seedData.ts"
)
CREATED_AT = "2026-08-08T15:00:00.000Z"

# Rader utan passnamn. Namnet är fult, men appen har redan tre pass som heter
# exakt så, från den första seeden. Byter vi namn här matchar inte den naturliga
# nyckeln (datum, passnamn) längre och importen skapar dubbletter av dem.
# Omdöpning är ett eget medvetet steg, inte en bieffekt av en import.
NO_TEMPLATE = "undefined"


def norm(name):
    return str(name).strip().lower()


def read_rows():
    """Datarader ur bladet Träningsdata, i arkets egen ordning."""
    ws = openpyxl.load_workbook(SRC, data_only=True, read_only=True)["Träningsdata"]
    rows = []
    for r in ws.iter_rows(values_only=True):
        date = r[0]
        if not isinstance(date, datetime.datetime):
            continue  # rubrik, tomrad, summarad eller mallblocket i kolumn B
        name = r[1]
        if name is None or not str(name).strip():
            continue
        rows.append(
            {
                "date": date.date().isoformat(),
                "exercise": str(name).strip(),
                "weight": float(r[2]) if isinstance(r[2], (int, float)) else 0.0,
                "sets": int(r[3]) if isinstance(r[3], (int, float)) else 0,
                "reps": int(r[4]) if isinstance(r[4], (int, float)) else 0,
                "template": str(r[5]).strip() if r[5] and str(r[5]).strip() else NO_TEMPLATE,
            }
        )
    return rows


def build(rows):
    # Övningskatalog: en post per unikt normaliserat namn, vanligaste stavningen vinner.
    spellings = defaultdict(Counter)
    for row in rows:
        spellings[norm(row["exercise"])][row["exercise"]] += 1

    ids = iter(range(10**9))
    exercises = {}
    for key in sorted(spellings):
        display = spellings[key].most_common(1)[0][0]
        exercises[key] = {
            "id": f"seed-ex-{next(ids)}",
            "name": display,
            "createdAt": CREATED_AT,
        }

    # Pass: gruppera på (datum, passnamn), behåll arkets radordning inom passet.
    grouped = defaultdict(list)
    for row in rows:
        grouped[(row["date"], row["template"])].append(row)

    # Historikraderna emitteras inte. De är en ren avledning av passens övningar
    # (volume = sets * reps * weight) och byggs i syncSeed vid import. Att bunta
    # dem här skulle dubblera seed-filens storlek utan att tillföra något.
    sessions = []
    for n, key in enumerate(sorted(grouped)):
        date, template = key
        sid = f"seed-s-{n}"
        entries = grouped[key]
        sessions.append(
            {
                "id": sid,
                "date": date,
                "templateId": f"seed-t-{norm(template)}",
                "templateName": template,
                "exercises": [
                    {
                        "exerciseId": exercises[norm(e["exercise"])]["id"],
                        "exerciseName": exercises[norm(e["exercise"])]["name"],
                        "sets": e["sets"],
                        "reps": e["reps"],
                        "weight": e["weight"],
                        "order": i,
                    }
                    for i, e in enumerate(entries)
                ],
                "createdAt": CREATED_AT,
            }
        )
    # Mallar: senaste passet per passnamn ger de mest aktuella standardvärdena.
    templates = []
    for template in sorted({s["templateName"] for s in sessions}):
        latest = max(
            (s for s in sessions if s["templateName"] == template),
            key=lambda s: s["date"],
        )
        templates.append(
            {
                "id": f"seed-t-{norm(template)}",
                "name": template,
                "exercises": [
                    {
                        "exerciseId": e["exerciseId"],
                        "defaultSets": e["sets"],
                        "defaultReps": e["reps"],
                        "defaultWeight": e["weight"],
                        "order": i,
                    }
                    for i, e in enumerate(latest["exercises"])
                ],
                "updatedAt": CREATED_AT,
            }
        )

    return list(exercises.values()), templates, sessions


def main():
    if not SRC.exists():
        sys.exit(f"Hittar inte {SRC}")
    rows = read_rows()
    exercises, templates, sessions = build(rows)

    # Sanity checks. Hellre att generatorn dör än att den skriver trasig data.
    logged = sum(len(s["exercises"]) for s in sessions)
    assert logged == len(rows), f"{logged} loggade övningar av {len(rows)} rader"
    assert len({e["id"] for e in exercises}) == len(exercises), "dubbla övnings-id"
    assert len({s["id"] for s in sessions}) == len(sessions), "dubbla pass-id"
    assert len({(s["date"], s["templateName"]) for s in sessions}) == len(sessions), (
        "två pass delar (datum, passnamn), den naturliga nyckeln är inte unik"
    )
    known = {e["id"] for e in exercises}
    assert all(x["exerciseId"] in known for s in sessions for x in s["exercises"]), "okänt övnings-id"

    def const(name, typ, data):
        return f"export const {name}: {typ}[] = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};"

    OUT.write_text(
        "\n".join(
            [
                f"// Genererad av scripts/generate-seed.py ur {SRC.name}. Redigera inte för hand.",
                "import type { Exercise, Template, Session } from '../models'",
                "",
                const("seedExercises", "Exercise", exercises),
                "",
                const("seedTemplates", "Template", templates),
                "",
                const("seedSessions", "Session", sessions),
                "",
            ]
        ),
        encoding="utf-8",
    )

    print(f"Källa      : {SRC}")
    print(f"Rader      : {len(rows)}")
    print(f"Övningar   : {len(exercises)}")
    print(f"Mallar     : {len(templates)}")
    print(f"Pass       : {len(sessions)}  ({sessions[0]['date']} -> {sessions[-1]['date']})")
    print(f"Loggade    : {logged} övningar")
    print(f"Skrev      : {OUT}")


if __name__ == "__main__":
    main()
