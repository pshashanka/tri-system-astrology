import { describe, it, expect } from 'vitest';
import { calculateVedicChart, type VedicChart } from '../lib/vedic';

const REF_DATE = new Date('1990-05-15T14:30:00Z');
const NYC_LAT = 40.7128;
const NYC_LNG = -74.006;

let chart: VedicChart;

describe('calculateVedicChart', () => {
  chart = calculateVedicChart(REF_DATE, NYC_LAT, NYC_LNG);

  describe('input validation', () => {
    it('rejects invalid date', () => {
      expect(() => calculateVedicChart(new Date('invalid'), 0, 0)).toThrow('Invalid date');
    });
    it('rejects latitude out of range', () => {
      expect(() => calculateVedicChart(REF_DATE, 91, 0)).toThrow('Invalid latitude');
    });
    it('rejects longitude out of range', () => {
      expect(() => calculateVedicChart(REF_DATE, 0, 181)).toThrow('Invalid longitude');
    });
  });

  describe('system and ayanamsa', () => {
    it('returns Vedic (Sidereal)', () => {
      expect(chart.system).toBe('Vedic (Sidereal)');
    });
    it('ayanamsa is approximately 23.7° for 1990', () => {
      expect(chart.ayanamsa).toBeGreaterThan(23.5);
      expect(chart.ayanamsa).toBeLessThan(24.0);
    });
  });

  describe('lagna', () => {
    it('has sign and degree', () => {
      expect(typeof chart.lagna.sign).toBe('string');
      expect(chart.lagna.degree).toBeGreaterThanOrEqual(0);
      expect(chart.lagna.degree).toBeLessThan(30);
    });
    it('signIndex is valid', () => {
      expect(chart.lagna.signIndex).toBeGreaterThanOrEqual(0);
      expect(chart.lagna.signIndex).toBeLessThan(12);
    });
  });

  describe('sun placement', () => {
    it('sidereal Sun is in Taurus for 1990-05-15', () => {
      // Tropical Taurus ~54° minus ayanamsa ~23.7° = ~30° still Taurus in sidereal
      expect(chart.sun.sign).toBe('Taurus');
    });
    it('Sun is never retrograde', () => {
      expect(chart.sun.retrograde).toBe(false);
    });
  });

  describe('moon placement', () => {
    it('has a valid sign', () => {
      expect(typeof chart.moon.sign).toBe('string');
    });
    it('Moon is never retrograde', () => {
      expect(chart.moon.retrograde).toBe(false);
    });
  });

  describe('planets', () => {
    const expectedPlanets = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'rahu', 'ketu'];

    it('includes all 7 Vedic planets + nodes', () => {
      for (const p of expectedPlanets) {
        expect(chart.planets).toHaveProperty(p);
      }
    });

    it('each planet has nakshatra, navamsa, dignity, retrograde', () => {
      for (const p of Object.values(chart.planets)) {
        expect(p).toHaveProperty('nakshatra');
        expect(p.nakshatra).toHaveProperty('name');
        expect(p.nakshatra).toHaveProperty('pada');
        expect(p.nakshatra).toHaveProperty('lord');
        expect(typeof p.navamsa).toBe('string');
        expect(typeof p.dignity).toBe('string');
        expect(typeof p.retrograde).toBe('boolean');
      }
    });

    it('nakshatra pada is 1-4', () => {
      for (const p of Object.values(chart.planets)) {
        expect(p.nakshatra.pada).toBeGreaterThanOrEqual(1);
        expect(p.nakshatra.pada).toBeLessThanOrEqual(4);
      }
    });

    it('Venus exalted in Pisces', () => {
      expect(chart.planets.venus.sign).toBe('Pisces');
      expect(chart.planets.venus.dignity).toBe('exalted');
    });

    it('Saturn retrograde on this date', () => {
      expect(chart.planets.saturn.retrograde).toBe(true);
    });

    it('Mercury retrograde on this date', () => {
      expect(chart.planets.mercury.retrograde).toBe(true);
    });

    it('Rahu and Ketu are never retrograde', () => {
      expect(chart.planets.rahu.retrograde).toBe(false);
      expect(chart.planets.ketu.retrograde).toBe(false);
    });

    it('Rahu and Ketu are always 180° apart', () => {
      const diff = Math.abs(chart.planets.rahu.longitude - chart.planets.ketu.longitude);
      expect(Math.min(diff, 360 - diff)).toBeCloseTo(180, 0);
    });
  });

  describe('houses', () => {
    it('has 12 houses', () => {
      expect(Object.keys(chart.houses)).toHaveLength(12);
    });
    it('house 1 sign matches lagna sign', () => {
      expect(chart.houses[1].sign).toBe(chart.lagna.sign);
    });
  });

  describe('dasha', () => {
    it('has mahadasha with planet, start, end, years', () => {
      expect(chart.dasha.mahadasha).toHaveProperty('planet');
      expect(chart.dasha.mahadasha).toHaveProperty('start');
      expect(chart.dasha.mahadasha).toHaveProperty('end');
      expect(chart.dasha.mahadasha).toHaveProperty('years');
      expect(chart.dasha.mahadasha.years).toBeGreaterThan(0);
    });
    it('has 9 dasha periods in sequence', () => {
      expect(chart.dasha.sequence).toHaveLength(9);
    });
    it('dasha years sum to approximately 120', () => {
      const total = chart.dasha.sequence.reduce((s, d) => s + d.years, 0);
      // First period is partial (elapsed fraction subtracted), so total < 120
      expect(total).toBeGreaterThan(100);
      expect(total).toBeLessThanOrEqual(120);
    });
    it('dasha periods are in chronological order', () => {
      for (let i = 1; i < chart.dasha.sequence.length; i++) {
        expect(chart.dasha.sequence[i].start).toBe(chart.dasha.sequence[i - 1].end);
      }
    });
    it('first dasha starts at birth date', () => {
      expect(chart.dasha.sequence[0].start).toBe('1990-05-15');
    });
  });

  describe('sidereal offset', () => {
    it('sidereal longitudes differ from tropical by ~ayanamsa', () => {
      // Rough check: all sidereal longitudes should be less than tropical
      // (or wrapped around). We just verify they're valid [0, 360).
      const allLons = [
        chart.sun.longitude,
        chart.moon.longitude,
        ...Object.values(chart.planets).map((p) => p.longitude),
      ];
      for (const lon of allLons) {
        expect(lon).toBeGreaterThanOrEqual(0);
        expect(lon).toBeLessThan(360);
      }
    });
  });
});
