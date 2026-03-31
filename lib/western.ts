/**
 * Western (Tropical) Astrology Chart Calculator
 * Uses astronomy-engine for planetary positions.
 * Whole Sign houses, major+minor aspects, retrograde detection, MC.
 */

import * as Astronomy from 'astronomy-engine';

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

const ELEMENTS: Record<string, string> = {
  Aries: 'Fire', Taurus: 'Earth', Gemini: 'Air', Cancer: 'Water',
  Leo: 'Fire', Virgo: 'Earth', Libra: 'Air', Scorpio: 'Water',
  Sagittarius: 'Fire', Capricorn: 'Earth', Aquarius: 'Air', Pisces: 'Water',
};

const MODALITIES: Record<string, string> = {
  Aries: 'Cardinal', Taurus: 'Fixed', Gemini: 'Mutable', Cancer: 'Cardinal',
  Leo: 'Fixed', Virgo: 'Mutable', Libra: 'Cardinal', Scorpio: 'Fixed',
  Sagittarius: 'Mutable', Capricorn: 'Cardinal', Aquarius: 'Fixed', Pisces: 'Mutable',
};

const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;

interface AspectDef {
  name: string;
  angle: number;
  orb: number;
}

const ASPECT_DEFS: AspectDef[] = [
  { name: 'Conjunction', angle: 0, orb: 8 },
  { name: 'Semi-sextile', angle: 30, orb: 2 },
  { name: 'Sextile', angle: 60, orb: 6 },
  { name: 'Square', angle: 90, orb: 7 },
  { name: 'Trine', angle: 120, orb: 8 },
  { name: 'Quincunx', angle: 150, orb: 3 },
  { name: 'Opposition', angle: 180, orb: 8 },
];

interface SignInfo {
  sign: string;
  degree: number;
  longitude: number;
  element: string;
  modality: string;
}

interface PlanetInfo extends SignInfo {
  retrograde: boolean;
}

interface Aspect {
  planet1: string;
  planet2: string;
  aspect: string;
  angle: number;
  orb: number;
}

interface House {
  sign: string;
  planets: string[];
}

export interface WesternChart {
  system: string;
  ascendant: SignInfo;
  midheaven: SignInfo;
  sun: SignInfo;
  moon: SignInfo;
  northNode: SignInfo;
  planets: Record<string, PlanetInfo>;
  houses: Record<number, House>;
  aspects: Aspect[];
  elementBalance: Record<string, number>;
  modalityBalance: Record<string, number>;
}

function degToSign(deg: number): SignInfo {
  const normalized = ((deg % 360) + 360) % 360;
  const idx = Math.floor(normalized / 30);
  const within = normalized % 30;
  const sign = SIGNS[idx];
  return {
    sign,
    degree: Math.round(within * 100) / 100,
    longitude: Math.round(normalized * 100) / 100,
    element: ELEMENTS[sign],
    modality: MODALITIES[sign],
  };
}

function getPlanetLongitude(body: string, date: Date): number {
  if (body === 'Sun') {
    return Astronomy.SunPosition(date).elon;
  }
  const geo = Astronomy.GeoVector(body as Astronomy.Body, date, true);
  return Astronomy.Ecliptic(geo).elon;
}

/**
 * Detect retrograde by computing ecliptic longitude speed via small numerical delta.
 * Returns true if the planet is moving backward (negative speed in longitude).
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

function computeAngles(date: Date, lat: number, lng: number): { asc: number; mc: number } {
  const gmst = Astronomy.SiderealTime(date);
  const lst = ((gmst + lng / 15) % 24 + 24) % 24;
  const ramc = lst * 15;

  const time = Astronomy.MakeTime(date);
  const obliquity = Astronomy.e_tilt(time).tobl;

  const ramcRad = (ramc * Math.PI) / 180;
  const oblRad = (obliquity * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  // Ascendant
  let asc = Math.atan2(
    -Math.cos(ramcRad),
    Math.sin(ramcRad) * Math.cos(oblRad) + Math.tan(latRad) * Math.sin(oblRad)
  );
  asc = (asc * 180) / Math.PI;
  asc = ((asc % 360) + 360) % 360;

  // Midheaven (MC) — RAMC converted to ecliptic longitude
  let mc = Math.atan2(Math.sin(ramcRad), Math.cos(ramcRad) * Math.cos(oblRad));
  mc = (mc * 180) / Math.PI;
  mc = ((mc % 360) + 360) % 360;

  return { asc, mc };
}

function findAspects(bodies: Record<string, { longitude: number }>): Aspect[] {
  const aspects: Aspect[] = [];
  const keys = Object.keys(bodies);

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = bodies[keys[i]].longitude;
      const b = bodies[keys[j]].longitude;
      let diff = Math.abs(a - b);
      if (diff > 180) diff = 360 - diff;

      for (const asp of ASPECT_DEFS) {
        if (Math.abs(diff - asp.angle) <= asp.orb) {
          aspects.push({
            planet1: keys[i],
            planet2: keys[j],
            aspect: asp.name,
            angle: Math.round(diff * 100) / 100,
            orb: Math.round(Math.abs(diff - asp.angle) * 100) / 100,
          });
          break;
        }
      }
    }
  }

  return aspects;
}

/**
 * Mean North Node (Ω) via Meeus Ch. 47 polynomial.
 * Returns ecliptic longitude in degrees [0, 360).
 */
function getMeanNorthNode(date: Date): number {
  const jd = 2440587.5 + date.getTime() / 86400000;
  const T = (jd - 2451545.0) / 36525.0;
  let omega = 125.0445479
    - 1934.1362891 * T
    + 0.0020754 * T * T
    + (T * T * T) / 467441.0
    - (T * T * T * T) / 60616000.0;
  return ((omega % 360) + 360) % 360;
}

function computeHouses(ascDeg: number): { houses: Record<number, House>; ascSign: number } {
  const ascSign = Math.floor(((ascDeg % 360 + 360) % 360) / 30);
  const houses: Record<number, House> = {};
  for (let i = 0; i < 12; i++) {
    houses[i + 1] = { sign: SIGNS[(ascSign + i) % 12], planets: [] };
  }
  return { houses, ascSign };
}

export function calculateWesternChart(date: Date, lat: number, lng: number): WesternChart {
  const { asc: ascDeg, mc: mcDeg } = computeAngles(date, lat, lng);
  const ascInfo = degToSign(ascDeg);
  const mcInfo = degToSign(mcDeg);

  const sun = degToSign(getPlanetLongitude('Sun', date));
  const moon = degToSign(getPlanetLongitude('Moon', date));
  const northNode = degToSign(getMeanNorthNode(date));

  const planets: Record<string, PlanetInfo> = {};
  for (const name of PLANETS) {
    const info = degToSign(getPlanetLongitude(name, date));
    planets[name.toLowerCase()] = {
      ...info,
      retrograde: isRetrograde(name, date),
    };
  }

  // Build all bodies map for aspects (Sun, Moon, North Node, and all planets)
  const allBodies: Record<string, { longitude: number }> = {
    sun: { longitude: sun.longitude },
    moon: { longitude: moon.longitude },
    'north node': { longitude: northNode.longitude },
  };
  for (const [k, v] of Object.entries(planets)) {
    allBodies[k] = { longitude: v.longitude };
  }

  const aspects = findAspects(allBodies);

  // Whole Sign houses
  const { houses } = computeHouses(ascDeg);

  // Place planets in houses
  const ascSignIdx = Math.floor(((ascDeg % 360 + 360) % 360) / 30);
  function getHouse(longitude: number): number {
    const signIdx = Math.floor(((longitude % 360 + 360) % 360) / 30);
    return ((signIdx - ascSignIdx + 12) % 12) + 1;
  }

  houses[getHouse(sun.longitude)].planets.push('Sun');
  houses[getHouse(moon.longitude)].planets.push('Moon');
  houses[getHouse(northNode.longitude)].planets.push('North Node');
  for (const [name, data] of Object.entries(planets)) {
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    houses[getHouse(data.longitude)].planets.push(cap);
  }

  // Element & modality balance across Sun, Moon, Ascendant, MC, and all planets
  const elementBalance: Record<string, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalityBalance: Record<string, number> = { Cardinal: 0, Fixed: 0, Mutable: 0 };

  const allPlacements = [sun, moon, ascInfo, mcInfo, ...Object.values(planets)];
  for (const p of allPlacements) {
    elementBalance[p.element]++;
    modalityBalance[p.modality]++;
  }

  return {
    system: 'Western (Tropical)',
    ascendant: ascInfo,
    midheaven: mcInfo,
    sun,
    moon,
    northNode,
    planets,
    houses,
    aspects,
    elementBalance,
    modalityBalance,
  };
}
