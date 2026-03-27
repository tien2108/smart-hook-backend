const express = require('express');
const db = require('../db');
const { ApiError } = require('../utils/errors');

const router = express.Router();

// Add device to database endpoint 
router.post('/v1/add-device', (req, res, next) => {
  const { uuid, name, type } = req.body;

  if (!uuid || !name || !type) {
    return next(new ApiError(400, 'UUID, name, and type are required'));
  }

  console.log(`Adding device: ${uuid}, ${name}, ${type}`);
  
  try {
    const existing = db.prepare('SELECT id FROM devices WHERE uuid = ?').get(uuid);
    if (existing) {
      return next(new ApiError(409, 'Device with this UUID already exists'));
    }

    db.prepare('INSERT INTO devices (uuid, name, type) VALUES (?, ?, ?)').run(uuid, name, type);
    res.json({ message: "Device added successfully" });
  } catch (error) {
    return next(new ApiError(500, 'Error adding device'));
  }
});

router.get('/v1/devices', (req, res, next) => {
  try {
    const devices = db.prepare('SELECT * FROM devices').all();

    console.log(`Fetched devices: ${JSON.stringify(devices)}`);

    res.json({ devices });
  } catch (error) {
    return next(new ApiError(500, 'Error fetching devices'));
  }
});

router.delete('/v1/device/:id', (req, res, next) => {
  const { id } = req.params;

  try {
    const result = db.prepare('DELETE FROM devices WHERE id = ?').run(id);
    if (result.changes === 0) {
      return next(new ApiError(404, 'Device not found'));
    }
    console.log(`Deleted device with id: ${id}`);
    res.json({ message: "Device deleted successfully" });
  } catch (error) {
    return next(new ApiError(500, 'Error deleting device'));
  }
});

module.exports = router;