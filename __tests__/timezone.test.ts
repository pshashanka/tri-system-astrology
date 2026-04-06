import { describe, it, expect } from 'vitest';
import { makeBirthDateTime } from '../lib/timezone';

describe('makeBirthDateTime', () => {
  describe('without timezone', () => {
    it('treats input as UTC when timezone is null', () => {
      const result = makeBirthDateTime('1990-05-15', '14:30', null);
      expect(result.timezoneResolved).toBe(false);
      expect(result.utcDate.toISOString()).toBe('1990-05-15T14:30:00.000Z');
      expect(result.localDate.toISOString()).toBe('1990-05-15T14:30:00.000Z');
    });

    it('utcDate and localDate are identical when no timezone', () => {
      const result = makeBirthDateTime('2000-01-01', '00:00', null);
      expect(result.utcDate.getTime()).toBe(result.localDate.getTime());
    });
  });

  describe('positive UTC offset (east)', () => {
    it('handles Asia/Kolkata (GMT+5:30)', () => {
      const result = makeBirthDateTime('1990-05-15', '14:30', 'Asia/Kolkata');
      expect(result.timezoneResolved).toBe(true);
      // Local 14:30 IST = 09:00 UTC
      expect(result.utcDate.getUTCHours()).toBe(9);
      expect(result.utcDate.getUTCMinutes()).toBe(0);
      // localDate keeps the wall-clock fields
      expect(result.localDate.getUTCHours()).toBe(14);
      expect(result.localDate.getUTCMinutes()).toBe(30);
    });

    it('handles Asia/Tokyo (GMT+9)', () => {
      const result = makeBirthDateTime('1990-05-15', '21:00', 'Asia/Tokyo');
      expect(result.timezoneResolved).toBe(true);
      // Local 21:00 JST = 12:00 UTC
      expect(result.utcDate.getUTCHours()).toBe(12);
      expect(result.utcDate.getUTCMinutes()).toBe(0);
    });
  });

  describe('negative UTC offset (west)', () => {
    it('handles America/New_York (EDT, GMT-4 in May)', () => {
      const result = makeBirthDateTime('1990-05-15', '14:30', 'America/New_York');
      expect(result.timezoneResolved).toBe(true);
      // Local 14:30 EDT = 18:30 UTC
      expect(result.utcDate.getUTCHours()).toBe(18);
      expect(result.utcDate.getUTCMinutes()).toBe(30);
    });

    it('handles America/Chicago (CDT, GMT-5 in May)', () => {
      const result = makeBirthDateTime('1990-05-15', '14:30', 'America/Chicago');
      expect(result.timezoneResolved).toBe(true);
      // Local 14:30 CDT = 19:30 UTC
      expect(result.utcDate.getUTCHours()).toBe(19);
      expect(result.utcDate.getUTCMinutes()).toBe(30);
    });
  });

  describe('DST vs standard time', () => {
    it('uses summer offset for summer date (America/New_York)', () => {
      const summer = makeBirthDateTime('2020-07-15', '12:00', 'America/New_York');
      // EDT = GMT-4 → 12:00 local = 16:00 UTC
      expect(summer.utcDate.getUTCHours()).toBe(16);
    });

    it('uses winter offset for winter date (America/New_York)', () => {
      const winter = makeBirthDateTime('2020-01-15', '12:00', 'America/New_York');
      // EST = GMT-5 → 12:00 local = 17:00 UTC
      expect(winter.utcDate.getUTCHours()).toBe(17);
    });

    it('summer and winter differ by 1 hour for DST timezone', () => {
      const summer = makeBirthDateTime('2020-07-15', '12:00', 'America/New_York');
      const winter = makeBirthDateTime('2020-01-15', '12:00', 'America/New_York');
      // Summer: UTC-4 → 16:00 UTC, Winter: UTC-5 → 17:00 UTC
      // Difference should be exactly 1 hour (winter UTC is later)
      expect(winter.utcDate.getUTCHours() - summer.utcDate.getUTCHours()).toBe(1);
    });
  });

  describe('date boundary crossing', () => {
    it('UTC date advances when late local time + negative offset', () => {
      // 23:00 EDT (GMT-4) → 03:00 UTC next day
      const result = makeBirthDateTime('1990-05-15', '23:00', 'America/New_York');
      expect(result.utcDate.getUTCDate()).toBe(16);
      expect(result.utcDate.getUTCHours()).toBe(3);
    });

    it('localDate stays on original date', () => {
      const result = makeBirthDateTime('1990-05-15', '23:00', 'America/New_York');
      expect(result.localDate.getUTCDate()).toBe(15);
      expect(result.localDate.getUTCHours()).toBe(23);
    });
  });

  describe('UTC timezone (no offset)', () => {
    it('UTC produces identical utcDate and localDate', () => {
      const result = makeBirthDateTime('2000-06-15', '10:00', 'UTC');
      // UTC offset is +0 — utcDate and localDate should be the same regardless of how resolved
      expect(result.utcDate.getTime()).toBe(result.localDate.getTime());
      expect(result.utcDate.getUTCHours()).toBe(10);
    });
  });

  describe('quarter-hour offset timezones', () => {
    it('handles Asia/Kathmandu (GMT+5:45)', () => {
      const result = makeBirthDateTime('2000-01-01', '12:00', 'Asia/Kathmandu');
      expect(result.timezoneResolved).toBe(true);
      // 12:00 local − 5:45 = 06:15 UTC
      expect(result.utcDate.getUTCHours()).toBe(6);
      expect(result.utcDate.getUTCMinutes()).toBe(15);
    });
  });

  describe('invalid timezone handling', () => {
    it('falls back gracefully for invalid timezone name', () => {
      const result = makeBirthDateTime('2000-01-01', '12:00', 'Invalid/Zone');
      expect(result.timezoneResolved).toBe(false);
      expect(result.utcDate.toISOString()).toBe('2000-01-01T12:00:00.000Z');
    });
  });
});
