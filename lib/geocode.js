/**
 * Geocode a location string to lat/lng using OpenStreetMap Nominatim.
 * Also looks up the IANA timezone for the coordinates via BigDataCloud (free).
 * No API keys required for either service.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const TIMEZONE_URL = 'https://api.bigdatacloud.net/data/timezone-by-location';
const USER_AGENT = 'TriSystemAstrologyApp/1.0';

export async function geocode(locationText) {
  if (!locationText || !locationText.trim()) {
    throw new Error('Location is required');
  }

  const params = new URLSearchParams({
    q: locationText.trim(),
    format: 'json',
    limit: '1',
  });

  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`);
  }

  const data = await res.json();

  if (!data.length) {
    throw new Error(`Location not found: "${locationText}"`);
  }

  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);

  // Look up IANA timezone — non-critical, falls back to UTC on failure
  let timezone = null;
  try {
    const tzRes = await fetch(`${TIMEZONE_URL}?latitude=${lat}&longitude=${lng}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (tzRes.ok) {
      const tzData = await tzRes.json();
      timezone = tzData.ianaTimeId || null;
    }
  } catch {
    // fall through — timezone remains null, UTC will be used
  }

  return {
    lat,
    lng,
    displayName: data[0].display_name,
    timezone,
  };
}
