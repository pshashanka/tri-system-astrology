/**
 * Chinese Astrology — Four Pillars (BaZi) Calculator
 * Uses lunar-javascript for BaZi computation.
 * All library output is in Chinese; this module translates to English.
 */

import { Solar } from 'lunar-javascript';

interface StemInfo {
  pinyin: string;
  element: string;
  yinYang: string;
}

interface BranchInfo {
  pinyin: string;
  animal: string;
}

// Heavenly Stems: Chinese → English + Element
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

// Earthly Branches: Chinese → English + Animal
const BRANCHES: Record<string, BranchInfo> = {
  '子': { pinyin: 'Zi', animal: 'Rat' },
  '丑': { pinyin: 'Chou', animal: 'Ox' },
  '寅': { pinyin: 'Yin', animal: 'Tiger' },
  '卯': { pinyin: 'Mao', animal: 'Rabbit' },
  '辰': { pinyin: 'Chen', animal: 'Dragon' },
  '巳': { pinyin: 'Si', animal: 'Snake' },
  '午': { pinyin: 'Wu', animal: 'Horse' },
  '未': { pinyin: 'Wei', animal: 'Goat' },
  '申': { pinyin: 'Shen', animal: 'Monkey' },
  '酉': { pinyin: 'You', animal: 'Rooster' },
  '戌': { pinyin: 'Xu', animal: 'Dog' },
  '亥': { pinyin: 'Hai', animal: 'Pig' },
};

// Animals in Chinese
const ANIMALS: Record<string, string> = {
  '鼠': 'Rat', '牛': 'Ox', '虎': 'Tiger', '兔': 'Rabbit',
  '龙': 'Dragon', '蛇': 'Snake', '马': 'Horse', '羊': 'Goat',
  '猴': 'Monkey', '鸡': 'Rooster', '狗': 'Dog', '猪': 'Pig',
};

// Five Elements in Chinese
const ELEMENTS: Record<string, string> = {
  '金': 'Metal', '木': 'Wood', '水': 'Water', '火': 'Fire', '土': 'Earth',
};

function translateStem(ch: string): StemInfo {
  return STEMS[ch] || { pinyin: ch, element: 'Unknown', yinYang: 'Unknown' };
}

function translateBranch(ch: string): BranchInfo {
  return BRANCHES[ch] || { pinyin: ch, animal: 'Unknown' };
}

function translateAnimal(ch: string): string {
  return ANIMALS[ch] || ch;
}

function translateWuXing(wuxing: string): { stemElement: string; branchElement: string } {
  if (!wuxing || wuxing.length < 2) return { stemElement: 'Unknown', branchElement: 'Unknown' };
  return {
    stemElement: ELEMENTS[wuxing[0]] || wuxing[0],
    branchElement: ELEMENTS[wuxing[1]] || wuxing[1],
  };
}

interface Pillar {
  stem: { chinese: string; pinyin: string; element: string; yinYang: string };
  branch: { chinese: string; pinyin: string; animal: string };
  elements: { stemElement: string; branchElement: string };
  full: string;
}

function parsePillar(stemCh: string, branchCh: string, wuxing: string): Pillar {
  const stem = translateStem(stemCh);
  const branch = translateBranch(branchCh);
  const elements = translateWuXing(wuxing);
  return {
    stem: { chinese: stemCh, pinyin: stem.pinyin, element: stem.element, yinYang: stem.yinYang },
    branch: { chinese: branchCh, pinyin: branch.pinyin, animal: branch.animal },
    elements,
    full: `${stem.pinyin} ${branch.pinyin}`,
  };
}

export interface ChineseChart {
  system: string;
  animal: string;
  dayMaster: { element: string; yinYang: string; description: string };
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar };
  naYin: Record<string, string>;
  lunarDate: { year: number; month: number; day: number };
}

export function calculateChineseChart(date: Date): ChineseChart {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  const solar = Solar.fromYmdHms(year, month, day, hour, minute, second);
  const lunar = solar.getLunar();
  const bazi = lunar.getEightChar();

  // Four Pillars
  const yearPillar = parsePillar(bazi.getYearGan(), bazi.getYearZhi(), bazi.getYearWuXing());
  const monthPillar = parsePillar(bazi.getMonthGan(), bazi.getMonthZhi(), bazi.getMonthWuXing());
  const dayPillar = parsePillar(bazi.getDayGan(), bazi.getDayZhi(), bazi.getDayWuXing());
  const hourPillar = parsePillar(bazi.getTimeGan(), bazi.getTimeZhi(), bazi.getTimeWuXing());

  // Year animal
  const animal = translateAnimal(lunar.getYearShengXiao());

  // Day Master (day stem element) — central to BaZi interpretation
  const dayMaster = {
    element: dayPillar.stem.element,
    yinYang: dayPillar.stem.yinYang,
    description: `${dayPillar.stem.yinYang} ${dayPillar.stem.element}`,
  };

  // NaYin (Sexagenary sound)
  let naYin: Record<string, string> = {};
  try {
    naYin = {
      year: bazi.getYearNaYin(),
      month: bazi.getMonthNaYin(),
      day: bazi.getDayNaYin(),
      hour: bazi.getTimeNaYin(),
    };
  } catch {
    // NaYin not critical
  }

  return {
    system: 'Chinese (BaZi / Four Pillars)',
    animal,
    dayMaster,
    pillars: {
      year: yearPillar,
      month: monthPillar,
      day: dayPillar,
      hour: hourPillar,
    },
    naYin,
    lunarDate: {
      year: lunar.getYear(),
      month: lunar.getMonth(),
      day: lunar.getDay(),
    },
  };
}
