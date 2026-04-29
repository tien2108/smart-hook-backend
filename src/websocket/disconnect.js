const db = require('../db');

async function onDisconnect(uuid) {
  // Implement device disconnection logic here, e.g., update database status
  console.log(`Handling device disconnection for UUID: ${uuid}`);
  const device = db.prepare('SELECT * FROM devices WHERE uuid = ?').get(uuid);

  if (!device) {
    console.warn(`Received disconnect from unknown device: ${uuid}`);
    return;
  }

  // Update device status to offline
  db.prepare('UPDATE devices SET status = ? WHERE uuid = ?')
    .run('offline', uuid);
}

module.exports = {
  onDisconnect,
};