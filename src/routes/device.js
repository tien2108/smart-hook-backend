const express = require('express');
const router = express.Router();

// GET /api/device/v1/screen-state — prototype for ESP32
router.get('/v1/screen-state', (req, res) => {
  res.json({
    line1: "4C Cloudy",           // Top LCD row
    line2: "Work 24 min",         // Bottom LCD row
    updatedAt: new Date().toISOString(),
    refreshAfterSec: 300
  });
});

module.exports = router;