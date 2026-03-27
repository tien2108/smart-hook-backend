const db = require('../db');

function verifyDevice(uuid){
  const device = db.prepare('SELECT * FROM devices WHERE uuid = ?').get(uuid);
  return !!device; // Return true if device exists, false otherwise
}

module.exports = {
  verifyDevice
};