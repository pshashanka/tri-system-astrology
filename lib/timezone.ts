/**
 * Timezone utilities — converts naive local date+time strings to UTC Dates.
 * Shared by API endpoints and MCP server.
 */

export interface BirthDateTimeResult {
  /** UTC Date for astronomical calculations (Western, Vedic) */
  utcDate: Date;
  /** Local Date for calendar-based calculations (Chinese BaZi) */
  localDate: Date;
  /** True if timezone conversion succeeded; false means times are treated as UTC */
  timezoneResolved: boolean;
}

/**
 * Convert a naive local date+time string to both UTC and local Date objects.
 *
 * Western/Vedic charts need the UTC instant for astronomical positions.
 * Chinese BaZi needs the wall-clock local time for hour/day pillar.
 */
export function makeBirthDateTime(
  dateStr: string,
  timeStr: string,
  ianaTimezone: string | null
): BirthDateTimeResult {
  // Build a Date that represents the local wall-clock time
  // (parsed as if UTC so the numeric fields match user input)
  const localDate = new Date(`${dateStr}T${timeStr}:00Z`);

  if (!ianaTimezone) {
    return { utcDate: localDate, localDate, timezoneResolved: false };
  }

  try {
    const tzPart = new Intl.DateTimeFormat('en', {
      timeZone: ianaTimezone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(localDate)
      .find((p) => p.type === 'timeZoneName')?.value;

    if (!tzPart) {
      return { utcDate: localDate, localDate, timezoneResolved: false };
    }

    const m = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) {
      return { utcDate: localDate, localDate, timezoneResolved: false };
    }

    const sign = m[1] === '+' ? 1 : -1;
    const offsetMs = sign * (parseInt(m[2]) * 60 + parseInt(m[3] || '0')) * 60_000;
    const utcDate = new Date(localDate.getTime() - offsetMs);

    return { utcDate, localDate, timezoneResolved: true };
  } catch {
    return { utcDate: localDate, localDate, timezoneResolved: false };
  }
}
