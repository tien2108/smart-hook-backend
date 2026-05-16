const { ApiError } = require('./errors');

const NOAA_URL = 'https://services.swpc.noaa.gov/products';
const WEATHER_URL = 'https://api.openweathermap.org/data/2.5';

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
	const apiKey = process.env.OPENWEATHER_API_KEY;

	const [currentRes, forecastRes, auroraBody] = await Promise.all([
		fetch(
			`${WEATHER_URL}/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
		),
		fetch(
			`${WEATHER_URL}/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
		),
		getAuroraData(),
	]);

	if (!currentRes.ok || !forecastRes.ok) {
		console.log('Weather API error:', {
			currentStatus: currentRes.status,
			forecastStatus: forecastRes.status,
		});
		throw new ApiError(500, 'Failed to fetch weather data');
	}

	const [current, forecast] = await Promise.all([
		currentRes.json(),
		forecastRes.json(),
	]);

	// 🌦️ default = current conditions
	let result = {
		temperature: current.main.temp,
		feels_like: current.main.feels_like,
		humidity: current.main.humidity,
		wind_speed: current.wind.speed,
		weather_description: current.weather[0].description,
	};

	// 🌦️ OVERRIDE if arrivalTime exists — find closest forecast slot
	if (arrivalTime && forecast.list?.length) {
		let closestIndex = 0;
		let minDiff = Infinity;

		forecast.list.forEach((entry, i) => {
			const diff = Math.abs(entry.dt * 1000 - arrivalTime.getTime());
			if (diff < minDiff) {
				minDiff = diff;
				closestIndex = i;
			}
		});

		const slot = forecast.list[closestIndex];
		result = {
			temperature: slot.main.temp,
			feels_like: slot.main.feels_like,
			humidity: slot.main.humidity,
			wind_speed: slot.wind.speed,
			weather_description: slot.weather[0].description,
			time: slot.dt_txt,
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
