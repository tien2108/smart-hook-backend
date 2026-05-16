const { ApiError } = require('./errors');

const NOAA_URL = 'https://services.swpc.noaa.gov/products';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

let auroraCache = { data: null, fetchedAt: null };
const weatherCache = new Map();
const inFlight = new Map();
const WEATHER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const WMO_CODES = {
	0: 'Clear sky',
	1: 'Mainly clear',
	2: 'Partly cloudy',
	3: 'Overcast',
	45: 'Fog',
	48: 'Icy fog',
	51: 'Light drizzle',
	53: 'Moderate drizzle',
	55: 'Dense drizzle',
	61: 'Slight rain',
	63: 'Moderate rain',
	65: 'Heavy rain',
	71: 'Slight snow',
	73: 'Moderate snow',
	75: 'Heavy snow',
	80: 'Slight showers',
	81: 'Moderate showers',
	82: 'Heavy showers',
	95: 'Thunderstorm',
	99: 'Thunderstorm with hail',
};

async function getAuroraData() {
	const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours
	if (auroraCache.data && Date.now() - auroraCache.fetchedAt < CACHE_TTL) {
		return auroraCache.data;
	}
	const res = await fetch(`${NOAA_URL}/noaa-planetary-k-index.json`);
	if (!res.ok) throw new ApiError(500, 'Failed to fetch aurora data');
	auroraCache = { data: await res.json(), fetchedAt: Date.now() };
	return auroraCache.data;
}

async function fetchWeather(lat, lon, arrivalTime) {
	const params = new URLSearchParams({
		latitude: lat,
		longitude: lon,
		current:
			'temperature_2m,relative_humidity_2m,wind_speed_10m,apparent_temperature,weather_code',
		hourly:
			'temperature_2m,relative_humidity_2m,wind_speed_10m,apparent_temperature,weather_code',
		timezone: 'auto',
		forecast_days: '1',
	});

	const [weatherRes, auroraBody] = await Promise.all([
		fetch(`${WEATHER_URL}?${params}`),
		getAuroraData(),
	]);

	if (!weatherRes.ok) {
		const error = await weatherRes.text();
		console.error('Weather API error:', error);
		throw new ApiError(500, 'Failed to fetch weather data');
	}

	const weatherBody = await weatherRes.json();

	if (weatherBody?.error) {
		console.error('Weather API error:', weatherBody);
		throw new ApiError(
			500,
			weatherBody.reason ?? 'Failed to fetch weather data',
		);
	}

	if (!weatherBody?.current) {
		throw new ApiError(500, 'Invalid weather data received');
	}

	const current = weatherBody.current;

	// 🌦️ default response = CURRENT
	let result = {
		temperature: current.temperature_2m,
		feels_like: current.apparent_temperature,
		humidity: current.relative_humidity_2m,
		wind_speed: current.wind_speed_10m,
		weather_description: WMO_CODES[current.weather_code] || 'Unknown',
	};

	// 🌦️ OVERRIDE if arrivalTime exists
	if (arrivalTime && weatherBody.hourly) {
		const {
			time,
			temperature_2m,
			relative_humidity_2m,
			wind_speed_10m,
			apparent_temperature,
			weather_code,
		} = weatherBody.hourly;

		let closestIndex = 0;
		let minDiff = Infinity;

		time.forEach((t, i) => {
			const diff = Math.abs(Date.parse(t) - arrivalTime.getTime());
			if (diff < minDiff) {
				minDiff = diff;
				closestIndex = i;
			}
		});

		result = {
			temperature: temperature_2m[closestIndex],
			feels_like: apparent_temperature[closestIndex],
			humidity: relative_humidity_2m[closestIndex],
			wind_speed: wind_speed_10m[closestIndex],
			weather_description: WMO_CODES[weather_code[closestIndex]] || 'Unknown',
			time: time[closestIndex],
		};
	}

	const latestKp = auroraBody
		.filter((entry) => entry.Kp !== null && entry.Kp !== undefined)
		.at(-1);

	const kpIndex = latestKp ? latestKp.Kp : 0;

	return {
		...result,
		aurora: {
			kp_index: kpIndex,
			visible: kpIndex >= 5,
			activity:
				kpIndex < 3
					? 'low'
					: kpIndex < 5
						? 'moderate'
						: kpIndex < 7
							? 'high'
							: 'extreme',
			measured_at: latestKp?.time_tag ?? null,
		},
	};
}

async function getWeather(lat, lon, arrivalTime = null) {
	const cacheKey = `${lat},${lon}`;

	// 1. Return cached data if fresh
	const cached = weatherCache.get(cacheKey);
	if (cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL) {
		return cached.data;
	}

	// 2. If already fetching for this key, share the same promise
	if (inFlight.has(cacheKey)) {
		return inFlight.get(cacheKey);
	}

	// 3. Fetch, cache the full result, then clean up in-flight
	const promise = fetchWeather(lat, lon, arrivalTime)
		.then((data) => {
			weatherCache.set(cacheKey, { data, fetchedAt: Date.now() });
			return data;
		})
		.finally(() => {
			inFlight.delete(cacheKey);
		});

	inFlight.set(cacheKey, promise);
	return promise;
}

module.exports = { getWeather };
