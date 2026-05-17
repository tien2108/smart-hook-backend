require('dotenv').config({
	path: require('path').join(__dirname, '..', '.env'),
});
const express = require('express');
const cors = require('cors');
const { ApiError } = require('./utils/errors');
const WebSocket = require('ws');
const http = require('http');
const setupWebSocket = require('./websocket');
const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
	fs.readFileSync(envPath, 'utf8')
		.split('\n')
		.forEach((line) => {
			const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
			if (match && !process.env[match[1]]) {
				process.env[match[1]] = match[2] || '';
			}
		});
}

async function start() {
	// Init DB before anything else
	const db = require('./db');
	await db.init();

	const app = express();

	app.use(cors());
	app.use(express.json());

	app.use('/api/auth', require('./routes/auth'));
	app.use('/api/webhook', require('./routes/webhook'));
	app.use('/api/device', require('./routes/device'));
	app.use('/api/data', require('./routes/data'));
	app.use('/api/user', require('./routes/user'));

	app.get('/api/health', (req, res) => {
		res.json({ status: 'ok' });
	});

	app.use((err, req, res, next) => {
		if (err instanceof ApiError) {
			return res.status(err.status).json({ error: err.message });
		}
		console.error(err);
		res.status(500).json({ error: 'Internal server error' });
	});

	const PORT = process.env.PORT || 3000;
	const server = http.createServer(app);
	const wss = new WebSocket.Server({ server });
	setupWebSocket(wss);

	server.listen(PORT, '0.0.0.0', () => {
		console.log(`Server running on port ${PORT}`);
	});
}

start().catch((err) => {
	console.error('Failed to start server:', err);
	process.exit(1);
});
