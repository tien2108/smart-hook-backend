const db = require('../db');

async function onCoat(ws, device) {
	console.log(`Handling coat on for device UUID: ${device.uuid}`);

	// Here you can implement any logic needed when the coat is put on, e.g., update database status
	// For example, you might want to log this event in the device_log table

	await db
		.prepare('UPDATE devices SET status = ? WHERE uuid = ?')
		.run('coat_on', device.uuid);

	await db
		.prepare(
			'INSERT INTO device_log (device_id, device_name, user_id, action) VALUES (?, ?, ?, ?)',
		)
		.run(device.id, device.name, device.user_id, `Coat put on`);
}

module.exports = {
	onCoat,
};
