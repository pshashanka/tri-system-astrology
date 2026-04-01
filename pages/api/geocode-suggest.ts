/**
 * GET /api/geocode-suggest?q=<query>
 * Returns up to 5 location suggestions from Nominatim for autocomplete.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'TriSystemAstrologyApp/1.0';

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  const q = ((req.query.q as string) || '').trim();
  if (!q || q.length < 2) {
    return res.status(200).json([]);
  }

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '5',
    addressdetails: '1',
  });

  try {
    const resp = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!resp.ok) {
      return res.status(502).json({ error: 'Geocoding service unavailable' });
    }

    const data = await resp.json();

    const suggestions = data.map((item: any) => {
      const a = item.address || {};
      const parts = [
        a.city || a.town || a.village || a.county,
        a.state,
        a.country,
      ].filter(Boolean);
      return {
        label: parts.join(', ') || item.display_name,
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      };
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(suggestions);
  } catch (err) {
    console.error('Geocode suggest error:', err);
    return res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
}
