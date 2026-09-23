/**
 * Shared chart orchestration — geocodes, converts timezone, calculates all 3 charts.
 * Fixes the Chinese time bug: passes local wall-clock time to BaZi, UTC to Western/Vedic.
 * Used by /api/reading, /api/v1/charts, and MCP server.
 */

import { geocode, type GeocodeResult } from './geocode';
import { calculateWesternChart, type WesternChart } from './western';
import { calculateVedicChart, type VedicChart } from './vedic';
import { calculateChineseChart, type ChineseChart } from './chinese';
import { makeBirthDateTime } from './timezone';

// ~1 hour of lunar motion
const MOON_NAKSHATRA_BOUNDARY_DEG = 0.5;

export interface ChartInput {
  date: string;       // YYYY-MM-DD
  time?: string;      // HH:MM (defaults to 12:00)
  location?: string;  // geocode internally
  lat?: number;       // skip geocode if provided with lng + timezone
  lng?: number;
  timezone?: string;  // IANA timezone (e.g. "America/New_York")
  gender?: string;    // "female" or "male" (affects Chinese Da Yun direction)
}

export interface BirthData {
  date: string;
  time: string;
  location: string;
  coordinates: { lat: number; lng: number };
  timezone: string | null;
}

export interface ChartResult {
  birthData: BirthData;
  charts: {
    western: WesternChart;
    vedic: VedicChart;
    chinese: ChineseChart;
  };
  warnings: string[];
}

/**
 * Calculate all three charts from user input.
 * Accepts either a location string (geocodes internally) or lat/lng/timezone.
 */
export async function calculateAllCharts(input: ChartInput): Promise<ChartResult> {
  const warnings: string[] = [];
  const timeStr = input.time || '12:00';

  // Validate date
  if (!input.date) throw new Error('Birth date is required');
  const parsedDate = new Date(`${input.date}T${timeStr}:00Z`);
  if (isNaN(parsedDate.getTime())) {
    throw new Error('Invalid date or time format');
  }
  // Date rolls overflowing components forward, so 2001-02-30 silently becomes
  // March 2 and the chart is returned under the date the caller asked for.
  // Reject anything that does not survive the round trip.
  if (parsedDate.toISOString().slice(0, 10) !== input.date) {
    throw new Error(`Invalid date: ${input.date} is not a real calendar date`);
  }

  if (!input.time) {
    warnings.push(
      'No birth time provided; defaulting to 12:00 noon. Time-sensitive results are unreliable: '
      + 'the Western ascendant, midheaven and houses; the Vedic lagna, houses and dasha dates '
      + '(the Moon moves ~13° a day, which can shift the dasha periods by years); '
      + 'and the Chinese hour pillar and element balance.'
    );
  }

  // Resolve coordinates + timezone
  let lat: number;
  let lng: number;
  let timezone: string | null;
  let displayName: string;

  if (input.lat != null && input.lng != null) {
    // Coordinates provided directly — skip geocoding
    lat = input.lat;
    lng = input.lng;
    timezone = input.timezone || null;
    displayName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude: ${lat}`);
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error(`Invalid longitude: ${lng}`);
    }
    if (!timezone) {
      warnings.push('No timezone provided with coordinates; birth time treated as UTC.');
    }
  } else if (input.location) {
    // Location string — geocode it
    const geo: GeocodeResult = await geocode(input.location);
    lat = geo.lat;
    lng = geo.lng;
    timezone = geo.timezone;
    displayName = geo.displayName;

    if (!timezone) {
      warnings.push('Timezone lookup failed; birth time treated as UTC. Chart timing may be inaccurate.');
    }
    if (geo.alternatives.length > 0) {
      const others = geo.alternatives.map((a) => a.displayName).join(' | ');
      warnings.push(
        `Location "${input.location}" is ambiguous; used ${geo.displayName}. Other matches: ${others}. `
        + 'Confirm with the user, and recalculate with a more specific location if this is the wrong place.'
      );
    }
  } else {
    throw new Error('Either location or lat/lng coordinates are required');
  }

  // Convert times
  const { utcDate, localDate, timezoneResolved } = makeBirthDateTime(input.date, timeStr, timezone);
  if (timezone && !timezoneResolved) {
    warnings.push('Timezone offset calculation failed; birth time treated as UTC.');
  }

  // Calculate all 3 charts in parallel
  // Western + Vedic need UTC for astronomical positions
  // Chinese needs local wall-clock time for hour/day pillar
  const genderNum = input.gender === 'female' ? 0 : 1;

  const [western, vedic, chinese] = await Promise.all([
    Promise.resolve(calculateWesternChart(utcDate, lat, lng)),
    Promise.resolve(calculateVedicChart(utcDate, lat, lng)),
    Promise.resolve(calculateChineseChart(localDate, genderNum)),
  ]);

  // The Moon's nakshatra fixes the dasha sequence, and the Moon moves ~0.5° an hour.
  // Near a boundary, a birth time off by under an hour flips the nakshatra and
  // every dasha date with it. Only worth saying when the time was actually given.
  if (input.time) {
    const span = 360 / 27;
    const pos = vedic.moon.longitude % span;
    const toBoundary = Math.min(pos, span - pos);
    if (toBoundary < MOON_NAKSHATRA_BOUNDARY_DEG) {
      warnings.push(
        `The Vedic Moon is ${toBoundary.toFixed(2)}° from a nakshatra boundary (${vedic.moon.nakshatra.name}). `
        + 'A birth time error of about an hour would change the nakshatra and all dasha dates; treat them as tentative.'
      );
    }
  }

  return {
    birthData: {
      date: input.date,
      time: timeStr,
      location: displayName,
      coordinates: { lat, lng },
      timezone,
    },
    charts: { western, vedic, chinese },
    warnings,
  };
}
