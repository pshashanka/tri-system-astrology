/**
 * POST /api/reading
 * Accepts { date, time, location } → geocodes → calculates 3 charts in parallel → AI synthesis
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { geocode } from '../../lib/geocode';
import { calculateWesternChart } from '../../lib/western';
import { calculateVedicChart } from '../../lib/vedic';
import { calculateChineseChart } from '../../lib/chinese';
import { generateReading } from '../../lib/ai';

/**
 * Convert a naive local date+time string to a UTC Date using an IANA timezone.
 */
function makeBirthDateTime(dateStr: string, timeStr: string, ianaTimezone: string | null): Date {
  const localAsUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  if (!ianaTimezone) return localAsUtc;
  try {
    const tzPart = new Intl.DateTimeFormat('en', {
      timeZone: ianaTimezone,
      timeZoneName: 'longOffset',
    }).formatToParts(localAsUtc).find((p) => p.type === 'timeZoneName')?.value;

    if (!tzPart) return localAsUtc;

    const m = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return localAsUtc;

    const sign = m[1] === '+' ? 1 : -1;
    const offsetMs = sign * (parseInt(m[2]) * 60 + parseInt(m[3] || '0')) * 60_000;
    return new Date(localAsUtc.getTime() - offsetMs);
  } catch {
    return localAsUtc;
  }
}

// Simple in-memory rate limiter: max 10 requests per IP per minute
const rateMap = new Map<string, { start: number; count: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  const { date, time, location, gender } = req.body;

  // Validate required fields
  if (!date) {
    return res.status(400).json({ error: 'Birth date is required' });
  }
  if (!location) {
    return res.status(400).json({ error: 'Birth location is required' });
  }

  // Parse date and time — validate format before geocoding
  const timeStr = time || '12:00';
  if (isNaN(new Date(`${date}T${timeStr}:00Z`).getTime())) {
    return res.status(400).json({ error: 'Invalid date or time format' });
  }

  try {
    // Geocode location (also returns IANA timezone)
    const geo = await geocode(location);

    // Convert local birth time to UTC using the birth location's timezone
    const dateTime = makeBirthDateTime(date, timeStr, geo.timezone);

    // Calculate all 3 charts in parallel
    const [westernChart, vedicChart, chineseChart] = await Promise.all([
      Promise.resolve(calculateWesternChart(dateTime, geo.lat, geo.lng)),
      Promise.resolve(calculateVedicChart(dateTime, geo.lat, geo.lng)),
      Promise.resolve(calculateChineseChart(dateTime, gender === 'female' ? 0 : 1)),
    ]);

    // AI synthesis
    const reading = await generateReading(westernChart, vedicChart, chineseChart);

    return res.status(200).json({
      birthData: {
        date,
        time: timeStr,
        location: geo.displayName,
        coordinates: { lat: geo.lat, lng: geo.lng },
      },
      charts: {
        western: westernChart,
        vedic: vedicChart,
        chinese: chineseChart,
      },
      reading,
    });
  } catch (err: any) {
    console.error('Reading API error:', err);
    const isUserError = err.message?.startsWith('Location not found') ||
      err.message?.startsWith('Birth') ||
      err.message?.startsWith('Invalid');
    const message = isUserError ? err.message : 'Failed to generate reading. Please try again.';
    return res.status(500).json({ error: message });
  }
}
