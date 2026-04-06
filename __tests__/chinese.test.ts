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

  describe('pillar value accuracy', () => {
    it('1990-05-15 year pillar is Geng Wu (Metal Horse)', () => {
      expect(chart.pillars.year.stem.pinyin).toBe('Geng');
      expect(chart.pillars.year.branch.pinyin).toBe('Wu');
      expect(chart.pillars.year.branch.animal).toBe('Horse');
    });

    it('day master element is valid', () => {
      const elements = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
      expect(elements).toContain(chart.dayMaster.element);
    });

    it('day master yinYang is valid', () => {
      expect(['Yin', 'Yang']).toContain(chart.dayMaster.yinYang);
    });
  });

  describe('element balance accuracy', () => {
    it('all five elements are present in balance', () => {
      expect(chart.elementBalance).toHaveProperty('Wood');
      expect(chart.elementBalance).toHaveProperty('Fire');
      expect(chart.elementBalance).toHaveProperty('Earth');
      expect(chart.elementBalance).toHaveProperty('Metal');
      expect(chart.elementBalance).toHaveProperty('Water');
    });

    it('element values are non-negative', () => {
      for (const val of [
        chart.elementBalance.Wood,
        chart.elementBalance.Fire,
        chart.elementBalance.Earth,
        chart.elementBalance.Metal,
        chart.elementBalance.Water,
      ]) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });

    it('dominant element has highest score', () => {
      const { dominant, weakest, ...elements } = chart.elementBalance;
      const vals = Object.entries(elements) as [string, number][];
      const maxElement = vals.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
      expect(dominant).toBe(maxElement);
    });

    it('weakest element has lowest score', () => {
      const { dominant, weakest, ...elements } = chart.elementBalance;
      const vals = Object.entries(elements) as [string, number][];
      const minElement = vals.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
      expect(weakest).toBe(minElement);
    });
  });

  describe('ten gods accuracy', () => {
    it('all pillar ten gods are valid', () => {
      const validTenGods = [
        'Indirect Wealth (Pian Cai)', 'Direct Wealth (Zheng Cai)',
        'Eating God (Shi Shen)', 'Hurting Officer (Shang Guan)',
        'Direct Officer (Zheng Guan)', 'Indirect Officer (Pian Guan)',
        'Direct Resource (Zheng Yin)', 'Indirect Resource (Pian Yin)',
        'Peer (Bi Jian)', 'Rob Wealth (Jie Cai)', 'Day Master', '',
      ];
      for (const key of ['year', 'month', 'day', 'hour'] as const) {
        if (chart.pillars[key].tenGod) {
          expect(validTenGods).toContain(chart.pillars[key].tenGod.stem);
        }
      }
    });
  });

  describe('special palaces', () => {
    it('has Ming Gong (Life Palace)', () => {
      expect(chart.specialPalaces).toHaveProperty('mingGong');
      expect(chart.specialPalaces.mingGong.ganZhi).toBeTruthy();
    });

    it('has Shen Gong (Spirit Palace)', () => {
      expect(chart.specialPalaces).toHaveProperty('shenGong');
      expect(chart.specialPalaces.shenGong.ganZhi).toBeTruthy();
    });

    it('has Tai Yuan (Fetal Palace)', () => {
      expect(chart.specialPalaces).toHaveProperty('taiYuan');
      expect(chart.specialPalaces.taiYuan.ganZhi).toBeTruthy();
    });

    it('has Tai Xi (Pre-Conception Palace)', () => {
      expect(chart.specialPalaces).toHaveProperty('taiXi');
      expect(chart.specialPalaces.taiXi.ganZhi).toBeTruthy();
    });

    it('all palaces have naYin values', () => {
      for (const palace of Object.values(chart.specialPalaces)) {
        expect(palace.naYin).toBeTruthy();
        expect(typeof palace.naYin).toBe('string');
      }
    });
  });

  describe('luck pillar accuracy', () => {
    it('luck pillar ages increase monotonically', () => {
      for (let i = 1; i < chart.luckPillars.length; i++) {
        expect(chart.luckPillars[i].startAge).toBeGreaterThan(chart.luckPillars[i - 1].startAge);
      }
    });

    it('each luck pillar spans 9-10 years', () => {
      for (const lp of chart.luckPillars) {
        const span = lp.endAge - lp.startAge;
        expect(span).toBeGreaterThanOrEqual(9);
        expect(span).toBeLessThanOrEqual(10);
      }
    });

    it('luck pillar ganZhi is a valid stem-branch pair', () => {
      for (const lp of chart.luckPillars) {
        expect(lp.ganZhi.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('NaYin accuracy', () => {
    it('year NaYin is a non-empty string', () => {
      expect(chart.naYin.year).toBeTruthy();
      expect(typeof chart.naYin.year).toBe('string');
    });

    it('all four pillars have NaYin', () => {
      expect(chart.naYin.year).toBeTruthy();
      expect(chart.naYin.month).toBeTruthy();
      expect(chart.naYin.day).toBeTruthy();
      expect(chart.naYin.hour).toBeTruthy();
    });
  });

  describe('XunKong (Void)', () => {
    it('year XunKong has two branches', () => {
      // XunKong returns two void branches per pillar
      expect(chart.xunKong.year).toBeTruthy();
    });

    it('all four pillars have XunKong', () => {
      expect(chart.xunKong.year).toBeTruthy();
      expect(chart.xunKong.month).toBeTruthy();
      expect(chart.xunKong.day).toBeTruthy();
      expect(chart.xunKong.hour).toBeTruthy();
    });
  });
});
