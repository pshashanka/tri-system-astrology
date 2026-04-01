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
  if (isNaN(new Date(`${input.date}T${timeStr}:00Z`).getTime())) {
    throw new Error('Invalid date or time format');
  }

  if (!input.time) {
    warnings.push('No birth time provided; defaulting to 12:00 noon. Ascendant and house positions may be inaccurate.');
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
