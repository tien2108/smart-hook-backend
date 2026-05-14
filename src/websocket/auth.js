const db = require('../db');

function verifyDevice(uuid) {
	const check = db
		.prepare(
			`SELECT d.id as device_id, d.name, u.id as user_id FROM devices AS d
    INNER JOIN user_device AS ud ON ud.device_id=d.id
    INNER JOIN users AS u ON ud.user_id=u.id
     WHERE d.uuid = ?`,
		)
		.get(uuid);
	const auth = !!check; // Convert to boolean
	if (auth) {
		// Set device status to online and update last_seen timestamp
		db.prepare('UPDATE devices SET status = ? WHERE uuid = ?').run(
			'online',
			uuid,
		);
		db.prepare(
			'INSERT INTO device_log (device_id,device_name, user_id, action) VALUES (?, ?, ?, ?)',
		).run(check.device_id, check.name, check.user_id, `Connect`);
	}
	return !!check; // Return true if device exists, false otherwise
}

module.exports = {
	verifyDevice,
};
