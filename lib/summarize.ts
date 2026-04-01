/**
 * Chart summarizer — condenses full chart JSON into GPT-friendly format.
 * Strips raw longitudes, excess decimal precision, reduces aspects, condenses houses.
 * Keeps all interpretively meaningful data (signs, dignities, retrogrades, nakshatras, pillars).
 * Reduces ~15-30KB of chart data to ~3-5KB.
 */

import type { WesternChart } from './western';
import type { VedicChart } from './vedic';
import type { ChineseChart } from './chinese';

export interface SummarizedWestern {
  ascendant: string;
  midheaven: string;
  sun: { sign: string; degree: number; dignity: string };
  moon: { sign: string; degree: number; dignity: string };
  planets: Record<string, { sign: string; degree: number; dignity: string; retrograde: boolean }>;
  aspects: { planet1: string; planet2: string; aspect: string; orb: number }[];
  houses: Record<number, { sign: string; planets: string[] }>;
  elementBalance: Record<string, number>;
  modalityBalance: Record<string, number>;
}

export interface SummarizedVedic {
  ayanamsa: number;
  lagna: string;
  sun: { sign: string; nakshatra: string; pada: number; dignity: string; navamsa: string };
  moon: { sign: string; nakshatra: string; pada: number; dignity: string; navamsa: string };
  planets: Record<string, { sign: string; nakshatra: string; pada: number; dignity: string; navamsa: string; retrograde: boolean }>;
  houses: Record<number, { sign: string; planets: string[] }>;
  dasha: { mahadasha: { planet: string; start: string; end: string }; antardasha: { planet: string; start: string; end: string } | null };
}

export interface SummarizedChinese {
  animal: string;
  dayMaster: { element: string; yinYang: string; description: string };
  pillars: Record<string, { stem: string; branch: string; animal: string; stemElement: string; branchElement: string; tenGod: string; growthPhase: string; hiddenStems: string[] }>;
  elementBalance: { Wood: number; Fire: number; Earth: number; Metal: number; Water: number; dominant: string; weakest: string };
  specialPalaces: Record<string, string>;
  naYin: Record<string, string>;
  xunKong: Record<string, string>;
  luckPillars: { ganZhi: string; startAge: number; endAge: number }[];
}

export interface SummarizedCharts {
  western: SummarizedWestern;
  vedic: SummarizedVedic;
  chinese: SummarizedChinese;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function summarizeWestern(chart: WesternChart): SummarizedWestern {
  // Keep only the 8 tightest aspects
  const sortedAspects = [...chart.aspects]
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 8)
    .map((a) => ({ planet1: a.planet1, planet2: a.planet2, aspect: a.aspect, orb: round1(a.orb) }));

  const planets: SummarizedWestern['planets'] = {};
  for (const [key, p] of Object.entries(chart.planets)) {
    planets[key] = { sign: p.sign, degree: round1(p.degree), dignity: p.dignity, retrograde: p.retrograde };
  }

  // Condense houses — only include houses that have planets
  const houses: Record<number, { sign: string; planets: string[] }> = {};
  for (const [num, h] of Object.entries(chart.houses)) {
    houses[Number(num)] = { sign: h.sign, planets: h.planets };
  }

  return {
    ascendant: `${chart.ascendant.sign} ${round1(chart.ascendant.degree)}°`,
    midheaven: `${chart.midheaven.sign} ${round1(chart.midheaven.degree)}°`,
    sun: { sign: chart.sun.sign, degree: round1(chart.sun.degree), dignity: chart.sun.dignity },
    moon: { sign: chart.moon.sign, degree: round1(chart.moon.degree), dignity: chart.moon.dignity },
    planets,
    aspects: sortedAspects,
    houses,
    elementBalance: chart.elementBalance,
    modalityBalance: chart.modalityBalance,
  };
}

function summarizeVedic(chart: VedicChart): SummarizedVedic {
  const planets: SummarizedVedic['planets'] = {};
  for (const [key, p] of Object.entries(chart.planets)) {
    planets[key] = {
      sign: p.sign,
      nakshatra: p.nakshatra.name,
      pada: p.nakshatra.pada,
      dignity: p.dignity,
      navamsa: p.navamsa,
      retrograde: p.retrograde,
    };
  }

  const houses: Record<number, { sign: string; planets: string[] }> = {};
  for (const [num, h] of Object.entries(chart.houses)) {
    houses[Number(num)] = { sign: h.sign, planets: h.planets };
  }

  return {
    ayanamsa: round1(chart.ayanamsa),
    lagna: `${chart.lagna.sign} ${round1(chart.lagna.degree)}°`,
    sun: {
      sign: chart.sun.sign,
      nakshatra: chart.sun.nakshatra.name,
      pada: chart.sun.nakshatra.pada,
      dignity: chart.sun.dignity,
      navamsa: chart.sun.navamsa,
    },
    moon: {
      sign: chart.moon.sign,
      nakshatra: chart.moon.nakshatra.name,
      pada: chart.moon.nakshatra.pada,
      dignity: chart.moon.dignity,
      navamsa: chart.moon.navamsa,
    },
    planets,
    houses,
    dasha: {
      mahadasha: { planet: chart.dasha.mahadasha.planet, start: chart.dasha.mahadasha.start, end: chart.dasha.mahadasha.end },
      antardasha: chart.dasha.antardasha
        ? { planet: chart.dasha.antardasha.planet, start: chart.dasha.antardasha.start, end: chart.dasha.antardasha.end }
        : null,
    },
  };
}

function summarizeChinese(chart: ChineseChart): SummarizedChinese {
  const pillars: SummarizedChinese['pillars'] = {};
  for (const [key, p] of Object.entries(chart.pillars)) {
    pillars[key] = {
      stem: p.stem.pinyin,
      branch: p.branch.pinyin,
      animal: p.branch.animal,
      stemElement: p.stem.element,
      branchElement: p.branch.element,
      tenGod: p.tenGod?.stem || '',
      growthPhase: p.growthPhase,
      hiddenStems: p.hiddenStems.map((h) => `${h.pinyin} (${h.element})`),
    };
  }

  const specialPalaces: Record<string, string> = {};
  for (const [key, p] of Object.entries(chart.specialPalaces)) {
    specialPalaces[key] = `${p.ganZhi} — ${p.naYin}`;
  }

  return {
    animal: chart.animal,
    dayMaster: chart.dayMaster,
    pillars,
    elementBalance: chart.elementBalance,
    specialPalaces,
    naYin: chart.naYin,
    xunKong: chart.xunKong,
    luckPillars: chart.luckPillars.map((lp) => ({
      ganZhi: lp.ganZhi,
      startAge: lp.startAge,
      endAge: lp.endAge,
    })),
  };
}

export function summarizeCharts(charts: {
  western: WesternChart;
  vedic: VedicChart;
  chinese: ChineseChart;
}): SummarizedCharts {
  return {
    western: summarizeWestern(charts.western),
    vedic: summarizeVedic(charts.vedic),
    chinese: summarizeChinese(charts.chinese),
  };
}
