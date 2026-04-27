const { getWeather } = require('../utils/weather');
const { getTravelPlan } = require('../utils/transit');
const db = require('../db');
const { ApiError } = require('../utils/errors');

async function handleRemoveClothes(uuid) {
	// Implement device removal logic here, e.g., remove from database
	console.log(`Handling device removal for UUID: ${uuid}`);
	const device = db.prepare('SELECT * FROM devices WHERE uuid = ?').get(uuid);

	if (!device) {
		console.warn(`Received message from unknown device: ${uuid}`);
		throw new ApiError(404, 'Device not found');
	}

	const travelPlan = await getTravelPlan(
		{ lat: device.origin_lat, lon: device.origin_lon },
		{ lat: device.dest_lat, lon: device.dest_lon },
	);
  const leaveHouseAt = transit?.leaveHouseAt
		? new Date(transit.leaveHouseAt)
		: null;
	const durationMinutes = transit.durationMinutes;
	const arrivalTime =
		leaveHouseAt && durationMinutes
			? new Date(leaveHouseAt.getTime() + durationMinutes * 60000)
			: null;

	const weather_origin = await getWeather(device.origin_lat, device.origin_lon);
	const weather_dest = await getWeather(device.dest_lat, device.dest_lon, arrivalTime);

	return {
		uuid: device.uuid,
		name: device.name,
		status: device.status,
		last_seen: device.last_seen,
		transit: travelPlan,
		// Weather will be added here by teammate
		weather: {
			origin: weather_origin,
			dest: weather_dest,
		},
	};
}

module.exports = {
	handleRemoveClothes,
};
