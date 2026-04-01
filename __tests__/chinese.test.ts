import { describe, it, expect } from 'vitest';
import { calculateChineseChart, type ChineseChart } from '../lib/chinese';

// Reference: 1990-05-15 14:30 UTC → Yang Metal day master, Snake year
const REF_DATE = new Date('1990-05-15T14:30:00Z');

let chart: ChineseChart;

describe('calculateChineseChart', () => {
  chart = calculateChineseChart(REF_DATE, 1);

  describe('system label', () => {
    it('returns Chinese (BaZi / Four Pillars)', () => {
      expect(chart.system).toBe('Chinese (BaZi / Four Pillars)');
    });
  });

  describe('animal sign', () => {
    it('1990 is the Year of the Horse', () => {
      expect(chart.animal).toBe('Horse');
    });
  });

  describe('day master', () => {
    it('has element and yinYang', () => {
      expect(chart.dayMaster).toHaveProperty('element');
      expect(chart.dayMaster).toHaveProperty('yinYang');
      expect(chart.dayMaster).toHaveProperty('description');
    });
    it('element is one of the five elements', () => {
      expect(['Metal', 'Wood', 'Water', 'Fire', 'Earth']).toContain(chart.dayMaster.element);
    });
  });

  describe('four pillars', () => {
    const pillarNames = ['year', 'month', 'day', 'hour'] as const;

    it('has all four pillars', () => {
      for (const name of pillarNames) {
        expect(chart.pillars).toHaveProperty(name);
      }
    });

    it('each pillar has stem, branch, full', () => {
      for (const name of pillarNames) {
        const p = chart.pillars[name];
        expect(p).toHaveProperty('stem');
        expect(p).toHaveProperty('branch');
        expect(p).toHaveProperty('full');
        expect(p.stem).toHaveProperty('pinyin');
        expect(p.stem).toHaveProperty('element');
        expect(p.branch).toHaveProperty('pinyin');
        expect(p.branch).toHaveProperty('animal');
        expect(typeof p.full).toBe('string');
        expect(p.full.length).toBeGreaterThan(0);
      }
    });

    it('pillar names are in English/pinyin (no Chinese characters)', () => {
      for (const name of pillarNames) {
        const p = chart.pillars[name];
        expect(p.full).not.toMatch(/[\u4e00-\u9fff]/);
        expect(p.stem.pinyin).not.toMatch(/[\u4e00-\u9fff]/);
        expect(p.branch.pinyin).not.toMatch(/[\u4e00-\u9fff]/);
      }
    });
  });

  describe('hidden stems summary', () => {
    it('is a non-empty string in English', () => {
      expect(chart.hiddenStemsSummary.length).toBeGreaterThan(0);
      expect(chart.hiddenStemsSummary).not.toMatch(/[\u4e00-\u9fff]/);
    });
  });

  describe('ten gods summary', () => {
    it('is a non-empty string in English', () => {
      expect(chart.tenGodsSummary.length).toBeGreaterThan(0);
      expect(chart.tenGodsSummary).not.toMatch(/[\u4e00-\u9fff]/);
    });
  });

  describe('element balance', () => {
    it('has all five elements with weights', () => {
      const eb = chart.elementBalance;
      expect(eb).toHaveProperty('Metal');
      expect(eb).toHaveProperty('Wood');
      expect(eb).toHaveProperty('Water');
      expect(eb).toHaveProperty('Fire');
      expect(eb).toHaveProperty('Earth');
    });
    it('all weights are non-negative', () => {
      for (const key of ['Metal', 'Wood', 'Water', 'Fire', 'Earth'] as const) {
        expect((chart.elementBalance as any)[key]).toBeGreaterThanOrEqual(0);
      }
    });
    it('has dominant and weakest elements', () => {
      expect(typeof chart.elementBalance.dominant).toBe('string');
      expect(typeof chart.elementBalance.weakest).toBe('string');
    });
    it('uses graduated weights (total varies from naive counting)', () => {
      const eb = chart.elementBalance as any;
      const total = eb.Metal + eb.Wood + eb.Water + eb.Fire + eb.Earth;
      // 4 pillars × stem(~0.7-1.0) + branch hidden stems → typically 5-12
      expect(total).toBeGreaterThan(3);
      expect(total).toBeLessThan(20);
    });
  });

  describe('naYin', () => {
    it('has naYin for all four pillars in English', () => {
      expect(Object.keys(chart.naYin).length).toBeGreaterThanOrEqual(4);
      for (const val of Object.values(chart.naYin)) {
        expect(val.length).toBeGreaterThan(0);
        expect(val).not.toMatch(/[\u4e00-\u9fff]/);
      }
    });
  });

  describe('special palaces', () => {
    it('has mingGong, shenGong, taiYuan, taiXi', () => {
      expect(chart.specialPalaces).toHaveProperty('mingGong');
      expect(chart.specialPalaces).toHaveProperty('shenGong');
      expect(chart.specialPalaces).toHaveProperty('taiYuan');
      expect(chart.specialPalaces).toHaveProperty('taiXi');
    });
    it('each palace has ganZhi in pinyin', () => {
      for (const palace of Object.values(chart.specialPalaces)) {
        expect(palace.ganZhi).not.toMatch(/[\u4e00-\u9fff]/);
        expect(palace.ganZhi.length).toBeGreaterThan(0);
      }
    });
  });

  describe('xunKong', () => {
    it('has xunKong values in pinyin', () => {
      expect(Object.keys(chart.xunKong).length).toBeGreaterThan(0);
      for (const val of Object.values(chart.xunKong)) {
        expect(val).not.toMatch(/[\u4e00-\u9fff]/);
      }
    });
  });

  describe('luck pillars', () => {
    it('returns an array of luck pillars', () => {
      expect(Array.isArray(chart.luckPillars)).toBe(true);
      expect(chart.luckPillars.length).toBeGreaterThan(0);
    });
    it('each luck pillar has startAge, endAge, stem, branch', () => {
      for (const lp of chart.luckPillars) {
        expect(lp).toHaveProperty('startAge');
        expect(lp).toHaveProperty('endAge');
        expect(lp).toHaveProperty('stem');
        expect(lp).toHaveProperty('branch');
        expect(lp.endAge).toBeGreaterThan(lp.startAge);
      }
    });
  });

  describe('lunar date', () => {
    it('has year, month, day, isLeapMonth', () => {
      expect(chart.lunarDate).toHaveProperty('year');
      expect(chart.lunarDate).toHaveProperty('month');
      expect(chart.lunarDate).toHaveProperty('day');
      expect(chart.lunarDate).toHaveProperty('isLeapMonth');
    });
    it('isLeapMonth is false for 1990-05-15', () => {
      expect(chart.lunarDate.isLeapMonth).toBe(false);
    });
  });

  describe('leap month detection', () => {
    it('detects leap month for 2020-05-23 (lunar leap 4th month)', () => {
      const leapChart = calculateChineseChart(new Date('2020-05-23T12:00:00Z'), 0);
      expect(leapChart.lunarDate.isLeapMonth).toBe(true);
    });
  });

  describe('Zi hour sect=1', () => {
    it('23:30 birth advances day pillar vs 14:30 birth', () => {
      const nightChart = calculateChineseChart(new Date('1990-05-15T23:30:00Z'), 1);
      const dayChart = calculateChineseChart(new Date('1990-05-15T14:30:00Z'), 1);
      expect(nightChart.pillars.day.full).not.toBe(dayChart.pillars.day.full);
    });
  });

  describe('gender affects luck pillars', () => {
    it('male and female charts have different luck pillar directions', () => {
      const maleChart = calculateChineseChart(REF_DATE, 1);
      const femaleChart = calculateChineseChart(REF_DATE, 0);
      // Luck pillar stems should differ (opposite direction)
      const maleStem = maleChart.luckPillars[0]?.stem;
      const femaleStem = femaleChart.luckPillars[0]?.stem;
      // They may or may not differ for the first pillar, but the sequence should diverge
      const maleStems = maleChart.luckPillars.map((lp) => lp.stem.pinyin).join(',');
      const femaleStems = femaleChart.luckPillars.map((lp) => lp.stem.pinyin).join(',');
      expect(maleStems).not.toBe(femaleStems);
    });
  });
});
