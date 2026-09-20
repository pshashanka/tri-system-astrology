import { describe, it, expect, afterEach } from 'vitest';
import { calculateChineseChart } from '../lib/chinese';

/**
 * Regression guard for server-timezone leakage.
 *
 * calculateChineseChart receives a Date whose UTC fields carry the birth
 * wall-clock time (see makeBirthDateTime). Reading it with the local getters
 * instead shifts every pillar by the server's own UTC offset, so the same
 * birth data yields different BaZi depending on where the process runs.
 *
 * The existing Zi-hour test only caught this on a machine that is not already
 * UTC; on a UTC CI runner it passes while the bug is live. These tests assert
 * the property directly.
 */

const ZI_HOUR_BIRTH = new Date('1990-05-15T23:30:00Z');
const AFTERNOON_BIRTH = new Date('1990-05-15T14:30:00Z');

const ZONES = ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati'];

const originalTz = process.env.TZ;
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

function pillarsUnder(tz: string, date: Date): string {
  process.env.TZ = tz;
  const { pillars } = calculateChineseChart(date, 1);
  return [pillars.year.full, pillars.month.full, pillars.day.full, pillars.hour.full].join(' / ');
}

describe('BaZi is independent of the server timezone', () => {
  it.each([
    ['Zi-hour birth', ZI_HOUR_BIRTH],
    ['afternoon birth', AFTERNOON_BIRTH],
  ])('%s yields identical pillars in every zone', (_label, date) => {
    const results = ZONES.map((tz) => [tz, pillarsUnder(tz, date)] as const);
    const [, expected] = results[0];
    for (const [tz, actual] of results) {
      expect(actual, `pillars under TZ=${tz}`).toBe(expected);
    }
  });

  it('reads the hour from the UTC fields, not the local ones', () => {
    // 23:30 UTC falls in the Zi hour (23:00-01:00), whose branch is Zi.
    for (const tz of ZONES) {
      process.env.TZ = tz;
      const chart = calculateChineseChart(ZI_HOUR_BIRTH, 1);
      expect(chart.pillars.hour.branch.pinyin, `hour branch under TZ=${tz}`).toBe('Zi');
    }
  });

  it('advances the day pillar for a late Zi-hour birth in every zone', () => {
    // sect 1: a 23:00-23:59 birth takes the following day's day pillar.
    for (const tz of ZONES) {
      expect(
        pillarsUnder(tz, ZI_HOUR_BIRTH).split(' / ')[2],
        `day pillar under TZ=${tz}`,
      ).not.toBe(pillarsUnder(tz, AFTERNOON_BIRTH).split(' / ')[2]);
    }
  });
});
