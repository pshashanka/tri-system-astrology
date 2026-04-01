/**
 * POST /api/reading
 * Accepts { date, time, location, gender } → calculates 3 charts → AI synthesis.
 * Legacy endpoint for the Next.js frontend. Uses shared chart orchestration.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { calculateAllCharts } from '../../lib/charts';
import { generateReading } from '../../lib/ai';
import { checkRateLimit, getClientIp } from '../../lib/ratelimit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting (Upstash Redis in production, allow-all in dev)
  const ip = getClientIp(req.headers, req.socket?.remoteAddress);
  const rl = await checkRateLimit(ip);
  if (!rl.success) {
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

  try {
    const result = await calculateAllCharts({ date, time, location, gender });

    // AI synthesis
    const reading = await generateReading(
      result.charts.western,
      result.charts.vedic,
      result.charts.chinese
    );

    return res.status(200).json({
      birthData: result.birthData,
      charts: result.charts,
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
