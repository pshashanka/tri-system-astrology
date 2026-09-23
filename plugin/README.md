# Triad Astro

Reads a birth chart across three astrological traditions at once — Western
(Tropical), Vedic (Sidereal/Jyotish) and Chinese (BaZi/Four Pillars) — and
shows where they converge.

Most astrology tools give you one system's answer. This one gives you three,
then helps you read the overlap: a theme that shows up independently in three
unrelated systems is worth more attention than one that shows up in a single
chart.

## What you get

Ask for a reading in plain language and Claude will calculate all three
charts in a single step, present the actual placements, and then interpret
them:

> Give me my complete tri-system birth chart reading. I was born on
> 14 March 1990 at 7:45am in Bangalore, India.

Other things it handles:

> What Vedic dasha period am I in right now?
>
> What does my BaZi chart say about my elemental balance?
>
> I don't know what time I was born — can you still read my chart?

## What it includes

**Connection to the Triad Astro service** at `api.triadastro.com`, providing
two tools: `calculate_charts`, which computes all three charts from birth
data, and `geocode_location`, which resolves a place name to coordinates and
a timezone.

**A reading skill** that teaches Claude how to gather birth data, resolve
ambiguous birth places, read each tradition on its own terms, and work the
convergence between them deliberately rather than gesturing at it.

## Setup

No account, sign-in or API key. Install the plugin and ask for a reading.

## Birth data

A **date** is all that is strictly required, but more detail means a better
chart.

Supply a **birth time** if you have it. Without one, calculations default to
noon and you will be told so. Your Sun sign and the slower planets hold up
either way — but more rests on the time than you would expect. The Moon moves
about 13° a day, so your Moon sign, your nakshatra and the dasha timings built
on it can all land differently. Your ascendant, your Vedic lagna and every
house placement depend on the time outright, as does the BaZi hour pillar —
and a birth close to midnight can shift the day pillar too. Treat all of that
as provisional until you find the time.

Give the **fullest birth place** you can — city, region, country. Place names
repeat across the world, and a bare name resolves to the best-known match:
"Springfield" alone lands in Illinois. The reading always tells you which
location it used, so check that line first if something looks off.

**Gender** is optional and affects only the direction of the Chinese luck
pillar sequence.

Accuracy note: planetary positions are computed from ephemeris data aligned
to NASA JPL standards. Historical daylight-saving rules and births near
midnight are the usual source of a chart that looks shifted by an hour or a
day.

## A word on what this is

Astrology is an interpretive tradition, not a scientifically validated method
of predicting personality or events. Readings here are for reflection and
interest. They are not medical, psychological, legal or financial advice, and
nothing a chart says should stand in for a qualified professional on a
decision that matters.

## Links

Website: https://triadastro.com
MCP server docs: https://api.triadastro.com/mcp-docs
Support: https://triadastro.com/support
Privacy: https://triadastro.com/privacy
Terms: https://triadastro.com/terms

Source: this plugin lives in the `plugin/` directory of
https://github.com/pshashanka/tri-system-astrology, alongside the server that
powers it.
