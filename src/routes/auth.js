const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { requireAuth, signToken } = require('../middleware/auth');
const { ApiError } = require('../utils/errors');

const router = express.Router();

// POST /api/auth/register — create a new account
router.post('/register', async (req, res, next) => {
	try {
		const { email, password, name } = req.body;

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
		const result = db
			.prepare(
				'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
			)
			.run(email, passwordHash, name || null);

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
		const { email, password } = req.body;

		if (!email || !password) {
			throw new ApiError(400, 'Email and password are required');
		}

		const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
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

module.exports = router;
