/**
 * Geocode a location string to lat/lng using OpenStreetMap Nominatim.
 * Also looks up the IANA timezone for the coordinates via BigDataCloud (free).
 * No API keys required for either service.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const TIMEZONE_URL = 'https://api.bigdatacloud.net/data/timezone-by-location';
const TIMEZONE_FALLBACK_URL = 'https://api.open-meteo.com/v1/forecast';
const USER_AGENT = 'TriSystemAstrologyApp/1.0';
const FETCH_TIMEOUT_MS = 5000;

// Nominatim often returns several hits for one town (a city node, its boundary,
// a suburb). Candidates closer than this to an already-kept one are the same place.
const SAME_PLACE_KM = 50;
const MAX_CANDIDATES = 5;

export interface GeocodeCandidate {
  lat: number;
  lng: number;
  displayName: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  timezone: string | null;
  /** Other distinct places the query also matched, best match first. Empty when unambiguous. */
  alternatives: GeocodeCandidate[];
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupTimezone(lat: number, lng: number): Promise<string | null> {
  try {
    const tzRes = await fetchWithTimeout(`${TIMEZONE_URL}?latitude=${lat}&longitude=${lng}`);
    if (tzRes.ok) {
      const tzData = await tzRes.json();
      if (typeof tzData.ianaTimeId === 'string' && tzData.ianaTimeId.length > 0) {
        return tzData.ianaTimeId;
      }
    }
  } catch (err) {
    console.error('Primary timezone lookup failed:', err);
  }

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      current: 'temperature_2m',
      timezone: 'auto',
    });
    const fallbackRes = await fetchWithTimeout(`${TIMEZONE_FALLBACK_URL}?${params}`);
    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json();
      if (typeof fallbackData.timezone === 'string' && fallbackData.timezone.length > 0) {
        return fallbackData.timezone;
      }
    }
  } catch (err) {
    console.error('Fallback timezone lookup failed:', err);
  }

  return null;
}

export async function geocode(locationText: string): Promise<GeocodeResult> {
  if (!locationText || !locationText.trim()) {
    throw new Error('Location is required');
  }
  const trimmed = locationText.trim();
  if (trimmed.length > 200) {
    throw new Error('Location text is too long');
  }

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    limit: String(MAX_CANDIDATES),
  });

  const res = await fetchWithTimeout(`${NOMINATIM_URL}?${params}`);

  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`);
  }

  const data = await res.json();

  if (!data.length) {
    throw new Error(`Location not found: "${trimmed}"`);
  }

  const rawLat = data[0]?.lat;
  const rawLng = data[0]?.lon;
  if (rawLat == null || rawLng == null) {
    throw new Error('Geocoding response missing coordinates');
  }
  const lat = parseFloat(rawLat);
  const lng = parseFloat(rawLng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude from geocoder: ${rawLat}`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error(`Invalid longitude from geocoder: ${rawLng}`);
  }

  const kept: GeocodeCandidate[] = [{ lat, lng, displayName: data[0].display_name }];
  for (const item of data.slice(1)) {
    const c = { lat: parseFloat(item?.lat), lng: parseFloat(item?.lon), displayName: item?.display_name };
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng) || typeof c.displayName !== 'string') continue;
    if (kept.some((k) => distanceKm(k, c) < SAME_PLACE_KM)) continue;
    kept.push(c);
  }

  const timezone = await lookupTimezone(lat, lng);

  return {
    lat,
    lng,
    displayName: data[0].display_name,
    timezone,
    alternatives: kept.slice(1),
  };
}
