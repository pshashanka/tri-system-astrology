/**
 * Vedic (Sidereal) Astrology Chart Calculator
 * Subtracts Lahiri ayanamsa from tropical positions.
 * Includes: Rashi, Nakshatra + Pada, Navamsa, Planetary Dignity,
 * Rahu/Ketu (mean node), Vimshottari Dasha, Whole Sign houses from Lagna.
 */

import * as Astronomy from 'astronomy-engine';

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

// Nakshatra lords for Vimshottari Dasha (repeats 3x across 27 nakshatras)
const NAKSHATRA_LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];

// Mahadasha durations in years
const DASHA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };

const PLANETS_LIST = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

// Planetary dignity: { planet: { exalted: signIdx, debilitated: signIdx, ownSigns: [signIdx...] } }
const DIGNITY = {
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

/**
 * Compute Lahiri ayanamsa for a given date.
 * Linear approximation accurate to ~0.01° for 1950–2050.
 */
function lahiriAyanamsa(date) {
  const year = date.getFullYear() + (date.getMonth() + 1) / 12 + date.getDate() / 365.25;
  return 23.856 + (year - 2000) * 0.01397;
}

/**
 * Mean lunar node longitude (Meeus, Astronomical Algorithms).
 * Traditional Vedic astrology uses the mean node.
 */
function meanLunarNode(date) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525.0;
  let omega = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000.0;
  return ((omega % 360) + 360) % 360;
}

function getTropicalLongitude(body, date) {
  if (body === 'Sun') return Astronomy.SunPosition(date).elon;
  return Astronomy.EclipticLongitude(body, date);
}

function toSidereal(tropicalDeg, ayanamsa) {
  return ((tropicalDeg - ayanamsa) % 360 + 360) % 360;
}

function degToSign(deg) {
  const normalized = ((deg % 360) + 360) % 360;
  const idx = Math.floor(normalized / 30);
  const within = normalized % 30;
  return { sign: SIGNS[idx], degree: Math.round(within * 100) / 100, longitude: Math.round(normalized * 100) / 100, signIndex: idx };
}

function getNakshatra(siderealDeg) {
  const normalized = ((siderealDeg % 360) + 360) % 360;
  const nakshatraSpan = 360 / 27; // 13.333...
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

function getNavamsaSign(siderealDeg) {
  const normalized = ((siderealDeg % 360) + 360) % 360;
  const navamsaIdx = Math.floor((normalized * 9) / 360) % 12;
  return SIGNS[navamsaIdx];
}

function getDignity(planet, signIndex) {
  const d = DIGNITY[planet];
  if (!d) return 'neutral';
  if (signIndex === d.exalted) return 'exalted';
  if (signIndex === d.debilitated) return 'debilitated';
  if (d.own.includes(signIndex)) return 'own sign';
  return 'neutral';
}

function computeAscendant(date, lat, lng) {
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

/**
 * Compute Vimshottari Dasha from Moon's sidereal longitude.
 * Returns Mahadasha sequence + current Mahadasha & Antardasha.
 */
function computeDasha(moonSiderealDeg, birthDate) {
  const nak = getNakshatra(moonSiderealDeg);
  const lordIdx = nak.index % 9;

  // Fraction of nakshatra already traversed at birth
  const nakshatraSpan = 360 / 27;
  const posInNakshatra = ((moonSiderealDeg % 360 + 360) % 360) % nakshatraSpan;
  const fractionElapsed = posInNakshatra / nakshatraSpan;

  // Build sequence starting from birth nakshatra lord
  const sequence = [];
  const totalCycleYears = 120;
  let cursor = new Date(birthDate);

  for (let i = 0; i < 9; i++) {
    const idx = (lordIdx + i) % 9;
    const planet = NAKSHATRA_LORDS[idx];
    const fullYears = DASHA_YEARS[planet];

    let years;
    if (i === 0) {
      // First dasha: remaining portion
      years = fullYears * (1 - fractionElapsed);
    } else {
      years = fullYears;
    }

    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setFullYear(end.getFullYear() + Math.floor(years));
    end.setDate(end.getDate() + Math.round((years % 1) * 365.25));

    sequence.push({ planet, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), years: Math.round(years * 100) / 100 });
    cursor = new Date(end);
  }

  // Find current Mahadasha
  const now = new Date();
  let currentMaha = sequence[sequence.length - 1];
  for (const m of sequence) {
    if (new Date(m.start) <= now && now < new Date(m.end)) {
      currentMaha = m;
      break;
    }
  }

  // Compute Antardasha within current Mahadasha
  const mahaLordIdx = NAKSHATRA_LORDS.indexOf(currentMaha.planet);
  const mahaStart = new Date(currentMaha.start);
  const mahaDuration = DASHA_YEARS[currentMaha.planet] * 365.25; // days
  let antarCursor = new Date(mahaStart);
  let currentAntar = null;

  for (let i = 0; i < 9; i++) {
    const idx = (mahaLordIdx + i) % 9;
    const planet = NAKSHATRA_LORDS[idx];
    const antarDays = (DASHA_YEARS[currentMaha.planet] * DASHA_YEARS[planet] / totalCycleYears) * 365.25;

    const antarStart = new Date(antarCursor);
    const antarEnd = new Date(antarCursor.getTime() + antarDays * 86400000);

    if (antarStart <= now && now < antarEnd) {
      currentAntar = { planet, start: antarStart.toISOString().slice(0, 10), end: antarEnd.toISOString().slice(0, 10) };
      break;
    }
    antarCursor = antarEnd;
  }

  return {
    mahadasha: currentMaha,
    antardasha: currentAntar,
    sequence,
  };
}

export function calculateVedicChart(date, lat, lng) {
  const ayanamsa = lahiriAyanamsa(date);

  // Tropical ascendant → sidereal
  const tropAsc = computeAscendant(date, lat, lng);
  const sidAsc = toSidereal(tropAsc, ayanamsa);
  const lagna = degToSign(sidAsc);

  // Sun
  const tropSun = getTropicalLongitude('Sun', date);
  const sidSun = toSidereal(tropSun, ayanamsa);
  const sun = {
    ...degToSign(sidSun),
    nakshatra: getNakshatra(sidSun),
    navamsa: getNavamsaSign(sidSun),
    dignity: getDignity('sun', degToSign(sidSun).signIndex),
  };

  // Moon
  const tropMoon = getTropicalLongitude('Moon', date);
  const sidMoon = toSidereal(tropMoon, ayanamsa);
  const moon = {
    ...degToSign(sidMoon),
    nakshatra: getNakshatra(sidMoon),
    navamsa: getNavamsaSign(sidMoon),
    dignity: getDignity('moon', degToSign(sidMoon).signIndex),
  };

  // Planets
  const planets = {};
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
    };
  }

  // Rahu & Ketu (mean node)
  const rahuTrop = meanLunarNode(date);
  const rahuSid = toSidereal(rahuTrop, ayanamsa);
  const ketuSid = (rahuSid + 180) % 360;

  const rahuInfo = degToSign(rahuSid);
  const ketuInfo = degToSign(ketuSid);
  planets.rahu = {
    ...rahuInfo,
    nakshatra: getNakshatra(rahuSid),
    navamsa: getNavamsaSign(rahuSid),
    dignity: getDignity('rahu', rahuInfo.signIndex),
  };
  planets.ketu = {
    ...ketuInfo,
    nakshatra: getNakshatra(ketuSid),
    navamsa: getNavamsaSign(ketuSid),
    dignity: getDignity('ketu', ketuInfo.signIndex),
  };

  // Whole Sign houses from Lagna
  const lagnaSignIdx = lagna.signIndex;
  const houses = {};
  for (let i = 0; i < 12; i++) {
    houses[i + 1] = { sign: SIGNS[(lagnaSignIdx + i) % 12], planets: [] };
  }

  // Place planets in houses
  function getHouse(signIdx) {
    return ((signIdx - lagnaSignIdx + 12) % 12) + 1;
  }
  houses[getHouse(sun.signIndex)].planets.push('Sun');
  houses[getHouse(moon.signIndex)].planets.push('Moon');
  for (const [name, data] of Object.entries(planets)) {
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    houses[getHouse(data.signIndex)].planets.push(cap);
  }

  // Vimshottari Dasha
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
