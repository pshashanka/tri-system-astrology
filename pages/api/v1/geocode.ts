/**
 * GET /api/v1/geocode?q=<query>
 * External API: Location autocomplete / geocoding.
 * Used by Custom GPT Actions and other external consumers.
 *
 * Auth: Bearer token (ASTRO_API_KEY)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '../../../lib/cors';
import { authenticateRequest } from '../../../lib/auth';
import { checkRateLimit, getClientIp } from '../../../lib/ratelimit';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'TriSystemAstrologyApp/1.0';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS
  if (applyCors(req, res)) return;

  // Method check
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  // Auth
  const auth = authenticateRequest(req);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error, code: 'UNAUTHORIZED' });
  }

  // Rate limit
  const ip = getClientIp(req.headers, req.socket?.remoteAddress);
  const rl = await checkRateLimit(ip);
  res.setHeader('X-RateLimit-Remaining', rl.remaining);
  if (!rl.success) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.', code: 'RATE_LIMITED' });
  }

  const q = ((req.query.q as string) || '').trim();
  if (!q || q.length < 2) {
    return res.status(200).json({ suggestions: [] });
  }

  if (q.length > 200) {
    return res.status(400).json({ error: 'Query too long', code: 'BAD_REQUEST' });
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
      return res.status(502).json({ error: 'Geocoding service unavailable', code: 'UPSTREAM_ERROR' });
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
    return res.status(200).json({ suggestions });
  } catch (err) {
    console.error('v1/geocode error:', err);
    return res.status(500).json({ error: 'Failed to fetch suggestions', code: 'INTERNAL_ERROR' });
  }
}
