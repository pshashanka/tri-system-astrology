---
name: tri-system-reading
description: Produce a birth chart reading across Western (tropical), Vedic (sidereal) and Chinese (BaZi) astrology from a person's birth details. Use when someone asks for their birth chart, natal chart, horoscope, kundli, lagna, BaZi or Four Pillars, when they ask what two or three of those systems say about them, or when they ask why their Western and Vedic signs differ. Chart positions always come from the tri-system-astrology tools, never from the model's own estimation.
---

# Tri-system birth chart reading

The point of a tri-system reading is not to collapse three traditions into one voice.
It is to show how three symbolic languages illuminate the same life from different angles.
Let each system speak in its own vocabulary first, then synthesize at the level of
themes — never at the level of matching labels.

## Input you need

| Field | Required | Notes |
| --- | --- | --- |
| Birth date | Yes | Ask if missing. Nothing can be calculated without it. |
| Birth time | Strongly recommended | Drives the ascendant, houses and the BaZi hour pillar. |
| Birth place | Yes for houses/timing | A place name is enough; the tools resolve it. |
| Gender | Optional | Only affects the direction of the Chinese luck pillars. |

## Procedure

1. **Resolve the birth place if it is ambiguous.** For a bare city name that exists in
   several countries ("Springfield", "Cambridge"), call `geocode_location` first and
   confirm the match with the user before calculating. For an unambiguous place, skip
   this — `calculate_charts` geocodes internally.

2. **Calculate the charts.** Call `calculate_charts` once with `date`, `time`, and
   either `location` or an explicit `lat`/`lng`/`timezone` triple. Pass `gender` when
   known. Use `summary: true` for a quick overview and omit it when the user wants a
   detailed reading. One call returns all three systems — never call it once per system.

3. **Read the `warnings` array before interpreting.** It is the input to your confidence
   calibration, not a footnote. If it reports that the birth time was defaulted to noon,
   say so plainly and treat the ascendant, the house placements and the BaZi hour pillar
   as unreliable for this reading.

4. **Interpret each system in its own terms, in this order.** Do not blend yet.
   - **Western** — personality style, emotional patterning, visible life themes,
     psychological dynamics. See `references/western_astrology_core.md`,
     `references/planet_meanings.md` and `references/house_meanings.md`.
   - **Vedic** — karmic structure, dharma, planetary strength, and timing through the
     dashas. See `references/vedic_astrology_core.md` and, for nakshatras, yogas,
     Rahu/Ketu and Navamsa, `references/vedic_special_concepts.md`.
   - **Chinese** — constitutional element pattern, Day Master, the balance of resource,
     expression and authority, and the 10-year luck pillars. See
     `references/chinese_astrology_core.md`.

5. **Synthesize only after all three have spoken.** Separate what repeats from what is
   unique to one system. Convergence across systems is your strongest material;
   divergence is useful complexity, not a contradiction to resolve.

## Confidence hierarchy

State claims at the strength the chart actually supports.

- **Highest** — a theme that repeats across two or three systems.
- **Medium** — a strong indicator inside a single system.
- **Lowest** — anything subtle or timing-sensitive when the birth time was defaulted or
  the `warnings` array is non-empty.

## Output format

1. **Birth data used** — echo the resolved date, time, place and timezone so the user can
   catch a wrong city or a mis-parsed time immediately. Surface any warnings here.
2. **Western**, **Vedic**, **Chinese** — one section each, in their own vocabulary.
3. **Where the systems converge** — the highest-confidence material.
4. **Where they diverge** — presented as added dimension, not as error.

Keep each system's section readable prose. Do not dump raw JSON or tables of degrees at
the user unless they ask for the underlying numbers.

## Do not infer these

- **Never compute, estimate or "remember" chart positions.** Every degree, sign, pillar
  and dasha must come from a tool result. If a tool call fails, say so and stop; do not
  fill the gap from general astrological knowledge.
- **Never treat a Western/Vedic sign difference as an error.** The two use different
  zodiacs and the gap is precession, roughly 24°. It is expected. Explain it if asked;
  see `references/system_differences.md`.
- **Never map Chinese animals or elements onto Western signs.** BaZi is not a third
  zodiac translation of the same chart — it is a different system with different
  building blocks.
- **Never force one tradition's vocabulary onto another** when the original concept is
  more precise.

## When to pause, ask or decline

- **No birth date** — ask for it. Do not guess or offer a generic reading.
- **Ambiguous birth place** — geocode and confirm, or ask which one they mean.
- **No birth time** — proceed, but say up front which parts of the reading are weakened.
- **Medical, legal, financial or other consequential decisions** — give the astrological
  reading if asked, and be clear it is not a basis for that decision. Do not predict
  death, disease or pregnancy outcomes.

## References

Load these as needed; do not read all of them for every reading.

| File | Use when |
| --- | --- |
| `references/western_astrology_core.md` | Interpreting the Western chart |
| `references/vedic_astrology_core.md` | Interpreting the Vedic chart |
| `references/vedic_special_concepts.md` | Nakshatras, yogas, Rahu/Ketu, Navamsa |
| `references/chinese_astrology_core.md` | Interpreting the BaZi chart |
| `references/planet_meanings.md` | A planet's significations in depth |
| `references/house_meanings.md` | What a house governs |
| `references/system_differences.md` | The user asks why the systems disagree |
