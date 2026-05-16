const express = require('express');
const db = require('../db');
const bcrypt = require('bcrypt');
const { ApiError } = require('../utils/errors');
const { geocode } = require('../utils/geocode');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

//Get user profile
router.get('/', requireAuth, async (req, res, next) => {
	try {
		const user = await db
			.prepare(
				'SELECT name, home_address, dest_address FROM users WHERE id = ?',
			)
			.get(req.user.id);

		res.json(user);
	} catch (error) {
		console.error(error);
		next(ApiError(500, 'Fail to load user profile'));
	}
});

//Update user profile
router.post('/', requireAuth, async (req, res, next) => {
	try {
		const { password, name, home_address, work_address } = req.body;

		const passwordHash = await bcrypt.hash(password, 10);
		const updates = {
			password_hash: passwordHash,
			name: name,
			home_address: home_address,
			dest_address: work_address,
		};

		const home = await geocode(home_address);
		updates.home_lat = home.latitude;
		updates.home_lon = home.longitude;
		const dest = await geocode(work_address);
		updates.dest_lat = dest.latitude;
		updates.dest_lon = dest.longitude;

		// Build INSERT query dynamically
		const keys = Object.keys(updates);
		const placeholders = keys.map(() => '?').join(', ');
		const values = Object.values(updates);
		// "uuid = ?, name = ?, ..."
		const setClause = keys.map((key) => `${key} = ?`).join(', ');

		const query = `
    UPDATE users
    SET ${setClause}
    WHERE id = ?
`;

		await db.prepare(query).run(...values, req.user.id);
	} catch (err) {
		console.error(err);
		next(new ApiError(500, 'Error update profile'));
	}
});

router.delete('/', requireAuth, async (req, res, next) => {
	try {
		const user = await db
			.prepare('SELECT name FROM users WHERE id = ?')
			.get(req.user.id);
		if (!user) {
			next(new ApiError(404, 'User not found'));
		}

		await db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
	} catch (error) {
		console.log(error);
		next(new ApiError(500, error));
	}
});

module.exports = router;
