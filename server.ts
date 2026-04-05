import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { calculateAllCharts } from './lib/charts';
import { authenticateRequest } from './lib/auth';
import { createCorsHeaders } from './lib/cors';
import { checkRateLimit, getClientIp } from './lib/ratelimit';
import { summarizeCharts } from './lib/summarize';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'TriSystemAstrologyApp/1.0';
const port = Number(process.env.PORT || 3000);

const app = new Hono();

app.use('/api/v1/*', async (c, next) => {
  const origin = c.req.header('origin') ?? '';
  const corsHeaders = createCorsHeaders(origin);

  corsHeaders.forEach((value, key) => {
    c.header(key, value);
  });

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  const auth = authenticateRequest(c.req.raw.headers);
  if (!auth.valid) {
    return c.json({ error: auth.error, code: 'UNAUTHORIZED' }, 401);
  }

  const ip = getClientIp(c.req.raw.headers);
  const rateLimit = await checkRateLimit(ip);
  c.header('X-RateLimit-Remaining', String(rateLimit.remaining));

  if (!rateLimit.success) {
    return c.json({ error: 'Too many requests. Please wait a minute.', code: 'RATE_LIMITED' }, 429);
  }

  await next();
});

app.get('/', (c) => {
  return c.json({
    name: 'tri-system-astrology',
    version: '1.0.0',
    docs: '/openapi.json',
    health: '/health',
  });
});

app.get('/health', (c) => {
  return c.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/openapi.json', async (c) => {
  const filePath = path.join(process.cwd(), 'public', 'openapi.json');
  const document = await readFile(filePath, 'utf8');
  c.header('Content-Type', 'application/json; charset=utf-8');
  return c.body(document);
});

app.post('/api/v1/charts', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { date, time, location, lat, lng, timezone, gender, summary } = (body ?? {}) as Record<string, unknown>;

  try {
    const result = await calculateAllCharts({
      date: typeof date === 'string' ? date : '',
      time: typeof time === 'string' ? time : undefined,
      location: typeof location === 'string' ? location : undefined,
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
      timezone: typeof timezone === 'string' ? timezone : undefined,
      gender: gender === 'female' || gender === 'male' ? gender : undefined,
    });

    const charts = summary ? summarizeCharts(result.charts) : result.charts;

    return c.json({
      birthData: result.birthData,
      charts,
      warnings: result.warnings,
      meta: {
        calculatedAt: new Date().toISOString(),
        version: '1.0.0',
        summarized: Boolean(summary),
      },
    });
  } catch (err: any) {
    console.error('v1/charts error:', err);

    const isClientError =
      err.message?.startsWith('Location not found') ||
      err.message?.startsWith('Birth') ||
      err.message?.startsWith('Invalid') ||
      err.message?.startsWith('Either location') ||
      err.message?.startsWith('No ') ||
      err.message?.startsWith('Location is') ||
      err.message?.startsWith('Location text');

    if (isClientError) {
      return c.json({ error: err.message, code: 'BAD_REQUEST' }, 400);
    }

    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

app.all('/api/v1/charts', (c) => {
  return c.json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
});

app.get('/api/v1/geocode', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  if (!q || q.length < 2) {
    return c.json({ suggestions: [] });
  }

  if (q.length > 200) {
    return c.json({ error: 'Query too long', code: 'BAD_REQUEST' }, 400);
  }

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '5',
    addressdetails: '1',
  });

  try {
    const response = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      return c.json({ error: 'Geocoding service unavailable', code: 'UPSTREAM_ERROR' }, 502);
    }

    const data = await response.json();
    const suggestions = data.map((item: any) => {
      const address = item.address || {};
      const parts = [
        address.city || address.town || address.village || address.county,
        address.state,
        address.country,
      ].filter(Boolean);

      return {
        label: parts.join(', ') || item.display_name,
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      };
    });

    c.header('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return c.json({ suggestions });
  } catch (err) {
    console.error('v1/geocode error:', err);
    return c.json({ error: 'Failed to fetch suggestions', code: 'INTERNAL_ERROR' }, 500);
  }
});

app.all('/api/v1/geocode', (c) => {
  return c.json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
});

app.notFound((c) => {
  return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404);
});

app.onError((err, c) => {
  console.error('Unhandled server error:', err);
  return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
});

serve({
  fetch: app.fetch,
  port,
});

console.log(`Tri-System Astrology API listening on port ${port}`);

export default app;