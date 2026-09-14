# Directory Listing Copy — Triad Astro MCP

Draft copy for the Claude Connectors Directory and ChatGPT App Directory submission
portals. Edit freely before pasting into either form — character limits noted per field.

## Shared facts

- **MCP server URL:** `https://api.triadastro.com/api/v1/mcp`
- **Transport:** Streamable HTTP
- **Authentication:** None (public, read-only endpoint; rate-limited per IP)
- **Documentation URL:** `https://api.triadastro.com/mcp-docs`
- **Privacy policy URL:** `https://api.triadastro.com/privacy`
- **Support contact:** pshashanka@gmail.com
- **Company name:** Triad Astro
- **Company website:** `https://api.triadastro.com`

## Name

Triad Astro

## Tagline (≤55 characters)

> Western, Vedic & Chinese birth charts in one reading

(54 characters)

## Description (≤2,000 characters)

> Triad Astro calculates a complete birth chart across three astrological traditions at once — Western (Tropical), Vedic (Sidereal/Jyotish), and Chinese (BaZi/Four Pillars) — from a single birth date, time, and location.
>
> Ask your assistant to read a birth chart, compare what the three systems agree on, or explore a specific placement (sun sign, nakshatra, Four Pillars element), and it will geocode the location, compute precise planetary and pillar positions, and return structured chart data ready for interpretation.
>
> Two tools are available:
> - `calculate_charts` — full or condensed tri-system chart data from date, time, and location (or explicit coordinates)
> - `geocode_location` — resolve a place name to coordinates and timezone
>
> No account, API key, or sign-up is required — the server is free and open to connect.

(~740 characters — well under the 2,000 limit; trim further if the portal wants something tighter)

## Categories

The exact controlled vocabulary is only visible inside each submission portal's dropdown (not published in the docs), so pick the closest match at submission time. Best-fit guesses, in priority order:

1. Lifestyle
2. Personal / Self-improvement
3. Fun & Entertainment

## Use cases (Claude portal "Use cases" step)

> Primary use case: getting an AI-interpreted birth chart reading that synthesizes Western, Vedic, and Chinese astrology instead of just one tradition.
>
> Setup required: none — no account or credentials needed to connect or use any tool.
> Data access: read-only. The connector does not write, store, or modify any external data; it only computes charts and returns geocoding lookups.

## ChatGPT App Directory fields (tighter limits than Claude's)

Final submission enforces stricter limits than the draft stage — use these directly:

- **Display name (≤30 chars):** `Triad Astro`
- **Short description (≤30 chars):** `Tri-system birth chart reader` (29 chars)
- **Developer name (≤80 chars):** `Triad Astro` (or your legal/individual verified name, whichever you submit under)
- **Long description:** reuse the Description block above.
- **Domain verification:** OpenAI issues a token during submission — set it as `OPENAI_APPS_CHALLENGE_TOKEN` in Railway; it's served automatically at `https://api.triadastro.com/.well-known/openai-apps-challenge`.
- **CSP domains:** none needed — the tools return plain text/JSON, no custom UI templates, so there's nothing for a CSP to allow-list.
- **Screenshots:** skip this field. OpenAI only accepts screenshots when the tool scan detects a UI output template; these tools don't return one, and including screenshots anyway fails validation.
- **Reviewer credentials:** none — state explicitly that no login/auth is required to test any tool.

## OpenAI plugin test cases

**Positive (5):**
1. "Calculate a birth chart for someone born May 15, 1990 at 2:30 PM in New York City." → geocodes NYC, returns Western/Vedic/Chinese chart data.
2. "What's the Vedic sidereal sun sign for someone born 1985-03-21 in London?" → returns chart data including Vedic placements.
3. "Give me a condensed/summary birth chart for 2000-01-01, no time known, in Tokyo." → defaults time to 12:00, returns `summary: true` condensed output.
4. "Where is 'Springfield' and what timezone is it in?" → calls `geocode_location`, returns multiple/best-match coordinates + IANA timezone.
5. "Calculate a chart using lat 34.05, lng -118.24, timezone America/Los_Angeles, born 1975-07-04 08:00, female." → skips geocoding, returns chart honoring `gender` for Chinese Luck Pillars.

**Negative (3):**
1. Missing required `date` → tool returns a validation error (`isError: true`), not a crash.
2. Nonsense location query (e.g. "asdfghjkl") → `geocode_location` returns no results / a clear "not found" response rather than a bad guess.
3. Malformed date format (e.g. "May 15 1990") → tool returns a clear input-format error rather than silently misparsing.
