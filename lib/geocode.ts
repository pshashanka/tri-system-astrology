/**
 * Geocode a location string to lat/lng using OpenStreetMap Nominatim.
 * Also looks up the IANA timezone for the coordinates via BigDataCloud (free).
 * No API keys required for either service.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const TIMEZONE_URL = 'https://api.bigdatacloud.net/data/timezone-by-location';
const USER_AGENT = 'TriSystemAstrologyApp/1.0';
const FETCH_TIMEOUT_MS = 5000;

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  timezone: string | null;
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
    limit: '1',
  });

  const geoController = new AbortController();
  const geoTimeout = setTimeout(() => geoController.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: geoController.signal,
    });
  } finally {
    clearTimeout(geoTimeout);
  }

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

  let timezone: string | null = null;
  try {
    const tzController = new AbortController();
    const tzTimeout = setTimeout(() => tzController.abort(), FETCH_TIMEOUT_MS);
    let tzRes: Response;
    try {
      tzRes = await fetch(`${TIMEZONE_URL}?latitude=${lat}&longitude=${lng}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: tzController.signal,
      });
    } finally {
      clearTimeout(tzTimeout);
    }
    if (tzRes.ok) {
      const tzData = await tzRes.json();
      if (typeof tzData.ianaTimeId === 'string' && tzData.ianaTimeId.length > 0) {
        timezone = tzData.ianaTimeId;
      }
    }
  } catch (err) {
    console.error('Timezone lookup failed:', err);
  }

  return {
    lat,
    lng,
    displayName: data[0].display_name,
    timezone,
  };
}
