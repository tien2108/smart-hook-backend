const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'database.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`Database initialized at ${dbPath}`);
// Create tables if they don't exist
db.exec(`
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

module.exports = db;
