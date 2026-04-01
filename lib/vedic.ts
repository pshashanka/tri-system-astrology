/**
 * Vedic (Sidereal) Astrology Chart Calculator
 * Uses astronomy-engine (pure JS) for high-precision geocentric positions.
 * Includes: Rashi, Nakshatra + Pada, Navamsa, Planetary Dignity,
 * Rahu/Ketu (mean node), Vimshottari Dasha, Whole Sign houses from Lagna.
 */

import * as Astronomy from 'astronomy-engine';

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
] as const;

const NAKSHATRA_LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'] as const;

type DashaPlanet = (typeof NAKSHATRA_LORDS)[number];

const DASHA_YEARS: Record<DashaPlanet, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};

const PLANETS_LIST = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;

/**
 * Convert JS Date to Julian Day number.
 */
function dateToJD(date: Date): number {
  return 2440587.5 + date.getTime() / 86400000;
}

/**
 * Lahiri (Chitrapaksha) Ayanamsa.
 * Quadratic polynomial fit to Indian Astronomical Ephemeris published values.
 * Accurate to < 1 arcminute for dates 1950–2050.
 */
function lahiriAyanamsa(jd: number): number {
  const Y = 2000 + (jd - 2451545.0) / 365.25;
  const dY = Y - 2000;
  return 23.8528 + 0.014165 * dY - 0.0000445 * dY * dY;
}

/**
 * Get geocentric tropical ecliptic longitude for a planet.
 */
function getTropicalLongitude(body: string, date: Date): number {
  if (body === 'Sun') return Astronomy.SunPosition(date).elon;
  const geo = Astronomy.GeoVector(body as Astronomy.Body, date, true);
  return Astronomy.Ecliptic(geo).elon;
}

/**
 * Mean North Node (Ω) via Meeus Ch. 47 polynomial.
 * Returns tropical ecliptic longitude in degrees [0, 360).
 */
function meanLunarNode(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  let omega = 125.0445479
    - 1934.1362891 * T
    + 0.0020754 * T * T
    + (T * T * T) / 467441.0
    - (T * T * T * T) / 60616000.0;
  return ((omega % 360) + 360) % 360;
}

/**
 * Compute the tropical Ascendant from date, latitude, longitude.
 */
function computeAscendant(date: Date, lat: number, lng: number): number {
  const gmst = Astronomy.SiderealTime(date);
  const lst = ((gmst + lng / 15) % 24 + 24) % 24;
  const ramc = lst * 15;

  const time = Astronomy.MakeTime(date);
  const obliquity = Astronomy.e_tilt(time).tobl;

  const ramcRad = (ramc * Math.PI) / 180;
  const oblRad = (obliquity * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  let asc = Math.atan2(
    -Math.cos(ramcRad),
    Math.sin(ramcRad) * Math.cos(oblRad) + Math.tan(latRad) * Math.sin(oblRad)
  );
  asc = (asc * 180) / Math.PI;
  return ((asc % 360) + 360) % 360;
}

function toSidereal(tropicalDeg: number, ayanamsa: number): number {
  return ((tropicalDeg - ayanamsa) % 360 + 360) % 360;
}

/**
 * Detect retrograde via numerical differentiation of ecliptic longitude.
 */
function isRetrograde(body: string, date: Date): boolean {
  if (body === 'Sun' || body === 'Moon') return false;
  const dt = 0.01; // ~14.4 minutes
  const d1 = new Date(date.getTime() - dt * 86400000);
  const d2 = new Date(date.getTime() + dt * 86400000);
  const l1 = Astronomy.Ecliptic(Astronomy.GeoVector(body as Astronomy.Body, d1, true)).elon;
  const l2 = Astronomy.Ecliptic(Astronomy.GeoVector(body as Astronomy.Body, d2, true)).elon;
  let diff = l2 - l1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff < 0;
}

interface SignInfo {
  sign: string;
  degree: number;
  longitude: number;
  signIndex: number;
}

function degToSign(deg: number): SignInfo {
  const normalized = ((deg % 360) + 360) % 360;
  const idx = Math.floor(normalized / 30);
  const within = normalized % 30;
  return { sign: SIGNS[idx], degree: Math.round(within * 100) / 100, longitude: Math.round(normalized * 100) / 100, signIndex: idx };
}

interface NakshatraInfo {
  name: string;
  pada: number;
  lord: string;
  index: number;
}

function getNakshatra(siderealDeg: number): NakshatraInfo {
  const normalized = ((siderealDeg % 360) + 360) % 360;
  const nakshatraSpan = 360 / 27;
  const idx = Math.floor(normalized / nakshatraSpan);
  const within = normalized % nakshatraSpan;
  const pada = Math.floor(within / (nakshatraSpan / 4)) + 1;
  const lordIdx = idx % 9;
  return {
    name: NAKSHATRAS[idx],
    pada,
    lord: NAKSHATRA_LORDS[lordIdx],
    index: idx,
  };
}

function getNavamsaSign(siderealDeg: number): string {
  const normalized = ((siderealDeg % 360) + 360) % 360;
  const navamsaIdx = Math.floor((normalized * 108) / 360) % 12;
  return SIGNS[navamsaIdx];
}

interface DignityDef {
  exalted: number;
  debilitated: number;
  own: number[];
}

const DIGNITY: Record<string, DignityDef> = {
  sun:     { exalted: 0, debilitated: 6, own: [4] },
  moon:    { exalted: 1, debilitated: 7, own: [3] },
  mars:    { exalted: 9, debilitated: 3, own: [0, 7] },
  mercury: { exalted: 5, debilitated: 11, own: [2, 5] },
  jupiter: { exalted: 3, debilitated: 9, own: [8, 11] },
  venus:   { exalted: 11, debilitated: 5, own: [1, 6] },
  saturn:  { exalted: 6, debilitated: 0, own: [9, 10] },
  rahu:    { exalted: 1, debilitated: 7, own: [10] },
  ketu:    { exalted: 7, debilitated: 1, own: [7] },
};

function getDignity(planet: string, signIndex: number): string {
  const d = DIGNITY[planet];
  if (!d) return 'neutral';
  if (signIndex === d.exalted) return 'exalted';
  if (signIndex === d.debilitated) return 'debilitated';
  if (d.own.includes(signIndex)) return 'own sign';
  return 'neutral';
}

interface DashaEntry {
  planet: string;
  start: string;
  end: string;
  years: number;
}

interface AntardashaEntry {
  planet: string;
  start: string;
  end: string;
}

interface DashaResult {
  mahadasha: DashaEntry;
  antardasha: AntardashaEntry | null;
  sequence: DashaEntry[];
}

interface InternalDashaEntry extends DashaEntry {
  _startMs: number;
  _endMs: number;
  _isFirst: boolean;
}

function computeDasha(moonSiderealDeg: number, birthDate: Date): DashaResult {
  const nak = getNakshatra(moonSiderealDeg);
  const lordIdx = nak.index % 9;

  const nakshatraSpan = 360 / 27;
  const posInNakshatra = ((moonSiderealDeg % 360 + 360) % 360) % nakshatraSpan;
  const fractionElapsed = posInNakshatra / nakshatraSpan;

  const sequence: InternalDashaEntry[] = [];
  const totalCycleYears = 120;
  const MS_PER_YEAR = 365.25 * 86400000;
  let cursorMs = birthDate.getTime();

  for (let i = 0; i < 9; i++) {
    const idx = (lordIdx + i) % 9;
    const planet = NAKSHATRA_LORDS[idx];
    const fullYears = DASHA_YEARS[planet];

    let years: number;
    if (i === 0) {
      years = fullYears * (1 - fractionElapsed);
    } else {
      years = fullYears;
    }

    const startMs = cursorMs;
    const endMs = cursorMs + years * MS_PER_YEAR;

    sequence.push({
      planet,
      start: new Date(startMs).toISOString().slice(0, 10),
      end: new Date(endMs).toISOString().slice(0, 10),
      years: Math.round(years * 100) / 100,
      _startMs: startMs,
      _endMs: endMs,
      _isFirst: i === 0,
    });
    cursorMs = endMs;
  }

  const now = new Date();
  const nowMs = now.getTime();
  let currentMaha = sequence[sequence.length - 1];
  for (const m of sequence) {
    if (m._startMs <= nowMs && nowMs < m._endMs) {
      currentMaha = m;
      break;
    }
  }

  const mahaLordIdx = NAKSHATRA_LORDS.indexOf(currentMaha.planet as DashaPlanet);
  const fullMahaYears = DASHA_YEARS[currentMaha.planet as DashaPlanet];
  let antarCursorMs: number;
  if (currentMaha._isFirst) {
    const elapsedMs = fractionElapsed * fullMahaYears * MS_PER_YEAR;
    antarCursorMs = currentMaha._startMs - elapsedMs;
  } else {
    antarCursorMs = currentMaha._startMs;
  }
  let currentAntar: AntardashaEntry | null = null;

  for (let i = 0; i < 9; i++) {
    const idx = (mahaLordIdx + i) % 9;
    const planet = NAKSHATRA_LORDS[idx];
    const antarMs = (fullMahaYears * DASHA_YEARS[planet] / totalCycleYears) * MS_PER_YEAR;

    const antarStartMs = antarCursorMs;
    const antarEndMs = antarCursorMs + antarMs;

    if (antarStartMs <= nowMs && nowMs < antarEndMs) {
      currentAntar = {
        planet,
        start: new Date(Math.max(antarStartMs, currentMaha._startMs)).toISOString().slice(0, 10),
        end: new Date(antarEndMs).toISOString().slice(0, 10),
      };
      break;
    }
    antarCursorMs = antarEndMs;
  }

  return {
    mahadasha: { planet: currentMaha.planet, start: currentMaha.start, end: currentMaha.end, years: currentMaha.years },
    antardasha: currentAntar,
    sequence: sequence.map(({ planet, start, end, years }) => ({ planet, start, end, years })),
  };
}

interface VedicPlanetInfo extends SignInfo {
  nakshatra: NakshatraInfo;
  navamsa: string;
  dignity: string;
  retrograde: boolean;
}

interface House {
  sign: string;
  planets: string[];
}

export interface VedicChart {
  system: string;
  ayanamsa: number;
  lagna: SignInfo;
  sun: VedicPlanetInfo;
  moon: VedicPlanetInfo;
  planets: Record<string, VedicPlanetInfo>;
  houses: Record<number, House>;
  dasha: DashaResult;
}

export function calculateVedicChart(date: Date, lat: number, lng: number): VedicChart {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date parameter');
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude: ${lat}`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error(`Invalid longitude: ${lng}`);
  }

  const jd = dateToJD(date);
  const ayanamsa = lahiriAyanamsa(jd);

  const tropAsc = computeAscendant(date, lat, lng);
  const sidAsc = toSidereal(tropAsc, ayanamsa);
  const lagna = degToSign(sidAsc);

  const tropSun = getTropicalLongitude('Sun', date);
  const sidSun = toSidereal(tropSun, ayanamsa);
  const sun: VedicPlanetInfo = {
    ...degToSign(sidSun),
    nakshatra: getNakshatra(sidSun),
    navamsa: getNavamsaSign(sidSun),
    dignity: getDignity('sun', degToSign(sidSun).signIndex),
    retrograde: false,
  };

  const tropMoon = getTropicalLongitude('Moon', date);
  const sidMoon = toSidereal(tropMoon, ayanamsa);
  const moon: VedicPlanetInfo = {
    ...degToSign(sidMoon),
    nakshatra: getNakshatra(sidMoon),
    navamsa: getNavamsaSign(sidMoon),
    dignity: getDignity('moon', degToSign(sidMoon).signIndex),
    retrograde: false,
  };

  const planets: Record<string, VedicPlanetInfo> = {};
  for (const name of PLANETS_LIST) {
    const key = name.toLowerCase();
    const trop = getTropicalLongitude(name, date);
    const sid = toSidereal(trop, ayanamsa);
    const info = degToSign(sid);
    planets[key] = {
      ...info,
      nakshatra: getNakshatra(sid),
      navamsa: getNavamsaSign(sid),
      dignity: getDignity(key, info.signIndex),
      retrograde: isRetrograde(name, date),
    };
  }

  const rahuTrop = meanLunarNode(jd);
  const rahuSid = toSidereal(rahuTrop, ayanamsa);
  const ketuSid = (rahuSid + 180) % 360;

  const rahuInfo = degToSign(rahuSid);
  const ketuInfo = degToSign(ketuSid);
  planets.rahu = {
    ...rahuInfo,
    nakshatra: getNakshatra(rahuSid),
    navamsa: getNavamsaSign(rahuSid),
    dignity: getDignity('rahu', rahuInfo.signIndex),
    retrograde: false,
  };
  planets.ketu = {
    ...ketuInfo,
    nakshatra: getNakshatra(ketuSid),
    navamsa: getNavamsaSign(ketuSid),
    dignity: getDignity('ketu', ketuInfo.signIndex),
    retrograde: false,
  };

  const lagnaSignIdx = lagna.signIndex;
  const houses: Record<number, House> = {};
  for (let i = 0; i < 12; i++) {
    houses[i + 1] = { sign: SIGNS[(lagnaSignIdx + i) % 12], planets: [] };
  }

  function getHouse(signIdx: number): number {
    return ((signIdx - lagnaSignIdx + 12) % 12) + 1;
  }
  houses[getHouse(sun.signIndex)].planets.push('Sun');
  houses[getHouse(moon.signIndex)].planets.push('Moon');
  for (const [name, data] of Object.entries(planets)) {
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    houses[getHouse(data.signIndex)].planets.push(cap);
  }

  const dasha = computeDasha(sidMoon, date);

  return {
    system: 'Vedic (Sidereal)',
    ayanamsa: Math.round(ayanamsa * 1000) / 1000,
    lagna,
    sun,
    moon,
    planets,
    houses,
    dasha,
  };
}
