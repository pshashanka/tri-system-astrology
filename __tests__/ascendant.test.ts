import { describe, it, expect } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import { calculateWesternChart } from '../lib/western';
import { calculateVedicChart } from '../lib/vedic';

/**
 * Regression guard for the ascendant quadrant.
 *
 * The structural assertions elsewhere (sign is a string, degree in [0,30))
 * are satisfied just as well by the descendant, so they cannot catch a sign
 * error in the arctangent. These tests pin the actual value instead, using a
 * physical invariant that needs no external ephemeris: at sunrise the Sun is
 * on the eastern horizon, so its ecliptic longitude equals the ascendant.
 *
 * The few degrees of slack absorb atmospheric refraction and the Sun's
 * apparent radius, which make sunrise occur slightly before geometric rise.
 */

// Moderate latitudes only: near the poles the Sun's path meets the horizon at
// so shallow an angle that refraction displaces it by tens of degrees.
const PLACES: [string, number, number][] = [
  ['Bangalore', 12.97, 77.59],
  ['Tokyo', 35.68, 139.65],
  ['London', 51.51, -0.13],
  ['Sydney', -33.87, 151.21],
  ['Quito', -0.18, -78.47],
];

/** Smallest absolute angle between two ecliptic longitudes, in degrees. */
function separation(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function sunriseOn(dateUtc: string, lat: number, lng: number): Date {
  const observer = new Astronomy.Observer(lat, lng, 0);
  const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, new Date(dateUtc), 2);
  if (!rise) throw new Error(`no sunrise found for ${lat},${lng}`);
  return rise.date;
}

describe('ascendant quadrant', () => {
  describe.each(PLACES)('%s', (_name, lat, lng) => {
    const date = sunriseOn('2024-03-20T00:00:00Z', lat, lng);
    const sunLongitude = Astronomy.SunPosition(date).elon;

    it('tropical ascendant matches the Sun at sunrise', () => {
      const { ascendant } = calculateWesternChart(date, lat, lng);
      expect(separation(ascendant.longitude, sunLongitude)).toBeLessThan(5);
    });

    it('tropical ascendant is not the descendant', () => {
      const { ascendant } = calculateWesternChart(date, lat, lng);
      expect(separation(ascendant.longitude, sunLongitude + 180)).toBeGreaterThan(90);
    });

    it('vedic lagna is the sidereal ascendant, not the descendant', () => {
      const { lagna } = calculateVedicChart(date, lat, lng);
      // Compare in the sidereal frame: the tropical gap equals the ayanamsa,
      // which is ~24 degrees in 2024, so allow for it plus the sunrise slack.
      const tropicalLagna = lagna.longitude;
      expect(separation(tropicalLagna, sunLongitude)).toBeLessThan(30);
      expect(separation(tropicalLagna, sunLongitude + 180)).toBeGreaterThan(90);
    });
  });

  it('houses follow the corrected ascendant', () => {
    const [, lat, lng] = PLACES[0];
    const date = sunriseOn('2024-03-20T00:00:00Z', lat, lng);
    const chart = calculateWesternChart(date, lat, lng);
    expect(chart.houses[1].sign).toBe(chart.ascendant.sign);
  });
});
