import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geocode } from '../lib/geocode';

describe('geocode', () => {
  describe('input validation (no network)', () => {
    it('throws on empty string', async () => {
      await expect(geocode('')).rejects.toThrow('Location is required');
    });
    it('throws on whitespace-only', async () => {
      await expect(geocode('   ')).rejects.toThrow('Location is required');
    });
    it('throws on null/undefined', async () => {
      await expect(geocode(null as any)).rejects.toThrow('Location is required');
      await expect(geocode(undefined as any)).rejects.toThrow('Location is required');
    });
    it('throws on text longer than 200 chars', async () => {
      await expect(geocode('a'.repeat(201))).rejects.toThrow('too long');
    });
  });

  describe('response validation (mocked fetch)', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('throws when Nominatim returns non-ok status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });
      await expect(geocode('New York')).rejects.toThrow('Geocoding failed: 503');
    });

    it('throws when Nominatim returns empty array', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
      await expect(geocode('xyznonexistent')).rejects.toThrow('Location not found');
    });

    it('throws when lat/lon missing from response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ display_name: 'Test' }]),
      });
      await expect(geocode('Test')).rejects.toThrow('missing coordinates');
    });

    it('throws when lat is NaN', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ lat: 'notanumber', lon: '10', display_name: 'Test' }]),
      });
      await expect(geocode('Test')).rejects.toThrow('Invalid latitude');
    });

    it('throws when lat is out of range', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ lat: '95', lon: '10', display_name: 'Test' }]),
      });
      await expect(geocode('Test')).rejects.toThrow('Invalid latitude');
    });

    it('returns valid result with timezone on success', async () => {
      const calls: string[] = [];
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        calls.push(url);
        if (url.includes('nominatim')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { lat: '40.7128', lon: '-74.006', display_name: 'New York, NY, USA' },
              ]),
          });
        }
        // BigDataCloud timezone
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ianaTimeId: 'America/New_York' }),
        });
      });

      const result = await geocode('New York');
      expect(result.lat).toBeCloseTo(40.7128, 4);
      expect(result.lng).toBeCloseTo(-74.006, 4);
      expect(result.displayName).toBe('New York, NY, USA');
      expect(result.timezone).toBe('America/New_York');
      expect(calls.some((url) => url.includes('bigdatacloud'))).toBe(true);
    });

    it('falls back to Open-Meteo when BigDataCloud fails', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('nominatim')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { lat: '40.7128', lon: '-74.006', display_name: 'New York, NY, USA' },
              ]),
          });
        }
        if (url.includes('bigdatacloud')) {
          return Promise.reject(new Error('network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ timezone: 'America/New_York' }),
        });
      });

      const result = await geocode('New York');
      expect(result.lat).toBeCloseTo(40.7128, 4);
      expect(result.timezone).toBe('America/New_York');
    });

    it('falls back to Open-Meteo when BigDataCloud returns empty timezone', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('nominatim')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { lat: '40.7128', lon: '-74.006', display_name: 'New York' },
              ]),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(
            url.includes('bigdatacloud')
              ? { ianaTimeId: '' }
              : { timezone: 'America/New_York' }
          ),
        });
      });

      const result = await geocode('New York');
      expect(result.timezone).toBe('America/New_York');
    });

    it('returns null timezone when both timezone providers fail', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('nominatim')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { lat: '40.7128', lon: '-74.006', display_name: 'New York' },
              ]),
          });
        }

        return Promise.reject(new Error('network error'));
      });

      const result = await geocode('New York');
      expect(result.timezone).toBeNull();
    });
  });
});
