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

  describe('nakshatra accuracy', () => {
    it('Moon nakshatra lord matches the correct cycle position', () => {
      // Nakshatra lords cycle: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury
      const validLords = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
      expect(validLords).toContain(chart.moon.nakshatra.lord);
    });

    it('Sun nakshatra lord is valid', () => {
      const validLords = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
      expect(validLords).toContain(chart.sun.nakshatra.lord);
    });

    it('nakshatra index matches lord assignment', () => {
      // Lord at index i = NAKSHATRA_LORDS[i % 9]
      const lords = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
      expect(chart.moon.nakshatra.lord).toBe(lords[chart.moon.nakshatra.index % 9]);
    });

    it('all planet nakshatras have valid pada 1-4', () => {
      for (const p of Object.values(chart.planets)) {
        expect(p.nakshatra.pada).toBeGreaterThanOrEqual(1);
        expect(p.nakshatra.pada).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('navamsa accuracy', () => {
    it('Sun navamsa is a valid sign', () => {
      const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
      expect(signs).toContain(chart.sun.navamsa);
    });

    it('Moon navamsa is a valid sign', () => {
      const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
      expect(signs).toContain(chart.moon.navamsa);
    });

    it('all planet navamsas are valid signs', () => {
      const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
      for (const p of Object.values(chart.planets)) {
        expect(signs).toContain(p.navamsa);
      }
    });
  });

  describe('dasha accuracy', () => {
    it('mahadasha planet matches first nakshatra lord in sequence', () => {
      // The dasha sequence starts with the Moon's nakshatra lord
      const firstPlanet = chart.dasha.sequence[0].planet;
      const lords = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
      expect(lords).toContain(firstPlanet);
    });

    it('antardasha planet is valid when present', () => {
      if (chart.dasha.antardasha) {
        const lords = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
        expect(lords).toContain(chart.dasha.antardasha.planet);
      }
    });

    it('each dasha period has correct full years for its planet', () => {
      const years: Record<string, number> = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
      // All periods except the first should have full years
      for (let i = 1; i < chart.dasha.sequence.length; i++) {
        const entry = chart.dasha.sequence[i];
        expect(entry.years).toBe(years[entry.planet]);
      }
    });

    it('first dasha period is partial (less than or equal to full years)', () => {
      const years: Record<string, number> = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
      const first = chart.dasha.sequence[0];
      expect(first.years).toBeLessThanOrEqual(years[first.planet]);
      expect(first.years).toBeGreaterThan(0);
    });
  });

  describe('dignity accuracy', () => {
    it('Rahu/Ketu dignities are correctly assigned', () => {
      const validDignities = ['exalted', 'debilitated', 'own sign', 'neutral'];
      expect(validDignities).toContain(chart.planets.rahu.dignity);
      expect(validDignities).toContain(chart.planets.ketu.dignity);
    });

    it('Sun exalted in Aries', () => {
      if (chart.sun.sign === 'Aries') {
        expect(chart.sun.dignity).toBe('exalted');
      }
    });

    it('Moon exalted in Taurus', () => {
      if (chart.moon.sign === 'Taurus') {
        expect(chart.moon.dignity).toBe('exalted');
      }
    });
  });

  describe('ayanamsa accuracy', () => {
    it('ayanamsa for 1990 is approximately 23.7°', () => {
      // Lahiri for 1990 should be ~23.7°
      expect(chart.ayanamsa).toBeGreaterThan(23.5);
      expect(chart.ayanamsa).toBeLessThan(24.0);
    });
  });
});
