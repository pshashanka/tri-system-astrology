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
- Use an authoritative but warm, accessible tone`;

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
${JSON.stringify(westernChart)}

### Vedic (Sidereal) Chart  
${JSON.stringify(vedicChart)}

### Chinese (BaZi) Chart
${JSON.stringify(chineseChart)}`;

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
      }, { timeout: 30000 });

      if (!response.choices || response.choices.length === 0) {
        throw new Error('OpenAI returned no choices');
      }
      const content = response.choices[0].message.content || '';
      return {
        raw: content,
        sections: parseSections(content),
        model,
        usage: response.usage,
      };
    } catch (err: any) {
      lastError = err;
      const status = err?.status;
      const isRetryable =
        status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
        err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT';
      if (!isRetryable || attempt === 2) throw err;
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

  const sectionRegex = /##\s+(Vedic|Western|Chinese|Unified)[^\n]*\n([\s\S]*?)(?=##\s+(?:Vedic|Western|Chinese|Unified)|$)/gi;
  for (const match of text.matchAll(sectionRegex)) {
    const header = match[1].toLowerCase();
    const content = match[2].trim();
    if (header === 'vedic') sections.vedic = content;
    else if (header === 'western') sections.western = content;
    else if (header === 'chinese') sections.chinese = content;
    else if (header === 'unified') sections.synthesis = content;
  }

  return sections;
}
