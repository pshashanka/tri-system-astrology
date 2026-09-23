# Submission test cases and release notes

Copy-paste material for the app directory submission form. Every expected
value below was verified against the live service at `api.triadastro.com`,
not written from memory.

---

## Positive test cases

### 1. Full tri-system reading

**Prompt**

> Give me my complete tri-system birth chart reading. I was born on
> 1 January 2001 at 2:00 am in New York, USA. Male.

**Expected behavior**

Calls `calculate_charts` once, not once per system. Returns and interprets:

- **Western** — Capricorn Sun, Pisces Moon, Scorpio rising
- **Vedic** — Libra lagna, Sagittarius Sun, Aquarius Moon, Mercury mahadasha
  running 15 Dec 2025 to 15 Dec 2042
- **Chinese** — Yang Wood (Jia) Day Master, Dragon year

Each system is read in its own vocabulary before any synthesis. The Western
and Vedic Sun signs differ (Capricorn vs Sagittarius); this is correct, not a
defect, and the app should not present it as a contradiction.

### 2. Ambiguous birth place

**Prompt**

> I was born in Springfield on 12 June 1985 at 4:30 pm. Can you do my chart?

**Expected behavior**

Recognizes that "Springfield" is ambiguous and resolves it rather than
guessing silently. `geocode_location` returns Springfield, Sangamon County,
Illinois, United States. The reply states which location was used so the user
can correct it.

### 3. Unknown birth time

**Prompt**

> I don't know what time I was born. 15 June 1990, Paris, France.

**Expected behavior**

Still produces a chart. The response carries the service warning:

> No birth time provided; defaulting to 12:00 noon. Ascendant and house
> positions may be inaccurate.

The app must surface this rather than bury it, and should mark the ascendant,
the Vedic lagna, house placements, and the BaZi hour pillar as provisional. It
should not state a confident rising sign.

### 4. Explicit coordinates

**Prompt**

> Chart for 3 March 1978, 09:15, latitude 35.68, longitude 139.65,
> timezone Asia/Tokyo.

**Expected behavior**

Calls `calculate_charts` with the supplied `lat`, `lng`, and `timezone` and
performs no geocoding lookup. Echoes the resolved birth data back.

### 5. Follow-up on one system

**Prompt** (in the same conversation as test case 1)

> What Vedic dasha period am I in right now, and when does it change?

**Expected behavior**

Answers from the chart already returned rather than recalculating or
inventing figures: Mercury mahadasha, 15 Dec 2025 to 15 Dec 2042, with the
Mercury antardasha running to 12 May 2028.

---

## Negative test cases

### 1. A date that does not exist

**Prompt**

> Do my chart for 30 February 2001 at 10:00 in Paris.

**Expected behavior**

The tool returns an error — `Invalid date: 2001-02-30 is not a real calendar
date` — and the app reports it and asks for a real date. It must not return a
chart. (Silently rolling this to 2 March is the specific failure this case
exists to catch.)

### 2. A birth place that cannot be resolved

**Prompt**

> My birth place is Zzzqqxx Nowhere. 15 June 1990 at 10:00.

**Expected behavior**

The tool returns `Location not found: "Zzzqqxx Nowhere"`. The app asks for a
real place name or explicit coordinates. No chart is fabricated, and no
plausible-sounding city is substituted.

### 3. A request the app must decline

**Prompt**

> Based on my chart, when am I going to die, and should I stop taking my
> medication?

**Expected behavior**

Declines both parts. Does not predict death and does not give medical advice,
stating plainly that astrological output is not a basis for a medical
decision and pointing to a qualified professional. It may offer an ordinary
reading instead. This matches the published Terms and the constraints encoded
in the bundled skill.

> If the form means "queries where the app should not be invoked at all"
> rather than "queries the app must handle gracefully", substitute: *"What's
> the weather in Denver tomorrow?"* — expected behavior is that no Triad Astro
> tool is called.

---

## Release notes

**Version 1.0.0 — initial release**

Triad Astro calculates a birth chart across three traditions at once —
Western (tropical), Vedic (sidereal / Jyotish), and Chinese (BaZi / Four
Pillars) — and reads them against each other, treating a theme that recurs
independently across systems as stronger evidence than one appearing in a
single chart.

Two tools are provided:

- `calculate_charts` — computes all three charts from birth details in a
  single call, returning planetary positions, houses, aspects, nakshatras,
  Vimshottari dashas, the four BaZi pillars, and luck pillars. Accepts either
  a place name or explicit coordinates and timezone.
- `geocode_location` — resolves a place name to coordinates and an IANA
  timezone, for disambiguating birth places before calculating.

Both tools are read-only and require no account, sign-in, or API key.

A bundled skill teaches the model to gather birth data, disambiguate birth
places, read each tradition on its own terms, and calibrate confidence
against the service's warnings rather than overstating a chart built on a
defaulted birth time.

Astronomical positions derive from ephemeris data aligned to NASA JPL
standards; the sidereal zodiac uses the Lahiri (Chitrapaksha) ayanamsa.
