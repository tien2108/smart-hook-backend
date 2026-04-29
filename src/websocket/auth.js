const db = require('../db');

function verifyDevice(uuid){
  const device = db.prepare('SELECT * FROM devices WHERE uuid = ?').get(uuid);
  const auth = !!device; // Convert to boolean
  if (auth) {
    // Set device status to online and update last_seen timestamp
    db.prepare('UPDATE devices SET status = ? WHERE uuid = ?')
      .run('online', uuid);
  }
  return !!device; // Return true if device exists, false otherwise
}

module.exports = {
  verifyDevice
};