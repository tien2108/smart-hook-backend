const db = require('../db');

async function onDisconnect(uuid) {
	// Implement device disconnection logic here, e.g., update database status
	console.log(`Handling device disconnection for UUID: ${uuid}`);
	const device = await db
		.prepare('SELECT * FROM devices WHERE uuid = ?')
		.get(uuid);

	if (!device) {
		console.warn(`Received disconnect from unknown device: ${uuid}`);
		return;
	}

	// Update device status to offline
	await db
		.prepare('UPDATE devices SET status = ? WHERE uuid = ?')
		.run('offline', uuid);

	await db
		.prepare(
			'INSERT INTO device_log (device_id, device_name, user_id, action) VALUES (?, ?, ?, ?)',
		)
		.run(device.id, device.name, device.user_id, `Device disconnected`);
}

module.exports = {
	onDisconnect,
};
