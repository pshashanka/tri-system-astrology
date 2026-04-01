/**
 * POST /api/v1/charts
 * External API: Returns raw chart data (no AI synthesis).
 * Used by Custom GPT Actions and other external consumers.
 *
 * Body: { date, time?, location?, lat?, lng?, timezone?, gender?, summary? }
 * Auth: Bearer token (ASTRO_API_KEY)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '../../../lib/cors';
import { authenticateRequest } from '../../../lib/auth';
import { checkRateLimit, getClientIp } from '../../../lib/ratelimit';
import { calculateAllCharts } from '../../../lib/charts';
import { summarizeCharts } from '../../../lib/summarize';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS
  if (applyCors(req, res)) return;

  // Method check
  if (req.method !== 'POST') {
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

  const { date, time, location, lat, lng, timezone, gender, summary } = req.body || {};

  try {
    const result = await calculateAllCharts({ date, time, location, lat, lng, timezone, gender });

    const charts = summary ? summarizeCharts(result.charts) : result.charts;

    return res.status(200).json({
      birthData: result.birthData,
      charts,
      warnings: result.warnings,
      meta: {
        calculatedAt: new Date().toISOString(),
        version: '1.0.0',
        summarized: !!summary,
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
      return res.status(400).json({ error: err.message, code: 'BAD_REQUEST' });
    }

    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
