/**
 * POST /api/reading
 * Accepts { date, time, location } → geocodes → calculates 3 charts in parallel → AI synthesis
 */

import { geocode } from '../../lib/geocode';
import { calculateWesternChart } from '../../lib/western';
import { calculateVedicChart } from '../../lib/vedic';
import { calculateChineseChart } from '../../lib/chinese';
import { generateReading } from '../../lib/ai';

// Simple in-memory rate limiter: max 10 requests per IP per minute
const rateMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  const { date, time, location } = req.body;

  // Validate required fields
  if (!date) {
    return res.status(400).json({ error: 'Birth date is required' });
  }
  if (!location) {
    return res.status(400).json({ error: 'Birth location is required' });
  }

  // Parse date and time into a Date object
  const timeStr = time || '12:00';
  const dateTime = new Date(`${date}T${timeStr}:00Z`);

  if (isNaN(dateTime.getTime())) {
    return res.status(400).json({ error: 'Invalid date or time format' });
  }

  try {
    // Geocode location
    const geo = await geocode(location);

    // Calculate all 3 charts in parallel
    const [westernChart, vedicChart, chineseChart] = await Promise.all([
      Promise.resolve(calculateWesternChart(dateTime, geo.lat, geo.lng)),
      Promise.resolve(calculateVedicChart(dateTime, geo.lat, geo.lng)),
      Promise.resolve(calculateChineseChart(dateTime)),
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
  } catch (err) {
    console.error('Reading API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate reading' });
  }
}
