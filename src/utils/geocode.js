const { ApiError } = require('./errors');

// ── Cache & rate-limit state ─────────────────────────────────────────────────
const geocodeCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours — addresses rarely move
let lastRequestAt = 0;

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
		const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
		const response = await fetch(url, {
			headers: { 'User-Agent': 'SmartHookBackend/1.0' },
		});

		if (!response.ok) {
			throw new ApiError(500, 'Geocoding service unavailable');
		}

		const data = await response.json();
		if (!data || data.length === 0) {
			throw new ApiError(404, 'Address not found');
		}

		const result = {
			latitude: data.features[0].geometry.coordinates[1],
			longitude: data.features[0].geometry.coordinates[0],
		};
		lastRequestAt = Date.now();
		// ── Store in cache ───────────────────────────────────────────────────
		geocodeCache.set(cacheKey, { result, fetchedAt: Date.now() });

		return result;
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		console.error('Geocoding error:', error);
		throw new ApiError(500, 'Error occurred during geocoding');
	}
}

module.exports = { geocode };
