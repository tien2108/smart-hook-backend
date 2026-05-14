const express = require('express');
const db = require('../db');
const { ApiError } = require('../utils/errors');
const { getTravelPlan } = require('../utils/transit');
const { getWeather } = require('../utils/weather');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/weather', requireAuth, async (req, res, next) => {
	const userId = req.user.id;
	console.log(userId);
	try {
		const user = db
			.prepare(`SELECT home_lat, home_lon FROM users WHERE id = ?`)
			.get(userId);

		if (!user) return next(new ApiError(404, 'User not found'));
		console.log(user.home_lat);
		const weather = await getWeather(user.home_lat, user.home_lon);
		console.log(weather);
		res.json(weather);
	} catch (err) {
		console.error(err);
		return next(new ApiError(500));
	}
});

router.get('/activity', requireAuth, (req, res, next) => {
	const userId = req.user.id;
	try {
		const activityList = db
			.prepare(
				`  SELECT * FROM device_log WHERE device_log.user_id = ?  ORDER BY time DESC LIMIT 3;`,
			)
			.all(userId);
		console.log(activityList);
		res.json(activityList);
	} catch {
		return next(new ApiError(500));
	}
});

module.exports = router;
