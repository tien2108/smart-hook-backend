const { ApiError } = require('./errors');
require('dotenv').config();

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
if (!WEATHER_API_KEY) {
	console.warn('Warning: WEATHER_API_KEY not set in environment variables');
}

const WEATHER_API_URL = 'https://www.meteosource.com/v1/free/';

// Get weather data at given lat/lon using Open-Meteo API
async function getWeather(lat, lon) {
	const url = `${WEATHER_API_URL}point?lat=${lat}&lon=${lon}&units=metric&language=en&key=${WEATHER_API_KEY}`;


	const res = await fetch(url);
	if (!res.ok) {
		throw new ApiError(500, 'Failed to fetch weather data');
	}

	const body = await res.json();
	if (!body?.current) {
		throw new ApiError(500, 'Invalid weather data received');
	}

	return body.current;
}

module.exports = { getWeather };
