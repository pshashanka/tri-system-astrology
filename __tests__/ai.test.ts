import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SAMPLE_AI_RESPONSE = `## Vedic (Jyotish) Analysis
Vedic content here with detailed analysis.

## Western (Tropical) Analysis
Western content here with detailed analysis.

## Chinese (BaZi) Analysis
Chinese content here with detailed analysis.

## Unified Synthesis
Synthesis content tying it all together.`;

const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

const SAMPLE_WESTERN = { system: 'Western', sun: { sign: 'Taurus' } } as any;
const SAMPLE_VEDIC = { system: 'Vedic', sun: { sign: 'Taurus' } } as any;
const SAMPLE_CHINESE = { system: 'Chinese', animal: 'Horse' } as any;

describe('generateReading', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test-key-1234567890' };
    mockCreate.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('API key validation', () => {
    it('throws when OPENAI_API_KEY is missing', async () => {
      delete process.env.OPENAI_API_KEY;
      const { generateReading } = await import('../lib/ai');
      await expect(generateReading(SAMPLE_WESTERN, SAMPLE_VEDIC, SAMPLE_CHINESE)).rejects.toThrow(
        'OPENAI_API_KEY'
      );
    });

    it('throws when OPENAI_API_KEY is placeholder', async () => {
      process.env.OPENAI_API_KEY = 'your-api-key-here';
      const { generateReading } = await import('../lib/ai');
      await expect(generateReading(SAMPLE_WESTERN, SAMPLE_VEDIC, SAMPLE_CHINESE)).rejects.toThrow(
        'OPENAI_API_KEY'
      );
    });
  });

  describe('successful response', () => {
    it('returns parsed sections from AI response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: SAMPLE_AI_RESPONSE } }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      });

      const { generateReading } = await import('../lib/ai');
      const result = await generateReading(SAMPLE_WESTERN, SAMPLE_VEDIC, SAMPLE_CHINESE);
      expect(result.raw).toBe(SAMPLE_AI_RESPONSE);
      expect(result.sections.vedic).toContain('Vedic content');
      expect(result.sections.western).toContain('Western content');
      expect(result.sections.chinese).toContain('Chinese content');
      expect(result.sections.synthesis).toContain('Synthesis content');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.usage).toBeDefined();
    });
  });

  describe('empty choices guard', () => {
    it('throws when choices array is empty', async () => {
      mockCreate.mockResolvedValue({ choices: [] });
      const { generateReading } = await import('../lib/ai');
      await expect(generateReading(SAMPLE_WESTERN, SAMPLE_VEDIC, SAMPLE_CHINESE)).rejects.toThrow(
        'no choices'
      );
    });
  });

  describe('retry logic', () => {
    it('retries on 429 and succeeds', async () => {
      const rateError = new Error('Rate limit') as any;
      rateError.status = 429;

      mockCreate
        .mockRejectedValueOnce(rateError)
        .mockResolvedValueOnce({
          choices: [{ message: { content: SAMPLE_AI_RESPONSE } }],
          usage: { total_tokens: 300 },
        });

      const { generateReading } = await import('../lib/ai');
      const result = await generateReading(SAMPLE_WESTERN, SAMPLE_VEDIC, SAMPLE_CHINESE);
      expect(result.sections.vedic).toContain('Vedic content');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('retries on 502 server error', async () => {
      const serverError = new Error('Bad Gateway') as any;
      serverError.status = 502;

      mockCreate
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({
          choices: [{ message: { content: SAMPLE_AI_RESPONSE } }],
          usage: { total_tokens: 300 },
        });

      const { generateReading } = await import('../lib/ai');
      const result = await generateReading(SAMPLE_WESTERN, SAMPLE_VEDIC, SAMPLE_CHINESE);
      expect(result.sections.vedic).toContain('Vedic content');
    });

    it('does NOT retry on 400 client error', async () => {
      const clientError = new Error('Bad Request') as any;
      clientError.status = 400;

      mockCreate.mockRejectedValueOnce(clientError);
      const { generateReading } = await import('../lib/ai');
      await expect(generateReading(SAMPLE_WESTERN, SAMPLE_VEDIC, SAMPLE_CHINESE)).rejects.toThrow(
        'Bad Request'
      );
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('gives up after 3 retries on persistent 429', async () => {
      const rateError = new Error('Rate limit') as any;
      rateError.status = 429;

      mockCreate.mockRejectedValue(rateError);
      const { generateReading } = await import('../lib/ai');
      await expect(generateReading(SAMPLE_WESTERN, SAMPLE_VEDIC, SAMPLE_CHINESE)).rejects.toThrow(
        'Rate limit'
      );
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('parseSections edge cases', () => {
    it('handles missing sections gracefully (returns empty strings)', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Just some text with no sections.' } }],
        usage: { total_tokens: 50 },
      });

      const { generateReading } = await import('../lib/ai');
      const result = await generateReading(SAMPLE_WESTERN, SAMPLE_VEDIC, SAMPLE_CHINESE);
      expect(result.sections.vedic).toBe('');
      expect(result.sections.western).toBe('');
      expect(result.sections.chinese).toBe('');
      expect(result.sections.synthesis).toBe('');
    });

    it('handles sections in non-standard order', async () => {
      const reordered = `## Chinese (BaZi) Analysis
Chinese first.

## Unified Synthesis
Synthesis second.

## Vedic (Jyotish) Analysis
Vedic third.

## Western (Tropical) Analysis
Western last.`;
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: reordered } }],
        usage: { total_tokens: 100 },
      });

      const { generateReading } = await import('../lib/ai');
      const result = await generateReading(SAMPLE_WESTERN, SAMPLE_VEDIC, SAMPLE_CHINESE);
      expect(result.sections.chinese).toContain('Chinese first');
      expect(result.sections.synthesis).toContain('Synthesis second');
      expect(result.sections.vedic).toContain('Vedic third');
      expect(result.sections.western).toContain('Western last');
    });
  });
});
