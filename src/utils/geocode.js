const { ApiError } = require('./errors');

// ── Cache & rate-limit state ─────────────────────────────────────────────────
const geocodeCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours — addresses rarely move
let lastRequestAt = 0;

async function fetchFromPhoton(address) {
	const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
	const res = await fetch(url, {
		headers: { 'User-Agent': 'SmartHookBackend/1.0' },
	});
	if (!res.ok) throw new Error(`Photon ${res.status}`);
	const data = await res.json();
	if (!data?.features?.length) throw new Error('No results');
	return {
		latitude: data.features[0].geometry.coordinates[1],
		longitude: data.features[0].geometry.coordinates[0],
	};
}

async function fetchFromNominatim(address) {
	const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
	const res = await fetch(url, {
		headers: { 'User-Agent': 'SmartHookBackend/1.0' },
	});
	if (!res.ok) throw new Error(`Nominatim ${res.status}`);
	const data = await res.json();
	if (!data?.length) throw new Error('No results');
	return {
		latitude: parseFloat(data[0].lat),
		longitude: parseFloat(data[0].lon),
	};
}

/**
 * Converts an address string to latitude and longitude using OpenStreetMap Nominatim.
 * Results are cached for 24 hours. Requests are throttled to 1/sec per Nominatim policy.
 * @param {string} address - The address to geocode
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
async function geocode(address) {
	if (!address || typeof address !== 'string') {
		throw new ApiError(400, 'Address is required for geocoding');
	}

	const cacheKey = address.trim().toLowerCase();

	// ── Check cache ──────────────────────────────────────────────────────────
	const cached = geocodeCache.get(cacheKey);
	if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
		return cached.result;
	}

	// ── Rate-limit: wait if needed to respect 1 req/sec ──────────────────────
	const elapsed = Date.now() - lastRequestAt;
	if (elapsed < 1000) {
		await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
	}

	try {
		let result;
		try {
			result = await fetchFromPhoton(address);
		} catch (err) {
			console.warn('Photon failed, falling back to Nominatim:', err.message);
			try {
				result = await fetchFromNominatim(address);
			} catch (err) {
				console.error('Nominatim also failed:', err.message);
				throw new ApiError(500, 'Geocoding service unavailable');
			}
		}

		lastRequestAt = Date.now();
		geocodeCache.set(cacheKey, { result, fetchedAt: Date.now() });
		return result;
	} catch (error) {
		if (error instanceof ApiError) throw error;
		console.error('Geocoding error:', error);
		throw new ApiError(500, 'Geocoding service unavailable');
	}
}

module.exports = { geocode };
