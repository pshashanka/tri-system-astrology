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

function normalizeBaseUrl(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.origin;
  } catch {
    return null;
  }
}

function resolvePublicBaseUrl(requestUrl: string): string {
  return (
    normalizeBaseUrl(process.env.PUBLIC_BASE_URL) ??
    normalizeBaseUrl(process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ??
    new URL(requestUrl).origin
  );
}

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
  const accept = c.req.header('accept') ?? '';
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return c.json({
      name: 'tri-system-astrology',
      version: '1.0.0',
      docs: '/openapi.json',
      health: '/health',
      privacy: '/privacy',
    });
  }

  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Triad Astro — Tri-System Astrology</title>
  <meta name="description" content="Birth chart calculations across Western, Vedic, and Chinese astrology traditions — powered by a single API." />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✦</text></svg>" />
  <style>
    :root {
      --bg: #0c0e1a;
      --card: rgba(255,255,255,0.04);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent2: #a78bfa;
      --accent3: #fb923c;
      --border: rgba(255,255,255,0.08);
      --glow: rgba(56,189,248,0.15);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      overflow-x: hidden;
    }
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        radial-gradient(ellipse 600px 400px at 20% 20%, rgba(167,139,250,0.12), transparent),
        radial-gradient(ellipse 500px 350px at 80% 60%, rgba(56,189,248,0.1), transparent),
        radial-gradient(ellipse 400px 300px at 50% 80%, rgba(251,146,60,0.08), transparent);
      pointer-events: none;
      z-index: 0;
    }

    .container { position: relative; z-index: 1; max-width: 960px; margin: 0 auto; padding: 0 24px; }

    header {
      padding: 60px 0 0;
      text-align: center;
    }
    .logo { font-size: 3rem; margin-bottom: 8px; }
    h1 {
      font-size: clamp(2.2rem, 5vw, 3.2rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, var(--accent), var(--accent2), var(--accent3));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .tagline {
      margin-top: 12px;
      font-size: 1.15rem;
      color: var(--muted);
      max-width: 540px;
      margin-left: auto;
      margin-right: auto;
    }
    .hero-cta {
      margin-top: 28px;
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn-gpt {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 14px 28px;
      border-radius: 12px;
      font-size: 1.05rem;
      font-weight: 600;
      text-decoration: none;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: #0c0e1a;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 20px rgba(56,189,248,0.25);
    }
    .btn-gpt:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(56,189,248,0.35);
    }

    .systems {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 56px 0;
    }
    .system-card {
      padding: 28px 24px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--card);
      backdrop-filter: blur(12px);
      transition: border-color 0.3s, box-shadow 0.3s;
    }
    .system-card:hover {
      border-color: rgba(255,255,255,0.15);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .system-icon { font-size: 2rem; margin-bottom: 12px; }
    .system-card h3 { font-size: 1.15rem; margin-bottom: 8px; }
    .system-card p { color: var(--muted); font-size: 0.92rem; line-height: 1.55; }

    .features {
      text-align: center;
      margin: 20px 0 56px;
    }
    .features h2 {
      font-size: 1.4rem;
      margin-bottom: 28px;
      color: var(--text);
    }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      text-align: left;
    }
    .feature {
      padding: 20px;
      border-radius: 12px;
      background: var(--card);
      border: 1px solid var(--border);
    }
    .feature-label { font-size: 0.85rem; color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
    .feature p { color: var(--muted); font-size: 0.88rem; }

    .cta {
      text-align: center;
      margin: 0 0 40px;
      padding: 40px 24px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(56,189,248,0.06), rgba(167,139,250,0.06));
    }
    .cta h2 { font-size: 1.3rem; margin-bottom: 8px; }
    .cta p { color: var(--muted); font-size: 0.95rem; margin-bottom: 20px; }
    .cta-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 22px;
      border-radius: 8px;
      font-size: 0.92rem;
      font-weight: 500;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary { background: var(--accent); color: #0c0e1a; }
    .btn-secondary { background: rgba(255,255,255,0.08); color: var(--text); border: 1px solid var(--border); }

    footer {
      text-align: center;
      padding: 32px 0 40px;
      color: var(--muted);
      font-size: 0.82rem;
      border-top: 1px solid var(--border);
    }
    footer a { color: var(--accent); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">✦</div>
      <h1>Triad Astro</h1>
      <p class="tagline">Birth chart calculations across three astrological traditions — Western, Vedic &amp; Chinese — powered by a single API.</p>
      <div class="hero-cta">
        <a href="https://chatgpt.com/g/g-69d1f9d6e32c81918788c4faf40ef5da-tri-system-astrology" class="btn-gpt" target="_blank" rel="noopener">✦ Try the GPT</a>
      </div>
    </header>

    <section class="systems">
      <div class="system-card">
        <div class="system-icon">♈</div>
        <h3>Western (Tropical)</h3>
        <p>Sun, Moon &amp; rising signs. Planetary aspects, house placements, and elemental balance using the tropical zodiac.</p>
      </div>
      <div class="system-card">
        <div class="system-icon">🕉</div>
        <h3>Vedic (Sidereal)</h3>
        <p>Rashi, Nakshatra &amp; Pada. Navamsa chart, planetary dignity, and Vimshottari Dasha timeline using Lahiri ayanamsa.</p>
      </div>
      <div class="system-card">
        <div class="system-icon">☯</div>
        <h3>Chinese (BaZi)</h3>
        <p>Four Pillars of Destiny. Heavenly Stems, Earthly Branches, Day Master analysis, and ten-year Luck Pillars.</p>
      </div>
    </section>

    <section class="features">
      <h2>Built for Precision</h2>
      <div class="feature-grid">
        <div class="feature">
          <div class="feature-label">Astronomy Engine</div>
          <p>High-precision planetary positions from NASA JPL-grade ephemeris calculations.</p>
        </div>
        <div class="feature">
          <div class="feature-label">AI-Ready</div>
          <p>Structured JSON output designed for GPT and LLM-powered interpretation.</p>
        </div>
        <div class="feature">
          <div class="feature-label">One Request</div>
          <p>All three chart systems calculated from a single API call with birth details.</p>
        </div>
        <div class="feature">
          <div class="feature-label">Timezone Aware</div>
          <p>Automatic timezone resolution from coordinates for accurate chart timing.</p>
        </div>
      </div>
    </section>

    <section class="cta">
      <h2>Try It Now</h2>
      <p>Get your birth chart reading across all three systems — free via ChatGPT.</p>
      <div class="cta-buttons">
        <a href="https://chatgpt.com/g/g-69d1f9d6e32c81918788c4faf40ef5da-tri-system-astrology" class="btn btn-primary" target="_blank" rel="noopener">✦ Open in ChatGPT</a>
        <a href="/openapi.json" class="btn btn-secondary">API Spec</a>
        <a href="/privacy" class="btn btn-secondary">Privacy</a>
      </div>
    </section>

    <footer>
      <p>&copy; ${new Date().getFullYear()} Triad Astro &middot; <a href="/privacy">Privacy</a> &middot; <a href="mailto:pshashanka@gmail.com">Contact</a></p>
    </footer>
  </div>
</body>
</html>`);
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
  const parsed = JSON.parse(document) as Record<string, unknown>;
  const serverUrl = resolvePublicBaseUrl(c.req.url);

  parsed.servers = [
    {
      url: serverUrl,
      description: 'Production',
    },
  ];

  c.header('Content-Type', 'application/json; charset=utf-8');
  return c.body(JSON.stringify(parsed, null, 2));
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