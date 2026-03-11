const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/errors');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Middleware: require valid JWT. Sets req.user = { id, email }.
function requireAuth(req, res, next) {
	const header = req.headers.authorization;
	if (!header || !header.startsWith('Bearer ')) {
		return next(new ApiError(401, 'Missing or invalid Authorization header'));
	}

	try {
		const token = header.slice(7);
		const payload = jwt.verify(token, JWT_SECRET);
		req.user = { id: payload.id, email: payload.email };
		next();
	} catch {
		next(new ApiError(401, 'Invalid or expired token'));
	}
}

// Middleware: attach req.user if token present, but don't require it.
// Used for endpoints that behave differently for authenticated vs anonymous users.
function optionalAuth(req, res, next) {
	const header = req.headers.authorization;
	if (!header || !header.startsWith('Bearer ')) {
		req.user = null;
		return next();
	}

	try {
		const token = header.slice(7);
		const payload = jwt.verify(token, JWT_SECRET);
		req.user = { id: payload.id, email: payload.email };
	} catch {
		req.user = null;
	}
	next();
}

function signToken(user) {
	return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
		expiresIn: '7d',
	});
}

module.exports = { requireAuth, optionalAuth, signToken, JWT_SECRET };
