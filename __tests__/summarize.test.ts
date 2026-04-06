import { describe, it, expect } from 'vitest';
import { summarizeCharts, type SummarizedCharts } from '../lib/summarize';
import { calculateWesternChart } from '../lib/western';
import { calculateVedicChart } from '../lib/vedic';
import { calculateChineseChart } from '../lib/chinese';

const REF_DATE = new Date('1990-05-15T14:30:00Z');
const NYC_LAT = 40.7128;
const NYC_LNG = -74.006;

const western = calculateWesternChart(REF_DATE, NYC_LAT, NYC_LNG);
const vedic = calculateVedicChart(REF_DATE, NYC_LAT, NYC_LNG);
const chinese = calculateChineseChart(REF_DATE, 1);

let summary: SummarizedCharts;

describe('summarizeCharts', () => {
  summary = summarizeCharts({ western, vedic, chinese });

  describe('western summary', () => {
    it('ascendant is formatted as "Sign Degree°"', () => {
      expect(summary.western.ascendant).toMatch(/^\w+ \d+(\.\d)?°$/);
    });

    it('midheaven is formatted as "Sign Degree°"', () => {
      expect(summary.western.midheaven).toMatch(/^\w+ \d+(\.\d)?°$/);
    });

    it('preserves sun sign and dignity', () => {
      expect(summary.western.sun.sign).toBe(western.sun.sign);
      expect(summary.western.sun.dignity).toBe(western.sun.dignity);
    });

    it('preserves moon sign and dignity', () => {
      expect(summary.western.moon.sign).toBe(western.moon.sign);
      expect(summary.western.moon.dignity).toBe(western.moon.dignity);
    });

    it('limits aspects to 8 tightest', () => {
      expect(summary.western.aspects.length).toBeLessThanOrEqual(8);
    });

    it('aspects are sorted by orb (tightest first)', () => {
      for (let i = 1; i < summary.western.aspects.length; i++) {
        expect(summary.western.aspects[i].orb).toBeGreaterThanOrEqual(
          summary.western.aspects[i - 1].orb
        );
      }
    });

    it('preserves all 8 planets with retrograde and dignity', () => {
      const keys = Object.keys(summary.western.planets);
      expect(keys).toHaveLength(8);
      for (const p of Object.values(summary.western.planets)) {
        expect(typeof p.retrograde).toBe('boolean');
        expect(typeof p.dignity).toBe('string');
        expect(typeof p.sign).toBe('string');
      }
    });

    it('preserves 12 houses', () => {
      expect(Object.keys(summary.western.houses)).toHaveLength(12);
    });

    it('preserves element and modality balance', () => {
      expect(summary.western.elementBalance).toEqual(western.elementBalance);
      expect(summary.western.modalityBalance).toEqual(western.modalityBalance);
    });

    it('degrees are rounded to 1 decimal', () => {
      for (const p of Object.values(summary.western.planets)) {
        const decimals = String(p.degree).split('.')[1];
        expect(!decimals || decimals.length <= 1).toBe(true);
      }
    });
  });

  describe('vedic summary', () => {
    it('lagna is formatted as "Sign Degree°"', () => {
      expect(summary.vedic.lagna).toMatch(/^\w+ \d+(\.\d)?°$/);
    });

    it('preserves ayanamsa', () => {
      expect(summary.vedic.ayanamsa).toBeCloseTo(vedic.ayanamsa, 0);
    });

    it('preserves sun nakshatra and pada', () => {
      expect(summary.vedic.sun.nakshatra).toBe(vedic.sun.nakshatra.name);
      expect(summary.vedic.sun.pada).toBe(vedic.sun.nakshatra.pada);
    });

    it('preserves moon navamsa', () => {
      expect(summary.vedic.moon.navamsa).toBe(vedic.moon.navamsa);
    });

    it('preserves dasha mahadasha planet', () => {
      expect(summary.vedic.dasha.mahadasha.planet).toBe(vedic.dasha.mahadasha.planet);
    });

    it('handles null antardasha', () => {
      // antardasha can be null
      if (vedic.dasha.antardasha === null) {
        expect(summary.vedic.dasha.antardasha).toBeNull();
      } else {
        expect(summary.vedic.dasha.antardasha).not.toBeNull();
        expect(summary.vedic.dasha.antardasha!.planet).toBe(vedic.dasha.antardasha.planet);
      }
    });

    it('preserves all planets with nakshatra, dignity, navamsa, retrograde', () => {
      for (const [key, p] of Object.entries(summary.vedic.planets)) {
        expect(p.nakshatra).toBe(vedic.planets[key].nakshatra.name);
        expect(p.dignity).toBe(vedic.planets[key].dignity);
        expect(p.navamsa).toBe(vedic.planets[key].navamsa);
        expect(p.retrograde).toBe(vedic.planets[key].retrograde);
      }
    });

    it('preserves 12 houses', () => {
      expect(Object.keys(summary.vedic.houses)).toHaveLength(12);
    });
  });

  describe('chinese summary', () => {
    it('preserves animal', () => {
      expect(summary.chinese.animal).toBe(chinese.animal);
    });

    it('preserves day master', () => {
      expect(summary.chinese.dayMaster.element).toBe(chinese.dayMaster.element);
      expect(summary.chinese.dayMaster.yinYang).toBe(chinese.dayMaster.yinYang);
    });

    it('has all four pillars', () => {
      expect(Object.keys(summary.chinese.pillars)).toEqual(
        expect.arrayContaining(['year', 'month', 'day', 'hour'])
      );
    });

    it('pillar stems are pinyin strings', () => {
      for (const p of Object.values(summary.chinese.pillars)) {
        expect(typeof p.stem).toBe('string');
        expect(p.stem.length).toBeGreaterThan(0);
      }
    });

    it('preserves element balance with dominant and weakest', () => {
      expect(summary.chinese.elementBalance.dominant).toBe(chinese.elementBalance.dominant);
      expect(summary.chinese.elementBalance.weakest).toBe(chinese.elementBalance.weakest);
    });

    it('preserves special palaces as formatted strings', () => {
      for (const val of Object.values(summary.chinese.specialPalaces)) {
        expect(val).toContain('—');
      }
    });

    it('preserves naYin for all pillars', () => {
      expect(Object.keys(summary.chinese.naYin)).toEqual(
        expect.arrayContaining(['year', 'month', 'day', 'hour'])
      );
    });

    it('preserves xunKong for all pillars', () => {
      expect(Object.keys(summary.chinese.xunKong)).toEqual(
        expect.arrayContaining(['year', 'month', 'day', 'hour'])
      );
    });

    it('luck pillars have ganZhi, startAge, endAge', () => {
      expect(summary.chinese.luckPillars.length).toBeGreaterThan(0);
      for (const lp of summary.chinese.luckPillars) {
        expect(typeof lp.ganZhi).toBe('string');
        expect(typeof lp.startAge).toBe('number');
        expect(typeof lp.endAge).toBe('number');
      }
    });

    it('hidden stems are formatted with element', () => {
      for (const p of Object.values(summary.chinese.pillars)) {
        for (const hs of p.hiddenStems) {
          expect(hs).toMatch(/\(/); // "Pinyin (Element)" format
        }
      }
    });
  });
});
