const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /api/webhook/sensor-data — ingest measurement from NodeRED
// No auth: called by NodeRED on internal network.
//
// Expected body (matches NodeRED's parsed sensor_data format):
// {
//   "device": "UUID-STRING",
//   "sensor": "slider",
//   "value": 57.41,
//   "timestamp": 1672531200000
// }
//
// For complex sensors, value may be an object:
// {
//   "device": "UUID-STRING",
//   "sensor": "imu",
//   "value": { "accelX": 0.12, "accelY": -0.05, "accelZ": 9.81 },
//   "timestamp": 1672531200000
// }

router.post('/sensor-data', (req, res) => {
	const { device: uuid, sensor, value, timestamp } = req.body;

	if (!uuid || !sensor || value === undefined) {
		return res
			.status(400)
			.json({ error: 'device, sensor, and value are required' });
	}

	// Look up device by UUID
	let deviceRow = db.prepare('SELECT id FROM devices WHERE uuid = ?').get(uuid);
	if (!deviceRow) {
		// Device not yet claimed — still store the data with a device record
		// This allows the webhook to work before a user claims the device
		db.prepare(
			'INSERT OR IGNORE INTO devices (uuid, name, type) VALUES (?, ?, ?)',
		).run(uuid, uuid, 'ESP32');

		// Re-fetch (may have been inserted or already existed via race)
		deviceRow = db.prepare('SELECT id FROM devices WHERE uuid = ?').get(uuid);
		if (!deviceRow) {
			return res.status(500).json({ error: 'Failed to register device' });
		}
	}

	const deviceId = deviceRow.id;
	const measuredAt = timestamp
		? new Date(timestamp).toISOString()
		: new Date().toISOString();

	// Store measurement: numeric values go in `value`, objects go in `value_json`
	const isNumeric = typeof value === 'number';
	db.prepare(
		`
    INSERT INTO measurements (device_id, sensor_name, value, value_json, measured_at)
    VALUES (?, ?, ?, ?, ?)
  `,
	).run(
		deviceId,
		sensor,
		isNumeric ? value : null,
		isNumeric ? null : JSON.stringify(value),
		measuredAt,
	);

	// Update device last_seen
	db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').run(
		new Date().toISOString(),
		deviceId,
	);

	// ── Check alert rules ──────────────────────────────────────────────────
	// Only check for numeric values (threshold comparison doesn't apply to objects)
	if (isNumeric) {
		const rules = db
			.prepare(
				`
      SELECT * FROM alert_rules
      WHERE device_id = ? AND sensor_name = ? AND enabled = 1
    `,
			)
			.all(deviceId, sensor);

		const insertAlert = db.prepare(`
      INSERT INTO alert_history (rule_id, value) VALUES (?, ?)
    `);
		const updateLastTriggered = db.prepare(`
      UPDATE alert_rules SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = ?
    `);

		for (const rule of rules) {
			let triggered = false;
			switch (rule.operator) {
				case 'gt':
					triggered = value > rule.threshold;
					break;
				case 'lt':
					triggered = value < rule.threshold;
					break;
				case 'gte':
					triggered = value >= rule.threshold;
					break;
				case 'lte':
					triggered = value <= rule.threshold;
					break;
				case 'eq':
					triggered = value === rule.threshold;
					break;
			}
			if (triggered) {
				insertAlert.run(rule.id, value);
				updateLastTriggered.run(rule.id);
			}
		}
	}

	res.json({ stored: true });
});

module.exports = router;
