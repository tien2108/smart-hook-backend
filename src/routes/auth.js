const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { requireAuth, signToken } = require('../middleware/auth');
const { ApiError } = require('../utils/errors');
const { geocode } = require('../utils/geocode');

const router = express.Router();

// POST /api/auth/register — create a new account
router.post('/register', async (req, res, next) => {
	try {
		const { email, password, name, home_address, work_address } = req.body;

		if (!email || !password) {
			throw new ApiError(400, 'Email and password are required');
		}

		const existing = db
			.prepare('SELECT id FROM users WHERE email = ?')
			.get(email);
		if (existing) {
			throw new ApiError(409, 'Email already registered');
		}
		const passwordHash = await bcrypt.hash(password, 10);
		const updates = {
			email: email,
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

		const query = `
    INSERT INTO users (${keys.join(', ')})
    VALUES (${placeholders})
`;

		const result = db.prepare(query).run(...values);

		const user = { id: result.lastInsertRowid, email };
		const token = signToken(user);

		res
			.status(201)
			.json({ token, user: { id: user.id, email, name: name || null } });
	} catch (err) {
		next(err);
	}
});

// POST /api/auth/login — authenticate and get JWT
router.post('/login', async (req, res, next) => {
	try {
		const { username, password } = req.body;

		if (!username || !password) {
			throw new ApiError(400, 'Email and password are required');
		}

		const user = db
			.prepare('SELECT * FROM users WHERE email = ? or name = ?')
			.get(username, username);
		if (!user) {
			throw new ApiError(401, 'Invalid email or password');
		}

		const valid = await bcrypt.compare(password, user.password_hash);
		if (!valid) {
			throw new ApiError(401, 'Invalid email or password');
		}

		const token = signToken(user);
		res.json({
			token,
			user: { id: user.id, email: user.email, name: user.name },
		});
	} catch (err) {
		next(err);
	}
});

// GET /api/auth/me — current user profile
router.get('/me', requireAuth, (req, res) => {
	const user = db
		.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?')
		.get(req.user.id);
	if (!user) {
		return res.status(404).json({ error: 'User not found' });
	}
	res.json(user);
});

router.get('/user/:id', requireAuth, (req, res) => {
	const user = db
		.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?')
		.get(req.params.id);
	if (!user) {
		return res.status(404).json({ error: 'User not found' });
	}
	res.json(user);
});

module.exports = router;
