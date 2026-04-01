/**
 * Chinese Astrology — Four Pillars (BaZi) Calculator
 * Uses lunar-javascript for BaZi computation.
 * All library output is in Chinese; this module translates to English.
 *
 * Implements: Four Pillars, Hidden Stems, Ten Gods (Shi Shen),
 * Twelve Growth Phases (Di Shi), Five-Element Balance, NaYin,
 * Special Palaces (Ming Gong, Shen Gong, Tai Yuan, Tai Xi),
 * Xun Kong (Void), and Luck Pillars (Da Yun).
 *
 * Zi hour convention: sect=1 (early Zi / 早子时) — a birth at 23:00–23:59
 * advances the day pillar to the next day, which is the standard in modern
 * BaZi practice.
 */

import { Solar } from 'lunar-javascript';

/* ------------------------------------------------------------------ */
/*  Translation tables                                                 */
/* ------------------------------------------------------------------ */

interface StemInfo {
  pinyin: string;
  element: string;
  yinYang: string;
}

interface BranchInfo {
  pinyin: string;
  animal: string;
  element: string;
}

// Heavenly Stems: Chinese → pinyin + element + polarity
const STEMS: Record<string, StemInfo> = {
  '甲': { pinyin: 'Jia', element: 'Wood', yinYang: 'Yang' },
  '乙': { pinyin: 'Yi', element: 'Wood', yinYang: 'Yin' },
  '丙': { pinyin: 'Bing', element: 'Fire', yinYang: 'Yang' },
  '丁': { pinyin: 'Ding', element: 'Fire', yinYang: 'Yin' },
  '戊': { pinyin: 'Wu', element: 'Earth', yinYang: 'Yang' },
  '己': { pinyin: 'Ji', element: 'Earth', yinYang: 'Yin' },
  '庚': { pinyin: 'Geng', element: 'Metal', yinYang: 'Yang' },
  '辛': { pinyin: 'Xin', element: 'Metal', yinYang: 'Yin' },
  '壬': { pinyin: 'Ren', element: 'Water', yinYang: 'Yang' },
  '癸': { pinyin: 'Gui', element: 'Water', yinYang: 'Yin' },
};

// Earthly Branches: Chinese → pinyin + animal + native element
const BRANCHES: Record<string, BranchInfo> = {
  '子': { pinyin: 'Zi', animal: 'Rat', element: 'Water' },
  '丑': { pinyin: 'Chou', animal: 'Ox', element: 'Earth' },
  '寅': { pinyin: 'Yin', animal: 'Tiger', element: 'Wood' },
  '卯': { pinyin: 'Mao', animal: 'Rabbit', element: 'Wood' },
  '辰': { pinyin: 'Chen', animal: 'Dragon', element: 'Earth' },
  '巳': { pinyin: 'Si', animal: 'Snake', element: 'Fire' },
  '午': { pinyin: 'Wu', animal: 'Horse', element: 'Fire' },
  '未': { pinyin: 'Wei', animal: 'Goat', element: 'Earth' },
  '申': { pinyin: 'Shen', animal: 'Monkey', element: 'Metal' },
  '酉': { pinyin: 'You', animal: 'Rooster', element: 'Metal' },
  '戌': { pinyin: 'Xu', animal: 'Dog', element: 'Earth' },
  '亥': { pinyin: 'Hai', animal: 'Pig', element: 'Water' },
};

// Animals in Chinese → English
const ANIMALS: Record<string, string> = {
  '鼠': 'Rat', '牛': 'Ox', '虎': 'Tiger', '兔': 'Rabbit',
  '龙': 'Dragon', '蛇': 'Snake', '马': 'Horse', '羊': 'Goat',
  '猴': 'Monkey', '鸡': 'Rooster', '狗': 'Dog', '猪': 'Pig',
};

// Five Elements in Chinese → English
const ELEMENTS: Record<string, string> = {
  '金': 'Metal', '木': 'Wood', '水': 'Water', '火': 'Fire', '土': 'Earth',
};

// Ten Gods (十神) in Chinese → English
const TEN_GODS: Record<string, string> = {
  '比肩': 'Peer (Bi Jian)',
  '劫财': 'Rob Wealth (Jie Cai)',
  '食神': 'Eating God (Shi Shen)',
  '伤官': 'Hurting Officer (Shang Guan)',
  '偏财': 'Indirect Wealth (Pian Cai)',
  '正财': 'Direct Wealth (Zheng Cai)',
  '七杀': 'Seven Killings (Qi Sha)',
  '正官': 'Direct Officer (Zheng Guan)',
  '偏印': 'Indirect Seal (Pian Yin)',
  '正印': 'Direct Seal (Zheng Yin)',
};

// Twelve Growth Phases (长生十二宫) in Chinese → English
const GROWTH_PHASES: Record<string, string> = {
  '长生': 'Birth (Chang Sheng)',
  '沐浴': 'Bathing (Mu Yu)',
  '冠带': 'Crowning (Guan Dai)',
  '临官': 'Prosperity (Lin Guan)',
  '帝旺': 'Emperor (Di Wang)',
  '衰':   'Decline (Shuai)',
  '病':   'Illness (Bing)',
  '死':   'Death (Si)',
  '墓':   'Tomb (Mu)',
  '绝':   'Extinction (Jue)',
  '胎':   'Embryo (Tai)',
  '养':   'Nurture (Yang)',
};

// NaYin (纳音 / Sexagenary Sound) — all 30 values, Chinese → English
const NAYIN_EN: Record<string, string> = {
  '海中金': 'Gold in the Sea',
  '炉中火': 'Fire in the Furnace',
  '大林木': 'Wood of the Great Forest',
  '路旁土': 'Earth by the Roadside',
  '剑锋金': 'Metal of the Sword Edge',
  '山头火': 'Fire on the Mountaintop',
  '涧下水': 'Water beneath the Stream',
  '城头土': 'Earth on the City Wall',
  '白蜡金': 'White Wax Metal',
  '杨柳木': 'Willow Wood',
  '泉中水': 'Water in the Spring',
  '屋上土': 'Earth on the Roof',
  '霹雳火': 'Thunderbolt Fire',
  '松柏木': 'Pine and Cypress Wood',
  '长流水': 'Ever-flowing Water',
  '沙中金': 'Gold in the Sand',
  '山下火': 'Fire beneath the Mountain',
  '平地木': 'Flatland Wood',
  '壁上土': 'Earth on the Wall',
  '金箔金': 'Gold Foil Metal',
  '覆灯火': 'Lamp Fire',
  '天河水': 'Water of the Milky Way',
  '大驿土': 'Earth of the Great Post Road',
  '钗钏金': 'Hairpin Metal',
  '桑柘木': 'Mulberry Wood',
  '大溪水': 'Water of the Great Stream',
  '沙中土': 'Earth in the Sand',
  '天上火': 'Fire in the Sky',
  '石榴木': 'Pomegranate Wood',
  '大海水': 'Water of the Great Sea',
};

/* ------------------------------------------------------------------ */
/*  Translation helpers                                                */
/* ------------------------------------------------------------------ */

function translateStem(ch: string): StemInfo {
  return STEMS[ch] || { pinyin: ch, element: 'Unknown', yinYang: 'Unknown' };
}

function translateBranch(ch: string): BranchInfo {
  return BRANCHES[ch] || { pinyin: ch, animal: 'Unknown', element: 'Unknown' };
}

function translateAnimal(ch: string): string {
  return ANIMALS[ch] || ch;
}

function translateTenGod(ch: string): string {
  return TEN_GODS[ch] || ch;
}

function translateGrowthPhase(ch: string): string {
  return GROWTH_PHASES[ch] || ch;
}

function translateNaYin(ch: string): string {
  return NAYIN_EN[ch] || ch;
}

/** Translate a Chinese GanZhi pair (e.g. '甲子') to pinyin (e.g. 'Jia Zi'). */
function translateGanZhi(gz: string): string {
  if (!gz || gz.length < 2) return gz || '';
  const stem = translateStem(gz[0]);
  const branch = translateBranch(gz[1]);
  return `${stem.pinyin} ${branch.pinyin}`;
}

/** Translate a Chinese XunKong pair (e.g. '戌亥') to pinyin (e.g. 'Xu Hai'). */
function translateXunKong(xk: string): string {
  if (!xk || xk.length < 2) return xk || '';
  return `${translateBranch(xk[0]).pinyin} ${translateBranch(xk[1]).pinyin}`;
}

function translateWuXing(wuxing: string): { stemElement: string; branchElement: string } {
  if (!wuxing || wuxing.length < 2) return { stemElement: 'Unknown', branchElement: 'Unknown' };
  return {
    stemElement: ELEMENTS[wuxing[0]] || wuxing[0],
    branchElement: ELEMENTS[wuxing[1]] || wuxing[1],
  };
}

/** Translate an array of hidden stem characters to English info. */
function translateHiddenStems(arr: string[]): StemInfo[] {
  return (arr || []).map((ch) => translateStem(ch));
}

/** Translate an array of Ten-God labels for hidden stems in a branch. */
function translateTenGodsArray(arr: string[]): string[] {
  return (arr || []).map((ch) => translateTenGod(ch));
}

/* ------------------------------------------------------------------ */
/*  Pillar structure                                                   */
/* ------------------------------------------------------------------ */

interface HiddenStem {
  chinese: string;
  pinyin: string;
  element: string;
  yinYang: string;
}

interface Pillar {
  stem: { chinese: string; pinyin: string; element: string; yinYang: string };
  branch: { chinese: string; pinyin: string; animal: string; element: string };
  elements: { stemElement: string; branchElement: string };
  hiddenStems: HiddenStem[];
  tenGod: { stem: string; branch: string[] };
  growthPhase: string;
  full: string;
}

function parsePillar(
  stemCh: string,
  branchCh: string,
  wuxing: string,
  hiddenStemsCh: string[],
  tenGodStem: string | null,
  tenGodBranch: string[],
  growthPhase: string,
): Pillar {
  const stem = translateStem(stemCh);
  const branch = translateBranch(branchCh);
  const elements = translateWuXing(wuxing);
  const hiddenStems = translateHiddenStems(hiddenStemsCh);
  return {
    stem: { chinese: stemCh, pinyin: stem.pinyin, element: stem.element, yinYang: stem.yinYang },
    branch: { chinese: branchCh, pinyin: branch.pinyin, animal: branch.animal, element: branch.element },
    elements,
    hiddenStems: hiddenStems.map((s, i) => ({
      chinese: hiddenStemsCh[i],
      pinyin: s.pinyin,
      element: s.element,
      yinYang: s.yinYang,
    })),
    tenGod: {
      stem: tenGodStem ? translateTenGod(tenGodStem) : 'Day Master',
      branch: translateTenGodsArray(tenGodBranch),
    },
    growthPhase: translateGrowthPhase(growthPhase),
    full: `${stem.pinyin} ${branch.pinyin}`,
  };
}

/* ------------------------------------------------------------------ */
/*  Five-element balance                                               */
/* ------------------------------------------------------------------ */

// Hidden stem weights by position: main qi (本气) > middle qi (中气) > residual qi (余气).
// The library returns hidden stems in traditional order: [main, middle, residual].
const HIDDEN_STEM_WEIGHTS = [0.7, 0.3, 0.1];

interface ElementBalance {
  Wood: number;
  Fire: number;
  Earth: number;
  Metal: number;
  Water: number;
  dominant: string;
  weakest: string;
}

function computeElementBalance(pillars: Pillar[]): ElementBalance {
  const counts: Record<string, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };

  for (const p of pillars) {
    // Heavenly stem element (full weight)
    if (counts[p.stem.element] !== undefined) counts[p.stem.element]++;
    // Branch native element (full weight)
    if (counts[p.branch.element] !== undefined) counts[p.branch.element]++;
    // Hidden stem elements — graduated weight by qi rank
    for (let i = 0; i < p.hiddenStems.length; i++) {
      const h = p.hiddenStems[i];
      const weight = HIDDEN_STEM_WEIGHTS[i] ?? 0.1;
      if (counts[h.element] !== undefined) counts[h.element] += weight;
    }
  }

  // Round to 1 decimal for readability
  for (const el of Object.keys(counts)) {
    counts[el] = Math.round(counts[el] * 10) / 10;
  }

  let dominant = 'Wood';
  let weakest = 'Wood';
  for (const el of Object.keys(counts)) {
    if (counts[el] > counts[dominant]) dominant = el;
    if (counts[el] < counts[weakest]) weakest = el;
  }

  return { ...counts, dominant, weakest } as ElementBalance;
}

/* ------------------------------------------------------------------ */
/*  Luck Pillars (Da Yun)                                              */
/* ------------------------------------------------------------------ */

interface LuckPillar {
  ganZhi: string;
  stem: { pinyin: string; element: string; yinYang: string };
  branch: { pinyin: string; animal: string; element: string };
  startAge: number;
  endAge: number;
  startYear: number;
}

function buildLuckPillars(bazi: any, gender: number): LuckPillar[] {
  try {
    const yun = bazi.getYun(gender);
    const daYunArr = yun.getDaYun();
    const pillars: LuckPillar[] = [];
    // Skip index 0 (childhood pillar), take the 8 main Da Yun periods
    const count = Math.min(daYunArr.length, 9);
    for (let i = 1; i < count; i++) {
      const dy = daYunArr[i];
      const gz: string = dy.getGanZhi();
      const stemInfo = translateStem(gz[0]);
      const branchInfo = translateBranch(gz[1]);
      pillars.push({
        ganZhi: translateGanZhi(gz),
        stem: { pinyin: stemInfo.pinyin, element: stemInfo.element, yinYang: stemInfo.yinYang },
        branch: { pinyin: branchInfo.pinyin, animal: branchInfo.animal, element: branchInfo.element },
        startAge: dy.getStartAge(),
        endAge: dy.getEndAge(),
        startYear: dy.getStartYear(),
      });
    }
    return pillars;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Special palaces                                                    */
/* ------------------------------------------------------------------ */

interface SpecialPalace {
  ganZhi: string;
  naYin: string;
}

function safeCall<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function buildPalace(ganZhiFn: () => string, naYinFn: () => string): SpecialPalace {
  const rawGz = safeCall(ganZhiFn, '');
  const rawNaYin = safeCall(naYinFn, '');
  return {
    ganZhi: translateGanZhi(rawGz),
    naYin: translateNaYin(rawNaYin),
  };
}

/* ------------------------------------------------------------------ */
/*  Public interface                                                    */
/* ------------------------------------------------------------------ */

export interface ChineseChart {
  system: string;
  animal: string;
  dayMaster: { element: string; yinYang: string; description: string };
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar };
  hiddenStemsSummary: string;
  tenGodsSummary: string;
  elementBalance: ElementBalance;
  naYin: Record<string, string>;
  specialPalaces: {
    mingGong: SpecialPalace;
    shenGong: SpecialPalace;
    taiYuan: SpecialPalace;
    taiXi: SpecialPalace;
  };
  xunKong: Record<string, string>;
  luckPillars: LuckPillar[];
  lunarDate: { year: number; month: number; day: number; isLeapMonth: boolean };
}

/**
 * Calculate a complete BaZi (Four Pillars) chart.
 * @param date  - Birth date/time (UTC-adjusted)
 * @param gender - 1 = male, 0 = female (needed for Luck Pillar direction)
 */
export function calculateChineseChart(date: Date, gender: number = 1): ChineseChart {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  const solar = Solar.fromYmdHms(year, month, day, hour, minute, second);
  const lunar = solar.getLunar();
  const bazi = lunar.getEightChar();

  // Use sect=1: early Zi hour (23:00-23:59) advances the day pillar to the next day.
  // This is the standard convention in modern BaZi practice.
  bazi.setSect(1);

  /* ---------- Four Pillars with Hidden Stems & Ten Gods ---------- */

  const yearPillar = parsePillar(
    bazi.getYearGan(), bazi.getYearZhi(), bazi.getYearWuXing(),
    safeCall(() => bazi.getYearHideGan(), []),
    safeCall(() => bazi.getYearShiShenGan(), null),
    safeCall(() => bazi.getYearShiShenZhi(), []),
    safeCall(() => bazi.getYearDiShi(), ''),
  );
  const monthPillar = parsePillar(
    bazi.getMonthGan(), bazi.getMonthZhi(), bazi.getMonthWuXing(),
    safeCall(() => bazi.getMonthHideGan(), []),
    safeCall(() => bazi.getMonthShiShenGan(), null),
    safeCall(() => bazi.getMonthShiShenZhi(), []),
    safeCall(() => bazi.getMonthDiShi(), ''),
  );
  const dayPillar = parsePillar(
    bazi.getDayGan(), bazi.getDayZhi(), bazi.getDayWuXing(),
    safeCall(() => bazi.getDayHideGan(), []),
    null, // Day stem Ten-God is self (Day Master)
    safeCall(() => bazi.getDayShiShenZhi(), []),
    safeCall(() => bazi.getDayDiShi(), ''),
  );
  const hourPillar = parsePillar(
    bazi.getTimeGan(), bazi.getTimeZhi(), bazi.getTimeWuXing(),
    safeCall(() => bazi.getTimeHideGan(), []),
    safeCall(() => bazi.getTimeShiShenGan(), null),
    safeCall(() => bazi.getTimeShiShenZhi(), []),
    safeCall(() => bazi.getTimeDiShi(), ''),
  );

  const allPillars = [yearPillar, monthPillar, dayPillar, hourPillar];

  /* ---------- Year animal ---------- */
  const animal = translateAnimal(lunar.getYearShengXiao());

  /* ---------- Day Master ---------- */
  const dayMaster = {
    element: dayPillar.stem.element,
    yinYang: dayPillar.stem.yinYang,
    description: `${dayPillar.stem.yinYang} ${dayPillar.stem.element} (${dayPillar.stem.pinyin})`,
  };

  /* ---------- Summaries for AI context ---------- */
  const hiddenStemsSummary = allPillars
    .map((p, i) => {
      const label = ['Year', 'Month', 'Day', 'Hour'][i];
      const stems = p.hiddenStems.map((h) => `${h.pinyin}(${h.yinYang} ${h.element})`).join(', ');
      return `${label}: ${stems || 'none'}`;
    })
    .join('; ');

  const tenGodsSummary = allPillars
    .map((p, i) => {
      const label = ['Year', 'Month', 'Day', 'Hour'][i];
      return `${label}: stem=${p.tenGod.stem}, branch=[${p.tenGod.branch.join(', ')}]`;
    })
    .join('; ');

  /* ---------- Element balance ---------- */
  const elementBalance = computeElementBalance(allPillars);

  /* ---------- NaYin (translated to English) ---------- */
  const naYin: Record<string, string> = {
    year: translateNaYin(safeCall(() => bazi.getYearNaYin(), '')),
    month: translateNaYin(safeCall(() => bazi.getMonthNaYin(), '')),
    day: translateNaYin(safeCall(() => bazi.getDayNaYin(), '')),
    hour: translateNaYin(safeCall(() => bazi.getTimeNaYin(), '')),
  };

  /* ---------- Special Palaces (translated) ---------- */
  const specialPalaces = {
    mingGong: buildPalace(() => bazi.getMingGong(), () => bazi.getMingGongNaYin()),
    shenGong: buildPalace(() => bazi.getShenGong(), () => bazi.getShenGongNaYin()),
    taiYuan:  buildPalace(() => bazi.getTaiYuan(),  () => bazi.getTaiYuanNaYin()),
    taiXi:    buildPalace(() => bazi.getTaiXi(),    () => bazi.getTaiXiNaYin()),
  };

  /* ---------- Xun Kong (Void branches — translated to pinyin) ---------- */
  const xunKong: Record<string, string> = {
    year: translateXunKong(safeCall(() => bazi.getYearXunKong(), '')),
    month: translateXunKong(safeCall(() => bazi.getMonthXunKong(), '')),
    day: translateXunKong(safeCall(() => bazi.getDayXunKong(), '')),
    hour: translateXunKong(safeCall(() => bazi.getTimeXunKong(), '')),
  };

  /* ---------- Luck Pillars (Da Yun) ---------- */
  const luckPillars = buildLuckPillars(bazi, gender);

  /* ---------- Lunar date ---------- */
  // lunar.getMonth() returns negative values for leap months (e.g. -4 = leap 4th month)
  const lunarMonth = lunar.getMonth();

  return {
    system: 'Chinese (BaZi / Four Pillars)',
    animal,
    dayMaster,
    pillars: { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar },
    hiddenStemsSummary,
    tenGodsSummary,
    elementBalance,
    naYin,
    specialPalaces,
    xunKong,
    luckPillars,
    lunarDate: {
      year: lunar.getYear(),
      month: Math.abs(lunarMonth),
      day: lunar.getDay(),
      isLeapMonth: lunarMonth < 0,
    },
  };
}
