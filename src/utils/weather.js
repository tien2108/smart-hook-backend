const request = require('request');
const { ApiError } = require('./errors');

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
if (!WEATHER_API_KEY) {
	console.warn('Warning: WEATHER_API_KEY not set in environment variables');
}

const WEATHER_API_URL = 'https://www.meteosource.com/v1/free/';

// Get weather data at given lat/lon using Open-Meteo API
async function getWeather(lat, lon) {
	return new Promise((resolve, reject) => {
		const url = `${WEATHER_API_URL}point?lat=${lat}&lon=${lon}&unit=metric&language=en&current_weather=true&key=${WEATHER_API_KEY}`;
		request(url, { json: true }, (err, res, body) => {
			if (err) {
				console.error('Error fetching weather:', err);
				return reject(new ApiError(500, 'Failed to fetch weather data'));
			}
			if (res.statusCode !== 200) {
				console.error('Non-200 response:', res.statusCode, body);
				return reject(new ApiError(500, 'Failed to fetch weather data'));
			}
			if (!body || !body.current_weather) {
				console.error('Invalid response body:', body);
				return reject(new ApiError(500, 'Invalid weather data received'));
			}
			resolve(body.current_weather);
		});
	});
}

module.exports = { getWeather };
