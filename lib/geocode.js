/**
 * Geocode a location string to lat/lng using OpenStreetMap Nominatim.
 * Free, no API key required. Must include User-Agent per Nominatim policy.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
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

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}
