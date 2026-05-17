const express = require('express');
const db = require('../db');
const { ApiError } = require('../utils/errors');
const { getTravelPlan } = require('../utils/transit');
const { getWeather } = require('../utils/weather');
const { geocode } = require('../utils/geocode');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Helper: verify the device belongs to the requesting user
async function assertOwnership(deviceId, userId, next) {
	const link = await db
		.prepare('SELECT id FROM user_device WHERE device_id = ? AND user_id = ?')
		.get(deviceId, userId);
	if (!link) {
		next(new ApiError(403, 'Device not found or access denied'));
		return false;
	}
	return true;
}

// PATCH /api/device/v1/:id/location — set origin/destination by address
router.patch('/v1/:id/location', async (req, res, next) => {
	const { id } = req.params;
	const { origin_address, dest_address } = req.body;

	if (!origin_address && !dest_address) {
		return next(
			new ApiError(
				400,
				'At least one of origin_address or dest_address is required',
			),
		);
	}

	try {
		const device = await db
			.prepare('SELECT id FROM devices WHERE id = ?')
			.get(id);
		if (!device) {
			return next(new ApiError(404, 'Device not found'));
		}

		const updates = {};

		if (origin_address) {
			const origin = await geocode(origin_address);
			updates.origin_lat = origin.latitude;
			updates.origin_lon = origin.longitude;
		}

		if (dest_address) {
			const dest = await geocode(dest_address);
			updates.dest_lat = dest.latitude;
			updates.dest_lon = dest.longitude;
		}

		// Build dynamic UPDATE query
		const setClauses = Object.keys(updates)
			.map((key) => `${key} = ?`)
			.join(', ');
		const values = Object.values(updates);

		await db
			.prepare(`UPDATE devices SET ${setClauses} WHERE id = ?`)
			.run(...values, id);

		res.json({
			message: 'Device location updated',
			coordinates: updates,
		});
	} catch (error) {
		next(
			error instanceof ApiError
				? error
				: new ApiError(500, 'Error updating device location'),
		);
	}
});

// Add device to database endpoint
router.post('/v1/add-device', requireAuth, async (req, res, next) => {
	const { uuid, name, deviceLocation, destLocation } = req.body;

	if (!uuid || !name || !deviceLocation) {
		return next(new ApiError(400, 'UUID, name, device location are required'));
	}

	console.log(
		`Adding device: ${uuid}, ${name}, ${deviceLocation}, ${destLocation}`,
	);

	try {
		const existing = await db
			.prepare('SELECT id FROM devices WHERE uuid = ?')
			.get(uuid);
		if (existing) {
			return next(new ApiError(409, 'Device with this UUID already exists'));
		}

		const updates = {
			uuid: uuid,
			name: name,
			origin: deviceLocation,
			dest: destLocation,
		};

		const origin = await geocode(deviceLocation);
		updates.origin_lat = origin.latitude;
		updates.origin_lon = origin.longitude;

		let dest = {};
		if (destLocation) {
			dest = await geocode(destLocation);
			updates.dest_lat = dest.latitude;
			updates.dest_lon = dest.longitude;
		} else {
			const { dest_address } = await db
				.prepare(`SELECT dest_address FROM users WHERE id = ?`)
				.get(req.user.id);
			updates.dest = dest_address;
			updates.dest_lat = req.user.dest_lat;
			updates.dest_lon = req.user.dest_lon;
		}

		// Build INSERT query dynamically
		const keys = Object.keys(updates);
		const placeholders = keys.map(() => '?').join(', ');
		const values = Object.values(updates);
		console.log(
			'INSERT values:',
			values.map((v) => `${typeof v}: ${v}`),
		);

		const query = `
    INSERT INTO devices (${keys.join(', ')})
    VALUES (${placeholders})
`;

		await db.prepare(query).run(...values);

		const addedDevice = await db
			.prepare('SELECT * FROM devices WHERE uuid = ?')
			.get(uuid);
		console.log('Added successfully');

		await db
			.prepare(`INSERT INTO user_device (device_id, user_id) VALUES (?, ?)`)
			.run(addedDevice.id, req.user.id);

		await db
			.prepare(
				'INSERT INTO device_log (device_id, device_name, user_id, action) VALUES (?, ?, ?, ?)',
			)
			.run(addedDevice.id, addedDevice.name, req.user.id, `Add device`);

		res.json(addedDevice);
	} catch (error) {
		console.error('Error adding:', error);
		return next(new ApiError(500, 'Error adding device'));
	}
});

router.get('/v1/devices', requireAuth, async (req, res, next) => {
	const devices = await db
		.prepare(
			`
    SELECT d.* FROM devices d
    JOIN user_device ud ON ud.device_id = d.id
    WHERE ud.user_id = ?
  `,
		)
		.all(req.user.id);

	res.json({ devices });
});
router.delete('/v1/:id', requireAuth, async (req, res, next) => {
	const { id } = req.params;

	try {
		const device = await db
			.prepare('SELECT id,name FROM devices WHERE id = ?')
			.get(id);
		if (!device) {
			return next(new ApiError(404, 'Device not found'));
		}

		if (!(await assertOwnership(id, req.user.id, next)))
			return next(new ApiError(401, 'Acess denied'));

		const result = await db.prepare('DELETE FROM devices WHERE id = ?').run(id);
		if (result.changes === 0) {
			return next(new ApiError(404, 'Device not found'));
		}

		await db
			.prepare(
				'INSERT INTO device_log (device_id,device_name, user_id, action) VALUES (?, ?, ?, ?)',
			)
			.run(device.id, device.name, req.user.id, `Remove device`);

		console.log(`Deleted device with id: ${id}`);
		res.json(device);
	} catch (error) {
		return next(new ApiError(500, 'Error deleting device'));
	}
});

// Update device data
router.post('/v1/:id', requireAuth, async (req, res, next) => {
	const { id } = req.params;
	const { name, deviceLocation, destLocation } = req.body;

	try {
		const device = await db
			.prepare('SELECT id,name FROM devices WHERE id = ?')
			.get(id);

		if (!(await assertOwnership(id, req.user.id, next)))
			return next(new ApiError(401, 'Acess denied'));

		if (!device) {
			return next(new ApiError(404, 'Device not found'));
		}
		const updates = {
			uuid: uuid,
			name: name,
			origin: deviceLocation,
			dest: destLocation,
		};

		const origin = await geocode(deviceLocation);
		updates.origin_lat = origin.latitude;
		updates.origin_lon = origin.longitude;

		const dest = await geocode(destLocation);
		updates.dest_lat = dest.latitude;
		updates.dest_lon = dest.longitude;

		const keys = Object.keys(updates);

		// "uuid = ?, name = ?, ..."
		const setClause = keys.map((key) => `${key} = ?`).join(', ');

		const values = Object.values(updates);

		const query = `
    UPDATE devices
    SET ${setClause}
    WHERE id = ?
`;

		const result = await db.prepare(query).run(...values, id);
		const updatedDevice = await db
			.prepare('SELECT id FROM devices WHERE id = ?')
			.get(id);

		await db
			.prepare(
				'INSERT INTO device_log (device_id, device_name, user_id, action) VALUES (?, ?, ?, ?)',
			)
			.run(device.id, device.name, req.user.id, `Update device`);

		console.log(`Updated device with id: ${id}`);
		res.json(updatedDevice);
	} catch (error) {
		return next(new ApiError(500, 'Error updating device'));
	}
});

// GET /api/device/v1/status/:uuid — unified status for hardware (ESP32)
router.get('/v1/status/:id', async (req, res, next) => {
	const { id } = req.params;
	try {
		const device = await db
			.prepare('SELECT * FROM devices WHERE id = ?')
			.get(id);
		if (!device) {
			throw new ApiError(404, 'Device not found');
		}

		let transit = null;

		// Only fetch transit if coordinates are set
		if (
			device.origin_lat &&
			device.origin_lon &&
			device.dest_lat &&
			device.dest_lon
		) {
			try {
				transit = await getTravelPlan(
					{ lat: device.origin_lat, lon: device.origin_lon },
					{ lat: device.dest_lat, lon: device.dest_lon },
				);
			} catch (err) {
				console.error('Transit fetch failed:', err.message);
				// We don't fail the whole request if transit fails
			}
		}

		const weather_origin = await getWeather(
			device.origin_lat,
			device.origin_lon,
		);

		const leaveHouseAt = transit?.leaveHouseAt
			? new Date(transit.leaveHouseAt)
			: null;
		const durationMinutes = transit.durationMinutes;
		const arrivalTime =
			leaveHouseAt && durationMinutes
				? new Date(leaveHouseAt.getTime() + durationMinutes * 60000)
				: null;

		const weather_arrival = await getWeather(
			device.dest_lat,
			device.dest_lon,
			arrivalTime,
		);

		res.json({
			uuid: device.uuid,
			name: device.name,
			status: device.status,
			last_seen: device.last_seen,
			transit: transit,
			// Weather will be added here by teammate
			weather: {
				origin: weather_origin,
				arrival: weather_arrival,
			},
		});
	} catch (error) {
		next(error);
	}
});

router.get('/v1/device/:id/weather/origin', async (req, res, next) => {
	const { id } = req.params;

	try {
		const device = await db
			.prepare('SELECT origin_lat, origin_lon FROM devices WHERE id = ?')
			.get(id);
		if (!device) {
			return next(new ApiError(404, 'Device not found'));
		}

		// Placeholder for weather data logic - replace with actual weather API call
		const weatherData = await getWeather(device.origin_lat, device.origin_lon);

		res.json({ device, weatherData });
	} catch (error) {
		return next(
			error instanceof ApiError
				? error
				: new ApiError(500, 'Error fetching device weather data'),
		);
	}
});

router.get('/v1/device/:id/weather/destination', async (req, res, next) => {
	const { id } = req.params;

	try {
		const device = await db
			.prepare(
				'SELECT destination_lat, destination_lon FROM devices WHERE id = ?',
			)
			.get(id);
		if (!device) {
			return next(new ApiError(404, 'Device not found'));
		}

		// Placeholder for weather data logic - replace with actual weather API call
		const weatherData = await getWeather(
			device.destination_lat,
			device.destination_lon,
		);

		res.json({ device, weatherData });
	} catch (error) {
		return next(
			error instanceof ApiError
				? error
				: new ApiError(500, 'Error fetching device weather data'),
		);
	}
});

module.exports = router;
