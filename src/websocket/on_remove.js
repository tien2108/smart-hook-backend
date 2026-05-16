const { getWeather } = require('../utils/weather');
const { getTravelPlan } = require('../utils/transit');
const db = require('../db');
const { ApiError } = require('../utils/errors');

async function onRemoveClothes(uuid) {
	// Implement device removal logic here, e.g., remove from database
	console.log(`Handling device removal for UUID: ${uuid}`);
	const device = await db
		.prepare('SELECT * FROM devices WHERE uuid = ?')
		.get(uuid);

	if (!device) {
		console.warn(`Received message from unknown device: ${uuid}`);
		throw new ApiError(404, 'Device not found');
	}

	const travelPlan = await getTravelPlan(
		{ lat: device.origin_lat, lon: device.origin_lon },
		{ lat: device.dest_lat, lon: device.dest_lon },
	);
	const leaveHouseAt = travelPlan?.leaveHouseAt
		? new Date(travelPlan.leaveHouseAt)
		: null;
	const durationMinutes = travelPlan.durationMinutes;
	const arrivalTime =
		leaveHouseAt && durationMinutes
			? new Date(leaveHouseAt.getTime() + durationMinutes * 60000)
			: null;

	const weather_origin = await getWeather(device.origin_lat, device.origin_lon);
	const weather_dest = await getWeather(
		device.dest_lat,
		device.dest_lon,
		arrivalTime,
	);

	await db
		.prepare(
			'INSERT INTO device_log (device_id, device_name, user_id, action) VALUES (?, ?, ?, ?)',
		)
		.run(device.id, device.name, device.user_id, `Clothes removed`);

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
	onRemoveClothes,
};
