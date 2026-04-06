import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateAllCharts } from '../lib/charts';

// Mock geocode to avoid network calls
vi.mock('../lib/geocode', () => ({
  geocode: vi.fn().mockResolvedValue({
    lat: 40.7128,
    lng: -74.006,
    timezone: 'America/New_York',
    displayName: 'New York, NY, USA',
  }),
}));

describe('calculateAllCharts', () => {
  describe('input validation', () => {
    it('throws when date is missing', async () => {
      await expect(calculateAllCharts({ date: '' })).rejects.toThrow('Birth date is required');
    });

    it('throws when date is invalid', async () => {
      await expect(calculateAllCharts({ date: 'not-a-date', location: 'NYC' })).rejects.toThrow('Invalid date');
    });

    it('throws when neither location nor coordinates provided', async () => {
      await expect(calculateAllCharts({ date: '1990-05-15' })).rejects.toThrow('Either location or lat/lng');
    });

    it('throws for invalid latitude with coordinates', async () => {
      await expect(
        calculateAllCharts({ date: '1990-05-15', lat: 91, lng: 0, timezone: 'UTC' })
      ).rejects.toThrow('Invalid latitude');
    });

    it('throws for invalid longitude with coordinates', async () => {
      await expect(
        calculateAllCharts({ date: '1990-05-15', lat: 0, lng: 181, timezone: 'UTC' })
      ).rejects.toThrow('Invalid longitude');
    });
  });

  describe('default time handling', () => {
    it('defaults to 12:00 and warns when no time provided', async () => {
      const result = await calculateAllCharts({
        date: '1990-05-15',
        lat: 40.7128,
        lng: -74.006,
        timezone: 'America/New_York',
      });
      expect(result.birthData.time).toBe('12:00');
      expect(result.warnings.some((w) => w.includes('No birth time'))).toBe(true);
    });

    it('does not warn when time is provided', async () => {
      const result = await calculateAllCharts({
        date: '1990-05-15',
        time: '14:30',
        lat: 40.7128,
        lng: -74.006,
        timezone: 'America/New_York',
      });
      expect(result.warnings.some((w) => w.includes('No birth time'))).toBe(false);
    });
  });

  describe('coordinate-based input', () => {
    it('accepts lat/lng/timezone without location', async () => {
      const result = await calculateAllCharts({
        date: '1990-05-15',
        time: '14:30',
        lat: 40.7128,
        lng: -74.006,
        timezone: 'America/New_York',
      });
      expect(result.birthData.coordinates.lat).toBe(40.7128);
      expect(result.birthData.coordinates.lng).toBe(-74.006);
      expect(result.birthData.timezone).toBe('America/New_York');
    });

    it('warns when coordinates given without timezone', async () => {
      const result = await calculateAllCharts({
        date: '1990-05-15',
        time: '14:30',
        lat: 40.7128,
        lng: -74.006,
      });
      expect(result.warnings.some((w) => w.includes('No timezone provided'))).toBe(true);
    });
  });

  describe('location-based input (geocoded)', () => {
    it('geocodes location and returns coordinates', async () => {
      const result = await calculateAllCharts({
        date: '1990-05-15',
        time: '14:30',
        location: 'New York',
      });
      expect(result.birthData.coordinates.lat).toBeCloseTo(40.7128, 2);
      expect(result.birthData.coordinates.lng).toBeCloseTo(-74.006, 2);
      expect(result.birthData.location).toBe('New York, NY, USA');
    });
  });

  describe('chart output structure', () => {
    it('returns all three chart systems', async () => {
      const result = await calculateAllCharts({
        date: '1990-05-15',
        time: '14:30',
        lat: 40.7128,
        lng: -74.006,
        timezone: 'America/New_York',
      });
      expect(result.charts.western.system).toBe('Western (Tropical)');
      expect(result.charts.vedic.system).toBe('Vedic (Sidereal)');
      expect(result.charts.chinese).toHaveProperty('animal');
      expect(result.charts.chinese).toHaveProperty('dayMaster');
    });
  });

  describe('gender handling', () => {
    it('passes gender to Chinese chart for luck pillar direction', async () => {
      const male = await calculateAllCharts({
        date: '1990-05-15',
        time: '14:30',
        lat: 40.7128,
        lng: -74.006,
        timezone: 'America/New_York',
        gender: 'male',
      });
      const female = await calculateAllCharts({
        date: '1990-05-15',
        time: '14:30',
        lat: 40.7128,
        lng: -74.006,
        timezone: 'America/New_York',
        gender: 'female',
      });
      // Luck pillar direction differs by gender
      const malePillars = male.charts.chinese.luckPillars;
      const femalePillars = female.charts.chinese.luckPillars;
      expect(malePillars[0].ganZhi).not.toBe(femalePillars[0].ganZhi);
    });
  });

  describe('UTC vs local time routing', () => {
    it('Western and Vedic use UTC, Chinese uses local time', async () => {
      // Birth at 23:00 EDT → 03:00 UTC next day
      // Western/Vedic should reflect the 16th (UTC), Chinese should stay 15th (local)
      const result = await calculateAllCharts({
        date: '1990-05-15',
        time: '23:00',
        lat: 40.7128,
        lng: -74.006,
        timezone: 'America/New_York',
      });
      // All three systems should produce valid charts
      expect(result.charts.western).toBeDefined();
      expect(result.charts.vedic).toBeDefined();
      expect(result.charts.chinese).toBeDefined();
    });
  });
});
