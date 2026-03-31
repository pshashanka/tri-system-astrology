/**
 * Western (Tropical) Astrology Chart Calculator
 * Uses astronomy-engine for planetary positions.
 * Whole Sign houses, major aspects.
 */

import * as Astronomy from 'astronomy-engine';

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;

interface AspectDef {
  name: string;
  angle: number;
  orb: number;
}

const ASPECT_DEFS: AspectDef[] = [
  { name: 'Conjunction', angle: 0, orb: 8 },
  { name: 'Sextile', angle: 60, orb: 6 },
  { name: 'Square', angle: 90, orb: 7 },
  { name: 'Trine', angle: 120, orb: 8 },
  { name: 'Opposition', angle: 180, orb: 8 },
];

interface SignInfo {
  sign: string;
  degree: number;
  longitude: number;
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
  sun: SignInfo;
  moon: SignInfo;
  planets: Record<string, SignInfo>;
  houses: Record<number, House>;
  aspects: Aspect[];
}

function degToSign(deg: number): SignInfo {
  const normalized = ((deg % 360) + 360) % 360;
  const idx = Math.floor(normalized / 30);
  const within = normalized % 30;
  return { sign: SIGNS[idx], degree: Math.round(within * 100) / 100, longitude: Math.round(normalized * 100) / 100 };
}

function getPlanetLongitude(body: string, date: Date): number {
  if (body === 'Sun') {
    return Astronomy.SunPosition(date).elon;
  }
  return Astronomy.EclipticLongitude(body as Astronomy.Body, date);
}

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
  asc = ((asc % 360) + 360) % 360;

  return asc;
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

function computeHouses(ascDeg: number): { houses: Record<number, House>; ascSign: number } {
  const ascSign = Math.floor(((ascDeg % 360 + 360) % 360) / 30);
  const houses: Record<number, House> = {};
  for (let i = 0; i < 12; i++) {
    houses[i + 1] = { sign: SIGNS[(ascSign + i) % 12], planets: [] };
  }
  return { houses, ascSign };
}

export function calculateWesternChart(date: Date, lat: number, lng: number): WesternChart {
  const ascDeg = computeAscendant(date, lat, lng);
  const ascInfo = degToSign(ascDeg);

  const sun = degToSign(getPlanetLongitude('Sun', date));
  const moon = degToSign(getPlanetLongitude('Moon', date));

  const planets: Record<string, SignInfo> = {};
  for (const name of PLANETS) {
    planets[name.toLowerCase()] = degToSign(getPlanetLongitude(name, date));
  }

  // Build all bodies map for aspects
  const allBodies: Record<string, { longitude: number }> = {
    sun: { longitude: sun.longitude },
    moon: { longitude: moon.longitude },
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
  for (const [name, data] of Object.entries(planets)) {
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    houses[getHouse(data.longitude)].planets.push(cap);
  }

  return {
    system: 'Western (Tropical)',
    ascendant: ascInfo,
    sun,
    moon,
    planets,
    houses,
    aspects,
  };
}
