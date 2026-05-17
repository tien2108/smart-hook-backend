const { createClient } = require('@libsql/client');

const client = createClient({
	url: process.env.TURSO_URL,
	authToken: process.env.TURSO_TOKEN,
});

function sanitizeArgs(params) {
	return params.flat().map((v) => (v === undefined ? null : v));
}

function convertRow(row) {
	if (!row) return null;
	const converted = {};
	for (const [key, value] of Object.entries(row)) {
		converted[key] = typeof value === 'bigint' ? Number(value) : value;
	}
	return converted;
}

function makeStatement(sql) {
	return {
		get: async (...params) => {
			const args = params.flat().map((v) => (v === undefined ? null : v));
			const result = await client.execute({ sql, args });
			return convertRow(result.rows[0] ?? null);
		},
		all: async (...params) => {
			const args = params.flat().map((v) => (v === undefined ? null : v));
			const result = await client.execute({ sql, args });
			return result.rows.map(convertRow);
		},
		run: async (...params) => {
			const args = params.flat().map((v) => (v === undefined ? null : v));
			const result = await client.execute({ sql, args });
			return {
				lastInsertRowid: Number(result.lastInsertRowid),
				changes: result.rowsAffected,
			};
		},
	};
}

const db = {
	prepare: (sql) => makeStatement(sql),
	exec: async (sql) => {
		const statements = sql
			.split(';')
			.map((s) => s.trim())
			.filter(Boolean)
			.map((s) => ({ sql: s }));
		await client.batch(statements, 'write');
	},
	pragma: () => {},
	init: async () => {
		await db.exec(`
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT UNIQUE NOT NULL,
				password_hash TEXT NOT NULL,
				email TEXT UNIQUE NOT NULL,
				home_address TEXT NOT NULL,
				dest_address TEXT NOT NULL,
				home_lat TEXT NOT NULL,
				home_lon TEXT NOT NULL,
				dest_lat TEXT NOT NULL,
				dest_lon TEXT NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS devices (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				uuid TEXT UNIQUE NOT NULL,
				name TEXT NOT NULL,
				type TEXT DEFAULT 'hook',
				status TEXT DEFAULT 'offline',
				origin TEXT,
				dest TEXT,
				origin_lat REAL,
				origin_lon REAL,
				dest_lat REAL,
				dest_lon REAL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS user_device(
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				device_id INTEGER,
				user_id INTEGER,
				FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS device_log (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				device_id INTEGER,
				device_name TEXT,
				user_id INTEGER,
				action TEXT,
				time DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			);
		`);
		console.log('Turso database initialized');
	},
};

module.exports = db;
