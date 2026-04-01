/**
 * AI Integration — Sends structured chart data to OpenAI for synthesis.
 * Uses gpt-4o-mini by default (configurable via OPENAI_MODEL env var).
 */

import OpenAI from 'openai';
import type { WesternChart } from './western';
import type { VedicChart } from './vedic';
import type { ChineseChart } from './chinese';

const SYSTEM_PROMPT = `You are a master astrologer with deep expertise in three astrological traditions: Western (Tropical), Vedic (Jyotish/Sidereal), and Chinese (BaZi/Four Pillars).

You will receive structured chart data from all three systems for a single birth. Generate a comprehensive, insightful reading with EXACTLY four sections in Markdown format:

## Vedic (Jyotish) Analysis
Interpret the sidereal chart: Lagna, planetary dignities, Rahu/Ketu axis, Nakshatra influences, Navamsa implications, and current Vimshottari Dasha period. Focus on karmic themes, dharma, and life purpose.

## Western (Tropical) Analysis  
Interpret the tropical chart: Sun/Moon/Ascendant, major aspects, house placements. Focus on personality, psychological dynamics, and key life themes.

## Chinese (BaZi) Analysis
Interpret the Four Pillars comprehensively: Day Master strength analysis using the elemental balance data, Ten Gods (Shi Shen) relationships across all pillars, hidden stems within each branch, twelve growth phases (Di Shi), special palaces (Ming Gong, Shen Gong), NaYin, Xun Kong voids, and the Luck Pillar (Da Yun) timeline. Identify favorable and unfavorable elements. Connect the animal sign and Day Master to personality and destiny patterns.

## Unified Synthesis
Weave all three systems together. Identify where they agree (reinforcing themes), where they diverge (nuance and complexity), and what the combined picture reveals about the person's core nature, life path, strengths, challenges, and current cosmic timing.

Guidelines:
- Be specific to the actual chart data — reference real positions, signs, and aspects
- Avoid generic horoscope language; give personalized, data-driven insights
- Each section should be 150–250 words
- Use an authoritative but warm, accessible tone
- Do not disclaim that you are an AI`;

interface ReadingSections {
  vedic: string;
  western: string;
  chinese: string;
  synthesis: string;
}

export interface ReadingResult {
  raw: string;
  sections: ReadingSections;
  model: string;
  usage: OpenAI.Completions.CompletionUsage | undefined;
}

export async function generateReading(
  westernChart: WesternChart,
  vedicChart: VedicChart,
  chineseChart: ChineseChart
): Promise<ReadingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error('OPENAI_API_KEY is not configured. Add it to .env.local');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const client = new OpenAI({ apiKey });

  const userPrompt = `Here is the complete birth chart data from three astrological systems. Please provide a full reading.

### Western (Tropical) Chart
${JSON.stringify(westernChart, null, 2)}

### Vedic (Sidereal) Chart  
${JSON.stringify(vedicChart, null, 2)}

### Chinese (BaZi) Chart
${JSON.stringify(chineseChart, null, 2)}`;

  // Retry up to 3 times with exponential backoff on rate-limit errors (429)
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 3000,
      });

      const content = response.choices[0].message.content || '';
      return {
        raw: content,
        sections: parseSections(content),
        model,
        usage: response.usage,
      };
    } catch (err: any) {
      lastError = err;
      const isRateLimit = err?.status === 429 || err?.error?.type === 'requests';
      if (!isRateLimit || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw lastError;
}

function parseSections(text: string): ReadingSections {
  const sections: ReadingSections = {
    vedic: '',
    western: '',
    chinese: '',
    synthesis: '',
  };

  const vedicMatch = text.match(/## Vedic.*?\n([\s\S]*?)(?=## Western|## Chinese|## Unified|$)/i);
  const westernMatch = text.match(/## Western.*?\n([\s\S]*?)(?=## Vedic|## Chinese|## Unified|$)/i);
  const chineseMatch = text.match(/## Chinese.*?\n([\s\S]*?)(?=## Vedic|## Western|## Unified|$)/i);
  const synthesisMatch = text.match(/## Unified.*?\n([\s\S]*?)$/i);

  if (vedicMatch) sections.vedic = vedicMatch[1].trim();
  if (westernMatch) sections.western = westernMatch[1].trim();
  if (chineseMatch) sections.chinese = chineseMatch[1].trim();
  if (synthesisMatch) sections.synthesis = synthesisMatch[1].trim();

  return sections;
}
