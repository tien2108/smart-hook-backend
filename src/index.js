const express = require('express');
const cors = require('cors');
const { ApiError } = require('./utils/errors'); // ✅ CommonJS style
const WebSocket = require('ws');
const http = require('http');

const setupWebSocket = require('./websocket'); 

// Load .env file if present (no extra dependency — just read it manually)
const fs = require('fs');
const path = require('path');
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

// Initialize database (runs schema creation on first require)
require('./db');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/device', require('./routes/device'));

// Health check
app.get('/api/health', (req, res) => {
	res.json({ status: 'ok' });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
	if (err instanceof ApiError) {
		return res.status(err.status).json({ error: err.message });
	}
	console.error(err);
	res.status(500).json({ error: 'Internal server error' });
});



// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
setupWebSocket(wss);

server.listen(PORT, '0.0.0.0', () => {
	console.log(`Server running on port ${PORT}`);
});