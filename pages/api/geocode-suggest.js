/**
 * GET /api/geocode-suggest?q=<query>
 * Returns up to 5 location suggestions from Nominatim for autocomplete.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'TriSystemAstrologyApp/1.0';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) {
    return res.status(200).json([]);
  }

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '5',
    addressdetails: '1',
  });

  try {
    const resp = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!resp.ok) {
      return res.status(502).json({ error: 'Geocoding service unavailable' });
    }

    const data = await resp.json();

    const suggestions = data.map((item) => {
      const a = item.address || {};
      const parts = [
        a.city || a.town || a.village || a.county,
        a.state,
        a.country,
      ].filter(Boolean);
      return {
        label: parts.join(', ') || item.display_name,
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      };
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(suggestions);
  } catch (err) {
    console.error('Geocode suggest error:', err);
    return res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
}
