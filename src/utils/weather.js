const { ApiError } = require('./errors');
require('dotenv').config();

let auroraCache = { data: null, fetchedAt: null };
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
	const CACHE_TTL = 3 * 60 * 60 * 1000; // 15 minutes
	if (auroraCache.data && Date.now() - auroraCache.fetchedAt < CACHE_TTL) {
		return auroraCache.data;
	}
	const res = await fetch(
		`${process.env.NOAA_API_URL}/noaa-planetary-k-index.json`,
	);
	if (!res.ok) throw new ApiError(500, 'Failed to fetch aurora data');
	auroraCache = { data: await res.json(), fetchedAt: Date.now() };
	return auroraCache.data;
}

async function getWeather(lat, lon) {
	const weatherUrl = `${process.env.WEATHER_API_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,uv_index,visibility,cloud_cover,weather_code&daily=sunrise,sunset&timezone=auto&forecast_days=1`;

	const [weatherRes, auroraBody] = await Promise.all([
		fetch(weatherUrl),
		getAuroraData(),
	]);

	if (!weatherRes.ok) {
		const error = await weatherRes.text();
		console.error('Weather API error:', error);
		throw new ApiError(500, 'Failed to fetch weather data');
	}

	const weatherBody = await weatherRes.json();

	if (!weatherBody?.current) {
		throw new ApiError(500, 'Invalid weather data received');
	}
	console.log('NOAA raw response:', auroraBody.slice(-3)); // last 3 entries

	const latestKp = auroraBody
		.filter((entry) => entry.Kp !== null && entry.Kp !== undefined)
		.at(-1);

	const kpIndex = latestKp ? latestKp.Kp : 0;

	return {
		temperature: weatherBody.current.temperature_2m,
		humidity: weatherBody.current.relative_humidity_2m,
		wind_speed: weatherBody.current.wind_speed_10m,
		wind_direction: weatherBody.current.wind_direction_10m,
		precipitation: weatherBody.current.precipitation,
		uv_index: weatherBody.current.uv_index,
		visibility: weatherBody.current.visibility,
		cloud_cover: weatherBody.current.cloud_cover,
		weather_description:
			WMO_CODES[weatherBody.current.weather_code] || 'Unknown',
		sunrise: weatherBody.daily.sunrise[0],
		sunset: weatherBody.daily.sunset[0],
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
			measured_at: latestKp.time_tag,
		},
	};
}

module.exports = { getWeather };
