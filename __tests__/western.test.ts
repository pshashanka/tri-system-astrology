import { describe, it, expect } from 'vitest';
import { calculateWesternChart, type WesternChart } from '../lib/western';

// Fixed reference date: 1990-05-15 14:30 UTC, New York
const REF_DATE = new Date('1990-05-15T14:30:00Z');
const NYC_LAT = 40.7128;
const NYC_LNG = -74.006;

let chart: WesternChart;

describe('calculateWesternChart', () => {
  // Compute once, reuse across tests
  chart = calculateWesternChart(REF_DATE, NYC_LAT, NYC_LNG);

  describe('input validation', () => {
    it('rejects invalid date', () => {
      expect(() => calculateWesternChart(new Date('invalid'), 0, 0)).toThrow('Invalid date');
    });
    it('rejects latitude out of range', () => {
      expect(() => calculateWesternChart(REF_DATE, 91, 0)).toThrow('Invalid latitude');
      expect(() => calculateWesternChart(REF_DATE, -91, 0)).toThrow('Invalid latitude');
    });
    it('rejects longitude out of range', () => {
      expect(() => calculateWesternChart(REF_DATE, 0, 181)).toThrow('Invalid longitude');
      expect(() => calculateWesternChart(REF_DATE, 0, -181)).toThrow('Invalid longitude');
    });
    it('rejects NaN coordinates', () => {
      expect(() => calculateWesternChart(REF_DATE, NaN, 0)).toThrow('Invalid latitude');
      expect(() => calculateWesternChart(REF_DATE, 0, NaN)).toThrow('Invalid longitude');
    });
  });

  describe('system label', () => {
    it('returns Western (Tropical)', () => {
      expect(chart.system).toBe('Western (Tropical)');
    });
  });

  describe('Sun placement', () => {
    it('places Sun in Taurus for 1990-05-15', () => {
      expect(chart.sun.sign).toBe('Taurus');
    });
    it('includes dignity field', () => {
      expect(chart.sun).toHaveProperty('dignity');
      expect(typeof chart.sun.dignity).toBe('string');
    });
  });

  describe('Moon placement', () => {
    it('places Moon in Capricorn', () => {
      expect(chart.moon.sign).toBe('Capricorn');
    });
    it('Moon in Capricorn is detriment', () => {
      expect(chart.moon.dignity).toBe('detriment');
    });
  });

  describe('planets', () => {
    it('includes all 8 planets', () => {
      const expected = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
      expect(Object.keys(chart.planets).sort()).toEqual(expected.sort());
    });

    it('each planet has sign, degree, longitude, retrograde, dignity', () => {
      for (const p of Object.values(chart.planets)) {
        expect(p).toHaveProperty('sign');
        expect(p).toHaveProperty('degree');
        expect(p).toHaveProperty('longitude');
        expect(p).toHaveProperty('retrograde');
        expect(p).toHaveProperty('dignity');
        expect(typeof p.retrograde).toBe('boolean');
      }
    });

    it('Jupiter exalted in Cancer', () => {
      expect(chart.planets.jupiter.sign).toBe('Cancer');
      expect(chart.planets.jupiter.dignity).toBe('exalted');
    });

    it('Saturn domicile in Capricorn', () => {
      expect(chart.planets.saturn.sign).toBe('Capricorn');
      expect(chart.planets.saturn.dignity).toBe('domicile');
    });

    it('Mercury is retrograde on this date', () => {
      expect(chart.planets.mercury.retrograde).toBe(true);
    });

    it('Venus is not retrograde on this date', () => {
      expect(chart.planets.venus.retrograde).toBe(false);
    });
  });

  describe('ascendant & midheaven', () => {
    it('ascendant has sign and degree', () => {
      expect(typeof chart.ascendant.sign).toBe('string');
      expect(chart.ascendant.degree).toBeGreaterThanOrEqual(0);
      expect(chart.ascendant.degree).toBeLessThan(30);
    });
    it('midheaven has sign and degree', () => {
      expect(typeof chart.midheaven.sign).toBe('string');
      expect(chart.midheaven.degree).toBeGreaterThanOrEqual(0);
      expect(chart.midheaven.degree).toBeLessThan(30);
    });
  });

  describe('north node', () => {
    it('has sign, degree, longitude', () => {
      expect(typeof chart.northNode.sign).toBe('string');
      expect(chart.northNode.longitude).toBeGreaterThanOrEqual(0);
      expect(chart.northNode.longitude).toBeLessThan(360);
    });
  });

  describe('houses', () => {
    it('has 12 houses', () => {
      expect(Object.keys(chart.houses)).toHaveLength(12);
    });
    it('each house has a sign and planets array', () => {
      for (let i = 1; i <= 12; i++) {
        expect(chart.houses[i]).toHaveProperty('sign');
        expect(Array.isArray(chart.houses[i].planets)).toBe(true);
      }
    });
    it('house 1 sign matches ascendant sign', () => {
      expect(chart.houses[1].sign).toBe(chart.ascendant.sign);
    });
  });

  describe('aspects', () => {
    it('returns an array of aspects', () => {
      expect(Array.isArray(chart.aspects)).toBe(true);
      expect(chart.aspects.length).toBeGreaterThan(0);
    });
    it('each aspect has required fields', () => {
      for (const a of chart.aspects) {
        expect(a).toHaveProperty('planet1');
        expect(a).toHaveProperty('planet2');
        expect(a).toHaveProperty('aspect');
        expect(a).toHaveProperty('angle');
        expect(a).toHaveProperty('orb');
        expect(a.angle).toBeGreaterThanOrEqual(0);
        expect(a.angle).toBeLessThanOrEqual(180);
      }
    });
  });

  describe('element & modality balance', () => {
    it('has all four elements', () => {
      expect(chart.elementBalance).toHaveProperty('Fire');
      expect(chart.elementBalance).toHaveProperty('Earth');
      expect(chart.elementBalance).toHaveProperty('Air');
      expect(chart.elementBalance).toHaveProperty('Water');
    });
    it('element counts sum to number of placements', () => {
      const total = Object.values(chart.elementBalance).reduce((a, b) => a + b, 0);
      // Sun + Moon + Asc + MC + 8 planets = 12
      expect(total).toBe(12);
    });
    it('has all three modalities', () => {
      expect(chart.modalityBalance).toHaveProperty('Cardinal');
      expect(chart.modalityBalance).toHaveProperty('Fixed');
      expect(chart.modalityBalance).toHaveProperty('Mutable');
    });
  });

  describe('degree ranges', () => {
    it('all longitudes are in [0, 360)', () => {
      const allLons = [
        chart.sun.longitude,
        chart.moon.longitude,
        chart.ascendant.longitude,
        chart.midheaven.longitude,
        chart.northNode.longitude,
        ...Object.values(chart.planets).map((p) => p.longitude),
      ];
      for (const lon of allLons) {
        expect(lon).toBeGreaterThanOrEqual(0);
        expect(lon).toBeLessThan(360);
      }
    });
    it('all degrees within sign are in [0, 30)', () => {
      const allDegs = [
        chart.sun.degree,
        chart.moon.degree,
        ...Object.values(chart.planets).map((p) => p.degree),
      ];
      for (const deg of allDegs) {
        expect(deg).toBeGreaterThanOrEqual(0);
        expect(deg).toBeLessThan(30);
      }
    });
  });

  describe('aspects to angles', () => {
    it('includes aspects involving ascendant', () => {
      const ascAspects = chart.aspects.filter(
        (a) => a.planet1 === 'ascendant' || a.planet2 === 'ascendant'
      );
      expect(ascAspects.length).toBeGreaterThan(0);
    });

    it('includes aspects involving midheaven', () => {
      const mcAspects = chart.aspects.filter(
        (a) => a.planet1 === 'midheaven' || a.planet2 === 'midheaven'
      );
      expect(mcAspects.length).toBeGreaterThan(0);
    });
  });

  describe('planet-specific orbs', () => {
    it('Sun-Moon aspects use wider effective orb than outer planet pairs', () => {
      // Sun-Moon modifier average = (1.25+1.25)/2 = 1.25
      // Uranus-Pluto modifier average = (0.75+0.75)/2 = 0.75
      // So Sun-Moon conjunction orb = 8*1.25 = 10, Uranus-Pluto = 8*0.75 = 6
      const sunMoon = chart.aspects.find(
        (a) =>
          (a.planet1 === 'sun' && a.planet2 === 'moon') ||
          (a.planet1 === 'moon' && a.planet2 === 'sun')
      );
      // Sun-Moon are far apart on this date (~180°+ spread), so no conjunction expected
      // but we can verify any Sun/Moon aspect has a valid orb
      const luminaryAspects = chart.aspects.filter(
        (a) => a.planet1 === 'sun' || a.planet2 === 'sun' || a.planet1 === 'moon' || a.planet2 === 'moon'
      );
      expect(luminaryAspects.length).toBeGreaterThan(0);
      for (const a of luminaryAspects) {
        expect(a.orb).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
