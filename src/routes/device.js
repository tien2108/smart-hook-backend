const express = require('express');
const db = require('../db');
const { ApiError } = require('../utils/errors');
const { getTravelPlan } = require('../utils/transit');
const { getWeather } = require('../utils/weather');

const router = express.Router();

// Add device to database endpoint
router.post('/v1/add-device', (req, res, next) => {
	const { uuid, name, type } = req.body;

	if (!uuid || !name || !type) {
		return next(new ApiError(400, 'UUID, name, and type are required'));
	}

	console.log(`Adding device: ${uuid}, ${name}, ${type}`);

	try {
		const existing = db
			.prepare('SELECT id FROM devices WHERE uuid = ?')
			.get(uuid);
		if (existing) {
			return next(new ApiError(409, 'Device with this UUID already exists'));
		}

		db.prepare('INSERT INTO devices (uuid, name, type) VALUES (?, ?, ?)').run(
			uuid,
			name,
			type,
		);
		console.log('Added successfully');
		res.json({ message: 'Device added successfully' });
	} catch (error) {
		console.error('Error adding:', error);
		return next(new ApiError(500, 'Error adding device'));
	}
});

router.get('/v1/devices', (req, res, next) => {
	try {
		const devices = db.prepare('SELECT * FROM devices').all();

		console.log(`Fetched devices: ${JSON.stringify(devices)}`);

		res.json({ devices });
	} catch (error) {
		return next(new ApiError(500, 'Error fetching devices'));
	}
});

router.delete('/v1/device/:id', (req, res, next) => {
	const { id } = req.params;

	try {
		const result = db.prepare('DELETE FROM devices WHERE id = ?').run(id);
		if (result.changes === 0) {
			return next(new ApiError(404, 'Device not found'));
		}
		console.log(`Deleted device with id: ${id}`);
		res.json({ message: 'Device deleted successfully' });
	} catch (error) {
		return next(new ApiError(500, 'Error deleting device'));
	}
});

// GET /api/device/v1/status/:uuid — unified status for hardware (ESP32)
router.get('/v1/status/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    if (!device) {
      throw new ApiError(404, 'Device not found');
    }

    let transit = null;

    // Only fetch transit if coordinates are set
    if (device.origin_lat && device.origin_lon && device.dest_lat && device.dest_lon) {
      try {
        transit = await getTravelPlan(
          { lat: device.origin_lat, lon: device.origin_lon },
          { lat: device.dest_lat, lon: device.dest_lon }
        );
      } catch (err) {
        console.error('Transit fetch failed:', err.message);
        // We don't fail the whole request if transit fails
      }
    }

		const leaveHouseAt = transit?.leaveHouseAt ? new Date(transit.leaveHouseAt) : null;
		const durationMinutes = transit.durationMinutes;
		const arrivalTime = leaveHouseAt && durationMinutes ? new Date(leaveHouseAt.getTime() + durationMinutes * 60000) : null;

		weather = await getWeather(device.dest_lat, device.dest_lon, arrivalTime);

		res.json({
      uuid: device.uuid,
      name: device.name,
      status: device.status,
      last_seen: device.last_seen,
      transit: transit,
      // Weather will be added here by teammate
      weather: weather
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
router.get('/v1/device/:id/weather/origin', async (req, res, next) => {
	const { id } = req.params;

	try {
		const device = db.prepare('SELECT origin_lat, origin_lon FROM devices WHERE id = ?').get(id);
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
		const device = db
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
