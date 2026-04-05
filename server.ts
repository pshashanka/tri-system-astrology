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
const PRIVACY_EFFECTIVE_DATE = 'April 5, 2026';

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
    privacy: '/privacy',
  });
});

app.get('/health', (c) => {
  return c.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/privacy', (c) => {
  c.header('Content-Type', 'text/html; charset=utf-8');

  return c.html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Privacy Policy | Tri-System Astrology API</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f1ea;
      --card: #fffdf8;
      --text: #1f2937;
      --muted: #475569;
      --accent: #0f766e;
      --border: #d6d3d1;
      --shadow: rgba(15, 23, 42, 0.08);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      padding: 32px 16px;
      background:
        radial-gradient(circle at top, rgba(15, 118, 110, 0.12), transparent 28%),
        linear-gradient(180deg, #f8f5ef 0%, var(--bg) 100%);
      color: var(--text);
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.65;
    }

    main {
      max-width: 820px;
      margin: 0 auto;
      padding: 32px 24px;
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--card);
      box-shadow: 0 18px 40px var(--shadow);
    }

    h1,
    h2 {
      color: #0f172a;
      line-height: 1.2;
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(2rem, 4vw, 2.8rem);
    }

    h2 {
      margin-top: 28px;
      font-size: 1.2rem;
    }

    p,
    li {
      color: var(--muted);
      font-size: 1rem;
    }

    ul {
      padding-left: 20px;
    }

    a {
      color: var(--accent);
    }

    .eyebrow {
      margin: 0 0 24px;
      color: var(--accent);
      font-size: 0.95rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .note {
      margin-top: 24px;
      padding: 16px 18px;
      border-left: 4px solid var(--accent);
      background: rgba(15, 118, 110, 0.08);
      border-radius: 12px;
    }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Tri-System Astrology API</p>
    <h1>Privacy Policy</h1>
    <p>Effective date: ${PRIVACY_EFFECTIVE_DATE}</p>

    <p>
      This service processes birth information submitted for astrology chart calculation across
      Western, Vedic, and Chinese systems. This page describes what information may be processed,
      why it is used, and which infrastructure providers may receive it.
    </p>

    <h2>Information We Process</h2>
    <ul>
      <li>Birth date</li>
      <li>Birth time</li>
      <li>Birth location</li>
      <li>Optional gender input, if provided for Chinese Luck Pillar direction</li>
      <li>Technical request metadata such as IP address, timestamps, and user agent for security and reliability</li>
    </ul>

    <h2>How We Use Information</h2>
    <ul>
      <li>To geocode locations and determine timezone context needed for accurate calculations</li>
      <li>To compute Western, Vedic, and Chinese astrology chart data</li>
      <li>To authenticate requests, apply rate limits, and protect the API from abuse</li>
      <li>To monitor service health, debug failures, and improve reliability</li>
    </ul>

    <h2>Third-Party Services</h2>
    <p>Depending on the request path and runtime configuration, submitted information may be processed by:</p>
    <ul>
      <li>Railway for application hosting and infrastructure logs</li>
      <li>Nominatim / OpenStreetMap for location search and geocoding</li>
      <li>BigDataCloud or similar timezone providers for timezone lookup</li>
      <li>Upstash Redis for rate limiting, if enabled</li>
      <li>OpenAI, if server-side summarization or related AI features are enabled in the future</li>
    </ul>

    <h2>Data Retention</h2>
    <p>
      The service is not intended to maintain a permanent user profile database. Operational logs may
      temporarily contain request metadata and limited request details for debugging, security, and
      uptime monitoring. Retention periods depend on the hosting and logging providers configured for the deployment.
    </p>

    <h2>Data Security</h2>
    <p>
      Reasonable administrative and technical measures are used to protect transmitted information,
      but no internet-connected service can guarantee absolute security.
    </p>

    <h2>Your Choices</h2>
    <p>
      Only provide the information needed to calculate the requested chart. Gender is optional.
      Avoid submitting unnecessary sensitive personal information through the API.
    </p>

    <h2>Contact</h2>
    <p>
      Privacy questions can be sent to <a href="mailto:pshashanka@gmail.com">pshashanka@gmail.com</a>.
    </p>

    <div class="note">
      This policy is provided to support Custom GPT action requirements and public API transparency.
    </div>
  </main>
</body>
</html>`);
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